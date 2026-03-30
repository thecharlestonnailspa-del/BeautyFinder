from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class DatabaseSchemaHealth(CamelModel):
    status: str
    required_tables: List[str] = Field(alias="requiredTables")
    missing_tables: List[str] = Field(default_factory=list, alias="missingTables")


class DependencyHealth(CamelModel):
    configured: bool
    status: str
    detail: Optional[str] = None
    schema_details: Optional[DatabaseSchemaHealth] = Field(default=None, alias="schema")


class HealthResponse(CamelModel):
    status: str
    service: str
    environment: str
    database: DependencyHealth
    redis: DependencyHealth
