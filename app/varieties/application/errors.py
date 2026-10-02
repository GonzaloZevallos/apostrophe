from typing import ClassVar


class VarietyNotFound(LookupError):
    code: ClassVar[str] = "variety.not_found"

    def __init__(self, variety_id: int) -> None:
        super().__init__(f"no variety {variety_id}")


class NameTaken(ValueError):
    code: ClassVar[str] = "variety.name_taken"

    def __init__(self, name: str) -> None:
        super().__init__(f"there is already a variety called {name}")
