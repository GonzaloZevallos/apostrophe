"""The payment-method use cases over the real `SqlPaymentMethods` on a fresh, migrated
in-memory SQLite database (docs/adr/0001). Two businesses are opened by hand."""

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.payment_methods.adapters.sql_payment_methods import SqlPaymentMethods
from app.payment_methods.application.manage_methods import (
    Direction,
    add_method,
    archive_method,
    change_icon,
    delete_method,
    get_method,
    list_archived_methods,
    list_methods,
    move_method,
    open_default_methods,
    rename_method,
    restore_method,
)
from app.payment_methods.domain.method import (
    LastActivePaymentMethod,
    PaymentMethodIcon,
    PaymentMethodName,
    PaymentMethodNameEmpty,
    PaymentMethodNameTaken,
    PaymentMethodNameTooLong,
    PaymentMethodNotFound,
    PaymentMethodSeed,
)

NOW = datetime(2026, 10, 2, 18, 0, tzinfo=UTC)
MINE = 1
OTHER = 2


@pytest.fixture
def session() -> Iterator[Session]:
    engine: Engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    with Session(engine) as session:
        for business in (MINE, OTHER):
            session.execute(
                text("INSERT INTO business (id, name, language) VALUES (:i, :n, 'en')"),
                {"i": business, "n": f"Business {business}"},
            )
        session.commit()
        yield session
    engine.dispose()


@pytest.fixture
def methods(session: Session) -> SqlPaymentMethods:
    return SqlPaymentMethods(session, MINE)


def _names(methods: SqlPaymentMethods) -> list[str]:
    return [method.name.value for method in list_methods(methods)]


def _seed(methods: SqlPaymentMethods, session: Session, *names: str) -> list[int]:
    ids = []
    for name in names:
        added = add_method(methods, session, name, PaymentMethodIcon.DEFAULT)
        assert added.id is not None
        ids.append(added.id)
    return ids


def test_methods_are_listed_in_the_order_they_were_added(
    methods: SqlPaymentMethods, session: Session
) -> None:
    _seed(methods, session, "Cash", "Transfer", "Mercado Pago")

    assert _names(methods) == ["Cash", "Transfer", "Mercado Pago"]


def test_an_added_method_keeps_its_icon_and_defaults_to_generic(
    methods: SqlPaymentMethods, session: Session
) -> None:
    add_method(methods, session, "Wallet app", PaymentMethodIcon.WALLET)
    add_method(methods, session, "Other", PaymentMethodIcon.DEFAULT)

    assert [m.icon for m in list_methods(methods)] == [
        PaymentMethodIcon.WALLET,
        PaymentMethodIcon.GENERIC,
    ]


@pytest.mark.parametrize("duplicate", ["cash", "  CASH ", "c a s h"])
def test_a_name_that_differs_only_in_case_or_spaces_is_taken(
    methods: SqlPaymentMethods, session: Session, duplicate: str
) -> None:
    _seed(methods, session, "Cash", "Transfer")

    with pytest.raises(PaymentMethodNameTaken):
        add_method(methods, session, duplicate, PaymentMethodIcon.DEFAULT)

    assert _names(methods) == ["Cash", "Transfer"]


def test_an_archived_method_still_reserves_its_name(
    methods: SqlPaymentMethods, session: Session
) -> None:
    cash, _ = _seed(methods, session, "Cash", "Transfer")
    transfer = list_methods(methods)[1].id
    assert transfer is not None
    archive_method(methods, session, cash, NOW)

    with pytest.raises(PaymentMethodNameTaken):
        add_method(methods, session, "cash", PaymentMethodIcon.DEFAULT)
    with pytest.raises(PaymentMethodNameTaken):
        rename_method(methods, session, transfer, "CASH")


def test_a_name_of_forty_one_characters_or_no_characters_is_refused(
    methods: SqlPaymentMethods, session: Session
) -> None:
    with pytest.raises(PaymentMethodNameTooLong):
        add_method(methods, session, "a" * 41, PaymentMethodIcon.DEFAULT)
    with pytest.raises(PaymentMethodNameEmpty):
        add_method(methods, session, "  ", PaymentMethodIcon.DEFAULT)
    assert list_methods(methods) == []


def test_a_rename_and_an_icon_change_keep_the_id_and_the_position(
    methods: SqlPaymentMethods, session: Session
) -> None:
    cash, transfer = _seed(methods, session, "Cash", "Transfer")

    rename_method(methods, session, transfer, "Bank transfer")
    change_icon(methods, session, transfer, PaymentMethodIcon.BANK)

    stored = get_method(methods, transfer)
    assert (stored.id, stored.name.value, stored.icon) == (
        transfer,
        "Bank transfer",
        PaymentMethodIcon.BANK,
    )
    assert [m.id for m in list_methods(methods)] == [cash, transfer]


def test_a_method_can_be_renamed_to_its_own_name_in_another_case(
    methods: SqlPaymentMethods, session: Session
) -> None:
    (cash,) = _seed(methods, session, "Cash")

    rename_method(methods, session, cash, "CASH")

    assert _names(methods) == ["CASH"]


def test_move_swaps_a_method_with_its_neighbour_and_does_nothing_at_an_edge(
    methods: SqlPaymentMethods, session: Session
) -> None:
    a, b, c = _seed(methods, session, "A", "B", "C")

    move_method(methods, session, c, Direction.UP)
    assert _names(methods) == ["A", "C", "B"]
    move_method(methods, session, a, Direction.DOWN)
    assert _names(methods) == ["C", "A", "B"]
    move_method(methods, session, c, Direction.UP)
    move_method(methods, session, b, Direction.DOWN)
    assert _names(methods) == ["C", "A", "B"]
    move_method(methods, session, b, Direction.UP)
    move_method(methods, session, b, Direction.UP)
    assert _names(methods) == ["B", "C", "A"]
    assert {a, b, c} == {m.id for m in list_methods(methods)}


def test_move_skips_an_archived_method_between_two_active_ones(
    methods: SqlPaymentMethods, session: Session
) -> None:
    _, b, c = _seed(methods, session, "A", "B", "C")
    archive_method(methods, session, b, NOW)

    move_method(methods, session, c, Direction.UP)
    assert _names(methods) == ["C", "A"]
    restore_method(methods, session, b)
    # B kept the position it had; A and C swapped around it.
    assert _names(methods) == ["C", "B", "A"]


def test_archive_hides_a_method_and_restore_brings_it_back_to_its_old_position(
    methods: SqlPaymentMethods, session: Session
) -> None:
    _, b, _ = _seed(methods, session, "A", "B", "C")

    archive_method(methods, session, b, NOW)
    assert _names(methods) == ["A", "C"]
    assert [m.name.value for m in list_archived_methods(methods)] == ["B"]
    assert get_method(methods, b).archived is True

    restore_method(methods, session, b)
    assert _names(methods) == ["A", "B", "C"]
    assert list_archived_methods(methods) == []


def test_the_last_active_method_can_be_neither_archived_nor_deleted(
    methods: SqlPaymentMethods, session: Session
) -> None:
    cash, transfer = _seed(methods, session, "Cash", "Transfer")
    archive_method(methods, session, transfer, NOW)

    with pytest.raises(LastActivePaymentMethod):
        archive_method(methods, session, cash, NOW)
    with pytest.raises(LastActivePaymentMethod):
        delete_method(methods, session, cash)

    assert _names(methods) == ["Cash"]


def test_archiving_twice_is_not_an_error(methods: SqlPaymentMethods, session: Session) -> None:
    cash, _ = _seed(methods, session, "Cash", "Transfer")

    archive_method(methods, session, cash, NOW)
    archive_method(methods, session, cash, NOW)

    assert _names(methods) == ["Transfer"]


def test_delete_removes_a_method_for_good_and_frees_its_name(
    methods: SqlPaymentMethods, session: Session
) -> None:
    cash, _ = _seed(methods, session, "Cash", "Transfer")

    delete_method(methods, session, cash)

    assert _names(methods) == ["Transfer"]
    with pytest.raises(PaymentMethodNotFound):
        get_method(methods, cash)
    add_method(methods, session, "Cash", PaymentMethodIcon.COINS)
    assert _names(methods) == ["Transfer", "Cash"]


def test_an_archived_method_can_be_deleted_while_one_active_method_remains(
    methods: SqlPaymentMethods, session: Session
) -> None:
    cash, transfer = _seed(methods, session, "Cash", "Transfer")
    archive_method(methods, session, cash, NOW)

    delete_method(methods, session, cash)

    assert [m.id for m in list_methods(methods)] == [transfer]
    assert list_archived_methods(methods) == []


def test_another_business_methods_are_not_found_and_stay_untouched(
    methods: SqlPaymentMethods, session: Session
) -> None:
    theirs_repo = SqlPaymentMethods(session, OTHER)
    theirs, _ = _seed(theirs_repo, session, "Their cash", "Their transfer")
    _seed(methods, session, "Cash", "Transfer")

    with pytest.raises(PaymentMethodNotFound):
        get_method(methods, theirs)
    with pytest.raises(PaymentMethodNotFound):
        rename_method(methods, session, theirs, "Mine now")
    with pytest.raises(PaymentMethodNotFound):
        change_icon(methods, session, theirs, PaymentMethodIcon.CARD)
    with pytest.raises(PaymentMethodNotFound):
        move_method(methods, session, theirs, Direction.DOWN)
    with pytest.raises(PaymentMethodNotFound):
        archive_method(methods, session, theirs, NOW)
    with pytest.raises(PaymentMethodNotFound):
        restore_method(methods, session, theirs)
    with pytest.raises(PaymentMethodNotFound):
        delete_method(methods, session, theirs)

    assert _names(theirs_repo) == ["Their cash", "Their transfer"]
    assert _names(methods) == ["Cash", "Transfer"]


def test_two_businesses_may_use_the_same_name(methods: SqlPaymentMethods, session: Session) -> None:
    _seed(methods, session, "Cash")
    _seed(SqlPaymentMethods(session, OTHER), session, "Cash")

    assert _names(methods) == ["Cash"]


def test_opening_a_business_adds_the_seeds_in_order_without_committing(
    methods: SqlPaymentMethods, session: Session
) -> None:
    open_default_methods(
        methods,
        (
            PaymentMethodSeed(PaymentMethodName.of("Cash"), PaymentMethodIcon.COINS),
            PaymentMethodSeed(PaymentMethodName.of("Transfer"), PaymentMethodIcon.BANK),
        ),
    )
    assert [(m.name.value, m.icon) for m in list_methods(methods)] == [
        ("Cash", PaymentMethodIcon.COINS),
        ("Transfer", PaymentMethodIcon.BANK),
    ]

    session.rollback()

    assert list_methods(methods) == []
