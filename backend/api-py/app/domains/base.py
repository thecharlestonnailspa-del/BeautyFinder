from typing import Optional

from sqlalchemy.orm import Session

from app.core.actors import ActorContext
from app.core.brain import BackendBrain
from app.core.config import Settings
from app.core.roles import RoleName
from app.schemas.auth import UserSummary


class BaseDomainService:
    def __init__(
        self,
        db: Session,
        settings: Settings,
        brain: Optional[BackendBrain] = None,
    ) -> None:
        self.db = db
        self.settings = settings
        self.brain = brain or BackendBrain.default()

    def actor_context(self, actor: UserSummary) -> ActorContext:
        return ActorContext.from_user(actor)

    def resolve_user_scope(
        self,
        actor: UserSummary,
        requested_user_id: Optional[str] = None,
    ) -> str:
        return self.brain.authorization.resolve_user_scope(
            self.actor_context(actor),
            requested_user_id,
        )

    def resolve_booking_role(
        self,
        actor: UserSummary,
        requested_role: Optional[str] = None,
    ) -> str:
        return self.brain.authorization.resolve_booking_role(
            self.actor_context(actor),
            requested_role,
        ).value

    def ensure_business_access(self, actor: UserSummary, owner_user_id: str) -> None:
        self.brain.authorization.ensure_business_access(
            self.actor_context(actor),
            owner_user_id,
        )

    def ensure_conversation_access(
        self,
        actor: UserSummary,
        participant_ids: list[str],
    ) -> None:
        self.brain.authorization.ensure_conversation_access(
            self.actor_context(actor),
            participant_ids,
        )

    def normalize_email(self, value: str) -> str:
        return self.brain.processing.text.normalize_email(value)

    def sanitize_text(self, value: Optional[str]) -> Optional[str]:
        return self.brain.processing.text.sanitize(value)

    def parse_timestamp(self, value: str):
        return self.brain.processing.dates.parse_iso(value)

    def compute_payment_breakdown(
        self,
        *,
        subtotal: float,
        discount_percent: float,
        tip: float,
        tax_rate: float,
    ):
        return self.brain.processing.money.compute_payment_breakdown(
            subtotal=subtotal,
            discount_percent=discount_percent,
            tip=tip,
            tax_rate=tax_rate,
        )

    def default_notification_preferences(self) -> dict[str, bool]:
        return self.brain.processing.notifications.defaults()

    def merge_notification_preferences(
        self,
        current: Optional[dict[str, bool]],
        updates: dict[str, Optional[bool]],
    ) -> dict[str, bool]:
        return self.brain.processing.notifications.merge_preferences(current, updates)

    def should_deliver_notification(
        self,
        notification_type: str,
        preferences: Optional[dict[str, bool]],
    ) -> bool:
        return self.brain.processing.notifications.should_deliver(
            notification_type,
            preferences,
        )

    def dedupe_ids(self, values: list[str]) -> list[str]:
        return self.brain.processing.collections.dedupe_preserve_order(values)

    def is_admin(self, actor: UserSummary) -> bool:
        return self.actor_context(actor).role is RoleName.ADMIN

    def is_owner(self, actor: UserSummary) -> bool:
        return self.actor_context(actor).role is RoleName.OWNER

    def is_technician(self, actor: UserSummary) -> bool:
        return self.actor_context(actor).role is RoleName.TECHNICIAN

    def is_customer(self, actor: UserSummary) -> bool:
        return self.actor_context(actor).role is RoleName.CUSTOMER
