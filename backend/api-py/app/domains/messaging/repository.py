from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domains.notifications.repository import NotificationsRepository


@dataclass(frozen=True)
class ConversationAccessRecord:
    id: str
    participant_ids: list[str]


@dataclass(frozen=True)
class ConversationSummaryRecord:
    id: str
    business_id: str
    booking_id: Optional[str]
    participant_ids: list[str]
    last_message: Optional[str]
    last_message_at: Optional[datetime]
    created_at: datetime
    latest_message: Optional[str]
    latest_message_at: Optional[datetime]


@dataclass(frozen=True)
class MessageListRecord:
    id: str
    conversation_id: str
    sender_id: str
    body: str
    created_at: datetime


class MessagingRepository:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationsRepository(db)

    def _generate_id(self) -> str:
        return uuid4().hex

    def _list_participants(self, conversation_id: str) -> list[str]:
        rows = self.db.execute(
            text(
                """
                SELECT "userId"
                FROM "ConversationParticipant"
                WHERE "conversationId" = :conversation_id
                ORDER BY "createdAt" ASC, "id" ASC
                """,
            ),
            {"conversation_id": conversation_id},
        ).mappings()
        return [str(row["userId"]) for row in rows]

    def get_conversation_access(
        self,
        conversation_id: str,
    ) -> Optional[ConversationAccessRecord]:
        row = self.db.execute(
            text(
                """
                SELECT "id"
                FROM "Conversation"
                WHERE "id" = :conversation_id
                LIMIT 1
                """,
            ),
            {"conversation_id": conversation_id},
        ).mappings().first()

        if row is None:
            return None

        return ConversationAccessRecord(
            id=str(row["id"]),
            participant_ids=self._list_participants(conversation_id),
        )

    def list_conversations(self, user_id: str) -> List[ConversationSummaryRecord]:
        rows = self.db.execute(
            text(
                """
                SELECT
                  conversation."id",
                  conversation."businessId",
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
                  ) AS "latestMessageAt"
                FROM "Conversation" AS conversation
                WHERE EXISTS (
                  SELECT 1
                  FROM "ConversationParticipant" AS participant
                  WHERE participant."conversationId" = conversation."id"
                    AND participant."userId" = :user_id
                )
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
            {"user_id": user_id},
        ).mappings()

        conversations: list[ConversationSummaryRecord] = []
        for row in rows:
            conversation_id = str(row["id"])
            conversations.append(
                ConversationSummaryRecord(
                    id=conversation_id,
                    business_id=str(row["businessId"]),
                    booking_id=(
                        None if row["bookingId"] is None else str(row["bookingId"])
                    ),
                    participant_ids=self._list_participants(conversation_id),
                    last_message=(
                        None if row["lastMessage"] is None else str(row["lastMessage"])
                    ),
                    last_message_at=row["lastMessageAt"],
                    created_at=row["createdAt"],
                    latest_message=(
                        None
                        if row["latestMessage"] is None
                        else str(row["latestMessage"])
                    ),
                    latest_message_at=row["latestMessageAt"],
                ),
            )

        return conversations

    def list_messages(self, conversation_id: str) -> List[MessageListRecord]:
        rows = self.db.execute(
            text(
                """
                SELECT "id", "conversationId", "senderUserId", "content", "createdAt"
                FROM "Message"
                WHERE "conversationId" = :conversation_id
                ORDER BY "createdAt" ASC, "id" ASC
                """,
            ),
            {"conversation_id": conversation_id},
        ).mappings()

        return [
            MessageListRecord(
                id=str(row["id"]),
                conversation_id=str(row["conversationId"]),
                sender_id=str(row["senderUserId"]),
                body=str(row["content"]),
                created_at=row["createdAt"],
            )
            for row in rows
        ]

    def create_message(
        self,
        *,
        conversation_id: str,
        sender_id: str,
        body: str,
    ) -> MessageListRecord:
        message_id = self._generate_id()
        row = self.db.execute(
            text(
                """
                INSERT INTO "Message" (
                  "id",
                  "conversationId",
                  "senderUserId",
                  "messageType",
                  "content",
                  "createdAt"
                )
                VALUES (
                  :id,
                  :conversation_id,
                  :sender_id,
                  'TEXT',
                  :body,
                  NOW()
                )
                RETURNING "id", "conversationId", "senderUserId", "content", "createdAt"
                """,
            ),
            {
                "id": message_id,
                "conversation_id": conversation_id,
                "sender_id": sender_id,
                "body": body,
            },
        ).mappings().one()

        self.db.execute(
            text(
                """
                UPDATE "Conversation"
                SET "lastMessage" = :body, "lastMessageAt" = :created_at
                WHERE "id" = :conversation_id
                """,
            ),
            {
                "conversation_id": conversation_id,
                "body": body,
                "created_at": row["createdAt"],
            },
        )

        return MessageListRecord(
            id=str(row["id"]),
            conversation_id=str(row["conversationId"]),
            sender_id=str(row["senderUserId"]),
            body=str(row["content"]),
            created_at=row["createdAt"],
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
        return self.notifications.create_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            created_at=created_at,
        )
