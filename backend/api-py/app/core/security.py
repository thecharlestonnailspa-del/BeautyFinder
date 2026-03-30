from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import datetime, timezone
from hashlib import sha256
from hmac import compare_digest, new as new_hmac
from json import dumps, loads
from secrets import token_hex
from shutil import which
from subprocess import CalledProcessError, run
from typing import Any, Dict, Optional

try:
    from hashlib import scrypt as hashlib_scrypt
except ImportError:  # pragma: no cover - depends on the local Python build
    hashlib_scrypt = None

_NODE_BINARY = which("node")


class TokenDecodeError(ValueError):
    """Raised when a bearer token cannot be decoded or validated."""


def supports_scrypt() -> bool:
    return hashlib_scrypt is not None or _NODE_BINARY is not None


def to_base64url(value: bytes) -> str:
    return urlsafe_b64encode(value).rstrip(b"=").decode("utf-8")


def from_base64url(value: str) -> bytes:
    normalized = value + "=" * ((4 - len(value) % 4) % 4)
    return urlsafe_b64decode(normalized.encode("utf-8"))


def sign_access_token_value(value: str, secret: str) -> str:
    return to_base64url(new_hmac(secret.encode("utf-8"), value.encode("utf-8"), sha256).digest())


def hash_legacy_password(password: str) -> str:
    return "sha256$" + sha256(password.encode("utf-8")).hexdigest()


def _derive_scrypt_key_with_node(password: str, salt: str) -> str:
    if _NODE_BINARY is None:
        raise RuntimeError(
            "This runtime does not expose hashlib.scrypt and Node.js is not available for the compatibility fallback.",
        )

    script = """
const { scryptSync } = require('crypto');
const fs = require('fs');

const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(scryptSync(payload.password, payload.salt, 64).toString('hex'));
""".strip()

    try:
        completed = run(
            [_NODE_BINARY, "-e", script],
            input=dumps({"password": password, "salt": salt}),
            text=True,
            capture_output=True,
            check=True,
        )
    except CalledProcessError as exc:  # pragma: no cover - depends on local node runtime
        raise RuntimeError(
            "Unable to derive an scrypt password hash with the Node.js fallback.",
        ) from exc

    derived_key = completed.stdout.strip()
    if not derived_key:
        raise RuntimeError("Node.js scrypt fallback returned an empty derived key.")

    return derived_key


def derive_scrypt_key(password: str, salt: str) -> str:
    if hashlib_scrypt is not None:
        return hashlib_scrypt(
            password.encode("utf-8"),
            salt=salt.encode("utf-8"),
            n=16384,
            r=8,
            p=1,
            dklen=64,
        ).hex()

    return _derive_scrypt_key_with_node(password, salt)


def hash_password(password: str) -> str:
    salt = token_hex(16)
    derived_key = derive_scrypt_key(password, salt)
    return f"scrypt${salt}${derived_key}"


def verify_password(password: str, password_hash: str) -> bool:
    if password_hash.startswith("scrypt$"):
        _, salt, stored_key = password_hash.split("$", 2)
        derived_key = derive_scrypt_key(password, salt)
        return compare_digest(stored_key, derived_key)

    if password_hash.startswith("sha256$"):
        return compare_digest(hash_legacy_password(password), password_hash)

    return compare_digest(password_hash, password)


def needs_password_rehash(password_hash: str) -> bool:
    return not password_hash.startswith("scrypt$")


def create_access_token(
    *,
    user_id: str,
    role: str,
    secret: str,
    issuer: str,
    ttl_seconds: int,
    now_in_seconds: Optional[int] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> Dict[str, str]:
    issued_at = now_in_seconds or int(datetime.now(tz=timezone.utc).timestamp())
    expires_at = issued_at + ttl_seconds
    header = {"alg": "HS256", "typ": "JWT"}
    payload: Dict[str, Any] = {
        "ver": 2,
        "iss": issuer,
        "sub": user_id,
        "role": role,
        "iat": issued_at,
        "exp": expires_at,
    }
    if extra_claims:
        for key, value in extra_claims.items():
            if key in payload:
                continue
            payload[key] = value
    encoded_header = to_base64url(dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_payload = to_base64url(dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = sign_access_token_value(f"{encoded_header}.{encoded_payload}", secret)
    return {
        "token": f"{encoded_header}.{encoded_payload}.{signature}",
        "expires_at": datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def decode_access_token(
    token: str,
    secret: str,
    issuer: str,
    now_in_seconds: Optional[int] = None,
) -> Dict[str, Any]:
    encoded_header, separator, remainder = token.partition(".")
    encoded_payload, separator2, provided_signature = remainder.partition(".")

    if not encoded_header or not separator or not encoded_payload or not separator2 or not provided_signature:
        raise TokenDecodeError("Invalid bearer token")

    expected_signature = sign_access_token_value(
        f"{encoded_header}.{encoded_payload}",
        secret,
    )
    if not compare_digest(expected_signature, provided_signature):
        raise TokenDecodeError("Invalid bearer token")

    try:
        header = loads(from_base64url(encoded_header).decode("utf-8"))
        payload = loads(from_base64url(encoded_payload).decode("utf-8"))
    except Exception as exc:
        raise TokenDecodeError("Invalid bearer token") from exc

    now = now_in_seconds or int(datetime.now(tz=timezone.utc).timestamp())
    if (
        header.get("alg") != "HS256"
        or header.get("typ") != "JWT"
        or payload.get("iss") != issuer
        or payload.get("ver") not in (None, 2)
        or not payload.get("sub")
        or not payload.get("role")
        or not isinstance(payload.get("iat"), int)
        or not isinstance(payload.get("exp"), int)
        or payload["exp"] <= now
    ):
        raise TokenDecodeError("Invalid bearer token")

    return payload
