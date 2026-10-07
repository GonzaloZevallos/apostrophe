"""The wire shape of `/onboarding-progress` (docs/adr/0036). A step is named by a slug,
never by its number: the contract does not change if the order does. No answer carries an
amount, grams, token, phone number or customer name; a target is a variety's id and name."""

from __future__ import annotations

from typing import Final, Literal

from pydantic import BaseModel, Field

from app.onboarding.domain.progress import FINISH, Progress, Resume, StepState, Target
from app.onboarding.domain.steps import Step

StepSlug = Literal["variety", "stock", "header_footer", "bot", "partner", "categories"]

STEP_SLUGS: Final[dict[Step, StepSlug]] = {
    Step.VARIETY: "variety",
    Step.STOCK: "stock",
    Step.CATALOG_MESSAGE: "header_footer",
    Step.BOT: "bot",
    Step.PARTNER: "partner",
    Step.CATEGORIES: "categories",
}
STEP_BY_SLUG: Final[dict[str, Step]] = {slug: step for step, slug in STEP_SLUGS.items()}


class PassIn(BaseModel):
    """Both are plain text here: a step that cannot be passed, or a way that does not
    exist, is the domain's `onboarding.step_invalid`, not a validation error."""

    step: str
    as_: str = Field(alias="as")


class TargetOut(BaseModel):
    id: int
    name: str

    @classmethod
    def of(cls, target: Target | None) -> TargetOut | None:
        return None if target is None else cls(id=target.id, name=target.name)


class StepOut(BaseModel):
    step: StepSlug
    state: StepState


class ProgressOut(BaseModel):
    offered: bool
    over: bool
    count: int
    resume: StepSlug | Literal["finish"] | None
    steps: list[StepOut]
    can_skip_rest: bool
    varieties_count: int
    stock_entries_count: int
    price_target: TargetOut | None
    stock_target: TargetOut | None

    @classmethod
    def not_offered(cls) -> ProgressOut:
        return cls(
            offered=False,
            over=False,
            count=0,
            resume=None,
            steps=[],
            can_skip_rest=False,
            varieties_count=0,
            stock_entries_count=0,
            price_target=None,
            stock_target=None,
        )

    @classmethod
    def of(cls, progress: Progress | None) -> ProgressOut:
        if progress is None:
            return cls.not_offered()
        return cls(
            offered=True,
            over=progress.over,
            count=progress.count,
            resume=_resume(progress.resume),
            steps=[
                StepOut(step=STEP_SLUGS[item.step], state=item.state) for item in progress.steps
            ],
            can_skip_rest=progress.can_skip_rest,
            varieties_count=progress.varieties_count,
            stock_entries_count=progress.stock_entries_count,
            price_target=TargetOut.of(progress.price_target),
            stock_target=TargetOut.of(progress.stock_target),
        )


def _resume(resume: Resume) -> StepSlug | Literal["finish"] | None:
    if resume is None:
        return None
    if isinstance(resume, Step):
        return STEP_SLUGS[resume]
    return FINISH
