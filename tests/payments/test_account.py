"""The customer's account, laid out from `settle()`'s result (CONTEXT.md: Payment,
Balance, Settlement, Credit; ADR-0012).

Rows are ordered `(date, sales before payments, recorded_at, id)`, each carrying its
own `running_balance` and `standing`. A backdated payment can make the running
balance read "A favor" between its own row and the later-dated sale it settles (PRD
round-1 clarification) — that is only the figure at that point in the list, never the
customer's own final balance or a stored credit.
"""

from __future__ import annotations

from datetime import date, datetime

from app.payments.domain.account import CreditRow, PaymentRow, SaleRow, account_of
from app.payments.domain.settlement import LaterPaymentEntry, OwedSale, PaymentMethod

AT = datetime(2026, 9, 1, 10, 0)


def test_a_sale_paid_on_the_spot_moves_the_running_balance_by_zero() -> None:
    sale = OwedSale(1, date(2026, 9, 1), AT, 100, on_the_spot_method=PaymentMethod.TRANSFER)

    account = account_of([sale], [])

    [row] = account.rows
    assert isinstance(row, SaleRow)
    assert row.how_paid == "transfer"
    assert row.running_balance == 0
    assert row.standing == "settled"
    assert account.balance == 0


def test_a_sale_left_owing_moves_the_running_balance_by_its_total() -> None:
    sale = OwedSale(1, date(2026, 9, 1), AT, 100)

    account = account_of([sale], [])

    [row] = account.rows
    assert isinstance(row, SaleRow)
    assert row.how_paid == "owing"
    assert row.running_balance == 100
    assert row.standing == "owes"


def test_a_zero_total_sale_shows_no_payment_label() -> None:
    sale = OwedSale(1, date(2026, 9, 1), AT, 0)

    account = account_of([sale], [])

    [row] = account.rows
    assert isinstance(row, SaleRow)
    assert row.how_paid == "none"
    assert row.running_balance == 0


def test_a_later_payment_fully_covering_a_sale_zeroes_the_running_balance() -> None:
    sale = OwedSale(1, date(2026, 9, 1), AT, 100)
    payment = LaterPaymentEntry(10, date(2026, 9, 5), AT, 100, PaymentMethod.CASH)

    account = account_of([sale], [payment])

    sale_row, payment_row = account.rows
    assert isinstance(sale_row, SaleRow) and sale_row.running_balance == 100
    assert isinstance(payment_row, PaymentRow)
    assert payment_row.applied_to.sale_id == 1
    assert payment_row.applied_to.amount == 100
    assert payment_row.method == PaymentMethod.CASH
    assert payment_row.running_balance == 0
    assert payment_row.standing == "settled"


def test_a_payment_spanning_two_sales_gets_one_row_per_split_oldest_sale_first() -> None:
    older = OwedSale(1, date(2026, 9, 1), AT, 60)
    newer = OwedSale(2, date(2026, 9, 10), AT, 60)
    payment = LaterPaymentEntry(10, date(2026, 9, 15), AT, 90, PaymentMethod.TRANSFER)

    account = account_of([older, newer], [payment])

    kinds = [(type(row).__name__, row.date) for row in account.rows]
    assert kinds == [
        ("SaleRow", date(2026, 9, 1)),
        ("SaleRow", date(2026, 9, 10)),
        ("PaymentRow", date(2026, 9, 15)),
        ("PaymentRow", date(2026, 9, 15)),
    ]
    first_split, second_split = (row for row in account.rows if isinstance(row, PaymentRow))
    assert first_split.applied_to.sale_id == 1
    assert second_split.applied_to.sale_id == 2
    assert first_split.running_balance == 60  # 120 owed - 60 applied to the older sale
    assert second_split.running_balance == 30  # - 30 more applied to the newer sale


def test_a_payment_beyond_every_debt_gets_a_credit_row_right_after_its_splits() -> None:
    sale = OwedSale(1, date(2026, 9, 1), AT, 100)
    payment = LaterPaymentEntry(10, date(2026, 9, 5), AT, 130, PaymentMethod.CASH)

    account = account_of([sale], [payment])

    _, payment_row, credit_row = account.rows
    assert isinstance(payment_row, PaymentRow)
    assert isinstance(credit_row, CreditRow)
    assert credit_row.credit_amount == 30
    assert credit_row.running_balance == -30
    assert credit_row.standing == "credit"
    assert account.standing == "credit"
    assert account.balance == -30


def test_a_backdated_payment_reads_a_favor_until_the_later_sale_it_settles_appears() -> None:
    """The customer's oldest debt is this later-dated sale; the payment, though
    dated earlier, still settles it (PRD round-1, Q1). In date order the payment's
    own row comes first and its running balance goes negative there, reading "A
    favor", until the sale row that follows brings it back to zero."""
    sale = OwedSale(1, date(2026, 9, 20), AT, 100)
    payment = LaterPaymentEntry(10, date(2026, 9, 1), AT, 100, PaymentMethod.CASH)

    account = account_of([sale], [payment])

    payment_row, sale_row = account.rows
    assert isinstance(payment_row, PaymentRow)
    assert payment_row.running_balance == -100
    assert payment_row.standing == "credit"
    assert isinstance(sale_row, SaleRow)
    assert sale_row.running_balance == 0
    assert sale_row.standing == "settled"
    assert account.balance == 0  # the account's own final balance, never a credit


def test_a_sale_and_a_payment_on_the_same_date_put_the_sale_row_first() -> None:
    sale = OwedSale(1, date(2026, 9, 5), AT, 50)
    payment = LaterPaymentEntry(10, date(2026, 9, 5), AT, 50, PaymentMethod.CASH)

    account = account_of([sale], [payment])

    assert [type(row).__name__ for row in account.rows] == ["SaleRow", "PaymentRow"]


def test_an_on_the_spot_sale_never_gets_a_payment_or_credit_row() -> None:
    """Only a later payment ever yields a `PaymentRow` or a `CreditRow`: the front
    offers "Borrar cobro" on those rows, and an on-the-spot payment has none."""
    on_the_spot = OwedSale(1, date(2026, 9, 1), AT, 100, on_the_spot_method=PaymentMethod.CASH)
    owed = OwedSale(2, date(2026, 9, 2), AT, 50)
    later = LaterPaymentEntry(10, date(2026, 9, 5), AT, 80, PaymentMethod.TRANSFER)

    account = account_of([on_the_spot, owed], [later])

    on_the_spot_rows = [
        row for row in account.rows if isinstance(row, SaleRow) and row.sale_id == 1
    ]
    assert len(on_the_spot_rows) == 1
    payment_ids = {
        row.payment_id for row in account.rows if isinstance(row, (PaymentRow, CreditRow))
    }
    assert payment_ids == {10}
    assert any(isinstance(row, CreditRow) for row in account.rows)


def test_a_payments_split_row_comes_immediately_before_its_credit_row() -> None:
    """The front puts "Borrar cobro" on the first row of each later payment; that
    is the payment row only while splits are laid before the credit row."""
    sale = OwedSale(1, date(2026, 9, 1), AT, 5000)
    payment = LaterPaymentEntry(10, date(2026, 9, 5), AT, 8000, PaymentMethod.CASH)

    account = account_of([sale], [payment])

    rows_of_payment = [row for row in account.rows if isinstance(row, (PaymentRow, CreditRow))]
    payment_row, credit_row = rows_of_payment
    assert isinstance(payment_row, PaymentRow)
    assert isinstance(credit_row, CreditRow)
    assert credit_row.credit_amount == 3000
    assert account.rows.index(credit_row) == account.rows.index(payment_row) + 1
