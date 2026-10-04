"""What the app reads from its environment, read once at startup.

`create_app` takes a `Settings` so tests never touch the environment.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from ipaddress import IPv4Network, IPv6Network, ip_network
from pathlib import Path

DEFAULT_DATABASE_URL = "sqlite:///./apostrophe.db"
DEFAULT_PUBLIC_URL = "http://localhost:8000"
# Where a removed business's export file is written (app/business_removal); never
# served, never inside the repository.
DEFAULT_EXPORT_DIR = "~/apostrophe-exports"


class MissingSetting(RuntimeError):
    def __init__(self, name: str) -> None:
        super().__init__(f"{name} is not set; see .env.example")


class InvalidSetting(RuntimeError):
    def __init__(self, name: str) -> None:
        # Never the value: a malformed CIDR could otherwise put an operator's network
        # layout into a log line (CODING_STANDARDS section 9).
        super().__init__(f"{name} is invalid; see .env.example")


@dataclass(frozen=True)
class Settings:
    secret_key: str
    database_url: str = DEFAULT_DATABASE_URL
    # A Turso auth token (APOSTROPHE_DATABASE_AUTH_TOKEN), passed to the driver as a
    # connect argument, never folded into `database_url` (plan invariant).
    database_auth_token: str | None = None
    # Where users reach the app; invitation links start with it.
    public_url: str = DEFAULT_PUBLIC_URL
    # The built front (`npm run build`'s `web/dist`), served same-origin next to the
    # API (`scripts/serve.sh`). `None` means no front is served; tests leave it `None`
    # so pytest never needs a build.
    web_dist: Path | None = None
    # Read by `app.business_removal`, never by the app itself: a run's operator can
    # point it anywhere outside the repository.
    export_dir: Path = Path(DEFAULT_EXPORT_DIR)
    # Comma-separated CIDRs (APOSTROPHE_TRUSTED_PROXIES): the reverse proxy hops whose
    # `X-Forwarded-For` entry `ClientAddress` (app/accounts/adapters/deps.py) may trust.
    # Kept as text, like `database_url` and `public_url` above; parsed once by
    # `Settings.trusted_networks()`. Empty by default (the home network has no proxy).
    trusted_proxies: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        # Parse first: a CIDR that cannot be parsed is refused on its own, whether or
        # not `public_url` is https.
        self.trusted_networks()
        if self.secure_cookie and not self.trusted_proxies:
            raise MissingSetting("APOSTROPHE_TRUSTED_PROXIES")

    @property
    def secure_cookie(self) -> bool:
        """`Secure` on the session cookie, decided only from configuration (plan
        invariant), never guessed from a request's scheme or headers."""
        return self.public_url.startswith("https://")

    def trusted_networks(self) -> tuple[IPv4Network | IPv6Network, ...]:
        try:
            return tuple(ip_network(cidr, strict=False) for cidr in self.trusted_proxies)
        except ValueError:
            raise InvalidSetting("APOSTROPHE_TRUSTED_PROXIES") from None

    @classmethod
    def from_env(cls) -> Settings:
        web_dist = os.environ.get("APOSTROPHE_WEB_DIST", "")
        trusted_proxies_raw = os.environ.get("APOSTROPHE_TRUSTED_PROXIES", "")
        trusted_proxies = tuple(
            cidr.strip() for cidr in trusted_proxies_raw.split(",") if cidr.strip()
        )
        return cls(
            secret_key=_required("APOSTROPHE_SECRET_KEY"),
            database_url=os.environ.get("APOSTROPHE_DATABASE_URL", DEFAULT_DATABASE_URL),
            database_auth_token=os.environ.get("APOSTROPHE_DATABASE_AUTH_TOKEN") or None,
            public_url=os.environ.get("APOSTROPHE_PUBLIC_URL", DEFAULT_PUBLIC_URL).rstrip("/"),
            web_dist=Path(web_dist) if web_dist else None,
            trusted_proxies=trusted_proxies,
            export_dir=Path(os.environ.get("APOSTROPHE_EXPORT_DIR", DEFAULT_EXPORT_DIR)),
        )


def _required(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise MissingSetting(name)
    return value
