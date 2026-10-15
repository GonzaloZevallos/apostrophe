"""An action is never drawn as a link (`icon-and-text-rule.md`): only a link-shaped control
(`.boton--enlace`, `.enlace`) may be underlined, whether by `text-decoration` or by the
design's 1 px bottom `box-shadow` underline.

It reads `web/src/styles/app.css` as text. jsdom does not compute the cascade, so the
real-browser half of this guard is `web/e2e/navigation.spec.ts` ("Nueva venta" ... no
underline), which asks the browser for the computed style.
"""

from __future__ import annotations

import re
from pathlib import Path

from tests.test_design_contrast import Rule, css_rules

APP_CSS = Path(__file__).resolve().parents[1] / "web" / "src" / "styles" / "app.css"

_LINK_CLASSES = (".boton--enlace", ".enlace")
_LAST_COMPOUND = re.compile(r"[^\s>+~]+$")
_ONE_PIXEL_UNDERLINE = re.compile(r"^0\s+1px\s+0(\s|$)")

# A selector allowed to underline although its last compound is not a link class, with
# the reason.
UNDERLINE_EXCEPTIONS: dict[str, str] = {
    ".nueva-venta__cliente-cambiar": (
        "text-only 'Cambiar' span inside the customer row of Nueva venta: a link's look on "
        "plain text, not a control drawn as an action"
    ),
}


def draws_underline(rule: Rule) -> bool:
    for name, value in rule.declarations:
        if name == "text-decoration" and "underline" in value:
            return True
        if name == "text-decoration-line" and "underline" in value:
            return True
        if name == "box-shadow" and any(
            _ONE_PIXEL_UNDERLINE.match(layer.strip()) for layer in value.split(",")
        ):
            return True
    return False


def is_link_selector(selector: str) -> bool:
    match = _LAST_COMPOUND.search(selector)
    compound = match.group(0) if match else selector
    return any(cls in compound for cls in _LINK_CLASSES)


def underline_offenders(rules: list[Rule]) -> list[str]:
    offenders: list[str] = []
    for rule in rules:
        if not draws_underline(rule):
            continue
        for selector in rule.selectors:
            if not is_link_selector(selector) and selector not in UNDERLINE_EXCEPTIONS:
                offenders.append(selector)
    return offenders


def base_boton_sets_no_decoration(rules: list[Rule]) -> bool:
    return any(
        rule.selectors == (".boton",) and ("text-decoration", "none") in rule.declarations
        for rule in rules
    )


def test_only_link_controls_draw_an_underline() -> None:
    assert underline_offenders(css_rules(APP_CSS.read_text())) == []


def test_the_base_boton_rule_sets_no_text_decoration() -> None:
    assert base_boton_sets_no_decoration(css_rules(APP_CSS.read_text()))


def test_the_guard_rejects_an_underlined_action() -> None:
    css = """
    .boton { text-decoration: underline; }
    .tarjeta .boton--enlace { box-shadow: 0 1px 0 var(--acento); }
    .pildora { box-shadow: 0 1px 0 var(--acento), inset 0 0 0 1px red; }
    @media (max-width: 10px) { .boton-nueva-venta:hover { text-decoration: underline; } }
    .ok { box-shadow: 0 2px 0 var(--tinta); }
    """
    assert underline_offenders(css_rules(css)) == [".boton", ".pildora", ".boton-nueva-venta:hover"]


def test_the_guard_rejects_a_base_boton_without_text_decoration_none() -> None:
    assert not base_boton_sets_no_decoration(css_rules(".boton { color: red; }"))
    assert not base_boton_sets_no_decoration(css_rules(".boton { text-decoration: underline; }"))
    assert base_boton_sets_no_decoration(css_rules(".boton { text-decoration: none; }"))
