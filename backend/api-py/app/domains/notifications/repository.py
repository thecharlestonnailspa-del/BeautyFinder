from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class NotificationListRecord:
    id: str
    user_id: str
    type: str
    title: str
    body: str
    created_at: datetime
    read_at: Optional[datetime]


@dataclass(frozen=True)
class NotificationPreferenceState:
    user_id: str
    booking_created: bool
    booking_confirmed: bool
    message_received: bool
    payment_receipt: bool
    review_received: bool
    system: bool
    updated_at: datetime


class NotificationsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._table_presence: Dict[str, bool] = {}
        self._preference_columns = {
            "bookingCreated": '"bookingCreated"',
            "bookingConfirmed": '"bookingConfirmed"',
            "messageReceived": '"messageReceived"',
            "paymentReceipt": '"paymentReceipt"',
            "reviewReceived": '"reviewReceived"',
            "system": '"system"',
        }
        self._type_to_preference_key = {
            "booking_created": "bookingCreated",
            "booking_confirmed": "bookingConfirmed",
            "message_received": "messageReceived",
            "payment_receipt": "paymentReceipt",
            "review_received": "reviewReceived",
            "system": "system",
        }

    def _generate_id(self) -> str:
        return uuid4().hex

    def _preferences_table_missing(self, exc: ProgrammingError) -> bool:
        return 'relation "NotificationPreference" does not exist' in str(exc)

    def _table_exists(self, table_name: str) -> bool:
        cached = self._table_presence.get(table_name)
        if cached is not None:
            return cached
        row = self.db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = :table_name
                LIMIT 1
                """,
            ),
            {"table_name": table_name},
        ).first()
        exists = row is not None
        self._table_presence[table_name] = exists
        return exists

    def _defaults(self, user_id: str) -> Dict[str, object]:
        now = datetime.utcnow()
        return {
            "userId": user_id,
            "bookingCreated": True,
            "bookingConfirmed": True,
            "messageReceived": True,
            "paymentReceipt": True,
            "reviewReceived": True,
            "system": True,
            "updatedAt": now,
        }

    def _preference_key(self, notification_type: str) -> str:
        return self._type_to_preference_key[notification_type]

    def _to_notification_record(self, row) -> NotificationListRecord:
        return NotificationListRecord(
            id=str(row["id"]),
            user_id=str(row["userId"]),
            type=str(row["type"]),
            title=str(row["title"]),
            body="" if row["body"] is None else str(row["body"]),
            created_at=row["createdAt"],
            read_at=row["readAt"],
        )

    def _to_preference_state(self, row) -> NotificationPreferenceState:
        return NotificationPreferenceState(
            user_id=str(row["userId"]),
            booking_created=bool(row["bookingCreated"]),
            booking_confirmed=bool(row["bookingConfirmed"]),
            message_received=bool(row["messageReceived"]),
            payment_receipt=bool(row["paymentReceipt"]),
            review_received=bool(row["reviewReceived"]),
            system=bool(row["system"]),
            updated_at=row["updatedAt"],
        )

    def list_notifications(self, user_id: str) -> List[NotificationListRecord]:
        rows = self.db.execute(
            text(
                """
                SELECT "id", "userId", "type", "title", "body", "createdAt", "readAt"
                FROM "Notification"
                WHERE "userId" = :user_id
                ORDER BY "createdAt" DESC
                """,
            ),
            {"user_id": user_id},
        ).mappings()
        return [self._to_notification_record(row) for row in rows]

    def get_preferences(self, user_id: str) -> Optional[NotificationPreferenceState]:
        if not self._table_exists("NotificationPreference"):
            return None
        try:
            row = self.db.execute(
                text(
                    """
                    SELECT
                      "userId",
                      "bookingCreated",
                      "bookingConfirmed",
                      "messageReceived",
                      "paymentReceipt",
                      "reviewReceived",
                      "system",
                      "updatedAt"
                    FROM "NotificationPreference"
                    WHERE "userId" = :user_id
                    LIMIT 1
                    """,
                ),
                {"user_id": user_id},
            ).mappings().first()
        except ProgrammingError as exc:
            if self._preferences_table_missing(exc):
                return None
            raise

        return None if row is None else self._to_preference_state(row)

    def ensure_preferences(self, user_id: str) -> NotificationPreferenceState:
        defaults = self._defaults(user_id)
        if not self._table_exists("NotificationPreference"):
            return self._to_preference_state(defaults)
        try:
            self.db.execute(
                text(
                    """
                    INSERT INTO "NotificationPreference" (
                      "userId",
                      "bookingCreated",
                      "bookingConfirmed",
                      "messageReceived",
                      "paymentReceipt",
                      "reviewReceived",
                      "system",
                      "updatedAt"
                    )
                    VALUES (
                      :userId,
                      :bookingCreated,
                      :bookingConfirmed,
                      :messageReceived,
                      :paymentReceipt,
                      :reviewReceived,
                      :system,
                      :updatedAt
                    )
                    ON CONFLICT ("userId") DO NOTHING
                    """,
                ),
                defaults,
            )
        except ProgrammingError as exc:
            if self._preferences_table_missing(exc):
                return self._to_preference_state(defaults)
            raise
        return self.get_preferences(user_id) or self._to_preference_state(defaults)

    def update_preferences(
        self,
        user_id: str,
        updates: Dict[str, bool],
    ) -> NotificationPreferenceState:
        if not self._table_exists("NotificationPreference"):
            ephemeral = self._defaults(user_id)
            for key, value in updates.items():
                ephemeral[key] = bool(value)
            ephemeral["updatedAt"] = datetime.utcnow()
            return self._to_preference_state(ephemeral)

        self.ensure_preferences(user_id)

        assignments = []
        params: Dict[str, object] = {
            "user_id": user_id,
            "updated_at": datetime.utcnow(),
        }
        for key, value in updates.items():
            column = self._preference_columns[key]
            assignments.append(f"{column} = :{key}")
            params[key] = bool(value)

        assignments.append('"updatedAt" = :updated_at')
        try:
            self.db.execute(
                text(
                    f"""
                    UPDATE "NotificationPreference"
                    SET {", ".join(assignments)}
                    WHERE "userId" = :user_id
                    """,
                ),
                params,
            )
        except ProgrammingError as exc:
            if self._preferences_table_missing(exc):
                ephemeral = self._defaults(user_id)
                for key, value in updates.items():
                    ephemeral[key] = bool(value)
                ephemeral["updatedAt"] = params["updated_at"]
                return self._to_preference_state(ephemeral)
            raise
        return self.get_preferences(user_id) or self.ensure_preferences(user_id)

    def mark_read(
        self,
        user_id: str,
        *,
        mark_all: bool,
        notification_ids: List[str],
        read_at: datetime,
    ) -> None:
        if mark_all:
            self.db.execute(
                text(
                    """
                    UPDATE "Notification"
                    SET "readAt" = :read_at
                    WHERE "userId" = :user_id
                    """,
                ),
                {
                    "user_id": user_id,
                    "read_at": read_at,
                },
            )
            return

        if not notification_ids:
            return

        self.db.execute(
            text(
                """
                UPDATE "Notification"
                SET "readAt" = :read_at
                WHERE "userId" = :user_id
                  AND "id" = ANY(:notification_ids)
                """,
            ),
            {
                "user_id": user_id,
                "read_at": read_at,
                "notification_ids": notification_ids,
            },
        )

    def create_notification(
        self,
        *,
        user_id: str,
        notification_type: str,
        title: str,
        body: Optional[str],
        created_at: Optional[datetime] = None,
    ) -> Optional[str]:
        preferences = self.get_preferences(user_id)
        merged = self._defaults(user_id)
        if preferences is not None:
            merged = {
                "userId": preferences.user_id,
                "bookingCreated": preferences.booking_created,
                "bookingConfirmed": preferences.booking_confirmed,
                "messageReceived": preferences.message_received,
                "paymentReceipt": preferences.payment_receipt,
                "reviewReceived": preferences.review_received,
                "system": preferences.system,
                "updatedAt": preferences.updated_at,
            }

        if not bool(merged[self._preference_key(notification_type)]):
            return None

        notification_id = self._generate_id()
        self.db.execute(
            text(
                """
                INSERT INTO "Notification" (
                  "id",
                  "userId",
                  "type",
                  "title",
                  "body",
                  "createdAt"
                )
                VALUES (
                  :id,
                  :user_id,
                  :notification_type,
                  :title,
                  :body,
                  :created_at
                )
                """,
            ),
            {
                "id": notification_id,
                "user_id": user_id,
                "notification_type": notification_type,
                "title": title,
                "body": body,
                "created_at": created_at or datetime.utcnow(),
            },
        )
        return notification_id
