class VarietyNotFound(LookupError):
    def __init__(self, variety_id: int) -> None:
        super().__init__(f"no variety {variety_id}")


class NameTaken(ValueError):
    def __init__(self, name: str) -> None:
        super().__init__(f"there is already a variety called {name}")
