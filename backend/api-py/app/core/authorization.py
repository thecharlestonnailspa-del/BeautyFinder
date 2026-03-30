from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterable, Optional

from app.core.actors import ActorContext
from app.core.roles import RoleName


class AuthorizationError(PermissionError):
    """Raised when an actor crosses an authorization boundary."""


@dataclass(frozen=True)
class AccessScope:
    actor_id: str
    target_user_id: str
    role: RoleName


class BaseRolePolicy(ABC):
    role: RoleName

    def resolve_user_scope(
        self,
        actor: ActorContext,
        requested_user_id: Optional[str] = None,
    ) -> str:
        normalized_requested_user_id = (requested_user_id or "").strip()
        if not normalized_requested_user_id:
            return actor.id

        self.ensure_user_scope(actor, normalized_requested_user_id)
        return normalized_requested_user_id

    def resolve_booking_role(
        self,
        actor: ActorContext,
        requested_role: Optional[str] = None,
    ) -> RoleName:
        normalized_requested_role = (requested_role or "").strip()
        if not normalized_requested_role:
            return actor.role

        role = RoleName.from_value(normalized_requested_role)
        self.ensure_role_scope(actor, role)
        return role

    @abstractmethod
    def ensure_user_scope(self, actor: ActorContext, user_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def ensure_role_scope(self, actor: ActorContext, role: RoleName) -> None:
        raise NotImplementedError

    def ensure_business_access(self, actor: ActorContext, owner_user_id: str) -> None:
        if actor.id != owner_user_id:
            raise AuthorizationError(
                "You can only manage resources inside your own business scope",
            )

    def ensure_conversation_access(
        self,
        actor: ActorContext,
        participant_ids: Iterable[str],
    ) -> None:
        if actor.id not in set(participant_ids):
            raise AuthorizationError(
                "You do not have access to this conversation",
            )


class CustomerPolicy(BaseRolePolicy):
    role = RoleName.CUSTOMER

    def ensure_user_scope(self, actor: ActorContext, user_id: str) -> None:
        if actor.id != user_id:
            raise AuthorizationError(
                "Customers can only access data inside their own account scope",
            )

    def ensure_role_scope(self, actor: ActorContext, role: RoleName) -> None:
        if role is not RoleName.CUSTOMER:
            raise AuthorizationError(
                "Customers can only operate inside the customer role scope",
            )


class OwnerPolicy(BaseRolePolicy):
    role = RoleName.OWNER

    def ensure_user_scope(self, actor: ActorContext, user_id: str) -> None:
        if actor.id != user_id:
            raise AuthorizationError(
                "Owners can only access data inside their own account scope",
            )

    def ensure_role_scope(self, actor: ActorContext, role: RoleName) -> None:
        if role is not RoleName.OWNER:
            raise AuthorizationError(
                "Owners can only operate inside the owner role scope",
            )


class TechnicianPolicy(BaseRolePolicy):
    role = RoleName.TECHNICIAN

    def ensure_user_scope(self, actor: ActorContext, user_id: str) -> None:
        if actor.id != user_id:
            raise AuthorizationError(
                "Technicians can only access data inside their own account scope",
            )

    def ensure_role_scope(self, actor: ActorContext, role: RoleName) -> None:
        if role is not RoleName.TECHNICIAN:
            raise AuthorizationError(
                "Technicians can only operate inside the technician role scope",
            )

    def ensure_business_access(self, actor: ActorContext, owner_user_id: str) -> None:
        raise AuthorizationError(
            "Technicians cannot manage salon owner business resources",
        )


class AdminPolicy(BaseRolePolicy):
    role = RoleName.ADMIN

    def resolve_user_scope(
        self,
        actor: ActorContext,
        requested_user_id: Optional[str] = None,
    ) -> str:
        normalized_requested_user_id = (requested_user_id or "").strip()
        return normalized_requested_user_id or actor.id

    def resolve_booking_role(
        self,
        actor: ActorContext,
        requested_role: Optional[str] = None,
    ) -> RoleName:
        normalized_requested_role = (requested_role or "").strip()
        return (
            RoleName.from_value(normalized_requested_role)
            if normalized_requested_role
            else RoleName.ADMIN
        )

    def ensure_user_scope(self, actor: ActorContext, user_id: str) -> None:
        return None

    def ensure_role_scope(self, actor: ActorContext, role: RoleName) -> None:
        return None

    def ensure_business_access(self, actor: ActorContext, owner_user_id: str) -> None:
        return None

    def ensure_conversation_access(
        self,
        actor: ActorContext,
        participant_ids: Iterable[str],
    ) -> None:
        return None


class AuthorizationBrain:
    def __init__(self) -> None:
        self._policies = {
            RoleName.CUSTOMER: CustomerPolicy(),
            RoleName.OWNER: OwnerPolicy(),
            RoleName.TECHNICIAN: TechnicianPolicy(),
            RoleName.ADMIN: AdminPolicy(),
        }

    def get_policy(self, actor: ActorContext) -> BaseRolePolicy:
        return self._policies[actor.role]

    def build_access_scope(
        self,
        actor: ActorContext,
        requested_user_id: Optional[str] = None,
        requested_role: Optional[str] = None,
    ) -> AccessScope:
        policy = self.get_policy(actor)
        return AccessScope(
            actor_id=actor.id,
            target_user_id=policy.resolve_user_scope(actor, requested_user_id),
            role=policy.resolve_booking_role(actor, requested_role),
        )

    def resolve_user_scope(
        self,
        actor: ActorContext,
        requested_user_id: Optional[str] = None,
    ) -> str:
        return self.get_policy(actor).resolve_user_scope(actor, requested_user_id)

    def resolve_booking_role(
        self,
        actor: ActorContext,
        requested_role: Optional[str] = None,
    ) -> RoleName:
        return self.get_policy(actor).resolve_booking_role(actor, requested_role)

    def ensure_business_access(self, actor: ActorContext, owner_user_id: str) -> None:
        self.get_policy(actor).ensure_business_access(actor, owner_user_id)

    def ensure_conversation_access(
        self,
        actor: ActorContext,
        participant_ids: Iterable[str],
    ) -> None:
        self.get_policy(actor).ensure_conversation_access(actor, participant_ids)
