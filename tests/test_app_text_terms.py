"""Every `_In the app_` word of CONTEXT.md appears in some string value under `web/src/copy/`.

The glossary says which English word the seller sees; this keeps the copy and the glossary
from drifting apart. It reads the TypeScript sources as text, so it needs no build, but it
looks only at the string literals: a word that sits in a comment, an identifier or a longer
word shows the seller nothing.
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
)

# The comment-or-string scanner: a comment is dropped, a quoted run is kept.
TOKEN = re.compile(
    r"""//[^\n]*|/\*.*?\*/|'(?P<single>(?:\\.|[^'\\\n])*)'|"(?P<double>(?:\\.|[^"\\\n])*)"|`(?P<back>(?:\\.|[^`\\])*)`""",
    re.DOTALL,
)


def string_values(source: str) -> list[str]:
    """The text of every string literal in a TypeScript source, comments left out. A template
    literal contributes its fixed parts, one value per part."""
    values: list[str] = []
    for match in TOKEN.finditer(source):
        if match.group("single") is not None:
            values.append(match.group("single"))
        elif match.group("double") is not None:
            values.append(match.group("double"))
        elif match.group("back") is not None:
            values.extend(re.split(r"\$\{[^}]*\}", match.group("back")))
    return values


def glossary_words(context: str) -> list[str]:
    """The English words the glossary says the seller sees, from its `_In the app_` lines."""
    words: list[str] = []
    for match in LINE.finditer(context):
        value = match.group("value").strip().rstrip(".")
        if value.startswith(NO_WORD):
            continue
        for part in re.split(r" / |, ", value):
            word = re.sub(r"\s*\(.*\)$", "", part).strip()
            if word:
                words.append(word)
    return words


def words_missing(words: Iterable[str], values: Iterable[str]) -> list[str]:
    """The words that stand in no value as a whole word, or as its plural ("VIP customers"
    for "VIP customer"). Case is ignored, since a term sits lowercase inside a sentence
    ("includes pending cost")."""
    folded = [value.casefold() for value in values]
    missing: set[str] = set()
    for word in words:
        pattern = re.compile(rf"(?<!\w){re.escape(word.casefold())}s?(?!\w)")
        if not any(pattern.search(value) for value in folded):
            missing.add(word)
    return sorted(missing)


def _copy_values() -> list[str]:
    values: list[str] = []
    for path in sorted(COPY_DIR.glob("*.ts")):
        values.extend(string_values(path.read_text(encoding="utf-8")))
    return values


def test_the_glossary_has_words_to_check() -> None:
    words = glossary_words((REPO_ROOT / "CONTEXT.md").read_text(encoding="utf-8"))
    assert len(words) >= 30
    assert "Customer" in words
    assert "Balance" in words
    assert {"list", "bulk", "VIP", "gift", "special"} <= set(words)


def test_every_in_the_app_word_appears_in_some_copy_value() -> None:
    words = glossary_words((REPO_ROOT / "CONTEXT.md").read_text(encoding="utf-8"))
    assert words_missing(words, _copy_values()) == []


def test_a_word_no_copy_value_holds_is_refused() -> None:
    assert words_missing(["Customer", "Zzyzx"], ["Customer"]) == ["Zzyzx"]
    assert words_missing(["Pending cost"], ["includes pending cost"]) == []


def test_a_word_inside_a_longer_word_does_not_count() -> None:
    assert words_missing(["Customer"], ["Customerish"]) == ["Customer"]
    assert words_missing(["VIP customer"], ["VIP customers"]) == []
    assert words_missing(["special"], ["A specialist"]) == ["special"]


def test_a_word_that_only_a_comment_or_an_identifier_holds_is_refused() -> None:
    source = (
        "// Zebra is only said here\n"
        "/* and Yak here */\n"
        "export const Xenon = 'Plain'\n"
        "export const Plain2 = `Total ${Xenon} grams`\n"
    )
    values = string_values(source)
    assert values == ["Plain", "Total ", " grams"]
    assert words_missing(["Zebra", "Yak", "Xenon", "Plain", "Total"], values) == [
        "Xenon",
        "Yak",
        "Zebra",
    ]


def test_a_line_with_no_word_of_its_own_asks_for_nothing() -> None:
    context = (
        "_In the app_: no word of its own\n"
        "_In the app_: Balance / Owes\n"
        "_In the app_: Price (price history)\n"
        "_In the app_: list, bulk, VIP, gift, special\n"
    )
    assert glossary_words(context) == [
        "Balance",
        "Owes",
        "Price",
        "list",
        "bulk",
        "VIP",
        "gift",
        "special",
    ]
