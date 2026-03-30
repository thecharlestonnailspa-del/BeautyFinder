import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import List

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:  # pragma: no cover - exercised only in lean local test envs.
    def load_dotenv(*_args, **_kwargs) -> bool:
        return False


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_float(value: str, default: float) -> float:
    try:
        parsed = float(value)
    except ValueError:
        return default
    return parsed if parsed >= 0 else default


def _default_owner_media_upload_dir() -> str:
    return os.path.normpath(
        os.path.join(os.path.dirname(__file__), "../../uploads"),
    )


def _load_env_files() -> None:
    current_file = Path(__file__).resolve()
    app_root = current_file.parents[2]
    repo_root = current_file.parents[4]

    # Prefer repo-level env so api-py can share the same DB/JWT config as the Nest app.
    load_dotenv(repo_root / ".env", override=False)
    load_dotenv(app_root / ".env", override=False)


def _normalize_sqlalchemy_database_url(value: str) -> str:
    normalized = value.strip()
    if normalized.startswith("postgresql://") and "+psycopg" not in normalized:
        return normalized.replace("postgresql://", "postgresql+psycopg://", 1)
    return normalized


@dataclass(frozen=True)
class Settings:
    api_name: str
    api_prefix: str
    environment: str
    debug: bool
    host: str
    port: int
    database_url: str
    redis_url: str
    jwt_secret: str
    jwt_issuer: str
    jwt_ttl_seconds: int
    cors_origins_csv: str
    payment_currency: str
    payment_tax_rate: float
    owner_media_upload_dir: str

    @property
    def cors_origins(self) -> List[str]:
        values = [origin.strip() for origin in self.cors_origins_csv.split(",")]
        return [origin for origin in values if origin]

    @property
    def database_configured(self) -> bool:
        return bool(self.database_url.strip())

    @property
    def redis_configured(self) -> bool:
        return bool(self.redis_url.strip())


@lru_cache
def get_settings() -> Settings:
    _load_env_files()

    return Settings(
        api_name=os.getenv("API_NAME", "Beauty Finder API (FastAPI)"),
        api_prefix=os.getenv("API_PREFIX", "/api"),
        environment=os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development")),
        debug=_as_bool(os.getenv("DEBUG", "false")),
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8001")),
        database_url=_normalize_sqlalchemy_database_url(
            os.getenv(
                "DATABASE_URL",
                "postgresql+psycopg://beauty_finder:beauty_finder@localhost:5432/beauty_finder",
            ),
        ),
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
        jwt_secret=os.getenv("JWT_SECRET", "replace-me"),
        jwt_issuer=os.getenv("JWT_ISSUER", "beauty-finder-api"),
        jwt_ttl_seconds=int(os.getenv("JWT_TTL_SECONDS", "604800")),
        cors_origins_csv=os.getenv(
            "CORS_ORIGINS",
            "http://127.0.0.1:3001,http://127.0.0.1:3002,http://127.0.0.1:8081",
        ),
        payment_currency=os.getenv("PAYMENT_CURRENCY", "USD").strip().upper() or "USD",
        payment_tax_rate=_as_float(os.getenv("PAYMENT_TAX_RATE", "0.08"), 0.08),
        owner_media_upload_dir=os.getenv(
            "OWNER_MEDIA_UPLOAD_DIR",
            _default_owner_media_upload_dir(),
        ).strip()
        or _default_owner_media_upload_dir(),
    )
