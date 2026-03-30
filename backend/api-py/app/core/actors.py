from dataclasses import dataclass
from typing import Any

from app.core.roles import RoleName


@dataclass(frozen=True)
class ActorContext:
    id: str
    role: RoleName
    name: str = ""
    email: str = ""

    @classmethod
    def from_user(cls, user: Any) -> "ActorContext":
        role_value = getattr(user, "role", None)
        if role_value is None and isinstance(user, dict):
            role_value = user.get("role", "")
        user_id = getattr(user, "id", None)
        if user_id is None and isinstance(user, dict):
            user_id = user.get("id", "")
        name = getattr(user, "name", None)
        if name is None and isinstance(user, dict):
            name = user.get("name", "")
        email = getattr(user, "email", None)
        if email is None and isinstance(user, dict):
            email = user.get("email", "")
        return cls(
            id=str(user_id or ""),
            role=RoleName.from_value(str(role_value)),
            name=str(name or ""),
            email=str(email or ""),
        )
