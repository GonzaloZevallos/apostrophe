"""One clock per test app (docs/adr/0001, amendment GH-201).

The suite once went red because invitations were issued at a fixed instant and checked
by an app reading the system date. Moving the fixed instant only restarts the countdown
to the next expiry window, so the rule is the other way round, and this module enforces
it with `ast` (never a text search), per call site and not per file:

1. Every `create_app(...)` call under `tests/` (aliased imports included) has a
   `clock=` keyword whose value is not the literal `None`, and no `**` unpacking, so
   the clock an app runs on is always written out where the app is built. A wrapper of
   `create_app` — a function whose own parameter feeds `clock=` — is accepted only when
   it is listed in `ACCEPTED_WRAPPERS` and that parameter has no default, so a caller
   cannot leave it out. A test function's own `clock` parameter is the conftest fixture,
   which pytest always supplies, so it needs no listing (a default still fails). The accepted
   wrappers are conftest's `app` fixture, the `served_app` fixture of
   `tests/test_serving.py`, the `app` fixture of `tests/test_libsql_driver.py` and
   of `tests/business_removal/adapters/test_sql_schema_rows.py`, and `build_app` of
   `tests/business_removal/adapters/seed.py`; a new one is added deliberately.

Where the system date may be read at all is `tests/architecture/test_no_real_clock.py`'s
rule (ADR-0043), which scans `tests/` and `app/` and is stricter than a read list kept
here; this module does not repeat it.

A violating module under `tests/architecture/fixtures/` shows the rule failing.
"""

import ast
from pathlib import Path

from tests.architecture.hexagon import REPO_ROOT

FIXTURES = Path(__file__).resolve().parent / "fixtures"
MODULE_LEVEL = "<module>"

ACCEPTED_WRAPPERS = frozenset(
    {
        ("tests/conftest.py", "app"),
        ("tests/test_serving.py", "served_app"),
        ("tests/test_libsql_driver.py", "app"),
        ("tests/business_removal/adapters/test_sql_schema_rows.py", "app"),
        ("tests/business_removal/adapters/seed.py", "build_app"),
    }
)


def _relative(module: Path) -> str:
    try:
        return module.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return module.as_posix()


class _Walker(ast.NodeVisitor):
    """Walks one module keeping the stack of enclosing functions, and the names that
    `create_app` is bound to by its imports."""

    def __init__(self, tree: ast.Module) -> None:
        self.functions: list[ast.FunctionDef | ast.AsyncFunctionDef] = []
        self.create_apps: set[str] = {"create_app"}
        self.create_app_calls: list[tuple[ast.Call, str, ast.arguments | None]] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    bound = alias.asname or alias.name
                    if alias.name == "create_app":
                        self.create_apps.add(bound)
        self.visit(tree)

    @property
    def enclosing(self) -> str:
        return self.functions[-1].name if self.functions else MODULE_LEVEL

    def _visit_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        self.functions.append(node)
        self.generic_visit(node)
        self.functions.pop()

    visit_FunctionDef = _visit_function
    visit_AsyncFunctionDef = _visit_function

    def visit_Call(self, node: ast.Call) -> None:
        func = node.func
        if (isinstance(func, ast.Name) and func.id in self.create_apps) or (
            isinstance(func, ast.Attribute) and func.attr == "create_app"
        ):
            arguments = self.functions[-1].args if self.functions else None
            self.create_app_calls.append((node, self.enclosing, arguments))
        self.generic_visit(node)


def _walk(module: Path) -> _Walker:
    return _Walker(ast.parse(module.read_text(), filename=str(module)))


def _is_none(value: ast.expr) -> bool:
    return isinstance(value, ast.Constant) and value.value is None


def _parameter_has_default(arguments: ast.arguments, name: str) -> bool:
    positional = [*arguments.posonlyargs, *arguments.args]
    defaulted = positional[len(positional) - len(arguments.defaults) :]
    keyword_defaulted = [
        arg
        for arg, default in zip(arguments.kwonlyargs, arguments.kw_defaults, strict=True)
        if default is not None
    ]
    return any(arg.arg == name for arg in [*defaulted, *keyword_defaulted])


def _parameter_names(arguments: ast.arguments) -> set[str]:
    return {arg.arg for arg in [*arguments.posonlyargs, *arguments.args, *arguments.kwonlyargs]}


def create_app_clock_violations(
    module: Path, accepted_wrappers: frozenset[tuple[str, str]] = ACCEPTED_WRAPPERS
) -> list[str]:
    """Every `create_app(...)` call in `module` that does not name its clock, as
    `module:line: reason`."""
    where = _relative(module)
    found: list[str] = []
    for call, function, arguments in _walk(module).create_app_calls:
        prefix = f"{where}:{call.lineno}:"
        if any(keyword.arg is None for keyword in call.keywords):
            found.append(f"{prefix} `**` unpacking hides whether `clock` is passed")
            continue
        clock = next((kw.value for kw in call.keywords if kw.arg == "clock"), None)
        if clock is None:
            found.append(f"{prefix} no `clock` keyword")
        elif _is_none(clock):
            found.append(f"{prefix} `clock=None`")
        elif (
            isinstance(clock, ast.Name)
            and arguments is not None
            and clock.id in _parameter_names(arguments)
        ):
            # A test's own `clock` parameter is the fixture: pytest always supplies it.
            is_test = function.startswith("test_")
            if not is_test and (where, function) not in accepted_wrappers:
                found.append(f"{prefix} `{function}` wraps `create_app` and is not accepted")
            elif _parameter_has_default(arguments, clock.id):
                found.append(f"{prefix} wrapper `{function}` gives `{clock.id}` a default")
    return found


def _python_files(root: str) -> list[Path]:
    return sorted(
        module for module in (REPO_ROOT / root).rglob("*.py") if FIXTURES not in module.parents
    )


def test_the_create_app_clock_guard_flags_every_unclocked_shape() -> None:
    violations = create_app_clock_violations(FIXTURES / "unclocked_create_app.py")

    assert [violation.split(": ", 1)[1] for violation in violations] == [
        "no `clock` keyword",
        "`clock=None`",
        "`**` unpacking hides whether `clock` is passed",
        "no `clock` keyword",
        "`make_app` wraps `create_app` and is not accepted",
    ]


def test_the_create_app_clock_guard_flags_a_wrapper_whose_clock_has_a_default() -> None:
    wrapper = ("tests/architecture/fixtures/defaulted_wrapper.py", "make_app")
    violations = create_app_clock_violations(
        FIXTURES / "defaulted_wrapper.py", ACCEPTED_WRAPPERS | {wrapper}
    )

    assert [violation.split(": ", 1)[1] for violation in violations] == [
        "wrapper `make_app` gives `clock` a default"
    ]


def test_the_create_app_clock_guard_flags_a_test_whose_clock_parameter_has_a_default() -> None:
    violations = create_app_clock_violations(FIXTURES / "defaulted_test_clock.py")

    assert [violation.split(": ", 1)[1] for violation in violations] == [
        "wrapper `test_it` gives `clock` a default"
    ]


def test_the_create_app_clock_guard_accepts_a_call_naming_its_clock() -> None:
    assert create_app_clock_violations(FIXTURES / "clocked_create_app.py") == []


def test_every_create_app_call_under_tests_names_its_clock() -> None:
    violations = [
        violation
        for module in _python_files("tests")
        for violation in create_app_clock_violations(module)
    ]

    assert violations == []
