from fastapi import APIRouter, Depends

from app.api.deps import get_health_service
from app.domains.health.service import HealthService
from app.schemas.health import HealthResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
def get_health(service: HealthService = Depends(get_health_service)) -> HealthResponse:
    return service.read_health()
