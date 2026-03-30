import unittest
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_current_session, get_customer_insights_service
from app.api.routes import customer_insights
from app.core.config import Settings
from app.domains.customer_insights.repository import (
    BusinessTargetRecord,
    OwnerBusinessAudienceAggregate,
)
from app.domains.customer_insights.service import CustomerInsightsService
from app.schemas.auth import SessionPayload, UserSummary


class _NullTransaction:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class _FakeDB:
    def begin(self):
        return _NullTransaction()


class _FakeCustomerInsightsRepository:
    def __init__(self) -> None:
        self.ensure_storage_calls = 0
        self.last_owner_user_id = None
        self.businesses = {
            "biz-1": BusinessTargetRecord(
                id="biz-1",
                name="Polished Studio",
                category="nail",
            ),
        }
        self.recorded_page_views = []
        self.owner_business_audience = []
        self.owner_unique_viewers = 0

    def ensure_storage(self) -> None:
        self.ensure_storage_calls += 1

    def get_business_target(self, business_id: str):
        return self.businesses.get(business_id)

    def record_business_page_view(
        self,
        *,
        customer_id: str,
        business_id: str,
        selected_service_id,
        selected_service_name,
        note,
        dwell_seconds: int,
        color_signals,
        source: str,
    ) -> None:
        self.recorded_page_views.append(
            {
                "customer_id": customer_id,
                "business_id": business_id,
                "selected_service_id": selected_service_id,
                "selected_service_name": selected_service_name,
                "note": note,
                "dwell_seconds": dwell_seconds,
                "color_signals": list(color_signals),
                "source": source,
            },
        )

    def list_owner_business_audience(self, owner_user_id: str):
        self.last_owner_user_id = owner_user_id
        return list(self.owner_business_audience)

    def count_owner_unique_viewers(self, owner_user_id: str) -> int:
        self.last_owner_user_id = owner_user_id
        return self.owner_unique_viewers


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


def _build_client(
    service: CustomerInsightsService,
    session: SessionPayload,
) -> TestClient:
    app = FastAPI()
    app.include_router(customer_insights.router, prefix="/api")
    app.dependency_overrides[get_current_session] = lambda: session
    app.dependency_overrides[get_customer_insights_service] = lambda: service
    return TestClient(app)


class CustomerInsightsEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repository = _FakeCustomerInsightsRepository()
        self.service = CustomerInsightsService(_FakeDB(), _make_settings())
        self.service.repository = self.repository
        self.customer = UserSummary(
            id="user-customer-1",
            role="customer",
            name="Ava Tran",
            email="ava@beautyfinder.app",
        )
        self.owner = UserSummary(
            id="user-owner-1",
            role="owner",
            name="Lina Nguyen",
            email="lina@polishedstudio.app",
        )

    def test_customer_can_record_page_view_from_endpoint(self) -> None:
        client = _build_client(self.service, _make_session(self.customer))

        response = client.post(
            "/api/customer-insights/businesses/biz-1/page-view",
            json={
                "selectedServiceId": "svc-1",
                "selectedServiceName": " Gel Manicure ",
                "note": "  Soft pink nude palette  ",
                "dwellSeconds": 92,
                "colorSignals": ["Pink", " pink ", "NUDE", "unknown"],
                "source": " manual-debug ",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "tracked": True,
                "dwellSeconds": 92,
            },
        )
        self.assertEqual(self.repository.ensure_storage_calls, 1)
        self.assertEqual(len(self.repository.recorded_page_views), 1)
        self.assertEqual(
            self.repository.recorded_page_views[0],
            {
                "customer_id": "user-customer-1",
                "business_id": "biz-1",
                "selected_service_id": "svc-1",
                "selected_service_name": "Gel Manicure",
                "note": "Soft pink nude palette",
                "dwell_seconds": 92,
                "color_signals": ["pink", "neutral"],
                "source": "manual-debug",
            },
        )

    def test_owner_cannot_record_page_view_from_endpoint(self) -> None:
        client = _build_client(self.service, _make_session(self.owner))

        response = client.post(
            "/api/customer-insights/businesses/biz-1/page-view",
            json={
                "dwellSeconds": 45,
            },
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"detail": "Only customers can record browsing behavior"},
        )

    def test_owner_report_endpoint_returns_aggregated_audience_metrics(self) -> None:
        self.repository.owner_unique_viewers = 3
        self.repository.owner_business_audience = [
            OwnerBusinessAudienceAggregate(
                business_id="biz-1",
                business_name="Polished Studio",
                unique_viewers=2,
                total_page_views=4,
                average_dwell_seconds=92,
                last_viewed_at=datetime(2026, 3, 30, 15, 0, tzinfo=timezone.utc),
            ),
            OwnerBusinessAudienceAggregate(
                business_id="biz-2",
                business_name="North Strand Hair",
                unique_viewers=1,
                total_page_views=1,
                average_dwell_seconds=54,
                last_viewed_at=datetime(2026, 3, 29, 18, 30, tzinfo=timezone.utc),
            ),
        ]
        client = _build_client(self.service, _make_session(self.owner))

        response = client.get("/api/customer-insights/owner/report")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["totalUniqueViewers"], 3)
        self.assertEqual(body["totalPageViews"], 5)
        self.assertEqual(body["businessesWithViews"], 2)
        self.assertEqual(self.repository.last_owner_user_id, "user-owner-1")
        self.assertEqual(self.repository.ensure_storage_calls, 1)
        self.assertEqual(body["businesses"][0]["businessId"], "biz-1")
        self.assertEqual(body["businesses"][0]["uniqueViewers"], 2)
        self.assertEqual(body["businesses"][0]["averageDwellSeconds"], 92)
        self.assertEqual(body["businesses"][0]["lastViewedAt"], "2026-03-30T15:00:00Z")

    def test_customer_cannot_access_owner_report_endpoint(self) -> None:
        client = _build_client(self.service, _make_session(self.customer))

        response = client.get("/api/customer-insights/owner/report")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"detail": "Only business owners can view this audience report"},
        )


if __name__ == "__main__":
    unittest.main()
