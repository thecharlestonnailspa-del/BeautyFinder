from typing import List

from fastapi import APIRouter, Depends

from app.api.deps import get_current_session, get_favorites_service
from app.domains.favorites.service import FavoritesService
from app.schemas.auth import SessionPayload
from app.schemas.favorites import FavoriteWithBusiness

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=List[FavoriteWithBusiness])
def get_favorites(
    session: SessionPayload = Depends(get_current_session),
    service: FavoritesService = Depends(get_favorites_service),
) -> List[FavoriteWithBusiness]:
    return service.get_favorites(session.user)


@router.post("/{business_id}", response_model=List[FavoriteWithBusiness])
def add_favorite(
    business_id: str,
    session: SessionPayload = Depends(get_current_session),
    service: FavoritesService = Depends(get_favorites_service),
) -> List[FavoriteWithBusiness]:
    return service.add_favorite(session.user, business_id)


@router.delete("/{business_id}", response_model=List[FavoriteWithBusiness])
def remove_favorite(
    business_id: str,
    session: SessionPayload = Depends(get_current_session),
    service: FavoritesService = Depends(get_favorites_service),
) -> List[FavoriteWithBusiness]:
    return service.remove_favorite(session.user, business_id)
