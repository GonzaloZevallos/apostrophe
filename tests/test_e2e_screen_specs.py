"""`scripts/e2e_screen_specs.json`: the map from a screen to the e2e specs that exercise it.

The rule that says what a screen is lives in `screen_keys` below, and nowhere else:

* a directory directly under `web/src/screens` is a screen (a feature folder: `clientes`,
  `ventas`, `settings`...);
* a file directly under `web/src/screens` is a screen when it is a `.tsx` file that is not a
  `*.test.tsx`; its key is the stem (`Catalogo.tsx` -> `Catalogo`);
* a `.ts` or `.json` file there (`inicioNotices.ts`, `telegramPreview.cases.json`) is a helper or
  a fixture: it keeps no key, so the map says nothing about it, and the selector must treat a
  change to it as a path no rule maps and select every e2e spec;
* a `*.test.ts(x)` file is a test, not a screen.

A value lists the specs, as repo-relative `web/e2e/*.spec.ts` paths in sorted order, that
assert something about the screen: its route is the subject, a heading, toast or control of it
is asserted, or it is a destination the spec checks (not only a page it passes through).
`flow`, `insets` and `navigation` walk every routed screen and are on every key. `mobile.spec.ts`
is left out on purpose: the selector pairs it with `mobile.setup.ts` for any screen or component
change. A spec that only visits a screen to seed data (most visit `VARIETIES` first to create a
variety) is not listed for it. A component folder or helper screen is listed with the specs of
the screen that renders it. `[]` means no spec covers the screen.

`ci-changes` reuses `screen_keys` and `violations` from this module.
"""

from __future__ import annotations

import json
from pathlib import Path

from scripts.affected import REPO_ROOT

SCREENS_DIR = REPO_ROOT / "web" / "src" / "screens"
E2E_DIR = REPO_ROOT / "web" / "e2e"
MAP_PATH = REPO_ROOT / "scripts" / "e2e_screen_specs.json"
SPEC_PREFIX = "web/e2e/"


def screen_keys(screens_dir: Path) -> set[str]:
    """The map keys a screens directory asks for."""
    keys: set[str] = set()
    for entry in screens_dir.iterdir():
        if entry.is_dir():
            keys.add(entry.name)
        elif entry.suffix == ".tsx" and not entry.name.endswith(".test.tsx"):
            keys.add(entry.stem)
    return keys


def violations(mapping: dict[str, list[str]], screens_dir: Path, e2e_dir: Path) -> list[str]:
    """Every way the map disagrees with the trees, one line each; empty when it agrees."""
    found: list[str] = []
    keys = screen_keys(screens_dir)
    for key in sorted(keys - mapping.keys()):
        found.append(f"unmapped screen: {key}")
    for key in sorted(mapping.keys() - keys):
        found.append(f"key with no screen: {key}")
    for key, specs in sorted(mapping.items()):
        if specs != sorted(set(specs)):
            found.append(f"specs of {key} are not sorted and unique")
        for spec in specs:
            name = spec.removeprefix(SPEC_PREFIX)
            listed = spec.startswith(SPEC_PREFIX) and "/" not in name and name.endswith(".spec.ts")
            if not listed:
                found.append(f"{key} lists {spec}, which is not a {SPEC_PREFIX}*.spec.ts path")
            elif not (e2e_dir / name).is_file():
                found.append(f"{key} lists {spec}, which does not exist")
    return found


def load_map() -> dict[str, list[str]]:
    loaded: dict[str, list[str]] = json.loads(MAP_PATH.read_text())
    return loaded


def make_tree(root: Path) -> tuple[Path, Path]:
    screens = root / "screens"
    e2e = root / "e2e"
    (screens / "clientes").mkdir(parents=True)
    (screens / "clientes" / "Clientes.tsx").write_text("")
    (screens / "Catalogo.tsx").write_text("")
    (screens / "Catalogo.test.tsx").write_text("")
    (screens / "catalogCopy.ts").write_text("")
    (screens / "telegramPreview.cases.json").write_text("{}")
    e2e.mkdir()
    (e2e / "catalog.spec.ts").write_text("")
    return screens, e2e


def test_the_real_map_agrees_with_the_real_trees() -> None:
    assert violations(load_map(), SCREENS_DIR, E2E_DIR) == []


def test_a_screen_is_a_directory_or_a_tsx_stem_never_a_test_or_a_helper(tmp_path: Path) -> None:
    screens, _ = make_tree(tmp_path)

    assert screen_keys(screens) == {"clientes", "Catalogo"}


def test_a_map_that_agrees_with_its_tree_has_no_violation(tmp_path: Path) -> None:
    screens, e2e = make_tree(tmp_path)
    mapping = {"clientes": [], "Catalogo": ["web/e2e/catalog.spec.ts"]}

    assert violations(mapping, screens, e2e) == []


def test_an_unmapped_screen_is_refused_by_name(tmp_path: Path) -> None:
    screens, e2e = make_tree(tmp_path)

    assert violations({"clientes": []}, screens, e2e) == ["unmapped screen: Catalogo"]


def test_a_key_with_no_screen_is_refused_by_name(tmp_path: Path) -> None:
    screens, e2e = make_tree(tmp_path)
    mapping: dict[str, list[str]] = {"clientes": [], "Catalogo": [], "Gone": []}

    assert violations(mapping, screens, e2e) == ["key with no screen: Gone"]


def test_a_spec_that_does_not_exist_is_refused_by_name(tmp_path: Path) -> None:
    screens, e2e = make_tree(tmp_path)
    mapping: dict[str, list[str]] = {"clientes": ["web/e2e/missing.spec.ts"], "Catalogo": []}

    assert violations(mapping, screens, e2e) == [
        "clientes lists web/e2e/missing.spec.ts, which does not exist"
    ]


def test_a_spec_outside_web_e2e_is_refused(tmp_path: Path) -> None:
    screens, e2e = make_tree(tmp_path)
    mapping: dict[str, list[str]] = {
        "clientes": ["catalog.spec.ts"],
        "Catalogo": ["web/e2e/helpers/seed.ts"],
    }

    assert violations(mapping, screens, e2e) == [
        "Catalogo lists web/e2e/helpers/seed.ts, which is not a web/e2e/*.spec.ts path",
        "clientes lists catalog.spec.ts, which is not a web/e2e/*.spec.ts path",
    ]


def test_specs_out_of_order_are_refused(tmp_path: Path) -> None:
    screens, e2e = make_tree(tmp_path)
    (e2e / "a.spec.ts").write_text("")
    mapping = {"clientes": [], "Catalogo": ["web/e2e/catalog.spec.ts", "web/e2e/a.spec.ts"]}

    assert violations(mapping, screens, e2e) == ["specs of Catalogo are not sorted and unique"]
