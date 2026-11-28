---
status: draft
---
## Goal

Add a `share` to each Expense category that `/analysis` returns, in `month_expenses` and in `since_first_record_expenses`. It is the whole-number percent of the category's total over the sum of all category totals in the same list, Purchases excluded. It serves a seller who wants to see where the money goes without dividing in their head. This part is backend-only groundwork; a later part of GH-1233 shows the share on screen. To make the percent rule shared, `percent` moves verbatim from `app/results/domain/rounding.py` to `app/shared/rounding.py`.

## Acceptance criteria

- `percent` lives in `app/shared/rounding.py` with its docstring: the ADR-0020 and ADR-0058 rationale and the Fraction rule, with "results percentage path" changed to "percentage path".
- `percent` keeps its single call to `app.shared.ratio.round_ratio_half_up`.
- `app/results/domain/rounding.py` is deleted with no shim, and `period_figures.py` and `today_series.py` import `percent` from `app.shared.rounding`.
- `ExpenseCategoryTotal` and `ExpenseCategoryTotalOut` have `share: int | None`, and `assemble.py` copies it.
- `_expense_breakdown` computes the total of the category totals, Purchases excluded, then sets each `share = percent(c.total, total)` on domain integers, never on a Decimal.
- An HTTP test with Expenses of 1, 3 and 4 in three categories in one month gets shares 13, 38 and 50 on both `month_expenses` and `since_first_record_expenses`.
- An HTTP test with Expenses of 1 and 2 gets 33 and 67 on both lists.
- A month with no Expense gives `categories == []`.
- `tests/shared/test_rounding.py` merges `tests/results/test_percent.py` and `tests/results/test_rounding_percent.py`, each case once: the half-up table on both signs, a zero base giving `None`, large values, and scaling both arguments by 100 giving the same percent. Both old files are deleted.
- `tests/results/pins/analysis.json` gains `"share":100` and is compared byte for byte.
- `tests/fixtures/openapi_snapshot.json` gains `share` on `ExpenseCategoryTotalOut`.
- `web/src/api/fixtures/analysis.json` carries shares 62/38 and 55/45 and is validated strictly.
- Every other `/panel` and `/analysis` test passes unedited. The empty-shape assertion in `tests/test_business_isolation.py` is unchanged.
- Grepping the repository for `results.domain.rounding` gives no hits.
- `mypy --strict` and `ruff` pass with nothing silenced, and `HEXAGON_ROOTS` is unchanged.

## Out of scope

- Any change on screen, in `web/src/api/analysis.ts` or in the generated `docs/api`.
- Any change to existing `/panel` or `/analysis` figures.
- Normalising shares to add up to 100.
- Creating `app/results/domain/methods.py` or touching `buckets.py`; those belong to later parts of GH-1233.

## Decisions

- The share is computed on the stored domain integers, not on the Decimal that crosses the wire.
  - Reason: the ratio is then the same at Money scale 0 and 2 (ADR-0058), which was a settled success criterion.
- Shares are not normalised and may add up to 99 or 101; the later screen must not adjust a category to reach 100.
  - Reason: each category rounds on its own by the one shared percent rule, and adjusting one would show a figure that is not its own.
- `share` stays `int | None` even though `/analysis` cannot produce `null` today.
  - Reason: `percent` returns `None` on a zero base, and the domain rejecting zero-amount Expenses is what keeps the API from reaching it; the domain test of `percent` proves the rule.
- A scale case (`percent(a*100, b*100) == percent(a, b)`) is added to the merged rounding test.
  - Reason: it is the check for the settled criterion that the share does not depend on the Money scale.

## Risks

A missed import of the old module path would break at import time. The repository-wide grep for `results.domain.rounding` and the full test run cover it.
Byte-for-byte pins and the strict front fixture fail if the key order or formatting of `share` differs from what the serializer emits. Regenerate them, don't edit them by hand.

## Screens

none

## Slices

### expense-category-share

#### Acceptance criteria

- `percent` is importable only from `app.shared.rounding`, the old module is deleted with no shim, and grepping for `results.domain.rounding` gives no hits.
- `/analysis` returns `share` on each category of `month_expenses` and `since_first_record_expenses`: 13/38/50 for Expenses of 1/3/4, 33/67 for 1/2, and `categories == []` for a month with no Expense.
- `tests/shared/test_rounding.py` replaces the two old percent test files, and covers both signs, a zero base giving `None`, large values and scale invariance.
- The pin, the OpenAPI snapshot and `web/src/api/fixtures/analysis.json` carry the new key. Every other `/panel` and `/analysis` test passes unedited.
- `mypy --strict` and `ruff` pass with nothing silenced, and `HEXAGON_ROOTS` is unchanged.

#### Risks

- stale-import-path
- byte-pin-drift
