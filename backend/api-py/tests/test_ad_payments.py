import unittest
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from app.core.config import Settings
from app.domains.payments.ad_payments_repository import (
    AdPaymentActionRecord,
    AdPaymentBusinessRecord,
    AdPricingActionRecord,
)
from app.domains.payments.service import PaymentsService
from app.schemas.auth import UserSummary
from app.schemas.payments import (
    CheckoutAdPaymentRequest,
    CreateAdPaymentRequest,
    UpdateAdPricingRequest,
    UpdateAdPaymentDiscountRequest,
)


class _NullTransaction:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class _FakeDB:
    def begin(self):
        return _NullTransaction()


class _FakeAdPaymentsRepository:
    def __init__(self) -> None:
        self.actions = []
        self.pricing_actions = []
        self.notifications = []
        self.businesses = {
            "biz-1": AdPaymentBusinessRecord(
                id="biz-1",
                owner_id="user-owner-1",
                name="Polished Studio",
                status="approved",
            ),
        }
        self._base_time = datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc)

    def list_ad_payment_actions(self):
        return list(self.actions)

    def get_ad_payment_actions(self, payment_id: str):
        return [action for action in self.actions if action.payment_id == payment_id]

    def get_business(self, business_id: str):
        return self.businesses.get(business_id)

    def list_ad_pricing_actions(self):
        return list(self.pricing_actions)

    def append_ad_payment_action(
        self,
        *,
        actor_user_id: str,
        payment_id: str,
        action: str,
        metadata: Optional[str],
    ) -> None:
        created_at = self._base_time + timedelta(minutes=len(self.actions))
        self.actions.append(
            AdPaymentActionRecord(
                id=f"evt-{len(self.actions) + 1}",
                payment_id=payment_id,
                actor_user_id=actor_user_id,
                action=action,
                metadata=metadata,
                created_at=created_at,
            ),
        )

    def create_notification(
        self,
        *,
        user_id: str,
        notification_type: str,
        title: str,
        body: Optional[str],
    ):
        self.notifications.append(
            {
                "userId": user_id,
                "type": notification_type,
                "title": title,
                "body": body,
            },
        )
        return f"notif-{len(self.notifications)}"

    def append_ad_pricing_action(
        self,
        *,
        actor_user_id: str,
        placement: str,
        metadata: Optional[str],
    ) -> None:
        created_at = self._base_time + timedelta(minutes=len(self.actions) + len(self.pricing_actions))
        self.pricing_actions.append(
            AdPricingActionRecord(
                id=f"pricing-{len(self.pricing_actions) + 1}",
                placement=placement,
                actor_user_id=actor_user_id,
                metadata=metadata,
                created_at=created_at,
            ),
        )


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


class AdPaymentsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = PaymentsService(_FakeDB(), _make_settings())
        self.service.ad_repository = _FakeAdPaymentsRepository()
        self.owner = UserSummary(
            id="user-owner-1",
            role="owner",
            name="Lina Nguyen",
            email="lina@polishedstudio.app",
        )
        self.admin = UserSummary(
            id="user-admin-1",
            role="admin",
            name="Mason Lee",
            email="admin@beautyfinder.app",
        )
        self.customer = UserSummary(
            id="user-customer-1",
            role="customer",
            name="Ava Tran",
            email="ava@beautyfinder.app",
        )

    def test_owner_can_create_discount_and_checkout_ad_payment(self) -> None:
        created = self.service.create_ad_payment(
            CreateAdPaymentRequest(
                business_id="biz-1",
                campaign_name="Spring Homepage Push",
                placement="homepage_spotlight",
                start_at="2026-04-10T00:00:00Z",
                end_at="2026-04-13T00:00:00Z",
                daily_budget=120,
                note="Promote April nail collection",
            ),
            self.owner,
        )

        self.assertEqual(created.status, "pending_payment")
        self.assertEqual(created.duration_days, 3)
        self.assertEqual(created.subtotal, 360.0)

        discounted = self.service.update_ad_payment_discount(
            created.id,
            UpdateAdPaymentDiscountRequest(
                discount_percent=25,
                note="Launch partner discount",
            ),
            self.admin,
        )

        self.assertEqual(discounted.status, "discounted")
        self.assertEqual(discounted.discount_percent, 25.0)
        self.assertEqual(discounted.discount_amount, 90.0)
        self.assertEqual(discounted.tax, 21.6)
        self.assertEqual(discounted.total, 291.6)

        paid = self.service.checkout_ad_payment(
            created.id,
            CheckoutAdPaymentRequest(
                method="card",
                card_brand="visa",
                card_last4="1111",
            ),
            self.owner,
        )

        self.assertEqual(paid.status, "paid")
        self.assertEqual(paid.method, "card")
        self.assertEqual(paid.card_brand, "VISA")
        self.assertEqual(paid.card_last4, "1111")
        self.assertIsNotNone(paid.receipt_number)
        self.assertEqual(len(self.service.ad_repository.notifications), 3)

    def test_customer_cannot_create_ad_payment(self) -> None:
        with self.assertRaises(HTTPException) as error:
            self.service.create_ad_payment(
                CreateAdPaymentRequest(
                    business_id="biz-1",
                    campaign_name="Invalid Customer Campaign",
                    placement="category_boost",
                    start_at="2026-04-10T00:00:00Z",
                    end_at="2026-04-11T00:00:00Z",
                    daily_budget=50,
                ),
                self.customer,
            )

        self.assertEqual(error.exception.status_code, 403)

    def test_admin_can_customize_daily_and_monthly_ad_pricing(self) -> None:
        defaults = self.service.list_ad_pricing(self.admin)
        homepage_spotlight = next(
            pricing for pricing in defaults if pricing.placement == "homepage_spotlight"
        )
        self.assertEqual(homepage_spotlight.daily_price, 120.0)
        self.assertEqual(homepage_spotlight.monthly_price, 3000.0)

        updated = self.service.update_ad_pricing(
            "homepage_spotlight",
            UpdateAdPricingRequest(
                daily_price=150,
                monthly_price=3600,
                note="Summer front-page premium",
            ),
            self.admin,
        )

        self.assertEqual(updated.daily_price, 150.0)
        self.assertEqual(updated.monthly_price, 3600.0)
        self.assertEqual(updated.note, "Summer front-page premium")
        self.assertEqual(updated.updated_by_user_id, "user-admin-1")


if __name__ == "__main__":
    unittest.main()
