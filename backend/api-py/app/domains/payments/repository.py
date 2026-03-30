from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domains.notifications.repository import NotificationsRepository


@dataclass(frozen=True)
class PaymentListRecord:
    id: str
    booking_id: str
    customer_id: str
    owner_id: str
    business_id: str
    service_id: str
    method: str
    status: str
    subtotal: float
    discount: float
    tax: float
    tip: float
    total: float
    currency: str
    receipt_number: str
    card_brand: Optional[str]
    card_last4: Optional[str]
    paid_at: datetime
    created_at: datetime


@dataclass(frozen=True)
class CheckoutBookingRecord:
    id: str
    customer_id: str
    owner_id: str
    business_id: str
    service_id: str
    status: str
    service_name: str
    service_price: float
    business_name: str
    customer_name: str
    promotion_discount_percent: Optional[int]
    promotion_expires_at: Optional[datetime]
    payment_id: Optional[str]


class PaymentsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationsRepository(db)

    def _generate_id(self) -> str:
        return uuid4().hex

    def _to_float(self, value) -> float:
        if value is None:
            return 0.0
        return float(value)

    def _to_payment_list_record(self, row) -> PaymentListRecord:
        return PaymentListRecord(
            id=str(row["id"]),
            booking_id=str(row["appointmentId"]),
            customer_id=str(row["customerId"]),
            owner_id=str(row["ownerId"]),
            business_id=str(row["businessId"]),
            service_id=str(row["serviceId"]),
            method=str(row["method"]).lower(),
            status=str(row["status"]).lower(),
            subtotal=self._to_float(row["subtotalAmount"]),
            discount=self._to_float(row["discountAmount"]),
            tax=self._to_float(row["taxAmount"]),
            tip=self._to_float(row["tipAmount"]),
            total=self._to_float(row["totalAmount"]),
            currency=str(row["currency"]),
            receipt_number=str(row["receiptNumber"]),
            card_brand=None if row["cardBrand"] is None else str(row["cardBrand"]),
            card_last4=None if row["cardLast4"] is None else str(row["cardLast4"]),
            paid_at=row["paidAt"],
            created_at=row["createdAt"],
        )

    def list_payments(self, user_id: str, role: str) -> List[PaymentListRecord]:
        where_clause = ""
        params = {}
        if role == "owner":
            where_clause = 'WHERE appointment."ownerId" = :user_id'
            params["user_id"] = user_id
        elif role == "customer":
            where_clause = 'WHERE appointment."customerId" = :user_id'
            params["user_id"] = user_id

        rows = self.db.execute(
            text(
                f"""
                SELECT
                  payment."id",
                  payment."appointmentId",
                  appointment."customerId",
                  appointment."ownerId",
                  appointment."businessId",
                  appointment."serviceId",
                  payment."method",
                  payment."status",
                  payment."subtotalAmount",
                  payment."discountAmount",
                  payment."taxAmount",
                  payment."tipAmount",
                  payment."totalAmount",
                  payment."currency",
                  payment."receiptNumber",
                  payment."cardBrand",
                  payment."cardLast4",
                  payment."paidAt",
                  payment."createdAt"
                FROM "Payment" AS payment
                INNER JOIN "Appointment" AS appointment
                  ON appointment."id" = payment."appointmentId"
                {where_clause}
                ORDER BY payment."paidAt" DESC
                """,
            ),
            params,
        ).mappings()

        return [self._to_payment_list_record(row) for row in rows]

    def get_checkout_booking(self, booking_id: str) -> Optional[CheckoutBookingRecord]:
        row = self.db.execute(
            text(
                """
                SELECT
                  appointment."id",
                  appointment."customerId",
                  appointment."ownerId",
                  appointment."businessId",
                  appointment."serviceId",
                  LOWER(CAST(appointment."status" AS TEXT)) AS "status",
                  service."name" AS "serviceName",
                  service."price" AS "servicePrice",
                  business."name" AS "businessName",
                  business."promotionDiscountPercent",
                  business."promotionExpiresAt",
                  customer."fullName" AS "customerName",
                  payment."id" AS "paymentId"
                FROM "Appointment" AS appointment
                INNER JOIN "Service" AS service
                  ON service."id" = appointment."serviceId"
                INNER JOIN "Business" AS business
                  ON business."id" = appointment."businessId"
                INNER JOIN "User" AS customer
                  ON customer."id" = appointment."customerId"
                LEFT JOIN "Payment" AS payment
                  ON payment."appointmentId" = appointment."id"
                WHERE appointment."id" = :booking_id
                LIMIT 1
                """,
            ),
            {"booking_id": booking_id},
        ).mappings().first()

        if row is None:
            return None

        return CheckoutBookingRecord(
            id=str(row["id"]),
            customer_id=str(row["customerId"]),
            owner_id=str(row["ownerId"]),
            business_id=str(row["businessId"]),
            service_id=str(row["serviceId"]),
            status=str(row["status"]),
            service_name=str(row["serviceName"]),
            service_price=self._to_float(row["servicePrice"]),
            business_name=str(row["businessName"]),
            customer_name=str(row["customerName"]),
            promotion_discount_percent=(
                None
                if row["promotionDiscountPercent"] is None
                else int(row["promotionDiscountPercent"])
            ),
            promotion_expires_at=row["promotionExpiresAt"],
            payment_id=None if row["paymentId"] is None else str(row["paymentId"]),
        )

    def update_booking_status(self, booking_id: str, new_status: str) -> None:
        self.db.execute(
            text(
                """
                UPDATE "Appointment"
                SET "status" = :new_status, "updatedAt" = NOW()
                WHERE "id" = :booking_id
                """,
            ),
            {
                "booking_id": booking_id,
                "new_status": new_status.upper(),
            },
        )

    def create_status_history(
        self,
        *,
        appointment_id: str,
        old_status: Optional[str],
        new_status: str,
        changed_by_user_id: str,
    ) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO "AppointmentStatusHistory" (
                  "id",
                  "appointmentId",
                  "oldStatus",
                  "newStatus",
                  "changedByUserId",
                  "createdAt"
                )
                VALUES (
                  :id,
                  :appointment_id,
                  :old_status,
                  :new_status,
                  :changed_by_user_id,
                  NOW()
                )
                """,
            ),
            {
                "id": self._generate_id(),
                "appointment_id": appointment_id,
                "old_status": None if old_status is None else old_status.upper(),
                "new_status": new_status.upper(),
                "changed_by_user_id": changed_by_user_id,
            },
        )

    def create_payment(
        self,
        *,
        booking: CheckoutBookingRecord,
        method: str,
        subtotal: float,
        discount: float,
        tax: float,
        tip: float,
        total: float,
        currency: str,
        receipt_number: str,
        card_brand: Optional[str],
        card_last4: Optional[str],
        paid_at: datetime,
    ) -> PaymentListRecord:
        payment_id = self._generate_id()
        self.db.execute(
            text(
                """
                INSERT INTO "Payment" (
                  "id",
                  "appointmentId",
                  "method",
                  "status",
                  "subtotalAmount",
                  "discountAmount",
                  "taxAmount",
                  "tipAmount",
                  "totalAmount",
                  "currency",
                  "receiptNumber",
                  "cardBrand",
                  "cardLast4",
                  "paidAt",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  :id,
                  :appointment_id,
                  :method,
                  'PAID',
                  :subtotal,
                  :discount,
                  :tax,
                  :tip,
                  :total,
                  :currency,
                  :receipt_number,
                  :card_brand,
                  :card_last4,
                  :paid_at,
                  NOW(),
                  NOW()
                )
                """,
            ),
            {
                "id": payment_id,
                "appointment_id": booking.id,
                "method": method.upper(),
                "subtotal": subtotal,
                "discount": discount,
                "tax": tax,
                "tip": tip,
                "total": total,
                "currency": currency,
                "receipt_number": receipt_number,
                "card_brand": card_brand,
                "card_last4": card_last4,
                "paid_at": paid_at,
            },
        )

        return PaymentListRecord(
            id=payment_id,
            booking_id=booking.id,
            customer_id=booking.customer_id,
            owner_id=booking.owner_id,
            business_id=booking.business_id,
            service_id=booking.service_id,
            method=method.lower(),
            status="paid",
            subtotal=subtotal,
            discount=discount,
            tax=tax,
            tip=tip,
            total=total,
            currency=currency,
            receipt_number=receipt_number,
            card_brand=card_brand,
            card_last4=card_last4,
            paid_at=paid_at,
            created_at=paid_at,
        )

    def create_notification(
        self,
        *,
        user_id: str,
        notification_type: str,
        title: str,
        body: Optional[str],
        created_at: datetime,
    ) -> None:
        self.notifications.create_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            created_at=created_at,
        )
