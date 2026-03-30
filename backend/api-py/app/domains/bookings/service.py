from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.authorization import AuthorizationError
from app.domains.base import BaseDomainService
from app.domains.bookings.repository import BookingListRecord, BookingsRepository
from app.schemas.auth import UserSummary
from app.schemas.bookings import BookingRecord, CreateBookingRequest
from app.schemas.common import UserRole


class BookingsService(BaseDomainService):
    def __init__(self, db: Session, settings: Settings) -> None:
        super().__init__(db, settings)
        self.repository = BookingsRepository(db)

    def _to_booking_record(self, booking: BookingListRecord) -> BookingRecord:
        return BookingRecord(
            id=booking.id,
            customer_id=booking.customer_id,
            owner_id=booking.owner_id,
            business_id=booking.business_id,
            service_id=booking.service_id,
            service_name=booking.service_name,
            status=booking.status,
            start_at=self.brain.processing.dates.to_utc_iso(booking.start_at).replace(
                "+00:00",
                "Z",
            ),
            end_at=self.brain.processing.dates.to_utc_iso(booking.end_at).replace(
                "+00:00",
                "Z",
            ),
            note=booking.note,
        )

    def list_bookings(
        self,
        actor: UserSummary,
        *,
        requested_user_id: Optional[str],
        requested_role: Optional[UserRole],
    ) -> List[BookingRecord]:
        try:
            target_user_id = self.resolve_user_scope(actor, requested_user_id)
        except AuthorizationError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access data inside your own account scope",
            ) from exc

        try:
            role = self.resolve_booking_role(actor, requested_role)
        except AuthorizationError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view bookings inside your own role scope",
            ) from exc

        bookings = self.repository.list_bookings(
            target_user_id,
            role,
        )
        return [self._to_booking_record(booking) for booking in bookings]

    def create_booking(
        self,
        input_data: CreateBookingRequest,
        actor: UserSummary,
    ) -> BookingRecord:
        try:
            start_at = self.parse_timestamp(input_data.start_at)
            end_at = self.parse_timestamp(input_data.end_at)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid booking timestamp",
            ) from exc

        normalized_note = self.sanitize_text(input_data.note)

        with self.db.begin():
            owner_user_id = self.repository.get_business_owner_id(input_data.business_id)
            if owner_user_id is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Business not found",
                )

            if actor.role == "customer" and input_data.customer_id != actor.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Customers can only create bookings for themselves",
                )

            if actor.role == "owner" and owner_user_id != actor.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Owners can only create bookings for their own businesses",
                )

            service = self.repository.get_active_service(
                input_data.service_id,
                input_data.business_id,
            )
            if service is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Service not found for this business",
                )

            slot = self.repository.get_availability_slot(
                input_data.business_id,
                input_data.service_id,
                start_at,
                end_at,
            )
            if slot is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Availability slot not found",
                )

            if slot.is_booked:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Availability slot is already booked",
                )

            if not self.repository.reserve_slot(slot.id):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Availability slot is already booked",
                )

            booking = self.repository.create_booking(
                customer_id=input_data.customer_id,
                owner_id=owner_user_id,
                business_id=input_data.business_id,
                service_id=service.id,
                service_name=service.name,
                staff_id=slot.staff_id,
                status="pending",
                start_at=start_at,
                end_at=end_at,
                note=normalized_note,
            )
            self.repository.create_status_history(
                appointment_id=booking.id,
                new_status="pending",
                changed_by_user_id=actor.id,
            )
            self.repository.create_notification(
                user_id=owner_user_id,
                notification_type="booking_created",
                title="New booking request",
                body=f"{service.name} was requested.",
            )
            self.repository.create_notification(
                user_id=input_data.customer_id,
                notification_type="booking_created",
                title="Booking request received",
                body=f"{service.name} was sent to the salon for confirmation.",
            )

        return self._to_booking_record(booking)
