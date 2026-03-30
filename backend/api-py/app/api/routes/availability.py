from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_availability_service
from app.domains.availability.service import AvailabilityService
from app.schemas.availability import AvailabilitySlotSummary

router = APIRouter(prefix="/availability", tags=["availability"])


@router.get("", response_model=List[AvailabilitySlotSummary])
def list_availability(
    business_id: Optional[str] = Query(default=None, alias="businessId"),
    service_id: Optional[str] = Query(default=None, alias="serviceId"),
    service: AvailabilityService = Depends(get_availability_service),
) -> List[AvailabilitySlotSummary]:
    return service.list_availability(business_id, service_id)
