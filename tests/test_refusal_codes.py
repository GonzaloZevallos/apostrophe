"""Every refusal the backend can answer carries an explicit `code`, and the front's
contract (`web/src/api/contract.json`) lists exactly that set, with the right `kind`
(docs/adr/0008).

The checker walks each router's `TranslateErrors` registrations and, for every class it
finds, also walks that class's own Python subclasses — a concrete rule (`InvalidName`)
is usually reached only through its base (`VarietyRuleBroken`) in the tuple, but it must
carry its own `code`, not one inherited from the base.
"""

import json
import re
from pathlib import Path

import pytest

from app.accounts.adapters.router import as_http as accounts_as_http
from app.catalog.adapters.router import as_http as catalog_as_http
from app.customers.adapters.router import as_http as customers_as_http
from app.expenses.adapters.router import as_http as expenses_as_http
from app.http_errors import TranslateErrors
from app.main import create_app
from app.onboarding.adapters.router import as_http as onboarding_as_http
from app.payments.adapters.router import as_http as payments_as_http
from app.pinned_catalog.adapters.router import as_http as pinned_catalog_as_http
from app.results.adapters.router import as_http as results_as_http
from app.sales.adapters.router import as_http as sales_as_http
from app.static_spa import SHARED_FRONT_PATHS
from app.stock.adapters.router import as_http as stock_as_http
from app.varieties.adapters.router import as_http as varieties_as_http
from tests.conftest import SETTINGS, TEST_HASHER, MovableClock
from tests.fakes.telegram import FakeTelegram

CONTRACT_PATH = Path(__file__).resolve().parent.parent / "web" / "src" / "api" / "contract.json"

TRANSLATORS: list[TranslateErrors] = [
    accounts_as_http,
    customers_as_http,
    varieties_as_http,
    expenses_as_http,
    sales_as_http,
    stock_as_http,
    catalog_as_http,
    payments_as_http,
    results_as_http,
    pinned_catalog_as_http,
    onboarding_as_http,
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


def backend_codes_of(by_class: dict[type[Exception], tuple[str, int]]) -> dict[str, str]:
    """Each discovered code with the kind its status implies (404 → `gone`, every
    other status → `refusal`), plus the codes added outside any `TranslateErrors`
    (`EXTRA_CODES`)."""
    codes = {code: ("gone" if status == 404 else "refusal") for code, status in by_class.values()}
    return codes | EXTRA_CODES


def check_contract(backend_codes: dict[str, str], refusal_codes: dict[str, dict[str, str]]) -> None:
    """Raises `AssertionError` unless `refusal_codes` (`contract.json`'s shape) lists
    exactly `backend_codes`' keys, each with the matching kind — this is the
    enforcement artefact the tests below exercise on bad input, not only on the real
    files."""
    missing = set(backend_codes) - set(refusal_codes)
    if missing:
        raise AssertionError(f"contract.json is missing {sorted(missing)}")
    extra = set(refusal_codes) - set(backend_codes)
    if extra:
        raise AssertionError(f"contract.json lists {sorted(extra)}, the backend never answers them")
    for code, kind in backend_codes.items():
        listed = refusal_codes[code]["kind"]
        if listed != kind:
            raise AssertionError(f"{code!r} answers {kind!r}, contract.json says {listed!r}")


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


def test_two_classes_sharing_a_code_fail_the_checker() -> None:
    """Proven negative (CODING_STANDARDS §5): a duplicate code must make the checker
    raise, whichever of the two classes is reached second."""

    class _First(Exception):
        code = "duplicate.code"

    class _Second(Exception):
        code = "duplicate.code"

    bad_translator = TranslateErrors([(422, (_First, _Second))])

    with pytest.raises(AssertionError, match="duplicate.code"):
        discover_codes([bad_translator])


def test_contract_json_lists_exactly_the_backend_s_codes_with_the_right_kind() -> None:
    by_class = discover_codes(TRANSLATORS)
    contract = json.loads(CONTRACT_PATH.read_text())

    check_contract(backend_codes_of(by_class), contract["refusalCodes"])


def test_the_contract_check_fails_when_the_contract_is_missing_a_backend_code() -> None:
    with pytest.raises(AssertionError, match="missing"):
        check_contract({"a.code": "refusal"}, {})


def test_the_contract_check_fails_when_the_contract_lists_a_code_the_backend_lacks() -> None:
    with pytest.raises(AssertionError, match="never answers"):
        check_contract({}, {"a.code": {"kind": "refusal"}})


def test_the_contract_check_fails_when_a_gone_code_is_labelled_refusal() -> None:
    with pytest.raises(AssertionError, match="a.code"):
        check_contract({"a.code": "gone"}, {"a.code": {"kind": "refusal"}})


def check_front_segment_overlap(
    api_first_segments: set[str],
    front_segments: set[str],
    shared_front_paths: frozenset[str],
) -> None:
    """A segment both the API and the front name is only allowed when an exact entry of
    `SHARED_FRONT_PATHS` serves the front there (docs/adr/0024); the
    front's own segments that no API route shares need none."""
    shared_segments = {path.strip("/").split("/", 1)[0] for path in shared_front_paths}
    unserved = (api_first_segments & front_segments) - shared_segments
    assert not unserved, f"the API and the front both claim {sorted(unserved)} with no shared entry"


def test_an_api_path_segment_is_a_front_segment_only_through_a_shared_front_path(
    clock: MovableClock,
) -> None:
    contract = json.loads(CONTRACT_PATH.read_text())
    front_segments: set[str] = set(contract["frontSegments"])

    document = create_app(
        SETTINGS,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    ).openapi()
    api_first_segments = {
        path.strip("/").split("/", 1)[0] for path in document["paths"] if path != "/"
    }

    check_front_segment_overlap(
        api_first_segments, front_segments, SHARED_FRONT_PATHS
    )
    assert {"expenses", "varieties"} <= api_first_segments & front_segments


def test_the_overlap_check_accepts_a_segment_a_shared_path_serves() -> None:
    check_front_segment_overlap(
        {"expenses", "varieties", "sales"}, {"expenses", "varieties", "entrar"}, SHARED_FRONT_PATHS
    )


def test_the_overlap_check_rejects_a_segment_with_no_shared_path() -> None:
    with pytest.raises(AssertionError, match="settings"):
        check_front_segment_overlap(
            {"expenses", "settings"}, {"expenses", "settings"}, SHARED_FRONT_PATHS
        )


REFUSALS_COPY_PATH = (
    Path(__file__).resolve().parent.parent / "web" / "src" / "copy" / "refusals.ts"
)


def copy_codes_of(source: str) -> set[str]:
    """The refusal codes `REFUSAL_BY_CODE` (web/src/copy/refusals.ts) has a key for."""
    start = source.index("export const REFUSAL_BY_CODE")
    return set(re.findall(r"^\s*'([A-Za-z_]+(?:\.[a-z_]+)?)':", source[start:], re.MULTILINE))


def check_copy_covers(contract_codes: set[str], copy_codes: set[str]) -> None:
    """Raises `AssertionError` naming a contract code `copy/refusals` has no key for, or a
    key for a code the contract does not list."""
    missing = contract_codes - copy_codes
    if missing:
        raise AssertionError(f"copy/refusals has no key for {sorted(missing)}")
    extra = copy_codes - contract_codes
    if extra:
        raise AssertionError(f"copy/refusals has keys for {sorted(extra)}, not in contract.json")


def test_every_contract_code_has_a_key_in_the_refusal_copy() -> None:
    contract = json.loads(CONTRACT_PATH.read_text())

    check_copy_covers(set(contract["refusalCodes"]), copy_codes_of(REFUSALS_COPY_PATH.read_text()))


def test_the_copy_check_fails_for_a_code_with_no_key_and_for_a_key_with_no_code() -> None:
    with pytest.raises(AssertionError, match="no key for.*a.code"):
        check_copy_covers({"a.code", "b.code"}, {"b.code"})
    with pytest.raises(AssertionError, match="c.code.*not in contract.json"):
        check_copy_covers({"a.code"}, {"a.code", "c.code"})


def test_the_refusal_copy_is_english_and_repeats_no_input() -> None:
    source = REFUSALS_COPY_PATH.read_text()
    texts = re.findall(r"^\s+\w+: '((?:[^'\\]|\\.)+)',?$", source, re.MULTILINE)

    assert texts, "no refusal text found"
    for text in texts:
        assert not re.search(r"[áéíóúñ¿¡]", text), "a Spanish letter in the refusal copy"
        assert "${" not in text, "a refusal must repeat nothing typed"
