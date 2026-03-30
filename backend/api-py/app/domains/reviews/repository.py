from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domains.notifications.repository import NotificationsRepository


@dataclass(frozen=True)
class ReviewBusinessTarget:
    id: str
    name: str
    owner_id: str


@dataclass(frozen=True)
class ReviewAppointmentTarget:
    id: str
    business_id: str
    customer_id: str


@dataclass
class ReviewRecord:
    id: str
    appointment_id: Optional[str]
    business_id: str
    customer_id: str
    customer_name: str
    customer_avatar_url: Optional[str]
    rating: int
    comment: str
    created_at: datetime
    image_urls: List[str] = field(default_factory=list)


class ReviewsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationsRepository(db)
        self._storage_ready = False

    def _generate_id(self) -> str:
        return uuid4().hex

    def ensure_storage(self) -> None:
        if self._storage_ready:
            return

        self.db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS "UserProfileMedia" (
                  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
                  "avatarUrl" TEXT NULL,
                  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """,
            ),
        )
        self.db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS "ReviewImage" (
                  "id" TEXT PRIMARY KEY,
                  "reviewId" TEXT NOT NULL REFERENCES "Review"("id") ON DELETE CASCADE,
                  "url" TEXT NOT NULL,
                  "sortOrder" INTEGER NOT NULL DEFAULT 0,
                  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """,
            ),
        )
        self.db.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS "ReviewImage_review_id_sort_idx"
                ON "ReviewImage" ("reviewId", "sortOrder")
                """,
            ),
        )
        self.db.commit()
        self._storage_ready = True

    def get_business_target(self, business_id: str) -> Optional[ReviewBusinessTarget]:
        row = self.db.execute(
            text(
                """
                SELECT "id", "name", "ownerUserId"
                FROM "Business"
                WHERE "id" = :business_id
                LIMIT 1
                """,
            ),
            {"business_id": business_id},
        ).mappings().first()

        if row is None:
            return None

        return ReviewBusinessTarget(
            id=str(row["id"]),
            name=str(row["name"]),
            owner_id=str(row["ownerUserId"]),
        )

    def get_customer_appointment(
        self,
        appointment_id: str,
        customer_id: str,
        business_id: str,
    ) -> Optional[ReviewAppointmentTarget]:
        row = self.db.execute(
            text(
                """
                SELECT "id", "businessId", "customerId"
                FROM "Appointment"
                WHERE "id" = :appointment_id
                  AND "customerId" = :customer_id
                  AND "businessId" = :business_id
                LIMIT 1
                """,
            ),
            {
                "appointment_id": appointment_id,
                "customer_id": customer_id,
                "business_id": business_id,
            },
        ).mappings().first()

        if row is None:
            return None

        return ReviewAppointmentTarget(
            id=str(row["id"]),
            business_id=str(row["businessId"]),
            customer_id=str(row["customerId"]),
        )

    def review_exists_for_appointment(self, appointment_id: str) -> bool:
        row = self.db.execute(
            text(
                """
                SELECT 1
                FROM "Review"
                WHERE "appointmentId" = :appointment_id
                LIMIT 1
                """,
            ),
            {"appointment_id": appointment_id},
        ).mappings().first()
        return row is not None

    def upsert_user_avatar(self, user_id: str, avatar_url: Optional[str]) -> None:
        self.ensure_storage()
        self.db.execute(
            text(
                """
                INSERT INTO "UserProfileMedia" (
                  "userId",
                  "avatarUrl",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  :user_id,
                  :avatar_url,
                  NOW(),
                  NOW()
                )
                ON CONFLICT ("userId")
                DO UPDATE SET
                  "avatarUrl" = :avatar_url,
                  "updatedAt" = NOW()
                """,
            ),
            {
                "user_id": user_id,
                "avatar_url": avatar_url,
            },
        )

    def _attach_review_images(self, reviews: List[ReviewRecord]) -> None:
        if not reviews:
            return

        review_ids = [review.id for review in reviews]
        rows = self.db.execute(
            text(
                """
                SELECT "reviewId", "url"
                FROM "ReviewImage"
                WHERE "reviewId" = ANY(:review_ids)
                ORDER BY "sortOrder" ASC, "createdAt" ASC
                """,
            ),
            {"review_ids": review_ids},
        ).mappings()

        images_by_review = {review.id: [] for review in reviews}
        for row in rows:
            images_by_review[str(row["reviewId"])].append(str(row["url"]))

        for review in reviews:
            review.image_urls = images_by_review.get(review.id, [])

    def _to_review_record(self, row) -> ReviewRecord:
        return ReviewRecord(
            id=str(row["id"]),
            appointment_id=(
                None if row["appointmentId"] is None else str(row["appointmentId"])
            ),
            business_id=str(row["businessId"]),
            customer_id=str(row["customerId"]),
            customer_name=str(row["customerName"]),
            customer_avatar_url=(
                None if row["customerAvatarUrl"] is None else str(row["customerAvatarUrl"])
            ),
            rating=int(row["rating"]),
            comment="" if row["comment"] is None else str(row["comment"]),
            created_at=row["createdAt"],
        )

    def list_business_reviews(self, business_id: str) -> List[ReviewRecord]:
        self.ensure_storage()
        rows = self.db.execute(
            text(
                """
                SELECT
                  review."id",
                  review."appointmentId",
                  review."businessId",
                  review."customerId",
                  customer."fullName" AS "customerName",
                  profile_media."avatarUrl" AS "customerAvatarUrl",
                  review."rating",
                  review."comment",
                  review."createdAt"
                FROM "Review" AS review
                INNER JOIN "User" AS customer
                  ON customer."id" = review."customerId"
                LEFT JOIN "UserProfileMedia" AS profile_media
                  ON profile_media."userId" = review."customerId"
                WHERE review."businessId" = :business_id
                  AND CAST(review."status" AS TEXT) = 'PUBLISHED'
                ORDER BY review."createdAt" DESC, review."id" DESC
                """,
            ),
            {"business_id": business_id},
        ).mappings()

        reviews = [self._to_review_record(row) for row in rows]
        self._attach_review_images(reviews)
        return reviews

    def create_review(
        self,
        *,
        appointment_id: Optional[str],
        business_id: str,
        customer_id: str,
        rating: int,
        comment: Optional[str],
    ) -> ReviewRecord:
        review_id = self._generate_id()
        self.db.execute(
            text(
                """
                INSERT INTO "Review" (
                  "id",
                  "appointmentId",
                  "businessId",
                  "customerId",
                  "rating",
                  "comment",
                  "status",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  :id,
                  :appointment_id,
                  :business_id,
                  :customer_id,
                  :rating,
                  :comment,
                  'PUBLISHED',
                  NOW(),
                  NOW()
                )
                """,
            ),
            {
                "id": review_id,
                "appointment_id": appointment_id,
                "business_id": business_id,
                "customer_id": customer_id,
                "rating": rating,
                "comment": comment,
            },
        )
        return self.get_review(review_id)  # type: ignore[return-value]

    def replace_review_images(self, review_id: str, image_urls: List[str]) -> None:
        self.db.execute(
            text(
                """
                DELETE FROM "ReviewImage"
                WHERE "reviewId" = :review_id
                """,
            ),
            {"review_id": review_id},
        )

        for index, url in enumerate(image_urls):
            self.db.execute(
                text(
                    """
                    INSERT INTO "ReviewImage" (
                      "id",
                      "reviewId",
                      "url",
                      "sortOrder",
                      "createdAt"
                    )
                    VALUES (
                      :id,
                      :review_id,
                      :url,
                      :sort_order,
                      NOW()
                    )
                    """,
                ),
                {
                    "id": self._generate_id(),
                    "review_id": review_id,
                    "url": url,
                    "sort_order": index,
                },
            )

    def refresh_business_review_metrics(self, business_id: str) -> None:
        self.db.execute(
            text(
                """
                UPDATE "Business"
                SET
                  "rating" = COALESCE(
                    (
                      SELECT ROUND(AVG(review."rating")::numeric, 1)
                      FROM "Review" AS review
                      WHERE review."businessId" = :business_id
                        AND CAST(review."status" AS TEXT) = 'PUBLISHED'
                    ),
                    0
                  ),
                  "reviewCount" = (
                    SELECT COUNT(*)
                    FROM "Review" AS review
                    WHERE review."businessId" = :business_id
                      AND CAST(review."status" AS TEXT) = 'PUBLISHED'
                  ),
                  "updatedAt" = NOW()
                WHERE "id" = :business_id
                """,
            ),
            {"business_id": business_id},
        )

    def get_review(self, review_id: str) -> Optional[ReviewRecord]:
        self.ensure_storage()
        row = self.db.execute(
            text(
                """
                SELECT
                  review."id",
                  review."appointmentId",
                  review."businessId",
                  review."customerId",
                  customer."fullName" AS "customerName",
                  profile_media."avatarUrl" AS "customerAvatarUrl",
                  review."rating",
                  review."comment",
                  review."createdAt"
                FROM "Review" AS review
                INNER JOIN "User" AS customer
                  ON customer."id" = review."customerId"
                LEFT JOIN "UserProfileMedia" AS profile_media
                  ON profile_media."userId" = review."customerId"
                WHERE review."id" = :review_id
                LIMIT 1
                """,
            ),
            {"review_id": review_id},
        ).mappings().first()

        if row is None:
            return None

        review = self._to_review_record(row)
        self._attach_review_images([review])
        return review

    def create_review_notification(
        self,
        *,
        owner_user_id: str,
        business_name: str,
        customer_name: str,
        rating: int,
    ) -> None:
        self.notifications.create_notification(
            user_id=owner_user_id,
            notification_type="review_received",
            title="New review received",
            body=f"{customer_name} left a {rating}-star review for {business_name}.",
        )
