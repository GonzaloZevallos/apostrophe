"""Tells the response which decimals the signed-in business shows (docs/adr/0058).

A domain amount is an int in the unit of the business's decimals; `MoneyOut` writes it in
currency units and reads the decimals from `MONEY_DECIMALS`. A route that answers amounts
is included with `bind_money_decimals` beside `require_session`, so the variable holds the
business's decimals before the handler runs and while the response is serialised.

No request or response carries the decimals: they come from the business's own row.
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.db import get_session, money_decimals
from app.money_schema import MONEY_DECIMALS


def _decimals_of_business(
    session: Annotated[Session, Depends(get_session)], business_id: CurrentBusinessId
) -> int:
    return money_decimals(session, business_id)


async def bind_money_decimals(decimals: Annotated[int, Depends(_decimals_of_business)]) -> None:
    """Async on purpose: it runs in the request's own context, so the value it sets is the
    one the handler (copied into a worker thread) and the serialiser see."""
    MONEY_DECIMALS.set(decimals)
