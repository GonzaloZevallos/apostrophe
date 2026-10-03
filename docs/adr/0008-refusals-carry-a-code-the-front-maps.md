---
status: accepted
date: 2026-10-02
---

# Refusals carry an explicit code and a kind; the front maps codes, never `detail`

The front (issue: Front v0) has to show every refusal in Rioplatense Spanish, on the right
field, without repeating a number or a name. The API answered only `detail`: an English
string from the domain, sometimes interpolating what was typed (`InvalidEmail` echoed
the email). A status alone cannot pick the copy: `POST /customers` answers 422 for a bad
phone, an empty name and a too-long name.

## Decision

- **Every exception a router's `TranslateErrors` registers carries `code: ClassVar[str]`**,
  namespaced by capability (`customer.phone_invalid`, `variety.name_taken`,
  `expense_category.in_use`, `account.email_invalid`, `grams.invalid`…). It is a plain
  string, so the domain still imports only the standard library, and renaming a class
  changes no contract.
- **`TranslateErrors` raises `Refused(HTTPException)`**, and a handler in `app/main.py`
  answers `{"detail": <unchanged>, "code": <code>}`. The app-wide 422 handler of
  ADR-0005 adds `"code": "RequestInvalid"`. `detail` stays for existing tests; the front
  never reads it.
- **`web/src/api/contract.json` is the contract between the two languages.** It holds
  `refusalCodes`, each with a kind (`refusal`, or `gone` for a code registered under
  404), and `frontSegments`, the front's top-level paths. A pytest checks that the codes
  of every registered class (subclasses walked) exist, are unique, equal the JSON's set
  and have the kind their status implies, and that no API path segment is a front
  segment.
- **`web/src/api/refusals.ts` is typed `Record<RefusalCode, Refusal>`** over the JSON, so
  a missing or stale code fails `tsc`. The front dispatches on the kind and maps the code
  to its field and Spanish text; an unknown code gets a generic line.
- `InvalidEmail` stops interpolating the address.

## Consequences

- A new refusal in any capability adds its code to the class and to `contract.json` in
  the same diff, or pytest fails.
- Old English messages, including varieties' `NameTaken(name)`, stay in `detail`
  (ADR-0005 allows them); no screen renders them.
- Bare `HTTPException`s outside `TranslateErrors` (`/varieties/{id}/current-price`'s 404,
  the 401) carry no code; the front does not call the first and handles the second as a
  session boundary.

## Considered and rejected

- **`code = type(exc).__name__`**: a class rename, a pure refactor, would silently change
  the API, and two capabilities' `NameTaken` would clash.
- **Mapping `detail` text or the status per route on the front**: a domain rewording
  breaks a screen silently, and 422s on one route cannot be told apart.
