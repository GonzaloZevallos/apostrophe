"""Lists, for each real language, the English keys it still lacks (docs/adr/0050).

`uv run --no-project python -m scripts.copy_report`: one line per missing
key, grouped by language. It reports and never fails.
"""

import sys
from pathlib import Path

from app.shared.copy import missing_report

DEFAULT_LOCALES = Path(__file__).resolve().parents[1] / "app" / "shared" / "copy" / "locales"


def main(locales_dir: Path = DEFAULT_LOCALES) -> int:
    for tag, keys in missing_report(locales_dir).items():
        print(f"{tag}: {len(keys)} missing")
        for key in keys:
            print(f"  {key}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
