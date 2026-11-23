from typing import Any, cast

from sqlalchemy import (
    ColumnElement,
    CursorResult,
    Row,
    Select,
    and_,
    exists,
    insert,
    literal,
    null,
    or_,
    select,
    update,
)
from sqlalchemy.orm import Session

from app.db import (
    domain_amount,
    money_of_domain,
    money_scale_factor,
    money_stored_value,
    scaled,
)
from app.expenses.adapters.tables import ExpenseCategoryRow, ExpenseRow
from app.expenses.domain.expense import Expense, ExpenseNotFound
from app.expenses.domain.month import Month
from app.expenses.domain.monthly_view import CategorizedExpense
from app.payment_methods.adapters.tables import PaymentMethodRow
from app.shared.payment_method import PaymentMethodId, PaymentMethodLabel, PaymentMethodUnavailable


class SqlExpenses:
    """The `Expenses` port over SQLAlchemy, for one business. Every statement filters
    on that business; an expense of another business is, from here, an expense that
    does not exist (docs/adr/0004). Writes flush; the use case commits.

    The Payment method an expense names is checked inside the statement that writes it
    (`_offered_clause`, docs/adr/20261111-payment-methods-by-id): `add` and `save` are the
    only writers of `expense.payment_method_id`, and both are Core statements. Reads select
    columns, never the `ExpenseRow` entity, so a Core write is never answered from the
    identity map."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def by_id(self, expense_id: int) -> Expense | None:
        return self._read(expense_id)

    def add(self, expense: Expense) -> Expense:
        method = expense.payment_method
        selected = select(
            literal(self._business_id, ExpenseRow.business_id.type),
            literal(expense.category_id, ExpenseRow.expense_category_id.type),
            literal(expense.spent_on, ExpenseRow.spent_on.type),
            literal(self._stored(expense.amount), ExpenseRow.amount.type),
            literal(expense.detail, ExpenseRow.detail.type),
            literal(expense.recorded_at, ExpenseRow.recorded_at.type),
            null() if method is None else literal(method.value),
        )
        if method is not None:
            selected = selected.where(self._offered_clause(method))
        statement = (
            insert(ExpenseRow)
            .from_select(
                [
                    "business_id",
                    "expense_category_id",
                    "spent_on",
                    "amount",
                    "detail",
                    "recorded_at",
                    "payment_method_id",
                ],
                selected,
            )
            .returning(ExpenseRow.id)
        )
        # The new id comes from the statement's own RETURNING: `lastrowid` is `None`
        # for an `INSERT … SELECT` on the libsql driver (docs/adr/0016).
        inserted = self._session.execute(statement).first()
        if inserted is None:
            raise PaymentMethodUnavailable()
        self._session.flush()
        stored = self._read(int(inserted.id))
        assert stored is not None, "the expense just added still exists"
        return stored

    def save(self, expense: Expense) -> Expense:
        assert expense.id is not None, "save takes an expense that was added"
        method = expense.payment_method
        conditions = [ExpenseRow.id == expense.id, ExpenseRow.business_id == self._business_id]
        if method is not None:
            # Keeping the method the row already has is allowed even once archived.
            conditions.append(
                or_(ExpenseRow.payment_method_id == method.value, self._offered_clause(method))
            )
        statement = (
            update(ExpenseRow)
            .where(*conditions)
            .values(
                expense_category_id=expense.category_id,
                spent_on=expense.spent_on,
                amount=self._stored(expense.amount),
                detail=expense.detail,
                payment_method_id=None if method is None else method.value,
            )
            .execution_options(synchronize_session=False)
        )
        result = cast(CursorResult[tuple[object, ...]], self._session.execute(statement))
        if result.rowcount == 0:
            # Same transaction: which half of the guard failed.
            if self._read(expense.id) is None:
                raise ExpenseNotFound(expense.id)
            raise PaymentMethodUnavailable()
        self._session.flush()
        stored = self._read(expense.id)
        assert stored is not None, "the expense just saved still exists"
        return stored

    def remove(self, expense_id: int) -> None:
        row = self._row(expense_id)
        assert row is not None, "remove takes an expense of this business"
        self._session.delete(row)
        self._session.flush()

    def in_month(self, month: Month) -> list[CategorizedExpense]:
        # Ordered spent_on DESC, recorded_at DESC, id DESC: nowhere else computes this
        # order. Joined with the category row for its name, so the total and every
        # subtotal can be summed in the domain, never by a SQL aggregate.
        factor = money_scale_factor(self._session, self._business_id)
        statement = (
            self._select(factor)
            .add_columns(
                ExpenseCategoryRow.name.label("category_name"),
                ExpenseCategoryRow.name_key.label("category_name_key"),
            )
            .join(
                ExpenseCategoryRow,
                and_(
                    ExpenseCategoryRow.business_id == ExpenseRow.business_id,
                    ExpenseCategoryRow.id == ExpenseRow.expense_category_id,
                ),
            )
            .where(
                ExpenseRow.business_id == self._business_id,
                ExpenseRow.spent_on >= month.first_day,
                ExpenseRow.spent_on < month.next_first_day,
            )
            .order_by(
                ExpenseRow.spent_on.desc(), ExpenseRow.recorded_at.desc(), ExpenseRow.id.desc()
            )
        )
        return [
            CategorizedExpense(
                _expense(row, domain_amount(self._session, self._business_id, row.amount)),
                row.category_name,
                row.category_name_key,
            )
            for row in self._session.execute(statement)
        ]

    def _offered_clause(self, method: PaymentMethodId) -> ColumnElement[bool]:
        """The one rule for "this business offers the method now": it is the business's
        own and not archived. Both guarded writes put this inside their own statement."""
        return exists().where(
            PaymentMethodRow.id == method.value,
            PaymentMethodRow.business_id == self._business_id,
            PaymentMethodRow.archived_at.is_(None),
        )

    def _stored(self, units: int) -> int:
        """A domain amount as the integer this business's column holds."""
        return money_stored_value(
            self._session,
            self._business_id,
            money_of_domain(self._session, self._business_id, units),
        )

    def _select(self, factor: int) -> Select[*tuple[Any, ...]]:
        """An expense's columns with its method's current name and icon. The method is
        left-joined on both `business_id` and `id`, the condition in ON, so an expense
        without a method stays in the result."""
        return (
            select(
                ExpenseRow.id,
                ExpenseRow.spent_on,
                ExpenseRow.expense_category_id,
                ExpenseRow.detail,
                ExpenseRow.recorded_at,
                ExpenseRow.payment_method_id,
                scaled(ExpenseRow.amount, factor).label("amount"),
                PaymentMethodRow.name.label("method_name"),
                PaymentMethodRow.icon.label("method_icon"),
            )
            .select_from(ExpenseRow)
            .outerjoin(
                PaymentMethodRow,
                and_(
                    PaymentMethodRow.business_id == ExpenseRow.business_id,
                    PaymentMethodRow.id == ExpenseRow.payment_method_id,
                ),
            )
        )

    def _read(self, expense_id: int) -> Expense | None:
        factor = money_scale_factor(self._session, self._business_id)
        found = self._session.execute(
            self._select(factor).where(
                ExpenseRow.id == expense_id, ExpenseRow.business_id == self._business_id
            )
        ).first()
        if found is None:
            return None
        return _expense(found, domain_amount(self._session, self._business_id, found.amount))

    def _row(self, expense_id: int) -> ExpenseRow | None:
        statement = select(ExpenseRow).where(
            ExpenseRow.id == expense_id, ExpenseRow.business_id == self._business_id
        )
        return self._session.scalar(statement)


def _expense(row: Row[tuple[object, ...]], amount: int) -> Expense:
    """The columns of one read, with the amount already the domain's int."""
    method = None if row.payment_method_id is None else PaymentMethodId(row.payment_method_id)
    label = (
        None
        if row.payment_method_id is None
        else PaymentMethodLabel(row.payment_method_id, row.method_name, row.method_icon)
    )
    return Expense(
        spent_on=row.spent_on,
        category_id=row.expense_category_id,
        amount=amount,
        detail=row.detail,
        recorded_at=row.recorded_at,
        id=row.id,
        payment_method=method,
        payment_method_label=label,
    )
