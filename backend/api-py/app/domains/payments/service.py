from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from json import JSONDecodeError, dumps, loads
from math import ceil
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError, ProgrammingError
from sqlalchemy.orm import Session

from app.core.authorization import AuthorizationError
from app.core.config import Settings
from app.domains.base import BaseDomainService
from app.domains.payments.ad_payments_repository import (
    AdPaymentActionRecord,
    AdPaymentBusinessRecord,
    AdPricingActionRecord,
    AdPaymentsRepository,
)
from app.domains.payments.repository import PaymentListRecord, PaymentsRepository
from app.schemas.auth import UserSummary
from app.schemas.common import AdPaymentStatus, UserRole
from app.schemas.payments import (
    AdPaymentRecord,
    AdPricingRecord,
    CheckoutAdPaymentRequest,
    CheckoutPaymentRequest,
    CreateAdPaymentRequest,
    PaymentRecord,
    UpdateAdPricingRequest,
    UpdateAdPaymentDiscountRequest,
)


@dataclass
class AdPaymentState:
    id: str
    owner_id: str
    business_id: str
    business_name: str
    campaign_name: str
    placement: str
    status: str
    start_at: datetime
    end_at: datetime
    duration_days: int
    daily_budget: float
    subtotal: float
    discount_percent: Optional[float]
    discount_amount: float
    tax: float
    total: float
    currency: str
    note: Optional[str]
    discount_note: Optional[str]
    method: Optional[str]
    receipt_number: Optional[str]
    card_brand: Optional[str]
    card_last4: Optional[str]
    paid_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class AdPricingState:
    placement: str
    label: str
    daily_price: float
    monthly_price: float
    currency: str
    note: Optional[str]
    updated_at: datetime
    updated_by_user_id: Optional[str]


class PaymentsService(BaseDomainService):
    _default_ad_pricing = {
        "homepage_spotlight": {
            "label": "Homepage spotlight",
            "dailyPrice": 120.0,
            "monthlyPrice": 3000.0,
        },
        "category_boost": {
            "label": "Category boost",
            "dailyPrice": 90.0,
            "monthlyPrice": 2250.0,
        },
        "city_boost": {
            "label": "City boost",
            "dailyPrice": 75.0,
            "monthlyPrice": 1900.0,
        },
    }

    def __init__(self, db: Session, settings: Settings) -> None:
        super().__init__(db, settings)
        self.repository = PaymentsRepository(db)
        self.ad_repository = AdPaymentsRepository(db)
        self.payment_currency = settings.payment_currency
        self.payment_tax_rate = settings.payment_tax_rate

    def _to_payment_record(self, payment: PaymentListRecord) -> PaymentRecord:
        return PaymentRecord(
            id=payment.id,
            booking_id=payment.booking_id,
            customer_id=payment.customer_id,
            owner_id=payment.owner_id,
            business_id=payment.business_id,
            service_id=payment.service_id,
            method=payment.method,
            status=payment.status,
            subtotal=payment.subtotal,
            discount=payment.discount,
            tax=payment.tax,
            tip=payment.tip,
            total=payment.total,
            currency=payment.currency,
            receipt_number=payment.receipt_number,
            card_brand=payment.card_brand,
            card_last4=payment.card_last4,
            paid_at=self.brain.processing.dates.to_utc_iso(payment.paid_at).replace(
                "+00:00",
                "Z",
            ),
            created_at=self.brain.processing.dates.to_utc_iso(
                payment.created_at,
            ).replace("+00:00", "Z"),
        )

    def _to_ad_pricing_record(self, pricing: AdPricingState) -> AdPricingRecord:
        return AdPricingRecord(
            placement=pricing.placement,
            label=pricing.label,
            daily_price=pricing.daily_price,
            monthly_price=pricing.monthly_price,
            currency=pricing.currency,
            note=pricing.note,
            updated_at=self.brain.processing.dates.to_utc_iso(pricing.updated_at).replace(
                "+00:00",
                "Z",
            ),
            updated_by_user_id=pricing.updated_by_user_id,
        )

    def _round_money(self, value: float) -> float:
        return round(max(0.0, float(value)), 2)

    def _create_receipt_number(self, paid_at: datetime) -> str:
        return f"BF-{paid_at.astimezone(timezone.utc).strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"

    def _is_promotion_active(
        self,
        discount_percent: Optional[int],
        expires_at: Optional[datetime],
    ) -> bool:
        if discount_percent is None or discount_percent <= 0:
            return False
        if expires_at is not None and expires_at.astimezone(timezone.utc) < datetime.now(
            timezone.utc,
        ):
            return False
        return True

    def _raise_if_payments_schema_missing(self, exc: ProgrammingError) -> None:
        message = str(exc)
        if 'relation "Payment" does not exist' in message:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Payments are not configured in this database yet",
            ) from exc

    def _raise_if_payment_insert_conflicts(self, exc: IntegrityError) -> None:
        message = str(exc)
        if (
            'Payment_appointmentId_key' in message
            or '"appointmentId"' in message
            or "appointmentId" in message
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This booking has already been paid",
            ) from exc

    def _require_advertiser_role(self, actor: UserSummary) -> None:
        if actor.role not in {"owner", "admin"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only business owners and admins can manage advertising payments",
            )

    @contextmanager
    def _transaction_scope(self):
        in_transaction = False
        if hasattr(self.db, "in_transaction") and callable(self.db.in_transaction):
            in_transaction = bool(self.db.in_transaction())
        if not in_transaction:
            transaction = self.db.begin()
            with transaction:
                yield
            return

        try:
            yield
            if hasattr(self.db, "commit") and callable(self.db.commit):
                self.db.commit()
        except Exception:
            if hasattr(self.db, "rollback") and callable(self.db.rollback):
                self.db.rollback()
            raise

    def _resolve_ad_owner_scope(
        self,
        actor: UserSummary,
        requested_owner_id: Optional[str],
    ) -> Optional[str]:
        self._require_advertiser_role(actor)
        if actor.role == "owner":
            if requested_owner_id and requested_owner_id != actor.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Owners can only access their own advertising payments",
                )
            return actor.id
        return self.sanitize_text(requested_owner_id)

    def _normalize_ad_schedule(
        self,
        start_at_value: str,
        end_at_value: str,
    ) -> tuple[datetime, datetime, int]:
        start_at = self.parse_timestamp(start_at_value).astimezone(timezone.utc)
        end_at = self.parse_timestamp(end_at_value).astimezone(timezone.utc)
        if end_at <= start_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Advertising campaign end time must be after start time",
            )
        duration_days = max(1, ceil((end_at - start_at).total_seconds() / 86400))
        return start_at, end_at, duration_days

    def _serialize_metadata(self, payload: Dict[str, object]) -> str:
        return dumps(payload)

    def _parse_metadata(self, metadata: Optional[str]) -> Dict[str, object]:
        if not metadata:
            return {}
        try:
            parsed = loads(metadata)
        except JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}

    def _default_pricing_state(self, placement: str) -> AdPricingState:
        defaults = self._default_ad_pricing[placement]
        return AdPricingState(
            placement=placement,
            label=str(defaults["label"]),
            daily_price=float(defaults["dailyPrice"]),
            monthly_price=float(defaults["monthlyPrice"]),
            currency=self.payment_currency,
            note=None,
            updated_at=datetime(2026, 3, 30, 0, 0, tzinfo=timezone.utc),
            updated_by_user_id=None,
        )

    def _optional_float(self, value: object) -> Optional[float]:
        if value is None:
            return None
        return float(value)

    def _calculate_ad_payment_totals(
        self,
        *,
        subtotal: float,
        discount_percent: Optional[float],
        discount_amount: Optional[float],
    ) -> tuple[Optional[float], float, float, float]:
        normalized_subtotal = self._round_money(subtotal)
        normalized_discount_percent = (
            None
            if discount_percent is None or float(discount_percent) <= 0
            else round(min(100.0, max(0.0, float(discount_percent))), 2)
        )
        if normalized_discount_percent is not None:
            computed_discount_amount = normalized_subtotal * (
                normalized_discount_percent / 100
            )
        else:
            computed_discount_amount = float(discount_amount or 0)
        normalized_discount_amount = self._round_money(
            min(normalized_subtotal, computed_discount_amount),
        )
        discounted_subtotal = self._round_money(normalized_subtotal - normalized_discount_amount)
        tax = self._round_money(discounted_subtotal * self.payment_tax_rate)
        total = self._round_money(discounted_subtotal + tax)
        return normalized_discount_percent, normalized_discount_amount, tax, total

    def _build_ad_pricing_state(
        self,
        placement: str,
        actions: List[AdPricingActionRecord],
    ) -> AdPricingState:
        state = self._default_pricing_state(placement)
        for action in actions:
            metadata = self._parse_metadata(action.metadata)
            state = AdPricingState(
                placement=placement,
                label=state.label,
                daily_price=self._round_money(float(metadata.get("dailyPrice", state.daily_price))),
                monthly_price=self._round_money(
                    float(metadata.get("monthlyPrice", state.monthly_price)),
                ),
                currency=str(metadata.get("currency") or state.currency),
                note=None if metadata.get("note") is None else str(metadata.get("note")),
                updated_at=action.created_at,
                updated_by_user_id=action.actor_user_id,
            )
        return state

    def _list_ad_pricing_states(self) -> List[AdPricingState]:
        grouped_actions: Dict[str, List[AdPricingActionRecord]] = {
            placement: [] for placement in self._default_ad_pricing
        }
        for action in self.ad_repository.list_ad_pricing_actions():
            if action.placement in grouped_actions:
                grouped_actions[action.placement].append(action)

        return [
            self._build_ad_pricing_state(placement, grouped_actions[placement])
            for placement in self._default_ad_pricing
        ]

    def _get_ad_pricing_state(self, placement: str) -> AdPricingState:
        actions = [
            action
            for action in self.ad_repository.list_ad_pricing_actions()
            if action.placement == placement
        ]
        return self._build_ad_pricing_state(placement, actions)

    def _to_ad_payment_record(self, payment: AdPaymentState) -> AdPaymentRecord:
        return AdPaymentRecord(
            id=payment.id,
            owner_id=payment.owner_id,
            business_id=payment.business_id,
            business_name=payment.business_name,
            campaign_name=payment.campaign_name,
            placement=payment.placement,
            status=payment.status,
            start_at=self.brain.processing.dates.to_utc_iso(payment.start_at).replace(
                "+00:00",
                "Z",
            ),
            end_at=self.brain.processing.dates.to_utc_iso(payment.end_at).replace(
                "+00:00",
                "Z",
            ),
            duration_days=payment.duration_days,
            daily_budget=payment.daily_budget,
            subtotal=payment.subtotal,
            discount_percent=payment.discount_percent,
            discount_amount=payment.discount_amount,
            tax=payment.tax,
            total=payment.total,
            currency=payment.currency,
            method=payment.method,
            receipt_number=payment.receipt_number,
            card_brand=payment.card_brand,
            card_last4=payment.card_last4,
            note=payment.note,
            discount_note=payment.discount_note,
            paid_at=(
                None
                if payment.paid_at is None
                else self.brain.processing.dates.to_utc_iso(payment.paid_at).replace(
                    "+00:00",
                    "Z",
                )
            ),
            created_at=self.brain.processing.dates.to_utc_iso(payment.created_at).replace(
                "+00:00",
                "Z",
            ),
            updated_at=self.brain.processing.dates.to_utc_iso(payment.updated_at).replace(
                "+00:00",
                "Z",
            ),
        )

    def _build_ad_payment_state(
        self,
        payment_id: str,
        actions: List[AdPaymentActionRecord],
    ) -> Optional[AdPaymentState]:
        if not actions:
            return None

        state: Optional[AdPaymentState] = None
        for action in actions:
            metadata = self._parse_metadata(action.metadata)
            if action.action == "create_ad_payment":
                start_at = self.parse_timestamp(str(metadata["startAt"])).astimezone(
                    timezone.utc,
                )
                end_at = self.parse_timestamp(str(metadata["endAt"])).astimezone(
                    timezone.utc,
                )
                subtotal = self._round_money(float(metadata["subtotal"]))
                discount_percent, discount_amount, tax, total = (
                    self._calculate_ad_payment_totals(
                        subtotal=subtotal,
                        discount_percent=None,
                        discount_amount=None,
                    )
                )
                state = AdPaymentState(
                    id=payment_id,
                    owner_id=str(metadata["ownerId"]),
                    business_id=str(metadata["businessId"]),
                    business_name=str(metadata["businessName"]),
                    campaign_name=str(metadata["campaignName"]),
                    placement=str(metadata["placement"]),
                    status="pending_payment",
                    start_at=start_at,
                    end_at=end_at,
                    duration_days=int(metadata["durationDays"]),
                    daily_budget=self._round_money(float(metadata["dailyBudget"])),
                    subtotal=subtotal,
                    discount_percent=discount_percent,
                    discount_amount=discount_amount,
                    tax=tax,
                    total=total,
                    currency=str(metadata.get("currency") or self.payment_currency),
                    note=None if metadata.get("note") is None else str(metadata["note"]),
                    discount_note=None,
                    method=None,
                    receipt_number=None,
                    card_brand=None,
                    card_last4=None,
                    paid_at=None,
                    created_at=action.created_at,
                    updated_at=action.created_at,
                )
                continue

            if state is None:
                continue

            if action.action == "discount_ad_payment":
                discount_percent = self._optional_float(metadata.get("discountPercent"))
                discount_amount = self._optional_float(metadata.get("discountAmount"))
                (
                    state.discount_percent,
                    state.discount_amount,
                    state.tax,
                    state.total,
                ) = self._calculate_ad_payment_totals(
                    subtotal=state.subtotal,
                    discount_percent=discount_percent,
                    discount_amount=discount_amount,
                )
                state.discount_note = (
                    None if metadata.get("note") is None else str(metadata["note"])
                )
                state.status = (
                    "discounted"
                    if state.discount_amount > 0 or state.discount_percent is not None
                    else "pending_payment"
                )
                state.updated_at = action.created_at
                continue

            if action.action == "checkout_ad_payment":
                paid_at = action.created_at
                if metadata.get("paidAt"):
                    paid_at = self.parse_timestamp(str(metadata["paidAt"])).astimezone(
                        timezone.utc,
                    )
                state.method = str(metadata["method"])
                state.receipt_number = str(metadata["receiptNumber"])
                state.card_brand = (
                    None if metadata.get("cardBrand") is None else str(metadata["cardBrand"])
                )
                state.card_last4 = (
                    None if metadata.get("cardLast4") is None else str(metadata["cardLast4"])
                )
                state.paid_at = paid_at
                state.status = "paid"
                state.updated_at = paid_at
                continue

            if action.action == "cancel_ad_payment":
                state.status = "cancelled"
                state.updated_at = action.created_at

        return state

    def _list_ad_payment_states(self) -> List[AdPaymentState]:
        grouped_actions: Dict[str, List[AdPaymentActionRecord]] = {}
        for action in self.ad_repository.list_ad_payment_actions():
            grouped_actions.setdefault(action.payment_id, []).append(action)

        payments = []
        for payment_id, actions in grouped_actions.items():
            state = self._build_ad_payment_state(payment_id, actions)
            if state is not None:
                payments.append(state)
        return payments

    def _get_ad_payment_state(self, payment_id: str) -> Optional[AdPaymentState]:
        return self._build_ad_payment_state(
            payment_id,
            self.ad_repository.get_ad_payment_actions(payment_id),
        )

    def _ensure_ad_payment_access(
        self,
        actor: UserSummary,
        payment: AdPaymentState,
    ) -> None:
        self._require_advertiser_role(actor)
        if actor.role == "owner" and payment.owner_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Owners can only manage their own advertising payments",
            )

    def _get_ad_business_for_write(
        self,
        actor: UserSummary,
        business_id: str,
    ) -> AdPaymentBusinessRecord:
        business = self.ad_repository.get_business(business_id)
        if business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found",
            )
        if business.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only approved businesses can buy advertising on the platform",
            )
        if actor.role == "owner" and business.owner_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Owners can only buy advertising for their own businesses",
            )
        return business

    def list_payments(
        self,
        actor: UserSummary,
        *,
        requested_user_id: Optional[str],
        requested_role: Optional[UserRole],
    ) -> List[PaymentRecord]:
        try:
            target_user_id = self.resolve_user_scope(actor, requested_user_id)
        except AuthorizationError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access data inside your own account scope",
            ) from exc

        try:
            role = self.resolve_booking_role(actor, requested_role)
        except AuthorizationError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view bookings inside your own role scope",
            ) from exc

        try:
            payments = self.repository.list_payments(target_user_id, role)
        except ProgrammingError as exc:
            self._raise_if_payments_schema_missing(exc)
            raise
        return [self._to_payment_record(payment) for payment in payments]

    def checkout_payment(
        self,
        input_data: CheckoutPaymentRequest,
        actor: UserSummary,
    ) -> PaymentRecord:
        try:
            booking = self.repository.get_checkout_booking(input_data.booking_id)
        except ProgrammingError as exc:
            self._raise_if_payments_schema_missing(exc)
            raise
        if booking is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found",
            )

        if actor.role == "customer" and booking.customer_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Customers can only pay for their own bookings",
            )

        if actor.role == "owner" and booking.owner_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Owners can only manage payments for their own bookings",
            )

        if booking.payment_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This booking has already been paid",
            )

        if booking.status in {"cancelled", "no_show"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cancelled bookings cannot be paid or confirmed",
            )

        discount_percent = (
            booking.promotion_discount_percent
            if self._is_promotion_active(
                booking.promotion_discount_percent,
                booking.promotion_expires_at,
            )
            else 0
        )
        breakdown = self.compute_payment_breakdown(
            subtotal=booking.service_price,
            discount_percent=float(discount_percent or 0),
            tip=input_data.tip_amount,
            tax_rate=self.payment_tax_rate,
        )
        paid_at = datetime.now(timezone.utc)
        receipt_number = self._create_receipt_number(paid_at)
        card_brand = None
        card_last4 = None
        if input_data.method == "card":
            card_brand = (self.sanitize_text(input_data.card_brand) or "VISA").upper()
            card_last4 = input_data.card_last4 or "4242"

        with self._transaction_scope():
            if booking.status == "pending":
                self.repository.update_booking_status(booking.id, "confirmed")
                self.repository.create_status_history(
                    appointment_id=booking.id,
                    old_status="pending",
                    new_status="confirmed",
                    changed_by_user_id=actor.id,
                )

            try:
                payment = self.repository.create_payment(
                    booking=booking,
                    method=input_data.method,
                    subtotal=breakdown.subtotal,
                    discount=breakdown.discount,
                    tax=breakdown.tax,
                    tip=breakdown.tip,
                    total=breakdown.total,
                    currency=self.payment_currency,
                    receipt_number=receipt_number,
                    card_brand=card_brand,
                    card_last4=card_last4,
                    paid_at=paid_at,
                )
            except IntegrityError as exc:
                self._raise_if_payment_insert_conflicts(exc)
                raise
            except ProgrammingError as exc:
                self._raise_if_payments_schema_missing(exc)
                raise
            self.repository.create_notification(
                user_id=booking.customer_id,
                notification_type="payment_receipt",
                title="Payment receipt",
                body=f"{booking.service_name} at {booking.business_name} was paid in full. Receipt {receipt_number}.",
                created_at=paid_at,
            )
            self.repository.create_notification(
                user_id=booking.customer_id,
                notification_type="booking_confirmed",
                title="Booking confirmed",
                body=f"{booking.business_name} confirmed your {booking.service_name} appointment.",
                created_at=paid_at,
            )
            self.repository.create_notification(
                user_id=booking.owner_id,
                notification_type="booking_confirmed",
                title="Booking paid and confirmed",
                body=f"{booking.customer_name} paid for {booking.service_name}.",
                created_at=paid_at,
            )

        return self._to_payment_record(payment)

    def list_ad_payments(
        self,
        actor: UserSummary,
        *,
        requested_owner_id: Optional[str],
        business_id: Optional[str],
        status_filter: Optional[AdPaymentStatus],
    ) -> List[AdPaymentRecord]:
        owner_scope = self._resolve_ad_owner_scope(actor, requested_owner_id)
        normalized_business_id = self.sanitize_text(business_id)
        if normalized_business_id and actor.role == "owner":
            business = self._get_ad_business_for_write(actor, normalized_business_id)
            normalized_business_id = business.id

        payments = self._list_ad_payment_states()
        filtered = []
        for payment in payments:
            if owner_scope and payment.owner_id != owner_scope:
                continue
            if normalized_business_id and payment.business_id != normalized_business_id:
                continue
            if status_filter and payment.status != status_filter:
                continue
            filtered.append(payment)

        ordered = sorted(
            filtered,
            key=lambda payment: (
                -(payment.paid_at or payment.updated_at).timestamp(),
                payment.business_name.lower(),
            ),
        )
        return [self._to_ad_payment_record(payment) for payment in ordered]

    def list_ad_pricing(self, actor: UserSummary) -> List[AdPricingRecord]:
        if not self.is_admin(actor):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can manage advertising pricing",
            )
        return [self._to_ad_pricing_record(item) for item in self._list_ad_pricing_states()]

    def update_ad_pricing(
        self,
        placement: str,
        input_data: UpdateAdPricingRequest,
        actor: UserSummary,
    ) -> AdPricingRecord:
        if not self.is_admin(actor):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can manage advertising pricing",
            )
        if placement not in self._default_ad_pricing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Advertising placement not found",
            )

        note = self.sanitize_text(input_data.note)
        with self._transaction_scope():
            self.ad_repository.append_ad_pricing_action(
                actor_user_id=actor.id,
                placement=placement,
                metadata=self._serialize_metadata(
                    {
                        "dailyPrice": self._round_money(input_data.daily_price),
                        "monthlyPrice": self._round_money(input_data.monthly_price),
                        "currency": self.payment_currency,
                        "note": note,
                    },
                ),
            )

        return self._to_ad_pricing_record(self._get_ad_pricing_state(placement))

    def create_ad_payment(
        self,
        input_data: CreateAdPaymentRequest,
        actor: UserSummary,
    ) -> AdPaymentRecord:
        if not self.is_owner(actor):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only business owners can start advertising purchases",
            )

        business = self._get_ad_business_for_write(actor, input_data.business_id)
        campaign_name = self.sanitize_text(input_data.campaign_name)
        if not campaign_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Campaign name is required",
            )

        start_at, end_at, duration_days = self._normalize_ad_schedule(
            input_data.start_at,
            input_data.end_at,
        )
        payment_id = uuid4().hex
        subtotal = self._round_money(input_data.daily_budget * duration_days)

        with self._transaction_scope():
            self.ad_repository.append_ad_payment_action(
                actor_user_id=actor.id,
                payment_id=payment_id,
                action="create_ad_payment",
                metadata=self._serialize_metadata(
                    {
                        "ownerId": actor.id,
                        "businessId": business.id,
                        "businessName": business.name,
                        "campaignName": campaign_name,
                        "placement": input_data.placement,
                        "startAt": start_at.isoformat(),
                        "endAt": end_at.isoformat(),
                        "durationDays": duration_days,
                        "dailyBudget": self._round_money(input_data.daily_budget),
                        "subtotal": subtotal,
                        "currency": self.payment_currency,
                        "note": self.sanitize_text(input_data.note),
                    },
                ),
            )
            self.ad_repository.create_notification(
                user_id=actor.id,
                notification_type="system",
                title="Advertising draft created",
                body=f"{business.name} advertising draft is ready for payment.",
            )

        payment = self._get_ad_payment_state(payment_id)
        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Advertising payment could not be created",
            )
        return self._to_ad_payment_record(payment)

    def update_ad_payment_discount(
        self,
        payment_id: str,
        input_data: UpdateAdPaymentDiscountRequest,
        actor: UserSummary,
    ) -> AdPaymentRecord:
        if not self.is_admin(actor):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can adjust advertising discounts",
            )

        payment = self._get_ad_payment_state(payment_id)
        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Advertising payment not found",
            )
        if payment.status == "paid":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Paid advertising campaigns cannot be discounted again",
            )

        if (
            input_data.discount_percent is not None
            and input_data.discount_amount is not None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide either discountPercent or discountAmount, not both",
            )

        if (
            input_data.discount_percent is None
            and input_data.discount_amount is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide discountPercent or discountAmount",
            )

        note = self.sanitize_text(input_data.note)
        with self._transaction_scope():
            self.ad_repository.append_ad_payment_action(
                actor_user_id=actor.id,
                payment_id=payment_id,
                action="discount_ad_payment",
                metadata=self._serialize_metadata(
                    {
                        "discountPercent": input_data.discount_percent,
                        "discountAmount": input_data.discount_amount,
                        "note": note,
                    },
                ),
            )
            self.ad_repository.create_notification(
                user_id=payment.owner_id,
                notification_type="system",
                title="Advertising discount updated",
                body=(
                    f"An admin updated the discount for {payment.campaign_name}."
                    if not note
                    else f"An admin updated the discount for {payment.campaign_name}: {note}"
                ),
            )

        updated_payment = self._get_ad_payment_state(payment_id)
        if updated_payment is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Advertising discount update could not be persisted",
            )
        return self._to_ad_payment_record(updated_payment)

    def checkout_ad_payment(
        self,
        payment_id: str,
        input_data: CheckoutAdPaymentRequest,
        actor: UserSummary,
    ) -> AdPaymentRecord:
        payment = self._get_ad_payment_state(payment_id)
        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Advertising payment not found",
            )
        self._ensure_ad_payment_access(actor, payment)
        if payment.status == "paid":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This advertising campaign has already been paid",
            )
        if input_data.method != "card":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Advertising campaigns must be paid by card",
            )

        paid_at = datetime.now(timezone.utc)
        receipt_number = self._create_receipt_number(paid_at)
        card_brand = (self.sanitize_text(input_data.card_brand) or "VISA").upper()
        card_last4 = input_data.card_last4 or "4242"

        with self._transaction_scope():
            self.ad_repository.append_ad_payment_action(
                actor_user_id=actor.id,
                payment_id=payment_id,
                action="checkout_ad_payment",
                metadata=self._serialize_metadata(
                    {
                        "method": input_data.method,
                        "cardBrand": card_brand,
                        "cardLast4": card_last4,
                        "receiptNumber": receipt_number,
                        "paidAt": paid_at.isoformat(),
                    },
                ),
            )
            self.ad_repository.create_notification(
                user_id=payment.owner_id,
                notification_type="payment_receipt",
                title="Advertising payment received",
                body=(
                    f"{payment.campaign_name} for {payment.business_name} was paid. "
                    f"Receipt {receipt_number}."
                ),
            )

        updated_payment = self._get_ad_payment_state(payment_id)
        if updated_payment is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Advertising checkout could not be persisted",
            )
        return self._to_ad_payment_record(updated_payment)
