"""Coverage totals of a CI run, in one place (ADR-0055): the job summary and the PR comment.

`render(pytest, vitest, baseline, lag)` is the one function that turns coverage data into
Markdown, and the text it returns is both the job summary and the PR comment body. The rest
is reading: `combine_pytest` merges the data files of the pytest groups (the artifacts named
by `ci_changes.coverage_artifact`) and `read_pytest_json` / `read_vitest_summary` turn what
coverage.py and vitest wrote into per-area counts. Only file paths and percentages leave
this module; nothing from a test, a business or a person.

- A run where only some pytest groups ran is labelled "partial: N of M areas" and its totals
  are not compared with the baseline; its areas are, one by one.
- `docs/coverage-baseline.md` holds the tables of a first full run (the same Markdown this
  module renders). When it does not exist the output is complete all the same: every table,
  every total, with a line saying there is no baseline yet.
- `lag` is the list of `area -> group` edges a fresh `ci_changes.py derive` found that the
  committed `scripts/pytest_areas.json` lacks; it prints a warning line, never fails.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import cast

import coverage

from scripts.ci_changes import (
    AREAS_MAP_PATH,
    GROUPS,
    REPO_ROOT,
    coverage_artifact,
    missing_edges,
    read_areas_map,
)

BASELINE_PATH = REPO_ROOT / "docs" / "coverage-baseline.md"
COMMENT_MARKER = "<!-- ci-coverage -->"
TOTAL = "Total"
ROOT_AREA = "(root)"
# The `test` job (the "always" paths) uploads its pytest data under this group name. It adds to
# the totals but is not one of the `GROUPS` a partial run counts.
ALWAYS_GROUP = "always"

PYTEST = "pytest"
VITEST = "vitest"


@dataclass(frozen=True)
class Counts:
    covered: int
    total: int

    @property
    def pct(self) -> float:
        return 100.0 * self.covered / self.total if self.total else 100.0

    def __add__(self, other: Counts) -> Counts:
        return Counts(self.covered + other.covered, self.total + other.total)


Areas = Mapping[str, Counts]


@dataclass(frozen=True)
class Suite:
    """The coverage of one suite: counts per area. `ran` / `expected` are the pytest groups
    that produced data and the groups there are; `expected == 0` means the suite has no
    groups (vitest) and is always complete."""

    areas: Areas
    ran: int = 0
    expected: int = 0

    @property
    def partial(self) -> bool:
        return self.ran < self.expected

    @property
    def total(self) -> Counts:
        return sum(self.areas.values(), Counts(0, 0))


# suite name -> area (or TOTAL) -> counts
Baseline = Mapping[str, Areas]


# --- reading what the tools wrote ----------------------------------------------------------


def pytest_area(path: str) -> str | None:
    """`app/<X>/...` -> X, a module right under `app/` -> "(root)", `app/shared/...` ->
    "shared"; a path outside `app/` is None."""
    parts = PurePosixPath(path.replace("\\", "/")).parts
    if not parts or parts[0] != "app":
        return None
    return parts[1] if len(parts) > 2 else ROOT_AREA


def _add(areas: dict[str, Counts], area: str, counts: Counts) -> None:
    areas[area] = areas.get(area, Counts(0, 0)) + counts


def read_pytest_json(text: str) -> dict[str, Counts]:
    """Per-area counts from `coverage json` (relative paths, see `relative_files`)."""
    files = cast("Mapping[str, Mapping[str, Mapping[str, int]]]", json.loads(text)["files"])
    areas: dict[str, Counts] = {}
    for path, body in files.items():
        area = pytest_area(path)
        if area is not None:
            summary = body["summary"]
            _add(areas, area, Counts(summary["covered_lines"], summary["num_statements"]))
    return areas


def vitest_area(path: str, checkout: Path | None) -> str | None:
    """The first directory under `web/src` ("(root)" for a file right in it). vitest keys its
    summary by absolute runner path: the checkout prefix is stripped here; with no checkout
    given, from the first `web/src/` in the path."""
    relative: str | None = None
    if checkout is not None:
        prefix = f"{checkout.as_posix().rstrip('/')}/web/src/"
        if path.startswith(prefix):
            relative = path[len(prefix) :]
    if relative is None:
        match = re.search(r"(?:^|/)web/src/(.+)$", path)
        relative = match.group(1) if match else None
    if relative is None:
        return None
    parts = relative.split("/")
    return parts[0] if len(parts) > 1 else ROOT_AREA


def read_vitest_summary(text: str, checkout: Path | None = None) -> dict[str, Counts]:
    """Per-area line counts from vitest's `coverage-summary.json` (the `json-summary`)."""
    entries = cast("Mapping[str, Mapping[str, Mapping[str, float]]]", json.loads(text))
    areas: dict[str, Counts] = {}
    for path, body in entries.items():
        if path == "total":
            continue
        area = vitest_area(path, checkout)
        if area is not None:
            _add(areas, area, Counts(int(body["lines"]["covered"]), int(body["lines"]["total"])))
    return areas


def group_dirs(artifacts: Path) -> dict[str, Path]:
    """The pytest groups that left data: `<artifacts>/<coverage_artifact(group)>` holding at
    least one data file."""
    found: dict[str, Path] = {}
    for group in (*GROUPS, ALWAYS_GROUP):
        directory = artifacts / coverage_artifact(group)
        if directory.is_dir() and any(directory.glob(".coverage*")):
            found[group] = directory
    return found


def combine_pytest(directories: Sequence[Path], checkout: Path, scratch: Path) -> str:
    """Merge the data files of the given directories and return `coverage json` of them. The
    paths in the data are relative to the checkout, which must be the working directory."""
    scratch.mkdir(parents=True, exist_ok=True)
    config = checkout / "pyproject.toml"  # `relative_files` and `source` live there
    cov = coverage.Coverage(data_file=str(scratch / ".coverage"), config_file=str(config))
    cov.combine([str(directory) for directory in directories], keep=True)
    out = scratch / "coverage.json"
    cov.json_report(outfile=str(out))
    return out.read_text(encoding="utf-8")


# --- the baseline --------------------------------------------------------------------------

_HEADING = re.compile(r"^#{2,6}\s+(pytest|vitest)\b", re.IGNORECASE)


def parse_baseline(text: str) -> dict[str, dict[str, Counts]]:
    """The `Area | Covered | Total | ...` rows under each `pytest` / `vitest` heading."""
    baseline: dict[str, dict[str, Counts]] = {}
    suite: str | None = None
    for line in text.splitlines():
        heading = _HEADING.match(line)
        if heading:
            suite = heading.group(1).lower()
            continue
        if suite is None or not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) >= 3 and cells[1].isdigit() and cells[2].isdigit():
            baseline.setdefault(suite, {})[cells[0]] = Counts(int(cells[1]), int(cells[2]))
    return baseline


def read_baseline(path: Path = BASELINE_PATH) -> dict[str, dict[str, Counts]] | None:
    """None when there is no baseline file (the first run, before one is written)."""
    return parse_baseline(path.read_text(encoding="utf-8")) if path.is_file() else None


# --- the Markdown --------------------------------------------------------------------------


def _delta(now: Counts, before: Counts | None) -> str:
    if before is None:
        return "new"
    return f"{now.pct - before.pct:+.1f}"


def _table(suite: Suite, before: Areas | None, compare_total: bool) -> list[str]:
    lines = ["| Area | Covered | Total | % | vs baseline |", "| --- | ---: | ---: | ---: | ---: |"]
    for area in sorted(suite.areas):
        counts = suite.areas[area]
        delta = "–" if before is None else _delta(counts, before.get(area))
        row = f"| {area} | {counts.covered} | {counts.total} | {counts.pct:.1f}% | {delta} |"
        lines.append(row)
    total = suite.total
    delta = "–" if before is None or not compare_total else _delta(total, before.get(TOTAL))
    lines.append(f"| {TOTAL} | {total.covered} | {total.total} | {total.pct:.1f}% | {delta} |")
    return lines


def _section(name: str, suite: Suite | None, baseline: Baseline | None) -> list[str]:
    lines = [f"#### {name}", ""]
    if suite is None:
        return [*lines, "Skipped: the change does not affect this suite.", ""]
    if suite.partial:
        lines += [
            f"Partial: {suite.ran} of {suite.expected} areas ran. The total below is of those "
            "areas only; areas are compared with the baseline one by one, the total is not.",
            "",
        ]
    before = None if baseline is None else baseline.get(name, {})
    return [*lines, *_table(suite, before, not suite.partial), ""]


def render(
    pytest: Suite | None,
    vitest: Suite | None,
    baseline: Baseline | None,
    lag: Sequence[str] = (),
) -> str:
    """The Markdown of one run: a table per suite, areas and total. `None` for a suite that
    did not run; `baseline` None when there is no baseline file yet."""
    lines = [COMMENT_MARKER, "### Coverage", ""]
    if baseline is None:
        lines += ["No baseline yet: `docs/coverage-baseline.md` does not exist.", ""]
    if lag:
        lines += [
            f"**Warning:** `scripts/pytest_areas.json` map is {len(lag)} edges behind "
            f"({', '.join(lag)}); run `ci_changes.py derive` and commit it.",
            "",
        ]
    lines += _section(PYTEST, pytest, baseline)
    lines += _section(VITEST, vitest, baseline)
    return "\n".join(lines).rstrip("\n") + "\n"


# --- the job -------------------------------------------------------------------------------


def _arguments(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render the coverage of a CI run as Markdown.")
    parser.add_argument("--artifacts", type=Path, help="directory holding coverage-pytest-*")
    parser.add_argument("--vitest", type=Path, help="vitest coverage-summary.json")
    parser.add_argument("--baseline", type=Path, default=BASELINE_PATH)
    parser.add_argument("--derived", type=Path, help="area map from `ci_changes.py derive`")
    parser.add_argument("--checkout", type=Path, default=REPO_ROOT)
    parser.add_argument("--scratch", type=Path, default=REPO_ROOT / ".coverage-combined")
    return parser.parse_args(argv)


def main(argv: Sequence[str]) -> int:
    args = _arguments(argv)
    pytest_suite: Suite | None = None
    if args.artifacts is not None:
        found = group_dirs(args.artifacts)
        if found:
            text = combine_pytest(list(found.values()), args.checkout, args.scratch)
            ran = sum(1 for group in found if group != ALWAYS_GROUP)
            pytest_suite = Suite(read_pytest_json(text), ran, len(GROUPS))
    vitest_suite: Suite | None = None
    if args.vitest is not None and args.vitest.is_file():
        vitest_suite = Suite(
            read_vitest_summary(args.vitest.read_text(encoding="utf-8"), args.checkout)
        )
    lag: list[str] = []
    if args.derived is not None and args.derived.is_file():
        derived = cast("dict[str, list[str]]", json.loads(args.derived.read_text()))
        lag = missing_edges(read_areas_map(AREAS_MAP_PATH), derived)
    sys.stdout.write(render(pytest_suite, vitest_suite, read_baseline(args.baseline), lag))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
