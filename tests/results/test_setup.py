"""`app/results/domain/setup.py::setup_view` (CODING_STANDARDS section 5: domain unit
test, no infrastructure). PRD "Setup checklist", "Bot notice" and "Businesses that
exist when this ships": one pure function decides the checklist, the bot notice and
whether "gone" must be stored."""

from dataclasses import replace

from app.results.domain.setup import SetupFacts, StoredSetup, setup_view

NOTHING_STORED = StoredSetup(checklist_gone=False, bot_notice_dismissed=False)
NEW_BUSINESS = SetupFacts(
    priced_today=False,
    has_stock_entry=False,
    has_sale=False,
    ever_published=False,
    has_partner=False,
)
SET_UP = replace(NEW_BUSINESS, priced_today=True, has_stock_entry=True)


def test_a_new_business_sees_the_checklist_and_no_notice() -> None:
    view = setup_view(NOTHING_STORED, NEW_BUSINESS)

    assert view.checklist is not None
    assert [(s.step, s.done, s.required) for s in view.checklist] == [
        ("priced_variety", False, True),
        ("stock_entry", False, True),
        ("bot_published", False, False),
        ("partner", False, False),
    ]
    assert view.bot_notice is False
    assert view.mark_gone is False


def test_an_imported_business_on_its_first_open_has_no_checklist_and_sees_the_notice() -> None:
    view = setup_view(NOTHING_STORED, replace(SET_UP, has_sale=True))

    assert view.checklist is None
    assert view.bot_notice is True
    assert view.mark_gone is True


def test_both_required_steps_true_and_the_notice_dismissed_shows_nothing() -> None:
    stored = StoredSetup(checklist_gone=False, bot_notice_dismissed=True)

    view = setup_view(stored, SET_UP)

    assert (view.checklist, view.bot_notice) == (None, False)
    assert view.mark_gone is True


def test_a_stored_gone_stays_gone_after_the_price_is_deleted() -> None:
    stored = StoredSetup(checklist_gone=True, bot_notice_dismissed=False)

    view = setup_view(stored, replace(NEW_BUSINESS, has_stock_entry=True))

    assert view.checklist is None
    assert view.priced_today is False
    assert view.bot_notice is True
    assert view.mark_gone is False


def test_a_dismissal_while_the_checklist_still_shows_leaves_the_checklist_only() -> None:
    stored = StoredSetup(checklist_gone=False, bot_notice_dismissed=True)

    view = setup_view(stored, replace(NEW_BUSINESS, has_sale=True))

    assert view.checklist is not None
    assert view.bot_notice is False


def test_stock_without_a_price_shows_the_checklist_with_stock_done_and_no_notice() -> None:
    view = setup_view(NOTHING_STORED, replace(NEW_BUSINESS, has_stock_entry=True))

    assert view.checklist is not None
    done = {s.step: s.done for s in view.checklist}
    assert done == {
        "priced_variety": False,
        "stock_entry": True,
        "bot_published": False,
        "partner": False,
    }
    assert view.bot_notice is False


def test_each_step_is_done_exactly_when_its_own_fact_is_true() -> None:
    facts = replace(NEW_BUSINESS, priced_today=True, ever_published=True, has_partner=True)

    view = setup_view(NOTHING_STORED, facts)

    assert view.checklist is not None
    assert {s.step: s.done for s in view.checklist} == {
        "priced_variety": True,
        "stock_entry": False,
        "bot_published": True,
        "partner": True,
    }
    assert view.priced_today is True


def test_the_notice_goes_once_the_catalog_has_been_published() -> None:
    view = setup_view(NOTHING_STORED, replace(SET_UP, ever_published=True))

    assert view.bot_notice is False


def test_a_set_up_business_with_no_sale_and_no_stock_entry_never_gets_the_notice() -> None:
    stored = StoredSetup(checklist_gone=True, bot_notice_dismissed=False)

    view = setup_view(stored, NEW_BUSINESS)

    assert view.bot_notice is False


def test_each_optional_step_follows_its_own_fact_not_the_other() -> None:
    published_only = setup_view(NOTHING_STORED, replace(NEW_BUSINESS, ever_published=True))
    partner_only = setup_view(NOTHING_STORED, replace(NEW_BUSINESS, has_partner=True))

    assert published_only.checklist is not None and partner_only.checklist is not None
    assert {s.step: s.done for s in published_only.checklist} == {
        "priced_variety": False,
        "stock_entry": False,
        "bot_published": True,
        "partner": False,
    }
    assert {s.step: s.done for s in partner_only.checklist} == {
        "priced_variety": False,
        "stock_entry": False,
        "bot_published": False,
        "partner": True,
    }


def test_each_required_step_follows_its_own_fact_not_the_other() -> None:
    priced_only = setup_view(NOTHING_STORED, replace(NEW_BUSINESS, priced_today=True))
    stocked_only = setup_view(NOTHING_STORED, replace(NEW_BUSINESS, has_stock_entry=True))

    assert priced_only.checklist is not None and stocked_only.checklist is not None
    assert [(s.step, s.done) for s in priced_only.checklist[:2]] == [
        ("priced_variety", True),
        ("stock_entry", False),
    ]
    assert [(s.step, s.done) for s in stocked_only.checklist[:2]] == [
        ("priced_variety", False),
        ("stock_entry", True),
    ]
