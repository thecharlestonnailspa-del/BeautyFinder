from typing import List, Optional

from pydantic import Field

from app.schemas.auth import CamelModel
from app.schemas.businesses import BusinessSummary
from app.schemas.common import (
    AdminConversationCaseStatus,
    AdminConversationPriority,
    BusinessCategory,
    BusinessModerationStatus,
    ReviewModerationStatus,
    UserRole,
    UserStatus,
)
from app.schemas.auth import SessionPayload


class AdminOverview(CamelModel):
    users: int
    businesses: int
    active_bookings: int = Field(alias="activeBookings")
    open_conversations: int = Field(alias="openConversations")
    pending_reviews: int = Field(alias="pendingReviews")


class AdminBusinessQueueItem(CamelModel):
    id: str
    public_id: Optional[str] = Field(default=None, alias="publicId")
    owner_id: str = Field(alias="ownerId")
    owner_public_id: Optional[str] = Field(default=None, alias="ownerPublicId")
    owner_name: str = Field(alias="ownerName")
    owner_email: str = Field(alias="ownerEmail")
    category: BusinessCategory
    name: str
    status: BusinessModerationStatus
    featured_on_homepage: bool = Field(alias="featuredOnHomepage")
    homepage_rank: int = Field(alias="homepageRank")
    city: str
    state: str
    created_at: str = Field(alias="createdAt")


class AdminReviewQueueItem(CamelModel):
    id: str
    appointment_id: Optional[str] = Field(default=None, alias="appointmentId")
    business_id: str = Field(alias="businessId")
    business_public_id: Optional[str] = Field(default=None, alias="businessPublicId")
    business_name: str = Field(alias="businessName")
    customer_id: str = Field(alias="customerId")
    customer_public_id: Optional[str] = Field(default=None, alias="customerPublicId")
    customer_name: str = Field(alias="customerName")
    rating: int
    comment: str
    status: ReviewModerationStatus
    created_at: str = Field(alias="createdAt")


class AdminConversationCase(CamelModel):
    id: str
    business_id: str = Field(alias="businessId")
    business_name: str = Field(alias="businessName")
    booking_id: Optional[str] = Field(default=None, alias="bookingId")
    participant_names: List[str] = Field(alias="participantNames")
    last_message: str = Field(alias="lastMessage")
    last_message_at: str = Field(alias="lastMessageAt")
    message_count: int = Field(alias="messageCount")
    priority: AdminConversationPriority
    case_status: AdminConversationCaseStatus = Field(alias="caseStatus")


class AdminActionRecord(CamelModel):
    id: str
    admin_user_id: str = Field(alias="adminUserId")
    admin_name: str = Field(alias="adminName")
    target_type: str = Field(alias="targetType")
    target_id: str = Field(alias="targetId")
    action: str
    metadata: Optional[str] = None
    created_at: str = Field(alias="createdAt")


class AdminAccountSummary(CamelModel):
    id: str
    public_id: Optional[str] = Field(default=None, alias="publicId")
    name: str
    email: str
    phone: Optional[str] = None
    status: UserStatus
    roles: List[UserRole]
    primary_role: UserRole = Field(alias="primaryRole")
    business_count: int = Field(alias="businessCount")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class UpdateAdminAccountRequest(CamelModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[UserStatus] = None


class CreateAdminAccessSessionRequest(CamelModel):
    note: Optional[str] = Field(default=None, max_length=280)


class UpdateHomepageBusinessRequest(CamelModel):
    featured_on_homepage: bool = Field(alias="featuredOnHomepage")
    homepage_rank: int = Field(alias="homepageRank", ge=1)


class UpdateBusinessStatusRequest(CamelModel):
    status: BusinessModerationStatus
    note: Optional[str] = Field(default=None, max_length=280)


class UpdateReviewStatusRequest(CamelModel):
    status: ReviewModerationStatus
    note: Optional[str] = Field(default=None, max_length=280)


class UpdateConversationCaseStatusRequest(CamelModel):
    status: AdminConversationCaseStatus
    note: Optional[str] = Field(default=None, max_length=280)


AdminHomepageBusinesses = List[BusinessSummary]
AdminAccounts = List[AdminAccountSummary]
AdminAccessSession = SessionPayload
