---
status: draft
---
## Goal

Every Customer API response gains `phone_local`. It holds the Customer's phone number in its national form, grouped by its own listed country's template, together with that country's code. It is null when no national form exists. This part (1 of 3 of GH-1067) supplies the data for a later Edit customer screen. That screen will show the phone the way the seller would type it in its own country, with the country already selected, so a digit can be changed or left alone without the number turning into another or being rejected as taken. The server stays the only place that groups a number.

## Acceptance criteria

- `app/shared/phone_country.py` has `national_grouped(digits: str) -> tuple[PhoneCountry, str] | None` next to `grouped()`. Both share one factored lookup (`listed_country_of`), one mobile-nine step and one `groupings` template step. Standard library only.
- `national_grouped("5491155550101")` returns `(AR, "11 5555-0101")`. The text has no `+<code> ` lead and no Argentine mobile nine.
- `national_grouped` returns None exactly when `grouped()` falls back to the stored value: an unlisted code, AR without its mobile nine, or a length with no template.
- `PhoneNumber.national` in `app/customers/domain/customer.py` wraps `national_grouped`.
- A domain test, parametrised over `listed_countries()`, checks each country's `example`. `national` equals (that country, the grouped text), and `PhoneNumber.of(national.text, country).value` equals the stored value.
- A domain test shows that an unlisted `+` number and an AR number without its mobile nine both give None.
- A domain test shows that removing spaces and dashes from `national.text` gives the stored national digits.
- `PhoneLocalOut{country: str, text: str}` exists. `CustomerOut.phone_local: PhoneLocalOut | None` is filled in `CustomerOut.of` next to `phone_display`, and is null with no phone or when `national` is None.
- TestClient: list and detail carry `phone_local` for an AR number, and null for an unlisted `+` number and for a Customer with no phone. Register and edit return it through the same assembly.
- Drift guard: for every code `GET /phone-countries` returns, a Customer registered with that country's example has `phone_local.country` equal to that code.
- TestClient: PATCH of a Customer with its own number typed nationally (`"11 5555-0101"`, `phone_country: "AR"`) answers 200, leaves `phone` at the stored value and is never `customer.phone_taken`. Skip it only if an existing test already checks exactly that.
- `tests/contract_nullable.py` has `"phone_local": ShapeOf("customer", "phone_local")` under both `customer` and `customer-no-phone`.
- Web fixtures:
  - `web/src/api/fixtures/customer.json` has `"phone_local": {"country": "AR", "text": "11 2233-4455"}`;
  - `web/src/api/fixtures/customer-no-phone.json` has `"phone_local": null`.
- `tests/fixtures/openapi_snapshot.json` is regenerated with the repo's own regeneration, and `web/src/api/contract.json` too if it is generated from the schema. No file under `docs/api/**` is committed.
- `phone` and `phone_display` are unchanged, and no existing field is removed or renamed.
- The contract shape tests, the full pytest suite, mypy --strict and ruff pass.

## Out of scope

- Any screen. Edit customer using `phone_local` is a later part of GH-1067.
- How Edit customer shows a number with no national form. The existing rules cover it: a number starting with `+` locks the Phone country by its own code, and an untouched number is kept as stored without reading a country.
- Changing `phone`, `phone_display`, the write rules, uniqueness or any stored number.
- Grouping a number in the front.
- Growing the list of eight countries.

## Decisions

- `phone_local.country` is the same code that `GET /phone-countries` returns (e.g. `AR`).
  - Reason: the country table is the only list of countries, and the drift guard compares exactly these codes.
- The national text only adds spaces and dashes, and a test checks this.
  - Reason: the display grouping already follows this rule (customers.md, criterion 25), and the national form comes from the same template.
- Round-trip edge cases do not change the null rule. A stored number whose national part starts with its country's long-distance prefix, or an AR national part starting with `15`, keeps `phone_local` exactly as `national_grouped` gives it.
  - Reason: the request fixes None to exactly the cases where `grouped()` falls back. Only the screen part can act on these cases, and it relies on an untouched number never being sent.

## Risks

- Some stored numbers might not read back to the same value from their national text, such as a national part starting with its country's long-distance prefix or an AR national part starting with `15`. The tests over each country's example would not catch this. The later screen part depends on Edit customer never sending an untouched number.
- A regeneration of the OpenAPI snapshot or the contract done by hand could drift from the schema.

## Screens

none

## Slices

### phone-local-in-customer-responses

#### Acceptance criteria

- `national_grouped` and `grouped()` share one factored lookup, mobile-nine step and template step. `national_grouped("5491155550101")` gives `(AR, "11 5555-0101")`, and it gives None exactly where `grouped()` falls back.
- `PhoneNumber.national` round-trips for every listed country's example. An unlisted `+` number and AR without the mobile nine give None.
- List, detail, register and edit carry `phone_local` (`{country, text}` or null) through `CustomerOut.of`. The drift guard passes for every code of `GET /phone-countries`.
- A PATCH with the Customer's own number typed nationally answers 200 and is never `customer.phone_taken`.
- The contract surface is updated: nullable shapes, both web fixtures, and the regenerated OpenAPI snapshot. Nothing under `docs/api/**` is committed. Contract shape tests, pytest, mypy --strict and ruff pass.

#### Risks

- round-trip-edge-numbers
- hand-edited-snapshot