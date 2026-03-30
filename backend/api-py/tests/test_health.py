import unittest

from app.core.config import Settings
from app.domains.health.service import HealthService, REQUIRED_DATABASE_TABLES


class _FakeScalarResult:
    def __init__(self, values):
        self._values = values

    def all(self):
        return list(self._values)


class _FakeExecuteResult:
    def __init__(self, values):
        self._values = values

    def scalars(self):
        return _FakeScalarResult(self._values)


class _FakeDB:
    def __init__(self, values=None, error=None):
        self._values = values or []
        self._error = error

    def execute(self, _query):
        if self._error is not None:
            raise self._error
        return _FakeExecuteResult(self._values)


def _make_settings() -> Settings:
    return Settings(
        api_name="Beauty Finder API (FastAPI)",
        api_prefix="/api",
        environment="test",
        debug=False,
        host="127.0.0.1",
        port=8001,
        database_url="postgresql+psycopg://beauty_finder:beauty_finder@localhost:5432/beauty_finder",
        redis_url="redis://localhost:6379",
        jwt_secret="top-secret",
        jwt_issuer="beauty-finder-api",
        jwt_ttl_seconds=3600,
        cors_origins_csv="http://127.0.0.1:3000",
        payment_currency="USD",
        payment_tax_rate=0.08,
        owner_media_upload_dir="/tmp/beauty-finder-uploads",
    )


class HealthServiceTests(unittest.TestCase):
    def test_reports_ready_when_required_tables_exist(self) -> None:
        service = HealthService(
            _make_settings(),
            _FakeDB(list(REQUIRED_DATABASE_TABLES)),
        )

        health = service.read_health()

        self.assertEqual(health.status, "ok")
        self.assertEqual(health.database.status, "ready")
        self.assertIsNotNone(health.database.schema_details)
        self.assertEqual(health.database.schema_details.missing_tables, [])

    def test_reports_degraded_when_payment_table_is_missing(self) -> None:
        service = HealthService(
            _make_settings(),
            _FakeDB(
                [table_name for table_name in REQUIRED_DATABASE_TABLES if table_name != "Payment"],
            ),
        )

        health = service.read_health()

        self.assertEqual(health.status, "degraded")
        self.assertEqual(health.database.status, "degraded")
        self.assertIsNotNone(health.database.schema_details)
        self.assertEqual(health.database.schema_details.missing_tables, ["Payment"])

    def test_reports_error_when_schema_inspection_fails(self) -> None:
        service = HealthService(
            _make_settings(),
            _FakeDB(error=RuntimeError("boom")),
        )

        health = service.read_health()

        self.assertEqual(health.status, "degraded")
        self.assertEqual(health.database.status, "error")
        self.assertIn("boom", health.database.detail or "")


if __name__ == "__main__":
    unittest.main()
