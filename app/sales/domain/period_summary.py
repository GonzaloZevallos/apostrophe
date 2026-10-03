"""Sales figures summed over a fixed set of sales (results' `PeriodSales` port,
`app/results/application/ports.py`; docs/product/results.md: "Figures per period").

`period_summary` is pure and takes no dates: narrowing to a period's sales is the
adapter's job (`SqlSales.between`), never this function's. `total` always comes from
`Sale.total` (shipping included, never recomputed); grams sold counts every line whose
`PricingRule` is not `GIFT`, grams gifted counts only `GIFT` lines (PRD: "Grams sold",
"Grams gifted"). `Grams` arithmetic only — no float anywhere in this module.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from app.sales.domain.pricing import PricingRule
from app.sales.domain.sale import Sale
from app.shared.grams import Grams


@dataclass(frozen=True)
class PeriodSalesSummary:
    """Sales' own answer for one period. `SqlPeriodSales` is the one place this maps
    onto results' `SalesSummary`, by keyword (plan: "PeriodSales")."""

    total: int
    count: int
    grams_sold: Grams
    grams_gifted: Grams


def period_summary(sales: Sequence[Sale]) -> PeriodSalesSummary:
    total = 0
    grams_sold = Grams(0)
    grams_gifted = Grams(0)
    for sale in sales:
        total += sale.total
        for line in sale.lines:
            if line.pricing_rule is PricingRule.GIFT:
                grams_gifted = grams_gifted + line.grams
            else:
                grams_sold = grams_sold + line.grams
    return PeriodSalesSummary(
        total=total, count=len(sales), grams_sold=grams_sold, grams_gifted=grams_gifted
    )
