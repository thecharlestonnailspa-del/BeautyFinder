import base64
import binascii
from pathlib import Path
from time import time
from typing import List, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.reference_ids import build_public_id
from app.domains.base import BaseDomainService
from app.domains.businesses.repository import BusinessCatalogRecord, BusinessesRepository
from app.schemas.auth import UserSummary
from app.schemas.businesses import (
    BusinessSummary,
    OwnerBusinessProfile,
    OwnerTechnicianProfile,
    UpdateOwnerBusinessRequest,
    UpdateOwnerTechnicianRosterRequest,
    UploadedOwnerBusinessImage,
    UploadOwnerBusinessImageRequest,
)


class BusinessesService(BaseDomainService):
    def __init__(self, db: Session, settings: Settings) -> None:
        super().__init__(db, settings)
        self.repository = BusinessesRepository(db)
        self._supported_image_types = {
            ".avif": {"content_type": "image/avif", "extension": "avif"},
            ".gif": {"content_type": "image/gif", "extension": "gif"},
            ".heic": {"content_type": "image/heic", "extension": "heic"},
            ".heif": {"content_type": "image/heif", "extension": "heif"},
            ".jpeg": {"content_type": "image/jpeg", "extension": "jpg"},
            ".jpg": {"content_type": "image/jpeg", "extension": "jpg"},
            ".png": {"content_type": "image/png", "extension": "png"},
            ".webp": {"content_type": "image/webp", "extension": "webp"},
            "image/avif": {"content_type": "image/avif", "extension": "avif"},
            "image/gif": {"content_type": "image/gif", "extension": "gif"},
            "image/heic": {"content_type": "image/heic", "extension": "heic"},
            "image/heif": {"content_type": "image/heif", "extension": "heif"},
            "image/jpeg": {"content_type": "image/jpeg", "extension": "jpg"},
            "image/jpg": {"content_type": "image/jpeg", "extension": "jpg"},
            "image/png": {"content_type": "image/png", "extension": "png"},
            "image/webp": {"content_type": "image/webp", "extension": "webp"},
        }

    def _to_business_summary(self, business: BusinessCatalogRecord) -> BusinessSummary:
        return BusinessSummary(
            id=business.id,
            public_id=build_public_id("business", business.id),
            owner_id=business.owner_id,
            category=business.category,
            name=business.name,
            featured_on_homepage=business.featured_on_homepage,
            homepage_rank=business.homepage_rank,
            address_line1=business.address_line1,
            address_line2=business.address_line2,
            city=business.city,
            state=business.state,
            postal_code=business.postal_code,
            latitude=business.latitude,
            longitude=business.longitude,
            rating=business.rating,
            review_count=business.review_count,
            hero_image=business.hero_image,
            description=business.description,
            services=business.services,
        )

    def _to_owner_business_profile(
        self,
        business,
    ) -> OwnerBusinessProfile:
        return OwnerBusinessProfile(
            id=business.id,
            public_id=build_public_id("business", business.id),
            owner_id=business.owner_id,
            category=business.category,
            status=business.status,
            name=business.name,
            featured_on_homepage=business.featured_on_homepage,
            homepage_rank=business.homepage_rank,
            address_line1=business.address_line1,
            address_line2=business.address_line2,
            city=business.city,
            state=business.state,
            postal_code=business.postal_code,
            latitude=business.latitude,
            longitude=business.longitude,
            rating=business.rating,
            review_count=business.review_count,
            hero_image=business.hero_image,
            business_logo=business.business_logo,
            business_banner=business.business_banner,
            owner_avatar=business.owner_avatar,
            description=business.description,
            services=business.services,
            gallery_images=business.gallery_images,
            video_url=business.video_url,
            staff=business.staff,
            promotion=business.promotion,
        )

    def _to_owner_technician_profile(
        self,
        technician,
    ) -> OwnerTechnicianProfile:
        return OwnerTechnicianProfile(
            id=technician.id,
            business_id=technician.business_id,
            business_name=technician.business_name,
            business_category=technician.business_category,
            business_status=technician.business_status,
            name=technician.name,
            title=technician.title,
            avatar_url=technician.avatar_url,
            is_active=technician.is_active,
        )

    def list_businesses(
        self,
        *,
        category: Optional[str],
        city: Optional[str],
        search: Optional[str],
    ) -> List[BusinessSummary]:
        normalized_category = self.sanitize_text(category)
        if normalized_category is not None:
            normalized_category = normalized_category.lower()
            if normalized_category not in {"nail", "hair"}:
                normalized_category = None

        normalized_city = self.sanitize_text(city)
        normalized_search = self.sanitize_text(search)
        search_terms = (
            [term for term in normalized_search.lower().split() if term]
            if normalized_search
            else []
        )

        businesses = self.repository.list_businesses(
            category=normalized_category,
            city=normalized_city,
            search_terms=search_terms,
        )
        return [self._to_business_summary(business) for business in businesses]

    def get_business(self, business_id: str) -> BusinessSummary:
        business = self.repository.get_business(business_id)
        if business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business {business_id} was not found",
            )
        return self._to_business_summary(business)

    def get_owner_businesses(
        self,
        owner_id: str,
        actor: UserSummary,
    ) -> List[OwnerBusinessProfile]:
        if actor.role not in {"owner", "admin"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage businesses",
            )

        if actor.role == "owner" and actor.id != owner_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Owners can only manage their own businesses",
            )

        self.repository.ensure_profile_media_storage()
        businesses = self.repository.list_owner_businesses(owner_id)
        return [self._to_owner_business_profile(business) for business in businesses]

    def get_owner_technicians(
        self,
        business_id: str,
        actor: UserSummary,
    ) -> List[OwnerTechnicianProfile]:
        business = self.repository.get_owner_business_target(business_id)
        if business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found",
            )

        if actor.role not in {"owner", "admin"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage technicians",
            )

        if actor.role == "owner" and business.owner_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Owners can only manage technicians for their own business",
            )

        self.repository.ensure_profile_media_storage()
        technicians = self.repository.list_business_technicians(business_id)
        return [self._to_owner_technician_profile(technician) for technician in technicians]

    def _normalize_upload_base64(self, value: str) -> bytes:
        trimmed = value.strip()
        normalized = trimmed.split(",", 1)[1] if "," in trimmed else trimmed
        try:
            return base64.b64decode(normalized, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file body is not valid base64",
            ) from exc

    def _resolve_image_upload_type(
        self,
        filename: Optional[str],
        content_type: Optional[str],
    ) -> dict[str, str]:
        normalized_content_type = self.sanitize_text(content_type)
        normalized_extension = Path(filename or "").suffix.lower()
        resolved = None
        if normalized_content_type:
            resolved = self._supported_image_types.get(normalized_content_type.lower())
        if resolved is None and normalized_extension:
            resolved = self._supported_image_types.get(normalized_extension)
        if resolved is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PNG, JPG, WEBP, GIF, AVIF, HEIC, and HEIF images can be uploaded",
            )
        return resolved

    def update_owner_business(
        self,
        business_id: str,
        input_data: UpdateOwnerBusinessRequest,
        actor: UserSummary,
    ) -> OwnerBusinessProfile:
        self.repository.ensure_profile_media_storage()
        existing_business = self.repository.get_owner_business_by_id(business_id)
        if existing_business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found",
            )

        if actor.role != "owner" or existing_business.owner_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update this business",
            )

        provided_fields = input_data.model_fields_set

        normalized_gallery_images = None
        if "gallery_images" in provided_fields:
            normalized_gallery_images = [
                url
                for url in (
                    self.sanitize_text(value) for value in (input_data.gallery_images or [])
                )
                if url
            ]

        normalized_services = None
        if "services" in provided_fields:
            normalized_services = [
                {
                    "id": service.id,
                    "name": self.sanitize_text(service.name),
                    "description": self.sanitize_text(service.description),
                    "durationMinutes": service.duration_minutes,
                    "price": service.price,
                    "isActive": service.is_active,
                }
                for service in (input_data.services or [])
            ]
            if any(
                not service["name"]
                or not service["description"]
                or not isinstance(service["price"], (int, float))
                or float(service["price"]) <= 0
                for service in normalized_services
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Each service requires a name, description, and price greater than 0",
                )

        normalized_staff = None
        if "staff" in provided_fields:
            normalized_staff = [
                {
                    "id": member.id,
                    "name": self.sanitize_text(member.name),
                    "title": self.sanitize_text(member.title),
                    "avatarUrl": self.sanitize_text(member.avatar_url),
                    "isActive": member.is_active,
                }
                for member in (input_data.staff or [])
            ]
            normalized_staff = [
                member for member in normalized_staff if member["name"]
            ]

        promotion_provided = "promotion" in provided_fields
        normalized_promotion = None
        if promotion_provided and input_data.promotion is not None:
            normalized_promotion = {
                "title": self.sanitize_text(input_data.promotion.title),
                "description": self.sanitize_text(input_data.promotion.description),
                "discountPercent": input_data.promotion.discount_percent,
                "code": self.sanitize_text(input_data.promotion.code),
                "expiresAt": input_data.promotion.expires_at,
            }

        next_hero_image = None
        if "hero_image" in provided_fields:
            next_hero_image = self.sanitize_text(input_data.hero_image)
        elif normalized_gallery_images is not None and normalized_gallery_images:
            next_hero_image = normalized_gallery_images[0]

        update_fields: dict[str, object] = {}
        if "name" in provided_fields:
            update_fields["name"] = self.sanitize_text(input_data.name) or existing_business.name
        if "description" in provided_fields:
            update_fields["description"] = self.sanitize_text(input_data.description)
        if next_hero_image is not None:
            update_fields["heroImage"] = next_hero_image
        if "video_url" in provided_fields:
            update_fields["videoUrl"] = self.sanitize_text(input_data.video_url)
        if promotion_provided:
            update_fields["promotionTitle"] = (
                normalized_promotion["title"] if normalized_promotion else None
            )
            update_fields["promotionDescription"] = (
                normalized_promotion["description"] if normalized_promotion else None
            )
            update_fields["promotionDiscountPercent"] = (
                normalized_promotion["discountPercent"] if normalized_promotion else None
            )
            update_fields["promotionCode"] = (
                normalized_promotion["code"] if normalized_promotion else None
            )
            update_fields["promotionExpiresAt"] = (
                self.parse_timestamp(str(normalized_promotion["expiresAt"]))
                if normalized_promotion and normalized_promotion["expiresAt"]
                else None
            )

        with self.db.begin():
            self.repository.update_business_fields(business_id, update_fields)
            self.repository.update_business_profile_media(
                business_id,
                business_logo_url=self.sanitize_text(input_data.business_logo),
                business_logo_provided="business_logo" in provided_fields,
                business_banner_url=self.sanitize_text(input_data.business_banner),
                business_banner_provided="business_banner" in provided_fields,
                owner_avatar_url=self.sanitize_text(input_data.owner_avatar),
                owner_avatar_provided="owner_avatar" in provided_fields,
            )

            if normalized_gallery_images is not None:
                self.repository.replace_gallery_images(business_id, normalized_gallery_images)

            if normalized_services is not None:
                for service in normalized_services:
                    self.repository.upsert_owner_service(business_id, service)

            if normalized_staff is not None:
                for member in normalized_staff:
                    self.repository.upsert_owner_staff(business_id, member)

            self.repository.create_owner_dashboard_notification(
                existing_business.owner_id,
                existing_business.name,
            )

        updated_business = self.repository.get_owner_business_by_id(business_id)
        if updated_business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found after update",
            )

        return self._to_owner_business_profile(updated_business)

    def update_owner_technicians(
        self,
        business_id: str,
        input_data: UpdateOwnerTechnicianRosterRequest,
        actor: UserSummary,
    ) -> List[OwnerTechnicianProfile]:
        self.repository.ensure_profile_media_storage()
        business = self.repository.get_owner_business_target(business_id)
        if business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found",
            )

        if actor.role != "owner" or business.owner_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update technicians for this business",
            )

        normalized_technicians = [
            {
                "id": technician.id,
                "name": self.sanitize_text(technician.name),
                "title": self.sanitize_text(technician.title),
                "avatarUrl": self.sanitize_text(technician.avatar_url),
                "isActive": technician.is_active,
            }
            for technician in input_data.technicians
        ]
        normalized_technicians = [
            technician
            for technician in normalized_technicians
            if technician["name"]
        ]

        with self.db.begin():
            self.repository.replace_owner_staff(business_id, normalized_technicians)
            self.repository.create_owner_dashboard_notification(
                business.owner_id,
                business.name,
            )

        technicians = self.repository.list_business_technicians(business_id)
        return [self._to_owner_technician_profile(technician) for technician in technicians]

    def upload_owner_business_image(
        self,
        business_id: str,
        input_data: UploadOwnerBusinessImageRequest,
        actor: UserSummary,
    ) -> UploadedOwnerBusinessImage:
        business = self.repository.get_owner_business_target(business_id)
        if business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found",
            )

        if actor.role != "owner" or business.owner_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to upload media for this business",
            )

        buffer = self._normalize_upload_base64(input_data.base64)
        image_type = self._resolve_image_upload_type(
            input_data.filename,
            input_data.content_type,
        )

        if not buffer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty",
            )

        max_upload_size_bytes = 5 * 1024 * 1024
        if len(buffer) > max_upload_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must be 5 MB or smaller",
            )

        relative_directory = Path("owners") / actor.id / business.id
        target_directory = Path(self.settings.owner_media_upload_dir) / relative_directory
        stored_filename = (
            f"{int(time() * 1000)}-{uuid4().hex}.{image_type['extension']}"
        )

        target_directory.mkdir(parents=True, exist_ok=True)
        (target_directory / stored_filename).write_bytes(buffer)

        return UploadedOwnerBusinessImage(
            content_type=image_type["content_type"],
            path=f"/uploads/{relative_directory.as_posix()}/{stored_filename}",
            size=len(buffer),
        )
