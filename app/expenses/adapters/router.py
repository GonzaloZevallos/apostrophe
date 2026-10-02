from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock, get_today
from app.db import get_session
from app.expenses.adapters.schemas import (
    CategoryIn,
    CategoryOut,
    ExpenseIn,
    ExpenseOut,
    MonthlyViewOut,
)
from app.expenses.adapters.sql_expense_categories import SqlExpenseCategories
from app.expenses.adapters.sql_expenses import SqlExpenses
from app.expenses.application import manage_categories, manage_expenses
from app.expenses.domain.category import (
    CategoryInUse,
    CategoryNameTaken,
    CategoryNotFound,
    ExpenseRuleBroken,
)
from app.expenses.domain.expense import ExpenseNotFound
from app.expenses.domain.month import Month
from app.http_errors import TranslateErrors

router = APIRouter(tags=["expenses"])
categories_router = APIRouter(prefix="/expense-categories")
expenses_router = APIRouter(prefix="/expenses")

SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]
ClockDep = Annotated[Clock, Depends(get_clock)]


def get_categories(session: SessionDep, business_id: CurrentBusinessId) -> SqlExpenseCategories:
    return SqlExpenseCategories(session, business_id)


def get_expenses(session: SessionDep, business_id: CurrentBusinessId) -> SqlExpenses:
    return SqlExpenses(session, business_id)


CategoriesDep = Annotated[SqlExpenseCategories, Depends(get_categories)]
ExpensesDep = Annotated[SqlExpenses, Depends(get_expenses)]

# Shared by both routers: every error either can raise maps to the same status either
# way, so one translation covers expense categories and expenses alike.
as_http = TranslateErrors(
    [
        (404, (CategoryNotFound, ExpenseNotFound)),
        (409, (CategoryNameTaken, CategoryInUse)),
        (422, (ExpenseRuleBroken,)),
    ]
)


@categories_router.get("")
def list_categories(categories: CategoriesDep) -> list[CategoryOut]:
    return [CategoryOut.of(c) for c in manage_categories.list_categories(categories)]


@categories_router.post("", status_code=201)
def add_category(body: CategoryIn, categories: CategoriesDep, session: SessionDep) -> CategoryOut:
    with as_http:
        category = manage_categories.add_category(categories, session, body.name)
        return CategoryOut.of(category)


@categories_router.patch("/{category_id}")
def rename_category(
    category_id: int, body: CategoryIn, categories: CategoriesDep, session: SessionDep
) -> CategoryOut:
    with as_http:
        category = manage_categories.rename_category(categories, session, category_id, body.name)
        return CategoryOut.of(category)


@categories_router.delete("/{category_id}", status_code=204)
def remove_category(category_id: int, categories: CategoriesDep, session: SessionDep) -> None:
    with as_http:
        manage_categories.remove_category(categories, session, category_id)


@expenses_router.get("")
def monthly_view(
    expenses: ExpensesDep, today: TodayDep, month: str | None = None
) -> MonthlyViewOut:
    with as_http:
        parsed = Month.containing(today) if month is None else Month.of(month)
        return MonthlyViewOut.of(manage_expenses.monthly_view(expenses, parsed))


@expenses_router.post("", status_code=201)
def record_expense(
    body: ExpenseIn,
    expenses: ExpensesDep,
    categories: CategoriesDep,
    session: SessionDep,
    today: TodayDep,
    clock: ClockDep,
) -> ExpenseOut:
    with as_http:
        expense = manage_expenses.record_expense(
            expenses,
            categories,
            session,
            spent_on=body.spent_on,
            category_id=body.category_id,
            amount=body.amount,
            detail=body.detail,
            today=today,
            recorded_at=clock(),
        )
        return ExpenseOut.of(expense)


@expenses_router.put("/{expense_id}")
def edit_expense(
    expense_id: int,
    body: ExpenseIn,
    expenses: ExpensesDep,
    categories: CategoriesDep,
    session: SessionDep,
    today: TodayDep,
) -> ExpenseOut:
    with as_http:
        expense = manage_expenses.edit_expense(
            expenses,
            categories,
            session,
            expense_id,
            spent_on=body.spent_on,
            category_id=body.category_id,
            amount=body.amount,
            detail=body.detail,
            today=today,
        )
        return ExpenseOut.of(expense)


@expenses_router.delete("/{expense_id}", status_code=204)
def delete_expense(expense_id: int, expenses: ExpensesDep, session: SessionDep) -> None:
    with as_http:
        manage_expenses.delete_expense(expenses, session, expense_id)


router.include_router(categories_router)
router.include_router(expenses_router)
