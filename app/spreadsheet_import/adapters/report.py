"""The import's report, printed to the operator's terminal (ADR-0018; PRD "What the
report may show"). It may name customers and show amounts; it never shows a phone
number, because nothing here ever reads `PlannedCustomer.phone_key` or any other
`phone_key` field. It is never logged: `adapters/cli.py` writes it only to `out`.
"""

from __future__ import annotations

from typing import TextIO

from app.spreadsheet_import.domain.plan import ImportPlan

# A fixed hint for a problem kind whose cause isn't the cell's value but how the file
# stores it (GH-55; import.md "What blocks"): never the cell's own value, so this
# stays a lookup on `kind` alone.
_HINTS: dict[str, str] = {
    "text_is_date": (
        "a date where text is expected; re-type the cell as text (in Google Sheets, "
        "start it with an apostrophe) and run again"
    ),
}


def _problem_message(kind: str) -> str:
    hint = _HINTS.get(kind)
    return f"{kind}: {hint}" if hint else kind


def _switches_turned_on(plan: ImportPlan) -> str:
    names = [
        name
        for name, on in (
            ("Precio por cantidad", plan.turns_on.is_bulk_pricing),
            ("Clientes VIP", plan.turns_on.is_vip_customers),
        )
        if on
    ]
    return ", ".join(names) if names else "none"


def print_report(plan: ImportPlan, *, business_name: str, dry_run: bool, out: TextIO) -> None:
    kind = "Dry run" if dry_run else "Import"
    out.write(f"{kind}: {business_name}\n")

    counts = plan.counts
    out.write("Counts:\n")
    out.write(f"  Varieties: {counts.varieties}\n")
    out.write(f"  Price entries: {counts.price_entries}\n")
    out.write(f"  Catalog attributes: {counts.catalog_attributes}\n")
    out.write(f"  Stock entries: {counts.stock_entries}\n")
    out.write(f"  Expense categories: {counts.expense_categories}\n")
    out.write(f"  Expenses: {counts.expenses}\n")
    out.write(f"  Customers: {counts.customers}\n")
    out.write(f"  Customers without a phone number: {counts.customers_without_phone}\n")
    out.write(f"  Sales: {counts.sales}\n")
    out.write(f"  Payments: {counts.payments}\n")

    out.write(f"Switches turned on: {_switches_turned_on(plan)}\n")

    if plan.problems:
        out.write("Blocking problems:\n")
        for problem in plan.problems:
            out.write(
                f"  {problem.ref.sheet} row {problem.ref.row} "
                f"[{problem.column}]: {_problem_message(problem.kind)}\n"
            )

    if plan.unfinished:
        out.write("Left out as unfinished:\n")
        for row in plan.unfinished:
            out.write(f"  {row.sheet} row {row.ref.row}: {row.text}\n")

    if plan.mismatches:
        out.write("Total mismatches (sheet vs. recomputed):\n")
        for mismatch in plan.mismatches:
            out.write(
                f"  {mismatch.ref.sheet} row {mismatch.ref.row}: "
                f"{mismatch.sheet_total} vs. {mismatch.recomputed_total}\n"
            )

    if plan.merged_categories:
        out.write("Categories merged by name:\n")
        for merged in plan.merged_categories:
            out.write(f"  {', '.join(merged.names)}\n")

    if plan.merged_customers:
        out.write("Spellings merged into one customer:\n")
        for customer in plan.merged_customers:
            out.write(f"  {', '.join(customer.spellings)} -> kept: {customer.kept_name}\n")

    if plan.unused_mapping_entries:
        out.write("Unused mapping entries:\n")
        for name in plan.unused_mapping_entries:
            out.write(f"  {name}\n")

    out.write(f"Writable: {'yes' if plan.writable else 'no'}\n")
