"""The wire shape of `GET /first-run` (docs/adr/0046): which first-run element Inicio
shows, the checklist's steps when it is the checklist, whether the after-import notice
shows, and whether nothing qualifies for the catalog. No answer carries an amount, grams,
token, phone number or name."""

from __future__ import annotations

from pydantic import BaseModel

from app.onboarding.application.read_first_run import FirstRunRead
from app.onboarding.domain.first_run import FirstRunKind, StepName


class ChecklistStepOut(BaseModel):
    step: StepName
    required: bool
    done: bool


class FirstRunOut(BaseModel):
    kind: FirstRunKind
    checklist: list[ChecklistStepOut] | None
    import_notice: bool
    nothing_qualifies: bool

    @classmethod
    def of(cls, read: FirstRunRead) -> FirstRunOut:
        decision = read.decision
        return cls(
            kind=decision.kind,
            checklist=(
                None
                if decision.checklist is None
                else [
                    ChecklistStepOut(step=item.step, required=item.required, done=item.done)
                    for item in decision.checklist
                ]
            ),
            import_notice=decision.import_notice,
            nothing_qualifies=read.nothing_qualifies,
        )
