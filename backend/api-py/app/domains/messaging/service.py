from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.authorization import AuthorizationError
from app.core.config import Settings
from app.domains.base import BaseDomainService
from app.domains.messaging.repository import (
    ConversationSummaryRecord,
    MessageListRecord,
    MessagingRepository,
)
from app.schemas.auth import UserSummary
from app.schemas.messaging import (
    ConversationRecord,
    CreateMessageRequest,
    MessageRecord,
)


class MessagingService(BaseDomainService):
    def __init__(self, db: Session, settings: Settings) -> None:
        super().__init__(db, settings)
        self.repository = MessagingRepository(db)

    def _to_conversation_record(
        self,
        conversation: ConversationSummaryRecord,
    ) -> ConversationRecord:
        last_message_at = (
            conversation.last_message_at
            or conversation.latest_message_at
            or conversation.created_at
        )
        last_message = conversation.last_message or conversation.latest_message or ""
        return ConversationRecord(
            id=conversation.id,
            business_id=conversation.business_id,
            booking_id=conversation.booking_id,
            participant_ids=conversation.participant_ids,
            last_message=last_message,
            last_message_at=self.brain.processing.dates.to_utc_iso(
                last_message_at,
            ).replace("+00:00", "Z"),
        )

    def _to_message_record(self, message: MessageListRecord) -> MessageRecord:
        return MessageRecord(
            id=message.id,
            conversation_id=message.conversation_id,
            sender_id=message.sender_id,
            body=message.body,
            created_at=self.brain.processing.dates.to_utc_iso(message.created_at).replace(
                "+00:00",
                "Z",
            ),
        )

    def _get_conversation_or_404(self, conversation_id: str):
        conversation = self.repository.get_conversation_access(conversation_id)
        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        return conversation

    def list_conversations(
        self,
        actor: UserSummary,
        *,
        requested_user_id: Optional[str],
    ) -> List[ConversationRecord]:
        try:
            target_user_id = self.resolve_user_scope(actor, requested_user_id)
        except AuthorizationError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access data inside your own account scope",
            ) from exc

        conversations = self.repository.list_conversations(target_user_id)
        return [self._to_conversation_record(item) for item in conversations]

    def list_messages(
        self,
        conversation_id: str,
        actor: UserSummary,
    ) -> List[MessageRecord]:
        conversation = self._get_conversation_or_404(conversation_id)
        try:
            self.ensure_conversation_access(actor, conversation.participant_ids)
        except AuthorizationError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this conversation",
            ) from exc

        messages = self.repository.list_messages(conversation_id)
        return [self._to_message_record(item) for item in messages]

    def create_message(
        self,
        conversation_id: str,
        input_data: CreateMessageRequest,
        actor: UserSummary,
    ) -> MessageRecord:
        sanitized_body = self.sanitize_text(input_data.body)
        if input_data.sender_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only send messages as yourself",
            )

        if not sanitized_body:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message body is required",
            )

        with self.db.begin():
            conversation = self._get_conversation_or_404(conversation_id)
            try:
                self.ensure_conversation_access(actor, conversation.participant_ids)
            except AuthorizationError as exc:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have access to this conversation",
                ) from exc

            if actor.id not in set(conversation.participant_ids):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Sender is not part of this conversation",
                )

            created_message = self.repository.create_message(
                conversation_id=conversation_id,
                sender_id=actor.id,
                body=sanitized_body,
            )

            recipient_id = next(
                (
                    participant_id
                    for participant_id in conversation.participant_ids
                    if participant_id != actor.id
                ),
                None,
            )
            if recipient_id:
                self.repository.create_notification(
                    user_id=recipient_id,
                    notification_type="message_received",
                    title="New message",
                    body=sanitized_body,
                    created_at=created_message.created_at,
                )

        return self._to_message_record(created_message)
