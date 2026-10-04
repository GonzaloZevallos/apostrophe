"""The one computation every period figure goes through (ADR-0013; CONTEXT.md: Sales,
Cost of goods sold, Stock shortfall, Expenses, Profit, Cash, Margin, Margin
percentage, Average margin, Best week, Best weekday).

Scans each ledger once into day buckets (`_Buckets`); every window below — the chosen
month, the last 8 weeks, the last 12 months, the 7 weekdays and since the first
record — reads those buckets, never a second sum over the ledgers themselves. No
`float`, `round()` or `Decimal.quantize` anywhere here.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta

from app.results.domain.costed_sales import costed_sales
from app.results.domain.figures import (
    AmountWithPending,
    AnalysisFigures,
    CostFigure,
    ExpenseBreakdown,
    ExpenseCategoryTotal,
    MarginFigure,
    MonthFigures,
    MonthRowFigures,
    SinceFirstRecordFigures,
    VarietyRow,
    WeekdayFigures,
    WeekFigures,
)
from app.results.domain.ledger import (
    DrawRow,
    ExpenseRecord,
    PaymentRecord,
    PurchaseRecord,
    SaleRecord,
)
from app.results.domain.rounding import percent
from app.shared.calendar import Month, Week
from app.shared.grams import Grams

ZERO = Grams(0)


def _days(start: date, end_inclusive: date) -> list[date]:
    if start > end_inclusive:
        return []
    count = (end_inclusive - start).days + 1
    return [start + timedelta(days=i) for i in range(count)]


@dataclass
class _DayTotals:
    sales_without_shipping: int = 0
    grams: Grams = ZERO
    costed_cost: int = 0
    sales_of_costed: int = 0
    pending_grams: Grams = ZERO


@dataclass
class _VarietyDayTotals:
    sales_without_shipping: int = 0
    grams_sold: Grams = ZERO
    grams_gifted: Grams = ZERO
    costed_cost: int = 0
    sales_of_costed: int = 0
    pending_grams: Grams = ZERO


@dataclass
class _ShortfallDayTotals:
    costed: int = 0
    pending_grams: Grams = ZERO


@dataclass
class _Buckets:
    """Everything `period_figures` scans each ledger into, once; every window below
    reads from here, never from the ledgers again."""

    day_totals: dict[date, _DayTotals] = field(default_factory=dict)
    variety_day_totals: dict[tuple[date, int], _VarietyDayTotals] = field(default_factory=dict)
    shortfall_totals: dict[date, _ShortfallDayTotals] = field(default_factory=dict)
    variety_names: dict[int, str] = field(default_factory=dict)
    sales_by_day: dict[date, int] = field(default_factory=dict)
    weekday_sales: dict[int, int] = field(default_factory=dict)
    weekday_counts: dict[int, int] = field(default_factory=dict)
    payments_by_day: dict[date, int] = field(default_factory=dict)
    expenses_by_day: dict[date, int] = field(default_factory=dict)
    # (name, name_key, amount) per category, per day: built in the one pass over
    # `expenses` below; both breakdowns read it by day range, never the raw list.
    expenses_by_day_category: dict[date, dict[int, tuple[str, str, int]]] = field(
        default_factory=dict
    )
    purchases_by_day: dict[date, int] = field(default_factory=dict)

    def sales(self, start: date, end: date) -> int:
        return sum(self.sales_by_day.get(d, 0) for d in _days(start, end))

    def payments(self, start: date, end: date) -> int:
        return sum(self.payments_by_day.get(d, 0) for d in _days(start, end))

    def expenses(self, start: date, end: date) -> int:
        return sum(self.expenses_by_day.get(d, 0) for d in _days(start, end))

    def purchases(self, start: date, end: date) -> int:
        return sum(self.purchases_by_day.get(d, 0) for d in _days(start, end))

    def sales_without_shipping(self, start: date, end: date) -> int:
        total = 0
        for d in _days(start, end):
            totals = self.day_totals.get(d)
            if totals is not None:
                total += totals.sales_without_shipping
        return total

    def grams(self, start: date, end: date) -> Grams:
        total = ZERO
        for d in _days(start, end):
            totals = self.day_totals.get(d)
            if totals is not None:
                total = total + totals.grams
        return total

    def costed_cost(self, start: date, end: date) -> int:
        total = 0
        for d in _days(start, end):
            totals = self.day_totals.get(d)
            if totals is not None:
                total += totals.costed_cost
        return total

    def sales_of_costed(self, start: date, end: date) -> int:
        total = 0
        for d in _days(start, end):
            totals = self.day_totals.get(d)
            if totals is not None:
                total += totals.sales_of_costed
        return total

    def pending_grams(self, start: date, end: date) -> Grams:
        total = ZERO
        for d in _days(start, end):
            totals = self.day_totals.get(d)
            if totals is not None:
                total = total + totals.pending_grams
        return total

    def shortfall(self, start: date, end: date) -> AmountWithPending | None:
        days = [d for d in _days(start, end) if d in self.shortfall_totals]
        if not days:
            return None
        costed = sum(self.shortfall_totals[d].costed for d in days)
        pending = ZERO
        for d in days:
            pending = pending + self.shortfall_totals[d].pending_grams
        return AmountWithPending(costed, pending)

    def profit(self, start: date, end: date) -> AmountWithPending:
        sales_total = self.sales(start, end)
        sales_no_shipping = self.sales_without_shipping(start, end)
        sales_costed = self.sales_of_costed(start, end)
        sales_pending = sales_no_shipping - sales_costed
        cost = self.costed_cost(start, end)
        shortfall = self.shortfall(start, end)
        shortfall_costed = shortfall.amount if shortfall is not None else 0
        shortfall_pending = shortfall.pending_grams if shortfall is not None else ZERO
        spent = self.expenses(start, end)
        amount = sales_total - sales_pending - cost - shortfall_costed - spent
        pending = self.pending_grams(start, end) + shortfall_pending
        return AmountWithPending(amount, pending)

    def cash(self, start: date, end: date) -> int:
        return self.payments(start, end) - self.expenses(start, end) - self.purchases(start, end)

    def expense_categories(self, start: date, end: date) -> dict[int, tuple[str, str, int]]:
        """Every category with an expense in `[start, end]`, summed from the day ×
        category buckets — never a fresh pass over the raw expense list."""
        totals: dict[int, tuple[str, str, int]] = {}
        for d in _days(start, end):
            day_categories = self.expenses_by_day_category.get(d)
            if day_categories is None:
                continue
            for category_id, (name, name_key, amount) in day_categories.items():
                existing_name, existing_key, existing_total = totals.get(
                    category_id, (name, name_key, 0)
                )
                totals[category_id] = (existing_name, existing_key, existing_total + amount)
        return totals


def _build_buckets(
    draws: Sequence[DrawRow],
    sales: Sequence[SaleRecord],
    payments: Sequence[PaymentRecord],
    expenses: Sequence[ExpenseRecord],
    purchases: Sequence[PurchaseRecord],
    earliest_entry_day: date | None,
) -> tuple[_Buckets, date | None]:
    """Scans every ledger exactly once: each loop below both fills its own buckets
    and folds its own days into `first_record` — the minimum date across sales,
    stock entries, payments and expenses (ADR-0013) — so nothing is scanned a second
    time just to find it."""
    buckets = _Buckets()
    first_record = earliest_entry_day

    for row in draws:
        if row.kind == "shortfall":
            agg = buckets.shortfall_totals.setdefault(row.day, _ShortfallDayTotals())
            agg.costed += row.costed or 0
            agg.pending_grams = agg.pending_grams + row.pending
            continue

        if row.variety_id is None or row.line_total is None:
            raise ValueError("a sale-line draw row always carries its variety and line total")
        if row.variety_name is not None:
            buckets.variety_names[row.variety_id] = row.variety_name
        sold_amount = costed_sales(row.line_total, row.grams, row.pending)

        day = buckets.day_totals.setdefault(row.day, _DayTotals())
        day.sales_without_shipping += row.line_total
        day.grams = day.grams + row.grams
        day.costed_cost += row.costed or 0
        day.sales_of_costed += sold_amount
        day.pending_grams = day.pending_grams + row.pending

        vday = buckets.variety_day_totals.setdefault((row.day, row.variety_id), _VarietyDayTotals())
        vday.sales_without_shipping += row.line_total
        if row.kind == "sold":
            vday.grams_sold = vday.grams_sold + row.grams
        else:
            vday.grams_gifted = vday.grams_gifted + row.grams
        vday.costed_cost += row.costed or 0
        vday.sales_of_costed += sold_amount
        vday.pending_grams = vday.pending_grams + row.pending

    for sale in sales:
        buckets.sales_by_day[sale.day] = buckets.sales_by_day.get(sale.day, 0) + sale.total
        weekday = sale.day.isoweekday()
        buckets.weekday_sales[weekday] = buckets.weekday_sales.get(weekday, 0) + sale.total
        buckets.weekday_counts[weekday] = buckets.weekday_counts.get(weekday, 0) + 1
        if first_record is None or sale.day < first_record:
            first_record = sale.day

    for payment in payments:
        previous_amount = buckets.payments_by_day.get(payment.day, 0)
        buckets.payments_by_day[payment.day] = previous_amount + payment.amount
        if first_record is None or payment.day < first_record:
            first_record = payment.day

    for expense in expenses:
        previous_expense = buckets.expenses_by_day.get(expense.day, 0)
        buckets.expenses_by_day[expense.day] = previous_expense + expense.amount
        day_categories = buckets.expenses_by_day_category.setdefault(expense.day, {})
        existing_name, existing_key, existing_total = day_categories.get(
            expense.category_id, (expense.name, expense.name_key, 0)
        )
        day_categories[expense.category_id] = (
            existing_name,
            existing_key,
            existing_total + expense.amount,
        )
        if first_record is None or expense.day < first_record:
            first_record = expense.day

    for purchase in purchases:
        buckets.purchases_by_day[purchase.day] = (
            buckets.purchases_by_day.get(purchase.day, 0) + purchase.total_cost
        )

    return buckets, first_record


def _variety_rows(buckets: _Buckets, month: Month) -> tuple[VarietyRow, ...]:
    totals_by_variety: dict[int, _VarietyDayTotals] = {}
    for (day, variety_id), vday in buckets.variety_day_totals.items():
        if not (month.first_day <= day <= month.last_day):
            continue
        totals = totals_by_variety.setdefault(variety_id, _VarietyDayTotals())
        totals.sales_without_shipping += vday.sales_without_shipping
        totals.grams_sold = totals.grams_sold + vday.grams_sold
        totals.grams_gifted = totals.grams_gifted + vday.grams_gifted
        totals.costed_cost += vday.costed_cost
        totals.sales_of_costed += vday.sales_of_costed
        totals.pending_grams = totals.pending_grams + vday.pending_grams

    month_sales_without_shipping = sum(t.sales_without_shipping for t in totals_by_variety.values())

    rows = []
    for variety_id, totals in totals_by_variety.items():
        margin_amount = totals.sales_of_costed - totals.costed_cost
        rows.append(
            VarietyRow(
                variety_id=variety_id,
                name=buckets.variety_names.get(variety_id, ""),
                sales_without_shipping=totals.sales_without_shipping,
                share_percent=percent(totals.sales_without_shipping, month_sales_without_shipping),
                grams_sold=totals.grams_sold,
                grams_gifted=totals.grams_gifted,
                cost=CostFigure(totals.costed_cost, totals.pending_grams),
                margin=MarginFigure(
                    amount=margin_amount,
                    percent=percent(margin_amount, totals.sales_of_costed),
                    pending_grams=totals.pending_grams,
                ),
            )
        )
    rows.sort(key=lambda row: (-row.margin.amount, row.name))
    return tuple(rows)


def _month_figures(
    buckets: _Buckets,
    month: Month,
    first_month: Month | None,
    current_month: Month,
) -> MonthFigures:
    varieties = _variety_rows(buckets, month)
    total_margin = sum(v.margin.amount for v in varieties)
    total_sales_costed = sum(v.margin.amount + v.cost.costed for v in varieties)
    pending_sold_gifted = ZERO
    for v in varieties:
        pending_sold_gifted = pending_sold_gifted + v.margin.pending_grams

    previous = (
        None
        if first_month is None
        else (month.previous if month.previous >= first_month else None)
    )
    following = month.next if month.next <= current_month else None

    return MonthFigures(
        month=month,
        previous=previous,
        next=following,
        sales=buckets.sales(month.first_day, month.last_day),
        sales_without_shipping=sum(v.sales_without_shipping for v in varieties),
        grams_sold=sum((v.grams_sold for v in varieties), ZERO),
        grams_gifted=sum((v.grams_gifted for v in varieties), ZERO),
        average_margin=MarginFigure(
            amount=total_margin,
            percent=percent(total_margin, total_sales_costed),
            pending_grams=pending_sold_gifted,
        ),
        shortfall=buckets.shortfall(month.first_day, month.last_day),
        varieties=varieties,
    )


def _weeks(buckets: _Buckets, today: date, first_record: date | None) -> tuple[WeekFigures, ...]:
    if first_record is None:
        return ()
    first_week = Week.containing(first_record)
    span = []
    week = Week.containing(today)
    for _ in range(8):
        if week.first_day < first_week.first_day:
            break
        span.append(week)
        week = week.previous
    span.reverse()

    rows = [
        WeekFigures(
            first_day=w.first_day,
            last_day=w.last_day,
            sales=buckets.sales(w.first_day, w.last_day),
            grams=buckets.grams(w.first_day, w.last_day),
            expenses=buckets.expenses(w.first_day, w.last_day),
            profit=buckets.profit(w.first_day, w.last_day),
            cash=buckets.cash(w.first_day, w.last_day),
            best=False,
        )
        for w in span
    ]
    best_index = _best_index([row.sales for row in rows])
    if best_index is not None:
        rows[best_index] = WeekFigures(
            first_day=rows[best_index].first_day,
            last_day=rows[best_index].last_day,
            sales=rows[best_index].sales,
            grams=rows[best_index].grams,
            expenses=rows[best_index].expenses,
            profit=rows[best_index].profit,
            cash=rows[best_index].cash,
            best=True,
        )
    return tuple(rows)


def _best_index(values: list[int]) -> int | None:
    """The index of the highest value, the last one on a tie (the plan's "most
    recent week wins"); `None` when every value is 0 or the list is empty."""
    if not values or max(values) == 0:
        return None
    best = max(values)
    for index in range(len(values) - 1, -1, -1):
        if values[index] == best:
            return index
    return None


def _months(
    buckets: _Buckets, today: date, first_record: date | None
) -> tuple[MonthRowFigures, ...]:
    if first_record is None:
        return ()
    first_month = Month.containing(first_record)
    span = []
    month = Month.containing(today)
    for _ in range(12):
        if month < first_month:
            break
        span.append(month)
        month = month.previous
    span.reverse()

    return tuple(
        MonthRowFigures(
            month=m,
            first_day=m.first_day,
            last_day=m.last_day,
            sales=buckets.sales(m.first_day, m.last_day),
            grams=buckets.grams(m.first_day, m.last_day),
            expenses=buckets.expenses(m.first_day, m.last_day),
            profit=buckets.profit(m.first_day, m.last_day),
            cash=buckets.cash(m.first_day, m.last_day),
        )
        for m in span
    )


def _weekdays(buckets: _Buckets) -> tuple[WeekdayFigures, ...]:
    sales = [buckets.weekday_sales.get(w, 0) for w in range(1, 8)]
    best_index = _best_earliest_on_tie(sales)
    return tuple(
        WeekdayFigures(
            weekday=w,
            sales=sales[w - 1],
            count=buckets.weekday_counts.get(w, 0),
            best=(best_index == w - 1),
        )
        for w in range(1, 8)
    )


def _best_earliest_on_tie(values: list[int]) -> int | None:
    if not values or max(values) == 0:
        return None
    best = max(values)
    return values.index(best)


def _expense_breakdown(buckets: _Buckets, start: date, end_inclusive: date) -> ExpenseBreakdown:
    totals = buckets.expense_categories(start, end_inclusive)
    ordered = sorted(totals.items(), key=lambda item: item[1][1])
    categories = tuple(
        ExpenseCategoryTotal(category_id=category_id, name=name, total=total)
        for category_id, (name, name_key, total) in ordered
    )
    return ExpenseBreakdown(
        categories=categories,
        total=sum(c.total for c in categories),
        purchases=buckets.purchases(start, end_inclusive),
    )


def period_figures(
    *,
    today: date,
    month: Month,
    draws: Sequence[DrawRow],
    sales: Sequence[SaleRecord],
    payments: Sequence[PaymentRecord],
    expenses: Sequence[ExpenseRecord],
    purchases: Sequence[PurchaseRecord],
    earliest_entry_day: date | None,
) -> AnalysisFigures:
    buckets, first_record = _build_buckets(
        draws, sales, payments, expenses, purchases, earliest_entry_day
    )

    first_month = None if first_record is None else Month.containing(first_record)
    current_month = Month.containing(today)

    month_figures = _month_figures(buckets, month, first_month, current_month)
    weeks = _weeks(buckets, today, first_record)
    months = _months(buckets, today, first_record)
    weekdays = _weekdays(buckets)

    since_first_record = None
    since_first_record_expenses = ExpenseBreakdown((), 0, 0)
    if first_record is not None:
        since_first_record = SinceFirstRecordFigures(
            sales=buckets.sales(first_record, today),
            expenses=buckets.expenses(first_record, today),
            profit=buckets.profit(first_record, today),
            cash=buckets.cash(first_record, today),
            shortfall=buckets.shortfall(first_record, today),
        )
        since_first_record_expenses = _expense_breakdown(buckets, first_record, today)

    month_expenses = _expense_breakdown(buckets, month.first_day, month.last_day)

    return AnalysisFigures(
        first_record=first_record,
        month=month_figures,
        weeks=weeks,
        months=months,
        weekdays=weekdays,
        since_first_record=since_first_record,
        month_expenses=month_expenses,
        since_first_record_expenses=since_first_record_expenses,
    )
