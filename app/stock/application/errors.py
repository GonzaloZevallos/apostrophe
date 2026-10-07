"""Use-case errors that are not domain rules of an entry itself (CODING_STANDARDS
section 1: `application/` never imports another hexagon).

`variety.not_found` belongs to one class system-wide
(`app.varieties.application.errors.VarietyNotFound`;
`tests/test_refusal_codes.py` refuses a second class claiming the same code), and
stock's application layer cannot import it (it would cross hexagons). `VarietyNotFound`
here is only the internal signal: it carries no `code` of its own and is never
registered with `TranslateErrors`. The adapter router catches it and raises the
varieties hexagon's own class instead, so every stock use case still answers the exact
same 404 `variety.not_found` for a foreign or a missing id.
"""


class VarietyNotFound(LookupError):
    def __init__(self) -> None:
        super().__init__("no such variety")


class VarietyArchived(LookupError):
    """The variety exists but is archived, so nothing new is recorded against it. Like
    `VarietyNotFound`, code-less: the router raises varieties' own `VarietyArchived`
    (`variety.archived`) in its place."""

    def __init__(self) -> None:
        super().__init__("variety is archived")
