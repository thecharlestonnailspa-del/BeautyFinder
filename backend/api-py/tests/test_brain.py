import unittest

from app.core.actors import ActorContext
from app.core.authorization import AuthorizationError
from app.core.brain import BackendBrain
from app.core.roles import RoleName


class HomepageItem:
    def __init__(
        self,
        *,
        name: str,
        featured_on_homepage: bool,
        homepage_rank: int,
        rating: float,
        review_count: int,
    ) -> None:
        self.name = name
        self.featured_on_homepage = featured_on_homepage
        self.homepage_rank = homepage_rank
        self.rating = rating
        self.review_count = review_count


class BackendBrainTests(unittest.TestCase):
    def setUp(self) -> None:
        self.brain = BackendBrain.default()

    def test_customer_scope_stays_inside_customer_account(self) -> None:
        actor = ActorContext(
            id="user-customer-1",
            role=RoleName.CUSTOMER,
            name="Ava Tran",
            email="ava@beautyfinder.app",
        )

        self.assertEqual(
            self.brain.authorization.resolve_user_scope(actor, None),
            "user-customer-1",
        )
        self.assertEqual(
            self.brain.authorization.resolve_booking_role(actor, None),
            RoleName.CUSTOMER,
        )
        with self.assertRaises(AuthorizationError):
            self.brain.authorization.resolve_user_scope(actor, "user-customer-2")

    def test_admin_can_cross_role_and_user_boundaries(self) -> None:
        actor = ActorContext(
            id="user-admin-1",
            role=RoleName.ADMIN,
            name="Admin",
            email="admin@beautyfinder.app",
        )

        scope = self.brain.authorization.build_access_scope(
            actor,
            requested_user_id="user-owner-1",
            requested_role="owner",
        )

        self.assertEqual(scope.target_user_id, "user-owner-1")
        self.assertEqual(scope.role, RoleName.OWNER)

    def test_owner_must_stay_inside_owned_business_scope(self) -> None:
        actor = ActorContext(
            id="user-owner-1",
            role=RoleName.OWNER,
            name="Lina Nguyen",
            email="lina@polishedstudio.app",
        )

        self.brain.authorization.ensure_business_access(actor, "user-owner-1")
        with self.assertRaises(AuthorizationError):
            self.brain.authorization.ensure_business_access(actor, "user-owner-2")

    def test_technician_cannot_cross_into_owner_business_scope(self) -> None:
        actor = ActorContext(
            id="user-technician-1",
            role=RoleName.TECHNICIAN,
            name="Maya Chen",
            email="maya@privatebeauty.app",
        )

        with self.assertRaises(AuthorizationError):
            self.brain.authorization.ensure_business_access(actor, "user-owner-1")

    def test_money_processor_matches_expected_checkout_math(self) -> None:
        breakdown = self.brain.processing.money.compute_payment_breakdown(
            subtotal=55,
            discount_percent=15,
            tip=5,
            tax_rate=0.08,
        )

        self.assertEqual(breakdown.discount, 8.25)
        self.assertEqual(breakdown.tax, 3.74)
        self.assertEqual(breakdown.total, 55.49)

    def test_notification_processor_merges_preferences_and_gates_delivery(self) -> None:
        merged = self.brain.processing.notifications.merge_preferences(
            {"messageReceived": True, "system": True},
            {"messageReceived": False},
        )

        self.assertFalse(
            self.brain.processing.notifications.should_deliver(
                "message_received",
                merged,
            ),
        )
        self.assertTrue(
            self.brain.processing.notifications.should_deliver("system", merged),
        )

    def test_collection_processor_sorts_homepage_items(self) -> None:
        items = [
            HomepageItem(
                name="Beta Salon",
                featured_on_homepage=False,
                homepage_rank=999,
                rating=4.9,
                review_count=42,
            ),
            HomepageItem(
                name="Alpha Studio",
                featured_on_homepage=True,
                homepage_rank=2,
                rating=4.7,
                review_count=25,
            ),
            HomepageItem(
                name="Apex Nails",
                featured_on_homepage=True,
                homepage_rank=1,
                rating=4.5,
                review_count=18,
            ),
        ]

        ordered = self.brain.processing.collections.sort_homepage_items(items)

        self.assertEqual([item.name for item in ordered], [
            "Apex Nails",
            "Alpha Studio",
            "Beta Salon",
        ])


if __name__ == "__main__":
    unittest.main()
