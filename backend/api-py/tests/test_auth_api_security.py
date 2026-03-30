import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_auth_service, get_bookings_service, get_current_session
from app.api.routes import auth, bookings
from app.core.config import Settings
from app.core.security import create_access_token
from app.domains.auth.repository import AuthUserRecord
from app.domains.auth.service import AuthService
from app.domains.bookings.service import BookingsService
from app.schemas.auth import SessionPayload, UserSummary


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


def _make_session(user: UserSummary) -> SessionPayload:
    return SessionPayload(
        permissions=["read", "write"],
        access_token="test-token",
        expires_at="2026-04-01T00:00:00Z",
        user=user,
    )


class _FakeAuthRepository:
    def __init__(self) -> None:
        self.users: dict[str, AuthUserRecord] = {}

    def get_user_by_id(self, user_id: str):
        return self.users.get(user_id)


class _ScopeAwareBookingsRepository:
    def __init__(self) -> None:
        self.list_calls = 0

    def list_bookings(self, user_id: str, role: str):
        self.list_calls += 1
        return []


class AuthAndApiSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = _make_settings()
        self.auth_service = AuthService(db=None, settings=self.settings)  # type: ignore[arg-type]
        self.auth_repository = _FakeAuthRepository()
        self.auth_service.repository = self.auth_repository  # type: ignore[assignment]

        self.customer_record = AuthUserRecord(
            id="user-customer-1",
            email="ava@beautyfinder.app",
            password_hash="scrypt$stub$hash",
            full_name="Ava Tran",
            phone=None,
            roles=["customer"],
        )
        self.auth_repository.users[self.customer_record.id] = self.customer_record

        self.customer = UserSummary(
            id="user-customer-1",
            role="customer",
            name="Ava Tran",
            email="ava@beautyfinder.app",
        )

    def _build_auth_client(self) -> TestClient:
        app = FastAPI()
        app.include_router(auth.router, prefix="/api")
        app.dependency_overrides[get_auth_service] = lambda: self.auth_service
        return TestClient(app)

    def test_missing_authorization_header_returns_401_detail(self) -> None:
        client = self._build_auth_client()

        response = client.get("/api/auth/session")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.json(),
            {"detail": "Missing Authorization header"},
        )

    def test_non_bearer_authorization_header_returns_401_detail(self) -> None:
        client = self._build_auth_client()

        response = client.get(
            "/api/auth/session",
            headers={"Authorization": "Token abc123"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.json(),
            {"detail": "Authorization header must use Bearer token"},
        )

    def test_tampered_token_is_rejected(self) -> None:
        client = self._build_auth_client()
        bundle = create_access_token(
            user_id=self.customer_record.id,
            role="customer",
            secret=self.settings.jwt_secret,
            issuer=self.settings.jwt_issuer,
            ttl_seconds=self.settings.jwt_ttl_seconds,
            now_in_seconds=1_700_000_000,
        )
        token = bundle["token"]
        tampered = token[:-1] + ("a" if token[-1] != "a" else "b")

        response = client.get(
            "/api/auth/session",
            headers={"Authorization": f"Bearer {tampered}"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "Invalid bearer token"})

    def test_signed_token_with_escalated_role_is_rejected(self) -> None:
        client = self._build_auth_client()
        bundle = create_access_token(
            user_id=self.customer_record.id,
            role="admin",
            secret=self.settings.jwt_secret,
            issuer=self.settings.jwt_issuer,
            ttl_seconds=self.settings.jwt_ttl_seconds,
            now_in_seconds=1_700_000_000,
        )

        response = client.get(
            "/api/auth/session",
            headers={"Authorization": f"Bearer {bundle['token']}"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "Invalid bearer token"})

    def test_admin_access_claims_with_wrong_target_user_are_rejected(self) -> None:
        admin_record = AuthUserRecord(
            id="user-admin-1",
            email="admin@beautyfinder.app",
            password_hash="scrypt$stub$hash",
            full_name="Mason Lee",
            phone=None,
            roles=["admin"],
        )
        self.auth_repository.users[admin_record.id] = admin_record
        client = self._build_auth_client()
        bundle = create_access_token(
            user_id=self.customer_record.id,
            role="customer",
            secret=self.settings.jwt_secret,
            issuer=self.settings.jwt_issuer,
            ttl_seconds=self.settings.jwt_ttl_seconds,
            now_in_seconds=1_700_000_000,
            extra_claims={
                "adminAccess": {
                    "adminUserId": admin_record.id,
                    "adminName": "Mason Lee",
                    "startedAt": "2026-03-30T16:00:00.000Z",
                    "targetUserId": "user-someone-else",
                },
            },
        )

        response = client.get(
            "/api/auth/session",
            headers={"Authorization": f"Bearer {bundle['token']}"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "Invalid bearer token"})

    def test_customer_cannot_request_owner_booking_scope(self) -> None:
        app = FastAPI()
        app.include_router(bookings.router, prefix="/api")
        bookings_service = BookingsService(db=None, settings=self.settings)  # type: ignore[arg-type]
        bookings_repository = _ScopeAwareBookingsRepository()
        bookings_service.repository = bookings_repository  # type: ignore[assignment]
        app.dependency_overrides[get_current_session] = lambda: _make_session(self.customer)
        app.dependency_overrides[get_bookings_service] = lambda: bookings_service
        client = TestClient(app)

        response = client.get("/api/bookings?role=owner")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"detail": "You can only view bookings inside your own role scope"},
        )
        self.assertEqual(bookings_repository.list_calls, 0)

    def test_invalid_booking_payload_returns_validation_error_list(self) -> None:
        app = FastAPI()
        app.include_router(bookings.router, prefix="/api")
        app.dependency_overrides[get_current_session] = lambda: _make_session(self.customer)
        app.dependency_overrides[get_bookings_service] = lambda: object()
        client = TestClient(app)

        response = client.post(
            "/api/bookings",
            json={
                "businessId": "biz-1",
            },
        )

        self.assertEqual(response.status_code, 422)
        body = response.json()
        self.assertIn("detail", body)
        self.assertIsInstance(body["detail"], list)
        self.assertTrue(
            any(issue["loc"][-1] == "customerId" for issue in body["detail"]),
        )


if __name__ == "__main__":
    unittest.main()
