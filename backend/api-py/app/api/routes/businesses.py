from typing import List, Optional

from fastapi import APIRouter, Depends

from app.api.deps import get_businesses_service, get_current_session
from app.domains.businesses.service import BusinessesService
from app.schemas.auth import SessionPayload
from app.schemas.businesses import (
    BusinessSummary,
    OwnerBusinessProfile,
    OwnerTechnicianProfile,
    UpdateOwnerBusinessRequest,
    UpdateOwnerTechnicianRosterRequest,
    UploadedOwnerBusinessImage,
    UploadOwnerBusinessImageRequest,
)

router = APIRouter(prefix="/businesses", tags=["businesses"])


@router.get("", response_model=List[BusinessSummary])
def list_businesses(
    category: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None,
    service: BusinessesService = Depends(get_businesses_service),
) -> List[BusinessSummary]:
    return service.list_businesses(category=category, city=city, search=search)


@router.get("/owner/manage", response_model=List[OwnerBusinessProfile])
def get_authenticated_owner_businesses(
    session: SessionPayload = Depends(get_current_session),
    service: BusinessesService = Depends(get_businesses_service),
) -> List[OwnerBusinessProfile]:
    return service.get_owner_businesses(session.user.id, session.user)


@router.get("/owner/{owner_id}/manage", response_model=List[OwnerBusinessProfile])
def get_owner_businesses_for_admin(
    owner_id: str,
    session: SessionPayload = Depends(get_current_session),
    service: BusinessesService = Depends(get_businesses_service),
) -> List[OwnerBusinessProfile]:
    return service.get_owner_businesses(owner_id, session.user)


@router.get("/{business_id}", response_model=BusinessSummary)
def get_business(
    business_id: str,
    service: BusinessesService = Depends(get_businesses_service),
) -> BusinessSummary:
    return service.get_business(business_id)


@router.get(
    "/{business_id}/owner-technicians",
    response_model=List[OwnerTechnicianProfile],
)
def get_owner_technicians(
    business_id: str,
    session: SessionPayload = Depends(get_current_session),
    service: BusinessesService = Depends(get_businesses_service),
) -> List[OwnerTechnicianProfile]:
    return service.get_owner_technicians(business_id, session.user)


@router.patch("/{business_id}/owner-profile", response_model=OwnerBusinessProfile)
def update_owner_business(
    business_id: str,
    input_data: UpdateOwnerBusinessRequest,
    session: SessionPayload = Depends(get_current_session),
    service: BusinessesService = Depends(get_businesses_service),
) -> OwnerBusinessProfile:
    return service.update_owner_business(business_id, input_data, session.user)


@router.put(
    "/{business_id}/owner-technicians",
    response_model=List[OwnerTechnicianProfile],
)
def update_owner_technicians(
    business_id: str,
    input_data: UpdateOwnerTechnicianRosterRequest,
    session: SessionPayload = Depends(get_current_session),
    service: BusinessesService = Depends(get_businesses_service),
) -> List[OwnerTechnicianProfile]:
    return service.update_owner_technicians(business_id, input_data, session.user)


@router.patch(
    "/{business_id}/owner-media/image",
    response_model=UploadedOwnerBusinessImage,
)
def upload_owner_business_image(
    business_id: str,
    input_data: UploadOwnerBusinessImageRequest,
    session: SessionPayload = Depends(get_current_session),
    service: BusinessesService = Depends(get_businesses_service),
) -> UploadedOwnerBusinessImage:
    return service.upload_owner_business_image(business_id, input_data, session.user)
