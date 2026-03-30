from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domains.notifications.repository import NotificationsRepository


@dataclass(frozen=True)
class AdminOverviewRecord:
    users: int
    businesses: int
    active_bookings: int
    open_conversations: int
    pending_reviews: int


@dataclass(frozen=True)
class AdminBusinessQueueRecord:
    id: str
    owner_id: str
    owner_name: str
    owner_email: str
    category: str
    name: str
    status: str
    featured_on_homepage: bool
    homepage_rank: int
    city: str
    state: str
    created_at: datetime


@dataclass(frozen=True)
class AdminReviewQueueRecord:
    id: str
    appointment_id: Optional[str]
    business_id: str
    business_name: str
    customer_id: str
    customer_name: str
    rating: int
    comment: str
    status: str
    created_at: datetime


@dataclass(frozen=True)
class AdminConversationCaseRecord:
    id: str
    business_id: str
    business_name: str
    booking_id: Optional[str]
    last_message: Optional[str]
    last_message_at: Optional[datetime]
    latest_message: Optional[str]
    latest_message_at: Optional[datetime]
    created_at: datetime
    message_count: int


@dataclass(frozen=True)
class AdminActionListRecord:
    id: str
    admin_user_id: str
    admin_name: str
    target_type: str
    target_id: str
    action: str
    metadata: Optional[str]
    created_at: datetime


@dataclass(frozen=True)
class AdminAccountRecord:
    id: str
    name: str
    email: str
    phone: Optional[str]
    status: str
    roles: List[str]
    business_count: int
    created_at: datetime
    updated_at: datetime


class AdminRepository:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationsRepository(db)

    def _load_roles(self, user_id: str) -> List[str]:
        rows = self.db.execute(
            text(
                """
                SELECT LOWER(CAST("role" AS TEXT)) AS "role"
                FROM "UserRole"
                WHERE "userId" = :user_id
                ORDER BY "createdAt" ASC
                """,
            ),
            {"user_id": user_id},
        ).mappings()
        return [str(row["role"]) for row in rows]

    def _to_account_record(self, row) -> AdminAccountRecord:
        user_id = str(row["id"])
        return AdminAccountRecord(
            id=user_id,
            name=str(row["fullName"]),
            email=str(row["email"]),
            phone=None if row["phone"] is None else str(row["phone"]),
            status=str(row["status"]).lower(),
            roles=self._load_roles(user_id),
            business_count=int(row["businessCount"]),
            created_at=row["createdAt"],
            updated_at=row["updatedAt"],
        )

    def list_accounts(
        self,
        *,
        search: Optional[str] = None,
        role_filter: Optional[str] = None,
    ) -> List[AdminAccountRecord]:
        where_clauses = []
        params: dict[str, object] = {}
        if search:
            where_clauses.append(
                """
                (
                  user_account."fullName" ILIKE :search
                  OR user_account."email" ILIKE :search
                  OR COALESCE(user_account."phone", '') ILIKE :search
                )
                """,
            )
            params["search"] = f"%{search}%"
        if role_filter:
            where_clauses.append(
                """
                EXISTS (
                  SELECT 1
                  FROM "UserRole" AS user_role
                  WHERE user_role."userId" = user_account."id"
                    AND CAST(user_role."role" AS TEXT) = :role_filter
                )
                """,
            )
            params["role_filter"] = role_filter.upper()

        where_clause = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        rows = self.db.execute(
            text(
                f"""
                SELECT
                  user_account."id",
                  user_account."fullName",
                  user_account."email",
                  user_account."phone",
                  user_account."status",
                  user_account."createdAt",
                  user_account."updatedAt",
                  (
                    SELECT COUNT(*)
                    FROM "Business" AS business
                    WHERE business."ownerUserId" = user_account."id"
                  ) AS "businessCount"
                FROM "User" AS user_account
                {where_clause}
                ORDER BY user_account."createdAt" DESC, user_account."id" DESC
                LIMIT 100
                """,
            ),
            params,
        ).mappings()
        return [self._to_account_record(row) for row in rows]

    def get_account(self, user_id: str) -> Optional[AdminAccountRecord]:
        row = self.db.execute(
            text(
                """
                SELECT
                  user_account."id",
                  user_account."fullName",
                  user_account."email",
                  user_account."phone",
                  user_account."status",
                  user_account."createdAt",
                  user_account."updatedAt",
                  (
                    SELECT COUNT(*)
                    FROM "Business" AS business
                    WHERE business."ownerUserId" = user_account."id"
                  ) AS "businessCount"
                FROM "User" AS user_account
                WHERE user_account."id" = :user_id
                LIMIT 1
                """,
            ),
            {"user_id": user_id},
        ).mappings().first()
        return None if row is None else self._to_account_record(row)

    def update_account(
        self,
        user_id: str,
        *,
        full_name: Optional[str],
        email: Optional[str],
        phone: Optional[str],
        phone_provided: bool,
        status_value: Optional[str],
    ) -> None:
        updates = ['"updatedAt" = NOW()']
        params: dict[str, object] = {"user_id": user_id}
        if full_name is not None:
            updates.append('"fullName" = :full_name')
            params["full_name"] = full_name
        if email is not None:
            updates.append('"email" = :email')
            params["email"] = email
        if phone_provided:
            updates.append('"phone" = :phone')
            params["phone"] = phone
        if status_value is not None:
            updates.append('"status" = :status_value')
            params["status_value"] = status_value.upper()

        self.db.execute(
            text(
                f"""
                UPDATE "User"
                SET {", ".join(updates)}
                WHERE "id" = :user_id
                """,
            ),
            params,
        )

    def get_overview(self) -> AdminOverviewRecord:
        row = self.db.execute(
            text(
                """
                SELECT
                  (SELECT COUNT(*) FROM "User") AS "users",
                  (
                    SELECT COUNT(*)
                    FROM "Business"
                    WHERE CAST("status" AS TEXT) = 'APPROVED'
                  ) AS "businesses",
                  (
                    SELECT COUNT(*)
                    FROM "Appointment"
                    WHERE CAST("status" AS TEXT) != 'CANCELLED'
                  ) AS "activeBookings",
                  (SELECT COUNT(*) FROM "Conversation") AS "openConversations",
                  (
                    SELECT COUNT(*)
                    FROM "Review"
                    WHERE CAST("status" AS TEXT) = 'FLAGGED'
                  ) AS "pendingReviews"
                """,
            ),
        ).mappings().one()

        return AdminOverviewRecord(
            users=int(row["users"]),
            businesses=int(row["businesses"]),
            active_bookings=int(row["activeBookings"]),
            open_conversations=int(row["openConversations"]),
            pending_reviews=int(row["pendingReviews"]),
        )

    def list_homepage_business_ids(self) -> List[str]:
        rows = self.db.execute(
            text(
                """
                SELECT "id"
                FROM "Business"
                WHERE CAST("status" AS TEXT) = 'APPROVED'
                  AND "featuredOnHomepage" = TRUE
                ORDER BY "homepageRank" ASC, "rating" DESC, "reviewCount" DESC, LOWER("name") ASC
                """,
            ),
        ).mappings()

        return [str(row["id"]) for row in rows]

    def list_featured_business_ids(
        self,
        *,
        excluded_business_id: Optional[str] = None,
    ) -> List[str]:
        params = {}
        excluded_clause = ""
        if excluded_business_id:
            excluded_clause = 'AND "id" != :excluded_business_id'
            params["excluded_business_id"] = excluded_business_id

        rows = self.db.execute(
            text(
                f"""
                SELECT "id"
                FROM "Business"
                WHERE CAST("status" AS TEXT) = 'APPROVED'
                  AND "featuredOnHomepage" = TRUE
                  {excluded_clause}
                ORDER BY "homepageRank" ASC, "rating" DESC, "reviewCount" DESC, LOWER("name") ASC
                """,
            ),
            params,
        ).mappings()

        return [str(row["id"]) for row in rows]

    def persist_homepage_order(self, featured_ids: List[str]) -> None:
        approved_rows = self.db.execute(
            text(
                """
                SELECT "id"
                FROM "Business"
                WHERE CAST("status" AS TEXT) = 'APPROVED'
                """,
            ),
        ).mappings()
        approved_ids = [str(row["id"]) for row in approved_rows]
        hidden_ids = [business_id for business_id in approved_ids if business_id not in featured_ids]

        for index, business_id in enumerate(featured_ids):
            self.db.execute(
                text(
                    """
                    UPDATE "Business"
                    SET "featuredOnHomepage" = TRUE,
                        "homepageRank" = :homepage_rank,
                        "updatedAt" = NOW()
                    WHERE "id" = :business_id
                    """,
                ),
                {
                    "business_id": business_id,
                    "homepage_rank": index + 1,
                },
            )

        if hidden_ids:
            self.db.execute(
                text(
                    """
                    UPDATE "Business"
                    SET "featuredOnHomepage" = FALSE,
                        "homepageRank" = 999,
                        "updatedAt" = NOW()
                    WHERE "id" = ANY(:business_ids)
                    """,
                ),
                {"business_ids": hidden_ids},
            )

    def list_businesses(self, status: Optional[str] = None) -> List[AdminBusinessQueueRecord]:
        params = {}
        where_clause = ""
        if status:
            where_clause = 'WHERE CAST(business."status" AS TEXT) = :status'
            params["status"] = status.upper()

        rows = self.db.execute(
            text(
                f"""
                SELECT
                  business."id",
                  business."ownerUserId",
                  owner."fullName" AS "ownerName",
                  owner."email" AS "ownerEmail",
                  business."category",
                  business."name",
                  business."status",
                  business."featuredOnHomepage",
                  business."homepageRank",
                  business."city",
                  business."state",
                  business."createdAt"
                FROM "Business" AS business
                INNER JOIN "User" AS owner
                  ON owner."id" = business."ownerUserId"
                {where_clause}
                ORDER BY business."createdAt" DESC
                """,
            ),
            params,
        ).mappings()

        return [
            AdminBusinessQueueRecord(
                id=str(row["id"]),
                owner_id=str(row["ownerUserId"]),
                owner_name=str(row["ownerName"]),
                owner_email=str(row["ownerEmail"]),
                category=str(row["category"]).lower(),
                name=str(row["name"]),
                status=str(row["status"]).lower(),
                featured_on_homepage=bool(row["featuredOnHomepage"]),
                homepage_rank=int(row["homepageRank"]),
                city=str(row["city"]),
                state=str(row["state"]),
                created_at=row["createdAt"],
            )
            for row in rows
        ]

    def get_business(self, business_id: str) -> Optional[AdminBusinessQueueRecord]:
        row = self.db.execute(
            text(
                """
                SELECT
                  business."id",
                  business."ownerUserId",
                  owner."fullName" AS "ownerName",
                  owner."email" AS "ownerEmail",
                  business."category",
                  business."name",
                  business."status",
                  business."featuredOnHomepage",
                  business."homepageRank",
                  business."city",
                  business."state",
                  business."createdAt"
                FROM "Business" AS business
                INNER JOIN "User" AS owner
                  ON owner."id" = business."ownerUserId"
                WHERE business."id" = :business_id
                LIMIT 1
                """,
            ),
            {"business_id": business_id},
        ).mappings().first()

        if row is None:
            return None

        return AdminBusinessQueueRecord(
            id=str(row["id"]),
            owner_id=str(row["ownerUserId"]),
            owner_name=str(row["ownerName"]),
            owner_email=str(row["ownerEmail"]),
            category=str(row["category"]).lower(),
            name=str(row["name"]),
            status=str(row["status"]).lower(),
            featured_on_homepage=bool(row["featuredOnHomepage"]),
            homepage_rank=int(row["homepageRank"]),
            city=str(row["city"]),
            state=str(row["state"]),
            created_at=row["createdAt"],
        )

    def update_business_status(
        self,
        business_id: str,
        *,
        status_value: str,
        featured_on_homepage: Optional[bool] = None,
        homepage_rank: Optional[int] = None,
    ) -> None:
        updates = ['"status" = :status_value', '"updatedAt" = NOW()']
        params = {
            "business_id": business_id,
            "status_value": status_value.upper(),
        }

        if featured_on_homepage is not None:
            updates.append('"featuredOnHomepage" = :featured_on_homepage')
            params["featured_on_homepage"] = bool(featured_on_homepage)

        if homepage_rank is not None:
            updates.append('"homepageRank" = :homepage_rank')
            params["homepage_rank"] = int(homepage_rank)

        self.db.execute(
            text(
                f"""
                UPDATE "Business"
                SET {", ".join(updates)}
                WHERE "id" = :business_id
                """,
            ),
            params,
        )

    def update_business_homepage(
        self,
        business_id: str,
        *,
        featured_on_homepage: bool,
        homepage_rank: int,
    ) -> None:
        self.db.execute(
            text(
                """
                UPDATE "Business"
                SET "featuredOnHomepage" = :featured_on_homepage,
                    "homepageRank" = :homepage_rank,
                    "updatedAt" = NOW()
                WHERE "id" = :business_id
                """,
            ),
            {
                "business_id": business_id,
                "featured_on_homepage": bool(featured_on_homepage),
                "homepage_rank": int(homepage_rank),
            },
        )

    def list_reviews(self, status: Optional[str] = None) -> List[AdminReviewQueueRecord]:
        params = {}
        where_clause = ""
        if status:
            where_clause = 'WHERE CAST(review."status" AS TEXT) = :status'
            params["status"] = status.upper()

        rows = self.db.execute(
            text(
                f"""
                SELECT
                  review."id",
                  review."appointmentId",
                  review."businessId",
                  business."name" AS "businessName",
                  review."customerId",
                  customer."fullName" AS "customerName",
                  review."rating",
                  review."comment",
                  LOWER(CAST(review."status" AS TEXT)) AS "status",
                  review."createdAt"
                FROM "Review" AS review
                INNER JOIN "Business" AS business
                  ON business."id" = review."businessId"
                INNER JOIN "User" AS customer
                  ON customer."id" = review."customerId"
                {where_clause}
                ORDER BY review."createdAt" DESC
                """,
            ),
            params,
        ).mappings()

        return [
            AdminReviewQueueRecord(
                id=str(row["id"]),
                appointment_id=(
                    None
                    if row["appointmentId"] is None
                    else str(row["appointmentId"])
                ),
                business_id=str(row["businessId"]),
                business_name=str(row["businessName"]),
                customer_id=str(row["customerId"]),
                customer_name=str(row["customerName"]),
                rating=int(row["rating"]),
                comment="" if row["comment"] is None else str(row["comment"]),
                status=str(row["status"]),
                created_at=row["createdAt"],
            )
            for row in rows
        ]

    def get_review(self, review_id: str) -> Optional[AdminReviewQueueRecord]:
        row = self.db.execute(
            text(
                """
                SELECT
                  review."id",
                  review."appointmentId",
                  review."businessId",
                  business."name" AS "businessName",
                  review."customerId",
                  customer."fullName" AS "customerName",
                  review."rating",
                  review."comment",
                  LOWER(CAST(review."status" AS TEXT)) AS "status",
                  review."createdAt"
                FROM "Review" AS review
                INNER JOIN "Business" AS business
                  ON business."id" = review."businessId"
                INNER JOIN "User" AS customer
                  ON customer."id" = review."customerId"
                WHERE review."id" = :review_id
                LIMIT 1
                """,
            ),
            {"review_id": review_id},
        ).mappings().first()

        if row is None:
            return None

        return AdminReviewQueueRecord(
            id=str(row["id"]),
            appointment_id=(
                None if row["appointmentId"] is None else str(row["appointmentId"])
            ),
            business_id=str(row["businessId"]),
            business_name=str(row["businessName"]),
            customer_id=str(row["customerId"]),
            customer_name=str(row["customerName"]),
            rating=int(row["rating"]),
            comment="" if row["comment"] is None else str(row["comment"]),
            status=str(row["status"]),
            created_at=row["createdAt"],
        )

    def update_review_status(self, review_id: str, status_value: str) -> None:
        self.db.execute(
            text(
                """
                UPDATE "Review"
                SET "status" = :status_value, "updatedAt" = NOW()
                WHERE "id" = :review_id
                """,
            ),
            {
                "review_id": review_id,
                "status_value": status_value.upper(),
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

    def list_conversations(self) -> List[AdminConversationCaseRecord]:
        rows = self.db.execute(
            text(
                """
                SELECT
                  conversation."id",
                  conversation."businessId",
                  business."name" AS "businessName",
                  conversation."appointmentId" AS "bookingId",
                  conversation."lastMessage",
                  conversation."lastMessageAt",
                  conversation."createdAt",
                  (
                    SELECT message."content"
                    FROM "Message" AS message
                    WHERE message."conversationId" = conversation."id"
                    ORDER BY message."createdAt" DESC, message."id" DESC
                    LIMIT 1
                  ) AS "latestMessage",
                  (
                    SELECT message."createdAt"
                    FROM "Message" AS message
                    WHERE message."conversationId" = conversation."id"
                    ORDER BY message."createdAt" DESC, message."id" DESC
                    LIMIT 1
                  ) AS "latestMessageAt",
                  (
                    SELECT COUNT(*)
                    FROM "Message" AS message
                    WHERE message."conversationId" = conversation."id"
                  ) AS "messageCount"
                FROM "Conversation" AS conversation
                INNER JOIN "Business" AS business
                  ON business."id" = conversation."businessId"
                ORDER BY COALESCE(
                  conversation."lastMessageAt",
                  (
                    SELECT message."createdAt"
                    FROM "Message" AS message
                    WHERE message."conversationId" = conversation."id"
                    ORDER BY message."createdAt" DESC, message."id" DESC
                    LIMIT 1
                  ),
                  conversation."createdAt"
                ) DESC,
                conversation."createdAt" DESC
                """,
            ),
        ).mappings()

        return [
            AdminConversationCaseRecord(
                id=str(row["id"]),
                business_id=str(row["businessId"]),
                business_name=str(row["businessName"]),
                booking_id=None if row["bookingId"] is None else str(row["bookingId"]),
                last_message=(
                    None if row["lastMessage"] is None else str(row["lastMessage"])
                ),
                last_message_at=row["lastMessageAt"],
                latest_message=(
                    None
                    if row["latestMessage"] is None
                    else str(row["latestMessage"])
                ),
                latest_message_at=row["latestMessageAt"],
                created_at=row["createdAt"],
                message_count=int(row["messageCount"]),
            )
            for row in rows
        ]

    def list_conversation_participant_names(self, conversation_id: str) -> List[str]:
        rows = self.db.execute(
            text(
                """
                SELECT user_account."fullName"
                FROM "ConversationParticipant" AS participant
                INNER JOIN "User" AS user_account
                  ON user_account."id" = participant."userId"
                WHERE participant."conversationId" = :conversation_id
                ORDER BY participant."createdAt" ASC, participant."id" ASC
                """,
            ),
            {"conversation_id": conversation_id},
        ).mappings()

        return [str(row["fullName"]) for row in rows]

    def get_conversation(self, conversation_id: str) -> Optional[AdminConversationCaseRecord]:
        row = self.db.execute(
            text(
                """
                SELECT
                  conversation."id",
                  conversation."businessId",
                  business."name" AS "businessName",
                  conversation."appointmentId" AS "bookingId",
                  conversation."lastMessage",
                  conversation."lastMessageAt",
                  conversation."createdAt",
                  (
                    SELECT message."content"
                    FROM "Message" AS message
                    WHERE message."conversationId" = conversation."id"
                    ORDER BY message."createdAt" DESC, message."id" DESC
                    LIMIT 1
                  ) AS "latestMessage",
                  (
                    SELECT message."createdAt"
                    FROM "Message" AS message
                    WHERE message."conversationId" = conversation."id"
                    ORDER BY message."createdAt" DESC, message."id" DESC
                    LIMIT 1
                  ) AS "latestMessageAt",
                  (
                    SELECT COUNT(*)
                    FROM "Message" AS message
                    WHERE message."conversationId" = conversation."id"
                  ) AS "messageCount"
                FROM "Conversation" AS conversation
                INNER JOIN "Business" AS business
                  ON business."id" = conversation."businessId"
                WHERE conversation."id" = :conversation_id
                LIMIT 1
                """,
            ),
            {"conversation_id": conversation_id},
        ).mappings().first()

        if row is None:
            return None

        return AdminConversationCaseRecord(
            id=str(row["id"]),
            business_id=str(row["businessId"]),
            business_name=str(row["businessName"]),
            booking_id=None if row["bookingId"] is None else str(row["bookingId"]),
            last_message=None if row["lastMessage"] is None else str(row["lastMessage"]),
            last_message_at=row["lastMessageAt"],
            latest_message=(
                None if row["latestMessage"] is None else str(row["latestMessage"])
            ),
            latest_message_at=row["latestMessageAt"],
            created_at=row["createdAt"],
            message_count=int(row["messageCount"]),
        )

    def get_latest_conversation_action(self, conversation_id: str) -> Optional[str]:
        row = self.db.execute(
            text(
                """
                SELECT "action"
                FROM "AdminAction"
                WHERE "targetType" = 'conversation'
                  AND "targetId" = :conversation_id
                ORDER BY "createdAt" DESC, "id" DESC
                LIMIT 1
                """,
            ),
            {"conversation_id": conversation_id},
        ).mappings().first()

        if row is None:
            return None
        return str(row["action"])

    def list_audit_actions(self) -> List[AdminActionListRecord]:
        rows = self.db.execute(
            text(
                """
                SELECT
                  admin_action."id",
                  admin_action."adminUserId",
                  admin."fullName" AS "adminName",
                  admin_action."targetType",
                  admin_action."targetId",
                  admin_action."action",
                  admin_action."metadata",
                  admin_action."createdAt"
                FROM "AdminAction" AS admin_action
                INNER JOIN "User" AS admin
                  ON admin."id" = admin_action."adminUserId"
                WHERE admin_action."targetType" != 'ad_payment'
                ORDER BY admin_action."createdAt" DESC, admin_action."id" DESC
                LIMIT 30
                """,
            ),
        ).mappings()

        return [
            AdminActionListRecord(
                id=str(row["id"]),
                admin_user_id=str(row["adminUserId"]),
                admin_name=str(row["adminName"]),
                target_type=str(row["targetType"]),
                target_id=str(row["targetId"]),
                action=str(row["action"]),
                metadata=None if row["metadata"] is None else str(row["metadata"]),
                created_at=row["createdAt"],
            )
            for row in rows
        ]

    def create_admin_action(
        self,
        *,
        admin_user_id: str,
        target_type: str,
        target_id: str,
        action: str,
        metadata: Optional[str],
    ) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO "AdminAction" (
                  "id",
                  "adminUserId",
                  "targetType",
                  "targetId",
                  "action",
                  "metadata",
                  "createdAt"
                )
                VALUES (
                  :id,
                  :admin_user_id,
                  :target_type,
                  :target_id,
                  :action,
                  :metadata,
                  NOW()
                )
                """,
            ),
            {
                "id": uuid4().hex,
                "admin_user_id": admin_user_id,
                "target_type": target_type,
                "target_id": target_id,
                "action": action,
                "metadata": metadata,
            },
        )

    def create_notification(
        self,
        *,
        user_id: str,
        notification_type: str,
        title: str,
        body: Optional[str],
    ) -> Optional[str]:
        return self.notifications.create_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
        )
