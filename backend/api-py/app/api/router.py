from fastapi import APIRouter

from app.api.routes import (
    admin,
    availability,
    auth,
    bookings,
    businesses,
    customer_insights,
    favorites,
    health,
    messaging,
    notifications,
    payments,
    reviews,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(businesses.router)
api_router.include_router(customer_insights.router)
api_router.include_router(favorites.router)
api_router.include_router(availability.router)
api_router.include_router(bookings.router)
api_router.include_router(messaging.router)
api_router.include_router(notifications.router)
api_router.include_router(payments.router)
api_router.include_router(reviews.router)
api_router.include_router(admin.router)
