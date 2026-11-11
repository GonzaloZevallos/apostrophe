---
status: accepted
date: 2026-11-02
summary: "un rechazo puede llevar campos con nombre junto a su código"
---

# A refusal may carry named fields next to its code

Extends docs/adr/0008-refusals-carry-a-code-the-front-maps.md without amending it.

Epic GH-318, part 22. ADR-0008 says a refusal is answered as `{"detail", "code"}`. Deleting a
customer type that still has customers must also tell the seller how many, and the front shows
that number in its own text. The count is a fact of the rule, not a sentence, so it travels as a
field and never inside `detail`.

## Decision

- **A rule may expose fields.** An exception registered in a `TranslateErrors` may carry a
  `refusal_fields` mapping. `TranslateErrors` copies it into `Refused.fields`.
- **The handler adds them to the body.** `_refused` in `app/main.py` answers
  `{"detail": ..., "code": ..., **fields}`. A refusal with no fields is answered exactly as before.
- **The first user is `customer_type.in_use`**, whose body carries `count`. The front reads the
  field and the code; it still never reads `detail`.

## Consequences

- A field name is part of the contract for its code: renaming it is a breaking change for the front.
- Field values are plain numbers or strings, never user-written text from another business.
