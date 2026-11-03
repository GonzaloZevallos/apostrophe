from typing import Literal

from app.shared.transaction import Transaction
from app.stock.application.ports import WithdrawalReasons
from app.stock.domain.errors import (
    LastReason,
    ReasonCannotMove,
    ReasonNameTaken,
    WithdrawalReasonNotFound,
)
from app.stock.domain.withdrawal_reason import ReasonName, WithdrawalReason

Direction = Literal["up", "down"]


def list_reasons(reasons: WithdrawalReasons) -> list[WithdrawalReason]:
    return reasons.all()


def add_reason(
    reasons: WithdrawalReasons, transaction: Transaction, raw_name: str
) -> WithdrawalReason:
    """A new reason goes to the end of the list."""
    name = ReasonName.of(raw_name)
    current = reasons.all()
    if any(reason.name.key == name.key for reason in current):
        raise ReasonNameTaken()
    position = max((reason.position for reason in current), default=-1) + 1
    reason = reasons.add(name, position)
    transaction.commit()
    return reason


def rename_reason(
    reasons: WithdrawalReasons, transaction: Transaction, reason_id: int, raw_name: str
) -> WithdrawalReason:
    """The label changes everywhere at once, past withdrawals included: it is read by id."""
    reason = reasons.get(reason_id)
    if reason is None:
        raise WithdrawalReasonNotFound()
    reason.rename(ReasonName.of(raw_name))
    saved = reasons.save(reason)
    transaction.commit()
    return saved


def delete_reason(reasons: WithdrawalReasons, transaction: Transaction, reason_id: int) -> None:
    """The domain rule decides first; the guarded DELETE and the RESTRICT foreign key
    are the backstop for a withdrawal or a delete that landed in between, and a refused
    statement is read again to say which rule it was."""
    reason = reasons.get(reason_id)
    if reason is None:
        raise WithdrawalReasonNotFound()
    reason.check_removable(reasons.has_withdrawals(reason_id), reasons.count())
    if not reasons.remove(reason_id):
        again = reasons.get(reason_id)
        if again is None:
            raise WithdrawalReasonNotFound()
        again.check_removable(reasons.has_withdrawals(reason_id), reasons.count())
        raise LastReason()
    transaction.commit()


def move_reason(
    reasons: WithdrawalReasons, transaction: Transaction, reason_id: int, direction: Direction
) -> list[WithdrawalReason]:
    """Swaps the reason with its neighbour, in one transaction; past either edge is
    `ReasonCannotMove`. Returns the whole list as it is now."""
    ordered = [reason.id for reason in reasons.all()]
    if reason_id not in ordered:
        raise WithdrawalReasonNotFound()
    index = ordered.index(reason_id)
    neighbour = index - 1 if direction == "up" else index + 1
    if not 0 <= neighbour < len(ordered):
        raise ReasonCannotMove()
    ordered[index], ordered[neighbour] = ordered[neighbour], ordered[index]
    reasons.reorder(ordered)
    transaction.commit()
    return reasons.all()


def open_default_reasons(reasons: WithdrawalReasons, names: tuple[ReasonName, ...]) -> None:
    """Called once, when a business opens (docs/adr/0006), with the names of its stored
    language. Never commits: the caller's own transaction covers it."""
    for position, name in enumerate(names):
        reasons.add(name, position)
