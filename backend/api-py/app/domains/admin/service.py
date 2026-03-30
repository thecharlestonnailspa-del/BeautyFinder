import re
from datetime import datetime, timezone
from json import dumps
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.input_validation import is_valid_email_address
from app.core.permissions import ROLE_PERMISSION_MAP
from app.core.reference_ids import build_public_id
from app.core.security import create_access_token
from app.domains.base import BaseDomainService
from app.domains.admin.repository import (
    AdminActionListRecord,
    AdminAccountRecord,
    AdminBusinessQueueRecord,
    AdminConversationCaseRecord,
    AdminOverviewRecord,
    AdminRepository,
    AdminReviewQueueRecord,
)
from app.domains.auth.repository import AuthRepository
from app.domains.businesses.repository import BusinessCatalogRecord, BusinessesRepository
from app.schemas.admin import (
    AdminActionRecord,
    AdminAccountSummary,
    AdminBusinessQueueItem,
    AdminConversationCase,
    AdminOverview,
    AdminReviewQueueItem,
    CreateAdminAccessSessionRequest,
    UpdateAdminAccountRequest,
    UpdateBusinessStatusRequest,
    UpdateConversationCaseStatusRequest,
    UpdateHomepageBusinessRequest,
    UpdateReviewStatusRequest,
)
from app.schemas.auth import AdminAccessContext, SessionPayload, SessionUser, UserSummary
from app.schemas.businesses import BusinessSummary
from app.schemas.common import (
    BusinessModerationStatus,
    ReviewModerationStatus,
)


class AdminService(BaseDomainService):
    def __init__(self, db: Session, settings: Settings) -> None:
        super().__init__(db, settings)
        self.repository = AdminRepository(db)
        self.auth_repository = AuthRepository(db)
        self.businesses_repository = BusinessesRepository(db)
        self._business_status_order = {
            "pending_review": 0,
            "approved": 1,
            "suspended": 2,
            "rejected": 3,
            "draft": 4,
        }
        self._conversation_case_status_order = {
            "open": 0,
            "watched": 1,
            "resolved": 2,
        }

    def _ensure_admin(self, actor: UserSummary) -> None:
        if not self.is_admin(actor):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this resource",
            )

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

    def _to_admin_overview(self, overview: AdminOverviewRecord) -> AdminOverview:
        return AdminOverview(
            users=overview.users,
            businesses=overview.businesses,
            active_bookings=overview.active_bookings,
            open_conversations=overview.open_conversations,
            pending_reviews=overview.pending_reviews,
        )

    def _to_admin_business_item(
        self,
        business: AdminBusinessQueueRecord,
    ) -> AdminBusinessQueueItem:
        return AdminBusinessQueueItem(
            id=business.id,
            public_id=build_public_id("business", business.id),
            owner_id=business.owner_id,
            owner_public_id=build_public_id("owner", business.owner_id),
            owner_name=business.owner_name,
            owner_email=business.owner_email,
            category=business.category,
            name=business.name,
            status=business.status,
            featured_on_homepage=business.featured_on_homepage,
            homepage_rank=business.homepage_rank,
            city=business.city,
            state=business.state,
            created_at=self.brain.processing.dates.to_utc_iso(business.created_at).replace(
                "+00:00",
                "Z",
            ),
        )

    def _to_admin_review_item(self, review: AdminReviewQueueRecord) -> AdminReviewQueueItem:
        return AdminReviewQueueItem(
            id=review.id,
            appointment_id=review.appointment_id,
            business_id=review.business_id,
            business_public_id=build_public_id("business", review.business_id),
            business_name=review.business_name,
            customer_id=review.customer_id,
            customer_public_id=build_public_id("customer", review.customer_id),
            customer_name=review.customer_name,
            rating=review.rating,
            comment=review.comment,
            status=review.status,
            created_at=self.brain.processing.dates.to_utc_iso(review.created_at).replace(
                "+00:00",
                "Z",
            ),
        )

    def _conversation_priority(
        self,
        last_message: str,
        booking_id: Optional[str],
    ) -> str:
        if booking_id or re.search(
            r"(refund|dispute|chargeback|complaint|angry|reschedule|cancel)",
            last_message,
            re.IGNORECASE,
        ):
            return "high"
        return "normal"

    def _conversation_case_status(self, action: Optional[str]) -> str:
        if action == "watch_conversation":
            return "watched"
        if action == "resolve_conversation":
            return "resolved"
        return "open"

    def _serialize_admin_metadata(
        self,
        note: Optional[str] = None,
        extra: Optional[dict[str, object]] = None,
    ) -> Optional[str]:
        if not note and not extra:
            return None
        payload: dict[str, object] = {}
        if note:
            payload["note"] = note
        if extra:
            payload.update(extra)
        return dumps(payload)

    def _to_admin_conversation_case(
        self,
        conversation: AdminConversationCaseRecord,
    ) -> AdminConversationCase:
        last_message = conversation.last_message or conversation.latest_message or "No messages yet."
        last_message_at = (
            conversation.last_message_at
            or conversation.latest_message_at
            or conversation.created_at
        )
        participant_names = self.repository.list_conversation_participant_names(
            conversation.id,
        )
        latest_action = self.repository.get_latest_conversation_action(conversation.id)
        case_status = self._conversation_case_status(latest_action)
        return AdminConversationCase(
            id=conversation.id,
            business_id=conversation.business_id,
            business_name=conversation.business_name,
            booking_id=conversation.booking_id,
            participant_names=participant_names,
            last_message=last_message,
            last_message_at=self.brain.processing.dates.to_utc_iso(last_message_at).replace(
                "+00:00",
                "Z",
            ),
            message_count=conversation.message_count,
            priority=self._conversation_priority(last_message, conversation.booking_id),
            case_status=case_status,
        )

    def _to_admin_action_record(self, action: AdminActionListRecord) -> AdminActionRecord:
        return AdminActionRecord(
            id=action.id,
            admin_user_id=action.admin_user_id,
            admin_name=action.admin_name,
            target_type=action.target_type,
            target_id=action.target_id,
            action=action.action,
            metadata=action.metadata,
            created_at=self.brain.processing.dates.to_utc_iso(action.created_at).replace(
                "+00:00",
                "Z",
            ),
        )

    def _to_admin_account_summary(self, account: AdminAccountRecord) -> AdminAccountSummary:
        primary_role = account.roles[0] if account.roles else "customer"
        return AdminAccountSummary(
            id=account.id,
            public_id=build_public_id(primary_role, account.id),
            name=account.name,
            email=account.email,
            phone=account.phone,
            status=account.status,
            roles=account.roles or ["customer"],
            primary_role=primary_role,
            business_count=account.business_count,
            created_at=self.brain.processing.dates.to_utc_iso(account.created_at).replace(
                "+00:00",
                "Z",
            ),
            updated_at=self.brain.processing.dates.to_utc_iso(account.updated_at).replace(
                "+00:00",
                "Z",
            ),
        )

    def _build_access_session_payload(
        self,
        *,
        target_user,
        admin_actor: UserSummary,
        note: Optional[str],
    ) -> SessionPayload:
        target_role = target_user.roles[0] if target_user.roles else "customer"
        started_at = datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")
        admin_access = AdminAccessContext(
            admin_user_id=admin_actor.id,
            admin_name=admin_actor.name,
            started_at=started_at,
            note=note,
        )
        token_bundle = create_access_token(
            user_id=target_user.id,
            role=target_role,
            secret=self.settings.jwt_secret,
            issuer=self.settings.jwt_issuer,
            ttl_seconds=min(self.settings.jwt_ttl_seconds, 20 * 60),
            extra_claims={
                "adminAccess": {
                    "adminUserId": admin_actor.id,
                    "adminName": admin_actor.name,
                    "startedAt": started_at,
                    "targetUserId": target_user.id,
                    **({"note": note} if note else {}),
                },
            },
        )
        return SessionPayload(
            user=SessionUser(
                id=target_user.id,
                role=target_role,
                name=target_user.full_name,
                email=target_user.email,
                public_id=build_public_id(target_role, target_user.id),
                account_type=target_user.account_type,
            ),
            permissions=ROLE_PERMISSION_MAP.get(target_role, ROLE_PERMISSION_MAP["customer"]),
            access_token=token_bundle["token"],
            expires_at=token_bundle["expires_at"],
            admin_access=admin_access,
        )

    def _matches_search(self, values: List[Optional[str]], search: str) -> bool:
        needle = search.strip().lower()
        if not needle:
            return True
        return any(needle in (value or "").lower() for value in values)

    def _resolve_account_identifier(self, identifier: str) -> str:
        direct_match = self.repository.get_account(identifier)
        if direct_match is not None:
            return direct_match.id

        normalized_identifier = identifier.strip().lower()
        for account in self.repository.list_accounts(search=None, role_filter=None):
            public_id = build_public_id(account.roles[0] if account.roles else "customer", account.id)
            if public_id.lower() == normalized_identifier:
                return account.id
        return identifier

    def _resolve_business_identifier(self, identifier: str) -> str:
        direct_match = self.repository.get_business(identifier)
        if direct_match is not None:
            return direct_match.id

        normalized_identifier = identifier.strip().lower()
        for business in self.repository.list_businesses():
            if build_public_id("business", business.id).lower() == normalized_identifier:
                return business.id
        return identifier

    def get_overview(self, actor: UserSummary) -> AdminOverview:
        self._ensure_admin(actor)
        return self._to_admin_overview(self.repository.get_overview())

    def get_homepage_businesses(self, actor: UserSummary) -> List[BusinessSummary]:
        self._ensure_admin(actor)
        homepage_ids = self.repository.list_homepage_business_ids()
        businesses = self.businesses_repository.get_businesses_by_ids(
            homepage_ids,
            approved_only=True,
        )
        businesses_by_id = {business.id: business for business in businesses}
        return [
            self._to_business_summary(businesses_by_id[business_id])
            for business_id in homepage_ids
            if business_id in businesses_by_id
        ]

    def get_businesses(
        self,
        actor: UserSummary,
        status_filter: Optional[BusinessModerationStatus] = None,
        search: Optional[str] = None,
    ) -> List[AdminBusinessQueueItem]:
        self._ensure_admin(actor)
        businesses = self.repository.list_businesses(status_filter)
        normalized_search = self.sanitize_text(search)
        if normalized_search:
            businesses = [
                item
                for item in businesses
                if self._matches_search(
                    [
                        item.id,
                        build_public_id("business", item.id),
                        item.owner_id,
                        build_public_id("owner", item.owner_id),
                        item.name,
                        item.owner_name,
                        item.owner_email,
                        item.city,
                        item.state,
                    ],
                    normalized_search,
                )
            ]
        ordered_businesses = sorted(
            businesses,
            key=lambda item: (
                self._business_status_order[item.status],
                -item.created_at.timestamp(),
            ),
        )
        return [self._to_admin_business_item(item) for item in ordered_businesses]

    def get_reviews(
        self,
        actor: UserSummary,
        status_filter: Optional[ReviewModerationStatus] = None,
    ) -> List[AdminReviewQueueItem]:
        self._ensure_admin(actor)
        reviews = self.repository.list_reviews(status_filter)
        ordered_reviews = sorted(
            reviews,
            key=lambda item: (
                0 if item.status == "flagged" else 1,
                -item.created_at.timestamp(),
            ),
        )
        return [self._to_admin_review_item(item) for item in ordered_reviews]

    def get_conversations(self, actor: UserSummary) -> List[AdminConversationCase]:
        self._ensure_admin(actor)
        conversations = [
            self._to_admin_conversation_case(item)
            for item in self.repository.list_conversations()
        ]
        return sorted(
            conversations,
            key=lambda item: (
                self._conversation_case_status_order[item.case_status],
                0 if item.priority == "high" else 1,
                -self.parse_timestamp(item.last_message_at).timestamp(),
            ),
        )

    def get_audit_actions(self, actor: UserSummary) -> List[AdminActionRecord]:
        self._ensure_admin(actor)
        return [
            self._to_admin_action_record(item)
            for item in self.repository.list_audit_actions()
        ]

    def get_accounts(
        self,
        actor: UserSummary,
        *,
        search: Optional[str] = None,
        role_filter: Optional[str] = None,
    ) -> List[AdminAccountSummary]:
        self._ensure_admin(actor)
        normalized_search = self.sanitize_text(search)
        normalized_role = self.sanitize_text(role_filter)
        if normalized_role is not None:
            normalized_role = normalized_role.lower()
            if normalized_role not in {"customer", "owner", "technician", "admin"}:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unknown role filter",
                )

        accounts = self.repository.list_accounts(
            search=None,
            role_filter=normalized_role,
        )
        summaries = [self._to_admin_account_summary(account) for account in accounts]
        if normalized_search:
            summaries = [
                account
                for account in summaries
                if self._matches_search(
                    [
                        account.id,
                        account.public_id,
                        account.name,
                        account.email,
                        account.phone,
                    ],
                    normalized_search,
                )
            ]
        return summaries

    def get_account(self, user_id: str, actor: UserSummary) -> AdminAccountSummary:
        self._ensure_admin(actor)
        resolved_user_id = self._resolve_account_identifier(user_id)
        account = self.repository.get_account(resolved_user_id)
        if account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found",
            )
        return self._to_admin_account_summary(account)

    def update_account(
        self,
        user_id: str,
        input_data: UpdateAdminAccountRequest,
        actor: UserSummary,
    ) -> AdminAccountSummary:
        self._ensure_admin(actor)
        resolved_user_id = self._resolve_account_identifier(user_id)
        current_account = self.repository.get_account(resolved_user_id)
        if current_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found",
            )

        provided_fields = input_data.model_fields_set
        if not provided_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No account changes were provided",
            )

        next_name = self.sanitize_text(input_data.name) if "name" in provided_fields else None
        next_email = (
            self.normalize_email(input_data.email) if "email" in provided_fields else None
        )
        next_phone = self.sanitize_text(input_data.phone) if "phone" in provided_fields else None
        next_status = input_data.status if "status" in provided_fields else None

        if "name" in provided_fields and not next_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name cannot be empty",
            )
        if "email" in provided_fields and not next_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email cannot be empty",
            )
        if next_email and not is_valid_email_address(next_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email format is invalid",
            )

        if next_email:
            existing_user = self.auth_repository.get_user_by_email(next_email)
            if existing_user is not None and existing_user.id != resolved_user_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="That email is already registered",
                )

        with self.db.begin():
            self.repository.update_account(
                resolved_user_id,
                full_name=next_name,
                email=next_email,
                phone=next_phone,
                phone_provided="phone" in provided_fields,
                status_value=next_status,
            )
            self.repository.create_admin_action(
                admin_user_id=actor.id,
                target_type="user_account",
                target_id=resolved_user_id,
                action="update_account",
                metadata=self._serialize_admin_metadata(
                    extra={
                        "updatedFields": sorted(provided_fields),
                        "status": next_status,
                    },
                ),
            )

        updated_account = self.repository.get_account(resolved_user_id)
        if updated_account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found after update",
            )
        return self._to_admin_account_summary(updated_account)

    def create_account_access_session(
        self,
        user_id: str,
        input_data: CreateAdminAccessSessionRequest,
        actor: UserSummary,
    ) -> SessionPayload:
        self._ensure_admin(actor)
        resolved_user_id = self._resolve_account_identifier(user_id)
        target_user = self.auth_repository.get_user_by_id(resolved_user_id)
        if target_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found",
            )

        note = self.sanitize_text(input_data.note)
        session_payload = self._build_access_session_payload(
            target_user=target_user,
            admin_actor=actor,
            note=note,
        )
        with self.db.begin():
            self.repository.create_admin_action(
                admin_user_id=actor.id,
                target_type="account_access",
                target_id=resolved_user_id,
                action="issue_access_session",
                metadata=self._serialize_admin_metadata(
                    note=note,
                    extra={
                        "targetRole": target_user.roles[0] if target_user.roles else "customer",
                        "expiresAt": session_payload.expires_at,
                    },
                ),
            )
        return session_payload

    def update_homepage_placement(
        self,
        business_id: str,
        input_data: UpdateHomepageBusinessRequest,
        actor: UserSummary,
    ) -> BusinessSummary:
        self._ensure_admin(actor)
        resolved_business_id = self._resolve_business_identifier(business_id)
        approved_business = self.businesses_repository.get_business(resolved_business_id)
        if approved_business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found in the homepage queue",
            )

        with self.db.begin():
            current_featured_ids = self.repository.list_featured_business_ids(
                excluded_business_id=resolved_business_id,
            )
            normalized_featured_ids = list(current_featured_ids)
            if input_data.featured_on_homepage:
                insert_index = min(
                    len(normalized_featured_ids),
                    max(0, input_data.homepage_rank - 1),
                )
                normalized_featured_ids.insert(insert_index, resolved_business_id)
            self.repository.persist_homepage_order(normalized_featured_ids)

        updated_business = self.businesses_repository.get_business(resolved_business_id)
        if updated_business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found after homepage update",
            )
        return self._to_business_summary(updated_business)

    def update_business_status(
        self,
        business_id: str,
        input_data: UpdateBusinessStatusRequest,
        actor: UserSummary,
    ) -> AdminBusinessQueueItem:
        self._ensure_admin(actor)
        resolved_business_id = self._resolve_business_identifier(business_id)
        existing_business = self.repository.get_business(resolved_business_id)
        if existing_business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found",
            )

        with self.db.begin():
            if input_data.status != "approved":
                self.repository.update_business_status(
                    resolved_business_id,
                    status_value=input_data.status,
                    featured_on_homepage=False,
                    homepage_rank=999,
                )
                featured_ids = self.repository.list_featured_business_ids(
                    excluded_business_id=resolved_business_id,
                )
                self.repository.persist_homepage_order(featured_ids)
            else:
                self.repository.update_business_status(
                    resolved_business_id,
                    status_value=input_data.status,
                )

            updated_business = self.repository.get_business(resolved_business_id)
            if updated_business is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Business not found",
                )

            self.repository.create_notification(
                user_id=updated_business.owner_id,
                notification_type="system",
                title="Business moderation update",
                body=f"{updated_business.name} is now {input_data.status.replace('_', ' ')}.",
            )
            self.repository.create_admin_action(
                admin_user_id=actor.id,
                target_type="business",
                target_id=resolved_business_id,
                action=f"{input_data.status}_business",
                metadata=self._serialize_admin_metadata(
                    input_data.note,
                    {"previousStatus": existing_business.status},
                ),
            )

        return self._to_admin_business_item(updated_business)

    def update_review_status(
        self,
        review_id: str,
        input_data: UpdateReviewStatusRequest,
        actor: UserSummary,
    ) -> AdminReviewQueueItem:
        self._ensure_admin(actor)
        existing_review = self.repository.get_review(review_id)
        if existing_review is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found",
            )

        with self.db.begin():
            self.repository.update_review_status(review_id, input_data.status)
            self.repository.refresh_business_review_metrics(existing_review.business_id)
            updated_review = self.repository.get_review(review_id)
            if updated_review is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Review not found",
                )
            self.repository.create_admin_action(
                admin_user_id=actor.id,
                target_type="review",
                target_id=review_id,
                action=f"{input_data.status}_review",
                metadata=self._serialize_admin_metadata(
                    input_data.note,
                    {"previousStatus": existing_review.status},
                ),
            )

        return self._to_admin_review_item(updated_review)

    def update_conversation_case_status(
        self,
        conversation_id: str,
        input_data: UpdateConversationCaseStatusRequest,
        actor: UserSummary,
    ) -> AdminConversationCase:
        self._ensure_admin(actor)
        conversation = self.repository.get_conversation(conversation_id)
        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        action = (
            "watch_conversation"
            if input_data.status == "watched"
            else "resolve_conversation"
            if input_data.status == "resolved"
            else "reopen_conversation"
        )

        with self.db.begin():
            self.repository.create_admin_action(
                admin_user_id=actor.id,
                target_type="conversation",
                target_id=conversation_id,
                action=action,
                metadata=self._serialize_admin_metadata(input_data.note),
            )

        participant_names = self.repository.list_conversation_participant_names(
            conversation_id,
        )
        last_message = conversation.last_message or conversation.latest_message or "No messages yet."
        last_message_at = (
            conversation.last_message_at
            or conversation.latest_message_at
            or conversation.created_at
        )
        return AdminConversationCase(
            id=conversation.id,
            business_id=conversation.business_id,
            business_name=conversation.business_name,
            booking_id=conversation.booking_id,
            participant_names=participant_names,
            last_message=last_message,
            last_message_at=self.brain.processing.dates.to_utc_iso(last_message_at).replace(
                "+00:00",
                "Z",
            ),
            message_count=conversation.message_count,
            priority=self._conversation_priority(last_message, conversation.booking_id),
            case_status=input_data.status,
        )
