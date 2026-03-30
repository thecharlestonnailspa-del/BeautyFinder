from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.domains.base import BaseDomainService
from app.domains.reviews.repository import ReviewRecord as ReviewRepositoryRecord
from app.domains.reviews.repository import ReviewsRepository
from app.schemas.auth import UserSummary
from app.schemas.reviews import CreateReviewRequest, ReviewRecord


class ReviewsService(BaseDomainService):
    def __init__(self, db: Session, settings: Settings) -> None:
        super().__init__(db, settings)
        self.repository = ReviewsRepository(db)

    def _to_review_record(self, review: ReviewRepositoryRecord) -> ReviewRecord:
        return ReviewRecord(
            id=review.id,
            appointment_id=review.appointment_id,
            business_id=review.business_id,
            customer_id=review.customer_id,
            customer_name=review.customer_name,
            customer_avatar_url=review.customer_avatar_url,
            rating=review.rating,
            comment=review.comment,
            image_urls=review.image_urls,
            created_at=self.brain.processing.dates.to_utc_iso(review.created_at).replace(
                "+00:00",
                "Z",
            ),
        )

    def list_business_reviews(self, business_id: str) -> List[ReviewRecord]:
        reviews = self.repository.list_business_reviews(business_id)
        return [self._to_review_record(review) for review in reviews]

    def create_review(
        self,
        input_data: CreateReviewRequest,
        actor: UserSummary,
    ) -> ReviewRecord:
        if actor.role != "customer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only customers can publish reviews",
            )

        self.repository.ensure_storage()
        business = self.repository.get_business_target(input_data.business_id)
        if business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found",
            )

        normalized_comment = self.sanitize_text(input_data.comment) or ""
        normalized_image_urls = [
            image_url
            for image_url in (
                self.sanitize_text(value) for value in (input_data.image_urls or [])
            )
            if image_url
        ]
        normalized_avatar_url = self.sanitize_text(input_data.customer_avatar_url)

        if not normalized_comment and not normalized_image_urls:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A review needs a comment or at least 1 image",
            )

        if input_data.appointment_id:
            appointment = self.repository.get_customer_appointment(
                input_data.appointment_id,
                actor.id,
                input_data.business_id,
            )
            if appointment is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Appointment not found for this customer and business",
                )

            if self.repository.review_exists_for_appointment(input_data.appointment_id):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A review has already been submitted for this appointment",
                )

        with self.db.begin():
            if "customer_avatar_url" in input_data.model_fields_set:
                self.repository.upsert_user_avatar(actor.id, normalized_avatar_url)

            created_review = self.repository.create_review(
                appointment_id=input_data.appointment_id,
                business_id=input_data.business_id,
                customer_id=actor.id,
                rating=input_data.rating,
                comment=normalized_comment or None,
            )
            self.repository.replace_review_images(created_review.id, normalized_image_urls)
            self.repository.refresh_business_review_metrics(input_data.business_id)
            self.repository.create_review_notification(
                owner_user_id=business.owner_id,
                business_name=business.name,
                customer_name=actor.name,
                rating=input_data.rating,
            )

        review = self.repository.get_review(created_review.id)
        if review is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found after creation",
            )

        return self._to_review_record(review)
