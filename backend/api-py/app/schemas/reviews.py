from typing import List, Optional

from pydantic import Field

from app.schemas.auth import CamelModel


class ReviewRecord(CamelModel):
    id: str
    appointment_id: Optional[str] = Field(default=None, alias="appointmentId")
    business_id: str = Field(alias="businessId")
    customer_id: str = Field(alias="customerId")
    customer_name: str = Field(alias="customerName")
    customer_avatar_url: Optional[str] = Field(default=None, alias="customerAvatarUrl")
    rating: int = Field(ge=1, le=5)
    comment: str = ""
    image_urls: List[str] = Field(default_factory=list, alias="imageUrls")
    created_at: str = Field(alias="createdAt")


class CreateReviewRequest(CamelModel):
    business_id: str = Field(alias="businessId")
    appointment_id: Optional[str] = Field(default=None, alias="appointmentId")
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    image_urls: Optional[List[str]] = Field(default=None, alias="imageUrls", max_length=6)
    customer_avatar_url: Optional[str] = Field(default=None, alias="customerAvatarUrl")
