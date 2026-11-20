"""A sale's Payment state, as pure rules (CONTEXT.md: Payment state): the first rule that
applies decides, four rules raise a message that names the rule only, and the Sale bill
reads the state through `bill_payment_of`.
"""

from __future__ import annotations

import pytest

from app.sales.domain.sale_bill import (
    BillPayment,
    PaymentState,
    SaleBillInconsistent,
    SalePayment,
    bill_payment,
    bill_payment_of,
    payment_state,
    sale_payment,
)
from app.shared.payment_method import PaymentMethodId

CASH = PaymentMethodId(1)


def test_the_wire_strings_of_the_three_states() -> None:
    assert [state.value for state in PaymentState] == ["paid", "unpaid", "part_paid"]


@pytest.mark.parametrize(
    ("total", "method", "has_customer", "owed", "state"),
    [
        pytest.param(0, None, False, None, PaymentState.PAID, id="zero-total-no-customer"),
        pytest.param(0, None, True, 5_000, PaymentState.PAID, id="zero-total-first-rule-wins"),
        pytest.param(0, None, True, -1, PaymentState.PAID, id="zero-total-out-of-range"),
        pytest.param(0, CASH, True, 9, PaymentState.PAID, id="zero-total-before-on-the-spot"),
        pytest.param(10_000, CASH, False, None, PaymentState.PAID, id="on-the-spot"),
        pytest.param(10_000, CASH, True, None, PaymentState.PAID, id="on-the-spot-customer"),
        pytest.param(10_000, None, True, 0, PaymentState.PAID, id="paid-later"),
        pytest.param(10_000, None, True, 10_000, PaymentState.UNPAID, id="unpaid"),
        pytest.param(10_000, None, True, 6_000, PaymentState.PART_PAID, id="part-paid"),
        pytest.param(10_000, None, True, 1, PaymentState.PART_PAID, id="part-paid-one-left"),
        pytest.param(10_000, None, True, 9_999, PaymentState.PART_PAID, id="part-paid-one-paid"),
    ],
)
def test_the_state_table(
    total: int,
    method: PaymentMethodId | None,
    has_customer: bool,
    owed: int | None,
    state: PaymentState,
) -> None:
    assert payment_state(total, method, has_customer, owed) is state


def test_a_sale_settled_by_a_credit_reads_zero_owed_and_is_paid() -> None:
    assert payment_state(10_000, None, True, 0) is PaymentState.PAID


@pytest.mark.parametrize(
    ("total", "method", "has_customer", "owed", "message"),
    [
        pytest.param(
            10_000,
            CASH,
            True,
            0,
            "a sale paid on the spot is never reported as owed",
            id="rule-2-on-the-spot-listed-at-zero",
        ),
        pytest.param(
            10_000,
            CASH,
            True,
            50,
            "a sale paid on the spot is never reported as owed",
            id="rule-2-on-the-spot-listed-with-an-amount",
        ),
        pytest.param(
            10_000,
            None,
            False,
            None,
            "a sale with no customer is paid on the spot or is a gift",
            id="rule-3-no-customer",
        ),
        pytest.param(
            10_000,
            None,
            True,
            None,
            "a customer's sale is missing from settlement",
            id="rule-4-missing",
        ),
        pytest.param(
            10_000,
            None,
            True,
            -1,
            "a sale's amount owed lies outside zero and its total",
            id="rule-5-negative",
        ),
        pytest.param(
            10_000,
            None,
            True,
            10_001,
            "a sale's amount owed lies outside zero and its total",
            id="rule-5-above-the-total",
        ),
    ],
)
def test_each_inconsistent_case_raises_its_own_fixed_message(
    total: int,
    method: PaymentMethodId | None,
    has_customer: bool,
    owed: int | None,
    message: str,
) -> None:
    with pytest.raises(SaleBillInconsistent) as raised:
        payment_state(total, method, has_customer, owed)

    assert str(raised.value) == message


def test_sale_payment_carries_zero_when_paid_whatever_settlement_did_not_list() -> None:
    assert sale_payment(10_000, CASH, False, None) == SalePayment(PaymentState.PAID, 0, 10_000)
    assert sale_payment(0, None, False, None) == SalePayment(PaymentState.PAID, 0, 0)
    assert sale_payment(10_000, None, True, 0) == SalePayment(PaymentState.PAID, 0, 10_000)


def test_sale_payment_carries_settlements_amount_when_owed() -> None:
    assert sale_payment(10_000, None, True, 10_000) == SalePayment(
        PaymentState.UNPAID, 10_000, 10_000
    )
    assert sale_payment(10_000, None, True, 6_000) == SalePayment(
        PaymentState.PART_PAID, 6_000, 10_000
    )


def test_sale_payment_raises_what_payment_state_raises() -> None:
    with pytest.raises(SaleBillInconsistent):
        sale_payment(10_000, None, True, 10_001)


@pytest.mark.parametrize(
    ("state", "owed", "total"),
    [
        pytest.param(PaymentState.PAID, 1, 10_000, id="paid-with-an-amount"),
        pytest.param(PaymentState.UNPAID, 9_999, 10_000, id="unpaid-below-the-total"),
        pytest.param(PaymentState.UNPAID, 0, 0, id="unpaid-with-a-zero-total"),
        pytest.param(PaymentState.PART_PAID, 0, 10_000, id="part-paid-at-zero"),
        pytest.param(PaymentState.PART_PAID, 10_000, 10_000, id="part-paid-at-the-total"),
        pytest.param(PaymentState.PART_PAID, 10_001, 10_000, id="part-paid-above-the-total"),
    ],
)
def test_a_sale_payment_that_contradicts_its_state_is_a_programming_error(
    state: PaymentState, owed: int, total: int
) -> None:
    with pytest.raises(AssertionError):
        SalePayment(state, owed, total)


def test_the_bill_payment_of_each_state() -> None:
    assert bill_payment_of(SalePayment(PaymentState.PAID, 0, 10_000)) == BillPayment("paid", None)
    assert bill_payment_of(SalePayment(PaymentState.UNPAID, 10_000, 10_000)) == BillPayment(
        "owed", 10_000
    )
    assert bill_payment_of(SalePayment(PaymentState.PART_PAID, 4_000, 10_000)) == BillPayment(
        "owed", 4_000
    )


def test_bill_payment_keeps_none_for_a_zero_total_and_refuses_an_out_of_range_amount() -> None:
    assert bill_payment(0, None, True, 5_000) == BillPayment("none", None)
    with pytest.raises(SaleBillInconsistent):
        bill_payment(10_000, None, True, 10_001)
