from fastapi import HTTPException, status
from fastapi import APIRouter, Depends

from app.api.deps import get_auth_service, get_current_session
from app.domains.auth.service import AuthService
from app.schemas.auth import (
    LoginRequest,
    RegisterBusinessOwnerRequest,
    RegisterCustomerRequest,
    RegisterPrivateTechnicianRequest,
    SessionPayload,
    UserSummary,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/session", response_model=SessionPayload)
def get_session(session: SessionPayload = Depends(get_current_session)) -> SessionPayload:
    return session


@router.get("/me", response_model=UserSummary)
def get_me(
    session: SessionPayload = Depends(get_current_session),
    service: AuthService = Depends(get_auth_service),
) -> UserSummary:
    if not session.user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authenticated user was not found",
        )
    return service.get_user_by_id(session.user.id)


@router.post("/login", response_model=SessionPayload)
def login(
    input_data: LoginRequest,
    service: AuthService = Depends(get_auth_service),
) -> SessionPayload:
    return service.login(input_data)


@router.post("/register/customer", response_model=SessionPayload)
def register_customer(
    input_data: RegisterCustomerRequest,
    service: AuthService = Depends(get_auth_service),
) -> SessionPayload:
    return service.register_customer(input_data)


@router.post("/register/business", response_model=SessionPayload)
def register_business_owner(
    input_data: RegisterBusinessOwnerRequest,
    service: AuthService = Depends(get_auth_service),
) -> SessionPayload:
    return service.register_business_owner(input_data)


@router.post("/register/technician", response_model=SessionPayload)
def register_private_technician(
    input_data: RegisterPrivateTechnicianRequest,
    service: AuthService = Depends(get_auth_service),
) -> SessionPayload:
    return service.register_private_technician(input_data)
