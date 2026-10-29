"""The sale bill's payment state and balance, as pure rules (CONTEXT.md: Sale bill),
over the state table: (total, on-the-spot method, has customer, still owed, balance).
The first check that fits wins; three rows are inconsistent and raise a message that
names the rule only.
"""

from __future__ import annotations

import pytest

from app.sales.domain.pricing import PricingRule
from app.sales.domain.sale import PaymentMethod
from app.sales.domain.sale_bill import (
    BillPayment,
    BillState,
    SaleBillInconsistent,
    bill_balance,
    bill_payment,
    bill_rule,
)

CASH = PaymentMethod.CASH
TRANSFER = PaymentMethod.TRANSFER

# (total, method, has_customer, still_owed, balance, state, bill still_owed, bill balance)
VALID_ROWS = [
    pytest.param(0, None, False, None, 0, "none", None, None, id="gifts-no-customer"),
    pytest.param(0, None, True, None, 0, "none", None, None, id="gifts-customer-even"),
    pytest.param(0, None, True, None, 7_000, "none", None, 7_000, id="gifts-customer-owes"),
    pytest.param(0, None, True, None, -3_000, "none", None, -3_000, id="gifts-customer-credit"),
    pytest.param(10_000, CASH, False, None, 0, "cash", None, None, id="cash"),
    pytest.param(10_000, TRANSFER, True, None, 0, "transfer", None, None, id="transfer"),
    pytest.param(10_000, CASH, True, None, 5_000, "cash", None, 5_000, id="cash-owes-elsewhere"),
    pytest.param(10_000, None, True, 10_000, 10_000, "owed", 10_000, 10_000, id="fully-owed"),
    pytest.param(10_000, None, True, 6_000, 6_000, "owed", 6_000, 6_000, id="partly-owed"),
    pytest.param(10_000, None, True, 0, 0, "paid", None, None, id="paid-by-later-payment"),
    pytest.param(10_000, None, True, 0, -2_000, "paid", None, -2_000, id="paid-by-credit"),
    pytest.param(10_000, CASH, True, None, -4_000, "cash", None, -4_000, id="credit-on-cash"),
]


@pytest.mark.parametrize(
    ("total", "method", "has_customer", "owed", "balance", "state", "bill_owed", "bill_bal"),
    VALID_ROWS,
)
def test_the_state_table(
    total: int,
    method: PaymentMethod | None,
    has_customer: bool,
    owed: int | None,
    balance: int,
    state: BillState,
    bill_owed: int | None,
    bill_bal: int | None,
) -> None:
    assert bill_payment(total, method, has_customer, owed) == BillPayment(state, bill_owed)
    assert bill_balance(has_customer, balance) == bill_bal


# (method, has_customer, still_owed, the rule named)
RAISING_ROWS = [
    pytest.param(CASH, True, 4_321, "on the spot", id="on-the-spot-but-owed"),
    pytest.param(TRANSFER, False, 4_321, "on the spot", id="on-the-spot-no-customer-but-owed"),
    pytest.param(None, False, None, "no customer", id="no-customer-not-on-the-spot"),
    pytest.param(None, False, 4_321, "no customer", id="no-customer-with-an-amount"),
    pytest.param(None, True, None, "settlement", id="customer-sale-missing-from-settlement"),
]


@pytest.mark.parametrize(("method", "has_customer", "owed", "rule"), RAISING_ROWS)
def test_the_inconsistent_rows_raise_a_message_naming_the_rule_and_no_figure(
    method: PaymentMethod | None, has_customer: bool, owed: int | None, rule: str
) -> None:
    with pytest.raises(SaleBillInconsistent) as raised:
        bill_payment(10_000, method, has_customer, owed)

    message = str(raised.value)
    assert rule in message
    assert not any(char.isdigit() for char in message)


def test_a_zero_total_wins_over_every_later_check() -> None:
    # Check 1 fits first: no raise even with an amount, a missing one or no customer.
    assert bill_payment(0, None, False, None) == BillPayment("none", None)
    assert bill_payment(0, CASH, True, 5) == BillPayment("none", None)


def test_a_bill_payment_carries_an_amount_only_when_owed() -> None:
    with pytest.raises(AssertionError):
        BillPayment("owed", None)
    with pytest.raises(AssertionError):
        BillPayment("paid", 5)


def test_the_balance_of_nothing_or_of_no_customer_is_none() -> None:
    assert bill_balance(True, 0) is None
    assert bill_balance(False, 0) is None
    assert bill_balance(False, 9_000) is None
    assert bill_balance(True, 9_000) == 9_000
    assert bill_balance(True, -9_000) == -9_000


@pytest.mark.parametrize(
    ("rule", "expected"),
    [
        (PricingRule.BULK, "bulk"),
        (PricingRule.GIFT, "gift"),
        (PricingRule.LIST, None),
        (PricingRule.VIP, None),
        (PricingRule.SPECIAL, None),
    ],
)
def test_only_bulk_and_gift_map_to_a_bill_rule(rule: PricingRule, expected: str | None) -> None:
    assert bill_rule(rule) == expected
