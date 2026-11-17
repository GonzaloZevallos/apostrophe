"""Mentions every banned form without using one: round(x), a // 100, x * 100, x / 10**2,
math.floor(x + Fraction(1, 2)), Fraction(x, 100), x * SCALE, x * q.HUNDREDTHS_PER_UNIT."""


def split(hundredths: int) -> tuple[int, int]:
    """Not `round(` and not `hundredths // 100`: an exact divmod."""
    # x * 100, x // 100, round(x), math.floor(x), Fraction(x, 100)
    return divmod(hundredths, 100)


def text() -> str:
    return "round(x) // 100 x * 100"
