from enum import Enum


class RoleName(str, Enum):
    CUSTOMER = "customer"
    OWNER = "owner"
    TECHNICIAN = "technician"
    ADMIN = "admin"

    @classmethod
    def from_value(cls, value: str) -> "RoleName":
        normalized = value.strip().lower()
        for role in cls:
            if role.value == normalized:
                return role
        raise ValueError(f"Unsupported role: {value}")
