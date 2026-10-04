"""`scripts/serve.sh` is the only place uvicorn is ever started (the plan's invariant),
with `--no-access-log` and `--no-proxy-headers`; `render.yaml` points at it instead of
starting a server of its own; no deploy file runs a second migration command — the
schema is migrated only by `upgrade_to_head` in `app.main`'s `lifespan`.
"""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SERVE_SCRIPT = REPO_ROOT / "scripts" / "serve.sh"
RENDER_YAML = REPO_ROOT / "render.yaml"
BACKUP_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "backup.yml"
DEPLOY_FILES = (SERVE_SCRIPT, RENDER_YAML, BACKUP_WORKFLOW)


def find_stray_uvicorn_or_migration(name: str, text: str) -> list[str]:
    """Names each line, other than in `scripts/serve.sh` itself, that starts uvicorn
    directly or runs a migration command of its own."""
    violations = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        if name != "serve.sh" and "uvicorn" in stripped:
            violations.append(f"{name}:{lineno}: starts uvicorn directly")
        if "alembic upgrade" in stripped or "command.upgrade" in stripped:
            violations.append(f"{name}:{lineno}: runs a second migration command")
    return violations


def test_the_checker_flags_a_deploy_file_that_starts_uvicorn_directly() -> None:
    # Proven negative: the checker must be seen to fail before it is trusted to pass.
    bad = "steps:\n  - run: uvicorn app.main:create_app --factory\n"

    assert find_stray_uvicorn_or_migration("bad.yml", bad) != []


def test_the_checker_flags_a_second_migration_command() -> None:
    bad = "steps:\n  - run: alembic upgrade head\n"

    assert find_stray_uvicorn_or_migration("bad.yml", bad) != []


def test_the_checker_passes_a_file_with_neither() -> None:
    fine = "steps:\n  - run: scripts/serve.sh\n"

    assert find_stray_uvicorn_or_migration("fine.yml", fine) == []


def test_no_deploy_file_starts_uvicorn_directly_or_runs_a_migration_of_its_own() -> None:
    violations = []
    for path in DEPLOY_FILES:
        violations.extend(find_stray_uvicorn_or_migration(path.name, path.read_text()))

    assert violations == []


def test_serve_sh_binds_every_interface_with_no_access_log_and_no_proxy_headers() -> None:
    text = SERVE_SCRIPT.read_text()

    assert "--host 0.0.0.0" in text
    assert "--no-access-log" in text
    assert "--no-proxy-headers" in text
    assert '--port "${PORT:-${APOSTROPHE_PORT:-8000}}"' in text


def test_render_yaml_starts_the_app_through_serve_sh_with_a_health_check() -> None:
    text = RENDER_YAML.read_text()

    assert "startCommand: scripts/serve.sh" in text
    assert "healthCheckPath: /health" in text
    assert "autoDeploy: true" in text
    assert "preDeployCommand" not in text
    env_var_count = text.count("- key:")
    sync_false_count = text.count("        sync: false")
    assert env_var_count > 0, "no secret is inlined; every value is filled in by hand"
    assert sync_false_count == env_var_count
