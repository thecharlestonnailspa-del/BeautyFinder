from pydantic import Field

from app.schemas.auth import CamelModel
from app.schemas.businesses import BusinessSummary


class FavoriteRecord(CamelModel):
    user_id: str = Field(alias="userId")
    business_id: str = Field(alias="businessId")
    created_at: str = Field(alias="createdAt")


class FavoriteWithBusiness(FavoriteRecord):
    business: BusinessSummary
