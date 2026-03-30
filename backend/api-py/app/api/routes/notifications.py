from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_session, get_notifications_service
from app.domains.notifications.service import NotificationsService
from app.schemas.auth import SessionPayload
from app.schemas.notifications import (
    NotificationPreferenceRecord,
    NotificationPreferenceUpdate,
    NotificationRecord,
    ReadNotificationsRequest,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=List[NotificationRecord])
def get_notifications(
    user_id: Optional[str] = Query(default=None, alias="userId"),
    session: SessionPayload = Depends(get_current_session),
    service: NotificationsService = Depends(get_notifications_service),
) -> List[NotificationRecord]:
    return service.list_notifications(session.user, requested_user_id=user_id)


@router.get("/preferences", response_model=NotificationPreferenceRecord)
def get_notification_preferences(
    user_id: Optional[str] = Query(default=None, alias="userId"),
    session: SessionPayload = Depends(get_current_session),
    service: NotificationsService = Depends(get_notifications_service),
) -> NotificationPreferenceRecord:
    return service.get_preferences(session.user, requested_user_id=user_id)


@router.put("/preferences", response_model=NotificationPreferenceRecord)
def update_notification_preferences(
    input_data: NotificationPreferenceUpdate,
    user_id: Optional[str] = Query(default=None, alias="userId"),
    session: SessionPayload = Depends(get_current_session),
    service: NotificationsService = Depends(get_notifications_service),
) -> NotificationPreferenceRecord:
    return service.update_preferences(
        session.user,
        input_data,
        requested_user_id=user_id,
    )


@router.post("/read", response_model=List[NotificationRecord])
def mark_notifications_read(
    input_data: ReadNotificationsRequest,
    user_id: Optional[str] = Query(default=None, alias="userId"),
    session: SessionPayload = Depends(get_current_session),
    service: NotificationsService = Depends(get_notifications_service),
) -> List[NotificationRecord]:
    return service.mark_read(session.user, input_data, requested_user_id=user_id)
