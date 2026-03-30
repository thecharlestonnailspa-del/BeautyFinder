from typing import Generator, Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.domains.admin.service import AdminService
from app.domains.availability.service import AvailabilityService
from app.domains.auth.service import AuthService
from app.domains.bookings.service import BookingsService
from app.domains.businesses.service import BusinessesService
from app.domains.customer_insights.service import CustomerInsightsService
from app.domains.favorites.service import FavoritesService
from app.domains.health.service import HealthService
from app.domains.messaging.service import MessagingService
from app.domains.notifications.service import NotificationsService
from app.domains.payments.service import PaymentsService
from app.domains.reviews.service import ReviewsService
from app.schemas.auth import SessionPayload


def get_settings_dep() -> Settings:
    return get_settings()


def get_db(
    settings: Settings = Depends(get_settings_dep),
) -> Generator[Session, None, None]:
    yield from get_db_session(settings)


def get_auth_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> AuthService:
    return AuthService(db, settings)


def get_current_session(
    authorization: Optional[str] = Header(default=None),
    service: AuthService = Depends(get_auth_service),
) -> SessionPayload:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must use Bearer token",
        )

    try:
        return service.verify_access_token(token)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
        ) from exc


def get_health_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> HealthService:
    return HealthService(settings, db)


def get_businesses_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> BusinessesService:
    return BusinessesService(db, settings)


def get_favorites_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> FavoritesService:
    return FavoritesService(db, settings)


def get_customer_insights_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> CustomerInsightsService:
    return CustomerInsightsService(db, settings)


def get_availability_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> AvailabilityService:
    return AvailabilityService(db, settings)


def get_bookings_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> BookingsService:
    return BookingsService(db, settings)


def get_messaging_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> MessagingService:
    return MessagingService(db, settings)


def get_notifications_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> NotificationsService:
    return NotificationsService(db, settings)


def get_payments_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> PaymentsService:
    return PaymentsService(db, settings)


def get_reviews_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> ReviewsService:
    return ReviewsService(db, settings)


def get_admin_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> AdminService:
    return AdminService(db, settings)
