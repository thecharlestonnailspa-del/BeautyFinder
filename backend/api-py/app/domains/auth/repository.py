from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domains.notifications.repository import NotificationsRepository


@dataclass(frozen=True)
class AuthUserRecord:
    id: str
    email: str
    password_hash: str
    full_name: str
    phone: Optional[str]
    roles: List[str]
    account_type: Optional[str] = None
    avatar_url: Optional[str] = None


class AuthRepository:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationsRepository(db)
        self._registration_storage_ready = False
        self._registration_storage_exists: Optional[bool] = None
        self._profile_media_storage_ready = False
        self._profile_media_storage_exists: Optional[bool] = None

    def _generate_id(self) -> str:
        return uuid4().hex

    def ensure_registration_storage(self) -> None:
        if self._registration_storage_ready:
            return

        self.db.execute(
            text(
                """
                DO $$
                BEGIN
                  ALTER TYPE "RoleName" ADD VALUE 'TECHNICIAN';
                EXCEPTION
                  WHEN duplicate_object THEN NULL;
                END $$;
                """,
            ),
        )
        self.db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS "ProfessionalRegistration" (
                  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
                  "accountType" TEXT NOT NULL,
                  "verificationStatus" TEXT NOT NULL DEFAULT 'pending_review',
                  "businessId" TEXT NULL REFERENCES "Business"("id") ON DELETE SET NULL,
                  "salonLicenseNumber" TEXT NULL,
                  "businessLicenseNumber" TEXT NULL,
                  "einNumber" TEXT NULL,
                  "identityCardNumber" TEXT NULL,
                  "ssaNumber" TEXT NULL,
                  "stateLicenseNumber" TEXT NULL,
                  "licenseState" TEXT NULL,
                  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """,
            ),
        )
        self.db.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS "ProfessionalRegistration_account_type_idx"
                ON "ProfessionalRegistration" ("accountType", "verificationStatus")
                """,
            ),
        )
        self.db.commit()
        self._registration_storage_ready = True
        self._registration_storage_exists = True

    def registration_storage_exists(self) -> bool:
        if self._registration_storage_ready:
            return True

        if self._registration_storage_exists is not None:
            return self._registration_storage_exists

        row = self.db.execute(
            text(
                """
                SELECT to_regclass(:table_name) AS "tableName"
                """,
            ),
            {"table_name": '"ProfessionalRegistration"'},
        ).mappings().first()
        self._registration_storage_exists = bool(row and row["tableName"] is not None)
        return self._registration_storage_exists

    def ensure_profile_media_storage(self) -> None:
        if self._profile_media_storage_ready:
            return

        self.db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS "UserProfileMedia" (
                  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
                  "avatarUrl" TEXT NULL,
                  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """,
            ),
        )
        self.db.commit()
        self._profile_media_storage_ready = True
        self._profile_media_storage_exists = True

    def profile_media_storage_exists(self) -> bool:
        if self._profile_media_storage_ready:
            return True

        if self._profile_media_storage_exists is not None:
            return self._profile_media_storage_exists

        row = self.db.execute(
            text(
                """
                SELECT to_regclass(:table_name) AS "tableName"
                """,
            ),
            {"table_name": '"UserProfileMedia"'},
        ).mappings().first()
        self._profile_media_storage_exists = bool(row and row["tableName"] is not None)
        return self._profile_media_storage_exists

    def _load_avatar_url(self, user_id: str) -> Optional[str]:
        if not self.profile_media_storage_exists():
            return None

        row = self.db.execute(
            text(
                """
                SELECT "avatarUrl"
                FROM "UserProfileMedia"
                WHERE "userId" = :user_id
                LIMIT 1
                """,
            ),
            {"user_id": user_id},
        ).mappings().first()

        if row is None or row["avatarUrl"] is None:
            return None

        return str(row["avatarUrl"])

    def upsert_user_avatar(self, user_id: str, avatar_url: Optional[str]) -> None:
        self.ensure_profile_media_storage()
        self.db.execute(
            text(
                """
                INSERT INTO "UserProfileMedia" (
                  "userId",
                  "avatarUrl",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  :user_id,
                  :avatar_url,
                  NOW(),
                  NOW()
                )
                ON CONFLICT ("userId")
                DO UPDATE SET
                  "avatarUrl" = :avatar_url,
                  "updatedAt" = NOW()
                """,
            ),
            {
                "user_id": user_id,
                "avatar_url": avatar_url,
            },
        )

    def _load_roles(self, user_id: str) -> List[str]:
        rows = self.db.execute(
            text(
                """
                SELECT "role"
                FROM "UserRole"
                WHERE "userId" = :user_id
                ORDER BY "createdAt" ASC
                """,
            ),
            {"user_id": user_id},
        ).mappings()
        return [str(row["role"]).lower() for row in rows]

    def _load_account_type(self, user_id: str) -> Optional[str]:
        if not self.registration_storage_exists():
            return None
        row = self.db.execute(
            text(
                """
                SELECT "accountType"
                FROM "ProfessionalRegistration"
                WHERE "userId" = :user_id
                LIMIT 1
                """,
            ),
            {"user_id": user_id},
        ).mappings().first()
        return None if row is None else str(row["accountType"]).lower()

    def _to_user_record(self, row) -> AuthUserRecord:
        return AuthUserRecord(
            id=str(row["id"]),
            email=str(row["email"]),
            password_hash=str(row["passwordHash"]),
            full_name=str(row["fullName"]),
            phone=None if row["phone"] is None else str(row["phone"]),
            roles=self._load_roles(str(row["id"])),
            account_type=self._load_account_type(str(row["id"])),
            avatar_url=self._load_avatar_url(str(row["id"])),
        )

    def get_user_by_email(self, email: str) -> Optional[AuthUserRecord]:
        row = self.db.execute(
            text(
                """
                SELECT "id", "email", "passwordHash", "fullName", "phone"
                FROM "User"
                WHERE "email" = :email
                LIMIT 1
                """,
            ),
            {"email": email},
        ).mappings().first()

        return None if row is None else self._to_user_record(row)

    def get_user_by_id(self, user_id: str) -> Optional[AuthUserRecord]:
        row = self.db.execute(
            text(
                """
                SELECT "id", "email", "passwordHash", "fullName", "phone"
                FROM "User"
                WHERE "id" = :user_id
                LIMIT 1
                """,
            ),
            {"user_id": user_id},
        ).mappings().first()

        return None if row is None else self._to_user_record(row)

    def update_password_hash(self, user_id: str, password_hash: str) -> None:
        self.db.execute(
            text(
                """
                UPDATE "User"
                SET "passwordHash" = :password_hash
                WHERE "id" = :user_id
                """,
            ),
            {"user_id": user_id, "password_hash": password_hash},
        )
        self.db.commit()

    def create_customer(
        self,
        *,
        email: str,
        password_hash: str,
        full_name: str,
        phone: Optional[str],
        avatar_url: Optional[str],
    ) -> AuthUserRecord:
        if avatar_url is not None:
            self.ensure_profile_media_storage()

        user_id = self._generate_id()
        role_id = self._generate_id()

        with self.db.begin():
            self.db.execute(
                text(
                    """
                    INSERT INTO "User" ("id", "email", "passwordHash", "fullName", "phone", "status", "createdAt", "updatedAt")
                    VALUES (:id, :email, :password_hash, :full_name, :phone, 'ACTIVE', NOW(), NOW())
                    """,
                ),
                {
                    "id": user_id,
                    "email": email,
                    "password_hash": password_hash,
                    "full_name": full_name,
                    "phone": phone,
                },
            )
            self.db.execute(
                text(
                    """
                    INSERT INTO "UserRole" ("id", "userId", "role", "createdAt")
                    VALUES (:id, :user_id, 'CUSTOMER', NOW())
                    """,
                ),
                {
                    "id": role_id,
                    "user_id": user_id,
                },
            )
            if avatar_url is not None:
                self.upsert_user_avatar(user_id, avatar_url)

        return self.get_user_by_id(user_id)  # type: ignore[return-value]

    def create_business_owner(
        self,
        *,
        owner_email: str,
        password_hash: str,
        owner_name: str,
        owner_phone: Optional[str],
        business_name: str,
        category: str,
        description: Optional[str],
        address_line1: str,
        address_line2: Optional[str],
        city: str,
        state: str,
        postal_code: str,
        business_phone: Optional[str],
        business_email: Optional[str],
        salon_license_number: str,
        business_license_number: str,
        ein_number: str,
    ) -> AuthUserRecord:
        self.ensure_registration_storage()
        user_id = self._generate_id()
        role_id = self._generate_id()
        business_id = self._generate_id()

        with self.db.begin():
            self.db.execute(
                text(
                    """
                    INSERT INTO "User" ("id", "email", "passwordHash", "fullName", "phone", "status", "createdAt", "updatedAt")
                    VALUES (:id, :email, :password_hash, :full_name, :phone, 'ACTIVE', NOW(), NOW())
                    """,
                ),
                {
                    "id": user_id,
                    "email": owner_email,
                    "password_hash": password_hash,
                    "full_name": owner_name,
                    "phone": owner_phone,
                },
            )
            self.db.execute(
                text(
                    """
                    INSERT INTO "UserRole" ("id", "userId", "role", "createdAt")
                    VALUES (:id, :user_id, 'OWNER', NOW())
                    """,
                ),
                {
                    "id": role_id,
                    "user_id": user_id,
                },
            )
            self.db.execute(
                text(
                    """
                    INSERT INTO "Business" (
                      "id",
                      "ownerUserId",
                      "name",
                      "description",
                      "category",
                      "phone",
                      "email",
                      "addressLine1",
                      "addressLine2",
                      "city",
                      "state",
                      "postalCode",
                      "status",
                      "featuredOnHomepage",
                      "homepageRank",
                      "rating",
                      "reviewCount",
                      "createdAt",
                      "updatedAt"
                    )
                    VALUES (
                      :id,
                      :owner_user_id,
                      :name,
                      :description,
                      :category,
                      :phone,
                      :email,
                      :address_line1,
                      :address_line2,
                      :city,
                      :state,
                      :postal_code,
                      'PENDING_REVIEW',
                      FALSE,
                      999,
                      0,
                      0,
                      NOW(),
                      NOW()
                    )
                    """,
                ),
                {
                    "id": business_id,
                    "owner_user_id": user_id,
                    "name": business_name,
                    "description": description,
                    "category": category.upper(),
                    "phone": business_phone,
                    "email": business_email or owner_email,
                    "address_line1": address_line1,
                    "address_line2": address_line2,
                    "city": city,
                    "state": state,
                    "postal_code": postal_code,
                },
            )
            self.db.execute(
                text(
                    """
                    INSERT INTO "ProfessionalRegistration" (
                      "userId",
                      "accountType",
                      "verificationStatus",
                      "businessId",
                      "salonLicenseNumber",
                      "businessLicenseNumber",
                      "einNumber",
                      "createdAt",
                      "updatedAt"
                    )
                    VALUES (
                      :user_id,
                      'salon_owner',
                      'pending_review',
                      :business_id,
                      :salon_license_number,
                      :business_license_number,
                      :ein_number,
                      NOW(),
                      NOW()
                    )
                    """,
                ),
                {
                    "user_id": user_id,
                    "business_id": business_id,
                    "salon_license_number": salon_license_number,
                    "business_license_number": business_license_number,
                    "ein_number": ein_number,
                },
            )

        return self.get_user_by_id(user_id)  # type: ignore[return-value]

    def create_private_technician(
        self,
        *,
        email: str,
        password_hash: str,
        full_name: str,
        phone: Optional[str],
        identity_card_number: str,
        ssa_number: str,
        license_number: str,
        license_state: str,
    ) -> AuthUserRecord:
        self.ensure_registration_storage()
        user_id = self._generate_id()
        role_id = self._generate_id()

        with self.db.begin():
            self.db.execute(
                text(
                    """
                    INSERT INTO "User" ("id", "email", "passwordHash", "fullName", "phone", "status", "createdAt", "updatedAt")
                    VALUES (:id, :email, :password_hash, :full_name, :phone, 'ACTIVE', NOW(), NOW())
                    """,
                ),
                {
                    "id": user_id,
                    "email": email,
                    "password_hash": password_hash,
                    "full_name": full_name,
                    "phone": phone,
                },
            )
            self.db.execute(
                text(
                    """
                    INSERT INTO "UserRole" ("id", "userId", "role", "createdAt")
                    VALUES (:id, :user_id, 'TECHNICIAN', NOW())
                    """,
                ),
                {
                    "id": role_id,
                    "user_id": user_id,
                },
            )
            self.db.execute(
                text(
                    """
                    INSERT INTO "ProfessionalRegistration" (
                      "userId",
                      "accountType",
                      "verificationStatus",
                      "identityCardNumber",
                      "ssaNumber",
                      "stateLicenseNumber",
                      "licenseState",
                      "createdAt",
                      "updatedAt"
                    )
                    VALUES (
                      :user_id,
                      'private_technician',
                      'pending_review',
                      :identity_card_number,
                      :ssa_number,
                      :license_number,
                      :license_state,
                      NOW(),
                      NOW()
                    )
                    """,
                ),
                {
                    "user_id": user_id,
                    "identity_card_number": identity_card_number,
                    "ssa_number": ssa_number,
                    "license_number": license_number,
                    "license_state": license_state,
                },
            )

        return self.get_user_by_id(user_id)  # type: ignore[return-value]

    def create_notification(
        self,
        *,
        user_id: str,
        notification_type: str,
        title: str,
        body: Optional[str],
        created_at: Optional[datetime] = None,
    ) -> None:
        self.notifications.create_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            created_at=created_at or datetime.utcnow(),
        )
        self.db.commit()
