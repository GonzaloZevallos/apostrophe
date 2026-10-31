"""The wiring of `create_app`'s clock (docs/adr/0001, amendment GH-201): an app runs on
the clock it is handed, and an app built with none runs on `system_clock`.

The second half is read off `create_app`'s signature instead of building an app with no
`clock=`: the guard in `tests/architecture/test_clock_injection.py` refuses any
`create_app` call under `tests/` that leaves its clock out, and this is the one place a
test would otherwise have to.
"""

import inspect

from fastapi import FastAPI

from app import clock as app_clock
from app.accounts.adapters import deps
from app.main import create_app
from tests.conftest import MovableClock


def test_an_app_runs_on_the_clock_it_is_handed(app: FastAPI, clock: MovableClock) -> None:
    assert app.state.clock is clock


def test_an_app_built_without_a_clock_runs_on_the_system_clock() -> None:
    default = inspect.signature(create_app).parameters["clock"].default

    assert (default.__module__, default.__name__) == ("app.clock", "system_clock")


def test_a_request_learns_its_day_from_the_accounts_dependency_not_from_the_clock_module() -> None:
    assert not hasattr(app_clock, "get_today")
    assert deps.get_today.__module__ == "app.accounts.adapters.deps"
