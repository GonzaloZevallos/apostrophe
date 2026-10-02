from pydantic import BaseModel

from app.expenses.domain.category import ExpenseCategory


class CategoryIn(BaseModel):
    name: str


class CategoryOut(BaseModel):
    id: int
    name: str

    @classmethod
    def of(cls, category: ExpenseCategory) -> "CategoryOut":
        assert category.id is not None, "only stored categories go out"
        return cls(id=category.id, name=category.name.value)
