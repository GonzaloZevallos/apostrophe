"""The import's report, printed to the operator's terminal (ADR-0018; PRD "What the
report may show"). It may name customers and show amounts; it never shows a phone
number, because nothing here ever reads `PlannedCustomer.phone_key` or any other
`phone_key` field. It is never logged: `adapters/cli.py` writes it only to `out`.
"""

from __future__ import annotations

from typing import TextIO

from app.shared.copy import OperatorText
from app.spreadsheet_import.domain.plan import ImportPlan

# The problem kinds whose cause isn't the cell's value but how the file stores it
# (GH-55; import.md "What blocks"): a fixed hint keyed on `kind` alone, never the cell's
# own value.
_HINT_KEYS: dict[str, str] = {"text_is_date": "operator.import.hint_text_is_date"}


def _problem_message(kind: str, text: OperatorText) -> str:
    hint_key = _HINT_KEYS.get(kind)
    return text(hint_key, kind=kind) if hint_key else kind


def _switches_turned_on(plan: ImportPlan, text: OperatorText) -> str:
    keys = [
        key
        for key, on in (
            ("operator.import.switch_bulk_pricing", plan.turns_on.is_bulk_pricing),
            ("operator.import.switch_vip_customers", plan.turns_on.is_vip_customers),
        )
        if on
    ]
    return ", ".join(text(key) for key in keys) if keys else text("operator.import.switch_none")


def print_report(
    plan: ImportPlan, *, business_name: str, dry_run: bool, out: TextIO, text: OperatorText
) -> None:
    """Every line is rendered before anything is written, so a line that cannot be
    rendered leaves `out` untouched (the caller prints the one refusal line)."""
    lines = [
        text(
            "operator.import.dry_run" if dry_run else "operator.import.import",
            business_name=business_name,
        ),
        text("operator.import.counts_heading"),
    ]
    counts = plan.counts
    for name, value in (
        ("varieties", counts.varieties),
        ("price_entries", counts.price_entries),
        ("catalog_attributes", counts.catalog_attributes),
        ("stock_entries", counts.stock_entries),
        ("expense_categories", counts.expense_categories),
        ("expenses", counts.expenses),
        ("customers", counts.customers),
        ("customers_without_phone", counts.customers_without_phone),
        ("sales", counts.sales),
        ("payments", counts.payments),
    ):
        lines.append(text(f"operator.import.count_{name}", count=str(value)))

    lines.append(text("operator.import.switches", switches=_switches_turned_on(plan, text)))

    if plan.problems:
        lines.append(text("operator.import.problems_heading"))
        for problem in plan.problems:
            lines.append(
                text(
                    "operator.import.problem_line",
                    sheet=problem.ref.sheet,
                    row=str(problem.ref.row),
                    column=problem.column,
                    problem=_problem_message(problem.kind, text),
                )
            )

    if plan.unfinished:
        lines.append(text("operator.import.unfinished_heading"))
        for row in plan.unfinished:
            lines.append(
                text(
                    "operator.import.unfinished_line",
                    sheet=row.sheet,
                    row=str(row.ref.row),
                    text=row.text,
                )
            )

    if plan.mismatches:
        lines.append(text("operator.import.mismatches_heading"))
        for mismatch in plan.mismatches:
            lines.append(
                text(
                    "operator.import.mismatch_line",
                    sheet=mismatch.ref.sheet,
                    row=str(mismatch.ref.row),
                    sheet_total=str(mismatch.sheet_total),
                    recomputed_total=str(mismatch.recomputed_total),
                )
            )

    if plan.merged_categories:
        lines.append(text("operator.import.merged_categories_heading"))
        for merged in plan.merged_categories:
            lines.append(
                text("operator.import.merged_category_line", names=", ".join(merged.names))
            )

    if plan.merged_customers:
        lines.append(text("operator.import.merged_customers_heading"))
        for customer in plan.merged_customers:
            lines.append(
                text(
                    "operator.import.merged_customer_line",
                    spellings=", ".join(customer.spellings),
                    kept_name=customer.kept_name,
                )
            )

    if plan.unused_mapping_entries:
        lines.append(text("operator.import.unused_mapping_heading"))
        for name in plan.unused_mapping_entries:
            lines.append(text("operator.import.unused_mapping_line", name=name))

    lines.append(
        text("operator.import.writable_yes" if plan.writable else "operator.import.writable_no")
    )

    for line in lines:
        out.write(f"{line}\n")
