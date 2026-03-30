from typing import Optional

from pydantic import Field

from app.schemas.auth import CamelModel


class ConversationRecord(CamelModel):
    id: str
    business_id: str = Field(alias="businessId")
    booking_id: Optional[str] = Field(default=None, alias="bookingId")
    participant_ids: list[str] = Field(alias="participantIds")
    last_message: str = Field(alias="lastMessage")
    last_message_at: str = Field(alias="lastMessageAt")


class MessageRecord(CamelModel):
    id: str
    conversation_id: str = Field(alias="conversationId")
    sender_id: str = Field(alias="senderId")
    body: str
    created_at: str = Field(alias="createdAt")


class CreateMessageRequest(CamelModel):
    sender_id: str = Field(alias="senderId", min_length=1)
    body: str = Field(min_length=1, max_length=1000)
