import hashlib
import re


REFERENCE_PREFIX_MAP = {
    "business": "BUS",
    "customer": "CUS",
    "owner": "OWN",
    "technician": "TEC",
    "admin": "ADM",
    "user": "USR",
}


def build_public_id(entity_type: str, internal_id: str) -> str:
    normalized_entity_type = entity_type.strip().lower() or "user"
    prefix = REFERENCE_PREFIX_MAP.get(normalized_entity_type, "USR")
    normalized_id = re.sub(r"[^A-Z0-9]", "", internal_id.upper())
    id_tail = (normalized_id[-4:] if normalized_id else "").rjust(4, "0")
    digest = hashlib.sha1(
        f"{normalized_entity_type}:{internal_id}".encode("utf-8"),
    ).hexdigest()[:8].upper()
    return f"{prefix}-{id_tail}-{digest}"
