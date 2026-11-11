---
status: superseded by 0085
date: 2026-11-10
---

# A phone number with a listed country code follows that country's rule, and the rules live in one shared table

Part of GH-318 (Phone country). Decided by the Tech Lead; the owner chose the eight countries on 2026-11-07.

## Decision

- **One table.** `app/shared/phone_country.py` holds a frozen `PhoneCountry` enum (AR, UY, CL, PY, BR, MX, ES, US) and a `PhoneCountryRule` table: calling code, national lengths, trunk prefix and, for AR, the mobile "9" and the "15". No other module repeats a code or a length. The customers domain imports it (`domain/` may import `app/shared`), accounts validates the code against it, and the API returns the options from it.
- **Only `of` and `optional` apply a rule.** `PhoneNumber.of(raw, country)` and `PhoneNumber.optional(raw, country)` take a `PhoneCountry | None` with no default. The constructor keeps its lenient canonical check (`+`, 8 to 15 digits, no leading 0, the `+54` → `+549` rule), so a stored number that fits no rule still loads.
- **A "+" with a listed code follows that country's rule**, whatever the business's country. The eight calling codes (1, 34, 52, 54, 55, 56, 595, 598) are prefix-free, so the match is unambiguous. Any other code is accepted as written: "+" and 8 to 15 digits.
- **Idempotent.** Every rule's output maps to itself under every country setting and under none.
- **Mexico drops the old mobile "1"**: `+52 1` and 10 digits, and `521` and 10 digits typed without "+", are stored as `+52` and 10 digits.
- **The column** is `business.default_phone_country`, an ISO 3166-1 alpha-2 code or null. Accounts owns it; customers read it through their own `PhoneCountryReader` Protocol (ADR-0055). The Spreadsheet import passes the Argentine rule explicitly.
- **An unchanged value is kept**: `edit_customer` compares the request's string with the stored value before normalising, and keeps it when equal.

- **Length only.** The seven new rules check the length of the national number and no leading digit, like AR. Lengths: UY 8 (trunk 0), CL 9, PY 8 to 9 (trunk 0), BR 10 or 11 (trunk 0, and a 2-digit carrier code dropped when 12 or 13 digits remain), MX 10, ES 9, US 10 (trunk 1), from the ITU-T E.164 national numbering plans.
- **Order for digits typed without "+" and with a country**: international if they start with the country's calling code and have one of its international lengths; otherwise drop the trunk prefix and require a national length. A property test per country shows that a string that reads both ways gives one stored value.
- **Two refusal codes.** `customer.phone_needs_country_code` only for a number without "+" when the business has no country; every other failure is `customer.phone_invalid`.

## Consequences

- A number already stored never changes; only numbers typed from now on follow the rules.
- `+1` followed by anything but 10 digits is now refused; it used to be accepted as written.
- A new country is one row in the table and its domain tests.
