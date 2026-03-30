from typing import Literal

UserRole = Literal["customer", "owner", "technician", "admin"]
ProfessionalAccountType = Literal["salon_owner", "private_technician"]
UserStatus = Literal["active", "pending", "suspended", "deleted"]
BusinessCategory = Literal["nail", "hair"]
BusinessModerationStatus = Literal[
    "draft",
    "pending_review",
    "approved",
    "rejected",
    "suspended",
]
ReviewModerationStatus = Literal["published", "hidden", "flagged"]
AdminConversationCaseStatus = Literal["open", "watched", "resolved"]
AdminConversationPriority = Literal["normal", "high"]
BookingStatus = Literal["pending", "confirmed", "completed", "cancelled", "no_show"]
NotificationType = Literal[
    "booking_created",
    "booking_confirmed",
    "message_received",
    "payment_receipt",
    "review_received",
    "system",
]
PaymentMethod = Literal["card", "cash"]
PaymentStatus = Literal["paid", "refunded"]
AdPlacement = Literal["homepage_spotlight", "category_boost", "city_boost"]
AdPaymentStatus = Literal["pending_payment", "discounted", "paid", "cancelled"]
