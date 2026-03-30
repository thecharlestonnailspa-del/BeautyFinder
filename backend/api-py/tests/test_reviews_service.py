import unittest
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from app.core.config import Settings
from app.domains.reviews.repository import (
    ReviewBusinessTarget,
    ReviewRecord as ReviewRepositoryRecord,
)
from app.domains.reviews.service import ReviewsService
from app.schemas.auth import UserSummary
from app.schemas.reviews import CreateReviewRequest


class _NullTransaction:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class _FakeDB:
    def begin(self):
        return _NullTransaction()


class _FakeReviewsRepository:
    def __init__(self) -> None:
        self.ensure_storage_calls = 0
        self.avatar_updates = []
        self.created_review_payload = None
        self.replaced_review_images = None
        self.refreshed_business_ids = []
        self.review_notifications = []
        self.businesses = {
            "biz-1": ReviewBusinessTarget(
                id="biz-1",
                name="Polished Studio",
                owner_id="user-owner-1",
            ),
        }
        self.review = ReviewRepositoryRecord(
            id="review-1",
            appointment_id="booking-1",
            business_id="biz-1",
            customer_id="user-customer-1",
            customer_name="Ava Tran",
            customer_avatar_url="https://images.example.com/ava.jpg",
            rating=5,
            comment="Fresh nude set and glossy finish.",
            created_at=datetime(2026, 3, 30, 17, 0, tzinfo=timezone.utc),
            image_urls=[
                "https://images.example.com/review-1.jpg",
                "https://images.example.com/review-2.jpg",
            ],
        )

    def ensure_storage(self) -> None:
        self.ensure_storage_calls += 1

    def get_business_target(self, business_id: str):
        return self.businesses.get(business_id)

    def get_customer_appointment(self, appointment_id: str, customer_id: str, business_id: str):
        if (
            appointment_id == "booking-1"
            and customer_id == "user-customer-1"
            and business_id == "biz-1"
        ):
            return object()
        return None

    def review_exists_for_appointment(self, appointment_id: str) -> bool:
        return False

    def upsert_user_avatar(self, user_id: str, avatar_url: Optional[str]) -> None:
        self.avatar_updates.append({"user_id": user_id, "avatar_url": avatar_url})

    def create_review(self, **kwargs):
        self.created_review_payload = kwargs
        return self.review

    def replace_review_images(self, review_id: str, image_urls):
        self.replaced_review_images = {
            "review_id": review_id,
            "image_urls": list(image_urls),
        }

    def refresh_business_review_metrics(self, business_id: str) -> None:
        self.refreshed_business_ids.append(business_id)

    def create_review_notification(self, **kwargs) -> None:
        self.review_notifications.append(kwargs)

    def get_review(self, review_id: str):
        if review_id == self.review.id:
            return self.review
        return None

    def list_business_reviews(self, business_id: str):
        if business_id == "biz-1":
            return [self.review]
        return []


def _make_settings() -> Settings:
    return Settings(
        api_name="Beauty Finder API (Test)",
        api_prefix="/api",
        environment="test",
        debug=False,
        host="127.0.0.1",
        port=8001,
        database_url="postgresql+psycopg://test:test@localhost:5432/test",
        redis_url="redis://localhost:6379",
        jwt_secret="top-secret",
        jwt_issuer="beauty-finder-api",
        jwt_ttl_seconds=3600,
        cors_origins_csv="http://127.0.0.1:3000",
        payment_currency="USD",
        payment_tax_rate=0.08,
        owner_media_upload_dir="/tmp",
    )


class ReviewsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ReviewsService(_FakeDB(), _make_settings())  # type: ignore[arg-type]
        self.repository = _FakeReviewsRepository()
        self.service.repository = self.repository  # type: ignore[assignment]
        self.customer = UserSummary(
            id="user-customer-1",
            role="customer",
            name="Ava Tran",
            email="ava@beautyfinder.app",
        )
        self.owner = UserSummary(
            id="user-owner-1",
            role="owner",
            name="Lina Nguyen",
            email="lina@polishedstudio.app",
        )

    def test_customer_can_create_review_with_avatar_and_images(self) -> None:
        review = self.service.create_review(
            CreateReviewRequest(
                businessId="biz-1",
                appointmentId="booking-1",
                rating=5,
                comment="  Fresh nude set and glossy finish.  ",
                imageUrls=[
                    " https://images.example.com/review-1.jpg ",
                    "",
                    "https://images.example.com/review-2.jpg",
                ],
                customerAvatarUrl=" https://images.example.com/ava.jpg ",
            ),
            self.customer,
        )

        self.assertEqual(review.id, "review-1")
        self.assertEqual(review.customer_avatar_url, "https://images.example.com/ava.jpg")
        self.assertEqual(
            self.repository.created_review_payload,
            {
                "appointment_id": "booking-1",
                "business_id": "biz-1",
                "customer_id": "user-customer-1",
                "rating": 5,
                "comment": "Fresh nude set and glossy finish.",
            },
        )
        self.assertEqual(
            self.repository.replaced_review_images,
            {
                "review_id": "review-1",
                "image_urls": [
                    "https://images.example.com/review-1.jpg",
                    "https://images.example.com/review-2.jpg",
                ],
            },
        )
        self.assertEqual(
            self.repository.avatar_updates,
            [
                {
                    "user_id": "user-customer-1",
                    "avatar_url": "https://images.example.com/ava.jpg",
                }
            ],
        )
        self.assertEqual(self.repository.refreshed_business_ids, ["biz-1"])
        self.assertEqual(len(self.repository.review_notifications), 1)

    def test_non_customer_cannot_publish_review(self) -> None:
        with self.assertRaises(HTTPException) as context:
            self.service.create_review(
                CreateReviewRequest(
                    businessId="biz-1",
                    rating=4,
                    comment="Nice visit",
                ),
                self.owner,
            )

        self.assertEqual(context.exception.status_code, 403)
        self.assertEqual(context.exception.detail, "Only customers can publish reviews")

    def test_review_needs_comment_or_image(self) -> None:
        with self.assertRaises(HTTPException) as context:
            self.service.create_review(
                CreateReviewRequest(
                    businessId="biz-1",
                    rating=4,
                    comment="   ",
                    imageUrls=[],
                ),
                self.customer,
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "A review needs a comment or at least 1 image")


if __name__ == "__main__":
    unittest.main()
