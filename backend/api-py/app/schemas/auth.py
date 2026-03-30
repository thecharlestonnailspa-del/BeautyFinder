from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import BusinessCategory, ProfessionalAccountType, UserRole


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class SessionUser(CamelModel):
    id: str
    role: UserRole
    name: str
    email: str
    public_id: Optional[str] = Field(default=None, alias="publicId")
    account_type: Optional[ProfessionalAccountType] = Field(default=None, alias="accountType")
    avatar_url: Optional[str] = Field(default=None, alias="avatarUrl")


class UserSummary(SessionUser):
    pass


class AdminAccessContext(CamelModel):
    admin_user_id: str = Field(alias="adminUserId")
    admin_name: str = Field(alias="adminName")
    started_at: str = Field(alias="startedAt")
    note: Optional[str] = None


class SessionPayload(CamelModel):
    permissions: List[str]
    access_token: str = Field(alias="accessToken")
    expires_at: str = Field(alias="expiresAt")
    user: SessionUser
    admin_access: Optional[AdminAccessContext] = Field(default=None, alias="adminAccess")


class LoginRequest(CamelModel):
    email: str
    password: str = Field(min_length=6)


class RegisterCustomerRequest(CamelModel):
    full_name: str = Field(alias="fullName")
    email: str
    password: str = Field(min_length=6)
    phone: Optional[str] = None
    avatar_url: Optional[str] = Field(default=None, alias="avatarUrl")


class RegisterBusinessOwnerRequest(CamelModel):
    owner_name: str = Field(alias="ownerName")
    owner_email: str = Field(alias="ownerEmail")
    password: str = Field(min_length=6)
    owner_phone: Optional[str] = Field(default=None, alias="ownerPhone")
    business_name: str = Field(alias="businessName")
    category: BusinessCategory
    description: Optional[str] = None
    address_line1: str = Field(alias="addressLine1")
    address_line2: Optional[str] = Field(default=None, alias="addressLine2")
    city: str
    state: str
    postal_code: str = Field(alias="postalCode")
    business_phone: Optional[str] = Field(default=None, alias="businessPhone")
    business_email: Optional[str] = Field(default=None, alias="businessEmail")
    salon_license_number: str = Field(alias="salonLicenseNumber")
    business_license_number: str = Field(alias="businessLicenseNumber")
    ein_number: str = Field(alias="einNumber")


class RegisterPrivateTechnicianRequest(CamelModel):
    full_name: str = Field(alias="fullName")
    email: str
    password: str = Field(min_length=6)
    phone: Optional[str] = None
    identity_card_number: str = Field(alias="identityCardNumber")
    ssa_number: str = Field(alias="ssaNumber")
    license_number: str = Field(alias="licenseNumber")
    license_state: str = Field(alias="licenseState")
