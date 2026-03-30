import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.input_validation import get_password_validation_error, is_valid_email_address
from app.core.permissions import ROLE_PERMISSION_MAP
from app.core.reference_ids import build_public_id
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    needs_password_rehash,
    verify_password,
)
from app.domains.base import BaseDomainService
from app.domains.auth.repository import AuthRepository, AuthUserRecord
from app.schemas.auth import (
    AdminAccessContext,
    LoginRequest,
    RegisterBusinessOwnerRequest,
    RegisterCustomerRequest,
    RegisterPrivateTechnicianRequest,
    SessionPayload,
    UserSummary,
)


class AuthService(BaseDomainService):
    def __init__(self, db: Session, settings: Settings) -> None:
        super().__init__(db, settings)
        self.repository = AuthRepository(db)
        self.permission_map = ROLE_PERMISSION_MAP

    def _to_user_summary(self, user: AuthUserRecord) -> UserSummary:
        role = user.roles[0] if user.roles else "customer"
        return UserSummary(
            id=user.id,
            role=role,
            name=user.full_name,
            email=user.email,
            public_id=build_public_id(role, user.id),
            account_type=user.account_type,
            avatar_url=user.avatar_url,
        )

    def _normalize_document_code(self, value: Optional[str], label: str) -> str:
        sanitized = (self.sanitize_text(value) or "").upper()
        normalized = re.sub(r"[^A-Z0-9-]", "", sanitized)
        if len(normalized) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{label} is required",
            )
        return normalized

    def _normalize_nine_digit_identifier(self, value: Optional[str], label: str) -> str:
        digits = re.sub(r"\D", "", self.sanitize_text(value) or "")
        if len(digits) != 9:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{label} must contain 9 digits",
            )
        return digits

    def _format_ein(self, digits: str) -> str:
        return f"{digits[:2]}-{digits[2:]}"

    def _format_ssa(self, digits: str) -> str:
        return f"{digits[:3]}-{digits[3:5]}-{digits[5:]}"

    def _normalize_registration_state(self, value: Optional[str]) -> str:
        normalized = re.sub(r"\s+", " ", (self.sanitize_text(value) or "").upper()).strip()
        if len(normalized) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="License state is required",
            )
        return normalized

    def _build_session_payload(
        self,
        user: AuthUserRecord,
        issued_token: str = "",
        expires_at: str = "",
        admin_access: Optional[AdminAccessContext] = None,
    ) -> SessionPayload:
        summary = self._to_user_summary(user)
        token_bundle = (
            {
                "token": issued_token,
                "expires_at": expires_at,
            }
            if issued_token and expires_at
            else create_access_token(
                user_id=summary.id,
                role=summary.role,
                secret=self.settings.jwt_secret,
                issuer=self.settings.jwt_issuer,
                ttl_seconds=self.settings.jwt_ttl_seconds,
            )
        )
        return SessionPayload(
            user=summary,
            permissions=self.permission_map[summary.role],
            access_token=token_bundle["token"],
            expires_at=token_bundle["expires_at"],
            admin_access=admin_access,
        )

    def _admin_access_from_claims(
        self,
        claims: dict[str, object],
    ) -> Optional[AdminAccessContext]:
        raw_access = claims.get("adminAccess")
        if not isinstance(raw_access, dict):
            return None

        admin_user_id = raw_access.get("adminUserId")
        admin_name = raw_access.get("adminName")
        started_at = raw_access.get("startedAt")
        note = raw_access.get("note")
        if (
            not isinstance(admin_user_id, str)
            or not isinstance(admin_name, str)
            or not isinstance(started_at, str)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid bearer token",
            )

        admin_user = self.repository.get_user_by_id(admin_user_id)
        if admin_user is None or "admin" not in admin_user.roles:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid bearer token",
            )

        target_user_id = raw_access.get("targetUserId")
        if target_user_id is not None and target_user_id != claims.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid bearer token",
            )

        return AdminAccessContext(
            admin_user_id=admin_user_id,
            admin_name=admin_name,
            started_at=started_at,
            note=note if isinstance(note, str) and note else None,
        )

    def get_user_by_id(self, user_id: str) -> UserSummary:
        user = self.repository.get_user_by_id(user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Authenticated user was not found",
            )
        return self._to_user_summary(user)

    def verify_access_token(self, token: str) -> SessionPayload:
        claims = decode_access_token(
            token,
            self.settings.jwt_secret,
            self.settings.jwt_issuer,
        )
        user = self.repository.get_user_by_id(str(claims["sub"]))
        if user is None or str(claims["role"]) not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid bearer token",
            )

        expires_at = datetime.fromtimestamp(
            int(claims["exp"]),
            tz=timezone.utc,
        ).isoformat().replace("+00:00", "Z")
        admin_access = self._admin_access_from_claims(claims)
        return self._build_session_payload(
            user,
            issued_token=token,
            expires_at=expires_at,
            admin_access=admin_access,
        )

    def login(self, input_data: LoginRequest) -> SessionPayload:
        normalized_email = self.normalize_email(input_data.email)
        if not normalized_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required when signing in",
            )
        if not is_valid_email_address(normalized_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email format is invalid",
            )

        if not input_data.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is required when signing in",
            )

        user = self.repository.get_user_by_email(normalized_email)
        if user is None or not verify_password(input_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if needs_password_rehash(user.password_hash):
            self.repository.update_password_hash(
                user.id,
                hash_password(input_data.password),
            )
            user = self.repository.get_user_by_id(user.id) or user

        return self._build_session_payload(user)

    def register_customer(
        self,
        input_data: RegisterCustomerRequest,
    ) -> SessionPayload:
        sanitized_phone = self.sanitize_text(input_data.phone)
        full_name = self.sanitize_text(input_data.full_name)
        normalized_email = self.normalize_email(input_data.email)
        avatar_url = self.sanitize_text(input_data.avatar_url)

        if not full_name or not normalized_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Full name and email are required",
            )
        if not is_valid_email_address(normalized_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email format is invalid",
            )
        password_error = get_password_validation_error(input_data.password)
        if password_error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=password_error,
            )

        if self.repository.get_user_by_email(normalized_email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That email is already registered",
            )

        user = self.repository.create_customer(
            email=normalized_email,
            password_hash=hash_password(input_data.password),
            full_name=full_name,
            phone=sanitized_phone,
            avatar_url=avatar_url,
        )
        self.repository.create_notification(
            user_id=user.id,
            notification_type="system",
            title="Welcome to Beauty Finder",
            body="Your customer account is ready. Save favorites and book your next appointment.",
        )

        return self._build_session_payload(user)

    def register_business_owner(
        self,
        input_data: RegisterBusinessOwnerRequest,
    ) -> SessionPayload:
        owner_name = self.sanitize_text(input_data.owner_name)
        owner_email = self.normalize_email(input_data.owner_email)
        business_name = self.sanitize_text(input_data.business_name)
        address_line1 = self.sanitize_text(input_data.address_line1)
        city = self.sanitize_text(input_data.city)
        state = self.sanitize_text(input_data.state)
        postal_code = self.sanitize_text(input_data.postal_code)
        business_email = (
            self.normalize_email(input_data.business_email)
            if input_data.business_email
            else None
        )
        sanitized_description = self.sanitize_text(input_data.description)
        salon_license_number = self._normalize_document_code(
            input_data.salon_license_number,
            "Salon license number",
        )
        business_license_number = self._normalize_document_code(
            input_data.business_license_number,
            "Business license number",
        )
        ein_number = self._format_ein(
            self._normalize_nine_digit_identifier(input_data.ein_number, "EIN number"),
        )
        if (
            not owner_name
            or not owner_email
            or not business_name
            or not address_line1
            or not city
            or not state
            or not postal_code
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owner and business profile fields are required",
            )
        if not is_valid_email_address(owner_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email format is invalid",
            )
        if business_email and not is_valid_email_address(business_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business email format is invalid",
            )
        password_error = get_password_validation_error(input_data.password)
        if password_error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=password_error,
            )

        if self.repository.get_user_by_email(owner_email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That owner email is already registered",
            )

        owner = self.repository.create_business_owner(
            owner_email=owner_email,
            password_hash=hash_password(input_data.password),
            owner_name=owner_name,
            owner_phone=self.sanitize_text(input_data.owner_phone),
            business_name=business_name,
            category=input_data.category,
            description=sanitized_description,
            address_line1=address_line1,
            address_line2=self.sanitize_text(input_data.address_line2),
            city=city,
            state=state,
            postal_code=postal_code,
            business_phone=self.sanitize_text(input_data.business_phone),
            business_email=business_email or owner_email,
            salon_license_number=salon_license_number,
            business_license_number=business_license_number,
            ein_number=ein_number,
        )
        self.repository.create_notification(
            user_id=owner.id,
            notification_type="system",
            title="Business registration submitted",
            body=f"{business_name} was created and sent for admin review. You can keep editing services, pricing, and media while it is pending.",
        )

        return self._build_session_payload(owner)

    def register_private_technician(
        self,
        input_data: RegisterPrivateTechnicianRequest,
    ) -> SessionPayload:
        full_name = self.sanitize_text(input_data.full_name)
        normalized_email = self.normalize_email(input_data.email)
        phone = self.sanitize_text(input_data.phone)
        identity_card_number = self._normalize_document_code(
            input_data.identity_card_number,
            "Identity card number",
        )
        ssa_number = self._format_ssa(
            self._normalize_nine_digit_identifier(input_data.ssa_number, "SSA number"),
        )
        license_number = self._normalize_document_code(
            input_data.license_number,
            "License number",
        )
        license_state = self._normalize_registration_state(input_data.license_state)

        if not full_name or not normalized_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Full name and email are required",
            )
        if not is_valid_email_address(normalized_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email format is invalid",
            )
        password_error = get_password_validation_error(input_data.password)
        if password_error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=password_error,
            )

        if self.repository.get_user_by_email(normalized_email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That technician email is already registered",
            )

        technician = self.repository.create_private_technician(
            email=normalized_email,
            password_hash=hash_password(input_data.password),
            full_name=full_name,
            phone=phone,
            identity_card_number=identity_card_number,
            ssa_number=ssa_number,
            license_number=license_number,
            license_state=license_state,
        )
        self.repository.create_notification(
            user_id=technician.id,
            notification_type="system",
            title="Private technician registration submitted",
            body=(
                "Your technician account is live and your identity, SSA, and state license "
                "details were saved for compliance review."
            ),
        )

        return self._build_session_payload(technician)
