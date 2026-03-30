from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domains.notifications.repository import NotificationsRepository


@dataclass
class BusinessCatalogRecord:
    id: str
    owner_id: str
    category: str
    name: str
    featured_on_homepage: bool
    homepage_rank: int
    address_line1: str
    address_line2: Optional[str]
    city: str
    state: str
    postal_code: str
    latitude: Optional[float]
    longitude: Optional[float]
    rating: float
    review_count: int
    hero_image: str
    description: str
    services: List[Dict[str, object]] = field(default_factory=list)


@dataclass
class OwnerBusinessRecord(BusinessCatalogRecord):
    status: str = "draft"
    business_logo: Optional[str] = None
    business_banner: Optional[str] = None
    owner_avatar: Optional[str] = None
    gallery_images: List[str] = field(default_factory=list)
    video_url: Optional[str] = None
    staff: List[Dict[str, object]] = field(default_factory=list)
    promotion: Optional[Dict[str, object]] = None


@dataclass(frozen=True)
class OwnerBusinessTarget:
    id: str
    name: str
    owner_id: str


@dataclass
class OwnerTechnicianRecord:
    id: str
    business_id: str
    business_name: str
    business_category: str
    business_status: str
    name: str
    title: Optional[str]
    avatar_url: Optional[str]
    is_active: bool


class BusinessesRepository:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationsRepository(db)
        self._profile_media_storage_ready = False

    def _generate_id(self) -> str:
        return uuid4().hex

    def ensure_profile_media_storage(self) -> None:
        if self._profile_media_storage_ready:
            return

        self.db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS "BusinessProfileMedia" (
                  "businessId" TEXT PRIMARY KEY REFERENCES "Business"("id") ON DELETE CASCADE,
                  "businessLogoUrl" TEXT NULL,
                  "businessBannerUrl" TEXT NULL,
                  "ownerAvatarUrl" TEXT NULL,
                  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """,
            ),
        )
        self.db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS "StaffProfileMedia" (
                  "staffId" TEXT PRIMARY KEY REFERENCES "Staff"("id") ON DELETE CASCADE,
                  "avatarUrl" TEXT NULL,
                  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """,
            ),
        )
        self.db.commit()
        self._profile_media_storage_ready = True

    def _to_float(self, value) -> Optional[float]:
        if value is None:
            return None
        return float(value)

    def _build_where_clause(
        self,
        *,
        category: Optional[str],
        city: Optional[str],
        search_terms: List[str],
    ) -> tuple[str, Dict[str, object]]:
        conditions = ['business."status" = \'APPROVED\'']
        params: Dict[str, object] = {}

        if category:
            conditions.append('business."category" = :category')
            params["category"] = category.upper()

        if city:
            conditions.append('LOWER(business."city") = :city')
            params["city"] = city.lower()

        for index, term in enumerate(search_terms):
            param_name = f"term_{index}"
            params[param_name] = f"%{term.lower()}%"
            conditions.append(
                f"""
                (
                  LOWER(business."name") LIKE :{param_name}
                  OR LOWER(COALESCE(business."description", '')) LIKE :{param_name}
                  OR LOWER(business."city") LIKE :{param_name}
                  OR LOWER(business."addressLine1") LIKE :{param_name}
                  OR EXISTS (
                    SELECT 1
                    FROM "Service" AS service_search
                    WHERE service_search."businessId" = business."id"
                      AND service_search."isActive" = TRUE
                      AND (
                        LOWER(service_search."name") LIKE :{param_name}
                        OR LOWER(COALESCE(service_search."description", '')) LIKE :{param_name}
                      )
                  )
                )
                """,
            )

        return " AND ".join(conditions), params

    def _to_business_record(self, row) -> BusinessCatalogRecord:
        return BusinessCatalogRecord(
            id=str(row["id"]),
            owner_id=str(row["ownerUserId"]),
            category=str(row["category"]).lower(),
            name=str(row["name"]),
            featured_on_homepage=bool(row["featuredOnHomepage"]),
            homepage_rank=int(row["homepageRank"]),
            address_line1=str(row["addressLine1"]),
            address_line2=None if row["addressLine2"] is None else str(row["addressLine2"]),
            city=str(row["city"]),
            state=str(row["state"]),
            postal_code=str(row["postalCode"]),
            latitude=self._to_float(row["latitude"]),
            longitude=self._to_float(row["longitude"]),
            rating=float(row["rating"]),
            review_count=int(row["reviewCount"]),
            hero_image=(
                str(row["heroImage"])
                if row["heroImage"] is not None
                else ("" if row["firstImageUrl"] is None else str(row["firstImageUrl"]))
            ),
            description="" if row["description"] is None else str(row["description"]),
        )

    def _attach_services(self, businesses: List[BusinessCatalogRecord]) -> None:
        if not businesses:
            return

        business_ids = [business.id for business in businesses]
        rows = self.db.execute(
            text(
                """
                SELECT "id", "businessId", "name", "durationMinutes", "price"
                FROM "Service"
                WHERE "businessId" = ANY(:business_ids)
                  AND "isActive" = TRUE
                ORDER BY "businessId" ASC, "createdAt" ASC
                """,
            ),
            {"business_ids": business_ids},
        ).mappings()

        services_by_business: Dict[str, List[Dict[str, object]]] = {
            business.id: [] for business in businesses
        }
        for row in rows:
            services_by_business[str(row["businessId"])].append(
                {
                    "id": str(row["id"]),
                    "name": str(row["name"]),
                    "durationMinutes": int(row["durationMinutes"]),
                    "price": float(row["price"]),
                },
            )

        for business in businesses:
            business.services = services_by_business.get(business.id, [])

    def _attach_owner_services(self, businesses: List[OwnerBusinessRecord]) -> None:
        if not businesses:
            return

        business_ids = [business.id for business in businesses]
        rows = self.db.execute(
            text(
                """
                SELECT "id", "businessId", "name", "description", "durationMinutes", "price", "isActive"
                FROM "Service"
                WHERE "businessId" = ANY(:business_ids)
                ORDER BY "createdAt" ASC
                """,
            ),
            {"business_ids": business_ids},
        ).mappings()

        services_by_business: Dict[str, List[Dict[str, object]]] = {
            business.id: [] for business in businesses
        }
        for row in rows:
            services_by_business[str(row["businessId"])].append(
                {
                    "id": str(row["id"]),
                    "businessId": str(row["businessId"]),
                    "name": str(row["name"]),
                    "description": (
                        None if row["description"] is None else str(row["description"])
                    ),
                    "durationMinutes": int(row["durationMinutes"]),
                    "price": float(row["price"]),
                    "isActive": bool(row["isActive"]),
                },
            )

        for business in businesses:
            business.services = sorted(
                services_by_business.get(business.id, []),
                key=lambda service: int(not bool(service["isActive"])),
            )

    def _attach_owner_media(self, businesses: List[OwnerBusinessRecord]) -> None:
        if not businesses:
            return

        business_ids = [business.id for business in businesses]
        rows = self.db.execute(
            text(
                """
                SELECT "businessId", "url"
                FROM "BusinessImage"
                WHERE "businessId" = ANY(:business_ids)
                ORDER BY "sortOrder" ASC
                """,
            ),
            {"business_ids": business_ids},
        ).mappings()

        images_by_business: Dict[str, List[str]] = {business.id: [] for business in businesses}
        for row in rows:
            images_by_business[str(row["businessId"])].append(str(row["url"]))

        for business in businesses:
            business.gallery_images = images_by_business.get(business.id, [])
            if not business.hero_image and business.gallery_images:
                business.hero_image = business.gallery_images[0]

    def _attach_owner_profile_media(self, businesses: List[OwnerBusinessRecord]) -> None:
        if not businesses:
            return

        self.ensure_profile_media_storage()
        business_ids = [business.id for business in businesses]
        rows = self.db.execute(
            text(
                """
                SELECT
                  "businessId",
                  "businessLogoUrl",
                  "businessBannerUrl",
                  "ownerAvatarUrl"
                FROM "BusinessProfileMedia"
                WHERE "businessId" = ANY(:business_ids)
                """,
            ),
            {"business_ids": business_ids},
        ).mappings()

        media_by_business = {
            str(row["businessId"]): row
            for row in rows
        }

        for business in businesses:
            media = media_by_business.get(business.id)
            if not media:
                continue
            business.business_logo = (
                None if media["businessLogoUrl"] is None else str(media["businessLogoUrl"])
            )
            business.business_banner = (
                None if media["businessBannerUrl"] is None else str(media["businessBannerUrl"])
            )
            business.owner_avatar = (
                None if media["ownerAvatarUrl"] is None else str(media["ownerAvatarUrl"])
            )

    def _attach_owner_staff(self, businesses: List[OwnerBusinessRecord]) -> None:
        if not businesses:
            return

        business_ids = [business.id for business in businesses]
        rows = self.db.execute(
            text(
                """
                SELECT "id", "businessId", "name", "title", "isActive"
                FROM "Staff"
                WHERE "businessId" = ANY(:business_ids)
                ORDER BY "createdAt" ASC
                """,
            ),
            {"business_ids": business_ids},
        ).mappings()

        staff_by_business: Dict[str, List[Dict[str, object]]] = {business.id: [] for business in businesses}
        self.ensure_profile_media_storage()
        avatar_by_staff: Dict[str, Optional[str]] = {}
        staff_ids = [str(row["id"]) for row in rows]
        if staff_ids:
            avatar_rows = self.db.execute(
                text(
                    """
                    SELECT "staffId", "avatarUrl"
                    FROM "StaffProfileMedia"
                    WHERE "staffId" = ANY(:staff_ids)
                    """,
                ),
                {"staff_ids": staff_ids},
            ).mappings()
            avatar_by_staff = {
                str(row["staffId"]): None if row["avatarUrl"] is None else str(row["avatarUrl"])
                for row in avatar_rows
            }
        for row in rows:
            staff_by_business[str(row["businessId"])].append(
                {
                    "id": str(row["id"]),
                    "businessId": str(row["businessId"]),
                    "name": str(row["name"]),
                    "title": None if row["title"] is None else str(row["title"]),
                    "avatarUrl": avatar_by_staff.get(str(row["id"])),
                    "isActive": bool(row["isActive"]),
                },
            )

        for business in businesses:
            business.staff = sorted(
                staff_by_business.get(business.id, []),
                key=lambda member: int(not bool(member["isActive"])),
            )

    def _to_owner_business_record(self, row) -> OwnerBusinessRecord:
        promotion = None
        if row["promotionTitle"] is not None and row["promotionDiscountPercent"] is not None:
            promotion = {
                "title": str(row["promotionTitle"]),
                "description": (
                    None
                    if row["promotionDescription"] is None
                    else str(row["promotionDescription"])
                ),
                "discountPercent": int(row["promotionDiscountPercent"]),
                "code": None if row["promotionCode"] is None else str(row["promotionCode"]),
                "expiresAt": (
                    None
                    if row["promotionExpiresAt"] is None
                    else row["promotionExpiresAt"].isoformat().replace("+00:00", "Z")
                ),
            }

        return OwnerBusinessRecord(
            id=str(row["id"]),
            owner_id=str(row["ownerUserId"]),
            category=str(row["category"]).lower(),
            name=str(row["name"]),
            featured_on_homepage=bool(row["featuredOnHomepage"]),
            homepage_rank=int(row["homepageRank"]),
            address_line1=str(row["addressLine1"]),
            address_line2=None if row["addressLine2"] is None else str(row["addressLine2"]),
            city=str(row["city"]),
            state=str(row["state"]),
            postal_code=str(row["postalCode"]),
            latitude=self._to_float(row["latitude"]),
            longitude=self._to_float(row["longitude"]),
            rating=float(row["rating"]),
            review_count=int(row["reviewCount"]),
            hero_image=(
                str(row["heroImage"])
                if row["heroImage"] is not None
                else ("" if row["firstImageUrl"] is None else str(row["firstImageUrl"]))
            ),
            description="" if row["description"] is None else str(row["description"]),
            status=str(row["status"]).lower(),
            business_logo=None,
            business_banner=None,
            owner_avatar=None,
            video_url=None if row["videoUrl"] is None else str(row["videoUrl"]),
            promotion=promotion,
        )

    def _fetch_businesses(
        self,
        *,
        where_clause: str,
        params: Dict[str, object],
    ) -> List[BusinessCatalogRecord]:
        rows = self.db.execute(
            text(
                f"""
                SELECT
                  business."id",
                  business."ownerUserId",
                  business."category",
                  business."name",
                  business."featuredOnHomepage",
                  business."homepageRank",
                  business."addressLine1",
                  business."addressLine2",
                  business."city",
                  business."state",
                  business."postalCode",
                  business."latitude",
                  business."longitude",
                  business."rating",
                  business."reviewCount",
                  business."heroImage",
                  business."description",
                  (
                    SELECT image."url"
                    FROM "BusinessImage" AS image
                    WHERE image."businessId" = business."id"
                    ORDER BY image."sortOrder" ASC
                    LIMIT 1
                  ) AS "firstImageUrl"
                FROM "Business" AS business
                WHERE {where_clause}
                ORDER BY
                  business."featuredOnHomepage" DESC,
                  business."homepageRank" ASC,
                  business."rating" DESC,
                  business."reviewCount" DESC,
                  business."name" ASC
                """,
            ),
            params,
        ).mappings()

        businesses = [self._to_business_record(row) for row in rows]
        self._attach_services(businesses)
        return businesses

    def list_businesses(
        self,
        *,
        category: Optional[str],
        city: Optional[str],
        search_terms: List[str],
    ) -> List[BusinessCatalogRecord]:
        where_clause, params = self._build_where_clause(
            category=category,
            city=city,
            search_terms=search_terms,
        )
        return self._fetch_businesses(where_clause=where_clause, params=params)

    def get_business(self, business_id: str) -> Optional[BusinessCatalogRecord]:
        businesses = self._fetch_businesses(
            where_clause='business."status" = \'APPROVED\' AND business."id" = :business_id',
            params={"business_id": business_id},
        )
        return businesses[0] if businesses else None

    def get_businesses_by_ids(
        self,
        business_ids: List[str],
        *,
        approved_only: bool = False,
    ) -> List[BusinessCatalogRecord]:
        if not business_ids:
            return []

        where_clause = 'business."id" = ANY(:business_ids)'
        if approved_only:
            where_clause = f'{where_clause} AND business."status" = \'APPROVED\''

        return self._fetch_businesses(
            where_clause=where_clause,
            params={"business_ids": business_ids},
        )

    def list_owner_businesses(self, owner_id: str) -> List[OwnerBusinessRecord]:
        return self._fetch_owner_businesses(
            where_clause='business."ownerUserId" = :owner_id',
            params={"owner_id": owner_id},
        )

    def _fetch_owner_businesses(
        self,
        *,
        where_clause: str,
        params: Dict[str, object],
    ) -> List[OwnerBusinessRecord]:
        rows = self.db.execute(
            text(
                """
                SELECT
                  business."id",
                  business."ownerUserId",
                  business."category",
                  business."status",
                  business."name",
                  business."featuredOnHomepage",
                  business."homepageRank",
                  business."addressLine1",
                  business."addressLine2",
                  business."city",
                  business."state",
                  business."postalCode",
                  business."latitude",
                  business."longitude",
                  business."rating",
                  business."reviewCount",
                  business."heroImage",
                  business."description",
                  business."videoUrl",
                  business."promotionTitle",
                  business."promotionDescription",
                  business."promotionDiscountPercent",
                  business."promotionCode",
                  business."promotionExpiresAt",
                  (
                    SELECT image."url"
                    FROM "BusinessImage" AS image
                    WHERE image."businessId" = business."id"
                    ORDER BY image."sortOrder" ASC
                    LIMIT 1
                  ) AS "firstImageUrl"
                FROM "Business" AS business
                WHERE """
                + where_clause
                + """
                ORDER BY business."createdAt" DESC
                """,
            ),
            params,
        ).mappings()

        businesses = [self._to_owner_business_record(row) for row in rows]
        self._attach_owner_services(businesses)
        self._attach_owner_media(businesses)
        self._attach_owner_profile_media(businesses)
        self._attach_owner_staff(businesses)
        return businesses

    def get_owner_business_by_id(self, business_id: str) -> Optional[OwnerBusinessRecord]:
        businesses = self._fetch_owner_businesses(
            where_clause='business."id" = :business_id',
            params={"business_id": business_id},
        )
        return businesses[0] if businesses else None

    def get_owner_business_target(self, business_id: str) -> Optional[OwnerBusinessTarget]:
        row = self.db.execute(
            text(
                """
                SELECT "id", "name", "ownerUserId"
                FROM "Business"
                WHERE "id" = :business_id
                LIMIT 1
                """,
            ),
            {"business_id": business_id},
        ).mappings().first()

        if row is None:
            return None

        return OwnerBusinessTarget(
            id=str(row["id"]),
            name=str(row["name"]),
            owner_id=str(row["ownerUserId"]),
        )

    def list_business_technicians(self, business_id: str) -> List[OwnerTechnicianRecord]:
        self.ensure_profile_media_storage()
        rows = self.db.execute(
            text(
                """
                SELECT
                  staff."id",
                  staff."businessId",
                  staff."name",
                  staff."title",
                  staff."isActive",
                  business."name" AS "businessName",
                  LOWER(CAST(business."category" AS TEXT)) AS "businessCategory",
                  LOWER(CAST(business."status" AS TEXT)) AS "businessStatus"
                FROM "Staff" AS staff
                INNER JOIN "Business" AS business
                  ON business."id" = staff."businessId"
                WHERE staff."businessId" = :business_id
                ORDER BY staff."isActive" DESC, staff."createdAt" ASC
                """,
            ),
            {"business_id": business_id},
        ).mappings()

        staff_ids = [str(row["id"]) for row in rows]
        avatar_by_staff: Dict[str, Optional[str]] = {}
        if staff_ids:
            avatar_rows = self.db.execute(
                text(
                    """
                    SELECT "staffId", "avatarUrl"
                    FROM "StaffProfileMedia"
                    WHERE "staffId" = ANY(:staff_ids)
                    """,
                ),
                {"staff_ids": staff_ids},
            ).mappings()
            avatar_by_staff = {
                str(row["staffId"]): None if row["avatarUrl"] is None else str(row["avatarUrl"])
                for row in avatar_rows
            }

        return [
            OwnerTechnicianRecord(
                id=str(row["id"]),
                business_id=str(row["businessId"]),
                business_name=str(row["businessName"]),
                business_category=str(row["businessCategory"]),
                business_status=str(row["businessStatus"]),
                name=str(row["name"]),
                title=None if row["title"] is None else str(row["title"]),
                avatar_url=avatar_by_staff.get(str(row["id"])),
                is_active=bool(row["isActive"]),
            )
            for row in rows
        ]

    def update_business_profile_media(
        self,
        business_id: str,
        *,
        business_logo_url: Optional[str] = None,
        business_logo_provided: bool = False,
        business_banner_url: Optional[str] = None,
        business_banner_provided: bool = False,
        owner_avatar_url: Optional[str] = None,
        owner_avatar_provided: bool = False,
    ) -> None:
        if not any([business_logo_provided, business_banner_provided, owner_avatar_provided]):
            return

        self.db.execute(
            text(
                """
                INSERT INTO "BusinessProfileMedia" (
                  "businessId",
                  "businessLogoUrl",
                  "businessBannerUrl",
                  "ownerAvatarUrl",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  :business_id,
                  :business_logo_url,
                  :business_banner_url,
                  :owner_avatar_url,
                  NOW(),
                  NOW()
                )
                ON CONFLICT ("businessId")
                DO UPDATE SET
                  "businessLogoUrl" = CASE
                    WHEN :business_logo_provided THEN :business_logo_url
                    ELSE "BusinessProfileMedia"."businessLogoUrl"
                  END,
                  "businessBannerUrl" = CASE
                    WHEN :business_banner_provided THEN :business_banner_url
                    ELSE "BusinessProfileMedia"."businessBannerUrl"
                  END,
                  "ownerAvatarUrl" = CASE
                    WHEN :owner_avatar_provided THEN :owner_avatar_url
                    ELSE "BusinessProfileMedia"."ownerAvatarUrl"
                  END,
                  "updatedAt" = NOW()
                """,
            ),
            {
                "business_id": business_id,
                "business_logo_url": business_logo_url,
                "business_logo_provided": business_logo_provided,
                "business_banner_url": business_banner_url,
                "business_banner_provided": business_banner_provided,
                "owner_avatar_url": owner_avatar_url,
                "owner_avatar_provided": owner_avatar_provided,
            },
        )

    def _upsert_staff_avatar(self, staff_id: str, avatar_url: Optional[str]) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO "StaffProfileMedia" (
                  "staffId",
                  "avatarUrl",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  :staff_id,
                  :avatar_url,
                  NOW(),
                  NOW()
                )
                ON CONFLICT ("staffId")
                DO UPDATE SET
                  "avatarUrl" = :avatar_url,
                  "updatedAt" = NOW()
                """,
            ),
            {
                "staff_id": staff_id,
                "avatar_url": avatar_url,
            },
        )

    def update_business_fields(
        self,
        business_id: str,
        fields: Dict[str, object],
    ) -> None:
        if not fields:
            return

        column_map = {
            "name": '"name"',
            "description": '"description"',
            "heroImage": '"heroImage"',
            "videoUrl": '"videoUrl"',
            "promotionTitle": '"promotionTitle"',
            "promotionDescription": '"promotionDescription"',
            "promotionDiscountPercent": '"promotionDiscountPercent"',
            "promotionCode": '"promotionCode"',
            "promotionExpiresAt": '"promotionExpiresAt"',
        }

        assignments = []
        params: Dict[str, object] = {"business_id": business_id}
        for key, value in fields.items():
            column = column_map.get(key)
            if column is None:
                continue
            assignments.append(f"{column} = :{key}")
            params[key] = value

        if not assignments:
            return

        assignments.append('"updatedAt" = NOW()')
        self.db.execute(
            text(
                f"""
                UPDATE "Business"
                SET {", ".join(assignments)}
                WHERE "id" = :business_id
                """,
            ),
            params,
        )

    def replace_gallery_images(self, business_id: str, image_urls: List[str]) -> None:
        self.db.execute(
            text(
                """
                DELETE FROM "BusinessImage"
                WHERE "businessId" = :business_id
                """,
            ),
            {"business_id": business_id},
        )

        for index, url in enumerate(image_urls):
            self.db.execute(
                text(
                    """
                    INSERT INTO "BusinessImage" (
                      "id",
                      "businessId",
                      "url",
                      "sortOrder",
                      "createdAt"
                    )
                    VALUES (
                      :id,
                      :business_id,
                      :url,
                      :sort_order,
                      NOW()
                    )
                    """,
                ),
                {
                    "id": self._generate_id(),
                    "business_id": business_id,
                    "url": url,
                    "sort_order": index,
                },
            )

    def upsert_owner_service(
        self,
        business_id: str,
        service: Dict[str, object],
    ) -> None:
        if service.get("id"):
            result = self.db.execute(
                text(
                    """
                    UPDATE "Service"
                    SET
                      "name" = :name,
                      "description" = :description,
                      "durationMinutes" = :duration_minutes,
                      "price" = :price,
                      "isActive" = :is_active,
                      "updatedAt" = NOW()
                    WHERE "id" = :id
                      AND "businessId" = :business_id
                    """,
                ),
                {
                    "id": service["id"],
                    "business_id": business_id,
                    "name": service["name"],
                    "description": service["description"],
                    "duration_minutes": service["durationMinutes"],
                    "price": service["price"],
                    "is_active": service["isActive"],
                },
            )
            if result.rowcount:
                return

        self.db.execute(
            text(
                """
                INSERT INTO "Service" (
                  "id",
                  "businessId",
                  "name",
                  "description",
                  "durationMinutes",
                  "price",
                  "isActive",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  :id,
                  :business_id,
                  :name,
                  :description,
                  :duration_minutes,
                  :price,
                  :is_active,
                  NOW(),
                  NOW()
                )
                """,
            ),
            {
                "id": self._generate_id(),
                "business_id": business_id,
                "name": service["name"],
                "description": service["description"],
                "duration_minutes": service["durationMinutes"],
                "price": service["price"],
                "is_active": service["isActive"],
            },
        )

    def upsert_owner_staff(
        self,
        business_id: str,
        staff: Dict[str, object],
    ) -> None:
        if staff.get("id"):
            existing_id = str(staff["id"])
            result = self.db.execute(
                text(
                    """
                    UPDATE "Staff"
                    SET
                      "name" = :name,
                      "title" = :title,
                      "isActive" = :is_active,
                      "updatedAt" = NOW()
                    WHERE "id" = :id
                      AND "businessId" = :business_id
                    """,
                ),
                {
                    "id": existing_id,
                    "business_id": business_id,
                    "name": staff["name"],
                    "title": staff["title"],
                    "is_active": staff["isActive"],
                },
            )
            if result.rowcount:
                self._upsert_staff_avatar(existing_id, staff.get("avatarUrl"))
                return

        created_id = self._generate_id()
        self.db.execute(
            text(
                """
                INSERT INTO "Staff" (
                  "id",
                  "businessId",
                  "name",
                  "title",
                  "isActive",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  :id,
                  :business_id,
                  :name,
                  :title,
                  :is_active,
                  NOW(),
                  NOW()
                )
                """,
            ),
            {
                "id": created_id,
                "business_id": business_id,
                "name": staff["name"],
                "title": staff["title"],
                "is_active": staff["isActive"],
            },
        )
        self._upsert_staff_avatar(created_id, staff.get("avatarUrl"))

    def replace_owner_staff(
        self,
        business_id: str,
        technicians: List[Dict[str, object]],
    ) -> None:
        kept_ids: List[str] = []

        for technician in technicians:
            technician_id = technician.get("id")
            if technician_id:
                existing_id = str(technician_id)
                result = self.db.execute(
                    text(
                        """
                        UPDATE "Staff"
                        SET
                          "name" = :name,
                          "title" = :title,
                          "isActive" = :is_active,
                          "updatedAt" = NOW()
                        WHERE "id" = :id
                          AND "businessId" = :business_id
                        """,
                    ),
                    {
                        "id": existing_id,
                        "business_id": business_id,
                        "name": technician["name"],
                        "title": technician["title"],
                        "is_active": technician["isActive"],
                    },
                )
                if result.rowcount:
                    self._upsert_staff_avatar(existing_id, technician.get("avatarUrl"))
                    kept_ids.append(existing_id)
                    continue

            created_id = self._generate_id()
            self.db.execute(
                text(
                    """
                    INSERT INTO "Staff" (
                      "id",
                      "businessId",
                      "name",
                      "title",
                      "isActive",
                      "createdAt",
                      "updatedAt"
                    )
                    VALUES (
                      :id,
                      :business_id,
                      :name,
                      :title,
                      :is_active,
                      NOW(),
                      NOW()
                    )
                    """,
                ),
                {
                    "id": created_id,
                    "business_id": business_id,
                    "name": technician["name"],
                    "title": technician["title"],
                    "is_active": technician["isActive"],
                },
            )
            self._upsert_staff_avatar(created_id, technician.get("avatarUrl"))
            kept_ids.append(created_id)

        if kept_ids:
            self.db.execute(
                text(
                    """
                    DELETE FROM "Staff"
                    WHERE "businessId" = :business_id
                      AND NOT ("id" = ANY(:kept_ids))
                    """,
                ),
                {
                    "business_id": business_id,
                    "kept_ids": kept_ids,
                },
            )
            return

        self.db.execute(
            text(
                """
                DELETE FROM "Staff"
                WHERE "businessId" = :business_id
                """,
            ),
            {"business_id": business_id},
        )

    def create_owner_dashboard_notification(
        self,
        user_id: str,
        business_name: str,
    ) -> None:
        self.notifications.create_notification(
            user_id=user_id,
            notification_type="system",
            title="Owner dashboard updated",
            body=f"{business_name} profile, pricing, team, or promotion details were updated.",
            created_at=datetime.utcnow(),
        )
