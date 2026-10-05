"""The composition root for the spreadsheet import (ADR-0018).

    scripts/import-spreadsheet.sh <business-id> <file.xlsx> [--mapping PATH] [--dry-run]

The mapping is optional (ADR-0019; ADR-0018's amendment): leaving it out behaves
exactly like giving an empty one, `ParsedMapping((), ())`.

`run` is the tested seam: it takes the engine, the clock and the streams, so a test
runs it over an in-memory database and a movable clock, and reads the figures back
through the HTTP API. `main` only wires the real ones.

One `try` covers the whole run. On any exception but `KeyboardInterrupt`, exiting the
`with Session(...)` block discards every uncommitted write (`Session.close`'s own
behaviour), and the handler prints only the refusal's own fixed `code`, or the
exception's class name when it has none — never `str(exc)` and never a traceback (the
plan's invariant: no phone number, name or amount ever reaches `stdout` or `stderr`).
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import TextIO

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.import_port import BusinessDirectory
from app.accounts.adapters.sql_accounts import SqlAccounts
from app.catalog.adapters.import_port import CatalogImport
from app.clock import Clock, business_day, system_clock
from app.customers.adapters.import_port import CustomersImport
from app.db import make_engine
from app.expenses.adapters.import_port import ExpensesImport
from app.migrations.runner import upgrade_to_head
from app.payments.adapters.import_port import PaymentsImport
from app.sales.adapters.import_port import SalesImport
from app.settings import Settings
from app.spreadsheet_import.adapters import layout
from app.spreadsheet_import.adapters.cells import read_workbook
from app.spreadsheet_import.adapters.mapping import read_mapping
from app.spreadsheet_import.adapters.report import print_report
from app.spreadsheet_import.application.plan_import import has_any_records, plan_import
from app.spreadsheet_import.application.write_import import write_import
from app.spreadsheet_import.domain.rows import (
    HeaderFooterCells,
    ParsedMapping,
    ParsedWorkbook,
    SheetRef,
)
from app.stock.adapters.import_port import SqlStockImport
from app.varieties.adapters.import_port import VarietiesImport as SqlVarietiesImport


class _BusinessUnknown(Exception):
    code = "import.business_unknown"


# Eligibility (PRD "the refusal comes before any sheet check") is decided before the
# workbook or the mapping is even opened, so a business that already has records is
# refused the same way whatever state the file is in — never `refused: BadZipFile` or
# `refused: FileNotFoundError` in its place. `plan_import` re-checks eligibility first
# itself either way; these stand in for an unopened file only on that one path.
_EMPTY_WORKBOOK = ParsedWorkbook(
    varieties=(),
    price_history=(),
    catalog=(),
    header_footer=HeaderFooterCells(header="", footer=""),
    categories=(),
    entradas=(),
    gastos=(),
    ventas=(),
    problems=(),
)
_EMPTY_MAPPING = ParsedMapping(entries=(), problems=())


def _parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="import-spreadsheet")
    parser.add_argument("business_id", type=int)
    parser.add_argument("xlsx_path", type=Path)
    parser.add_argument("--mapping", dest="mapping_path", type=Path, default=None)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def run(argv: Sequence[str], *, engine: Engine, clock: Clock, out: TextIO, err: TextIO) -> int:
    args = _parse_args(argv)
    try:
        return _run(args, engine, clock, out)
    except KeyboardInterrupt:
        raise
    except Exception as exc:  # the plan's invariant: never str(exc), never a traceback
        code = getattr(exc, "code", None) or type(exc).__name__
        err.write(f"refused: {code}\n")
        return 1


def _run(args: argparse.Namespace, engine: Engine, clock: Clock, out: TextIO) -> int:
    with Session(engine) as session:
        directory = BusinessDirectory(SqlAccounts(session))
        business_name = directory.name_of(args.business_id)
        if business_name is None:
            raise _BusinessUnknown()

        instant = clock()
        today = business_day(instant)

        varieties = SqlVarietiesImport(session, args.business_id)
        stock = SqlStockImport(session, args.business_id)
        catalog = CatalogImport(session, args.business_id)
        expenses = ExpensesImport(session, args.business_id)
        customers = CustomersImport(session, args.business_id)
        sales = SalesImport(session, args.business_id)
        payments = PaymentsImport(session, args.business_id)

        ineligible = has_any_records(varieties, stock, expenses, customers, sales, payments)
        if ineligible:
            parsed, mapping = _EMPTY_WORKBOOK, _EMPTY_MAPPING
        else:
            parsed = read_workbook(args.xlsx_path)
            mapping = (
                read_mapping(args.mapping_path) if args.mapping_path is not None else _EMPTY_MAPPING
            )

        plan = plan_import(
            parsed,
            mapping,
            varieties=varieties,
            stock=stock,
            catalog=catalog,
            expenses=expenses,
            customers=customers,
            sales=sales,
            payments=payments,
            today=today,
            mapping_sheet=layout.MAPPING_FILE,
            header_footer_ref=SheetRef(layout.CATALOGO_SHEET, layout.HEADER_ROW),
            business_ref=SheetRef(layout.BUSINESS_SHEET, layout.NO_ROW),
        )

        print_report(plan, business_name=business_name, dry_run=args.dry_run, out=out)

        if args.dry_run:
            return 0
        if not plan.writable:
            return 1

        write_import(
            plan,
            parsed,
            varieties=varieties,
            stock=stock,
            catalog=catalog,
            expenses=expenses,
            customers=customers,
            sales=sales,
            payments=payments,
            import_instant=instant,
            today=today,
        )
        session.commit()
        return 0


def main(argv: list[str] | None = None) -> int:
    settings = Settings.from_env()
    engine = make_engine(settings.database_url)
    upgrade_to_head(engine)

    return run(
        argv if argv is not None else sys.argv[1:],
        engine=engine,
        clock=system_clock,
        out=sys.stdout,
        err=sys.stderr,
    )


if __name__ == "__main__":
    raise SystemExit(main())
