from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.domains.availability.repository import (
    AvailabilityRepository,
    AvailabilitySlotRecord,
)
from app.domains.base import BaseDomainService
from app.schemas.availability import AvailabilitySlotSummary


class AvailabilityService(BaseDomainService):
    def __init__(self, db: Session, settings: Settings) -> None:
        super().__init__(db, settings)
        self.repository = AvailabilityRepository(db)

    def _to_availability_summary(
        self,
        slot: AvailabilitySlotRecord,
    ) -> AvailabilitySlotSummary:
        return AvailabilitySlotSummary(
            id=slot.id,
            business_id=slot.business_id,
            service_id=slot.service_id,
            staff_name=slot.staff_name,
            start_at=self.brain.processing.dates.to_utc_iso(slot.start_at).replace(
                "+00:00",
                "Z",
            ),
            end_at=self.brain.processing.dates.to_utc_iso(slot.end_at).replace(
                "+00:00",
                "Z",
            ),
            is_booked=slot.is_booked,
        )

    def list_availability(
        self,
        business_id: Optional[str],
        service_id: Optional[str],
    ) -> List[AvailabilitySlotSummary]:
        slots = self.repository.list_availability(
            business_id=self.sanitize_text(business_id),
            service_id=self.sanitize_text(service_id),
        )
        return [self._to_availability_summary(slot) for slot in slots]
