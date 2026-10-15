"""The Onboarding's own domain errors (CODING_STANDARDS section 9): a message names the
rule broken, never data. Each carries its own `code`, never one inherited from a base,
so `tests/test_refusal_codes.py` finds each refusal exactly once."""

from typing import ClassVar


class StepInvalid(ValueError):
    """A pass for a step that cannot be passed, or given in a way that does not exist."""

    code: ClassVar[str] = "onboarding.step_invalid"

    def __init__(self) -> None:
        super().__init__("only an optional step can be passed, as done or skipped")


class RequiredStepsUnmet(ValueError):
    code: ClassVar[str] = "onboarding.required_steps_unmet"

    def __init__(self) -> None:
        super().__init__("the rest cannot be skipped before both required steps are done")


class OnboardingNotFound(LookupError):
    """The business is not offered an Onboarding: it has none to read or write."""

    code: ClassVar[str] = "onboarding.not_found"

    def __init__(self) -> None:
        super().__init__("the business has no Onboarding")
