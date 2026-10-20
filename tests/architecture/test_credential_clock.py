"""A time-limited credential is issued on the clock its app reads (docs/adr/0001,
amendment GH-195).

An invitation or a reset link minted at a fixed instant (`NOW`, a `datetime(...)`, an
offset from either) and checked by an app on another clock expires between the two. The
guard `credentials_issued_at_a_fixed_instant` reads each module with `ast` and names the
calls that do it. It knows the issuers by where they are defined, never by a bare name, so
`SessionSigner.issue(..., NOW)` is not mistaken for the test helper `issue`.
"""

import ast
from collections.abc import Iterator
from pathlib import Path

from tests.architecture.hexagon import REPO_ROOT

FIXTURES = Path(__file__).resolve().parent / "fixtures"
INVITATIONS = "app.accounts.application.invitations"
RESET_PASSWORD = "app.accounts.application.reset_password"
PORTS = "app.accounts.application.ports"

Key = tuple[str, str]

# (defining module, qualified name) -> position of the instant among the positional
# arguments, `self` not counted. The keyword `now` is matched too, and `created_at` for
# the port.
ISSUERS: dict[Key, int] = {
    (INVITATIONS, "invite_new_business"): 2,
    (INVITATIONS, "invite_partner"): 3,
    (RESET_PASSWORD, "issue_reset_link"): 3,
    (PORTS, "Accounts.issue_reset_link"): 2,
    ("tests.conftest", "invite"): 1,
    ("tests.accounts.test_reset_password", "issue"): 1,
    ("tests.business_removal.adapters.test_sql_schema_rows", "_issue_join_invitation"): 2,
}
# Ports that take a whole domain object: the instant sits inside it, so a test never calls
# them. It issues through `invite_new_business` or `invite_partner` on its own clock.
FORBIDDEN_IN_TESTS: frozenset[Key] = frozenset(
    {(PORTS, "Accounts.add_invitation"), (PORTS, "Accounts.save_invitation")}
)
CHECKS = "checks a credential; tests reach it only through HTTP, on the app's clock"
NO_CREDENTIAL = "carries no time-limited credential"
NOT_ISSUERS: dict[Key, str] = {
    (INVITATIONS, "look_up_invitation"): CHECKS,
    (INVITATIONS, "accept_invitation"): CHECKS,
    (RESET_PASSWORD, "look_up_reset_link"): CHECKS,
    (RESET_PASSWORD, "reset_password"): CHECKS,
    (PORTS, "Accounts.add_business"): NO_CREDENTIAL,
    (PORTS, "Accounts.save_business"): NO_CREDENTIAL,
    (PORTS, "Accounts.add_user"): NO_CREDENTIAL,
}
FORBIDDEN_MESSAGE = (
    "issue the invitation through invite_new_business or invite_partner on the app's own clock"
)
INSTANT_KEYWORDS = ("now", "created_at")

FunctionNode = ast.FunctionDef | ast.AsyncFunctionDef
Scope = ast.Module | FunctionNode


def module_name(module: Path) -> str:
    try:
        relative = module.resolve().relative_to(REPO_ROOT)
    except ValueError:
        relative = module
    return ".".join(relative.with_suffix("").parts)


def _import_table(tree: ast.Module) -> dict[str, str]:
    """Every name an import binds, anywhere in the module, to the dotted path it stands for."""
    table: dict[str, str] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                table[alias.asname or alias.name.split(".")[0]] = (
                    alias.name if alias.asname else alias.name.split(".")[0]
                )
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            for alias in node.names:
                table[alias.asname or alias.name] = f"{node.module}.{alias.name}"
    return table


def _dotted(expr: ast.expr) -> str | None:
    if isinstance(expr, ast.Name):
        return expr.id
    if isinstance(expr, ast.Attribute):
        head = _dotted(expr.value)
        return None if head is None else f"{head}.{expr.attr}"
    return None


def _through_imports(path: str, table: dict[str, str]) -> str:
    head, _, rest = path.partition(".")
    resolved = table.get(head, head)
    return f"{resolved}.{rest}" if rest else resolved


def _scopes(tree: ast.Module) -> Iterator[Scope]:
    yield tree
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            yield node


def _own_nodes(scope: Scope) -> Iterator[ast.AST]:
    """The nodes of `scope`, not those of the functions defined inside it."""
    pending: list[ast.AST] = list(ast.iter_child_nodes(scope))
    while pending:
        node = pending.pop()
        yield node
        if not isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            pending.extend(ast.iter_child_nodes(node))


class _Resolver:
    def __init__(self, module: Path, tree: ast.Module) -> None:
        self.module = module_name(module)
        self.table = _import_table(tree)
        self.top_level = {node.name for node in tree.body if isinstance(node, ast.FunctionDef)}
        self.modules = {module_ for module_, _ in ISSUERS | dict.fromkeys(FORBIDDEN_IN_TESTS)}
        self.methods = {
            key[1].split(".")[1]: key for key in (*ISSUERS, *FORBIDDEN_IN_TESTS) if "." in key[1]
        }

    def callee(self, func: ast.expr) -> Key | None:
        if isinstance(func, ast.Name):
            if func.id in self.table:
                owner, _, name = self.table[func.id].rpartition(".")
                return (owner, name)
            return (self.module, func.id) if func.id in self.top_level else None
        if isinstance(func, ast.Attribute):
            path = _dotted(func.value)
            if path is not None and _through_imports(path, self.table) in self.modules:
                return (_through_imports(path, self.table), func.attr)
            return self.methods.get(func.attr)
        return None

    def is_fixed(self, expr: ast.expr, scope: Scope, seen: frozenset[str] = frozenset()) -> bool:
        if isinstance(expr, ast.Constant):
            return True
        if isinstance(expr, ast.Name):
            if expr.id.isupper():
                return True
            if self.table.get(expr.id, "").rpartition(".")[2].isupper():
                return True
            return expr.id not in seen and self._assigned_fixed(expr.id, scope, seen)
        if isinstance(expr, ast.Attribute):
            return expr.attr.isupper()
        if isinstance(expr, ast.BinOp):
            return self.is_fixed(expr.left, scope, seen) and self.is_fixed(expr.right, scope, seen)
        if isinstance(expr, ast.Call):
            return isinstance(expr.func, ast.Name) and expr.func.id in (
                "datetime",
                "date",
                "timedelta",
            )
        return False

    def _assigned_fixed(self, name: str, scope: Scope, seen: frozenset[str]) -> bool:
        """`name` is fixed when it is bound once in `scope` -- not as a parameter, a loop
        target or by augmented assignment -- to a fixed value."""
        if isinstance(scope, ast.FunctionDef | ast.AsyncFunctionDef) and name in {
            arg.arg for arg in (*scope.args.posonlyargs, *scope.args.args, *scope.args.kwonlyargs)
        } | {a.arg for a in (scope.args.vararg, scope.args.kwarg) if a}:
            return False
        nodes = list(_own_nodes(scope))
        stores = [
            n
            for n in nodes
            if isinstance(n, ast.Name) and n.id == name and isinstance(n.ctx, ast.Store)
        ]
        values = [value for target, value in _bindings(nodes) if target == name]
        if len(stores) != 1 or len(values) != 1 or values[0] is None:
            return False
        return self.is_fixed(values[0], scope, seen | {name})


def _bindings(nodes: list[ast.AST]) -> Iterator[tuple[str, ast.expr | None]]:
    for node in nodes:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    yield target.id, node.value
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            yield node.target.id, node.value


def _instant(call: ast.Call, position: int, keywords: tuple[str, ...]) -> ast.expr | None:
    positional = call.args[: position + 1]
    if len(positional) == position + 1 and not any(isinstance(a, ast.Starred) for a in positional):
        return positional[position]
    return next((kw.value for kw in call.keywords if kw.arg in keywords), None)


def credentials_issued_at_a_fixed_instant(module: Path) -> list[str]:
    """Every call in `module` that issues a time-limited credential at an instant that does
    not follow the app's clock, or calls a port that `FORBIDDEN_IN_TESTS` lists, named
    `module:line`. A call that resolves to no row of the tables is ignored."""
    tree = ast.parse(module.read_text(), filename=str(module))
    resolver = _Resolver(module, tree)
    found: list[str] = []
    for scope in _scopes(tree):
        for node in _own_nodes(scope):
            if not isinstance(node, ast.Call):
                continue
            key = resolver.callee(node.func)
            if key in FORBIDDEN_IN_TESTS:
                found.append(f"{module}:{node.lineno}: {FORBIDDEN_MESSAGE}")
            elif key in ISSUERS:
                instant = _instant(node, ISSUERS[key], INSTANT_KEYWORDS)
                if instant is not None and resolver.is_fixed(instant, scope):
                    found.append(f"{module}:{node.lineno}")
    return sorted(found)


def _flagged_lines(module: Path) -> list[int]:
    lines = module.read_text().splitlines()
    return [n for n, line in enumerate(lines, 1) if line.endswith("  # flagged")]


def _lines(violations: list[str]) -> list[int]:
    return sorted(int(v.split(":")[1].split(" ")[0]) for v in violations)


def test_the_guard_flags_each_credential_minted_at_a_fixed_instant() -> None:
    module = FIXTURES / "credential_at_a_fixed_instant.py"

    violations = credentials_issued_at_a_fixed_instant(module)

    assert len(violations) == 11
    assert _lines(violations) == _flagged_lines(module)


def test_the_guard_flags_a_call_to_a_port_that_takes_a_whole_invitation() -> None:
    module = FIXTURES / "forbidden_invitation_port.py"

    violations = credentials_issued_at_a_fixed_instant(module)

    assert len(violations) == 2
    assert _lines(violations) == _flagged_lines(module)
    assert all(v.endswith(FORBIDDEN_MESSAGE) for v in violations)


def test_the_guard_does_not_flag_an_instant_that_follows_the_clock() -> None:
    assert credentials_issued_at_a_fixed_instant(FIXTURES / "credential_at_the_clock.py") == []


def test_the_guard_does_not_confuse_a_local_issue_with_the_test_helper() -> None:
    assert credentials_issued_at_a_fixed_instant(FIXTURES / "unrelated_issue.py") == []


def test_no_test_issues_a_credential_at_a_fixed_instant() -> None:
    violators = [
        violation
        for module in sorted((REPO_ROOT / "tests").rglob("*.py"))
        if FIXTURES not in module.parents
        for violation in credentials_issued_at_a_fixed_instant(module)
    ]

    assert violators == []


def _source(module: str) -> ast.Module:
    path = REPO_ROOT / Path(*module.split(".")).with_suffix(".py")
    return ast.parse(path.read_text(), filename=str(path))


def _methods_of(tree: ast.Module, class_name: str) -> list[ast.FunctionDef]:
    return [
        method
        for node in tree.body
        if isinstance(node, ast.ClassDef) and node.name == class_name
        for method in node.body
        if isinstance(method, ast.FunctionDef)
    ]


def reflected_credential_functions() -> set[Key]:
    """Every public function of the two credential use cases and every `Accounts` method
    that writes (`add_*`, `issue_*`, `save_*`): the closed world each row must classify."""
    keys: set[Key] = set()
    for module in (INVITATIONS, RESET_PASSWORD):
        keys |= {
            (module, node.name)
            for node in _source(module).body
            if isinstance(node, ast.FunctionDef) and not node.name.startswith("_")
        }
    keys |= {
        (PORTS, f"Accounts.{method.name}")
        for method in _methods_of(_source(PORTS), "Accounts")
        if method.name.startswith(("add_", "issue_", "save_"))
    }
    return keys


def _resolves_to_a_def(key: Key) -> bool:
    module, qualified = key
    tree = _source(module)
    owner, _, name = qualified.rpartition(".")
    if owner:
        return any(method.name == name for method in _methods_of(tree, owner))
    return any(isinstance(node, ast.FunctionDef) and node.name == name for node in tree.body)


def closed_world_problems(
    reflected: set[Key],
    issuers: dict[Key, int],
    forbidden: frozenset[Key],
    not_issuers: dict[Key, str],
) -> list[str]:
    """What is wrong with the three groups: a reflected function in none or in more than
    one, a row that names no def, or a `NOT_ISSUERS` row without a reason."""
    problems = [
        f"{module}.{name} is in {groups} of the three groups, not exactly one"
        for module, name in sorted(reflected)
        for groups in [
            sum(((module, name) in group) for group in (issuers, forbidden, not_issuers))
        ]
        if groups != 1
    ]
    rows = sorted({*issuers, *forbidden, *not_issuers})
    problems += [
        f"{module}.{name} resolves to no def"
        for module, name in rows
        if not _resolves_to_a_def((module, name))
    ]
    problems += [
        f"{module}.{name} has no reason"
        for (module, name), reason in not_issuers.items()
        if not reason.strip()
    ]
    return problems


def test_every_credential_function_is_classified_exactly_once() -> None:
    assert (
        closed_world_problems(
            reflected_credential_functions(), ISSUERS, FORBIDDEN_IN_TESTS, NOT_ISSUERS
        )
        == []
    )


def test_the_reflection_finds_the_credential_functions_it_must_classify() -> None:
    reflected = reflected_credential_functions()

    assert (INVITATIONS, "invite_partner") in reflected
    assert (RESET_PASSWORD, "issue_reset_link") in reflected
    assert (PORTS, "Accounts.issue_reset_link") in reflected
    assert (PORTS, "Accounts.save_invitation") in reflected
    assert (PORTS, "Accounts.business") not in reflected


def test_the_closed_world_rejects_an_unclassified_a_doubled_and_a_stale_row() -> None:
    unclassified = {k: v for k, v in NOT_ISSUERS.items() if k != (RESET_PASSWORD, "reset_password")}
    doubled = ISSUERS | {(INVITATIONS, "look_up_invitation"): 1}
    stale = ISSUERS | {("tests.conftest", "invite_renamed"): 1}
    unreasoned = NOT_ISSUERS | {(PORTS, "Accounts.add_user"): " "}
    reflected = reflected_credential_functions()

    assert closed_world_problems(reflected, ISSUERS, FORBIDDEN_IN_TESTS, unclassified) == [
        f"{RESET_PASSWORD}.reset_password is in 0 of the three groups, not exactly one"
    ]
    assert closed_world_problems(reflected, doubled, FORBIDDEN_IN_TESTS, NOT_ISSUERS) == [
        f"{INVITATIONS}.look_up_invitation is in 2 of the three groups, not exactly one"
    ]
    assert closed_world_problems(reflected, stale, FORBIDDEN_IN_TESTS, NOT_ISSUERS) == [
        "tests.conftest.invite_renamed resolves to no def"
    ]
    assert closed_world_problems(reflected, ISSUERS, FORBIDDEN_IN_TESTS, unreasoned) == [
        f"{PORTS}.Accounts.add_user has no reason"
    ]
