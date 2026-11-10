from __future__ import annotations

from typing import ClassVar


class PaymentMethodRuleBroken(ValueError):
    """A rule of a payment method was broken; answers 422."""

    code: ClassVar[str] = "payment_method.rule_broken"


class NameRequired(PaymentMethodRuleBroken):
    code: ClassVar[str] = "payment_method.name_required"


class NameTooLong(PaymentMethodRuleBroken):
    code: ClassVar[str] = "payment_method.name_too_long"


class PaymentMethodNotFound(LookupError):
    code: ClassVar[str] = "payment_method.not_found"

    def __init__(self) -> None:
        super().__init__("no such payment method")


class NameTaken(ValueError):
    code: ClassVar[str] = "payment_method.name_taken"

    def __init__(self) -> None:
        super().__init__("an offered payment method already has that name")


class NameTakenArchived(ValueError):
    code: ClassVar[str] = "payment_method.name_taken_archived"

    def __init__(self) -> None:
        super().__init__("an archived payment method already has that name")


class LastOffered(ValueError):
    code: ClassVar[str] = "payment_method.last_offered"

    def __init__(self) -> None:
        super().__init__("the business needs at least one offered payment method")


class InUse(ValueError):
    code: ClassVar[str] = "payment_method.in_use"

    def __init__(self) -> None:
        super().__init__("the payment method has payments and can only be archived")
