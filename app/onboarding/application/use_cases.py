"""The Onboarding's use cases (CONTEXT.md: Onboarding). Each answers the same
`Progress` a read does. A use case that writes commits once, at its end, through the
`Transaction`; one that finds nothing to write commits nothing. The Onboarding ends only
here (and by the import's own ending): once both required facts are met, re-read in the
same session, and every optional step is done or passed. A write on an Onboarding that
is already over stores nothing."""

from __future__ import annotations

from datetime import datetime

from app.onboarding.application.facts import FactSources, read_facts
from app.onboarding.application.ports import Onboardings
from app.onboarding.domain.errors import OnboardingNotFound, RequiredStepsUnmet, StepInvalid
from app.onboarding.domain.onboarding import Onboarding, Pass
from app.onboarding.domain.progress import Facts, Progress, StepState, progress
from app.onboarding.domain.steps import OPTIONAL_STEPS, Step
from app.shared.transaction import Transaction


def read_progress(onboardings: Onboardings, sources: FactSources) -> Progress | None:
    """Never writes. `None` when the business is not offered an Onboarding."""
    onboarding = onboardings.get()
    if onboarding is None:
        return None
    return progress(read_facts(sources), onboarding)


def advance(
    onboardings: Onboardings, sources: FactSources, transaction: Transaction, now: datetime
) -> Progress:
    onboarding = _existing(onboardings)
    facts = read_facts(sources)
    if progress(facts, onboarding).over:
        return progress(facts, onboarding)
    return _settle(onboardings, onboarding, facts, transaction, now, wrote=False)


def record_pass(
    onboardings: Onboardings,
    sources: FactSources,
    transaction: Transaction,
    now: datetime,
    step: int,
    as_: str,
) -> Progress:
    optional_step = _optional_step(step)
    given = _given(as_)
    onboarding = _existing(onboardings)
    facts = read_facts(sources)
    if progress(facts, onboarding).over:
        return progress(facts, onboarding)
    onboarding.pass_step(optional_step, given)
    return _settle(onboardings, onboarding, facts, transaction, now, wrote=True)


def skip_rest(
    onboardings: Onboardings, sources: FactSources, transaction: Transaction, now: datetime
) -> Progress:
    onboarding = _existing(onboardings)
    facts = read_facts(sources)
    current = progress(facts, onboarding)
    if current.over:
        return current
    if not current.required_steps_done:
        raise RequiredStepsUnmet
    for step in OPTIONAL_STEPS:
        if current.state_of(step) == StepState.PENDING:
            onboarding.pass_step(step, Pass.SKIPPED)
    return _settle(onboardings, onboarding, facts, transaction, now, wrote=True)


def _settle(
    onboardings: Onboardings,
    onboarding: Onboarding,
    facts: Facts,
    transaction: Transaction,
    now: datetime,
    wrote: bool,
) -> Progress:
    """Ends the Onboarding when, with what was just written, both required facts are met
    and every optional step is done or passed. Saves and commits once, only if anything
    was written or ended."""
    result = progress(facts, onboarding)
    if result.required_steps_done and result.optional_steps_settled:
        onboarding.end(now)
        wrote = True
        result = progress(facts, onboarding)
    if wrote:
        onboardings.save(onboarding)
        transaction.commit()
    return result


def _existing(onboardings: Onboardings) -> Onboarding:
    onboarding = onboardings.get()
    if onboarding is None:
        raise OnboardingNotFound
    return onboarding


def _optional_step(step: int) -> Step:
    try:
        found = Step(step)
    except ValueError:
        raise StepInvalid from None
    if found not in OPTIONAL_STEPS:
        raise StepInvalid
    return found


def _given(as_: str) -> Pass:
    try:
        return Pass(as_)
    except ValueError:
        raise StepInvalid from None
