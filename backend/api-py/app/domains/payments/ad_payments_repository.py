from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domains.notifications.repository import NotificationsRepository


@dataclass(frozen=True)
class AdPaymentActionRecord:
    id: str
    payment_id: str
    actor_user_id: str
    action: str
    metadata: Optional[str]
    created_at: datetime


@dataclass(frozen=True)
class AdPricingActionRecord:
    id: str
    placement: str
    actor_user_id: str
    metadata: Optional[str]
    created_at: datetime


@dataclass(frozen=True)
class AdPaymentBusinessRecord:
    id: str
    owner_id: str
    name: str
    status: str


class AdPaymentsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationsRepository(db)

    def list_ad_payment_actions(self) -> List[AdPaymentActionRecord]:
        rows = self.db.execute(
            text(
                """
                SELECT
                  "id",
                  "targetId" AS "paymentId",
                  "adminUserId" AS "actorUserId",
                  "action",
                  "metadata",
                  "createdAt"
                FROM "AdminAction"
                WHERE "targetType" = 'ad_payment'
                ORDER BY "createdAt" ASC, "id" ASC
                """,
            ),
        ).mappings()
        return [self._to_action_record(row) for row in rows]

    def list_ad_pricing_actions(self) -> List[AdPricingActionRecord]:
        rows = self.db.execute(
            text(
                """
                SELECT
                  "id",
                  "targetId" AS "placement",
                  "adminUserId" AS "actorUserId",
                  "metadata",
                  "createdAt"
                FROM "AdminAction"
                WHERE "targetType" = 'ad_pricing'
                  AND "action" = 'update_ad_pricing'
                ORDER BY "createdAt" ASC, "id" ASC
                """,
            ),
        ).mappings()
        return [self._to_pricing_action_record(row) for row in rows]

    def get_ad_payment_actions(self, payment_id: str) -> List[AdPaymentActionRecord]:
        rows = self.db.execute(
            text(
                """
                SELECT
                  "id",
                  "targetId" AS "paymentId",
                  "adminUserId" AS "actorUserId",
                  "action",
                  "metadata",
                  "createdAt"
                FROM "AdminAction"
                WHERE "targetType" = 'ad_payment'
                  AND "targetId" = :payment_id
                ORDER BY "createdAt" ASC, "id" ASC
                """,
            ),
            {"payment_id": payment_id},
        ).mappings()
        return [self._to_action_record(row) for row in rows]

    def get_business(self, business_id: str) -> Optional[AdPaymentBusinessRecord]:
        row = self.db.execute(
            text(
                """
                SELECT "id", "ownerUserId", "name", "status"
                FROM "Business"
                WHERE "id" = :business_id
                LIMIT 1
                """,
            ),
            {"business_id": business_id},
        ).mappings().first()
        if row is None:
            return None
        return AdPaymentBusinessRecord(
            id=str(row["id"]),
            owner_id=str(row["ownerUserId"]),
            name=str(row["name"]),
            status=str(row["status"]).lower(),
        )

    def append_ad_payment_action(
        self,
        *,
        actor_user_id: str,
        payment_id: str,
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
                  :actor_user_id,
                  'ad_payment',
                  :payment_id,
                  :action,
                  :metadata,
                  NOW()
                )
                """,
            ),
            {
                "id": uuid4().hex,
                "actor_user_id": actor_user_id,
                "payment_id": payment_id,
                "action": action,
                "metadata": metadata,
            },
        )

    def append_ad_pricing_action(
        self,
        *,
        actor_user_id: str,
        placement: str,
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
                  :actor_user_id,
                  'ad_pricing',
                  :placement,
                  'update_ad_pricing',
                  :metadata,
                  NOW()
                )
                """,
            ),
            {
                "id": uuid4().hex,
                "actor_user_id": actor_user_id,
                "placement": placement,
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

    def _to_action_record(self, row) -> AdPaymentActionRecord:
        return AdPaymentActionRecord(
            id=str(row["id"]),
            payment_id=str(row["paymentId"]),
            actor_user_id=str(row["actorUserId"]),
            action=str(row["action"]),
            metadata=None if row["metadata"] is None else str(row["metadata"]),
            created_at=row["createdAt"],
        )

    def _to_pricing_action_record(self, row) -> AdPricingActionRecord:
        return AdPricingActionRecord(
            id=str(row["id"]),
            placement=str(row["placement"]),
            actor_user_id=str(row["actorUserId"]),
            metadata=None if row["metadata"] is None else str(row["metadata"]),
            created_at=row["createdAt"],
        )
