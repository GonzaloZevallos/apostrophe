"""What the import needs from every owner capability, and nothing more
(CODING_STANDARDS.md section 1; the plan's invariant).

No code under `app/spreadsheet_import/` reads, writes or counts another capability's
table directly: it only goes through a port declared here, implemented by that
capability's own `adapters/import_port.py`. `Refusal` carries an owner's own refusal
`code` as a plain string — never the exception, never the message it was built with —
so the report can print `refused: <code>` without ever importing the owner's error
types.

Every port below is built for one business (ADR-0004): no method takes a
`business_id`. A database id, when a method returns one, lives only in
`application/write_import.py`'s own key→id maps; it never comes back into this
module or into `domain/`.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol

from app.shared.grams import Grams
from app.shared.pricing_settings import PricingSettings
from app.shared.transaction import Transaction
from app.spreadsheet_import.domain.plan import OnTheSpotMethod
from app.spreadsheet_import.domain.rows import (
    CatalogRow,
    EntradaRow,
    GastoRow,
    HeaderFooterCells,
    PriceHistoryRow,
)


@dataclass(frozen=True)
class Refusal:
    """An owner's own refusal, carried as its `code` alone."""

    code: str


@dataclass(frozen=True)
class VarietyKey:
    """A variety as varieties.md would name it: `key` is the case-and-spacing-folded
    form two rows are compared by; `name` is the well-formed display form stored."""

    key: str
    name: str


@dataclass(frozen=True)
class CustomerKey:
    """The normalised phone number two spellings are matched by, opaque outside
    customers' own adapter, or `None` for a customer with no phone at all (ADR-0021).
    Never printed (the plan's invariant: no phone number appears in any report line,
    exception message, stdout or stderr)."""

    phone_key: str | None


@dataclass(frozen=True)
class CustomerRefusals:
    """Every broken rule `check_customer` found, filed by the field the port answers
    it in: `name_code` for the customer's name, `phone_code` for the mapping's phone.
    At least one is set. Kept apart from the generic `Refusal` because customers is
    the only owner with two kinds of key to check independently (the plan's
    invariant)."""

    name_code: str | None
    phone_code: str | None

    def __post_init__(self) -> None:
        if self.name_code is None and self.phone_code is None:
            raise ValueError("CustomerRefusals needs name_code, phone_code or both set")


@dataclass(frozen=True)
class SaleCheckInput:
    """One Ventas row, already interpreted by the domain: what payment, kind and a
    $0 total mean is decided before this crosses into sales' port, so sales' adapter
    never sees a raw cell."""

    variety_key: str
    grams: Grams
    has_customer: bool
    vip: bool
    gift: bool
    special_total: int | None
    shipping: int
    method: OnTheSpotMethod | None
    left_owing: bool
    sale_date: date
    note: str | None


@dataclass(frozen=True)
class SaleCheck:
    """The result of checking one `SaleCheckInput`: the total it would be stored
    with, or the refusal that blocks it."""

    total: int | None
    refusal: Refusal | None


class VarietiesImport(Protocol):
    """Varieties and their price history."""

    def has_records(self) -> bool:
        """Whether this business already has a variety or a price entry."""
        ...

    def check_name(self, raw: str) -> VarietyKey | Refusal:
        """`raw` under varieties.md's name rule."""
        ...

    def check_price_history(
        self, rows: Sequence[PriceHistoryRow], keys: Mapping[str, str]
    ) -> Sequence[Refusal | None]:
        """One result per row of `rows`, in the same order, batched so the
        duplicate-effective-date rule runs over the whole history at once. `keys`
        maps a row's raw variety text to the key `check_name` gave it."""
        ...

    def write_variety(self, name: str, transaction: Transaction) -> int:
        """Create the variety and return its id."""
        ...

    def write_price_entry(
        self,
        variety_id: int,
        row: PriceHistoryRow,
        transaction: Transaction,
        *,
        with_vip_price: bool = True,
    ) -> None:
        """Store the entry as the sheet says. `with_vip_price` is whether the import
        leaves Clientes VIP on: only then does an entry with a bulk price carry
        VIP price = bulk price (a rule that is off stores nothing, docs/adr/0034)."""
        ...


class PricingSettingsImport(Protocol):
    """The business's two pricing switches, read once at planning and switched on by
    the write. It can never turn one off (docs/adr/0034)."""

    def current(self) -> PricingSettings: ...

    def switch_on(self, bulk: bool, vip: bool) -> None:
        """Store `stored OR given` for each switch."""
        ...


class StockImport(Protocol):
    """Stock entries and low-stock thresholds."""

    def has_records(self) -> bool:
        """Whether this business already has a stock entry."""
        ...

    def check_threshold(self, grams: Grams) -> Refusal | None: ...

    def check_entry(self, row: EntradaRow, today: date) -> Refusal | None:
        """`row` under stock.md's rules, as if recorded on `today`."""
        ...

    def write_threshold(self, variety_id: int, grams: Grams, transaction: Transaction) -> None: ...

    def write_entry(
        self,
        variety_id: int,
        row: EntradaRow,
        recorded_at: datetime,
        today: date,
        transaction: Transaction,
    ) -> None: ...


class CatalogImport(Protocol):
    """Catalog attributes and the header and footer. No `has_records`: eligibility
    never looks at the catalog (the seeded header, footer and any attributes don't
    count)."""

    def check_attributes(self, row: CatalogRow) -> Refusal | None: ...

    def check_header_footer(self, cells: HeaderFooterCells) -> Refusal | None: ...

    def write_attributes(
        self, variety_id: int, row: CatalogRow, today: date, transaction: Transaction
    ) -> None: ...

    def write_header_footer(
        self, cells: HeaderFooterCells, today: date, transaction: Transaction
    ) -> None: ...


class ExpensesImport(Protocol):
    """Expense categories and expenses."""

    def has_records(self) -> bool:
        """Whether this business already has an expense. Categories never count,
        even when seeded, renamed or removed."""
        ...

    def category_key(self, raw: str) -> str | Refusal:
        """`raw` under expenses.md's category name rule, folded to the key two
        names are matched by."""
        ...

    def check_expense(self, row: GastoRow, today: date) -> Refusal | None:
        """`row` under expenses.md's rules, as if recorded on `today`."""
        ...

    def write_category(self, name: str, transaction: Transaction) -> int:
        """Match an existing category by key, or add one; return its id either
        way."""
        ...

    def write_expense(
        self,
        category_id: int,
        row: GastoRow,
        recorded_at: datetime,
        today: date,
        transaction: Transaction,
    ) -> None: ...


class CustomersImport(Protocol):
    """Customers, identified by their own record; the phone is optional (ADR-0021)."""

    def has_records(self) -> bool:
        """Whether this business already has a customer."""
        ...

    def check_customer(self, name: str, phone: str | None) -> CustomerKey | CustomerRefusals:
        """`name` under customers.md's name rule and, when `phone` is given, its
        normalisation — checked independently, so a broken name and a broken phone are
        each filed under their own field. `phone` reaches no further than this call and
        the key it returns."""
        ...

    def write_customer(
        self, name: str, phone_key: str | None, vip: bool, transaction: Transaction
    ) -> int: ...


class SalesImport(Protocol):
    """Sales and their on-the-spot payments."""

    def has_records(self) -> bool:
        """Whether this business already has a sale."""
        ...

    def check_sales(
        self,
        price_history: Sequence[PriceHistoryRow],
        variety_keys: Mapping[str, str],
        sales: Sequence[SaleCheckInput],
        today: date,
        settings: PricingSettings,
    ) -> Sequence[SaleCheck]:
        """One `SaleCheck` per entry of `sales`, in the same order, batched so
        sales' adapter builds its `PlannedPriceBook` once per run from the plain
        `price_history` rows rather than once per row. `settings` are the switches the
        import will leave: every row is priced with them."""
        ...

    def write_sale(
        self,
        variety_id: int,
        customer_id: int | None,
        sale: SaleCheckInput,
        recorded_at: datetime,
        today: date,
        transaction: Transaction,
        settings: PricingSettings,
    ) -> int:
        """Record the sale and its on-the-spot payment, if any; return the stored
        total, priced with `settings` (the switches the import leaves)."""
        ...


class PaymentsImport(Protocol):
    """Only eligibility: a payment is written through `SalesImport.write_sale`,
    never through this port."""

    def has_records(self) -> bool:
        """Whether this business already has a payment."""
        ...


class BusinessDirectory(Protocol):
    """Looking a business up by id, the only way the command names its target
    (ADR-0004: no route ever carries a business)."""

    def name_of(self, business_id: int) -> str | None:
        """`None` when there is no such business; the refusal that stops the run
        before any sheet is read."""
        ...


class OnboardingEnding(Protocol):
    """The Onboarding's end (docs/adr/0035): a successful import ends it. Nothing else
    of the Onboarding is touched, and eligibility never looks at its state."""

    def imported(self, at: datetime, transaction: Transaction) -> None:
        """Ends this business's Onboarding at `at` while it is open; does nothing when
        it is over already or the business was never offered one. Never commits."""
        ...
