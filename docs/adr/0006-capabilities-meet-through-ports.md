---
status: accepted
date: 2026-10-02
---

# Capabilities meet through ports their caller declares, never by importing each other

Expenses needs a new business to start with four default categories, seeded the moment
the business opens. Opening a business is accounts' job (`accept_invitation`); the
defaults are expenses' data and expenses' domain rule (a name unique per business). One
of the two has to reach across the hexagon boundary.

## Decision

- **A hexagon's `domain/` and `application/` never import another hexagon.** Only their
  own package, `app.shared` and the standard library (plus what `application` already
  may not import: a framework, the database layer, an adapter). This is checked for
  every registered hexagon by `tests/architecture/hexagon.py`'s
  `domain-and-application-import-no-other-hexagon` rule.
- **Accounts declares the port, expenses implements it.** `BusinessOpening` lives in
  `app/accounts/application/ports.py`:

  ```python
  class BusinessOpening(Protocol):
      def opened(self, business_id: int) -> None: ...
  ```

  `accept_invitation` takes it as a keyword-only `opening` argument and calls
  `opening.opened(business_id)` only on the new-business branch, right after
  `add_business`, before its single `transaction.commit()` — so the defaults land in the
  same transaction that opens the business, or not at all. Accounts never imports
  `app.expenses`.
- **`app/main.py` is the composition root.** It is the one module allowed to know both
  hexagons: it assigns `app.state.business_opening` to `ExpenseCategoriesOpening`, a
  factory `Callable[[Session], BusinessOpening]` that builds the expenses adapter.
  `app/accounts/adapters/deps.py`'s `get_business_opening` reads that factory off
  `request.app.state` (the same pattern as `get_signer`) and builds it over the
  request's own `Session`, so it shares the request's transaction.
- **A domain event or a message bus was rejected.** Patterns go in when a problem the
  code has names them (CODING_STANDARDS §4). One listener, known at compile time, called
  once, synchronously, inside one transaction, is a port — a bus or an event stream
  would add indirection this task has no use for.

## Consequence

- `BusinessOpening` takes one implementation today. The next capability that also needs
  to seed something when a business opens turns `app.state.business_opening` into a
  composite of several `BusinessOpening`s in `app/main.py` — not a second keyword
  argument on `accept_invitation`, and not a second port.
- `accept_invitation` keeps its original nine positional parameters; `opening` is
  keyword-only, so every existing positional call site still reads the same, and a new
  caller cannot pass it by accident in the wrong slot.
- The rule is enforced only for hexagons listed in `HEXAGON_ROOTS`
  (`tests/architecture/test_architecture.py`). A capability that is not registered there
  is not covered; registering a hexagon the moment it is created is part of adding one
  (CODING_STANDARDS §1).
