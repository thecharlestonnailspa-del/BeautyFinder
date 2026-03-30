from fastapi import APIRouter, Depends

from app.api.deps import get_current_session, get_customer_insights_service
from app.domains.customer_insights.service import CustomerInsightsService
from app.schemas.auth import SessionPayload
from app.schemas.customer_insights import (
    OwnerAudienceReportRecord,
    RecordBusinessPageViewRequest,
    RecordBusinessPageViewResponse,
)

router = APIRouter(prefix="/customer-insights", tags=["customer-insights"])


@router.post(
    "/businesses/{business_id}/page-view",
    response_model=RecordBusinessPageViewResponse,
)
def record_business_page_view(
    business_id: str,
    input_data: RecordBusinessPageViewRequest,
    session: SessionPayload = Depends(get_current_session),
    service: CustomerInsightsService = Depends(get_customer_insights_service),
) -> RecordBusinessPageViewResponse:
    return service.record_business_page_view(business_id, input_data, session.user)


@router.get("/owner/report", response_model=OwnerAudienceReportRecord)
def get_owner_audience_report(
    session: SessionPayload = Depends(get_current_session),
    service: CustomerInsightsService = Depends(get_customer_insights_service),
) -> OwnerAudienceReportRecord:
    return service.get_owner_audience_report(session.user)
