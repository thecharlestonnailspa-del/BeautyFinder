import unittest

from fastapi import HTTPException

from app.core.config import Settings
from app.domains.auth.repository import AuthUserRecord
from app.domains.auth.service import AuthService
from app.schemas.auth import RegisterBusinessOwnerRequest, RegisterPrivateTechnicianRequest


def make_settings() -> Settings:
    return Settings(
        api_name="Beauty Finder API (Test)",
        api_prefix="/api",
        environment="test",
        debug=False,
        host="127.0.0.1",
        port=8001,
        database_url="postgresql+psycopg://test:test@localhost:5432/test",
        redis_url="redis://localhost:6379",
        jwt_secret="top-secret",
        jwt_issuer="beauty-finder-api",
        jwt_ttl_seconds=3600,
        cors_origins_csv="http://127.0.0.1:3001",
        payment_currency="USD",
        payment_tax_rate=0.08,
        owner_media_upload_dir="/tmp",
    )


class FakeAuthRepository:
    def __init__(self) -> None:
        self.users_by_email: dict[str, AuthUserRecord] = {}
        self.created_business_owner_payload: dict[str, object] | None = None
        self.created_technician_payload: dict[str, object] | None = None
        self.notifications: list[dict[str, object]] = []

    def get_user_by_email(self, email: str):
        return self.users_by_email.get(email)

    def get_user_by_id(self, user_id: str):
        for user in self.users_by_email.values():
            if user.id == user_id:
                return user
        return None

    def create_customer(self, **kwargs):
        raise AssertionError("Customer creation is not part of these registration tests")

    def create_business_owner(self, **kwargs):
        self.created_business_owner_payload = kwargs
        record = AuthUserRecord(
            id="user-owner-99",
            email=str(kwargs["owner_email"]),
            password_hash=str(kwargs["password_hash"]),
            full_name=str(kwargs["owner_name"]),
            phone=None if kwargs["owner_phone"] is None else str(kwargs["owner_phone"]),
            roles=["owner"],
            account_type="salon_owner",
        )
        self.users_by_email[record.email] = record
        return record

    def create_private_technician(self, **kwargs):
        self.created_technician_payload = kwargs
        record = AuthUserRecord(
            id="user-technician-99",
            email=str(kwargs["email"]),
            password_hash=str(kwargs["password_hash"]),
            full_name=str(kwargs["full_name"]),
            phone=None if kwargs["phone"] is None else str(kwargs["phone"]),
            roles=["technician"],
            account_type="private_technician",
        )
        self.users_by_email[record.email] = record
        return record

    def create_notification(self, **kwargs):
        self.notifications.append(kwargs)


class AuthRegistrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = AuthService(db=None, settings=make_settings())  # type: ignore[arg-type]
        self.repository = FakeAuthRepository()
        self.service.repository = self.repository  # type: ignore[assignment]

    def test_business_owner_registration_requires_and_normalizes_compliance_fields(self) -> None:
        session = self.service.register_business_owner(
            RegisterBusinessOwnerRequest(
                ownerName="Lina Nguyen",
                ownerEmail="lina+new@polishedstudio.app",
                password="Beauty123",
                ownerPhone="(212) 555-0192",
                businessName="Polished Studio Downtown",
                category="nail",
                description="Premium nail care",
                addressLine1="123 Main Street",
                city="New York",
                state="NY",
                postalCode="10001",
                businessPhone="(212) 555-0119",
                businessEmail="frontdesk@polishedstudio.app",
                salonLicenseNumber="ca salon 7788",
                businessLicenseNumber="sf llc 9921",
                einNumber="123456789",
            ),
        )

        self.assertEqual(session.user.role, "owner")
        self.assertEqual(session.user.account_type, "salon_owner")
        self.assertTrue((session.user.public_id or "").startswith("OWN-"))
        self.assertIsNotNone(self.repository.created_business_owner_payload)
        self.assertEqual(
            self.repository.created_business_owner_payload["salon_license_number"],
            "CASALON7788",
        )
        self.assertEqual(
            self.repository.created_business_owner_payload["business_license_number"],
            "SFLLC9921",
        )
        self.assertEqual(
            self.repository.created_business_owner_payload["ein_number"],
            "12-3456789",
        )

    def test_private_technician_registration_creates_technician_session(self) -> None:
        session = self.service.register_private_technician(
            RegisterPrivateTechnicianRequest(
                fullName="Maya Chen",
                email="maya@privatebeauty.app",
                password="Beauty123",
                phone="(718) 555-0144",
                identityCardNumber="id 998877",
                ssaNumber="123-45-6789",
                licenseNumber="ca tech 7788",
                licenseState="ca",
            ),
        )

        self.assertEqual(session.user.role, "technician")
        self.assertEqual(session.user.account_type, "private_technician")
        self.assertTrue((session.user.public_id or "").startswith("TEC-"))
        self.assertIsNotNone(self.repository.created_technician_payload)
        self.assertEqual(
            self.repository.created_technician_payload["identity_card_number"],
            "ID998877",
        )
        self.assertEqual(
            self.repository.created_technician_payload["ssa_number"],
            "123-45-6789",
        )
        self.assertEqual(
            self.repository.created_technician_payload["license_number"],
            "CATECH7788",
        )
        self.assertEqual(
            self.repository.created_technician_payload["license_state"],
            "CA",
        )

    def test_business_owner_registration_rejects_invalid_ein(self) -> None:
        with self.assertRaises(HTTPException) as context:
            self.service.register_business_owner(
                RegisterBusinessOwnerRequest(
                    ownerName="Lina Nguyen",
                    ownerEmail="lina@polishedstudio.app",
                    password="Beauty123",
                    businessName="Polished Studio",
                    category="nail",
                    addressLine1="123 Main Street",
                    city="New York",
                    state="NY",
                    postalCode="10001",
                    salonLicenseNumber="CA-7788",
                    businessLicenseNumber="NY-1122",
                    einNumber="12345",
                ),
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "EIN number must contain 9 digits")

    def test_registration_rejects_invalid_email(self) -> None:
        with self.assertRaises(HTTPException) as context:
            self.service.register_private_technician(
                RegisterPrivateTechnicianRequest(
                    fullName="Maya Chen",
                    email="maya-at-privatebeauty.app",
                    password="Beauty123",
                    identityCardNumber="ID998877",
                    ssaNumber="123456789",
                    licenseNumber="CA7788",
                    licenseState="CA",
                ),
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Email format is invalid")

    def test_registration_rejects_weak_password(self) -> None:
        with self.assertRaises(HTTPException) as context:
            self.service.register_private_technician(
                RegisterPrivateTechnicianRequest(
                    fullName="Maya Chen",
                    email="maya@privatebeauty.app",
                    password="mock-password",
                    identityCardNumber="ID998877",
                    ssaNumber="123456789",
                    licenseNumber="CA7788",
                    licenseState="CA",
                ),
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Password must include at least 1 uppercase letter")


if __name__ == "__main__":
    unittest.main()
