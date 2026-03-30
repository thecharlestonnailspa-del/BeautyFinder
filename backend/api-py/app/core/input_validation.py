import re
from typing import Optional


EMAIL_PATTERN = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$", re.IGNORECASE)


def is_valid_email_address(value: str) -> bool:
    normalized = value.strip()
    if not normalized or len(normalized) > 254:
        return False
    if ".." in normalized:
        return False
    return bool(EMAIL_PATTERN.fullmatch(normalized))


def get_password_validation_error(password: str) -> Optional[str]:
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r"[A-Z]", password):
        return "Password must include at least 1 uppercase letter"
    if not re.search(r"[a-z]", password):
        return "Password must include at least 1 lowercase letter"
    if not re.search(r"\d", password):
        return "Password must include at least 1 number"
    return None
