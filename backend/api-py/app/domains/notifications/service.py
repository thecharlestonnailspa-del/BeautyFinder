from typing import List, Optional

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.authorization import AuthorizationError
from app.core.config import Settings
from app.domains.base import BaseDomainService
from app.domains.notifications.repository import (
    NotificationListRecord,
    NotificationPreferenceState,
    NotificationsRepository,
)
from app.schemas.auth import UserSummary
from app.schemas.notifications import (
    NotificationPreferenceRecord,
    NotificationPreferenceUpdate,
    NotificationRecord,
    ReadNotificationsRequest,
)


class NotificationsService(BaseDomainService):
    def __init__(self, db: Session, settings: Settings) -> None:
        super().__init__(db, settings)
        self.repository = NotificationsRepository(db)

    def _to_notification_record(
        self,
        notification: NotificationListRecord,
    ) -> NotificationRecord:
        return NotificationRecord(
            id=notification.id,
            user_id=notification.user_id,
            type=notification.type,
            title=notification.title,
            body=notification.body,
            created_at=self.brain.processing.dates.to_utc_iso(
                notification.created_at,
            ).replace("+00:00", "Z"),
            read=bool(notification.read_at),
        )

    def _to_preference_record(
        self,
        preference: NotificationPreferenceState,
    ) -> NotificationPreferenceRecord:
        return NotificationPreferenceRecord(
            user_id=preference.user_id,
            booking_created=preference.booking_created,
            booking_confirmed=preference.booking_confirmed,
            message_received=preference.message_received,
            payment_receipt=preference.payment_receipt,
            review_received=preference.review_received,
            system=preference.system,
            updated_at=self.brain.processing.dates.to_utc_iso(
                preference.updated_at,
            ).replace("+00:00", "Z"),
        )

    def list_notifications(
        self,
        actor: UserSummary,
        *,
        requested_user_id: Optional[str],
    ) -> List[NotificationRecord]:
        try:
            target_user_id = self.resolve_user_scope(actor, requested_user_id)
        except AuthorizationError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access data inside your own account scope",
            ) from exc

        notifications = self.repository.list_notifications(target_user_id)
        return [self._to_notification_record(item) for item in notifications]

    def get_preferences(
        self,
        actor: UserSummary,
        *,
        requested_user_id: Optional[str],
    ) -> NotificationPreferenceRecord:
        try:
            target_user_id = self.resolve_user_scope(actor, requested_user_id)
        except AuthorizationError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access data inside your own account scope",
            ) from exc

        preferences = self.repository.ensure_preferences(target_user_id)
        return self._to_preference_record(preferences)

    def update_preferences(
        self,
        actor: UserSummary,
        input_data: NotificationPreferenceUpdate,
        *,
        requested_user_id: Optional[str],
    ) -> NotificationPreferenceRecord:
        try:
            target_user_id = self.resolve_user_scope(actor, requested_user_id)
        except AuthorizationError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access data inside your own account scope",
            ) from exc

        updates = input_data.model_dump(by_alias=True, exclude_none=True)
        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one notification preference must be provided",
            )

        preferences = self.repository.update_preferences(target_user_id, updates)
        return self._to_preference_record(preferences)

    def mark_read(
        self,
        actor: UserSummary,
        input_data: ReadNotificationsRequest,
        *,
        requested_user_id: Optional[str],
    ) -> List[NotificationRecord]:
        try:
            target_user_id = self.resolve_user_scope(actor, requested_user_id)
        except AuthorizationError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access data inside your own account scope",
            ) from exc

        deduped_ids = self.dedupe_ids(input_data.notification_ids)
        if not input_data.mark_all and not deduped_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide notificationIds or set markAll to true",
            )

        with self.db.begin():
            self.repository.mark_read(
                target_user_id,
                mark_all=input_data.mark_all,
                notification_ids=deduped_ids,
                read_at=datetime.utcnow(),
            )

        notifications = self.repository.list_notifications(target_user_id)
        return [self._to_notification_record(item) for item in notifications]
