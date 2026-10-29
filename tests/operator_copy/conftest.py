from pathlib import Path

import pytest

from tests.fixture_locales import build_fixture_locales


@pytest.fixture
def operator_locales(tmp_path: Path) -> Path:
    return build_fixture_locales(tmp_path)
