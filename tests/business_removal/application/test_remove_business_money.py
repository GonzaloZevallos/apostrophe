"""`remove_business` and the business's money storage (docs/adr/0058): the `{scale,
decimals}` it reads is stated in the document written, and a business whose money
cannot be read is neither exported nor deleted. The use case runs over fakes, as in
`test_remove_business.py`."""

from __future__ import annotations

from app.business_removal.application.remove_business import remove_business
from app.business_removal.domain.export_document import ExportedMoney
from tests.business_removal.application.test_remove_business import (
    BUSINESS,
    EMAIL,
    FAILED_MESSAGE,
    FakeConfirm,
    FakeExportFile,
    FakeOutput,
    FakeSchemaRows,
    FakeTransaction,
    _clock,
    _rows,
    _schema,
)
from tests.business_removal.english_words import english_words
from tests.business_removal.money_fakes import FakeMoneyFormat


def _run(
    schema_rows: FakeSchemaRows,
    money: FakeMoneyFormat,
    export_file: FakeExportFile,
    transaction: FakeTransaction,
    output: FakeOutput,
) -> int:
    return remove_business(
        schema_rows,
        export_file,
        FakeConfirm("La Huerta\n"),
        transaction,
        output,
        english_words(),
        _clock,
        EMAIL,
        money_format=money,
    )


def test_the_document_states_the_money_read_for_the_business_beside_its_tables() -> None:
    money = FakeMoneyFormat(ExportedMoney(scale=2, decimals=0))
    export_file = FakeExportFile()

    result = _run(
        FakeSchemaRows(_schema(), BUSINESS, _rows()),
        money,
        export_file,
        FakeTransaction(),
        FakeOutput(),
    )

    assert result == 0
    assert money.read_for == [BUSINESS.id]
    assert export_file.written is not None
    document = export_file.written[1]
    assert document["money"] == {"scale": 2, "decimals": 0}
    assert list(document) == ["business", "exported_at", "money", "kinds"]


def test_a_business_without_a_money_format_is_neither_exported_nor_deleted() -> None:
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows())
    export_file = FakeExportFile()
    transaction = FakeTransaction()
    output = FakeOutput()

    result = _run(schema_rows, FakeMoneyFormat(missing=True), export_file, transaction, output)

    assert result == 1
    assert output.lines[-1] == FAILED_MESSAGE
    assert export_file.written is None
    assert export_file.exists is False
    assert schema_rows.delete_calls == []
    assert transaction.committed is False
    assert transaction.rolled_back is True
