import pytest

from app.shared.quantity import Quantity
from app.shared.unit import Unit


def _unit(decimals: int) -> Unit:
    return Unit(id=1, name="Kilos", label="kg", decimals=decimals)


@pytest.mark.parametrize(
    ("decimals", "hundredths", "admitted"),
    [
        (0, 300, True),
        (0, 0, True),
        (0, 150, False),
        (0, 1, False),
        (1, 150, True),
        (1, 155, False),
        (1, 5, False),
        (2, 255, True),
        (2, 1, True),
        (0, -300, True),
        (0, -150, False),
    ],
)
def test_a_unit_admits_a_quantity_whose_hundredths_fit_its_decimals(
    decimals: int, hundredths: int, admitted: bool
) -> None:
    assert _unit(decimals).admits(Quantity(hundredths)) is admitted


@pytest.mark.parametrize("decimals", [-1, 3])
def test_a_unit_refuses_decimals_outside_zero_to_two(decimals: int) -> None:
    with pytest.raises(ValueError, match="decimals"):
        _unit(decimals)


@pytest.mark.parametrize(("name", "label"), [("", "kg"), ("Kilos", ""), ("  ", "kg")])
def test_a_unit_needs_a_name_and_a_label(name: str, label: str) -> None:
    with pytest.raises(ValueError, match="name and a label"):
        Unit(id=1, name=name, label=label, decimals=0)


def test_a_refused_unit_never_repeats_what_was_given() -> None:
    with pytest.raises(ValueError) as raised:
        Unit(id=1, name="Secret", label="s", decimals=7)

    assert "Secret" not in str(raised.value)
