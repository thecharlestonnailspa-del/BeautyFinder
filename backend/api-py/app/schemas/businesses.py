from typing import List, Optional

from pydantic import Field

from app.schemas.auth import CamelModel
from app.schemas.common import BusinessCategory, BusinessModerationStatus


class ServiceSummary(CamelModel):
    id: str
    name: str
    duration_minutes: int = Field(alias="durationMinutes")
    price: float


class OwnerServiceSummary(ServiceSummary):
    business_id: str = Field(alias="businessId")
    description: Optional[str] = None
    is_active: bool = Field(alias="isActive")


class StaffSummary(CamelModel):
    id: str
    business_id: str = Field(alias="businessId")
    name: str
    title: Optional[str] = None
    avatar_url: Optional[str] = Field(default=None, alias="avatarUrl")
    is_active: bool = Field(alias="isActive")


class OwnerTechnicianProfile(StaffSummary):
    business_name: str = Field(alias="businessName")
    business_category: BusinessCategory = Field(alias="businessCategory")
    business_status: BusinessModerationStatus = Field(alias="businessStatus")


class PromotionSummary(CamelModel):
    title: str
    description: Optional[str] = None
    discount_percent: int = Field(alias="discountPercent")
    code: Optional[str] = None
    expires_at: Optional[str] = Field(default=None, alias="expiresAt")


class UpdateOwnerServiceInput(CamelModel):
    id: Optional[str] = None
    name: str
    description: str
    duration_minutes: int = Field(alias="durationMinutes", ge=15, le=480)
    price: float = Field(ge=1, le=5000)
    is_active: bool = Field(alias="isActive")


class UpdateOwnerStaffInput(CamelModel):
    id: Optional[str] = None
    name: str
    title: Optional[str] = None
    avatar_url: Optional[str] = Field(default=None, alias="avatarUrl")
    is_active: bool = Field(alias="isActive")


class UpdateOwnerTechnicianRosterRequest(CamelModel):
    technicians: List[UpdateOwnerStaffInput]


class UpdatePromotionInput(CamelModel):
    title: str
    description: Optional[str] = None
    discount_percent: int = Field(alias="discountPercent", ge=0, le=100)
    code: Optional[str] = None
    expires_at: Optional[str] = Field(default=None, alias="expiresAt")


class UpdateOwnerBusinessRequest(CamelModel):
    name: Optional[str] = None
    description: Optional[str] = None
    hero_image: Optional[str] = Field(default=None, alias="heroImage")
    business_logo: Optional[str] = Field(default=None, alias="businessLogo")
    business_banner: Optional[str] = Field(default=None, alias="businessBanner")
    owner_avatar: Optional[str] = Field(default=None, alias="ownerAvatar")
    gallery_images: Optional[List[str]] = Field(default=None, alias="galleryImages", max_length=12)
    video_url: Optional[str] = Field(default=None, alias="videoUrl")
    promotion: Optional[UpdatePromotionInput] = None
    services: Optional[List[UpdateOwnerServiceInput]] = None
    staff: Optional[List[UpdateOwnerStaffInput]] = None


class UploadOwnerBusinessImageRequest(CamelModel):
    filename: Optional[str] = None
    content_type: Optional[str] = Field(default=None, alias="contentType")
    base64: str


class UploadedOwnerBusinessImage(CamelModel):
    content_type: str = Field(alias="contentType")
    path: str
    size: int


class BusinessSummary(CamelModel):
    id: str
    public_id: Optional[str] = Field(default=None, alias="publicId")
    owner_id: str = Field(alias="ownerId")
    category: BusinessCategory
    name: str
    featured_on_homepage: bool = Field(default=False, alias="featuredOnHomepage")
    homepage_rank: int = Field(default=999, alias="homepageRank")
    address_line1: str = Field(alias="addressLine1")
    address_line2: Optional[str] = Field(default=None, alias="addressLine2")
    city: str
    state: str
    postal_code: str = Field(alias="postalCode")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rating: float = 0.0
    review_count: int = Field(default=0, alias="reviewCount")
    hero_image: str = Field(default="", alias="heroImage")
    description: str = ""
    services: List[ServiceSummary]


class OwnerBusinessProfile(BusinessSummary):
    status: BusinessModerationStatus
    business_logo: Optional[str] = Field(default=None, alias="businessLogo")
    business_banner: Optional[str] = Field(default=None, alias="businessBanner")
    owner_avatar: Optional[str] = Field(default=None, alias="ownerAvatar")
    services: List[OwnerServiceSummary]
    gallery_images: List[str] = Field(alias="galleryImages")
    video_url: Optional[str] = Field(default=None, alias="videoUrl")
    staff: List[StaffSummary]
    promotion: Optional[PromotionSummary] = None
