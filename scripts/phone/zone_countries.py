"""Generates the two files the phone country detection reads on the device
(docs/adr/0085): `web/src/phone/zoneCountries.json`, the listed country of every IANA time
zone of the eight, and `web/src/phone/listedCodes.json`, the listed codes in their order, and
`web/src/phone/servedCountries.json`, the code and calling code of each listed country as
`GET /phone-countries` serves them (the answer vitest stubs; the front writes no code by hand).

The zones come from the installed `tzdata` package (`zone1970.tab`, `zone.tab` as the
fallback), never from the operating system. Run it with `python -m scripts.phone.zone_countries`;
nobody edits the two JSON files by hand.
"""

from __future__ import annotations

import json
import sys
from collections.abc import Iterable, Mapping, Sequence
from importlib import resources
from pathlib import Path

from app.shared.phone_country import listed_countries

GENERATED_BY = "scripts/phone/zone_countries.py"
ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "web" / "src" / "phone"
ZONES_FILE = OUTPUT_DIR / "zoneCountries.json"
CODES_FILE = OUTPUT_DIR / "listedCodes.json"
SERVED_FILE = OUTPUT_DIR / "servedCountries.json"

# Names that tzdata keeps only as links and whose country the tab files do not carry. A name
# ending in "/*" stands for every link tzdata has under that folder.
ALIASES: Mapping[str, str] = {
    "America/Buenos_Aires": "AR",
    "America/Cordoba": "AR",
    "America/Catamarca": "AR",
    "America/Jujuy": "AR",
    "America/Mendoza": "AR",
    "America/Rosario": "AR",
    "US/*": "US",
    "Brazil/*": "BR",
    "Mexico/*": "MX",
    "Chile/Continental": "CL",
    "Chile/EasterIsland": "CL",
    "America/Fort_Wayne": "US",
    "America/Indianapolis": "US",
    "America/Louisville": "US",
    "Navajo": "US",
}


class AmbiguousZone(Exception):
    """A tab line that lists two or more of the eight countries, with no alias to decide."""

    def __init__(self, zone: str, first: str, second: str) -> None:
        super().__init__(f"{zone} lists both {first} and {second}; add it to the alias list")


def zones_of_tab(tab_text: str, listed: Sequence[str]) -> dict[str, str]:
    """Each zone of a tab file mapped to the first listed country of its line, in the order
    the line writes them. A zone with none of the listed countries is left out."""
    zones: dict[str, str] = {}
    for line in tab_text.splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        fields = line.split("\t")
        countries = [code for code in fields[0].split(",") if code in listed]
        zone = fields[2]
        if not countries:
            continue
        if len(countries) > 1 and zone not in aliased_names():
            raise AmbiguousZone(zone, countries[0], countries[1])
        zones[zone] = countries[0]
    return zones


def aliased_names() -> frozenset[str]:
    return frozenset(name for name in ALIASES if not name.endswith("/*"))


def link_names(zi_text: str) -> list[str]:
    """The names tzdata keeps as links (`L <target> <name>` lines of tzdata.zi)."""
    names: list[str] = []
    for line in zi_text.splitlines():
        parts = line.split()
        if len(parts) == 3 and parts[0] == "L":
            names.append(parts[2])
    return names


def alias_zones(links: Iterable[str], listed: Sequence[str]) -> dict[str, str]:
    """The alias list written out: each fixed name, and each link under a `folder/*` entry."""
    zones: dict[str, str] = {}
    for pattern, code in ALIASES.items():
        if code not in listed:
            continue
        if pattern.endswith("/*"):
            prefix = pattern[:-1]
            zones.update({name: code for name in links if name.startswith(prefix)})
        else:
            zones[pattern] = code
    return zones


def zone_countries(tab_text: str, zi_text: str, listed: Sequence[str]) -> dict[str, str]:
    """Every zone of the listed countries, aliases included, sorted by name."""
    zones = alias_zones(link_names(zi_text), listed)
    zones.update(zones_of_tab(tab_text, listed))
    return dict(sorted(zones.items()))


def render(document: Mapping[str, object]) -> str:
    return json.dumps(document, indent=2, ensure_ascii=False) + "\n"


def read_tzdata(name: str) -> str | None:
    resource = resources.files("tzdata.zoneinfo") / name
    return resource.read_text(encoding="utf-8") if resource.is_file() else None


def tab_text() -> str:
    text = read_tzdata("zone1970.tab")
    if text is None:
        text = read_tzdata("zone.tab")
    if text is None:
        raise FileNotFoundError("tzdata has neither zone1970.tab nor zone.tab")
    return text


def documents() -> dict[Path, str]:
    """The text of each generated file, by path."""
    listed = [country.value for country in listed_countries()]
    zones = zone_countries(tab_text(), read_tzdata("tzdata.zi") or "", listed)
    return {
        ZONES_FILE: render({"generated_by": GENERATED_BY, "zones": zones}),
        CODES_FILE: render({"generated_by": GENERATED_BY, "codes": listed}),
        SERVED_FILE: render(
            {
                "generated_by": GENERATED_BY,
                "countries": [
                    {"code": country.value, "calling_code": country.rule.calling_code}
                    for country in listed_countries()
                ],
            }
        ),
    }


def main() -> int:
    try:
        files = documents()
    except AmbiguousZone as refusal:
        print(refusal, file=sys.stderr)
        return 1
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for path, text in files.items():
        path.write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
