"""What the app reads from its environment, read once at startup.

`create_app` takes a `Settings` so tests never touch the environment.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DEFAULT_DATABASE_URL = "sqlite:///./apostrophe.db"
DEFAULT_PUBLIC_URL = "http://localhost:8000"
# Where a removed business's export file is written (app/business_removal); never
# served, never inside the repository.
DEFAULT_EXPORT_DIR = "~/apostrophe-exports"


class MissingSetting(RuntimeError):
    def __init__(self, name: str) -> None:
        super().__init__(f"{name} is not set; see .env.example")


@dataclass(frozen=True)
class Settings:
    secret_key: str
    database_url: str = DEFAULT_DATABASE_URL
    # Where users reach the app; invitation links start with it.
    public_url: str = DEFAULT_PUBLIC_URL
    # The built front (`npm run build`'s `web/dist`), served same-origin next to the
    # API (`scripts/serve.sh`). `None` means no front is served; tests leave it `None`
    # so pytest never needs a build.
    web_dist: Path | None = None
    # Read by `app.business_removal`, never by the app itself: a run's operator can
    # point it anywhere outside the repository.
    export_dir: Path = Path(DEFAULT_EXPORT_DIR)

    @classmethod
    def from_env(cls) -> Settings:
        web_dist = os.environ.get("APOSTROPHE_WEB_DIST", "")
        return cls(
            secret_key=_required("APOSTROPHE_SECRET_KEY"),
            database_url=os.environ.get("APOSTROPHE_DATABASE_URL", DEFAULT_DATABASE_URL),
            public_url=os.environ.get("APOSTROPHE_PUBLIC_URL", DEFAULT_PUBLIC_URL).rstrip("/"),
            web_dist=Path(web_dist) if web_dist else None,
            export_dir=Path(os.environ.get("APOSTROPHE_EXPORT_DIR", DEFAULT_EXPORT_DIR)),
        )


def _required(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise MissingSetting(name)
    return value
