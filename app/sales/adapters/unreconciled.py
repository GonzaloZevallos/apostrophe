"""The Operator's one trace of a sale whose payment facts cannot be reconciled
(CONTEXT.md: Payment state). It names the Business id and the Sale number and nothing
else: no Note, name, phone, amount or Balance, and never the exception or its
traceback."""

import logging

logger = logging.getLogger("apostrophe.sales")


def log_unreconciled(business_id: int, number: int) -> None:
    logger.warning(
        "sale payment facts cannot be reconciled: business %d, sale %d", business_id, number
    )
