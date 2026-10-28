"""The `ci-ok` verdict (scripts/ci_verdict.py): `success` and `skipped` pass, `failure` and
`cancelled` fail, and so does anything it does not know, or nothing to judge."""

from __future__ import annotations

import json

import pytest

from scripts.ci_verdict import failing_jobs, main, verdict


def _needs(**results: str) -> dict[str, dict[str, object]]:
    return {job: {"result": result, "outputs": {}} for job, result in results.items()}


def test_success_and_skipped_pass() -> None:
    needs = _needs(test="success", e2e="skipped", pytest="success")
    assert failing_jobs(needs) == []
    assert verdict(needs) is True


@pytest.mark.parametrize("result", ["failure", "cancelled"])
def test_a_failed_or_cancelled_job_fails_the_verdict(result: str) -> None:
    needs = _needs(test="success", e2e=result, web="skipped")
    assert failing_jobs(needs) == ["e2e"]
    assert verdict(needs) is False


def test_a_result_it_does_not_know_fails() -> None:
    assert failing_jobs(_needs(test="success", web="timed_out")) == ["web"]
    assert failing_jobs({"web": {"outputs": {}}}) == ["web"]
    assert failing_jobs({"web": "success"}) == ["web"]


def test_no_job_to_judge_fails() -> None:
    assert verdict({}) is False


def test_main_reads_the_needs_json_and_exits_by_the_verdict(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert main([json.dumps(_needs(test="success", e2e="skipped"))]) == 0
    assert main([json.dumps(_needs(test="success", e2e="cancelled"))]) == 1
    assert "e2e" in capsys.readouterr().err
    assert main(["not json"]) == 1
    assert main(["[]"]) == 1
    assert main([]) == 1
