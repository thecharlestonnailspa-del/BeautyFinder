from typing import Optional

from pydantic import Field

from app.schemas.auth import CamelModel
from app.schemas.common import BookingStatus


class BookingRecord(CamelModel):
    id: str
    customer_id: str = Field(alias="customerId")
    owner_id: str = Field(alias="ownerId")
    business_id: str = Field(alias="businessId")
    service_id: str = Field(alias="serviceId")
    service_name: str = Field(alias="serviceName")
    status: BookingStatus
    start_at: str = Field(alias="startAt")
    end_at: str = Field(alias="endAt")
    note: Optional[str] = None


class CreateBookingRequest(CamelModel):
    customer_id: str = Field(alias="customerId", min_length=1)
    owner_id: str = Field(alias="ownerId", min_length=1)
    business_id: str = Field(alias="businessId", min_length=1)
    service_id: str = Field(alias="serviceId", min_length=1)
    service_name: str = Field(alias="serviceName", min_length=1)
    start_at: str = Field(alias="startAt", min_length=1)
    end_at: str = Field(alias="endAt", min_length=1)
    note: Optional[str] = Field(default=None, max_length=500)
