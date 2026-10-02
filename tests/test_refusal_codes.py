"""Every refusal the backend can answer carries an explicit `code`, and the front's
contract (`web/src/api/contract.json`) lists exactly that set, with the right `kind`
(docs/adr/0007).

The checker walks each router's `TranslateErrors` registrations and, for every class it
finds, also walks that class's own Python subclasses — a concrete rule (`InvalidName`)
is usually reached only through its base (`VarietyRuleBroken`) in the tuple, but it must
carry its own `code`, not one inherited from the base.
"""

import json
from pathlib import Path

import pytest

from app.accounts.adapters.router import as_http as accounts_as_http
from app.customers.adapters.router import as_http as customers_as_http
from app.expenses.adapters.router import as_http as expenses_as_http
from app.http_errors import TranslateErrors
from app.main import create_app
from app.varieties.adapters.router import as_http as varieties_as_http
from tests.conftest import SETTINGS, TEST_HASHER

CONTRACT_PATH = Path(__file__).resolve().parent.parent / "web" / "src" / "api" / "contract.json"

TRANSLATORS: list[TranslateErrors] = [
    accounts_as_http,
    customers_as_http,
    varieties_as_http,
    expenses_as_http,
]

# Added by the app-wide 422 handler (ADR-0005), not by any `TranslateErrors`: still
# part of the contract the front maps.
EXTRA_CODES = {"RequestInvalid": "refusal"}


def _subclasses(cls: type[Exception]) -> set[type[Exception]]:
    found = {cls}
    for sub in cls.__subclasses__():
        found |= _subclasses(sub)
    return found


def _code_of(cls: type[Exception]) -> str:
    """`cls`'s own `code`, never one inherited from a base (`vars` only looks at the
    class's own `__dict__`)."""
    value = vars(cls)["code"]
    assert isinstance(value, str)
    return value


def discover_codes(translators: list[TranslateErrors]) -> dict[type[Exception], tuple[str, int]]:
    """Every exception class reachable from a translator's registrations, each with
    its own `code` and the status it answers. Raises `AssertionError` naming any class
    with no `code` of its own, or the first duplicate code found — this is the
    enforcement artefact `tests/test_refusal_codes.py` exercises on bad input below."""
    by_class: dict[type[Exception], tuple[str, int]] = {}
    codes_seen: dict[str, type[Exception]] = {}
    for translator in translators:
        for status, base in translator.registered():
            for cls in _subclasses(base):
                if cls in by_class:
                    continue  # an earlier, more specific status already claimed it
                if "code" not in vars(cls):
                    raise AssertionError(f"{cls.__qualname__} has no code of its own")
                code = _code_of(cls)
                if code in codes_seen and codes_seen[code] is not cls:
                    raise AssertionError(f"{code!r} is used by both {codes_seen[code]} and {cls}")
                codes_seen[code] = cls
                by_class[cls] = (code, status)
    return by_class


def test_every_registered_exception_has_its_own_unique_code() -> None:
    by_class = discover_codes(TRANSLATORS)

    assert len(by_class) > 0


def test_a_class_with_no_code_of_its_own_fails_the_checker() -> None:
    """Proven negative (CODING_STANDARDS §5): a class reachable from a translator but
    missing a `code` of its own must make the checker raise, not pass silently."""

    class _Broken(Exception):
        pass

    bad_translator = TranslateErrors([(422, (_Broken,))])

    with pytest.raises(AssertionError, match="_Broken"):
        discover_codes([bad_translator])


def test_contract_json_lists_exactly_the_backend_s_codes_with_the_right_kind() -> None:
    by_class = discover_codes(TRANSLATORS)
    contract = json.loads(CONTRACT_PATH.read_text())
    refusal_codes: dict[str, dict[str, str]] = contract["refusalCodes"]

    backend_codes = {
        code: ("gone" if status == 404 else "refusal") for code, status in by_class.values()
    }
    backend_codes |= EXTRA_CODES

    assert set(refusal_codes) == set(backend_codes)
    for code, kind in backend_codes.items():
        assert refusal_codes[code]["kind"] == kind, code


def test_no_api_path_segment_is_a_front_segment() -> None:
    contract = json.loads(CONTRACT_PATH.read_text())
    front_segments: set[str] = set(contract["frontSegments"])

    document = create_app(SETTINGS, hasher=TEST_HASHER).openapi()
    api_first_segments = {
        path.strip("/").split("/", 1)[0] for path in document["paths"] if path != "/"
    }

    assert api_first_segments.isdisjoint(front_segments)
