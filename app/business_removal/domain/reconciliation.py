"""Compares what a run exported against what it deleted (the plan's invariant:
nothing is deleted that the export file does not hold).
"""

from __future__ import annotations

from collections.abc import Mapping


def reconcile(
    exported: Mapping[str, frozenset[int]], deleted: Mapping[str, frozenset[int]]
) -> list[str]:
    """The kinds whose id set in `exported` differs from the one in `deleted`, or
    that are present on only one side, sorted. An empty result means every exported
    id was deleted and nothing else was."""
    names = set(exported) | set(deleted)
    return sorted(name for name in names if exported.get(name) != deleted.get(name))
