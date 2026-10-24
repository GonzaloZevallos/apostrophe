"""Writes the test locale `en-XA` from English (docs/adr/0050).

`uv run --no-project python -m scripts.pseudo_locale` reads
`app/shared/copy/locales/en/LC_MESSAGES/apostrophe.po` and writes `en-XA/LC_MESSAGES/` beside
it, `.po` and `.mo`. The logic is `app.shared.copy.pseudo`; this is only the writer.
"""

import sys
from pathlib import Path

from app.shared.copy import compile_po, po_text, pseudo_catalog, read_catalog
from app.shared.copy.messages import po_path
from app.shared.language import ENGLISH, TEST_LOCALE

DEFAULT_LOCALES = Path(__file__).resolve().parents[1] / "app" / "shared" / "copy" / "locales"


def main(locales_dir: Path = DEFAULT_LOCALES) -> int:
    english = read_catalog(po_path(locales_dir, ENGLISH.tag))
    target = po_path(locales_dir, TEST_LOCALE.tag)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(po_text(pseudo_catalog(english)), encoding="utf-8")
    compile_po(target, target.with_suffix(".mo"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
