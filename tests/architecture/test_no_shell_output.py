"""Operator shell scripts print no literal text (docs/adr/0050): every word an operator
reads comes from the Python command they `exec` into, where it is rendered from the operator
language. A script that `echo`es or `printf`s its own text would be English the translation
never sees.

`scripts/*.sh` is scanned, not recursively, so `scripts/design/` (the design tooling) is out.
`shell_output_lines` is a pure function over a script's text; the real-directory test applies
it to today's scripts, with no allowlist.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"

# A command word `echo` or `printf` at the start of a line or after a separator or a
# compound-command keyword; and a here-document fed to `cat`. `echoes` and `echo-foo` are
# other words.
_PRINT = re.compile(r"(?:^|;|&&|\|\||\||\{|\(|\bthen\b|\bdo\b|\belse\b)\s*(?:echo|printf)(?![\w-])")
_HEREDOC = re.compile(r"\bcat\s*<<")


def _without_comment(line: str) -> str:
    """`line` up to a `#` that opens a comment: outside quotes, at the start or after
    whitespace."""
    quote = ""
    for index, char in enumerate(line):
        if quote:
            if char == quote:
                quote = ""
        elif char in "'\"":
            quote = char
        elif char == "#" and (index == 0 or line[index - 1].isspace()):
            return line[:index]
    return line


def shell_output_lines(text: str) -> list[int]:
    """The 1-based numbers of the lines of a script that print literal text."""
    found: list[int] = []
    for number, line in enumerate(text.splitlines(), start=1):
        code = _without_comment(line)
        if _PRINT.search(code) or _HEREDOC.search(code):
            found.append(number)
    return found


def test_the_scripts_directory_is_where_the_scripts_are() -> None:
    assert (SCRIPTS / "serve.sh").is_file()
    assert (SCRIPTS / "design").is_dir()


def test_no_operator_script_prints_literal_text() -> None:
    scripts = sorted(SCRIPTS.glob("*.sh"))
    assert scripts, "no scripts found"

    offenders = {
        script.name: shell_output_lines(script.read_text(encoding="utf-8")) for script in scripts
    }

    assert {name: lines for name, lines in offenders.items() if lines} == {}


@pytest.mark.parametrize(
    "snippet",
    [
        'echo "hello"',
        "  echo hello",
        "printf '%s\\n' hi",
        'set -e; echo "x"',
        'cd x && echo "x"',
        'false || echo "x"',
        'ls | printf "x"',
        'if [ -f a ]; then echo "x"; fi',
        'for a in b; do printf "x"; done',
        '{ echo "x"; }',
        '( echo "x" )',
        "echo",
        "cat <<EOF",
        "cat << 'EOF'",
        'echo "# not a comment"',
    ],
)
def test_the_scanner_flags_a_script_that_prints_literal_text(snippet: str) -> None:
    assert shell_output_lines(snippet) == [1]


@pytest.mark.parametrize(
    "snippet",
    [
        "# echo hello",
        "  # printf '%s' hi",
        "exec uv run python -m app.accounts.adapters.cli",
        "echoes=1",
        "the echoes of printf",
        "my-echo-tool --flag",
        "cmd # echo trailing comment",
        "export ECHO=1",
        "cat file.txt",
        "",
    ],
)
def test_the_scanner_ignores_comments_other_words_and_commands(snippet: str) -> None:
    assert shell_output_lines(snippet) == []


def test_the_scanner_names_the_line() -> None:
    text = "#!/usr/bin/env bash\nset -e\n\nexec python -m x\necho done\n"

    assert shell_output_lines(text) == [5]
