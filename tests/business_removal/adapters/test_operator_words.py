"""`TranslatedOperatorWords` (the declared seam): each method of the `OperatorWords`
port renders exactly one baseline line shape, through exactly one `OperatorText` call,
with its data passed on untouched; and between them the methods reach every removal
key of `en.baseline.json`."""

from __future__ import annotations

import inspect
import json
from pathlib import Path

from babel.support import Translations

from app.business_removal.adapters.operator_words import TranslatedOperatorWords
from app.business_removal.application.operator_words import OperatorWords
from app.shared.copy import OperatorText

BASELINE = Path(__file__).resolve().parents[3] / "app" / "shared" / "copy" / "en.baseline.json"


class RecordingText(OperatorText):
    def __init__(self) -> None:
        super().__init__(Translations())
        self.calls: list[tuple[str, dict[str, str]]] = []

    def __call__(self, key: str, **data: str) -> str:
        self.calls.append((key, data))
        return key


def port_methods() -> list[str]:
    return [
        name for name, _ in inspect.getmembers(OperatorWords, inspect.isfunction) if name[0] != "_"
    ]


def removal_keys() -> set[str]:
    entries: dict[str, object] = json.loads(BASELINE.read_text(encoding="utf-8"))
    return {key for key in entries if key.startswith("operator.removal.")}


def test_each_method_makes_exactly_one_text_call_with_a_baseline_removal_key() -> None:
    methods = port_methods()
    assert len(methods) == 20
    for name in methods:
        recorder = RecordingText()
        method = getattr(TranslatedOperatorWords(recorder), name)
        parameters = [p for p in inspect.signature(method).parameters]
        arguments = {p: f"<{p}>" for p in parameters}

        line = method(**arguments)

        assert len(recorder.calls) == 1, name
        key, data = recorder.calls[0]
        assert key in removal_keys(), name
        assert data == arguments, name
        assert line == key, name


def test_every_removal_baseline_key_is_reached_by_some_method() -> None:
    reached: set[str] = set()
    for name in port_methods():
        recorder = RecordingText()
        method = getattr(TranslatedOperatorWords(recorder), name)
        method(**{p: "x" for p in inspect.signature(method).parameters})
        reached.update(key for key, _ in recorder.calls)

    assert reached == removal_keys()


def test_the_check_rejects_a_method_that_makes_two_calls() -> None:
    class Twice(TranslatedOperatorWords):
        def busy(self) -> str:
            super().busy()
            return super().busy()

    recorder = RecordingText()
    Twice(recorder).busy()

    assert len(recorder.calls) == 2
