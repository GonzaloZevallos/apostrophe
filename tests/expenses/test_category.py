"""`CategoryName` and `ExpenseCategory` with no infrastructure (CODING_STANDARDS §5)."""

import pytest

from app.expenses.domain.category import (
    CategoryInUse,
    CategoryName,
    ExpenseCategory,
    InvalidCategoryName,
)


def test_a_name_is_trimmed_and_collapsed() -> None:
    assert CategoryName.of("  Insumos   de   cultivo ").value == "Insumos de cultivo"


def test_a_name_exactly_at_the_limit_is_accepted() -> None:
    assert CategoryName.of("x" * 60).value == "x" * 60


@pytest.mark.parametrize(
    "raw",
    ["", "   "],
)
def test_a_blank_name_is_refused(raw: str) -> None:
    with pytest.raises(InvalidCategoryName, match="needs a name"):
        CategoryName.of(raw)


def test_a_name_over_the_limit_is_refused() -> None:
    with pytest.raises(InvalidCategoryName, match="at most 60 characters"):
        CategoryName.of("x" * 61)


def test_two_names_differing_only_in_case_or_spacing_share_a_key() -> None:
    assert CategoryName.of("Packaging").key == CategoryName.of("  PACKAGING ").key


def test_a_category_with_no_filed_expenses_is_removable() -> None:
    category = ExpenseCategory(CategoryName.of("Otros"), id=1)

    category.check_removable(0)  # does not raise


def test_a_category_with_a_filed_expense_is_not_removable() -> None:
    category = ExpenseCategory(CategoryName.of("Otros"), id=1)

    with pytest.raises(CategoryInUse, match="still has expenses"):
        category.check_removable(1)
