"""What the two screen-images workflows must keep (docs/product/screen-images.md, ADR-0079).

No job container, one runner, the pinned tool versions, the permissions that keep the write in one
job and the steps the capture needs in order. Each pin is a function over a parsed workflow that
returns the pins it finds broken; each has a test over the real file and one over a mutated copy it
must reject."""

import copy
import json
import re
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
PR_FILE = WORKFLOWS / "screen-images-pr.yml"
MASTER_FILE = WORKFLOWS / "screen-images.yml"
PUBLISH_FILE = ROOT / "scripts" / "design" / "screen-images-publish.sh"
PATHS_IGNORE = ["docs/assets/screens/**"]
ARTIFACT_PATHS = ["plan.json", "summary.md", "*.webp"]

Workflow = dict[Any, Any]


def load(path: Path) -> Workflow:
    data = yaml.safe_load(path.read_text())
    assert isinstance(data, dict)
    return data


def triggers(workflow: Workflow) -> dict[str, Any]:
    # PyYAML reads the key `on` as the boolean True.
    on = workflow.get(True, workflow.get("on"))
    assert isinstance(on, dict)
    return {str(key): value for key, value in on.items()}


def jobs(workflow: Workflow) -> dict[str, dict[str, Any]]:
    raw = workflow["jobs"]
    assert isinstance(raw, dict)
    return {str(name): job for name, job in raw.items() if isinstance(job, dict)}


def steps(job: dict[str, Any]) -> list[dict[str, Any]]:
    raw = job["steps"]
    assert isinstance(raw, list)
    return [step for step in raw if isinstance(step, dict)]


def uses_of(job: dict[str, Any], action: str) -> list[dict[str, Any]]:
    return [s for s in steps(job) if str(s.get("uses", "")).startswith(action + "@")]


def capture_jobs(master: Workflow, pr: Workflow) -> list[tuple[str, dict[str, Any]]]:
    return [("pr/capture", jobs(pr)["capture"]), ("master/capture", jobs(master)["capture"])]


def runs(workflow: Workflow) -> list[str]:
    return [str(s["run"]) for job in jobs(workflow).values() for s in steps(job) if "run" in s]


def ci_uv_pin() -> str:
    found = set(re.findall(r"astral-sh/setup-uv@\S+", (WORKFLOWS / "ci.yml").read_text()))
    assert len(found) == 1, found
    return str(found.pop())


# --- pins ---------------------------------------------------------------------------------------


def pin_no_container(workflow: Workflow, label: str) -> list[str]:
    return [
        f"{label}/{name} declares container:"
        for name, job in jobs(workflow).items()
        if "container" in job
    ]


def pin_runner(capture: list[tuple[str, dict[str, Any]]]) -> list[str]:
    return [
        f"{n} runs on {j.get('runs-on')!r}"
        for n, j in capture
        if j.get("runs-on") != "ubuntu-24.04"
    ]


def pin_node(capture: list[tuple[str, dict[str, Any]]]) -> list[str]:
    broken = []
    for name, job in capture:
        found = [s for s in steps(job) if s.get("uses") == "actions/setup-node@v7"]
        if not any(str(s.get("with", {}).get("node-version")) == "24" for s in found):
            broken.append(f"{name} lacks setup-node@v7 with node 24")
    return broken


def pin_uv(capture: list[tuple[str, dict[str, Any]]], expected: str) -> list[str]:
    broken = []
    for name, job in capture:
        found = [s.get("uses") for s in uses_of(job, "astral-sh/setup-uv")]
        if found != [expected]:
            broken.append(f"{name} uses {found}, ci.yml uses {expected}")
    return broken


def playwright_versions(lock: dict[str, Any]) -> tuple[str, str]:
    packages = lock["packages"]
    return (
        str(packages["node_modules/@playwright/test"]["version"]),
        str(packages["node_modules/playwright"]["version"]),
    )


def pin_playwright_lock(lock: dict[str, Any]) -> list[str]:
    test, library = playwright_versions(lock)
    return [] if test == library else [f"@playwright/test {test} != playwright {library}"]


def pin_paths_ignore(pr: Workflow, master: Workflow) -> list[str]:
    broken = []
    if triggers(pr)["pull_request"].get("paths-ignore") != PATHS_IGNORE:
        broken.append("pull_request paths-ignore differs")
    push = triggers(master)["push"]
    if push.get("paths-ignore") != PATHS_IGNORE:
        broken.append("push paths-ignore differs")
    if push.get("branches") != ["master"]:
        broken.append("push is not limited to master")
    return broken


def pin_permissions(master: Workflow, pr: Workflow) -> list[str]:
    broken = []
    for label, workflow in (("pr", pr), ("master", master)):
        if workflow.get("permissions") != {"contents": "read"}:
            broken.append(f"{label} workflow-level permissions are not contents: read")
        for name, job in jobs(workflow).items():
            writes = job.get("permissions", {}).get("contents") == "write"
            if writes != (label == "master" and name == "push"):
                broken.append(f"{label}/{name} contents: write is {writes}")
    return broken


def pin_checkout(capture: list[tuple[str, dict[str, Any]]]) -> list[str]:
    broken = []
    for name, job in capture:
        found = uses_of(job, "actions/checkout")
        if not found or any(
            s.get("with", {}).get("persist-credentials") is not False for s in found
        ):
            broken.append(f"{name} checkout keeps credentials")
    return broken


def pin_no_git_writes(workflow: Workflow, label: str) -> list[str]:
    return [
        f"{label} run: contains {w}"
        for r in runs(workflow)
        for w in ("git commit", "git push")
        if w in r
    ]


def pin_pr_raw_text(text: str) -> list[str]:
    return ["the PR workflow text contains git push"] if "git push" in text else []


def is_subsequence(wanted: list[str], found: list[str]) -> bool:
    it = iter(found)
    return all(any(w in f for f in it) for w in wanted)


def pin_pr_order(pr: Workflow) -> list[str]:
    labels = [
        str(s.get("uses") or s.get("run", "")).replace("\n", " ")
        for s in steps(jobs(pr)["capture"])
    ]
    wanted = [
        "actions/setup-node@v7",
        "astral-sh/setup-uv@",
        "uv python find 3.13",
        "actions/checkout@",
        "uv sync --locked",
        "scripts/design/screen-images.sh",
        "GITHUB_STEP_SUMMARY",
        "actions/upload-artifact@v4",
    ]
    return [] if is_subsequence(wanted, labels) else ["the PR job steps are not in order"]


def pin_uploads(workflow: Workflow, label: str) -> list[str]:
    broken = []
    for name, job in jobs(workflow).items():
        for step in steps(job):
            if not str(step.get("uses", "")).startswith("actions/upload-artifact"):
                continue
            where = f"{label}/{name}"
            if step["uses"] != "actions/upload-artifact@v4":
                broken.append(f"{where} upload is not @v4")
            if step.get("if") != "always()":
                broken.append(f"{where} upload is not if: always()")
            options = step.get("with", {})
            if options.get("retention-days") != 7:
                broken.append(f"{where} retention-days is not 7")
            paths = [
                line.strip().rsplit("/", 1)[-1]
                for line in str(options.get("path", "")).split("\n")
                if line.strip()
            ]
            if paths != ARTIFACT_PATHS:
                broken.append(f"{where} uploads {paths}")
    return broken


def pin_concurrency(master: Workflow) -> list[str]:
    ok = master.get("concurrency") == {"group": "screen-images", "cancel-in-progress": False}
    return [] if ok else ["master concurrency differs"]


GATE = "steps.gate.outputs.apply == 'true'"


def pin_push_job(master: Workflow) -> list[str]:
    push = jobs(master)["push"]
    broken = []
    if push.get("needs") != "capture":
        broken.append("push does not need capture")
    if push.get("if") != "always() && needs.capture.result != 'cancelled'":
        broken.append("push if: differs")
    for needle in ("screenImagesRun.mjs apply", "screen-images-publish.sh"):
        found = [s for s in steps(push) if needle in str(s.get("run", ""))]
        if len(found) != 1 or found[0].get("if") != GATE:
            broken.append(f"push step {needle} is not conditioned on the gate")
    return broken


def pin_publish_text(text: str) -> list[str]:
    return [] if "[skip ci]" in text else ["the publish script lacks [skip ci]"]


def pin_apply_only(master: Workflow) -> list[str]:
    """No step but the apply driver writes under docs/assets/screens."""
    broken = []
    for name, job in jobs(master).items():
        for run in (str(s["run"]) for s in steps(job) if "run" in s):
            if (
                "docs/assets/screens" in run
                and "screenImagesRun.mjs apply" not in run
                and "screen-images.sh" not in run
            ):
                broken.append(f"{name} touches docs/assets/screens: {run!r}")
    return broken


# --- tests over the real files ---


def real() -> tuple[Workflow, Workflow]:
    return load(MASTER_FILE), load(PR_FILE)


def test_real_workflows_keep_every_pin() -> None:
    master, pr = real()
    lock = json.loads((ROOT / "web" / "package-lock.json").read_text())
    capture = capture_jobs(master, pr)
    assert pin_no_container(pr, "pr") + pin_no_container(master, "master") == []
    assert pin_runner(capture) == []
    assert pin_node(capture) == []
    assert pin_uv(capture, ci_uv_pin()) == []
    assert pin_playwright_lock(lock) == []
    assert pin_paths_ignore(pr, master) == []
    assert pin_permissions(master, pr) == []
    assert pin_checkout(capture) == []
    assert pin_no_git_writes(pr, "pr") + pin_no_git_writes(master, "master") == []
    assert pin_pr_raw_text(PR_FILE.read_text()) == []
    assert pin_pr_order(pr) == []
    assert pin_uploads(pr, "pr") + pin_uploads(master, "master") == []
    assert pin_concurrency(master) == []
    assert pin_push_job(master) == []
    assert pin_publish_text(PUBLISH_FILE.read_text()) == []
    assert pin_apply_only(master) == []


def test_push_job_runs_on_a_plain_runner_and_is_the_only_writer() -> None:
    master, _ = real()
    assert jobs(master)["push"]["runs-on"] == "ubuntu-24.04"
    assert jobs(master)["push"]["permissions"] == {"contents": "write"}


# --- tests that each pin rejects a broken copy ---


def test_a_container_is_rejected() -> None:
    master, pr = real()
    bad = copy.deepcopy(pr)
    jobs(bad)["capture"]["container"] = "mcr.microsoft.com/playwright:v1.63.0-noble"
    assert pin_no_container(bad, "pr") == ["pr/capture declares container:"]
    assert pin_no_container(master, "master") == []


def test_another_runner_is_rejected() -> None:
    master, pr = real()
    jobs(pr)["capture"]["runs-on"] = "ubuntu-latest"
    assert pin_runner(capture_jobs(master, pr)) == ["pr/capture runs on 'ubuntu-latest'"]


def test_another_node_is_rejected() -> None:
    master, pr = real()
    for step in steps(jobs(master)["capture"]):
        if str(step.get("uses", "")).startswith("actions/setup-node"):
            step["with"]["node-version"] = "22"
    assert pin_node(capture_jobs(master, pr)) == ["master/capture lacks setup-node@v7 with node 24"]


def test_a_uv_that_differs_from_ci_is_rejected() -> None:
    master, pr = real()
    for step in steps(jobs(pr)["capture"]):
        if str(step.get("uses", "")).startswith("astral-sh/setup-uv"):
            step["uses"] = "astral-sh/setup-uv@v1.0.0"
    broken = pin_uv(capture_jobs(master, pr), ci_uv_pin())
    assert len(broken) == 1 and broken[0].startswith(
        "pr/capture uses ['astral-sh/setup-uv@v1.0.0']"
    )


def test_playwright_versions_that_differ_are_rejected() -> None:
    lock = json.loads((ROOT / "web" / "package-lock.json").read_text())
    lock["packages"]["node_modules/playwright"]["version"] = "0.0.1"
    broken = pin_playwright_lock(lock)
    assert len(broken) == 1 and broken[0].endswith("!= playwright 0.0.1")


def test_a_missing_paths_ignore_is_rejected() -> None:
    master, pr = real()
    del triggers(pr)["pull_request"]["paths-ignore"]
    del triggers(master)["push"]["branches"]
    assert pin_paths_ignore(pr, master) == [
        "pull_request paths-ignore differs",
        "push is not limited to master",
    ]


def test_a_second_writer_is_rejected() -> None:
    master, pr = real()
    jobs(master)["capture"]["permissions"] = {"contents": "write"}
    pr["jobs"]["capture"] = {"permissions": {"contents": "write"}, "steps": []}
    assert pin_permissions(master, pr) == [
        "pr/capture contents: write is True",
        "master/capture contents: write is True",
    ]


def test_a_push_job_without_write_is_rejected() -> None:
    master, pr = real()
    del jobs(master)["push"]["permissions"]
    assert pin_permissions(master, pr) == ["master/push contents: write is False"]


def test_a_checkout_that_keeps_credentials_is_rejected() -> None:
    master, pr = real()
    for step in steps(jobs(pr)["capture"]):
        if str(step.get("uses", "")).startswith("actions/checkout"):
            del step["with"]["persist-credentials"]
    assert pin_checkout(capture_jobs(master, pr)) == ["pr/capture checkout keeps credentials"]


def test_git_commit_and_push_in_a_run_are_rejected() -> None:
    _, pr = real()
    steps(jobs(pr)["capture"])[0]["run"] = "git commit -m x && git push"
    assert pin_no_git_writes(pr, "pr") == [
        "pr run: contains git commit",
        "pr run: contains git push",
    ]
    assert pin_pr_raw_text("# git push later") == ["the PR workflow text contains git push"]


def test_steps_out_of_order_are_rejected() -> None:
    _, pr = real()
    capture = jobs(pr)["capture"]
    capture["steps"] = list(reversed(steps(capture)))
    assert pin_pr_order(pr) == ["the PR job steps are not in order"]


def test_an_upload_that_differs_is_rejected() -> None:
    master, _ = real()
    for step in steps(jobs(master)["capture"]):
        if str(step.get("uses", "")).startswith("actions/upload-artifact"):
            step["uses"] = "actions/upload-artifact@v3"
            del step["if"]
            step["with"]["retention-days"] = 30
            step["with"]["path"] += "\n${{ runner.temp }}/screen-images/index.json"
    assert pin_uploads(master, "master") == [
        "master/capture upload is not @v4",
        "master/capture upload is not if: always()",
        "master/capture retention-days is not 7",
        "master/capture uploads ['plan.json', 'summary.md', '*.webp', 'index.json']",
    ]


def test_a_cancelling_concurrency_is_rejected() -> None:
    master, _ = real()
    master["concurrency"]["cancel-in-progress"] = True
    assert pin_concurrency(master) == ["master concurrency differs"]


def test_a_push_job_without_its_gate_is_rejected() -> None:
    master, _ = real()
    push = jobs(master)["push"]
    push["needs"] = "other"
    push["if"] = "always()"
    for step in steps(push):
        if "screen-images-publish.sh" in str(step.get("run", "")):
            del step["if"]
    assert pin_push_job(master) == [
        "push does not need capture",
        "push if: differs",
        "push step screen-images-publish.sh is not conditioned on the gate",
    ]


def test_a_publish_script_without_skip_ci_is_rejected() -> None:
    assert pin_publish_text("git commit -m 'update images'") == [
        "the publish script lacks [skip ci]"
    ]


def test_a_write_to_the_images_outside_apply_is_rejected() -> None:
    master, _ = real()
    steps(jobs(master)["push"])[0]["run"] = "cp new.webp docs/assets/screens/"
    assert len(pin_apply_only(master)) == 1
