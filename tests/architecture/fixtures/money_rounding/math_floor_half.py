import math
from fractions import Fraction


def half_up(value: Fraction) -> int:
    return math.floor(value + Fraction(1, 2))
