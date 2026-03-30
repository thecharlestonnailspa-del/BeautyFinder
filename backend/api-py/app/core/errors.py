from typing import NoReturn

from fastapi import HTTPException, status


def raise_not_implemented(capability: str) -> NoReturn:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=f"{capability} is not migrated from NestJS yet",
    )
