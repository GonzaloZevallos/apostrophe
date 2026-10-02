---
status: accepted
date: 2026-10-02
---

# No request data in error answers or logs: 422 without `input`, no access log

Customers bring phone numbers and names into the product (docs/product/customers.md), and
CODING_STANDARDS section 9 forbids personal data in error messages and logs. Two defaults
of the stack broke that before any customer code ran: FastAPI's 422 answers with the
`input` of each validation error (a body missing its phone echoes the name), and
uvicorn's access log writes every request line, so `GET /customers?q=…` would log part
of a name or a number on every keystroke of a search.

## Decision

- **One app-wide `RequestValidationError` handler** in `app/main.py` answers 422 with
  `detail` as a list of `{loc, type, msg}` and drops `input`, `ctx` and `url`, for every
  route of every capability.
- **Schemas stay bare** (`str`, `bool`, enums): no pydantic length or pattern
  constraints, so every rule is the domain's and its message is a fixed string.
- **Exceptions that reach an answer carry no data**: fixed messages, no constructor
  arguments that name a number or a name. A database error is translated outside the
  `except` block, so nothing of the driver's message stays reachable on the exception
  chain.
- **`scripts/serve.sh` runs uvicorn with `--no-access-log`**; `tests/test_serve_script.py`
  fails if the flag goes away. Uvicorn's error log stays on.

## Consequences

- No request line is logged for any route. Nothing read them; a capability that wants
  request logging later says what and where in its plan, under section 9.
- 422 bodies across the product changed shape (no `input`); no test read it.
- Varieties keep `NameTaken(name)`, which interpolates the variety name: a variety name
  is not personal data. Two error shapes live side by side; the customers one is the
  shape for anything personal.

## Considered and rejected

- **`POST /customers/search` with the query in the body**: keeps the access log but
  breaks the PRD's one list, one query, and leaves the search out of the isolation
  sweep's list checks.
- **Pydantic constraints on the schemas**: their errors echo the input and split rules
  between the edge and the domain.
