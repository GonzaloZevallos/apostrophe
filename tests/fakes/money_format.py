"""A `MoneyFormatReader` of one fixed answer, for a use case driven without a database."""

from app.shared.money import MoneyFormat


class WholeAmounts:
    """The format of every business today: a dollar sign and no decimals."""

    def current(self) -> MoneyFormat:
        return MoneyFormat(symbol="$", decimals=0)
