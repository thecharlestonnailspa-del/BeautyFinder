from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domains.notifications.repository import NotificationsRepository


@dataclass(frozen=True)
class BookingListRecord:
    id: str
    customer_id: str
    owner_id: str
    business_id: str
    service_id: str
    service_name: str
    status: str
    start_at: datetime
    end_at: datetime
    note: Optional[str]


@dataclass(frozen=True)
class ServiceBookingRecord:
    id: str
    name: str


@dataclass(frozen=True)
class AvailabilitySlotRecord:
    id: str
    staff_id: Optional[str]
    is_booked: bool


class BookingsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationsRepository(db)

    def _generate_id(self) -> str:
        return uuid4().hex

    def _to_booking_list_record(self, row) -> BookingListRecord:
        return BookingListRecord(
            id=str(row["id"]),
            customer_id=str(row["customerId"]),
            owner_id=str(row["ownerId"]),
            business_id=str(row["businessId"]),
            service_id=str(row["serviceId"]),
            service_name=str(row["serviceName"]),
            status=str(row["status"]),
            start_at=row["startTime"],
            end_at=row["endTime"],
            note=None if row["notes"] is None else str(row["notes"]),
        )

    def list_bookings(self, user_id: str, role: str) -> List[BookingListRecord]:
        where_clause = ""
        params = {}
        if role == "owner":
            where_clause = 'WHERE appointment."ownerId" = :user_id'
            params["user_id"] = user_id
        elif role == "customer":
            where_clause = 'WHERE appointment."customerId" = :user_id'
            params["user_id"] = user_id

        rows = self.db.execute(
            text(
                f"""
                SELECT
                  appointment."id",
                  appointment."customerId",
                  appointment."ownerId",
                  appointment."businessId",
                  appointment."serviceId",
                  service."name" AS "serviceName",
                  LOWER(CAST(appointment."status" AS TEXT)) AS "status",
                  appointment."startTime",
                  appointment."endTime",
                  appointment."notes"
                FROM "Appointment" AS appointment
                INNER JOIN "Service" AS service
                  ON service."id" = appointment."serviceId"
                {where_clause}
                ORDER BY appointment."startTime" DESC
                """,
            ),
            params,
        ).mappings()

        return [self._to_booking_list_record(row) for row in rows]

    def get_business_owner_id(self, business_id: str) -> Optional[str]:
        row = self.db.execute(
            text(
                """
                SELECT "ownerUserId"
                FROM "Business"
                WHERE "id" = :business_id
                LIMIT 1
                """,
            ),
            {"business_id": business_id},
        ).mappings().first()

        if row is None:
            return None
        return str(row["ownerUserId"])

    def get_active_service(
        self,
        service_id: str,
        business_id: str,
    ) -> Optional[ServiceBookingRecord]:
        row = self.db.execute(
            text(
                """
                SELECT "id", "name"
                FROM "Service"
                WHERE "id" = :service_id
                  AND "businessId" = :business_id
                  AND "isActive" = TRUE
                LIMIT 1
                """,
            ),
            {
                "service_id": service_id,
                "business_id": business_id,
            },
        ).mappings().first()

        if row is None:
            return None

        return ServiceBookingRecord(
            id=str(row["id"]),
            name=str(row["name"]),
        )

    def get_availability_slot(
        self,
        business_id: str,
        service_id: str,
        start_at: datetime,
        end_at: datetime,
    ) -> Optional[AvailabilitySlotRecord]:
        row = self.db.execute(
            text(
                """
                SELECT "id", "staffId", "isBooked"
                FROM "AvailabilitySlot"
                WHERE "businessId" = :business_id
                  AND "serviceId" = :service_id
                  AND "startTime" = :start_at
                  AND "endTime" = :end_at
                LIMIT 1
                """,
            ),
            {
                "business_id": business_id,
                "service_id": service_id,
                "start_at": start_at,
                "end_at": end_at,
            },
        ).mappings().first()

        if row is None:
            return None

        return AvailabilitySlotRecord(
            id=str(row["id"]),
            staff_id=None if row["staffId"] is None else str(row["staffId"]),
            is_booked=bool(row["isBooked"]),
        )

    def create_booking(
        self,
        *,
        customer_id: str,
        owner_id: str,
        business_id: str,
        service_id: str,
        service_name: str,
        staff_id: Optional[str],
        status: str,
        start_at: datetime,
        end_at: datetime,
        note: Optional[str],
    ) -> BookingListRecord:
        booking_id = self._generate_id()
        self.db.execute(
            text(
                """
                INSERT INTO "Appointment" (
                  "id",
                  "customerId",
                  "ownerId",
                  "businessId",
                  "serviceId",
                  "staffId",
                  "status",
                  "startTime",
                  "endTime",
                  "notes",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  :id,
                  :customer_id,
                  :owner_id,
                  :business_id,
                  :service_id,
                  :staff_id,
                  :status,
                  :start_at,
                  :end_at,
                  :note,
                  NOW(),
                  NOW()
                )
                """,
            ),
            {
                "id": booking_id,
                "customer_id": customer_id,
                "owner_id": owner_id,
                "business_id": business_id,
                "service_id": service_id,
                "staff_id": staff_id,
                "status": status.upper(),
                "start_at": start_at,
                "end_at": end_at,
                "note": note,
            },
        )

        return BookingListRecord(
            id=booking_id,
            customer_id=customer_id,
            owner_id=owner_id,
            business_id=business_id,
            service_id=service_id,
            service_name=service_name,
            status=status.lower(),
            start_at=start_at,
            end_at=end_at,
            note=note,
        )

    def create_status_history(
        self,
        *,
        appointment_id: str,
        new_status: str,
        changed_by_user_id: str,
    ) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO "AppointmentStatusHistory" (
                  "id",
                  "appointmentId",
                  "oldStatus",
                  "newStatus",
                  "changedByUserId",
                  "createdAt"
                )
                VALUES (
                  :id,
                  :appointment_id,
                  NULL,
                  :new_status,
                  :changed_by_user_id,
                  NOW()
                )
                """,
            ),
            {
                "id": self._generate_id(),
                "appointment_id": appointment_id,
                "new_status": new_status.upper(),
                "changed_by_user_id": changed_by_user_id,
            },
        )

    def mark_slot_booked(self, slot_id: str) -> None:
        self.db.execute(
            text(
                """
                UPDATE "AvailabilitySlot"
                SET "isBooked" = TRUE
                WHERE "id" = :slot_id
                """,
            ),
            {"slot_id": slot_id},
        )

    def reserve_slot(self, slot_id: str) -> bool:
        result = self.db.execute(
            text(
                """
                UPDATE "AvailabilitySlot"
                SET "isBooked" = TRUE
                WHERE "id" = :slot_id
                  AND "isBooked" = FALSE
                """,
            ),
            {"slot_id": slot_id},
        )
        return bool(getattr(result, "rowcount", 0))

    def create_notification(
        self,
        *,
        user_id: str,
        notification_type: str,
        title: str,
        body: Optional[str],
    ) -> None:
        self.notifications.create_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
        )
