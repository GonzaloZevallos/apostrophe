"""What the app reads from its environment, read once at startup.

`create_app` takes a `Settings` so tests never touch the environment.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from ipaddress import IPv4Network, IPv6Network, ip_network
from pathlib import Path

from app.shared.copy import missing_keys
from app.shared.copy.messages import po_path
from app.shared.language import ENGLISH, TEST_LOCALE, Language

DEFAULT_DATABASE_URL = "sqlite:///./apostrophe.db"
DEFAULT_PUBLIC_URL = "http://localhost:8000"
# Where a removed business's export file is written (app/business_removal); never
# served, never inside the repository.
DEFAULT_EXPORT_DIR = "~/apostrophe-exports"
# The gettext catalogs (docs/adr/0050), next to the code that reads them.
DEFAULT_LOCALES_DIR = Path(__file__).resolve().parent / "shared" / "copy" / "locales"
# How many missing key ids an `IncompleteLanguage` diagnostic names.
_NAMED_MISSING_KEYS = 5


class MissingSetting(RuntimeError):
    def __init__(self, name: str) -> None:
        super().__init__(f"{name} is not set; see .env.example")


class InvalidSetting(RuntimeError):
    def __init__(self, name: str) -> None:
        # Never the value: a malformed CIDR could otherwise put an operator's network
        # layout into a log line (CODING_STANDARDS section 9).
        super().__init__(f"{name} is invalid; see .env.example")


class IncompleteLanguage(RuntimeError):
    """A language the installation would offer lacks copy. An English diagnostic for the
    operator: the tag and the first missing key ids, nothing else."""

    def __init__(self, tag: str, missing: tuple[str, ...]) -> None:
        named = ", ".join(missing[:_NAMED_MISSING_KEYS])
        more = " and more" if len(missing) > _NAMED_MISSING_KEYS else ""
        super().__init__(f"Language {tag} is incomplete; missing keys: {named}{more}")


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
    # Where the `.po` catalogs live; tests point it at a fixture directory.
    locales_dir: Path = DEFAULT_LOCALES_DIR
    # The languages a business may choose, and the language of operator output. Never
    # read from the environment: #317 decides how the operator chooses.
    selectable_languages: tuple[Language, ...] = (ENGLISH,)
    operator_language: Language = ENGLISH
    # APOSTROPHE_FORCED_LANGUAGE: only the test locale, to judge layout.
    forced_language: Language | None = None

    def __post_init__(self) -> None:
        # Parse first: a CIDR that cannot be parsed is refused on its own, whether or
        # not `public_url` is https.
        self.trusted_networks()
        if self.secure_cookie and not self.trusted_proxies:
            raise MissingSetting("APOSTROPHE_TRUSTED_PROXIES")
        self._check_languages()

    def _check_languages(self) -> None:
        if self.forced_language is not None and (
            self.forced_language != TEST_LOCALE
            or not po_path(self.locales_dir, self.forced_language.tag).is_file()
        ):
            raise InvalidSetting("APOSTROPHE_FORCED_LANGUAGE")
        if TEST_LOCALE in self.selectable_languages:
            raise InvalidSetting("selectable_languages")
        if self.operator_language == TEST_LOCALE:
            raise InvalidSetting("operator_language")
        for language in (*self.selectable_languages, self.operator_language):
            missing = missing_keys(self.locales_dir, language)
            if missing:
                raise IncompleteLanguage(language.tag, missing)

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
            forced_language=_forced_language(os.environ.get("APOSTROPHE_FORCED_LANGUAGE", "")),
            export_dir=Path(os.environ.get("APOSTROPHE_EXPORT_DIR", DEFAULT_EXPORT_DIR)),
        )


def _forced_language(raw: str) -> Language | None:
    if not raw:
        return None
    if raw != TEST_LOCALE.tag:
        raise InvalidSetting("APOSTROPHE_FORCED_LANGUAGE")
    return TEST_LOCALE


def _required(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise MissingSetting(name)
    return value
