"""Business logo use cases (CONTEXT.md: Business logo).

The repository is already scoped to one business; a use case never names it. A use case
that writes commits once, at its end; reads and refusals never commit and nothing rolls
back, because every refusal comes before the first write.
"""

from typing import NoReturn, Protocol

from app.business_logo.domain.business_logo import BusinessLogo, LogoNotFound
from app.shared.transaction import Transaction


class BusinessLogoRepository(Protocol):
    def get(self) -> BusinessLogo | None: ...

    def save(self, logo: BusinessLogo) -> None:
        """Inserts the logo, or replaces the one the business already has."""
        ...

    def delete(self) -> bool:
        """True when a logo was removed, False when there was none."""
        ...


def _not_found() -> NoReturn:
    raise LogoNotFound()


def read_logo(logos: BusinessLogoRepository) -> BusinessLogo:
    logo = logos.get()
    if logo is None:
        _not_found()
    return logo


def upload_logo(logos: BusinessLogoRepository, tx: Transaction, data: bytes) -> BusinessLogo:
    logo = BusinessLogo.from_bytes(data)
    logos.save(logo)
    tx.commit()
    return logo


def remove_logo(logos: BusinessLogoRepository, tx: Transaction) -> None:
    if not logos.delete():
        _not_found()
    tx.commit()
