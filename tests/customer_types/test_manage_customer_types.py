"""The customer type use cases over in-memory fakes of their ports."""

from __future__ import annotations

import pytest

from app.customer_types.application.manage_customer_types import (
    change_customer_type_icon,
    create_customer_type,
    delete_customer_type,
    get_customer_type,
    list_customer_types,
    rename_customer_type,
)
from app.customer_types.domain.customer_type import (
    CustomerType,
    CustomerTypeIcon,
    CustomerTypeInUse,
    CustomerTypeName,
    CustomerTypeNotFound,
    IconUnknown,
    NameBlank,
    NameTaken,
)


class FakeTransaction:
    def __init__(self) -> None:
        self.commits = 0

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        raise AssertionError("no use case here rolls back")


class FakeCustomers:
    """Customers per type id; `joins_during_delete` simulates one joining after the count."""

    def __init__(self, counts: dict[int, int] | None = None) -> None:
        self.counts = counts or {}
        self.joins_during_delete: int | None = None

    def count(self, type_id: int) -> int:
        return self.counts.get(type_id, 0)


class FakeTypes:
    def __init__(self, customers: FakeCustomers | None = None) -> None:
        self.stored: dict[int, CustomerType] = {}
        self.customers = customers or FakeCustomers()
        self._next = 1

    def list(self) -> list[CustomerType]:
        return list(self.stored.values())

    def by_id(self, type_id: int) -> CustomerType | None:
        return self.stored.get(type_id)

    def by_key(self, key: str) -> CustomerType | None:
        return next((t for t in self.stored.values() if t.name.key == key), None)

    def add(self, customer_type: CustomerType) -> CustomerType:
        customer_type.id = self._next
        self._next += 1
        self.stored[customer_type.id] = customer_type
        return customer_type

    def save(self, customer_type: CustomerType) -> CustomerType:
        assert customer_type.id is not None
        self.stored[customer_type.id] = customer_type
        return customer_type

    def delete_unused(self, type_id: int) -> bool:
        if self.customers.joins_during_delete is not None:
            self.customers.counts[type_id] = self.customers.joins_during_delete
        if self.customers.count(type_id) > 0:
            return False
        del self.stored[type_id]
        return True


def test_creating_a_type_stores_it_with_the_default_icon_and_commits_once() -> None:
    types, transaction = FakeTypes(), FakeTransaction()

    created = create_customer_type(types, transaction, "  Mayorista ")

    assert (created.name.value, created.icon, created.is_vip) == (
        "Mayorista",
        CustomerTypeIcon.CIRCLE,
        False,
    )
    assert types.by_id(created.id or 0) is created
    assert transaction.commits == 1


def test_creating_a_type_takes_the_icon_it_is_given() -> None:
    created = create_customer_type(FakeTypes(), FakeTransaction(), "Fiel", "heart")

    assert created.icon is CustomerTypeIcon.HEART


def test_a_refused_creation_stores_nothing_and_commits_nothing() -> None:
    types, transaction = FakeTypes(), FakeTransaction()
    create_customer_type(types, transaction, "Fiel")

    for name, icon, refusal in (
        ("   ", None, NameBlank),
        ("fiel", None, NameTaken),
        ("  FIEL ", None, NameTaken),
        ("Otro", "flame", IconUnknown),
    ):
        with pytest.raises(refusal):
            create_customer_type(types, transaction, name, icon)

    assert [t.name.value for t in list_customer_types(types)] == ["Fiel"]
    assert transaction.commits == 1


def test_renaming_keeps_the_icon_and_may_change_only_the_case() -> None:
    types, transaction = FakeTypes(), FakeTransaction()
    created = create_customer_type(types, transaction, "fiel", "crown")
    assert created.id is not None

    renamed = rename_customer_type(types, transaction, created.id, "FIEL")

    assert (renamed.name.value, renamed.icon) == ("FIEL", CustomerTypeIcon.CROWN)
    assert transaction.commits == 2


def test_renaming_to_the_name_of_another_type_is_refused() -> None:
    types, transaction = FakeTypes(), FakeTransaction()
    create_customer_type(types, transaction, "Fiel")
    other = create_customer_type(types, transaction, "Regular")
    assert other.id is not None

    with pytest.raises(NameTaken):
        rename_customer_type(types, transaction, other.id, " fiel")

    assert types.by_id(other.id) is other
    assert other.name.value == "Regular"
    assert transaction.commits == 2


def test_changing_the_icon_keeps_the_name_and_an_unknown_key_is_refused() -> None:
    types, transaction = FakeTypes(), FakeTransaction()
    created = create_customer_type(types, transaction, "Fiel")
    assert created.id is not None

    changed = change_customer_type_icon(types, transaction, created.id, "bell")
    with pytest.raises(IconUnknown):
        change_customer_type_icon(types, transaction, created.id, "flame")

    assert (changed.name.value, changed.icon) == ("Fiel", CustomerTypeIcon.BELL)
    assert transaction.commits == 2


def test_a_type_that_does_not_exist_is_not_found_by_every_use_case() -> None:
    types, transaction = FakeTypes(), FakeTransaction()

    for call in (
        lambda: get_customer_type(types, 9),
        lambda: rename_customer_type(types, transaction, 9, "Nuevo"),
        lambda: change_customer_type_icon(types, transaction, 9, "star"),
        lambda: delete_customer_type(types, FakeCustomers(), transaction, 9),
    ):
        with pytest.raises(CustomerTypeNotFound) as refused:
            call()
        assert refused.value.code == "customer_type.not_found"

    assert transaction.commits == 0


def test_deleting_an_empty_type_removes_it_and_commits_once() -> None:
    types, transaction = FakeTypes(), FakeTransaction()
    created = create_customer_type(types, transaction, "Fiel")
    assert created.id is not None

    delete_customer_type(types, FakeCustomers(), transaction, created.id)

    assert types.list() == []
    assert transaction.commits == 2


def test_deleting_a_type_with_customers_is_refused_with_their_count() -> None:
    customers = FakeCustomers()
    types, transaction = FakeTypes(customers), FakeTransaction()
    created = create_customer_type(types, transaction, "Fiel")
    assert created.id is not None
    customers.counts[created.id] = 3

    with pytest.raises(CustomerTypeInUse) as refused:
        delete_customer_type(types, customers, transaction, created.id)

    assert refused.value.count == 3
    assert types.by_id(created.id) is created
    assert transaction.commits == 1


def test_a_customer_joining_after_the_count_still_stops_the_delete() -> None:
    customers = FakeCustomers()
    types, transaction = FakeTypes(customers), FakeTransaction()
    created = create_customer_type(types, transaction, "Fiel")
    assert created.id is not None
    customers.joins_during_delete = 1

    with pytest.raises(CustomerTypeInUse) as refused:
        delete_customer_type(types, customers, transaction, created.id)

    assert refused.value.count == 1
    assert types.by_id(created.id) is created
    assert transaction.commits == 1


def test_the_vip_type_is_deleted_by_the_same_rule_once_it_has_no_customers() -> None:
    customers = FakeCustomers()
    types, transaction = FakeTypes(customers), FakeTransaction()
    vip = types.add(CustomerType(CustomerTypeName("VIP"), CustomerTypeIcon.STAR, is_vip=True))
    assert vip.id is not None
    customers.counts[vip.id] = 2

    with pytest.raises(CustomerTypeInUse):
        delete_customer_type(types, customers, transaction, vip.id)
    customers.counts[vip.id] = 0
    delete_customer_type(types, customers, transaction, vip.id)

    assert types.list() == []
