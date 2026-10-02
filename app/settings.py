"""What the app reads from its environment, read once at startup.

`create_app` takes a `Settings` so tests never touch the environment.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

DEFAULT_DATABASE_URL = "sqlite:///./apostrophe.db"
DEFAULT_PUBLIC_URL = "http://localhost:8000"


class MissingSetting(RuntimeError):
    def __init__(self, name: str) -> None:
        super().__init__(f"{name} is not set; see .env.example")


@dataclass(frozen=True)
class Settings:
    secret_key: str
    database_url: str = DEFAULT_DATABASE_URL
    # Where users reach the app; invitation links start with it.
    public_url: str = DEFAULT_PUBLIC_URL

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            secret_key=_required("APOSTROPHE_SECRET_KEY"),
            database_url=os.environ.get("APOSTROPHE_DATABASE_URL", DEFAULT_DATABASE_URL),
            public_url=os.environ.get("APOSTROPHE_PUBLIC_URL", DEFAULT_PUBLIC_URL).rstrip("/"),
        )


def _required(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise MissingSetting(name)
    return value
