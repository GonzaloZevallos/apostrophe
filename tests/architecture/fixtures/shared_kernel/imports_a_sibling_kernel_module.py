"""A kernel module that calls a sibling top-level kernel module: the kernel rule accepts it."""

from fractions import Fraction

from app.shared.ratio import round_ratio_half_up

HALF = round_ratio_half_up(Fraction(1, 2))
