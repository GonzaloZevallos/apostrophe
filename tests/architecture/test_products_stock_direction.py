"""Nothing new under `app/products/` imports `app.stock`. The one edge there is
`adapters/sql_products.py` reading stock's tables for a Product's history; it is pinned
here and waits for a port stock implements. The cost of a Product reaches the router only
through `app.state.products_latest_costed_purchase`, wired in `app/main.py`."""

from pathlib import Path

from tests.architecture.hexagon import REPO_ROOT, full_imports_of

PRODUCTS = REPO_ROOT / "app" / "products"
FIXTURE = (
    Path(__file__).resolve().parent / "fixtures" / "products_reaching_stock" / "adapters_bad.py"
)
KNOWN_EDGE = [
    "adapters/sql_products.py: app.stock.adapters.tables.StockEntryRow",
    "adapters/sql_products.py: app.stock.adapters.tables.StockWithdrawalLineRow",
]


def modules_reaching_stock(root: Path) -> list[str]:
    """Every `module: import` under `root` that is `app.stock` or inside it."""
    return sorted(
        f"{module.relative_to(root).as_posix()}: {imported}"
        for module in root.rglob("*.py")
        for imported in full_imports_of(module)
        if imported == "app.stock" or imported.startswith("app.stock.")
    )


def test_the_only_stock_import_under_products_is_the_pinned_one() -> None:
    assert any(PRODUCTS.rglob("*.py"))
    assert modules_reaching_stock(PRODUCTS) == KNOWN_EDGE


def test_the_check_reports_a_products_module_that_imports_stock() -> None:
    found = modules_reaching_stock(FIXTURE.parent)

    assert found == [
        "adapters_bad.py: app.stock.adapters.latest_costed_purchase.SqlLatestCostedPurchase"
    ]
