from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class AvailabilitySlotRecord:
    id: str
    business_id: str
    service_id: str
    staff_name: str
    start_at: datetime
    end_at: datetime
    is_booked: bool


class AvailabilityRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_availability(
        self,
        *,
        business_id: Optional[str],
        service_id: Optional[str],
    ) -> List[AvailabilitySlotRecord]:
        conditions = []
        params = {}

        if business_id:
            conditions.append('slot."businessId" = :business_id')
            params["business_id"] = business_id

        if service_id:
            conditions.append('slot."serviceId" = :service_id')
            params["service_id"] = service_id

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = self.db.execute(
            text(
                f"""
                SELECT
                  slot."id",
                  slot."businessId",
                  slot."serviceId",
                  staff."name" AS "staffName",
                  slot."startTime",
                  slot."endTime",
                  slot."isBooked"
                FROM "AvailabilitySlot" AS slot
                LEFT JOIN "Staff" AS staff
                  ON staff."id" = slot."staffId"
                {where_clause}
                ORDER BY slot."startTime" ASC
                """,
            ),
            params,
        ).mappings()

        return [
            AvailabilitySlotRecord(
                id=str(row["id"]),
                business_id=str(row["businessId"]),
                service_id="" if row["serviceId"] is None else str(row["serviceId"]),
                staff_name=(
                    "Team Member"
                    if row["staffName"] is None
                    else str(row["staffName"])
                ),
                start_at=row["startTime"],
                end_at=row["endTime"],
                is_booked=bool(row["isBooked"]),
            )
            for row in rows
        ]
