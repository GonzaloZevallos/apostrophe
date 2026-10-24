"""The missing-key report of the real languages (docs/adr/0050): it lists, never fails."""

from pathlib import Path

from app.shared.copy.completeness import missing_keys
from app.shared.copy.messages import po_path
from app.shared.language import ENGLISH, TEST_LOCALE, InvalidLanguageTag, Language


def missing_report(locales_dir: Path) -> dict[str, tuple[str, ...]]:
    """For every real language (every locale directory but `en` and `en-XA`), the English
    ids it lacks. A language with nothing missing is listed with an empty tuple."""
    if not locales_dir.is_dir():
        return {}
    report: dict[str, tuple[str, ...]] = {}
    for directory in sorted(locales_dir.iterdir()):
        if not po_path(locales_dir, directory.name).is_file():
            continue
        try:
            language = Language(directory.name)
        except InvalidLanguageTag:
            continue
        if language in (ENGLISH, TEST_LOCALE):
            continue
        report[language.tag] = missing_keys(locales_dir, language)
    return report
