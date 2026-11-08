from fractions import Fraction


def to_units(hundredths: int) -> Fraction:
    return Fraction(hundredths, 100)
