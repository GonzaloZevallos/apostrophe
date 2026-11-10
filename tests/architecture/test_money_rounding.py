"""Half-up rounding of an amount goes through `round_half_up` or `round_half_up_to_units` in
`app/shared/money.py` (ADR-0058), and a quantity's hundredths become units only through
`Quantity.units` (ADR-0056). No file under `app/` makes its own money rounding or turns a
quantity by a literal 100.

The checker parses each file with `ast`, so comments, docstrings and strings never count and
`divmod` (an exact split, not a rounding) is never flagged. It first makes one pass over every
scanned file for the module-level names bound to the constant 100, then flags:

- a call to the builtin `round`;
- any `//`, whatever its divisor;
- a call to `math.floor` or `math.ceil`, or to `floor` or `ceil` imported from `math`;
- a `*`, `/` or `//` (an augmented one too) with the literal `100`, `10**2`, a name bound to
  100 or an attribute of that name as an operand;
- a `Fraction(...)` call with any of those as an argument.

Each finding names its file and the qualified function that holds it. What stays is the closed
`EXEMPT_FILES` and `EXEMPT_FUNCTIONS`, each with its reason, asserted by equality: the scan
without exemptions flags exactly that set, so a stale or missing entry fails the test.

Limit, by design: a name bound to 100 anywhere but module level (a local, a class attribute)
is not collected, and a `round` the module rebinds is still read as the builtin.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path

import pytest

from tests.architecture.hexagon import REPO_ROOT

FIXTURES = Path(__file__).parent / "fixtures" / "money_rounding"
SCALE_OPERATORS = (ast.Mult, ast.Div, ast.FloorDiv)

# Closed. A whole file that may hold any of the forms, with its reason.
EXEMPT_FILES: dict[str, str] = {
    "app/shared/money.py": "the one money rule: round_half_up and its helpers (ADR-0058)",
    "app/shared/quantity.py": "the one conversion of a quantity's hundredths to units (ADR-0056)",
}
# Closed. A function (qualified by its classes) that may hold them, keyed `path::function`.
EXEMPT_FUNCTIONS: dict[str, str] = {
    "app/results/domain/rounding.py::percent": (
        "Margin % is a ratio, not money: it keeps its own floor(x + 1/2)"
    ),
    "app/results/domain/rounding.py::_round_ratio_half_up": (
        "the private ratio rounding behind percent: a ratio, not money"
    ),
    "app/stock/domain/withdrawal.py::WithdrawalLine.of": (
        "parses a typed quantity into hundredths; no amount is rounded"
    ),
    "app/stock/domain/stock_level.py::_days_left": "a count of whole days, not money",
    "app/pinned_catalog/domain/bold.py::utf16_length": "a text length in UTF-16 code units",
    "app/shared/copy/pseudo.py::_pseudo_text": "the Test locale's text growth, not money",
}


@dataclass(frozen=True)
class Finding:
    path: str
    symbol: str
    line: int
    form: str

    @property
    def where(self) -> str:
        return f"{self.path}:{self.line} in {self.symbol or '<module>'}: {self.form}"


def hundred_names(tree: ast.Module) -> set[str]:
    """The module-level names `tree` binds to the constant 100."""
    names: set[str] = set()
    for node in tree.body:
        if isinstance(node, ast.Assign) and _is_literal_hundred(node.value):
            names.update(target.id for target in node.targets if isinstance(target, ast.Name))
        elif (
            isinstance(node, ast.AnnAssign)
            and node.value is not None
            and _is_literal_hundred(node.value)
            and isinstance(node.target, ast.Name)
        ):
            names.add(node.target.id)
    return names


def _is_literal_hundred(node: ast.expr) -> bool:
    return (
        isinstance(node, ast.Constant)
        and not isinstance(node.value, bool)
        and isinstance(node.value, int | float)
        and node.value == 100
    )


def _is_ten_squared(node: ast.expr) -> bool:
    return (
        isinstance(node, ast.BinOp)
        and isinstance(node.op, ast.Pow)
        and isinstance(node.left, ast.Constant)
        and node.left.value == 10
        and isinstance(node.right, ast.Constant)
        and node.right.value == 2
    )


def _math_names(tree: ast.Module) -> tuple[set[str], set[str]]:
    """(local names of the `math` module, local names of `math.floor` or `math.ceil`)."""
    modules: set[str] = set()
    functions: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(a.asname or a.name for a in node.names if a.name == "math")
        elif isinstance(node, ast.ImportFrom) and node.module == "math" and not node.level:
            functions.update(a.asname or a.name for a in node.names if a.name in ("floor", "ceil"))
    return modules, functions


def findings_in(source: str, path: str, hundreds: frozenset[str]) -> list[Finding]:
    """Every banned form in `source`, with the qualified function that holds it."""
    tree = ast.parse(source)
    math_modules, math_functions = _math_names(tree)
    found: set[Finding] = set()

    def is_hundred(node: ast.expr) -> bool:
        return (
            _is_literal_hundred(node)
            or _is_ten_squared(node)
            or (isinstance(node, ast.Name) and node.id in hundreds)
            or (isinstance(node, ast.Attribute) and node.attr in hundreds)
        )

    def flag(node: ast.expr | ast.stmt, symbol: str, form: str) -> None:
        found.add(Finding(path, symbol, node.lineno, form))

    def check_call(node: ast.Call, symbol: str) -> None:
        func = node.func
        if isinstance(func, ast.Name) and func.id == "round":
            flag(node, symbol, "round(")
        if isinstance(func, ast.Name) and func.id in math_functions:
            flag(node, symbol, f"{func.id}(")
        if (
            isinstance(func, ast.Attribute)
            and func.attr in ("floor", "ceil")
            and isinstance(func.value, ast.Name)
            and func.value.id in math_modules
        ):
            flag(node, symbol, f"math.{func.attr}(")
        is_fraction = (isinstance(func, ast.Name) and func.id == "Fraction") or (
            isinstance(func, ast.Attribute) and func.attr == "Fraction"
        )
        arguments = [*node.args, *(keyword.value for keyword in node.keywords)]
        if is_fraction and any(is_hundred(argument) for argument in arguments):
            flag(node, symbol, "Fraction(..., 100)")

    def check_operation(
        node: ast.expr | ast.stmt, op: ast.operator, left: ast.expr, right: ast.expr, symbol: str
    ) -> None:
        if isinstance(op, ast.FloorDiv):
            flag(node, symbol, "//")
        elif isinstance(op, SCALE_OPERATORS) and (is_hundred(left) or is_hundred(right)):
            flag(node, symbol, "operator with 100")

    def visit(node: ast.AST, symbol: str) -> None:
        inner = symbol
        if isinstance(node, ast.Call):
            check_call(node, symbol)
        elif isinstance(node, ast.BinOp):
            check_operation(node, node.op, node.left, node.right, symbol)
        elif isinstance(node, ast.AugAssign):
            check_operation(node, node.op, node.target, node.value, symbol)
        elif isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef):
            inner = f"{symbol}.{node.name}" if symbol else node.name
        for child in ast.iter_child_nodes(node):
            visit(child, inner)

    visit(tree, "")
    return sorted(found, key=lambda f: (f.line, f.form))


def scan(directory: Path, base: Path, exempt: bool = True) -> list[Finding]:
    """Every finding under `directory`, paths relative to `base`; `exempt` honours the
    exemptions."""
    sources = {file: file.read_text() for file in sorted(directory.rglob("*.py"))}
    hundreds = frozenset(
        name for source in sources.values() for name in hundred_names(ast.parse(source))
    )
    found = [
        finding
        for file, source in sources.items()
        for finding in findings_in(source, file.relative_to(base).as_posix(), hundreds)
    ]
    return [f for f in found if not (exempt and is_exempt(f))]


def is_exempt(finding: Finding) -> bool:
    if finding.path in EXEMPT_FILES:
        return True
    for key in EXEMPT_FUNCTIONS:
        path, _, function = key.partition("::")
        if finding.path == path and (
            finding.symbol == function or finding.symbol.startswith(function + ".")
        ):
            return True
    return False


def test_no_money_rounding_outside_money_py_and_the_named_exemptions() -> None:
    assert [f.where for f in scan(REPO_ROOT / "app", REPO_ROOT)] == []


def test_the_scan_without_exemptions_flags_exactly_the_exempt_set() -> None:
    flagged = scan(REPO_ROOT / "app", REPO_ROOT, exempt=False)

    files = {f.path for f in flagged if f.path in EXEMPT_FILES}
    functions = {f"{f.path}::{f.symbol}" for f in flagged if f.path not in EXEMPT_FILES}
    assert files == set(EXEMPT_FILES)
    assert functions == set(EXEMPT_FUNCTIONS)


def test_the_exempt_set_is_exactly_the_agreed_one() -> None:
    assert set(EXEMPT_FILES) == {"app/shared/money.py", "app/shared/quantity.py"}
    assert set(EXEMPT_FUNCTIONS) == {
        "app/results/domain/rounding.py::percent",
        "app/results/domain/rounding.py::_round_ratio_half_up",
        "app/stock/domain/withdrawal.py::WithdrawalLine.of",
        "app/stock/domain/stock_level.py::_days_left",
        "app/pinned_catalog/domain/bold.py::utf16_length",
        "app/shared/copy/pseudo.py::_pseudo_text",
    }


def test_every_exemption_has_a_reason() -> None:
    assert all(reason.strip() for reason in [*EXEMPT_FILES.values(), *EXEMPT_FUNCTIONS.values()])


def test_an_exempt_file_that_holds_no_form_any_more_is_not_in_the_flagged_set(
    tmp_path: Path,
) -> None:
    (tmp_path / "app" / "shared").mkdir(parents=True)
    (tmp_path / "app" / "shared" / "money.py").write_text("def f(x: int) -> int:\n    return x\n")

    flagged = scan(tmp_path, tmp_path, exempt=False)

    assert {f.path for f in flagged if f.path in EXEMPT_FILES} != set(EXEMPT_FILES)


def test_a_form_in_a_file_the_exemptions_do_not_name_is_reported_with_its_function(
    tmp_path: Path,
) -> None:
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "pricing.py").write_text(
        "class Line:\n    def total(self, t: int, c: int) -> int:\n"
        "        return (2 * t + c) // (2 * c)\n"
    )

    assert [f.where for f in scan(tmp_path, tmp_path)] == ["app/pricing.py:3 in Line.total: //"]


FLAGGED_FIXTURES = {
    "builtin_round.py": "round(",
    "floor_division_by_a_doubled_count.py": "//",
    "math_floor_half.py": "math.floor(",
    "from_math_ceil.py": "up(",
    "times_a_hundred.py": "operator with 100",
    "floor_divided_by_a_hundred.py": "//",
    "divided_by_ten_squared.py": "operator with 100",
    "fraction_over_a_hundred.py": "Fraction(..., 100)",
    "times_a_name_bound_to_a_hundred.py": "operator with 100",
    "times_an_attribute_bound_to_a_hundred.py": "operator with 100",
}


@pytest.mark.parametrize(("fixture", "form"), sorted(FLAGGED_FIXTURES.items()))
def test_the_scan_flags_each_banned_form(fixture: str, form: str) -> None:
    flagged = [f for f in scan(FIXTURES, FIXTURES, exempt=False) if f.path == fixture]

    assert [f.form for f in flagged] == [form]


def test_the_scan_flags_exactly_the_banned_fixtures() -> None:
    flagged = {f.path for f in scan(FIXTURES, FIXTURES, exempt=False)}

    assert flagged == set(FLAGGED_FIXTURES)


def test_the_scan_names_the_enclosing_function_of_a_finding() -> None:
    flagged = scan(FIXTURES, FIXTURES)

    assert [f.symbol for f in flagged if f.path == "floor_division_by_a_doubled_count.py"] == [
        "average"
    ]


def test_comments_docstrings_strings_and_divmod_are_never_flagged() -> None:
    flagged = scan(FIXTURES, FIXTURES, exempt=False)

    assert [f for f in flagged if f.path == "clean_mentions.py"] == []


@pytest.mark.parametrize(
    "source",
    [
        "def f(t, c):\n    return (2 * t + c) // (2 * c)\n",
        "def f(x):\n    x //= 2\n    return x\n",
        "def f(x):\n    x *= 100\n    return x\n",
        "from math import floor\n\n\ndef f(x):\n    return floor(x)\n",
        "import math as m\n\n\ndef f(x):\n    return m.ceil(x)\n",
        "def f(x):\n    return x * (10 ** 2)\n",
        "def f(x):\n    return 100 * x\n",
        "from fractions import Fraction\n\n\ndef f(x):\n    return Fraction(x, denominator=100)\n",
    ],
)
def test_the_scan_flags_a_reintroduced_site_form(source: str) -> None:
    assert findings_in(source, "app/x.py", frozenset()) != []


@pytest.mark.parametrize(
    "source",
    [
        "def f(x):\n    return divmod(x, 100)\n",
        "def f(x):\n    return x * 10\n",
        "def f(x):\n    return x / 1000\n",
        "def f(x):\n    return x.floor(1)\n",
    ],
)
def test_the_scan_lets_an_unrelated_form_through(source: str) -> None:
    assert findings_in(source, "app/x.py", frozenset()) == []
