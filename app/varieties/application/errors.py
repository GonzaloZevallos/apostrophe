from typing import ClassVar

from app.varieties.domain.variety import VarietyArchived as VarietyArchived


class VarietyNotFound(LookupError):
    code: ClassVar[str] = "variety.not_found"

    def __init__(self, variety_id: int) -> None:
        super().__init__(f"no variety {variety_id}")


class NameTaken(ValueError):
    code: ClassVar[str] = "variety.name_taken"

    def __init__(self, name: str) -> None:
        super().__init__(f"there is already a variety called {name}")


class NameHeldByArchived(ValueError):
    """The name belongs to an archived variety: fixed text, nothing typed is repeated."""

    code: ClassVar[str] = "variety.name_archived"

    def __init__(self) -> None:
        super().__init__("the name belongs to an archived variety")
