"""The catalog header and footer, per business (CONTEXT.md: Catalog header and
footer). Free multi-line text normalised the same way before validation and storage:
line endings folded to `\\n`, then leading and trailing blank or whitespace-only lines
dropped. Inner text, blank lines included, is kept exactly as typed.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.catalog.domain.errors import FooterTooLong, HeaderTooLong

DEFAULT_HEADER = "\U0001f33f **CATÁLOGO** \U0001f33f"
DEFAULT_FOOTER = "\U0001f4e9 Consultas y pedidos por privado."

MAX_LENGTH = 500


def header_footer_text(raw: str) -> str:
    """CRLF and lone CR become LF; leading and trailing lines that are empty or
    whitespace-only are dropped; everything else is kept as typed."""
    lines = raw.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    start = 0
    while start < len(lines) and lines[start].strip() == "":
        start += 1
    end = len(lines)
    while end > start and lines[end - 1].strip() == "":
        end -= 1
    return "\n".join(lines[start:end])


@dataclass(frozen=True)
class CatalogHeaderFooter:
    header: str
    footer: str

    def __post_init__(self) -> None:
        if self.header != header_footer_text(self.header):
            raise ValueError(
                "a CatalogHeaderFooter holds an already normalised header; build it "
                "through CatalogHeaderFooter.of"
            )
        if self.footer != header_footer_text(self.footer):
            raise ValueError(
                "a CatalogHeaderFooter holds an already normalised footer; build it "
                "through CatalogHeaderFooter.of"
            )
        if len(self.header) > MAX_LENGTH:
            raise HeaderTooLong()
        if len(self.footer) > MAX_LENGTH:
            raise FooterTooLong()

    @classmethod
    def of(cls, header: str, footer: str) -> CatalogHeaderFooter:
        return cls(header_footer_text(header), header_footer_text(footer))
