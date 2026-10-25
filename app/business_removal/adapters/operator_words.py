"""`OperatorWords` over the operator's translator (docs/adr/0050 and its amendment):
exactly one `text(key, ...)` call per method, one key per printed line shape."""

from __future__ import annotations

from app.shared.copy import OperatorText


class TranslatedOperatorWords:
    def __init__(self, text: OperatorText) -> None:
        self._text = text

    def no_business(self) -> str:
        return self._text("operator.removal.no_business")

    def confirmation_failed(self) -> str:
        return self._text("operator.removal.confirmation_failed")

    def interrupted(self) -> str:
        return self._text("operator.removal.interrupted")

    def busy(self) -> str:
        return self._text("operator.removal.busy")

    def failed(self) -> str:
        return self._text("operator.removal.failed")

    def records_changed(self) -> str:
        return self._text("operator.removal.records_changed")

    def unknown_outcome(self, path: str) -> str:
        return self._text("operator.removal.unknown_outcome", path=path)

    def export_written(self, path: str) -> str:
        return self._text("operator.removal.export_written", path=path)

    def removed(self, path: str) -> str:
        return self._text("operator.removal.removed", path=path)

    def prompt(self, name: str) -> str:
        return self._text("operator.removal.prompt", name=name)

    def count_dry(self, table_name: str, count: str) -> str:
        return self._text("operator.removal.count_dry", table_name=table_name, count=count)

    def count_withheld_dry(self, table_name: str, count: str) -> str:
        return self._text("operator.removal.count_withheld_dry", table_name=table_name, count=count)

    def count_exported(self, table_name: str, exported: str) -> str:
        return self._text(
            "operator.removal.count_exported", table_name=table_name, exported=exported
        )

    def count_deleted(self, table_name: str, deleted: str) -> str:
        return self._text("operator.removal.count_deleted", table_name=table_name, deleted=deleted)

    def count_exported_deleted(self, table_name: str, exported: str, deleted: str) -> str:
        return self._text(
            "operator.removal.count_exported_deleted",
            table_name=table_name,
            exported=exported,
            deleted=deleted,
        )

    def unowned_tables(self, tables: str) -> str:
        return self._text("operator.removal.refusing_unowned", tables=tables)

    def secret_columns(self, columns: str) -> str:
        return self._text("operator.removal.refusing_secret", columns=columns)

    def other_type_columns(self, columns: str) -> str:
        return self._text("operator.removal.refusing_other_type", columns=columns)

    def unlabelled_tables(self, tables: str) -> str:
        return self._text("operator.removal.refusing_unlabelled", tables=tables)

    def delete_order_cycle(self, tables: str) -> str:
        return self._text("operator.removal.refusing_cycle", tables=tables)
