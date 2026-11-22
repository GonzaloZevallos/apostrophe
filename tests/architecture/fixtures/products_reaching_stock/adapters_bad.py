"""A products module that reaches `app.stock`: the new edge the check rejects."""

from app.stock.adapters.latest_costed_purchase import SqlLatestCostedPurchase

READER = SqlLatestCostedPurchase
