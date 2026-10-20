"""Every `_In the app_` word of CONTEXT.md appears verbatim in some value under `web/src/copy/`.

The glossary says which English word the seller sees; this keeps the copy and the glossary
from drifting apart. It reads the TypeScript sources as text, so it needs no build.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
COPY_DIR = REPO_ROOT / "web" / "src" / "copy"
LINE = re.compile(r"^_In the app_: (?P<value>.+)$", re.MULTILINE)

# A line that names no word to look for, with the reason.
NO_WORD = (
    "no word of its own",
    "(operator terminal only",
    "list, bulk, VIP, gift, special",
)


def glossary_words(context: str) -> list[str]:
    """The English words the glossary says the seller sees, from its `_In the app_` lines."""
    words: list[str] = []
    for match in LINE.finditer(context):
        value = match.group("value").strip().rstrip(".")
        if value.startswith(NO_WORD):
            continue
        for part in value.split(" / "):
            word = re.sub(r"\s*\(.*\)$", "", part).strip()
            if word:
                words.append(word)
    return words


def words_missing(words: Iterable[str], copy_text: str) -> list[str]:
    """The words that appear in no copy value, letter for letter. Case is ignored, since a
    term sits lowercase inside a sentence ("includes pending cost")."""
    haystack = copy_text.casefold()
    return sorted({word for word in words if word.casefold() not in haystack})


def _copy_text() -> str:
    return "\n".join(path.read_text(encoding="utf-8") for path in sorted(COPY_DIR.glob("*.ts")))


def test_the_glossary_has_words_to_check() -> None:
    words = glossary_words((REPO_ROOT / "CONTEXT.md").read_text(encoding="utf-8"))
    assert len(words) >= 30
    assert "Customer" in words
    assert "Balance" in words


def test_every_in_the_app_word_appears_in_some_copy_value() -> None:
    words = glossary_words((REPO_ROOT / "CONTEXT.md").read_text(encoding="utf-8"))
    assert words_missing(words, _copy_text()) == []


def test_a_word_no_copy_value_holds_is_refused() -> None:
    assert words_missing(["Customer", "Zzyzx"], "const A = 'Customers'") == ["Zzyzx"]
    assert words_missing(["Pending cost"], "const A = 'includes pending cost'") == []


def test_a_line_with_no_word_of_its_own_asks_for_nothing() -> None:
    context = "_In the app_: no word of its own\n_In the app_: Balance / Owes\n_In the app_: Price (price history)\n"
    assert glossary_words(context) == ["Balance", "Owes", "Price"]
