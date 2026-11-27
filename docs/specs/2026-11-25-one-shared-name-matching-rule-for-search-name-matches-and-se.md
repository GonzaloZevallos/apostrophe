---
status: draft
---
## Goal

Give every name search in the product one shared matching rule and one shared ordering rule, in `app/shared/names.py`: `name_matches` and `search_order_key`. Move Customer search onto the matching rule, so a seller who half-remembers a customer (a name typed without accents, part of a name, or a phone number as they would dial it) finds the existing Customer and never creates the same person twice. The one visible change: `GET /api/customers?q=` returns no customers for a query that is not blank but folds to empty, so it no longer returns the whole list as if that were a result.

## Acceptance criteria

- `app/shared/names.py` has `name_matches(name, query)`. It is true only when the folded query is non-empty and contained in the folded name. A query that folds to empty, such as one made only of combining marks, matches nothing.
- `app/shared/names.py` has `search_order_key(name, query, id)`. It sorts names whose fold starts with the folded query first, then by folded name, then by id.
- `Customer.matches` uses `name_matches` for its name half, and no other module writes a second name-folding rule.
- The phone half of `Customer.matches` behaves exactly as before. One leading 0 of the typed digits is dropped. An empty digit run matches nothing. A customer with no phone gives false for the phone half. Non-contiguous digits do not match.
- A blank query (absent, `""` or only spaces) still returns every Customer of the session business.
- `GET /api/customers?q=` with a non-blank query that folds to empty returns an empty list.
- `find_customers` keeps ordering by folded name, then id. Customer search does not use `search_order_key`.
- `tests/search/test_matching.py` is a pytest table with these cases:
  - `jose` finds `José`;
  - a fragment from the middle of a word matches;
  - `011 5555` finds `+54 11 5555…`;
  - `(0)` matches no phone;
  - a customer with no phone is found by name only;
  - non-contiguous digits do not match;
  - combining marks only match nothing;
  - `search_order_key` puts names that start with the query first.
- One customers API case checks that the folded-empty query returns `[]`, and that `q` absent, `""` and only spaces still return every Customer, in folded-name order.
- Full pytest, `mypy --strict` and ruff are green, with nothing silenced.
- None of these is edited: `docs/api/**`, `docs/architecture/generated/**`, `decisiones.md`, `web/src/api/contract.json`.

## Out of scope

- The grouped search of GH-1059, its short-query rule (trimmed length 0 or 1, `#` alone, over 200 characters) and any caller of `search_order_key`. These belong to the later parts of GH-1059.
- Any "too short" rule for Customers search.
- Any change to phone matching.
- Any front-end change, new screen, new text or Copy module key.
- Generated docs and `web/src/api/contract.json`.

## Decisions

- A blank query (absent, `""` or only spaces) keeps listing every Customer. Only a non-blank query that folds to empty matches nothing.
  - Reason: the empty search box on Customers depends on the existing blank guard to show everyone. The job is only about stopping a non-empty query from looking like a result.
- The customers API case also covers the blank queries, not only the folded-empty one.
  - Reason: this pins the decision above, so moving the name half onto `name_matches` cannot empty the Customers list.
- Punctuation that survives folding is matched like any other text. No other "too short" rule is added in this part.
  - Reason: the short-query rule belongs to the grouped search in later parts of GH-1059. Adding one here would change Customers search beyond the settled scope.

## Risks

If `name_matches` folds differently from the current inline Customer name rule (case and accents), some names could stop matching, or newly match. The table and the existing customers suites must pass without loosening any assertion.

The blank guard has to run on the trimmed raw query before folding. Otherwise the empty search box would stop listing every Customer.

## Screens

none

## Slices

### shared-name-matching

#### Acceptance criteria

- `name_matches` and `search_order_key` exist in `app/shared/names.py` with the rules above, and `Customer.matches` uses `name_matches` for its name half while the phone half is unchanged.
- `GET /api/customers?q=` returns `[]` for a non-blank query that folds to empty. It returns every Customer for a blank query, ordered by folded name, then id.
- `tests/search/test_matching.py` and the customers API case pass, and full pytest, `mypy --strict` and ruff are green with nothing silenced.

#### Risks

- fold-drift
- blank-guard-regression