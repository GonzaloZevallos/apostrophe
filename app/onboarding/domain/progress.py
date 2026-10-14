"""`progress()` (CONTEXT.md: Onboarding): where a business stands in its Onboarding, worked
out on every read from read-only facts of the owners plus what the Onboarding stores
(docs/adr/0036). Pure and total: any facts and any stored state give an answer, and
`resume` is `None` exactly when the Onboarding is over, otherwise a step or `FINISH`.
Facts carry no amount, grams, token, phone number or customer name: a target is a
variety's id and name only."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final, Literal

from app.onboarding.domain.onboarding import Onboarding, Pass
from app.onboarding.domain.steps import OPTIONAL_STEPS, REQUIRED_STEPS, Step

FINISH: Final = "finish"
"""`resume` once every step is done or passed and the Onboarding has not ended."""

Resume = Step | Literal["finish"] | None

PARTNER_USER_COUNT = 2
"""A second user in the business is the partner step's data."""


class StepState(StrEnum):
    DONE = "done"
    SKIPPED = "skipped"
    PENDING = "pending"


@dataclass(frozen=True)
class VarietyFact:
    id: int
    name: str
    is_priced_today: bool


@dataclass(frozen=True)
class Facts:
    """What the owners say, read-only, for one business."""

    varieties: tuple[VarietyFact, ...]
    stocked_variety_ids: frozenset[int]
    stock_entries_count: int
    bot_saved: bool
    user_count: int


@dataclass(frozen=True)
class Target:
    id: int
    name: str


@dataclass(frozen=True)
class StepProgress:
    step: Step
    state: StepState


@dataclass(frozen=True)
class Progress:
    over: bool
    steps: tuple[StepProgress, ...]
    count: int
    resume: Resume
    can_skip_rest: bool
    varieties_count: int
    stock_entries_count: int
    price_target: Target | None
    stock_target: Target | None

    def state_of(self, step: Step) -> StepState:
        return next(item.state for item in self.steps if item.step == step)

    @property
    def required_steps_done(self) -> bool:
        return all(self.state_of(step) == StepState.DONE for step in REQUIRED_STEPS)

    @property
    def optional_steps_settled(self) -> bool:
        return all(self.state_of(step) != StepState.PENDING for step in OPTIONAL_STEPS)


def _by_pass(given: Pass | None) -> StepState:
    if given is Pass.DONE:
        return StepState.DONE
    if given is Pass.SKIPPED:
        return StepState.SKIPPED
    return StepState.PENDING


def _data_or_pass(has_data: bool, given: Pass | None) -> StepState:
    return StepState.DONE if has_data else _by_pass(given)


def _done_when(condition: bool) -> StepState:
    return StepState.DONE if condition else StepState.PENDING


def progress(facts: Facts, onboarding: Onboarding) -> Progress:
    priced = sorted((v for v in facts.varieties if v.is_priced_today), key=lambda v: v.id)
    unpriced = sorted((v for v in facts.varieties if not v.is_priced_today), key=lambda v: v.id)
    unstocked = [v for v in priced if v.id not in facts.stocked_variety_ids]

    states = {
        Step.VARIETY: _done_when(bool(priced)),
        Step.STOCK: _done_when(facts.stock_entries_count > 0),
        Step.CATALOG_MESSAGE: _by_pass(onboarding.header_footer),
        Step.BOT: _data_or_pass(facts.bot_saved, onboarding.bot),
        Step.PARTNER: _data_or_pass(facts.user_count >= PARTNER_USER_COUNT, onboarding.partner),
        Step.CATEGORIES: _by_pass(onboarding.categories),
    }
    over = onboarding.ended_at is not None
    first_pending = next((step for step in Step if states[step] == StepState.PENDING), None)
    resume: Resume = None if over else (FINISH if first_pending is None else first_pending)
    required_done = all(states[step] == StepState.DONE for step in REQUIRED_STEPS)

    return Progress(
        over=over,
        steps=tuple(StepProgress(step, states[step]) for step in Step),
        count=sum(1 for state in states.values() if state != StepState.PENDING),
        resume=resume,
        can_skip_rest=required_done and not over,
        varieties_count=len(facts.varieties),
        stock_entries_count=facts.stock_entries_count,
        price_target=_target(unpriced),
        stock_target=_target(unstocked),
    )


def _target(candidates: list[VarietyFact]) -> Target | None:
    return Target(candidates[0].id, candidates[0].name) if candidates else None
