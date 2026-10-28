"""The verdict of the `ci-ok` job of `.github/workflows/ci.yml` (ADR-0055).

`ci-ok` needs every other job and runs with `if: always()`; it passes when each of them
passed or was skipped as unaffected. `python scripts/ci_verdict.py "$NEEDS"` takes the
`needs` context as JSON (`{"<job>": {"result": "success", ...}}`) and exits 1 on any
`failure` or `cancelled` result. A result it does not know, a malformed context and an empty
one fail too: a gate that cannot read what it judges never passes.
"""

from __future__ import annotations

import json
import sys
from collections.abc import Mapping, Sequence

PASSING = frozenset({"success", "skipped"})


def failing_jobs(needs: Mapping[str, object]) -> list[str]:
    """The jobs whose result is not `success` or `skipped`, in the order given."""
    failing: list[str] = []
    for job, body in needs.items():
        result = body.get("result") if isinstance(body, Mapping) else None
        if result not in PASSING:
            failing.append(job)
    return failing


def verdict(needs: Mapping[str, object]) -> bool:
    """True when there is at least one job and every one passed or was skipped."""
    return bool(needs) and not failing_jobs(needs)


def main(argv: Sequence[str]) -> int:
    if len(argv) != 1:
        print("usage: ci_verdict.py <needs-json>", file=sys.stderr)
        return 1
    try:
        needs = json.loads(argv[0])
    except json.JSONDecodeError as error:
        print(f"ci-ok: the needs context is not JSON: {error}", file=sys.stderr)
        return 1
    if not isinstance(needs, dict):
        print("ci-ok: the needs context is not an object", file=sys.stderr)
        return 1
    if not verdict(needs):
        failing = failing_jobs(needs) or ["(no job to judge)"]
        print(f"ci-ok: failed: {', '.join(failing)}", file=sys.stderr)
        return 1
    print(f"ci-ok: {len(needs)} jobs passed or were skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
