from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    get_admin_service,
    get_current_session,
    get_customer_insights_service,
    get_payments_service,
)
from app.domains.admin.service import AdminService
from app.domains.customer_insights.service import CustomerInsightsService
from app.domains.payments.service import PaymentsService
from app.schemas.admin import (
    AdminActionRecord,
    AdminAccountSummary,
    AdminBusinessQueueItem,
    AdminConversationCase,
    AdminOverview,
    AdminReviewQueueItem,
    CreateAdminAccessSessionRequest,
    UpdateAdminAccountRequest,
    UpdateBusinessStatusRequest,
    UpdateConversationCaseStatusRequest,
    UpdateHomepageBusinessRequest,
    UpdateReviewStatusRequest,
)
from app.schemas.auth import SessionPayload
from app.schemas.businesses import BusinessSummary
from app.schemas.common import AdPaymentStatus, BusinessModerationStatus, ReviewModerationStatus, UserRole
from app.schemas.customer_insights import CustomerPreferenceReportRecord
from app.schemas.payments import AdPaymentRecord, UpdateAdPaymentDiscountRequest
from app.schemas.payments import AdPricingRecord, UpdateAdPricingRequest

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview", response_model=AdminOverview)
def get_admin_overview(
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> AdminOverview:
    return service.get_overview(session.user)


@router.get("/homepage-businesses", response_model=List[BusinessSummary])
def get_homepage_businesses(
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> List[BusinessSummary]:
    return service.get_homepage_businesses(session.user)


@router.get("/businesses", response_model=List[AdminBusinessQueueItem])
def get_admin_businesses(
    status: Optional[BusinessModerationStatus] = Query(default=None),
    search: Optional[str] = Query(default=None),
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> List[AdminBusinessQueueItem]:
    return service.get_businesses(session.user, status, search)


@router.get("/reviews", response_model=List[AdminReviewQueueItem])
def get_admin_reviews(
    status: Optional[ReviewModerationStatus] = Query(default=None),
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> List[AdminReviewQueueItem]:
    return service.get_reviews(session.user, status)


@router.get("/conversations", response_model=List[AdminConversationCase])
def get_admin_conversations(
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> List[AdminConversationCase]:
    return service.get_conversations(session.user)


@router.get("/audit-actions", response_model=List[AdminActionRecord])
def get_admin_audit_actions(
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> List[AdminActionRecord]:
    return service.get_audit_actions(session.user)


@router.get("/customer-insights/report", response_model=CustomerPreferenceReportRecord)
def get_admin_customer_insights_report(
    session: SessionPayload = Depends(get_current_session),
    service: CustomerInsightsService = Depends(get_customer_insights_service),
) -> CustomerPreferenceReportRecord:
    return service.get_admin_report(session.user)


@router.get("/accounts", response_model=List[AdminAccountSummary])
def get_admin_accounts(
    search: Optional[str] = Query(default=None),
    role: Optional[UserRole] = Query(default=None),
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> List[AdminAccountSummary]:
    return service.get_accounts(session.user, search=search, role_filter=role)


@router.get("/accounts/{user_id}", response_model=AdminAccountSummary)
def get_admin_account(
    user_id: str,
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> AdminAccountSummary:
    return service.get_account(user_id, session.user)


@router.get("/ad-payments", response_model=List[AdPaymentRecord])
def get_admin_ad_payments(
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


@router.get("/ad-pricing", response_model=List[AdPricingRecord])
def get_admin_ad_pricing(
    session: SessionPayload = Depends(get_current_session),
    service: PaymentsService = Depends(get_payments_service),
) -> List[AdPricingRecord]:
    return service.list_ad_pricing(session.user)


@router.patch("/businesses/{business_id}/homepage", response_model=BusinessSummary)
def update_homepage_placement(
    business_id: str,
    input_data: UpdateHomepageBusinessRequest,
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> BusinessSummary:
    return service.update_homepage_placement(business_id, input_data, session.user)


@router.patch("/businesses/{business_id}/status", response_model=AdminBusinessQueueItem)
def update_business_status(
    business_id: str,
    input_data: UpdateBusinessStatusRequest,
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> AdminBusinessQueueItem:
    return service.update_business_status(business_id, input_data, session.user)


@router.patch("/reviews/{review_id}/status", response_model=AdminReviewQueueItem)
def update_review_status(
    review_id: str,
    input_data: UpdateReviewStatusRequest,
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> AdminReviewQueueItem:
    return service.update_review_status(review_id, input_data, session.user)


@router.patch(
    "/conversations/{conversation_id}/status",
    response_model=AdminConversationCase,
)
def update_conversation_case_status(
    conversation_id: str,
    input_data: UpdateConversationCaseStatusRequest,
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> AdminConversationCase:
    return service.update_conversation_case_status(
        conversation_id,
        input_data,
        session.user,
    )


@router.patch("/accounts/{user_id}", response_model=AdminAccountSummary)
def update_admin_account(
    user_id: str,
    input_data: UpdateAdminAccountRequest,
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> AdminAccountSummary:
    return service.update_account(user_id, input_data, session.user)


@router.post("/accounts/{user_id}/access-session", response_model=SessionPayload)
def create_admin_account_access_session(
    user_id: str,
    input_data: CreateAdminAccessSessionRequest,
    session: SessionPayload = Depends(get_current_session),
    service: AdminService = Depends(get_admin_service),
) -> SessionPayload:
    return service.create_account_access_session(user_id, input_data, session.user)


@router.patch("/ad-payments/{payment_id}/discount", response_model=AdPaymentRecord)
def update_ad_payment_discount(
    payment_id: str,
    input_data: UpdateAdPaymentDiscountRequest,
    session: SessionPayload = Depends(get_current_session),
    service: PaymentsService = Depends(get_payments_service),
) -> AdPaymentRecord:
    return service.update_ad_payment_discount(payment_id, input_data, session.user)


@router.patch("/ad-pricing/{placement}", response_model=AdPricingRecord)
def update_ad_pricing(
    placement: str,
    input_data: UpdateAdPricingRequest,
    session: SessionPayload = Depends(get_current_session),
    service: PaymentsService = Depends(get_payments_service),
) -> AdPricingRecord:
    return service.update_ad_pricing(placement, input_data, session.user)
