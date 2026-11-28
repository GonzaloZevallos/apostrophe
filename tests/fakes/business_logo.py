"""An in-memory `BusinessLogoRepository`: one business, one slot."""

from app.business_logo.domain.business_logo import BusinessLogo


class InMemoryBusinessLogoRepository:
    def __init__(self, logo: BusinessLogo | None = None) -> None:
        self.logo = logo

    def get(self) -> BusinessLogo | None:
        return self.logo

    def save(self, logo: BusinessLogo) -> None:
        self.logo = logo

    def delete(self) -> bool:
        removed = self.logo is not None
        self.logo = None
        return removed
