import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.core.config import Settings
from app.domains.bookings.repository import (
    AvailabilitySlotRecord,
    BookingListRecord,
    ServiceBookingRecord,
)
from app.domains.bookings.service import BookingsService
from app.domains.payments.repository import CheckoutBookingRecord, PaymentListRecord
from app.domains.payments.service import PaymentsService
from app.schemas.auth import UserSummary
from app.schemas.bookings import CreateBookingRequest
from app.schemas.payments import CheckoutPaymentRequest


class _NullTransaction:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class _FakeDB:
    def begin(self):
        return _NullTransaction()

    def in_transaction(self) -> bool:
        return False

    def commit(self) -> None:
        return None

    def rollback(self) -> None:
        return None


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


class _FakeBookingsRepository:
    def __init__(self) -> None:
        self.business_owner_id = "user-owner-1"
        self.service_record = ServiceBookingRecord(id="svc-1", name="Gel Manicure")
        self.slot_record = AvailabilitySlotRecord(
            id="slot-1",
            staff_id="staff-1",
            is_booked=False,
        )
        self.created_booking_payload: Optional[dict[str, object]] = None
        self.status_history_calls: list[dict[str, object]] = []
        self.reserved_slots: list[str] = []
        self.notifications: list[dict[str, object]] = []
        self.reserve_slot_result = True

    def get_business_owner_id(self, business_id: str):
        return self.business_owner_id

    def get_active_service(self, service_id: str, business_id: str):
        return self.service_record

    def get_availability_slot(self, business_id: str, service_id: str, start_at, end_at):
        return self.slot_record

    def create_booking(self, **kwargs):
        self.created_booking_payload = kwargs
        return BookingListRecord(
            id="booking-1",
            customer_id=str(kwargs["customer_id"]),
            owner_id=str(kwargs["owner_id"]),
            business_id=str(kwargs["business_id"]),
            service_id=str(kwargs["service_id"]),
            service_name=str(kwargs["service_name"]),
            status=str(kwargs["status"]),
            start_at=kwargs["start_at"],
            end_at=kwargs["end_at"],
            note=None if kwargs["note"] is None else str(kwargs["note"]),
        )

    def create_status_history(self, **kwargs):
        self.status_history_calls.append(kwargs)

    def reserve_slot(self, slot_id: str) -> bool:
        self.reserved_slots.append(slot_id)
        return self.reserve_slot_result

    def create_notification(self, **kwargs):
        self.notifications.append(kwargs)

    def list_bookings(self, user_id: str, role: str):
        return [
            BookingListRecord(
                id=f"booking-{index}",
                customer_id=user_id,
                owner_id="user-owner-1",
                business_id="biz-1",
                service_id="svc-1",
                service_name="Gel Manicure",
                status="confirmed",
                start_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
                end_at=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
                note=None,
            )
            for index in range(2000)
        ]


class _FakePaymentsRepository:
    def __init__(self) -> None:
        self.booking = CheckoutBookingRecord(
            id="booking-1",
            customer_id="user-customer-1",
            owner_id="user-owner-1",
            business_id="biz-1",
            service_id="svc-1",
            status="pending",
            service_name="Gel Manicure",
            service_price=100.0,
            business_name="Polished Studio",
            customer_name="Ava Tran",
            promotion_discount_percent=10,
            promotion_expires_at=datetime.now(timezone.utc) + timedelta(days=1),
            payment_id=None,
        )
        self.updated_statuses: list[dict[str, str]] = []
        self.status_history_calls: list[dict[str, object]] = []
        self.created_payment_payload: Optional[dict[str, object]] = None
        self.notifications: list[dict[str, object]] = []
        self.raise_duplicate_on_create = False

    def get_checkout_booking(self, booking_id: str):
        if booking_id != self.booking.id:
            return None
        return self.booking

    def update_booking_status(self, booking_id: str, new_status: str) -> None:
        self.updated_statuses.append(
            {
                "booking_id": booking_id,
                "new_status": new_status,
            },
        )

    def create_status_history(self, **kwargs):
        self.status_history_calls.append(kwargs)

    def create_payment(self, **kwargs):
        if self.raise_duplicate_on_create:
            raise IntegrityError(
                'INSERT INTO "Payment" ("appointmentId") VALUES (:appointment_id)',
                {"appointment_id": kwargs["booking"].id},
                Exception('duplicate key value violates unique constraint "Payment_appointmentId_key"'),
            )
        self.created_payment_payload = kwargs
        paid_at = kwargs["paid_at"]
        return PaymentListRecord(
            id="payment-1",
            booking_id=kwargs["booking"].id,
            customer_id=kwargs["booking"].customer_id,
            owner_id=kwargs["booking"].owner_id,
            business_id=kwargs["booking"].business_id,
            service_id=kwargs["booking"].service_id,
            method=str(kwargs["method"]).lower(),
            status="paid",
            subtotal=float(kwargs["subtotal"]),
            discount=float(kwargs["discount"]),
            tax=float(kwargs["tax"]),
            tip=float(kwargs["tip"]),
            total=float(kwargs["total"]),
            currency=str(kwargs["currency"]),
            receipt_number=str(kwargs["receipt_number"]),
            card_brand=None if kwargs["card_brand"] is None else str(kwargs["card_brand"]),
            card_last4=None if kwargs["card_last4"] is None else str(kwargs["card_last4"]),
            paid_at=paid_at,
            created_at=paid_at,
        )

    def create_notification(self, **kwargs):
        self.notifications.append(kwargs)

    def list_payments(self, user_id: str, role: str):
        now = datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc)
        return [
            PaymentListRecord(
                id=f"payment-{index}",
                booking_id=f"booking-{index}",
                customer_id=user_id,
                owner_id="user-owner-1",
                business_id="biz-1",
                service_id="svc-1",
                method="card",
                status="paid",
                subtotal=100.0,
                discount=10.0,
                tax=7.2,
                tip=5.0,
                total=102.2,
                currency="USD",
                receipt_number=f"BF-20260401-{index:08d}",
                card_brand="VISA",
                card_last4="4242",
                paid_at=now,
                created_at=now,
            )
            for index in range(2000)
        ]


class BookingPaymentLogicTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = _make_settings()
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

    def test_booking_uses_business_owner_and_service_from_repository(self) -> None:
        service = BookingsService(_FakeDB(), self.settings)
        repository = _FakeBookingsRepository()
        service.repository = repository

        booking = service.create_booking(
            CreateBookingRequest(
                customerId="user-customer-1",
                ownerId="owner-from-client-should-be-ignored",
                businessId="biz-1",
                serviceId="svc-1",
                serviceName="Injected Service Name",
                startAt="2026-04-10T14:00:00Z",
                endAt="2026-04-10T15:00:00Z",
                note="  French tip upgrade please  ",
            ),
            self.customer,
        )

        self.assertEqual(booking.owner_id, "user-owner-1")
        self.assertEqual(booking.service_name, "Gel Manicure")
        self.assertEqual(booking.note, "French tip upgrade please")
        self.assertEqual(repository.created_booking_payload["owner_id"], "user-owner-1")
        self.assertEqual(repository.created_booking_payload["service_name"], "Gel Manicure")
        self.assertEqual(repository.reserved_slots, ["slot-1"])
        self.assertEqual(len(repository.notifications), 2)

    def test_customer_cannot_create_booking_for_another_customer(self) -> None:
        service = BookingsService(_FakeDB(), self.settings)
        repository = _FakeBookingsRepository()
        service.repository = repository

        with self.assertRaises(HTTPException) as error:
            service.create_booking(
                CreateBookingRequest(
                    customerId="user-customer-2",
                    ownerId="user-owner-1",
                    businessId="biz-1",
                    serviceId="svc-1",
                    serviceName="Gel Manicure",
                    startAt="2026-04-10T14:00:00Z",
                    endAt="2026-04-10T15:00:00Z",
                ),
                self.customer,
            )

        self.assertEqual(error.exception.status_code, 403)
        self.assertEqual(
            error.exception.detail,
            "Customers can only create bookings for themselves",
        )

    def test_booking_rejects_slot_lost_during_atomic_reservation(self) -> None:
        service = BookingsService(_FakeDB(), self.settings)
        repository = _FakeBookingsRepository()
        repository.reserve_slot_result = False
        service.repository = repository

        with self.assertRaises(HTTPException) as error:
            service.create_booking(
                CreateBookingRequest(
                    customerId="user-customer-1",
                    ownerId="user-owner-1",
                    businessId="biz-1",
                    serviceId="svc-1",
                    serviceName="Gel Manicure",
                    startAt="2026-04-10T14:00:00Z",
                    endAt="2026-04-10T15:00:00Z",
                ),
                self.customer,
            )

        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(
            error.exception.detail,
            "Availability slot is already booked",
        )
        self.assertEqual(repository.reserved_slots, ["slot-1"])
        self.assertIsNone(repository.created_booking_payload)

    def test_checkout_payment_confirms_pending_booking_and_applies_discount(self) -> None:
        service = PaymentsService(_FakeDB(), self.settings)
        repository = _FakePaymentsRepository()
        service.repository = repository

        payment = service.checkout_payment(
            CheckoutPaymentRequest(
                bookingId="booking-1",
                method="card",
                tipAmount=15,
                cardBrand="visa",
                cardLast4="1111",
            ),
            self.customer,
        )

        self.assertEqual(payment.status, "paid")
        self.assertEqual(payment.subtotal, 100.0)
        self.assertEqual(payment.discount, 10.0)
        self.assertEqual(payment.tax, 7.2)
        self.assertEqual(payment.tip, 15.0)
        self.assertEqual(payment.total, 112.2)
        self.assertEqual(payment.card_brand, "VISA")
        self.assertEqual(payment.card_last4, "1111")
        self.assertEqual(
            repository.updated_statuses,
            [{"booking_id": "booking-1", "new_status": "confirmed"}],
        )
        self.assertEqual(len(repository.status_history_calls), 1)
        self.assertEqual(len(repository.notifications), 3)

    def test_checkout_payment_rejects_duplicate_payment(self) -> None:
        service = PaymentsService(_FakeDB(), self.settings)
        repository = _FakePaymentsRepository()
        repository.booking = replace(repository.booking, payment_id="payment-existing")
        service.repository = repository

        with self.assertRaises(HTTPException) as error:
            service.checkout_payment(
                CheckoutPaymentRequest(
                    bookingId="booking-1",
                    method="card",
                ),
                self.customer,
            )

        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(error.exception.detail, "This booking has already been paid")

    def test_checkout_payment_rejects_cancelled_booking(self) -> None:
        service = PaymentsService(_FakeDB(), self.settings)
        repository = _FakePaymentsRepository()
        repository.booking = replace(repository.booking, status="cancelled")
        service.repository = repository

        with self.assertRaises(HTTPException) as error:
            service.checkout_payment(
                CheckoutPaymentRequest(
                    bookingId="booking-1",
                    method="card",
                ),
                self.customer,
            )

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(
            error.exception.detail,
            "Cancelled bookings cannot be paid or confirmed",
        )

    def test_checkout_payment_translates_unique_constraint_race_to_conflict(self) -> None:
        service = PaymentsService(_FakeDB(), self.settings)
        repository = _FakePaymentsRepository()
        repository.raise_duplicate_on_create = True
        service.repository = repository

        with self.assertRaises(HTTPException) as error:
            service.checkout_payment(
                CheckoutPaymentRequest(
                    bookingId="booking-1",
                    method="card",
                ),
                self.customer,
            )

        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(error.exception.detail, "This booking has already been paid")

    def test_booking_and_payment_list_serialization_performance_smoke(self) -> None:
        bookings_service = BookingsService(_FakeDB(), self.settings)
        bookings_service.repository = _FakeBookingsRepository()
        payments_service = PaymentsService(_FakeDB(), self.settings)
        payments_service.repository = _FakePaymentsRepository()

        started_at = perf_counter()
        bookings = bookings_service.list_bookings(
            self.customer,
            requested_user_id=None,
            requested_role=None,
        )
        payments = payments_service.list_payments(
            self.customer,
            requested_user_id=None,
            requested_role=None,
        )
        elapsed = perf_counter() - started_at

        self.assertEqual(len(bookings), 2000)
        self.assertEqual(len(payments), 2000)
        self.assertLess(
            elapsed,
            2.5,
            msg=f"Bulk booking/payment serialization smoke test took {elapsed:.3f}s",
        )


if __name__ == "__main__":
    unittest.main()
