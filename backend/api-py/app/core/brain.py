from typing import Optional

from app.core.authorization import AuthorizationBrain
from app.core.processors import ProcessingBrain


class BackendBrain:
    def __init__(
        self,
        authorization: Optional[AuthorizationBrain] = None,
        processing: Optional[ProcessingBrain] = None,
    ) -> None:
        self.authorization = authorization or AuthorizationBrain()
        self.processing = processing or ProcessingBrain()

    @classmethod
    def default(cls) -> "BackendBrain":
        return cls()
