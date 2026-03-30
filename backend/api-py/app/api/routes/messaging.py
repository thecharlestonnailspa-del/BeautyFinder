from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_session, get_messaging_service
from app.domains.messaging.service import MessagingService
from app.schemas.auth import SessionPayload
from app.schemas.messaging import (
    ConversationRecord,
    CreateMessageRequest,
    MessageRecord,
)

router = APIRouter(prefix="/messaging", tags=["messaging"])


@router.get("/conversations", response_model=List[ConversationRecord])
def get_conversations(
    user_id: Optional[str] = Query(default=None, alias="userId"),
    session: SessionPayload = Depends(get_current_session),
    service: MessagingService = Depends(get_messaging_service),
) -> List[ConversationRecord]:
    return service.list_conversations(session.user, requested_user_id=user_id)


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageRecord])
def get_messages(
    conversation_id: str,
    session: SessionPayload = Depends(get_current_session),
    service: MessagingService = Depends(get_messaging_service),
) -> List[MessageRecord]:
    return service.list_messages(conversation_id, session.user)


@router.post("/conversations/{conversation_id}/messages", response_model=MessageRecord)
def create_message(
    conversation_id: str,
    input_data: CreateMessageRequest,
    session: SessionPayload = Depends(get_current_session),
    service: MessagingService = Depends(get_messaging_service),
) -> MessageRecord:
    return service.create_message(conversation_id, input_data, session.user)
