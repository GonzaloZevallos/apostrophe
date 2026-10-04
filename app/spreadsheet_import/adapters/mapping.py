"""Reads the mapping CSV (customer name -> phone number), the plan's own choice of
format: UTF-8, header `name,phone`.

No exception raised from here, and no `CellProblem` it builds, carries a line's
content: a bad header, a wrong column count or a duplicate name is located by line
number alone (the plan's invariant: a phone number is read only by this module and
passed only to customers' port, never into a problem or a report line).
"""

from __future__ import annotations

import csv
from pathlib import Path

from app.spreadsheet_import.adapters import layout
from app.spreadsheet_import.domain.rows import CellProblem, MappingEntry, ParsedMapping, SheetRef


def read_mapping(path: Path) -> ParsedMapping:
    entries: list[MappingEntry] = []
    problems: list[CellProblem] = []
    seen: set[str] = set()

    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        header = next(reader, None)
        if header is None or tuple(header) != layout.MAPPING_HEADER:
            return ParsedMapping(
                (),
                (
                    CellProblem(
                        SheetRef(layout.MAPPING_FILE, 1), "header", "mapping_header_invalid"
                    ),
                ),
            )

        while True:
            try:
                row = next(reader)
            except StopIteration:
                break
            except csv.Error:
                problems.append(
                    CellProblem(
                        SheetRef(layout.MAPPING_FILE, reader.line_num),
                        "row",
                        "mapping_malformed_row",
                    )
                )
                break

            line_number = reader.line_num
            if len(row) != 2:
                problems.append(
                    CellProblem(
                        SheetRef(layout.MAPPING_FILE, line_number), "row", "mapping_columns_invalid"
                    )
                )
                continue

            name = row[0].strip()
            phone = row[1].strip()
            if name in seen:
                problems.append(
                    CellProblem(
                        SheetRef(layout.MAPPING_FILE, line_number), "name", "mapping_duplicate_name"
                    )
                )
                continue
            seen.add(name)
            entries.append(MappingEntry(line_number, name, phone))

    return ParsedMapping(tuple(entries), tuple(problems))
