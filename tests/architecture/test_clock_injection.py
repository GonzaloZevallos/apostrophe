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
   cannot leave it out. The accepted wrappers are conftest's `app` fixture, the
   `served_app` fixture of `tests/test_serving.py` and the `app` fixture of
   `tests/business_removal/adapters/test_sql_schema_rows.py`; a new one is added
   deliberately.
2. Under `tests/`, `datetime.now` and `system_clock` appear only at the (file,
   enclosing function) pairs of `ALLOWED_TEST_READS`. A listed pair that no longer reads
   either fails, so the list can only shrink.
3. Under `app/`, they appear only in `app/clock.py`, in `create_app`'s default clock in
   `app/main.py` and in the three operator command lines (accounts, business removal,
   spreadsheet import), listed in `ALLOWED_APP_READS` the same way.

A violating module under `tests/architecture/fixtures/` shows each rule failing.
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
        ("tests/business_removal/adapters/test_sql_schema_rows.py", "app"),
    }
)

# Tests that deliberately run on the real date: an operator command line issues what has
# an expiry on `system_clock` (the commands read it themselves), so the app that checks
# it runs on `system_clock` too. The list can only shrink.
ALLOWED_TEST_READS = frozenset(
    {
        ("tests/accounts/test_cli.py", "test_the_command_prints_a_link_that_opens_a_business"),
        (
            "tests/accounts/test_reset_password_cli.py",
            "test_the_command_prints_a_link_that_resets_a_known_user_s_password",
        ),
        (
            "tests/accounts/test_reset_password_cli.py",
            "test_a_second_issue_replaces_the_first_link",
        ),
        (
            "tests/accounts/test_reset_password_cli.py",
            "test_no_log_record_from_the_command_carries_an_email_a_digest_or_a_token",
        ),
        ("tests/business_removal/adapters/seed.py", "_accept"),
        ("tests/business_removal/adapters/seed.py", "seed"),
        ("tests/business_removal/adapters/test_cli.py", "_accept"),
        (
            "tests/business_removal/adapters/test_cli.py",
            "test_a_clean_slate_lets_the_same_email_open_a_new_business",
        ),
        (
            "tests/business_removal/adapters/test_cli.py",
            "test_a_real_run_exports_then_deletes_and_leaves_the_other_business_whole",
        ),
        (
            "tests/business_removal/adapters/test_cli.py",
            "test_an_nfd_typed_name_matches_through_main",
        ),
        (
            "tests/business_removal/adapters/test_cli.py",
            "test_removal_withholds_a_live_reset_link",
        ),
        (
            "tests/business_removal/adapters/test_cli.py",
            "test_the_other_business_still_reads_its_own_data_after_the_run",
        ),
        ("tests/design/test_sample_app.py", "test_reset_token_opens_a_live_reset_link"),
        # The default clock is read off `create_app`'s signature, not by building an app.
        (
            "tests/test_clock_wiring.py",
            "test_an_app_built_without_a_clock_runs_on_the_system_clock",
        ),
        ("tests/e2e_app.py", "create_e2e_app"),
    }
)
ALLOWED_APP_READS = frozenset(
    {
        ("app/clock.py", "system_clock"),
        ("app/main.py", "create_app"),
        # Invariant 1: onboarding's `created_at` default goes through `system_clock`.
        ("app/onboarding/adapters/tables.py", "_now"),
        ("app/accounts/adapters/cli.py", "_invite_business"),
        ("app/accounts/adapters/cli.py", "_reset_password"),
        ("app/business_removal/adapters/cli.py", "main"),
        ("app/spreadsheet_import/adapters/cli.py", "main"),
    }
)


def _relative(module: Path) -> str:
    try:
        return module.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return module.as_posix()


class _Walker(ast.NodeVisitor):
    """Walks one module keeping the stack of enclosing functions, and the names that
    `datetime`, `system_clock` and `create_app` are bound to by its imports."""

    def __init__(self, tree: ast.Module) -> None:
        self.functions: list[ast.FunctionDef | ast.AsyncFunctionDef] = []
        self.datetime_classes: set[str] = set()
        self.datetime_modules: set[str] = set()
        self.system_clocks: set[str] = {"system_clock"}
        self.create_apps: set[str] = {"create_app"}
        self.clock_reads: list[tuple[str, int]] = []
        self.create_app_calls: list[tuple[ast.Call, str, ast.arguments | None]] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    bound = alias.asname or alias.name
                    if node.module == "datetime" and alias.name == "datetime":
                        self.datetime_classes.add(bound)
                    if alias.name == "system_clock":
                        self.system_clocks.add(bound)
                    if alias.name == "create_app":
                        self.create_apps.add(bound)
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name == "datetime":
                        self.datetime_modules.add(alias.asname or alias.name)
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

    def visit_Name(self, node: ast.Name) -> None:
        if node.id in self.system_clocks:
            self.clock_reads.append((self.enclosing, node.lineno))

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if node.attr == "system_clock" or (node.attr == "now" and self._is_datetime(node.value)):
            self.clock_reads.append((self.enclosing, node.lineno))
        self.generic_visit(node)

    def _is_datetime(self, value: ast.expr) -> bool:
        if isinstance(value, ast.Name):
            return value.id in self.datetime_classes
        return (
            isinstance(value, ast.Attribute)
            and value.attr == "datetime"
            and isinstance(value.value, ast.Name)
            and value.value.id in self.datetime_modules
        )

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
            if (where, function) not in accepted_wrappers:
                found.append(f"{prefix} `{function}` wraps `create_app` and is not accepted")
            elif _parameter_has_default(arguments, clock.id):
                found.append(f"{prefix} wrapper `{function}` gives `{clock.id}` a default")
    return found


def clock_reads(module: Path) -> set[tuple[str, str]]:
    """The (file, enclosing function) pairs of `module` that read `datetime.now` or
    `system_clock`; an import is not a read."""
    where = _relative(module)
    return {(where, function) for function, _ in _walk(module).clock_reads}


def unlisted_or_stale_reads(modules: list[Path], allowed: frozenset[tuple[str, str]]) -> list[str]:
    found = {pair for module in modules for pair in clock_reads(module)}
    unlisted = [
        f"{path}:{function} reads the clock and is not listed" for path, function in found - allowed
    ]
    stale = [
        f"{path}:{function} is listed and reads no clock" for path, function in allowed - found
    ]
    return sorted(unlisted + stale)


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


def test_the_create_app_clock_guard_accepts_a_call_naming_its_clock() -> None:
    assert create_app_clock_violations(FIXTURES / "clocked_create_app.py") == []


def test_every_create_app_call_under_tests_names_its_clock() -> None:
    violations = [
        violation
        for module in _python_files("tests")
        for violation in create_app_clock_violations(module)
    ]

    assert violations == []


def test_the_clock_read_guard_flags_every_way_to_read_the_system_date() -> None:
    reads = _walk(FIXTURES / "reads_the_clock.py").clock_reads

    assert [function for function, _ in reads] == [
        "plain",
        "aliased_class",
        "through_the_module",
        "uses_system_clock",
        "uses_aliased_system_clock",
        "uses_system_clock_by_attribute",
    ]


def test_the_clock_read_guard_ignores_a_module_that_only_imports_the_clock() -> None:
    assert clock_reads(FIXTURES / "clocked_create_app.py") == set()


def test_a_listed_pair_that_reads_no_clock_is_reported_as_stale() -> None:
    stale = ("tests/architecture/fixtures/clocked_create_app.py", "nowhere")

    problems = unlisted_or_stale_reads([FIXTURES / "clocked_create_app.py"], frozenset({stale}))

    assert problems == [f"{stale[0]}:{stale[1]} is listed and reads no clock"]


def test_a_read_at_an_unlisted_pair_is_reported() -> None:
    problems = unlisted_or_stale_reads([FIXTURES / "reads_the_clock.py"], frozenset())

    assert len(problems) == 6
    assert all(problem.endswith("reads the clock and is not listed") for problem in problems)


def test_tests_read_the_system_date_only_where_listed() -> None:
    assert unlisted_or_stale_reads(_python_files("tests"), ALLOWED_TEST_READS) == []


def test_app_reads_the_system_date_only_where_listed() -> None:
    assert unlisted_or_stale_reads(_python_files("app"), ALLOWED_APP_READS) == []
