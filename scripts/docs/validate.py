"""How the generator asks the local Mermaid parser whether the diagrams it wrote parse.

`web/scripts/docs/mermaidParse.ts` is the parser; it runs as one `node` subprocess over
every file. A `Validator` is anything that takes the files and answers with a
`ParseReport`, so the pipeline's tests inject a fake and never spawn `node`.
Imports nothing from `app` or `tests`.
"""

from __future__ import annotations

import os
import re
import subprocess
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

from scripts.docs.tools import REPO_ROOT, tool_env

PARSER_SCRIPT = "web/scripts/docs/mermaidParse.ts"

_PROBLEM = re.compile(r"^(?P<file>.+): block (?P<block>\d+): (?P<message>.*)$")
_COUNT = re.compile(r"^checked (?P<blocks>\d+) blocks in \d+ files$")


@dataclass(frozen=True)
class ParseProblem:
    """One block the parser rejected. `block` is 1-based; 0 means the parser itself failed."""

    path: Path
    block: int
    message: str


@dataclass(frozen=True)
class ParseReport:
    """What the parser found. `blocks_checked` is None when it printed no count line."""

    problems: tuple[ParseProblem, ...]
    blocks_checked: int | None


Validator = Callable[[Sequence[Path]], ParseReport]


def parse_node_output(stdout: str, shown: Mapping[str, Path]) -> ParseReport:
    """Read the parser's output: `<file>: block <n>: <message>` lines, then a count line.

    `shown` maps each file name as it was passed to the parser to the file it stands for.
    The count line must be the last non-blank line; without it `blocks_checked` is None.
    """
    lines = [line for line in stdout.splitlines() if line.strip()]
    checked: int | None = None
    if lines:
        match = _COUNT.match(lines[-1])
        if match is not None:
            checked = int(match.group("blocks"))
            lines = lines[:-1]
    problems: list[ParseProblem] = []
    for line in lines:
        found = _PROBLEM.match(line)
        if found is None:
            continue
        file = found.group("file")
        problems.append(
            ParseProblem(
                shown.get(file, Path(file)), int(found.group("block")), found.group("message")
            )
        )
    return ParseReport(tuple(problems), checked)


def node_validator(repo_root: Path = REPO_ROOT) -> Validator:
    """The production validator: one `node` run over all files, paths relative to the repo."""

    def validate(files: Sequence[Path]) -> ParseReport:
        shown = {os.path.relpath(file, repo_root): file for file in files}
        try:
            done = subprocess.run(
                ["node", PARSER_SCRIPT, *shown],
                cwd=repo_root,
                env=tool_env(),
                capture_output=True,
                text=True,
                check=False,
            )
        except OSError as error:
            return ParseReport((ParseProblem(files[0], 0, f"could not start node: {error}"),), None)
        report = parse_node_output(done.stdout, shown)
        if report.blocks_checked is None and done.stderr.strip():
            crash = done.stderr.strip().splitlines()[-1]
            return ParseReport(
                (*report.problems, ParseProblem(files[0], 0, f"parser crashed: {crash}")), None
            )
        return report

    return validate
