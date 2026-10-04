"""`reconcile` compares what a run exported against what it deleted (the plan's
invariant: nothing is deleted that the file does not hold)."""

from __future__ import annotations

from app.business_removal.domain.reconciliation import reconcile


def test_matching_id_sets_reconcile_clean() -> None:
    exported = {"customer": frozenset({1, 2}), "sale": frozenset({10})}
    deleted = {"customer": frozenset({1, 2}), "sale": frozenset({10})}

    assert reconcile(exported, deleted) == []


def test_a_differing_id_set_is_reported_by_its_kind() -> None:
    exported = {"customer": frozenset({1, 2}), "sale": frozenset({10})}
    deleted = {"customer": frozenset({1}), "sale": frozenset({10})}

    assert reconcile(exported, deleted) == ["customer"]


def test_a_kind_present_on_only_one_side_is_reported() -> None:
    exported = {"customer": frozenset({1})}
    deleted = {"customer": frozenset({1}), "sale": frozenset({10})}

    assert reconcile(exported, deleted) == ["sale"]
