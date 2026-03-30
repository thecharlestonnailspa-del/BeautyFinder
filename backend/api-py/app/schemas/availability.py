from pydantic import Field

from app.schemas.auth import CamelModel


class AvailabilitySlotSummary(CamelModel):
    id: str
    business_id: str = Field(alias="businessId")
    service_id: str = Field(alias="serviceId")
    staff_name: str = Field(alias="staffName")
    start_at: str = Field(alias="startAt")
    end_at: str = Field(alias="endAt")
    is_booked: bool = Field(alias="isBooked")
