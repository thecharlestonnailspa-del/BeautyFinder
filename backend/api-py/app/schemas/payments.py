from typing import Optional

from pydantic import Field

from app.schemas.auth import CamelModel
from app.schemas.common import AdPaymentStatus, AdPlacement, PaymentMethod, PaymentStatus


class PaymentRecord(CamelModel):
    id: str
    booking_id: str = Field(alias="bookingId")
    customer_id: str = Field(alias="customerId")
    owner_id: str = Field(alias="ownerId")
    business_id: str = Field(alias="businessId")
    service_id: str = Field(alias="serviceId")
    method: PaymentMethod
    status: PaymentStatus
    subtotal: float
    discount: float
    tax: float
    tip: float
    total: float
    currency: str
    receipt_number: str = Field(alias="receiptNumber")
    card_brand: Optional[str] = Field(default=None, alias="cardBrand")
    card_last4: Optional[str] = Field(default=None, alias="cardLast4")
    paid_at: str = Field(alias="paidAt")
    created_at: str = Field(alias="createdAt")


class CheckoutPaymentRequest(CamelModel):
    booking_id: str = Field(alias="bookingId", min_length=1)
    method: PaymentMethod
    tip_amount: float = Field(default=0, alias="tipAmount", ge=0, le=500)
    card_brand: Optional[str] = Field(
        default=None,
        alias="cardBrand",
        min_length=1,
        max_length=40,
    )
    card_last4: Optional[str] = Field(
        default=None,
        alias="cardLast4",
        pattern=r"^\d{4}$",
    )


class AdPaymentRecord(CamelModel):
    id: str
    owner_id: str = Field(alias="ownerId")
    business_id: str = Field(alias="businessId")
    business_name: str = Field(alias="businessName")
    campaign_name: str = Field(alias="campaignName")
    placement: AdPlacement
    status: AdPaymentStatus
    start_at: str = Field(alias="startAt")
    end_at: str = Field(alias="endAt")
    duration_days: int = Field(alias="durationDays")
    daily_budget: float = Field(alias="dailyBudget")
    subtotal: float
    discount_percent: Optional[float] = Field(default=None, alias="discountPercent")
    discount_amount: float = Field(alias="discountAmount")
    tax: float
    total: float
    currency: str
    method: Optional[PaymentMethod] = None
    receipt_number: Optional[str] = Field(default=None, alias="receiptNumber")
    card_brand: Optional[str] = Field(default=None, alias="cardBrand")
    card_last4: Optional[str] = Field(default=None, alias="cardLast4")
    note: Optional[str] = None
    discount_note: Optional[str] = Field(default=None, alias="discountNote")
    paid_at: Optional[str] = Field(default=None, alias="paidAt")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class CreateAdPaymentRequest(CamelModel):
    business_id: str = Field(alias="businessId", min_length=1)
    campaign_name: str = Field(alias="campaignName", min_length=3, max_length=80)
    placement: AdPlacement
    start_at: str = Field(alias="startAt", min_length=1)
    end_at: str = Field(alias="endAt", min_length=1)
    daily_budget: float = Field(alias="dailyBudget", ge=10, le=10000)
    note: Optional[str] = Field(default=None, max_length=280)


class CheckoutAdPaymentRequest(CamelModel):
    method: PaymentMethod = "card"
    card_brand: Optional[str] = Field(
        default=None,
        alias="cardBrand",
        min_length=1,
        max_length=40,
    )
    card_last4: Optional[str] = Field(
        default=None,
        alias="cardLast4",
        pattern=r"^\d{4}$",
    )


class UpdateAdPaymentDiscountRequest(CamelModel):
    discount_percent: Optional[float] = Field(
        default=None,
        alias="discountPercent",
        ge=0,
        le=100,
    )
    discount_amount: Optional[float] = Field(
        default=None,
        alias="discountAmount",
        ge=0,
        le=100000,
    )
    note: Optional[str] = Field(default=None, max_length=280)


class AdPricingRecord(CamelModel):
    placement: AdPlacement
    label: str
    daily_price: float = Field(alias="dailyPrice")
    monthly_price: float = Field(alias="monthlyPrice")
    currency: str
    note: Optional[str] = None
    updated_at: str = Field(alias="updatedAt")
    updated_by_user_id: Optional[str] = Field(default=None, alias="updatedByUserId")


class UpdateAdPricingRequest(CamelModel):
    daily_price: float = Field(alias="dailyPrice", ge=0, le=100000)
    monthly_price: float = Field(alias="monthlyPrice", ge=0, le=1000000)
    note: Optional[str] = Field(default=None, max_length=280)
