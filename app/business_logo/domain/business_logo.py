"""Business logo (CONTEXT.md: Business logo).

The image a Business owns: a PNG or JPEG of at most `MAX_LOGO_BYTES`. A `BusinessLogo`
is valid only when `__post_init__` holds, so a value that exists is a value that passed
the one rule, however it was built. Nothing decodes the image: the type is the leading
bytes and the size is the length, so a body that is only a signature is accepted.
Error messages are fixed text naming the rule, never bytes or sizes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

MAX_LOGO_BYTES = 1_048_576

SIGNATURES: dict[str, bytes] = {
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/jpeg": b"\xff\xd8\xff",
}


class WrongLogoType(ValueError):
    code: ClassVar[str] = "business_logo.wrong_type"

    def __init__(self) -> None:
        super().__init__("a business logo must be a PNG or JPEG image")


class LogoTooBig(ValueError):
    code: ClassVar[str] = "business_logo.too_big"

    def __init__(self) -> None:
        super().__init__("a business logo is bigger than the allowed size")


class LogoNotFound(LookupError):
    code: ClassVar[str] = "business_logo.not_found"

    def __init__(self) -> None:
        super().__init__("the business has no logo")


@dataclass(frozen=True)
class BusinessLogo:
    content_type: str
    data: bytes

    def __post_init__(self) -> None:
        if type(self.data) is not bytes:
            raise WrongLogoType()
        signature = SIGNATURES.get(self.content_type)
        if signature is None:
            raise WrongLogoType()
        if not self.data:
            raise WrongLogoType()
        if not self.data.startswith(signature):
            raise WrongLogoType()
        if len(self.data) > MAX_LOGO_BYTES:
            raise LogoTooBig()

    @classmethod
    def from_bytes(cls, data: bytes) -> BusinessLogo:
        for content_type, signature in SIGNATURES.items():
            if data.startswith(signature):
                return cls(content_type, data)
        raise WrongLogoType()
