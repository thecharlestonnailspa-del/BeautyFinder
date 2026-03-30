from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_session, get_payments_service
from app.domains.payments.service import PaymentsService
from app.schemas.auth import SessionPayload
from app.schemas.common import AdPaymentStatus, UserRole
from app.schemas.payments import (
    AdPaymentRecord,
    CheckoutAdPaymentRequest,
    CheckoutPaymentRequest,
    CreateAdPaymentRequest,
    PaymentRecord,
)

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("", response_model=List[PaymentRecord])
def get_payments(
    user_id: Optional[str] = Query(default=None, alias="userId"),
    role: Optional[UserRole] = None,
    session: SessionPayload = Depends(get_current_session),
    service: PaymentsService = Depends(get_payments_service),
) -> List[PaymentRecord]:
    return service.list_payments(session.user, requested_user_id=user_id, requested_role=role)


@router.post("/checkout", response_model=PaymentRecord)
def checkout_payment(
    input_data: CheckoutPaymentRequest,
    session: SessionPayload = Depends(get_current_session),
    service: PaymentsService = Depends(get_payments_service),
) -> PaymentRecord:
    return service.checkout_payment(input_data, session.user)


@router.get("/ads", response_model=List[AdPaymentRecord])
def get_ad_payments(
    owner_id: Optional[str] = Query(default=None, alias="ownerId"),
    business_id: Optional[str] = Query(default=None, alias="businessId"),
    status_filter: Optional[AdPaymentStatus] = Query(default=None, alias="status"),
    session: SessionPayload = Depends(get_current_session),
    service: PaymentsService = Depends(get_payments_service),
) -> List[AdPaymentRecord]:
    return service.list_ad_payments(
        session.user,
        requested_owner_id=owner_id,
        business_id=business_id,
        status_filter=status_filter,
    )


@router.post("/ads", response_model=AdPaymentRecord, status_code=status.HTTP_201_CREATED)
def create_ad_payment(
    input_data: CreateAdPaymentRequest,
    session: SessionPayload = Depends(get_current_session),
    service: PaymentsService = Depends(get_payments_service),
) -> AdPaymentRecord:
    return service.create_ad_payment(input_data, session.user)


@router.post("/ads/{payment_id}/checkout", response_model=AdPaymentRecord)
def checkout_ad_payment(
    payment_id: str,
    input_data: CheckoutAdPaymentRequest,
    session: SessionPayload = Depends(get_current_session),
    service: PaymentsService = Depends(get_payments_service),
) -> AdPaymentRecord:
    return service.checkout_ad_payment(payment_id, input_data, session.user)
