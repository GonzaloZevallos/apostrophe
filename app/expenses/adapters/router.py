from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.db import get_session
from app.expenses.adapters.schemas import CategoryIn, CategoryOut
from app.expenses.adapters.sql_expense_categories import SqlExpenseCategories
from app.expenses.application import manage_categories
from app.expenses.domain.category import (
    CategoryInUse,
    CategoryNameTaken,
    CategoryNotFound,
    ExpenseRuleBroken,
)
from app.http_errors import TranslateErrors

router = APIRouter(prefix="/expense-categories", tags=["expenses"])

SessionDep = Annotated[Session, Depends(get_session)]


def get_categories(session: SessionDep, business_id: CurrentBusinessId) -> SqlExpenseCategories:
    return SqlExpenseCategories(session, business_id)


CategoriesDep = Annotated[SqlExpenseCategories, Depends(get_categories)]

as_http = TranslateErrors(
    [
        (404, (CategoryNotFound,)),
        (409, (CategoryNameTaken, CategoryInUse)),
        (422, (ExpenseRuleBroken,)),
    ]
)


@router.get("")
def list_categories(categories: CategoriesDep) -> list[CategoryOut]:
    return [CategoryOut.of(c) for c in manage_categories.list_categories(categories)]


@router.post("", status_code=201)
def add_category(body: CategoryIn, categories: CategoriesDep, session: SessionDep) -> CategoryOut:
    with as_http:
        category = manage_categories.add_category(categories, session, body.name)
        return CategoryOut.of(category)


@router.patch("/{category_id}")
def rename_category(
    category_id: int, body: CategoryIn, categories: CategoriesDep, session: SessionDep
) -> CategoryOut:
    with as_http:
        category = manage_categories.rename_category(categories, session, category_id, body.name)
        return CategoryOut.of(category)


@router.delete("/{category_id}", status_code=204)
def remove_category(category_id: int, categories: CategoriesDep, session: SessionDep) -> None:
    with as_http:
        manage_categories.remove_category(categories, session, category_id)
