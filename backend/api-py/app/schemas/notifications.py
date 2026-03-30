from typing import Optional

from pydantic import Field

from app.schemas.auth import CamelModel
from app.schemas.common import NotificationType


class NotificationRecord(CamelModel):
    id: str
    user_id: str = Field(alias="userId")
    type: NotificationType
    title: str
    body: str
    created_at: str = Field(alias="createdAt")
    read: bool


class NotificationPreferenceRecord(CamelModel):
    user_id: str = Field(alias="userId")
    booking_created: bool = Field(alias="bookingCreated")
    booking_confirmed: bool = Field(alias="bookingConfirmed")
    message_received: bool = Field(alias="messageReceived")
    payment_receipt: bool = Field(alias="paymentReceipt")
    review_received: bool = Field(alias="reviewReceived")
    system: bool
    updated_at: str = Field(alias="updatedAt")


class NotificationPreferenceUpdate(CamelModel):
    booking_created: Optional[bool] = Field(default=None, alias="bookingCreated")
    booking_confirmed: Optional[bool] = Field(default=None, alias="bookingConfirmed")
    message_received: Optional[bool] = Field(default=None, alias="messageReceived")
    payment_receipt: Optional[bool] = Field(default=None, alias="paymentReceipt")
    review_received: Optional[bool] = Field(default=None, alias="reviewReceived")
    system: Optional[bool] = None


class ReadNotificationsRequest(CamelModel):
    notification_ids: list[str] = Field(default_factory=list, alias="notificationIds")
    mark_all: bool = Field(default=False, alias="markAll")
