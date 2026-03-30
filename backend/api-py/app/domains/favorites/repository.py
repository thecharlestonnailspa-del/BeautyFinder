from dataclasses import dataclass
from datetime import datetime
from typing import List

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class FavoriteListRecord:
    user_id: str
    business_id: str
    created_at: datetime


class FavoritesRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_favorites(self, user_id: str) -> List[FavoriteListRecord]:
        rows = self.db.execute(
            text(
                """
                SELECT "customerId", "businessId", "createdAt"
                FROM "Favorite"
                WHERE "customerId" = :user_id
                ORDER BY "createdAt" DESC
                """,
            ),
            {"user_id": user_id},
        ).mappings()

        return [
            FavoriteListRecord(
                user_id=str(row["customerId"]),
                business_id=str(row["businessId"]),
                created_at=row["createdAt"],
            )
            for row in rows
        ]

    def add_favorite(self, user_id: str, business_id: str) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO "Favorite" ("customerId", "businessId", "createdAt")
                VALUES (:user_id, :business_id, NOW())
                ON CONFLICT ("customerId", "businessId") DO NOTHING
                """,
            ),
            {
                "user_id": user_id,
                "business_id": business_id,
            },
        )

    def remove_favorite(self, user_id: str, business_id: str) -> None:
        self.db.execute(
            text(
                """
                DELETE FROM "Favorite"
                WHERE "customerId" = :user_id
                  AND "businessId" = :business_id
                """,
            ),
            {
                "user_id": user_id,
                "business_id": business_id,
            },
        )
