from typing import List

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_session, get_reviews_service
from app.domains.reviews.service import ReviewsService
from app.schemas.auth import SessionPayload
from app.schemas.reviews import CreateReviewRequest, ReviewRecord

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("", response_model=List[ReviewRecord])
def get_reviews(
    business_id: str = Query(alias="businessId"),
    service: ReviewsService = Depends(get_reviews_service),
) -> List[ReviewRecord]:
    return service.list_business_reviews(business_id)


@router.post("", response_model=ReviewRecord)
def create_review(
    input_data: CreateReviewRequest,
    session: SessionPayload = Depends(get_current_session),
    service: ReviewsService = Depends(get_reviews_service),
) -> ReviewRecord:
    return service.create_review(input_data, session.user)
