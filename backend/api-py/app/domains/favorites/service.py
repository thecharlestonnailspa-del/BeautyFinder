from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.domains.base import BaseDomainService
from app.domains.businesses.repository import BusinessesRepository
from app.domains.businesses.service import BusinessesService
from app.domains.favorites.repository import FavoriteListRecord, FavoritesRepository
from app.schemas.auth import UserSummary
from app.schemas.favorites import FavoriteWithBusiness


class FavoritesService(BaseDomainService):
    def __init__(self, db: Session, settings: Settings) -> None:
        super().__init__(db, settings)
        self.repository = FavoritesRepository(db)
        self.businesses_repository = BusinessesRepository(db)
        self.businesses_service = BusinessesService(db, settings)

    def _ensure_customer(self, actor: UserSummary) -> None:
        if actor.role != "customer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this resource",
            )

    def _to_favorite_with_business(
        self,
        favorite: FavoriteListRecord,
        business,
    ) -> FavoriteWithBusiness:
        return FavoriteWithBusiness(
            user_id=favorite.user_id,
            business_id=favorite.business_id,
            created_at=self.brain.processing.dates.to_utc_iso(
                favorite.created_at,
            ).replace("+00:00", "Z"),
            business=self.businesses_service._to_business_summary(business),
        )

    def get_favorites(self, actor: UserSummary) -> List[FavoriteWithBusiness]:
        self._ensure_customer(actor)

        favorites = self.repository.list_favorites(actor.id)
        businesses = self.businesses_repository.get_businesses_by_ids(
            [favorite.business_id for favorite in favorites],
            approved_only=False,
        )
        businesses_by_id = {business.id: business for business in businesses}

        return [
            self._to_favorite_with_business(favorite, businesses_by_id[favorite.business_id])
            for favorite in favorites
            if favorite.business_id in businesses_by_id
        ]

    def add_favorite(
        self,
        actor: UserSummary,
        business_id: str,
    ) -> List[FavoriteWithBusiness]:
        self._ensure_customer(actor)

        businesses = self.businesses_repository.get_businesses_by_ids(
            [business_id],
            approved_only=False,
        )
        if not businesses:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found",
            )

        with self.db.begin():
            self.repository.add_favorite(actor.id, business_id)

        return self.get_favorites(actor)

    def remove_favorite(
        self,
        actor: UserSummary,
        business_id: str,
    ) -> List[FavoriteWithBusiness]:
        self._ensure_customer(actor)

        with self.db.begin():
            self.repository.remove_favorite(actor.id, business_id)

        return self.get_favorites(actor)
