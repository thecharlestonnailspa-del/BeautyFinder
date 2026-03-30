import unittest
from datetime import datetime, timezone

from app.core.processors import (
    CustomerBookingSignal,
    CustomerFavoriteSignal,
    CustomerPageViewSignal,
    CustomerPreferenceProcessor,
)


class CustomerInsightsProcessorTests(unittest.TestCase):
    def test_builds_customer_preference_report_from_behavior_signals(self) -> None:
        processor = CustomerPreferenceProcessor()
        report = processor.build_preference_report(
            page_views=[
                CustomerPageViewSignal(
                    customer_id="user-customer-1",
                    customer_name="Ava Tran",
                    customer_email="ava@demo.app",
                    business_id="biz-1",
                    business_name="Polished Studio",
                    business_category="nail",
                    selected_service_name="Gel Manicure",
                    dwell_seconds=94,
                    note="Soft pink nude palette and glossy finish",
                    color_signals=("pink", "nude"),
                    created_at=datetime(2026, 3, 30, 15, 0, tzinfo=timezone.utc),
                ),
                CustomerPageViewSignal(
                    customer_id="user-customer-2",
                    customer_name="Jordan Ellis",
                    customer_email="jordan@demo.app",
                    business_id="biz-2",
                    business_name="North Strand Hair",
                    business_category="hair",
                    selected_service_name="Silk Press",
                    dwell_seconds=110,
                    note="Natural smooth finish",
                    color_signals=(),
                    created_at=datetime(2026, 3, 30, 14, 0, tzinfo=timezone.utc),
                ),
            ],
            favorites=[
                CustomerFavoriteSignal(
                    customer_id="user-customer-1",
                    customer_name="Ava Tran",
                    customer_email="ava@demo.app",
                    business_id="biz-1",
                    business_name="Polished Studio",
                    business_category="nail",
                    created_at=datetime(2026, 3, 29, 18, 0, tzinfo=timezone.utc),
                ),
            ],
            bookings=[
                CustomerBookingSignal(
                    customer_id="user-customer-1",
                    customer_name="Ava Tran",
                    customer_email="ava@demo.app",
                    business_id="biz-1",
                    business_name="Polished Studio",
                    business_category="nail",
                    service_name="Gel Manicure",
                    note="Keep it neutral and clean",
                    created_at=datetime(2026, 3, 28, 18, 0, tzinfo=timezone.utc),
                ),
            ],
        )

        self.assertEqual(report.total_customers, 2)
        self.assertEqual(report.total_tracked_page_views, 2)
        self.assertEqual(report.color_trends[0].label, "neutral")
        self.assertEqual(report.service_trends[0].label, "Gel Manicure")

        top_customer = report.customers[0]
        self.assertEqual(top_customer.customer_id, "user-customer-1")
        self.assertEqual(top_customer.top_services[0].label, "Gel Manicure")
        self.assertEqual(top_customer.favorite_colors[0].label, "neutral")
        self.assertEqual(top_customer.preferred_experience, "Polished natural")
        self.assertGreater(top_customer.engagement_score, 0)


if __name__ == "__main__":
    unittest.main()
