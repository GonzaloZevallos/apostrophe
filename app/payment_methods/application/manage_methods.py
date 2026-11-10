from datetime import datetime
from typing import Literal

from app.payment_methods.application.ports import PaymentMethods, PaymentMethodUsage
from app.payment_methods.domain.errors import (
    LastOffered,
    NameTaken,
    NameTakenArchived,
    PaymentMethodNotFound,
)
from app.payment_methods.domain.method import (
    DEFAULT_ICON,
    PaymentMethod,
    PaymentMethodIcon,
    PaymentMethodName,
)
from app.shared.transaction import Transaction

Direction = Literal["up", "down"]


def list_offered(methods: PaymentMethods) -> list[PaymentMethod]:
    return methods.offered()


def list_archived(methods: PaymentMethods) -> list[PaymentMethod]:
    return methods.archived()


def in_use(usage: PaymentMethodUsage, listed: list[PaymentMethod]) -> frozenset[int]:
    return usage.in_use_among([method.id for method in listed])


def _get(methods: PaymentMethods, method_id: int) -> PaymentMethod:
    method = methods.by_id(method_id)
    if method is None:
        raise PaymentMethodNotFound()
    return method


def _check_name_free(methods: PaymentMethods, name: PaymentMethodName, own_id: int | None) -> None:
    holder = methods.by_key(name.name_key)
    if holder is None or holder.id == own_id:
        return
    raise NameTaken() if holder.offered else NameTakenArchived()


def add_method(
    methods: PaymentMethods,
    transaction: Transaction,
    raw_name: str,
    icon: PaymentMethodIcon = DEFAULT_ICON,
) -> PaymentMethod:
    name = PaymentMethodName.of(raw_name)
    _check_name_free(methods, name, None)
    method = methods.add(name, icon)
    transaction.commit()
    return method


def update_method(
    methods: PaymentMethods,
    transaction: Transaction,
    method_id: int,
    raw_name: str | None,
    icon: PaymentMethodIcon | None,
) -> PaymentMethod:
    """The name changes everywhere at once, past payments included: a payment points to
    the method by id."""
    method = _get(methods, method_id)
    if raw_name is not None:
        name = PaymentMethodName.of(raw_name)
        _check_name_free(methods, name, method_id)
        method.name = name
    if icon is not None:
        method.icon = icon
    stored = methods.save_details(method)
    transaction.commit()
    return stored


def move_method(
    methods: PaymentMethods, transaction: Transaction, method_id: int, direction: Direction
) -> list[PaymentMethod]:
    """Swaps with the offered neighbour; at an end it changes nothing."""
    offered = methods.offered()
    index = next((i for i, m in enumerate(offered) if m.id == method_id), None)
    if index is None:
        raise PaymentMethodNotFound()
    neighbour = index - 1 if direction == "up" else index + 1
    if 0 <= neighbour < len(offered):
        methods.swap_positions(offered[index], offered[neighbour])
        transaction.commit()
    return methods.offered()


def archive_method(
    methods: PaymentMethods, transaction: Transaction, method_id: int, now: datetime
) -> None:
    method = _get(methods, method_id)
    if method.offered:
        method.check_archivable(len(methods.offered()))
        if not methods.archive(method_id, now):
            raise LastOffered()
    transaction.commit()


def restore_method(methods: PaymentMethods, transaction: Transaction, method_id: int) -> None:
    """Back to its own stored position."""
    _get(methods, method_id)
    methods.restore(method_id)
    transaction.commit()


def delete_method(
    methods: PaymentMethods, usage: PaymentMethodUsage, transaction: Transaction, method_id: int
) -> None:
    method = _get(methods, method_id)
    method.check_removable(bool(usage.in_use_among([method_id])), len(methods.offered()))
    if not methods.delete(method_id):
        raise LastOffered()
    transaction.commit()


def open_default_methods(
    methods: PaymentMethods,
    names: tuple[PaymentMethodName, ...],
    icons: tuple[PaymentMethodIcon, ...],
) -> None:
    """Called once, when a business opens (docs/adr/0006), with the names of its stored
    language. Never commits: the caller's own transaction covers it."""
    for name, icon in zip(names, icons, strict=True):
        methods.add(name, icon)
