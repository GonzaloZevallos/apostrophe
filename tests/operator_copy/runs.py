"""Every operator command and the import report, run in one place, so the tests can compare
the same lines across languages (docs/adr/0050 and its amendment).

`run_operator_commands` drives `accounts.adapters.cli.main`, `business_removal.adapters.cli.main`
and the removal use cases, `spreadsheet_import.adapters.cli.run` and `report.print_report`,
and hands back every line they printed, every key `OperatorText` rendered and every value
passed to it (the data a line carries).
"""

from __future__ import annotations

import io
import re
from collections.abc import Callable, Mapping
from contextlib import redirect_stderr, redirect_stdout
from dataclasses import dataclass, field, replace
from decimal import Decimal
from functools import partial
from pathlib import Path
from typing import Any

import pytest
from babel.support import Translations
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.adapters import cli as accounts_cli
from app.accounts.adapters.tables import BusinessRow
from app.business_removal.adapters import cli as removal_cli
from app.business_removal.adapters.operator_words import TranslatedOperatorWords
from app.business_removal.application.remove_business import (
    Interrupted,
    RecordsChanged,
    StorageBusy,
    dry_run,
    failure_message,
    remove_business,
)
from app.business_removal.application.schema_rows import DeletedIds
from app.business_removal.domain.business_ref import BusinessRef
from app.business_removal.domain.naming import terminal_name
from app.business_removal.domain.schema import Column, ColumnType, ForeignKey, Schema, Table
from app.db import make_engine
from app.settings import Settings
from app.shared.copy import OperatorText
from app.shared.language import Language
from app.shared.pricing_settings import PricingSettings
from app.spreadsheet_import.adapters import cli as import_cli
from app.spreadsheet_import.adapters.report import print_report
from app.spreadsheet_import.domain.plan import (
    ByName,
    Counts,
    ImportPlan,
    MergedCategory,
    Mismatch,
    PlannedCustomer,
    UnfinishedRow,
)
from app.spreadsheet_import.domain.rows import CellProblem, SheetRef
from tests.business_removal.adapters.seed import (
    EMAIL_LEAVING,
    accept_invitation,
    build_app,
    seed,
    set_env,
)
from tests.conftest import NOW, MovableClock
from tests.spreadsheet_import.test_cli import _save_mapping, _save_workbook, _workbook

GROUPS = ("accounts", "removal", "import", "report")
OWNER_EMAIL = "duena@example.com"
UNKNOWN_EMAIL = "nadie@example.com"
LEAVING_BUSINESS = "La Huerta"
IMPORT_BUSINESS = "Primer Negocio"
CLOCK = MovableClock(NOW)


@dataclass(frozen=True)
class Languages:
    """The languages a run's `Settings` are given in place of the environment's defaults."""

    locales_dir: Path
    selectable_languages: tuple[Language, ...]
    operator_language: Language


@dataclass(frozen=True)
class Line:
    group: str
    scenario: str
    stream: str
    text: str


@dataclass
class Capture:
    lines: list[Line] = field(default_factory=list)
    keys: set[str] = field(default_factory=set)
    data: set[str] = field(default_factory=set)

    def of(self, group: str) -> list[Line]:
        return [line for line in self.lines if line.group == group]


class Recording(OperatorText):
    """The operator's translator, recording each key it renders and each value it is given;
    a key in `planted` is answered with that literal instead (a line left untranslated)."""

    def __init__(self, inner: OperatorText, capture: Capture, planted: Mapping[str, str]) -> None:
        super().__init__(Translations())
        self._inner = inner
        self._capture = capture
        self._planted = planted

    def __call__(self, key: str, **data: str) -> str:
        line = self._planted[key] if key in self._planted else self._inner(key, **data)
        self._capture.keys.add(key)
        self._capture.data.update(data.values())
        return line


def _record(
    capture: Capture, group: str, scenario: str, out: io.StringIO, err: io.StringIO
) -> None:
    for stream, buffer in (("out", out), ("err", err)):
        for text in buffer.getvalue().splitlines():
            capture.lines.append(Line(group, scenario, stream, text))


def _call(capture: Capture, group: str, scenario: str, action: Callable[[], object]) -> None:
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        action()
    _record(capture, group, scenario, out, err)


def _env(monkeypatch: pytest.MonkeyPatch, db_path: Path, export_dir: Path) -> None:
    set_env(monkeypatch, db_path, export_dir)
    monkeypatch.setenv("APOSTROPHE_PUBLIC_URL", "http://localhost:8000")


# -- accounts ---------------------------------------------------------------------------


def _accounts(
    capture: Capture, monkeypatch: pytest.MonkeyPatch, root: Path, export_dir: Path
) -> None:
    db_path = root / "accounts.db"
    application, engine = build_app(db_path, CLOCK)
    with TestClient(application) as client:
        accept_invitation(client, engine, CLOCK, LEAVING_BUSINESS, OWNER_EMAIL)
    engine.dispose()
    _env(monkeypatch, db_path, export_dir)
    for scenario, argv in (
        ("invite-business", ["invite-business"]),
        ("reset-known", ["reset-password", OWNER_EMAIL]),
        ("reset-unknown", ["reset-password", UNKNOWN_EMAIL]),
    ):
        _call(capture, "accounts", scenario, partial(accounts_cli.main, argv, clock=CLOCK))
    # The database cannot be opened: the one `refused: <ClassName>` line after the
    # translator is built.
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{root / 'missing' / 'x.db'}")
    _call(
        capture, "accounts", "refused", lambda: accounts_cli.main(["invite-business"], clock=CLOCK)
    )
    # Links are data: a URL that opens a business, or lets a password be chosen.
    for line in capture.of("accounts"):
        if line.text.startswith("http"):
            capture.data.add(line.text)


# -- business removal -------------------------------------------------------------------


def _removal_cli(
    capture: Capture, monkeypatch: pytest.MonkeyPatch, root: Path, export_dir: Path
) -> None:
    db_path = root / "removal.db"
    clock = MovableClock(NOW)
    seed(db_path, clock)
    _env(monkeypatch, db_path, export_dir)
    capture.data.add(terminal_name(LEAVING_BUSINESS))
    for scenario, argv, answer in (
        ("dry-run", [EMAIL_LEAVING, "--dry-run"], ""),
        ("no-business", [UNKNOWN_EMAIL], ""),
        ("wrong-name", [EMAIL_LEAVING], "otro nombre\n"),
        ("removal", [EMAIL_LEAVING], f"{LEAVING_BUSINESS}\n"),
    ):
        out = io.StringIO()
        removal_cli.main(argv, stdin=io.StringIO(answer), stdout=out, clock=clock)
        _record(capture, "removal", scenario, out, io.StringIO())


def _col(name: str, type_: ColumnType = ColumnType.INTEGER) -> Column:
    return Column(name, type_, nullable=False, primary_key=False)


_PK = Column("id", ColumnType.INTEGER, nullable=False, primary_key=True)
_BUSINESS_FK = ForeignKey(("business_id",), "business", ("id",))


def _table(name: str, *extra: Column, foreign: tuple[ForeignKey, ...] = (_BUSINESS_FK,)) -> Table:
    return Table(name, (_PK, _col("business_id"), *extra), foreign)


_BUSINESS_TABLE = Table("business", (_PK, _col("name", ColumnType.TEXT)), ())
_CUSTOMER = _table("customer", _col("name", ColumnType.TEXT))
_INVITATION = _table("invitation")


def _schemas() -> dict[str, Schema]:
    """A sound schema, and one for each reason to refuse, each tripping only its own check."""
    sound = Schema((_BUSINESS_TABLE, _CUSTOMER, _INVITATION))
    return {
        "sound": sound,
        "unowned": Schema(
            (*sound.tables, Table("mystery", (_PK, _col("value", ColumnType.TEXT)), ()))
        ),
        "secret": Schema(
            (
                _BUSINESS_TABLE,
                _table(
                    "customer", _col("name", ColumnType.TEXT), _col("api_token", ColumnType.TEXT)
                ),
            )
        ),
        "other-type": Schema(
            (
                _BUSINESS_TABLE,
                _table("customer", _col("name", ColumnType.TEXT), _col("shape", ColumnType.OTHER)),
            )
        ),
        "unlabelled": Schema((_BUSINESS_TABLE, _table("widget"))),
        "cycle": Schema(
            (
                _BUSINESS_TABLE,
                _table(
                    "a",
                    _col("b_id"),
                    _col("name", ColumnType.TEXT),
                    foreign=(_BUSINESS_FK, ForeignKey(("b_id",), "b", ("id",))),
                ),
                _table(
                    "b",
                    _col("a_id"),
                    _col("name", ColumnType.TEXT),
                    foreign=(_BUSINESS_FK, ForeignKey(("a_id",), "a", ("id",))),
                ),
            )
        ),
    }


class _Rows:
    def __init__(self, schema: Schema) -> None:
        self._schema = schema

    def schema(self) -> Schema:
        return self._schema

    def business_of(self, email: str) -> BusinessRef | None:
        if email != OWNER_EMAIL:
            return None
        return BusinessRef(id=1, name=LEAVING_BUSINESS, language="en")

    def rows(self, table: str, business_id: int) -> list[dict[str, Any]]:
        if table == "business":
            return [{"id": 1, "name": LEAVING_BUSINESS, "language": "en"}]
        return [{"id": 5, "business_id": 1, "name": "Juana"}] if table == "customer" else []

    def withheld_count(self, table: str, business_id: int) -> int:
        return 2

    def delete_business(self, business_id: int, order: tuple[str, ...]) -> DeletedIds:
        tables = {name: frozenset(row["id"] for row in self.rows(name, 1)) for name in order}
        tables.pop("invitation", None)
        return DeletedIds(tables=tables, withheld_counts={"invitation": 2}, login_guard_count=1)


class _Export:
    def __init__(self) -> None:
        self._document: dict[str, Any] = {}

    def prepare(self) -> Path:
        return Path("/fake-export-dir")

    def write_durably(self, name: str, document: dict[str, Any]) -> Path:
        self._document = document
        return Path("/fake-export-dir") / name

    def read_back(self, path: Path) -> dict[str, Any]:
        return self._document

    def discard(self) -> None: ...

    def keep(self) -> None: ...


class _Confirm:
    def ask(self, prompt: str) -> str | None:
        return f"{LEAVING_BUSINESS}\n"


class _Transaction:
    def __init__(self, fails: bool) -> None:
        self._fails = fails

    def commit(self) -> None:
        if self._fails:
            raise RuntimeError("connection dropped")

    def rollback(self) -> None: ...


class _Lines:
    def __init__(self) -> None:
        self.lines: list[str] = []

    def line(self, text: str) -> None:
        self.lines.append(text)


def _removal_use_cases(capture: Capture, text: OperatorText) -> None:
    words = TranslatedOperatorWords(text)
    capture.data.add(terminal_name(LEAVING_BUSINESS))
    for name, schema in _schemas().items():
        for mode in ("dry", "real"):
            output = _Lines()
            if mode == "dry":
                dry_run(_Rows(schema), output, words, OWNER_EMAIL)
            else:
                remove_business(
                    _Rows(schema),
                    _Export(),
                    _Confirm(),
                    _Transaction(fails=False),
                    output,
                    words,
                    CLOCK,
                    OWNER_EMAIL,
                )
            for line in output.lines:
                capture.lines.append(Line("removal", f"use-case-{name}-{mode}", "out", line))
    # The commit itself raises: an unknown outcome, with the counts exported so far.
    unknown = _Lines()
    remove_business(
        _Rows(_schemas()["sound"]),
        _Export(),
        _Confirm(),
        _Transaction(fails=True),
        unknown,
        words,
        CLOCK,
        OWNER_EMAIL,
    )
    for line in unknown.lines:
        capture.lines.append(Line("removal", "use-case-unknown-outcome", "out", line))
    for failure in (RecordsChanged(), Interrupted(), StorageBusy(), RuntimeError("secret")):
        capture.lines.append(
            Line(
                "removal",
                f"failure-{type(failure).__name__}",
                "out",
                failure_message(failure, words),
            )
        )


# -- the import and its report -----------------------------------------------------------


def _business_id(db_path: Path) -> int:
    engine = make_engine(f"sqlite:///{db_path}")
    with Session(engine) as session:
        found = session.scalars(
            select(BusinessRow).where(BusinessRow.name == IMPORT_BUSINESS)
        ).one()
    engine.dispose()
    assert found.id is not None
    return found.id


def _import(capture: Capture, root: Path, text: OperatorText) -> None:
    db_path = root / "import.db"
    clock = MovableClock(NOW)
    application, engine = build_app(db_path, clock)
    with TestClient(application) as client:
        accept_invitation(client, engine, clock, IMPORT_BUSINESS, "importa@example.com")
    business_id = str(_business_id(db_path))
    xlsx = _save_workbook(_workbook(), root)
    mapping = _save_mapping(root, (("Juan Perez", "1123456789"),))
    for scenario, argv in (
        ("dry-run", [business_id, str(xlsx), "--mapping", str(mapping), "--dry-run"]),
        ("real", [business_id, str(xlsx), "--mapping", str(mapping)]),
        # The business now has records: the plan's problem line, and `Writable: no`.
        ("has-records", [business_id, str(xlsx), "--mapping", str(mapping)]),
        ("unknown-business", ["999999", str(xlsx)]),
    ):
        out, err = io.StringIO(), io.StringIO()
        import_cli.run(argv, engine=engine, clock=clock, out=out, err=err, text=text)
        _record(capture, "import", scenario, out, err)
    engine.dispose()
    capture.data.update({IMPORT_BUSINESS, str(xlsx)})


def _full_plan(*, bulk: bool, vip: bool) -> ImportPlan:
    sheet = SheetRef("Ventas", 4)
    turned_on = PricingSettings(is_bulk_pricing=bulk, is_vip_customers=vip)
    return ImportPlan(
        problems=(
            CellProblem(SheetRef("Ventas", 2), "Fecha", "grams_not_numeric"),
            CellProblem(SheetRef("Ajustes", 7), "Nombre", "text_is_date"),
        ),
        unfinished=(UnfinishedRow(sheet, "Ventas", "Revisar con Marta"),),
        mismatches=(Mismatch(sheet, Decimal("100.50"), 100),),
        customers=(
            PlannedCustomer(
                "Marta Gimenez", ("Marta Gimenez", "marta gimenez "), True, ByName("m")
            ),
        ),
        merged_categories=(MergedCategory("insumos", ("Insumos", "insumos ")),),
        unused_mapping_entries=("Nadie Conocido",),
        counts=Counts(1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
        entrada_order=(),
        venta_order=(),
        sales=(),
        needs=turned_on,
        turns_on=turned_on,
    )


def _report(capture: Capture, text: OperatorText) -> None:
    for scenario, plan, dry in (
        ("every-branch-dry", _full_plan(bulk=True, vip=True), True),
        ("every-branch-real", _full_plan(bulk=True, vip=False), False),
        ("one-switch", _full_plan(bulk=False, vip=True), True),
    ):
        out = io.StringIO()
        print_report(plan, business_name=IMPORT_BUSINESS, dry_run=dry, out=out, text=text)
        _record(capture, "report", scenario, out, io.StringIO())
    capture.data.add(IMPORT_BUSINESS)


# -- all of it ---------------------------------------------------------------------------


def run_operator_commands(
    root: Path,
    monkeypatch: pytest.MonkeyPatch,
    *,
    languages: Languages | None = None,
    planted: Mapping[str, str] | None = None,
    groups: tuple[str, ...] = GROUPS,
) -> Capture:
    """Runs the chosen `groups` under `root`. `languages` replace those of the `Settings`
    the commands read from the environment;
    `APOSTROPHE_FORCED_LANGUAGE` is read from the environment as the commands read it."""
    capture = Capture()
    from_env = Settings.from_env
    translator = Settings.operator_translator

    def settings_from_env(_cls: type[Settings]) -> Settings:
        settings = from_env()
        if languages is None:
            return settings
        return replace(
            settings,
            locales_dir=languages.locales_dir,
            selectable_languages=languages.selectable_languages,
            operator_language=languages.operator_language,
        )

    def recording_translator(settings: Settings) -> OperatorText:
        return Recording(translator(settings), capture, planted or {})

    monkeypatch.setattr(Settings, "from_env", classmethod(settings_from_env))
    monkeypatch.setattr(Settings, "operator_translator", recording_translator)
    root.mkdir(parents=True, exist_ok=True)
    export_dir = root / "exports"
    _env(monkeypatch, root / "unused.db", export_dir)
    text = Settings.from_env().operator_translator()
    if "accounts" in groups:
        _accounts(capture, monkeypatch, root, export_dir)
    if "removal" in groups:
        _removal_cli(capture, monkeypatch, root, export_dir)
        _removal_use_cases(capture, text)
    if "import" in groups:
        _import(capture, root, text)
    if "report" in groups:
        _report(capture, text)
    return capture


NORMALISED_URL = re.compile(r"^(http\S*/)[^/\s]+$")


def normalised(line: Line, root: Path) -> tuple[str, str, str, str]:
    """A line with what differs between two runs by construction -- the temporary directory
    and a link's random token -- replaced, so two runs compare byte for byte otherwise."""
    text = NORMALISED_URL.sub(r"\1<token>", line.text.replace(str(root), "<root>"))
    return (line.group, line.scenario, line.stream, text)
