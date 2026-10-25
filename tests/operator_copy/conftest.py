from pathlib import Path

import pytest

from tests.operator_copy.locales import build_operator_locales


@pytest.fixture
def operator_locales(tmp_path: Path) -> Path:
    return build_operator_locales(tmp_path)
