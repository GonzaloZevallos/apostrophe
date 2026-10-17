"""The names of the failing e2e tests, for the epilogue of a red run (ADR-0040, GH-251).

`python scripts/e2e_failures.py <junit.xml>` prints one `<file> › <title>` per failed or
errored test case, in file order. Only names are printed, never a message or an output
body: those can hold what the test typed. A missing or unreadable junit prints one fixed
line and still exits 0, so this helper never changes the run's own status.
"""

from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from collections.abc import Sequence
from pathlib import Path

MISSING_LINE = "e2e: no junit file to read the failing tests from"


def failures(junit_path: Path) -> list[str]:
    """`"<file> › <title>"` of each failed or errored test case of `junit_path`."""
    root = ET.parse(junit_path).getroot()
    names: list[str] = []
    for case in root.iter("testcase"):
        if case.find("failure") is not None or case.find("error") is not None:
            names.append(f"{case.get('classname', '')} › {case.get('name', '')}")
    return names


def main(argv: Sequence[str]) -> int:
    if len(argv) != 1:
        print(MISSING_LINE)
        return 0
    try:
        names = failures(Path(argv[0]))
    except (OSError, ET.ParseError):
        print(MISSING_LINE)
        return 0
    for name in names:
        print(name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
