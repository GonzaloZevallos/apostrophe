"""The one list of paths the docs generator owns: `docs.paths` in `.agentic/stack.yaml`.

`python -m scripts.docs.owned_paths` prints it, one path per line. A path ending in `/**` is a
directory (every file strictly under it); any other entry is exactly that file. Imports
nothing from `app` or `tests`.
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

from scripts.docs.tools import REPO_ROOT

STACK_PATH = ".agentic/stack.yaml"


def owned_paths(root: Path) -> list[str]:
    """The `docs.paths` of the `stack.yaml` under `root`, in the order it lists them."""
    stack = yaml.safe_load((root / STACK_PATH).read_text(encoding="utf-8"))
    paths = stack["docs"]["paths"]
    if not isinstance(paths, list) or not all(isinstance(path, str) for path in paths):
        raise ValueError(f"{STACK_PATH}: docs.paths is not a list of strings")
    return list(paths)


def main() -> int:
    print("\n".join(owned_paths(REPO_ROOT)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
