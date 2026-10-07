from typing import ClassVar

from app.varieties.domain.variety import VarietyArchived as ArchivedForNew


class VarietyNotFound(LookupError):
    code: ClassVar[str] = "variety.not_found"

    def __init__(self, variety_id: int) -> None:
        super().__init__(f"no variety {variety_id}")


class NameTaken(ValueError):
    code: ClassVar[str] = "variety.name_taken"

    def __init__(self, name: str) -> None:
        super().__init__(f"there is already a variety called {name}")


class VarietyArchived(ArchivedForNew):
    """A variety that left the lists was referenced for something new: to the caller it
    is as gone as a deleted one (docs/adr/0031). The domain's own refusal is its base, so
    one class in a router's table answers for both."""

    def __init__(self, variety_id: int) -> None:
        super().__init__()
        self.variety_id = variety_id


class NameHeldByArchived(ValueError):
    """The name belongs to an archived variety: fixed text, nothing typed is repeated."""

    code: ClassVar[str] = "variety.name_archived"

    def __init__(self) -> None:
        super().__init__("the name belongs to an archived variety")
