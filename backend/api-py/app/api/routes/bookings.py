from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_bookings_service, get_current_session
from app.domains.bookings.service import BookingsService
from app.schemas.auth import SessionPayload
from app.schemas.bookings import BookingRecord, CreateBookingRequest
from app.schemas.common import UserRole

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("", response_model=List[BookingRecord])
def get_bookings(
    user_id: Optional[str] = Query(default=None, alias="userId"),
    role: Optional[UserRole] = None,
    session: SessionPayload = Depends(get_current_session),
    service: BookingsService = Depends(get_bookings_service),
) -> List[BookingRecord]:
    return service.list_bookings(session.user, requested_user_id=user_id, requested_role=role)


@router.post("", response_model=BookingRecord)
def create_booking(
    input_data: CreateBookingRequest,
    session: SessionPayload = Depends(get_current_session),
    service: BookingsService = Depends(get_bookings_service),
) -> BookingRecord:
    return service.create_booking(input_data, session.user)
