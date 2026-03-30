from dataclasses import dataclass
from datetime import datetime
from json import dumps, loads
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.processors import (
    CustomerBookingSignal,
    CustomerFavoriteSignal,
    CustomerPageViewSignal,
)


@dataclass(frozen=True)
class BusinessTargetRecord:
    id: str
    name: str
    category: str


@dataclass(frozen=True)
class OwnerBusinessAudienceAggregate:
    business_id: str
    business_name: str
    unique_viewers: int
    total_page_views: int
    average_dwell_seconds: int
    last_viewed_at: Optional[datetime]


class CustomerInsightsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._page_view_table_ready = False

    def ensure_storage(self) -> None:
        if self._page_view_table_ready:
            return

        self.db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS "CustomerBusinessPageView" (
                  "id" TEXT PRIMARY KEY,
                  "customerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
                  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
                  "selectedServiceId" TEXT NULL,
                  "selectedServiceName" TEXT NULL,
                  "note" TEXT NULL,
                  "dwellSeconds" INTEGER NOT NULL,
                  "colorSignals" TEXT NULL,
                  "source" TEXT NOT NULL DEFAULT 'mobile_salon_detail',
                  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """,
            ),
        )
        self.db.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS "CustomerBusinessPageView_customer_created_idx"
                ON "CustomerBusinessPageView" ("customerId", "createdAt" DESC)
                """,
            ),
        )
        self.db.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS "CustomerBusinessPageView_business_created_idx"
                ON "CustomerBusinessPageView" ("businessId", "createdAt" DESC)
                """,
            ),
        )
        self.db.commit()
        self._page_view_table_ready = True

    def get_business_target(self, business_id: str) -> Optional[BusinessTargetRecord]:
        row = self.db.execute(
            text(
                """
                SELECT "id", "name", LOWER(CAST("category" AS TEXT)) AS "category"
                FROM "Business"
                WHERE "id" = :business_id
                LIMIT 1
                """,
            ),
            {"business_id": business_id},
        ).mappings().first()

        if row is None:
            return None

        return BusinessTargetRecord(
            id=str(row["id"]),
            name=str(row["name"]),
            category=str(row["category"]),
        )

    def record_business_page_view(
        self,
        *,
        customer_id: str,
        business_id: str,
        selected_service_id: Optional[str],
        selected_service_name: Optional[str],
        note: Optional[str],
        dwell_seconds: int,
        color_signals: List[str],
        source: str,
    ) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO "CustomerBusinessPageView" (
                  "id",
                  "customerId",
                  "businessId",
                  "selectedServiceId",
                  "selectedServiceName",
                  "note",
                  "dwellSeconds",
                  "colorSignals",
                  "source",
                  "createdAt"
                )
                VALUES (
                  :id,
                  :customer_id,
                  :business_id,
                  :selected_service_id,
                  :selected_service_name,
                  :note,
                  :dwell_seconds,
                  :color_signals,
                  :source,
                  NOW()
                )
                """,
            ),
            {
                "id": uuid4().hex,
                "customer_id": customer_id,
                "business_id": business_id,
                "selected_service_id": selected_service_id,
                "selected_service_name": selected_service_name,
                "note": note,
                "dwell_seconds": int(dwell_seconds),
                "color_signals": dumps(color_signals),
                "source": source,
            },
        )

    def list_page_views(self) -> List[CustomerPageViewSignal]:
        rows = self.db.execute(
            text(
                """
                SELECT
                  page_view."customerId",
                  customer."fullName" AS "customerName",
                  customer."email" AS "customerEmail",
                  page_view."businessId",
                  business."name" AS "businessName",
                  LOWER(CAST(business."category" AS TEXT)) AS "businessCategory",
                  page_view."selectedServiceName",
                  page_view."dwellSeconds",
                  page_view."note",
                  page_view."colorSignals",
                  page_view."createdAt"
                FROM "CustomerBusinessPageView" AS page_view
                INNER JOIN "User" AS customer
                  ON customer."id" = page_view."customerId"
                INNER JOIN "Business" AS business
                  ON business."id" = page_view."businessId"
                ORDER BY page_view."createdAt" DESC
                LIMIT 2000
                """,
            ),
        ).mappings()

        signals: list[CustomerPageViewSignal] = []
        for row in rows:
            raw_color_signals = row["colorSignals"]
            color_signals = loads(raw_color_signals) if raw_color_signals else []
            signals.append(
                CustomerPageViewSignal(
                    customer_id=str(row["customerId"]),
                    customer_name=str(row["customerName"]),
                    customer_email=str(row["customerEmail"]),
                    business_id=str(row["businessId"]),
                    business_name=str(row["businessName"]),
                    business_category=str(row["businessCategory"]),
                    selected_service_name=(
                        None
                        if row["selectedServiceName"] is None
                        else str(row["selectedServiceName"])
                    ),
                    dwell_seconds=int(row["dwellSeconds"]),
                    note=None if row["note"] is None else str(row["note"]),
                    color_signals=tuple(str(value) for value in color_signals),
                    created_at=row["createdAt"],
                ),
            )
        return signals

    def list_favorite_signals(self) -> List[CustomerFavoriteSignal]:
        rows = self.db.execute(
            text(
                """
                SELECT
                  favorite."customerId",
                  customer."fullName" AS "customerName",
                  customer."email" AS "customerEmail",
                  favorite."businessId",
                  business."name" AS "businessName",
                  LOWER(CAST(business."category" AS TEXT)) AS "businessCategory",
                  favorite."createdAt"
                FROM "Favorite" AS favorite
                INNER JOIN "User" AS customer
                  ON customer."id" = favorite."customerId"
                INNER JOIN "Business" AS business
                  ON business."id" = favorite."businessId"
                ORDER BY favorite."createdAt" DESC
                """,
            ),
        ).mappings()

        return [
            CustomerFavoriteSignal(
                customer_id=str(row["customerId"]),
                customer_name=str(row["customerName"]),
                customer_email=str(row["customerEmail"]),
                business_id=str(row["businessId"]),
                business_name=str(row["businessName"]),
                business_category=str(row["businessCategory"]),
                created_at=row["createdAt"],
            )
            for row in rows
        ]

    def list_booking_signals(self) -> List[CustomerBookingSignal]:
        rows = self.db.execute(
            text(
                """
                SELECT
                  appointment."customerId",
                  customer."fullName" AS "customerName",
                  customer."email" AS "customerEmail",
                  appointment."businessId",
                  business."name" AS "businessName",
                  LOWER(CAST(business."category" AS TEXT)) AS "businessCategory",
                  service."name" AS "serviceName",
                  appointment."notes",
                  appointment."createdAt"
                FROM "Appointment" AS appointment
                INNER JOIN "User" AS customer
                  ON customer."id" = appointment."customerId"
                INNER JOIN "Business" AS business
                  ON business."id" = appointment."businessId"
                INNER JOIN "Service" AS service
                  ON service."id" = appointment."serviceId"
                ORDER BY appointment."createdAt" DESC
                LIMIT 2000
                """,
            ),
        ).mappings()

        return [
            CustomerBookingSignal(
                customer_id=str(row["customerId"]),
                customer_name=str(row["customerName"]),
                customer_email=str(row["customerEmail"]),
                business_id=str(row["businessId"]),
                business_name=str(row["businessName"]),
                business_category=str(row["businessCategory"]),
                service_name=str(row["serviceName"]),
                note=None if row["notes"] is None else str(row["notes"]),
                created_at=row["createdAt"],
            )
            for row in rows
        ]

    def list_owner_business_audience(
        self,
        owner_user_id: str,
    ) -> List[OwnerBusinessAudienceAggregate]:
        rows = self.db.execute(
            text(
                """
                SELECT
                  business."id" AS "businessId",
                  business."name" AS "businessName",
                  COUNT(*)::INTEGER AS "totalPageViews",
                  COUNT(DISTINCT page_view."customerId")::INTEGER AS "uniqueViewers",
                  COALESCE(ROUND(AVG(page_view."dwellSeconds")), 0)::INTEGER AS "averageDwellSeconds",
                  MAX(page_view."createdAt") AS "lastViewedAt"
                FROM "CustomerBusinessPageView" AS page_view
                INNER JOIN "Business" AS business
                  ON business."id" = page_view."businessId"
                WHERE business."ownerUserId" = :owner_user_id
                GROUP BY business."id", business."name"
                ORDER BY COUNT(*) DESC, COUNT(DISTINCT page_view."customerId") DESC, business."name" ASC
                """,
            ),
            {"owner_user_id": owner_user_id},
        ).mappings()

        return [
            OwnerBusinessAudienceAggregate(
                business_id=str(row["businessId"]),
                business_name=str(row["businessName"]),
                unique_viewers=int(row["uniqueViewers"]),
                total_page_views=int(row["totalPageViews"]),
                average_dwell_seconds=int(row["averageDwellSeconds"]),
                last_viewed_at=row["lastViewedAt"],
            )
            for row in rows
        ]

    def count_owner_unique_viewers(self, owner_user_id: str) -> int:
        row = self.db.execute(
            text(
                """
                SELECT COUNT(DISTINCT page_view."customerId")::INTEGER AS "uniqueViewers"
                FROM "CustomerBusinessPageView" AS page_view
                INNER JOIN "Business" AS business
                  ON business."id" = page_view."businessId"
                WHERE business."ownerUserId" = :owner_user_id
                """,
            ),
            {"owner_user_id": owner_user_id},
        ).mappings().one()

        return int(row["uniqueViewers"])
