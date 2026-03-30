from typing import Optional, Sequence

try:
    from sqlalchemy import text
    from sqlalchemy.orm import Session
except ModuleNotFoundError:  # pragma: no cover - exercised only in lean local test envs.
    def text(value: str) -> str:
        return value

    class Session:  # type: ignore[no-redef]
        pass

from app.core.config import Settings
from app.schemas.health import (
    DatabaseSchemaHealth,
    DependencyHealth,
    HealthResponse,
)

REQUIRED_DATABASE_TABLES: Sequence[str] = (
    "AdminAction",
    "Appointment",
    "AppointmentStatusHistory",
    "AvailabilitySlot",
    "Business",
    "BusinessImage",
    "Conversation",
    "ConversationParticipant",
    "Favorite",
    "Message",
    "Notification",
    "NotificationPreference",
    "Payment",
    "Review",
    "Service",
    "Staff",
    "User",
    "UserRole",
)


class HealthService:
    def __init__(self, settings: Settings, db: Optional[Session] = None) -> None:
        self.settings = settings
        self.db = db

    def _read_database_health(self) -> DependencyHealth:
        if not self.settings.database_configured:
            return DependencyHealth(configured=False, status="missing")

        if self.db is None:
            return DependencyHealth(configured=True, status="configured")

        try:
            table_names = {
                str(table_name)
                for table_name in self.db.execute(
                    text(
                        """
                        SELECT table_name
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                        """,
                    ),
                ).scalars().all()
            }
        except Exception as exc:
            return DependencyHealth(
                configured=True,
                status="error",
                detail=f"Schema inspection failed: {exc}",
            )

        missing_tables = [
            table_name
            for table_name in REQUIRED_DATABASE_TABLES
            if table_name not in table_names
        ]
        schema = DatabaseSchemaHealth(
            status="degraded" if missing_tables else "ready",
            required_tables=list(REQUIRED_DATABASE_TABLES),
            missing_tables=missing_tables,
        )
        if missing_tables:
            return DependencyHealth(
                configured=True,
                status="degraded",
                detail="Database schema is missing required tables",
                schema_details=schema,
            )

        return DependencyHealth(
            configured=True,
            status="ready",
            schema_details=schema,
        )

    def read_health(self) -> HealthResponse:
        database = self._read_database_health()
        overall_status = (
            "degraded"
            if database.status in {"missing", "error", "degraded"}
            else "ok"
        )
        return HealthResponse(
            status=overall_status,
            service="api-py",
            environment=self.settings.environment,
            database=database,
            redis=DependencyHealth(
                configured=self.settings.redis_configured,
                status="configured" if self.settings.redis_configured else "missing",
            ),
        )
