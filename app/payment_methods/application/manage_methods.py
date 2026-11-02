from app.payment_methods.application.ports import Direction, PaymentMethods
from app.payment_methods.domain.method import (
    PaymentMethod,
    PaymentMethodIcon,
    PaymentMethodName,
    PaymentMethodNotFound,
    PaymentMethodSeed,
)
from app.shared.transaction import Transaction

__all__ = [
    "Direction",
    "add_method",
    "archive_method",
    "change_icon",
    "delete_method",
    "get_method",
    "list_archived_methods",
    "list_methods",
    "move_method",
    "open_default_methods",
    "rename_method",
    "restore_method",
]


def list_methods(methods: PaymentMethods) -> list[PaymentMethod]:
    """The active methods, in the seller's order."""
    return methods.list_active()


def list_archived_methods(methods: PaymentMethods) -> list[PaymentMethod]:
    return methods.list_archived()


def get_method(methods: PaymentMethods, method_id: int) -> PaymentMethod:
    method = methods.get(method_id)
    if method is None:
        raise PaymentMethodNotFound(method_id)
    return method


def add_method(
    methods: PaymentMethods, transaction: Transaction, raw_name: str, icon: PaymentMethodIcon
) -> PaymentMethod:
    added = methods.add(PaymentMethodName.of(raw_name), icon)
    transaction.commit()
    return added


def rename_method(
    methods: PaymentMethods, transaction: Transaction, method_id: int, raw_name: str
) -> PaymentMethod:
    renamed = methods.rename(method_id, PaymentMethodName.of(raw_name))
    transaction.commit()
    return renamed


def change_icon(
    methods: PaymentMethods, transaction: Transaction, method_id: int, icon: PaymentMethodIcon
) -> PaymentMethod:
    changed = methods.set_icon(method_id, icon)
    transaction.commit()
    return changed


def move_method(
    methods: PaymentMethods, transaction: Transaction, method_id: int, direction: Direction
) -> None:
    methods.move(method_id, direction)
    transaction.commit()


def archive_method(methods: PaymentMethods, transaction: Transaction, method_id: int) -> None:
    methods.archive(method_id)
    transaction.commit()


def restore_method(methods: PaymentMethods, transaction: Transaction, method_id: int) -> None:
    methods.restore(method_id)
    transaction.commit()


def delete_method(methods: PaymentMethods, transaction: Transaction, method_id: int) -> None:
    methods.delete(method_id)
    transaction.commit()


def open_default_methods(methods: PaymentMethods, seeds: tuple[PaymentMethodSeed, ...]) -> None:
    """Called once, when a business opens (docs/adr/0006), with the methods of its stored
    language. Never commits: the caller's own transaction covers it, together with the
    rest of what opening a business does."""
    for seed in seeds:
        methods.add(seed.name, seed.icon)
