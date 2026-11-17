"""The route class of a router whose request bodies carry money (docs/adr/0058).

FastAPI hands pydantic the JSON body already parsed, so a literal such as `10.5` reaches a
model as a Python float, which `MoneyAmount` refuses in that mode. Reading the body with
`parse_float=Decimal` hands it over exact instead, so `money_within` is what judges how many
decimals the amount has, and a literal of any length arrives as written.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Coroutine
from decimal import Decimal
from typing import Any

from fastapi import Request, Response
from fastapi.routing import APIRoute


class _DecimalJsonRequest(Request):
    async def json(self) -> Any:
        if not hasattr(self, "_json"):
            self._json = json.loads(await self.body(), parse_float=Decimal)
        return self._json


class MoneyJsonRoute(APIRoute):
    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        handler = super().get_route_handler()

        async def read_decimals(request: Request) -> Response:
            return await handler(_DecimalJsonRequest(request.scope, request.receive))

        return read_decimals
