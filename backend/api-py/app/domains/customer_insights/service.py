from datetime import datetime, timezone
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.processors import CustomerPreferenceProfile, CustomerPreferenceReport, RankedPreference
from app.domains.base import BaseDomainService
from app.domains.customer_insights.repository import (
    CustomerInsightsRepository,
    OwnerBusinessAudienceAggregate,
)
from app.schemas.auth import UserSummary
from app.schemas.customer_insights import (
    CustomerPreferenceProfileRecord,
    CustomerPreferenceReportRecord,
    OwnerAudienceReportRecord,
    OwnerBusinessAudienceRecord,
    PreferenceScore,
    RecordBusinessPageViewRequest,
    RecordBusinessPageViewResponse,
)


class CustomerInsightsService(BaseDomainService):
    def __init__(self, db: Session, settings: Settings) -> None:
        super().__init__(db, settings)
        self.repository = CustomerInsightsRepository(db)

    def _rankings_to_scores(self, rankings: tuple[RankedPreference, ...]) -> List[PreferenceScore]:
        return [
            PreferenceScore(label=ranking.label, score=ranking.score)
            for ranking in rankings
        ]

    def _to_customer_profile_record(
        self,
        profile: CustomerPreferenceProfile,
    ) -> CustomerPreferenceProfileRecord:
        return CustomerPreferenceProfileRecord(
            customer_id=profile.customer_id,
            customer_name=profile.customer_name,
            customer_email=profile.customer_email,
            favorite_colors=self._rankings_to_scores(profile.favorite_colors),
            top_services=self._rankings_to_scores(profile.top_services),
            top_categories=self._rankings_to_scores(profile.top_categories),
            preferred_experience=profile.preferred_experience,
            average_business_page_dwell_seconds=profile.average_business_page_dwell_seconds,
            total_business_page_views=profile.total_business_page_views,
            total_favorite_businesses=profile.total_favorite_businesses,
            total_bookings=profile.total_bookings,
            engagement_score=profile.engagement_score,
            last_seen_at=(
                None
                if profile.last_seen_at is None
                else self.brain.processing.dates.to_utc_iso(profile.last_seen_at).replace(
                    "+00:00",
                    "Z",
                )
            ),
        )

    def _to_report_record(
        self,
        report: CustomerPreferenceReport,
    ) -> CustomerPreferenceReportRecord:
        return CustomerPreferenceReportRecord(
            generated_at=self.brain.processing.dates.to_utc_iso(report.generated_at).replace(
                "+00:00",
                "Z",
            ),
            total_customers=report.total_customers,
            total_tracked_page_views=report.total_tracked_page_views,
            color_trends=self._rankings_to_scores(report.color_trends),
            service_trends=self._rankings_to_scores(report.service_trends),
            experience_trends=self._rankings_to_scores(report.experience_trends),
            customers=[
                self._to_customer_profile_record(customer)
                for customer in report.customers
            ],
        )

    def _to_owner_business_audience_record(
        self,
        business: OwnerBusinessAudienceAggregate,
    ) -> OwnerBusinessAudienceRecord:
        return OwnerBusinessAudienceRecord(
            business_id=business.business_id,
            business_name=business.business_name,
            unique_viewers=business.unique_viewers,
            total_page_views=business.total_page_views,
            average_dwell_seconds=business.average_dwell_seconds,
            last_viewed_at=(
                None
                if business.last_viewed_at is None
                else self.brain.processing.dates.to_utc_iso(business.last_viewed_at).replace(
                    "+00:00",
                    "Z",
                )
            ),
        )

    def record_business_page_view(
        self,
        business_id: str,
        input_data: RecordBusinessPageViewRequest,
        actor: UserSummary,
    ) -> RecordBusinessPageViewResponse:
        if actor.role != "customer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only customers can record browsing behavior",
            )

        business = self.repository.get_business_target(business_id)
        if business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found",
            )

        sanitized_note = self.sanitize_text(input_data.note)
        normalized_source = self.sanitize_text(input_data.source) or "mobile_salon_detail"
        normalized_service_name = self.sanitize_text(input_data.selected_service_name)
        deduped_colors = self.dedupe_ids(
            self.brain.processing.customer_preferences.normalize_color_signals(
                input_data.color_signals,
            ),
        )

        self.repository.ensure_storage()
        with self.db.begin():
            self.repository.record_business_page_view(
                customer_id=actor.id,
                business_id=business.id,
                selected_service_id=self.sanitize_text(input_data.selected_service_id),
                selected_service_name=normalized_service_name,
                note=sanitized_note,
                dwell_seconds=input_data.dwell_seconds,
                color_signals=deduped_colors,
                source=normalized_source,
            )

        return RecordBusinessPageViewResponse(
            tracked=True,
            dwell_seconds=input_data.dwell_seconds,
        )

    def get_admin_report(self, actor: UserSummary) -> CustomerPreferenceReportRecord:
        if not self.is_admin(actor):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this resource",
            )

        self.repository.ensure_storage()
        report = self.brain.processing.customer_preferences.build_preference_report(
            page_views=self.repository.list_page_views(),
            favorites=self.repository.list_favorite_signals(),
            bookings=self.repository.list_booking_signals(),
        )
        return self._to_report_record(report)

    def get_owner_audience_report(self, actor: UserSummary) -> OwnerAudienceReportRecord:
        if actor.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only business owners can view this audience report",
            )

        self.repository.ensure_storage()
        businesses = self.repository.list_owner_business_audience(actor.id)
        total_page_views = sum(business.total_page_views for business in businesses)
        total_unique_viewers = self.repository.count_owner_unique_viewers(actor.id)

        return OwnerAudienceReportRecord(
            generated_at=self.brain.processing.dates.to_utc_iso(
                datetime.now(tz=timezone.utc),
            ).replace("+00:00", "Z"),
            total_unique_viewers=total_unique_viewers,
            total_page_views=total_page_views,
            businesses_with_views=len(businesses),
            businesses=[
                self._to_owner_business_audience_record(business)
                for business in businesses
            ],
        )
