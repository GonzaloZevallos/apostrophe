"""The coverage report CI posts on a pull request (GH-448).

`report(...)` is a pure function: the parsed pytest coverage JSON (coverage.py, with
`relative_files` paths `app/<area>/...`), vitest's `coverage-summary.json`, the selection
that ran and the parsed baseline in, Markdown out. An area's state comes from the
selection, never from the JSON: the JSON only supplies the percentages.

The CLI is the only part that touches files, and it prints only paths and percentages:

    ci_coverage.py report --selection S.json [--pytest-json P] [--vitest-summary V] [--baseline B]
    ci_coverage.py baseline <dir> [--output docs/ci/coverage-baseline.md]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Final

REPO_ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = REPO_ROOT / "docs" / "ci" / "coverage-baseline.md"

MARKER: Final = "<!-- ci-coverage -->"
BASELINE_MARKER: Final = "<!-- ci-coverage-baseline -->"
PYTEST_SCOPE: Final = "pytest"
VITEST_SCOPE: Final = "vitest"
AREA_PREFIX: Final = "app/"
NOT_RUN: Final = "not run"
NO_VALUE: Final = "–"

PYTEST_REPORT_NAME: Final = "coverage.json"
VITEST_REPORT_NAME: Final = "coverage-summary.json"

_BASELINE_ROW = re.compile(r"^\|\s*(?P<scope>[^|]+?)\s*\|\s*(?P<pct>\d+(?:\.\d+)?)%\s*\|$")

JsonObject = Mapping[str, object]
Baseline = Mapping[str, float]


@dataclass(frozen=True)
class Selection:
    """What the `changes` job selected: the three suite flags and the areas.

    `areas` is every pytest area; `selected` is the areas whose tests sat in a shard.
    """

    pytest: bool
    vitest: bool
    e2e: bool
    areas: frozenset[str]
    selected: frozenset[str]

    @property
    def is_full(self) -> bool:
        return self.pytest and self.vitest and self.areas <= self.selected


def _flag(value: object) -> bool:
    return value is True or value == "true"


def parse_selection(data: JsonObject) -> Selection:
    """Reads the selection document (flags as `"true"`/`"false"` strings or booleans)."""
    areas = data.get("areas")
    selected = data.get("selected")
    return Selection(
        pytest=_flag(data.get("pytest")),
        vitest=_flag(data.get("vitest")),
        e2e=_flag(data.get("e2e")),
        areas=frozenset(_strings(areas)),
        selected=frozenset(_strings(selected)),
    )


def _strings(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _object(value: object) -> JsonObject:
    if not isinstance(value, dict):
        return {}
    return {key: item for key, item in value.items() if isinstance(key, str)}


def _number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value)


def _percent(covered: float, total: float) -> float | None:
    return covered / total * 100 if total > 0 else None


def _area_of(path: str) -> str | None:
    """`app/<area>/...` -> `<area>`; a file directly under `app/` belongs to no area."""
    parts = path.split("/")
    if len(parts) >= 3 and parts[0] == "app":
        return parts[1]
    return None


def pytest_percentages(pytest_json: JsonObject) -> tuple[float | None, dict[str, float | None]]:
    """The pytest total and the per-area percentages, summed from the files' line counts."""
    covered_total = 0.0
    statements_total = 0.0
    area_sums: dict[str, tuple[float, float]] = {}
    for path, entry in _object(pytest_json.get("files")).items():
        summary = _object(_object(entry).get("summary"))
        covered = _number(summary.get("covered_lines"))
        statements = _number(summary.get("num_statements"))
        if covered is None or statements is None:
            continue
        covered_total += covered
        statements_total += statements
        area = _area_of(path)
        if area is not None:
            seen_covered, seen_statements = area_sums.get(area, (0.0, 0.0))
            area_sums[area] = (seen_covered + covered, seen_statements + statements)
    areas = {area: _percent(c, s) for area, (c, s) in area_sums.items()}
    return _percent(covered_total, statements_total), areas


def vitest_percentage(vitest_summary: JsonObject) -> float | None:
    lines = _object(_object(vitest_summary.get("total")).get("lines"))
    return _number(lines.get("pct"))


def _cell(value: float | None) -> str:
    return NO_VALUE if value is None else f"{value:.1f}%"


def _delta(current: float | None, previous: float | None) -> str:
    if current is None or previous is None:
        return NO_VALUE
    change = current - previous
    return f"{change:+.1f}" if abs(change) >= 0.05 else "0.0"


def _row(scope: str, shown: str, current: float | None, baseline: Baseline | None) -> str:
    if baseline is None:
        return f"| {scope} | {shown} |"
    delta = _delta(current, baseline.get(scope)) if current is not None else NO_VALUE
    return f"| {scope} | {shown} | {delta} |"


def report(
    pytest_json: JsonObject | None,
    vitest_summary: JsonObject | None,
    selection: Selection,
    baseline: Baseline | None,
) -> str:
    """Markdown with the totals per suite and the lines covered per `app/<area>`.

    Deltas against `baseline` appear only on a full run; a partial run says so and has no
    delta column.
    """
    deltas = baseline if selection.is_full else None
    pytest_total, area_percentages = (
        pytest_percentages(pytest_json) if pytest_json is not None else (None, {})
    )
    vitest_total = vitest_percentage(vitest_summary) if vitest_summary is not None else None

    lines = [MARKER, "## Coverage", ""]
    if not selection.is_full:
        lines += [
            "_Partial run: only the selected suites and areas were measured, so there are"
            " no deltas._",
            "",
        ]
    header = "| Scope | Lines |" + (" Delta |" if deltas is not None else "")
    divider = "| --- | --- |" + (" --- |" if deltas is not None else "")

    lines += ["### Suites", "", header, divider]
    lines.append(
        _row(
            PYTEST_SCOPE,
            _suite_cell(selection.pytest, pytest_json is not None, pytest_total),
            pytest_total if selection.pytest else None,
            deltas,
        )
    )
    lines.append(
        _row(
            VITEST_SCOPE,
            _suite_cell(selection.vitest, vitest_summary is not None, vitest_total),
            vitest_total if selection.vitest else None,
            deltas,
        )
    )

    lines += ["", "### Areas", "", header, divider]
    for area in sorted(selection.areas | set(area_percentages)):
        scope = f"{AREA_PREFIX}{area}"
        if selection.pytest and area in selection.selected:
            percentage = area_percentages.get(area)
            lines.append(_row(scope, _cell(percentage), percentage, deltas))
        else:
            lines.append(_row(scope, NOT_RUN, None, deltas))
    return "\n".join(lines) + "\n"


def _suite_cell(ran: bool, has_report: bool, percentage: float | None) -> str:
    if not ran:
        return NOT_RUN
    if not has_report:
        return "no report"
    return _cell(percentage)


def baseline_markdown(pytest_json: JsonObject | None, vitest_summary: JsonObject | None) -> str:
    """The baseline document: a full run's totals and areas, in a table `parse_baseline` reads."""
    suites: list[tuple[str, float]] = []
    areas: list[tuple[str, float]] = []
    if pytest_json is not None:
        pytest_total, area_percentages = pytest_percentages(pytest_json)
        if pytest_total is not None:
            suites.append((PYTEST_SCOPE, pytest_total))
        areas = [
            (f"{AREA_PREFIX}{area}", value)
            for area, value in sorted(area_percentages.items())
            if value is not None
        ]
    if vitest_summary is not None:
        vitest_total = vitest_percentage(vitest_summary)
        if vitest_total is not None:
            suites.append((VITEST_SCOPE, vitest_total))
    rows = suites + areas
    lines = [BASELINE_MARKER, "# Coverage baseline", "", "| Scope | Lines |", "| --- | --- |"]
    lines += [f"| {scope} | {value:.1f}% |" for scope, value in rows]
    return "\n".join(lines) + "\n"


def parse_baseline(text: str) -> dict[str, float]:
    """Reads the table `baseline_markdown` wrote; anything else in the text is ignored."""
    parsed: dict[str, float] = {}
    for line in text.splitlines():
        match = _BASELINE_ROW.match(line.strip())
        if match is not None:
            parsed[match["scope"]] = float(match["pct"])
    return parsed


def _read_json(path: Path | None) -> JsonObject | None:
    if path is None or not path.is_file():
        return None
    return _object(json.loads(path.read_text(encoding="utf-8")))


def _optional_path(value: str | None) -> Path | None:
    return Path(value) if value is not None else None


def write_baseline(directory: Path, output: Path) -> None:
    """Reads the two reports in `directory` and writes the baseline Markdown to `output`."""
    text = baseline_markdown(
        _read_json(directory / PYTEST_REPORT_NAME), _read_json(directory / VITEST_REPORT_NAME)
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(text, encoding="utf-8")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    report_parser = commands.add_parser("report", help="print the coverage Markdown")
    report_parser.add_argument("--selection", required=True)
    report_parser.add_argument("--pytest-json")
    report_parser.add_argument("--vitest-summary")
    report_parser.add_argument("--baseline")

    baseline_parser = commands.add_parser("baseline", help="write the baseline Markdown")
    baseline_parser.add_argument("directory")
    baseline_parser.add_argument("--output", default=str(BASELINE_PATH))

    args = parser.parse_args(argv)
    if args.command == "baseline":
        write_baseline(Path(args.directory), Path(args.output))
        print(args.output)
        return 0

    selection_json = _read_json(Path(args.selection))
    if selection_json is None:
        print(f"ci_coverage: no selection at {args.selection}", file=sys.stderr)
        return 1
    baseline_path = _optional_path(args.baseline)
    baseline = (
        parse_baseline(baseline_path.read_text(encoding="utf-8"))
        if baseline_path is not None and baseline_path.is_file()
        else None
    )
    print(
        report(
            _read_json(_optional_path(args.pytest_json)),
            _read_json(_optional_path(args.vitest_summary)),
            parse_selection(selection_json),
            baseline or None,
        ),
        end="",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
