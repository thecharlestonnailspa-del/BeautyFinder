from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings

_engines = {}
_session_factories = {}


def get_engine(settings: Settings):
    key = settings.database_url
    if key not in _engines:
        _engines[key] = create_engine(settings.database_url, pool_pre_ping=True)
    return _engines[key]


def get_session_factory(settings: Settings):
    key = settings.database_url
    if key not in _session_factories:
        _session_factories[key] = sessionmaker(
            bind=get_engine(settings),
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )
    return _session_factories[key]


def get_db_session(settings: Settings) -> Generator[Session, None, None]:
    session_factory = get_session_factory(settings)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
