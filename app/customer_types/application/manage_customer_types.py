from app.customer_types.application.ports import CustomersInType, CustomerTypes
from app.customer_types.domain.customer_type import (
    DEFAULT_ICON,
    CustomerType,
    CustomerTypeIcon,
    CustomerTypeInUse,
    CustomerTypeName,
    CustomerTypeNotFound,
    NameTaken,
)
from app.shared.transaction import Transaction


def list_customer_types(types: CustomerTypes) -> list[CustomerType]:
    return types.list()


def get_customer_type(types: CustomerTypes, type_id: int) -> CustomerType:
    found = types.by_id(type_id)
    if found is None:
        raise CustomerTypeNotFound(type_id)
    return found


def create_customer_type(
    types: CustomerTypes, transaction: Transaction, raw_name: str, raw_icon: str | None = None
) -> CustomerType:
    name = CustomerTypeName(raw_name)
    icon = DEFAULT_ICON if raw_icon is None else CustomerTypeIcon.of(raw_icon)
    if types.by_key(name.key) is not None:
        raise NameTaken()
    stored = types.add(CustomerType(name, icon))
    transaction.commit()
    return stored


def rename_customer_type(
    types: CustomerTypes, transaction: Transaction, type_id: int, raw_name: str
) -> CustomerType:
    customer_type = get_customer_type(types, type_id)
    name = CustomerTypeName(raw_name)
    existing = types.by_key(name.key)
    if existing is not None and existing.id != type_id:
        raise NameTaken()
    customer_type.rename(name)
    stored = types.save(customer_type)
    transaction.commit()
    return stored


def change_customer_type_icon(
    types: CustomerTypes, transaction: Transaction, type_id: int, raw_icon: str
) -> CustomerType:
    customer_type = get_customer_type(types, type_id)
    customer_type.change_icon(CustomerTypeIcon.of(raw_icon))
    stored = types.save(customer_type)
    transaction.commit()
    return stored


def edit_customer_type(
    types: CustomerTypes,
    transaction: Transaction,
    type_id: int,
    raw_name: str | None = None,
    raw_icon: str | None = None,
) -> CustomerType:
    """Renames and/or changes the icon in one commit: every value is checked before
    anything is written, so a refusal leaves the type as it was."""
    customer_type = get_customer_type(types, type_id)
    name = None if raw_name is None else CustomerTypeName(raw_name)
    icon = None if raw_icon is None else CustomerTypeIcon.of(raw_icon)
    if name is not None:
        existing = types.by_key(name.key)
        if existing is not None and existing.id != type_id:
            raise NameTaken()
        customer_type.rename(name)
    if icon is not None:
        customer_type.change_icon(icon)
    stored = types.save(customer_type)
    transaction.commit()
    return stored


def delete_customer_type(
    types: CustomerTypes, customers: CustomersInType, transaction: Transaction, type_id: int
) -> None:
    """Counts first, so the refusal can say how many; the repository's guarded delete
    then closes the window in which a customer joins after the count."""
    customer_type = get_customer_type(types, type_id)
    assert customer_type.id is not None
    customer_type.check_deletable(customers.count(customer_type.id))
    if not types.delete_unused(customer_type.id):
        raise CustomerTypeInUse(customers.count(customer_type.id))
    transaction.commit()
