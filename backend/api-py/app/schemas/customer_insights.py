from typing import List, Optional

from pydantic import Field

from app.schemas.auth import CamelModel


class RecordBusinessPageViewRequest(CamelModel):
    selected_service_id: Optional[str] = Field(default=None, alias="selectedServiceId")
    selected_service_name: Optional[str] = Field(default=None, alias="selectedServiceName")
    note: Optional[str] = None
    dwell_seconds: int = Field(alias="dwellSeconds", ge=1, le=7200)
    color_signals: List[str] = Field(default_factory=list, alias="colorSignals", max_length=12)
    source: str = Field(default="mobile_salon_detail", max_length=80)


class RecordBusinessPageViewResponse(CamelModel):
    tracked: bool
    dwell_seconds: int = Field(alias="dwellSeconds")


class PreferenceScore(CamelModel):
    label: str
    score: float


class CustomerPreferenceProfileRecord(CamelModel):
    customer_id: str = Field(alias="customerId")
    customer_name: str = Field(alias="customerName")
    customer_email: str = Field(alias="customerEmail")
    favorite_colors: List[PreferenceScore] = Field(alias="favoriteColors")
    top_services: List[PreferenceScore] = Field(alias="topServices")
    top_categories: List[PreferenceScore] = Field(alias="topCategories")
    preferred_experience: str = Field(alias="preferredExperience")
    average_business_page_dwell_seconds: int = Field(alias="averageBusinessPageDwellSeconds")
    total_business_page_views: int = Field(alias="totalBusinessPageViews")
    total_favorite_businesses: int = Field(alias="totalFavoriteBusinesses")
    total_bookings: int = Field(alias="totalBookings")
    engagement_score: float = Field(alias="engagementScore")
    last_seen_at: Optional[str] = Field(default=None, alias="lastSeenAt")


class CustomerPreferenceReportRecord(CamelModel):
    generated_at: str = Field(alias="generatedAt")
    total_customers: int = Field(alias="totalCustomers")
    total_tracked_page_views: int = Field(alias="totalTrackedPageViews")
    color_trends: List[PreferenceScore] = Field(alias="colorTrends")
    service_trends: List[PreferenceScore] = Field(alias="serviceTrends")
    experience_trends: List[PreferenceScore] = Field(alias="experienceTrends")
    customers: List[CustomerPreferenceProfileRecord]


class OwnerBusinessAudienceRecord(CamelModel):
    business_id: str = Field(alias="businessId")
    business_name: str = Field(alias="businessName")
    unique_viewers: int = Field(alias="uniqueViewers")
    total_page_views: int = Field(alias="totalPageViews")
    average_dwell_seconds: int = Field(alias="averageDwellSeconds")
    last_viewed_at: Optional[str] = Field(default=None, alias="lastViewedAt")


class OwnerAudienceReportRecord(CamelModel):
    generated_at: str = Field(alias="generatedAt")
    total_unique_viewers: int = Field(alias="totalUniqueViewers")
    total_page_views: int = Field(alias="totalPageViews")
    businesses_with_views: int = Field(alias="businessesWithViews")
    businesses: List[OwnerBusinessAudienceRecord]
