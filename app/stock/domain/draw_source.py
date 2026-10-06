"""Why grams left stock without a sale (CONTEXT.md: Stock withdrawal, Promotion, Own
use). The draw contract (`DrawSource`, `draw_source_of`) joins this module in
`stock-draw-contract`; the reason is declared here so the aggregate can import it.
"""

from enum import StrEnum


class WithdrawalReason(StrEnum):
    PROMOTION = "promotion"
    OWN_USE = "own_use"
