"""The docs word check (GH-742): the old product word never appears in the product docs.

The rule is written in `docs/product/gate.md`. `PATTERN` below is the only copy of the
acceptance regex: no other file, test or script writes it. Everything here is pure and
stdlib only, with no git, subprocess or network call; `test_docs_word_check.py` runs it.
"""

import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path

PATTERN = r"\bflowers?\b|\bflor(es)?\b"
_WORD = re.compile(PATTERN, re.IGNORECASE)

_BINARY_PREFIX = 8000
_ROOT_FILES = ("README.md", "CONTEXT.md")
_TREE_DIR = "docs/product"


def is_binary(data: bytes) -> bool:
    """A NUL byte in the first 8000 bytes, the way git decides a file is binary."""
    return b"\x00" in data[:_BINARY_PREFIX]


@dataclass(frozen=True)
class Exemption:
    """A phrase that must be quoted verbatim in one file, with the reason it is allowed."""

    path: str
    phrase: str
    reason: str

    def __post_init__(self) -> None:
        if not self.path.strip():
            raise ValueError("An exemption needs the POSIX relative path of its file.")
        if not self.phrase.strip():
            raise ValueError(f"The exemption for {self.path} has a blank phrase.")
        if not self.reason.strip():
            raise ValueError(f"The exemption for {self.path} has a blank reason.")
        if "\n" in self.phrase:
            raise ValueError(f"The phrase of the exemption for {self.path} contains a newline.")
        if not _WORD.search(self.phrase):
            raise ValueError(
                f"The phrase {self.phrase!r} of the exemption for {self.path} "
                "does not match the pattern, so it exempts nothing."
            )


@dataclass(frozen=True)
class Match:
    path: str
    line: int
    word: str


@dataclass(frozen=True)
class Report:
    matches: tuple[Match, ...]
    stale: tuple[Exemption, ...]
    skipped_binary: int = 0

    @property
    def ok(self) -> bool:
        return not self.matches and not self.stale

    def messages(self) -> list[str]:
        """One English message per match and one per stale exemption; empty means it passes."""
        found = [
            f"{m.path}:{m.line}:{m.word}: describe the product generically; only for a "
            "historical or external name that must be quoted verbatim, add an Exemption "
            "with its reason to EXEMPTIONS in tests/docs/word_check.py."
            for m in self.matches
        ]
        old = [
            f"Stale exemption for {e.path}: the phrase {e.phrase!r} is not in that file "
            "any more; remove it from EXEMPTIONS in tests/docs/word_check.py."
            for e in self.stale
        ]
        return [*found, *old]


def _lines(text: str) -> list[str]:
    """Split on "\\n" only, like git grep and editors, dropping a trailing "\\r"."""
    return [line.removesuffix("\r") for line in text.split("\n")]


def findings(files: Mapping[str, str], exemptions: Iterable[Exemption]) -> Report:
    """Every match of the pattern, once the exempt phrases of each file are blanked out."""
    exempt = list(exemptions)
    matches: list[Match] = []
    for path in sorted(files):
        phrases = [e.phrase for e in exempt if e.path == path]
        for number, line in enumerate(_lines(files[path]), start=1):
            rest = line
            for phrase in phrases:
                rest = rest.replace(phrase, " ")
            matches.extend(Match(path, number, m.group()) for m in _WORD.finditer(rest))
    stale = tuple(
        e for e in exempt if e.path not in files or e.phrase not in _joined(files[e.path])
    )
    return Report(tuple(matches), stale)


def _joined(text: str) -> str:
    return "\n".join(_lines(text))


def read_tree(root: Path) -> tuple[dict[str, str], int]:
    """README.md, CONTEXT.md and docs/product/** under `root`: text by POSIX path, binaries counted.

    Any path with a part starting with "." (relative to `root`) is ignored.
    """
    candidates = [root / name for name in _ROOT_FILES]
    candidates.extend((root / _TREE_DIR).rglob("*"))
    files: dict[str, str] = {}
    skipped = 0
    for path in candidates:
        relative = path.relative_to(root)
        if any(part.startswith(".") for part in relative.parts) or not path.is_file():
            continue
        data = path.read_bytes()
        if is_binary(data):
            skipped += 1
            continue
        files[relative.as_posix()] = data.decode("utf-8", errors="replace")
    return dict(sorted(files.items())), skipped


EXEMPTIONS: tuple[Exemption, ...] = ()
