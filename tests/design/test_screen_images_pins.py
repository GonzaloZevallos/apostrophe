"""What the two screen-images workflows must keep (docs/product/screen-images.md, ADR-0079).

No job container, one runner, the pinned tool versions, the permissions that keep the write in one
job and the steps the capture needs in order. Each pin is a function over a parsed workflow that
returns the pins it finds broken; each has a test over the real file and one over a mutated copy it
must reject."""

import copy
import json
import re
import shlex
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
PYPROJECT = ROOT / "pyproject.toml"
WORKFLOWS = ROOT / ".github" / "workflows"
PR_FILE = WORKFLOWS / "screen-images-pr.yml"
MASTER_FILE = WORKFLOWS / "screen-images.yml"
PUBLISH_FILE = ROOT / "scripts" / "design" / "screen-images-publish.sh"
PATHS_IGNORE = ["docs/assets/screens/**"]
OUT = "${{ runner.temp }}/screen-images"
ARTIFACT_PATHS = [f"{OUT}/plan.json", f"{OUT}/summary.md", f"{OUT}/*.webp"]

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


CAPTURE_ORDER = [
    "actions/setup-node@v7",
    "astral-sh/setup-uv@",
    "Tools the capture needs",
    "actions/checkout@",
    "uv venv --python",
    "uv sync --locked",
    "scripts/design/screen-images.sh",
    "GITHUB_STEP_SUMMARY",
    "actions/upload-artifact@v4",
]


def capture_in_order(workflow: Workflow) -> bool:
    labels = [
        " ".join([str(s.get("name", "")), str(s.get("uses") or s.get("run", ""))]).replace(
            "\n", " "
        )
        for s in steps(jobs(workflow)["capture"])
    ]
    return is_subsequence(CAPTURE_ORDER, labels)


def pin_pr_order(pr: Workflow) -> list[str]:
    return [] if capture_in_order(pr) else ["the PR job steps are not in order"]


def pin_master_order(master: Workflow) -> list[str]:
    return [] if capture_in_order(master) else ["the master capture job steps are not in order"]


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
                line.strip() for line in str(options.get("path", "")).split("\n") if line.strip()
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


# --- the Python pin: every workflow installs it before it uses Python ---------------------------

# Jobs that use `uv run --no-project python` with no install; they run on whatever interpreter the
# runner has. The set can only shrink: a test asserts each entry still breaks.
KNOWN_GAPS = {("ci.yml", "changes"), ("ci.yml", "ci-ok")}

ASSIGNMENT = re.compile(r"[A-Za-z_][A-Za-z0-9_]*=")
SHELL_KEYWORDS = {"then", "else", "do", "if", "elif", "while", "until", "!", "{", "(", "time"}
DIRECT_USES = re.compile(r"(python[0-9.]*|pip[0-9.]*|pytest|mypy|ruff|uvx)")
UV_USES = {"run", "sync", "pip"}
MAJOR_MINOR = re.compile(r"[0-9]+\.[0-9]+")


def python_pin(pyproject: dict[str, Any]) -> str:
    """The one pin: `[tool.mypy] python_version`."""
    value = pyproject.get("tool", {}).get("mypy", {}).get("python_version")
    assert isinstance(value, str) and MAJOR_MINOR.fullmatch(value), (
        f"[tool.mypy] python_version is {value!r}, not a major.minor string"
    )
    return value


def pin_requires_python(pyproject: dict[str, Any], pin: str) -> list[str]:
    found = pyproject.get("project", {}).get("requires-python")
    return [] if found == ">=" + pin else [f"requires-python is {found!r}, not '>={pin}'"]


def split_commands(run: str) -> list[list[str]]:
    """The commands of a `run`, each as words. Raises ValueError when it cannot be split."""
    text = run.replace("\\\n", " ")
    segments: list[str] = []
    current: list[str] = []
    quote = ""
    i = 0
    while i < len(text):
        ch = text[i]
        if quote:
            current.append(ch)
            if ch == "\\" and quote == '"' and i + 1 < len(text):
                current.append(text[i + 1])
                i += 1
            elif ch == quote:
                quote = ""
        elif ch == "\\" and i + 1 < len(text):
            current.append(text[i : i + 2])
            i += 1
        elif ch in "'\"":
            quote = ch
            current.append(ch)
        elif ch == "#" and (not current or current[-1].isspace()):
            while i + 1 < len(text) and text[i + 1] != "\n":
                i += 1
        elif ch in "|;\n" or text.startswith("&&", i):
            segments.append("".join(current))
            current = []
            if ch == "&":
                i += 1
        else:
            current.append(ch)
        i += 1
    if quote:
        raise ValueError("unbalanced quote")
    segments.append("".join(current))
    return [words for words in (shlex.split(seg) for seg in segments) if words]


def command_words(words: list[str]) -> list[str]:
    """The words from the command word on: assignments and leading shell keywords dropped."""
    rest = list(words)
    while rest and (ASSIGNMENT.match(rest[0]) or rest[0] in SHELL_KEYWORDS):
        rest.pop(0)
    return rest


def python_options(words: list[str]) -> list[str]:
    """The values of `--python X`, `--python=X` and `-p X`."""
    found = []
    for index, word in enumerate(words):
        if word.startswith("--python="):
            found.append(word.removeprefix("--python="))
        elif word in ("--python", "-p") and index + 1 < len(words):
            found.append(words[index + 1])
    return found


@dataclass(frozen=True)
class Event:
    step: int  # 1-based; 0 is the job's own env
    kind: str  # "use", "install" or "version" (a version position that is not an install)
    version: str | None
    text: str


def events_of_command(step: int, words: list[str]) -> list[Event]:
    text = " ".join(words)
    if not words:
        return []
    name = Path(words[0]).name
    if name == "uv":
        args = [w for w in words[1:] if not w.startswith("-")]
        sub = args[0] if args else ""
        if sub == "venv":
            return [Event(step, "install", v, text) for v in python_options(words)]
        if sub == "python" and len(args) > 1 and args[1] == "install":
            return [Event(step, "install", v, text) for v in args[2:]]
        if sub == "python" and len(args) > 1 and args[1] == "find":
            return [Event(step, "use", None, text)] + [
                Event(step, "version", v, text) for v in args[2:]
            ]
        if sub in UV_USES:
            return [Event(step, "use", None, text)] + [
                Event(step, "version", v, text) for v in python_options(words)
            ]
        return []
    return [Event(step, "use", None, text)] if DIRECT_USES.fullmatch(name) else []


def env_versions(env: Any, step: int) -> list[Event]:
    if isinstance(env, dict) and "UV_PYTHON" in env:
        return [Event(step, "version", str(env["UV_PYTHON"]), "UV_PYTHON")]
    return []


def scan_job(job: dict[str, Any]) -> tuple[list[Event], list[tuple[int, str]]]:
    """Everything a job does with Python, in order, and the steps that cannot be read."""
    events = env_versions(job.get("env"), 0)
    unreadable: list[tuple[int, str]] = []
    for number, step in enumerate(steps(job), start=1):
        events += env_versions(step.get("env"), number)
        if str(step.get("uses", "")).startswith("actions/setup-python@"):
            version = step.get("with", {}).get("python-version")
            if version is not None:
                events.append(Event(number, "install", str(version), "actions/setup-python"))
        if "run" in step:
            try:
                for words in split_commands(str(step["run"])):
                    events += events_of_command(number, command_words(words))
            except ValueError as error:
                unreadable.append((number, str(error)))
    return events, unreadable


def where(label: str, job: str, step: int) -> str:
    return f"{label}/{job}" + (f"/step {step}" if step else "")


def pin_versions(workflow: Workflow, label: str, pin: str) -> list[str]:
    """Every version position equals the pin; one that is an expression cannot be proven."""
    broken = [
        f"{label}: workflow env UV_PYTHON {e.version} is not {pin}"
        for e in env_versions(workflow.get("env"), 0)
        if e.version != pin
    ]
    for name, job in jobs(workflow).items():
        events, unreadable = scan_job(job)
        broken += [f"{where(label, name, n)}: {why}, cannot be proven" for n, why in unreadable]
        for e in events:
            if e.version is None:
                continue
            if "${{" in e.version:
                broken.append(f"{where(label, name, e.step)}: {e.version!r} cannot be proven")
            elif e.version != pin:
                broken.append(
                    f"{where(label, name, e.step)}: {e.text!r} has {e.version}, not {pin}"
                )
    return broken


def pin_python_installed(workflow: Workflow, label: str, pin: str) -> list[str]:
    """In each job, every use of Python comes after an install of exactly the pin."""
    broken = []
    for name, job in jobs(workflow).items():
        events, unreadable = scan_job(job)
        broken += [f"{where(label, name, n)}: {why}, cannot be proven" for n, why in unreadable]
        installed = False
        for e in events:
            if e.kind == "install" and e.version == pin:
                installed = True
            elif e.kind == "use" and not installed:
                broken.append(f"{where(label, name, e.step)}: {e.text!r} uses Python before {pin}")
    return broken


def workflow_files() -> list[Path]:
    found = sorted([*WORKFLOWS.glob("*.yml"), *WORKFLOWS.glob("*.yaml")])
    assert found
    return found


def pyproject_data() -> dict[str, Any]:
    return tomllib.loads(PYPROJECT.read_text())


def expected_breaks(workflow: Workflow, label: str, pin: str) -> list[str]:
    """What the install pin finds, less the jobs `KNOWN_GAPS` states."""
    gaps = {job for file, job in KNOWN_GAPS if file == label}
    return [b for b in pin_python_installed(workflow, label, pin) if b.split("/")[1] not in gaps]


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
    assert pin_master_order(master) == []
    assert pin_uploads(pr, "pr") + pin_uploads(master, "master") == []
    assert pin_concurrency(master) == []
    assert pin_push_job(master) == []
    assert pin_publish_text(PUBLISH_FILE.read_text()) == []
    assert pin_apply_only(master) == []


def test_push_job_runs_on_a_plain_runner_and_is_the_only_writer() -> None:
    master, _ = real()
    assert jobs(master)["push"]["runs-on"] == "ubuntu-24.04"
    assert jobs(master)["push"]["permissions"] == {"contents": "write"}


def test_every_workflow_installs_the_pinned_python_before_it_uses_python() -> None:
    pyproject = pyproject_data()
    pin = python_pin(pyproject)
    assert pin_requires_python(pyproject, pin) == []
    names = [path.name for path in workflow_files()]
    assert {"ci.yml", "backup.yml", "screen-images.yml", "screen-images-pr.yml"} <= set(names)
    for path in workflow_files():
        workflow = load(path)
        assert pin_versions(workflow, path.name, pin) == []
        assert expected_breaks(workflow, path.name, pin) == []


def test_the_known_gaps_still_break_and_the_screen_images_and_backup_have_none() -> None:
    pin = python_pin(pyproject_data())
    for file, job in KNOWN_GAPS:
        broken = pin_python_installed(load(WORKFLOWS / file), file, pin)
        assert any(b.startswith(f"{file}/{job}/") for b in broken), (file, job)
    for file in ("backup.yml", "screen-images.yml", "screen-images-pr.yml"):
        assert pin_python_installed(load(WORKFLOWS / file), file, pin) == []
    assert {file for file, _ in KNOWN_GAPS} == {"ci.yml"}


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
        f"master/capture uploads {[*ARTIFACT_PATHS, f'{OUT}/index.json']}",
    ]


@pytest.mark.parametrize("bad", ["**/*.webp", "capture-1/*.webp"])
def test_an_upload_that_reaches_into_the_capture_folders_is_rejected(bad: str) -> None:
    master, _ = real()
    wrong = f"{OUT}/{bad}"
    for step in steps(jobs(master)["capture"]):
        if str(step.get("uses", "")).startswith("actions/upload-artifact"):
            step["with"]["path"] = "\n".join([ARTIFACT_PATHS[0], ARTIFACT_PATHS[1], wrong])
    assert pin_uploads(master, "master") == [
        f"master/capture uploads {[ARTIFACT_PATHS[0], ARTIFACT_PATHS[1], wrong]}"
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


# --- the Python pin rejects a broken copy ---


def wrong_version(pin: str) -> str:
    major, minor = pin.split(".")
    return f"{major}.{int(minor) + 1}"


def pin_of_the_project() -> str:
    return python_pin(pyproject_data())


def one_job(
    *step_list: dict[str, Any],
    workflow_env: dict[str, str] | None = None,
    job_env: dict[str, str] | None = None,
) -> Workflow:
    job: dict[str, Any] = {"runs-on": "ubuntu-24.04", "steps": list(step_list)}
    if job_env:
        job["env"] = job_env
    workflow: Workflow = {"jobs": {"j": job}}
    if workflow_env:
        workflow["env"] = workflow_env
    return workflow


def run(text: str) -> dict[str, Any]:
    return {"run": text}


def test_the_pin_is_read_from_mypy_and_must_be_major_minor() -> None:
    assert python_pin({"tool": {"mypy": {"python_version": "9.9"}}}) == "9.9"
    with pytest.raises(AssertionError, match=r"\[tool.mypy\] python_version"):
        python_pin({"tool": {}})
    with pytest.raises(AssertionError, match=r"\[tool.mypy\] python_version"):
        python_pin({"tool": {"mypy": {"python_version": "3"}}})


def test_a_changed_requires_python_is_rejected() -> None:
    pyproject = copy.deepcopy(pyproject_data())
    pin = python_pin(pyproject)
    pyproject["project"]["requires-python"] = ">=" + wrong_version(pin)
    assert pin_requires_python(pyproject, pin) == [
        f"requires-python is '>={wrong_version(pin)}', not '>={pin}'"
    ]


VERSION_FORMS = [
    "uv venv --python {v}",
    "uv venv --python={v}",
    "uv venv -p {v}",
    "uv python install {v}",
    "uv python find {v}",
    "uv run --python {v} pytest",
    "uv sync -p {v}",
]


@pytest.mark.parametrize("form", VERSION_FORMS)
def test_a_version_that_is_not_the_pin_is_rejected_in_every_form(form: str) -> None:
    pin = pin_of_the_project()
    bad = one_job(run(form.format(v=wrong_version(pin))))
    broken = pin_versions(bad, "w.yml", pin)
    assert len(broken) == 1
    assert broken[0].startswith("w.yml/j/step 1: ")
    assert f"has {wrong_version(pin)}, not {pin}" in broken[0]
    assert pin_versions(one_job(run(form.format(v=pin))), "w.yml", pin) == []


def test_setup_python_with_another_version_is_rejected() -> None:
    pin = pin_of_the_project()
    step = {"uses": "actions/setup-python@v5", "with": {"python-version": wrong_version(pin)}}
    assert len(pin_versions(one_job(step), "w.yml", pin)) == 1
    good = {"uses": "actions/setup-python@v5", "with": {"python-version": pin}}
    assert pin_versions(one_job(good, run("pytest")), "w.yml", pin) == []
    assert pin_python_installed(one_job(good, run("pytest")), "w.yml", pin) == []
    assert len(pin_python_installed(one_job(step, run("pytest")), "w.yml", pin)) == 1


def test_uv_python_at_any_level_with_another_version_is_rejected() -> None:
    pin = pin_of_the_project()
    env = {"UV_PYTHON": wrong_version(pin)}
    at_workflow = one_job(run("echo x"), workflow_env=env)
    at_job = one_job(run("echo x"), job_env=env)
    at_step = one_job({"env": env, "run": "echo x"})
    assert pin_versions(at_workflow, "w.yml", pin) == [
        f"w.yml: workflow env UV_PYTHON {wrong_version(pin)} is not {pin}"
    ]
    assert len(pin_versions(at_job, "w.yml", pin)) == 1
    assert pin_versions(at_job, "w.yml", pin)[0].startswith("w.yml/j: ")
    assert pin_versions(at_step, "w.yml", pin)[0].startswith("w.yml/j/step 1: ")
    good = one_job(run("echo x"), workflow_env={"UV_PYTHON": pin})
    assert pin_versions(good, "w.yml", pin) == []


def test_uv_python_is_never_an_install() -> None:
    pin = pin_of_the_project()
    job = one_job(run("uv run python x"), job_env={"UV_PYTHON": pin})
    assert len(pin_python_installed(job, "w.yml", pin)) == 1


def test_a_version_that_is_an_expression_cannot_be_proven() -> None:
    pin = pin_of_the_project()
    step = {"uses": "actions/setup-python@v5", "with": {"python-version": "${{ matrix.py }}"}}
    assert pin_versions(one_job(step), "w.yml", pin) == [
        "w.yml/j/step 1: '${{ matrix.py }}' cannot be proven"
    ]
    venv = one_job(run("uv venv --python ${{ matrix.py }}"))
    assert pin_versions(venv, "w.yml", pin) == ["w.yml/j/step 1: '${{' cannot be proven"]
    assert len(pin_python_installed(one_job(step, run("pytest")), "w.yml", pin)) == 1


def test_uv_python_find_put_back_before_the_install_is_rejected() -> None:
    pin = pin_of_the_project()
    for file in (MASTER_FILE, PR_FILE):
        workflow = load(file)
        tools = steps(jobs(workflow)["capture"])[2]
        tools["run"] += f"\nuv python find {pin}"
        assert pin_versions(workflow, file.name, pin) == []
        broken = pin_python_installed(workflow, file.name, pin)
        assert len(broken) == 1
        assert broken[0].startswith(f"{file.name}/capture/step 3: 'uv python find {pin}'")


def test_a_new_job_that_uses_python_without_an_install_is_rejected() -> None:
    pin = pin_of_the_project()
    workflow = load(PR_FILE)
    workflow["jobs"]["extra"] = {"runs-on": "ubuntu-24.04", "steps": [run("uv run python x")]}
    broken = pin_python_installed(workflow, "w.yml", pin)
    assert broken == [f"w.yml/extra/step 1: 'uv run python x' uses Python before {pin}"]


def test_the_order_inside_one_run_decides() -> None:
    pin = pin_of_the_project()
    after = one_job(run(f"uv venv --python {pin} && uv run python x"))
    assert pin_python_installed(after, "w.yml", pin) == []
    before = one_job(run(f"uv run python x && uv venv --python {pin}"))
    assert len(pin_python_installed(before, "w.yml", pin)) == 1
    on_lines = one_job(run(f"uv run python x\nuv venv --python {pin}"))
    assert len(pin_python_installed(on_lines, "w.yml", pin)) == 1


def test_a_use_behind_a_pipe_or_an_assignment_is_seen() -> None:
    pin = pin_of_the_project()
    piped = one_job(run("printf x | uv run --no-project python s.py"))
    assert len(pin_python_installed(piped, "w.yml", pin)) == 1
    assigned = one_job(run("FOO=1 BAR='a b' pytest -q"))
    assert len(pin_python_installed(assigned, "w.yml", pin)) == 1
    nested = one_job(run("if true; then python x; fi"))
    assert len(pin_python_installed(nested, "w.yml", pin)) == 1


def test_words_that_only_mention_python_are_not_uses() -> None:
    pin = pin_of_the_project()
    for text in (
        'echo "python missing"',
        "git log --grep python",
        "printf 'uv run python x'",
        "# python x",
        "echo done # python x",
        "npm --prefix web ci",
    ):
        assert pin_python_installed(one_job(run(text)), "w.yml", pin) == [], text
    quoted = one_job(run('echo "a | uv run python; b"'))
    assert pin_python_installed(quoted, "w.yml", pin) == []


def test_a_run_that_cannot_be_split_is_rejected() -> None:
    pin = pin_of_the_project()
    bad = one_job(run('echo "unbalanced'))
    expected = ["w.yml/j/step 1: unbalanced quote, cannot be proven"]
    assert pin_python_installed(bad, "w.yml", pin) == expected
    assert pin_versions(bad, "w.yml", pin) == expected


def test_a_pin_bump_breaks_every_version_position_in_the_real_workflows() -> None:
    pyproject = copy.deepcopy(pyproject_data())
    pin = python_pin(pyproject)
    bumped = wrong_version(pin)
    pyproject["tool"]["mypy"]["python_version"] = bumped
    new_pin = python_pin(pyproject)
    positions = 0
    for path in workflow_files():
        workflow = load(path)
        assert pin_versions(workflow, path.name, pin) == []
        broken = pin_versions(workflow, path.name, new_pin)
        positions += len(broken)
        assert all(f"not {bumped}" in b for b in broken)
    venv_lines = sum(
        len(re.findall(r"uv venv --python \S+", path.read_text())) for path in workflow_files()
    )
    assert positions >= venv_lines > 0


def test_master_capture_steps_out_of_order_are_rejected() -> None:
    master, _ = real()
    capture = jobs(master)["capture"]
    capture["steps"] = list(reversed(steps(capture)))
    assert pin_master_order(master) == ["the master capture job steps are not in order"]
