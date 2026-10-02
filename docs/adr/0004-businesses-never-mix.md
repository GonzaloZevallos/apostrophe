---
status: accepted
date: 2026-10-02
---

# Businesses never mix: the business comes from the session and every row carries it

One installation keeps several sellers' businesses: customers with their phone numbers,
what they owe, sales, stock, money. A seller seeing another's data, or learning that
something of theirs exists, is the worst failure this product can have. It is also the
easiest one to introduce by accident: one query without a filter in any future task.

## Decision

- **The business is taken from the session**, never from the request. No route has a
  business in its path, query or body; an endpoint gets it from `CurrentBusinessId`.
  There is no number to change in a URL to reach another business.
- **A repository is constructed for one business** and filters every statement on it.
  To code above the repository, another business's records do not exist.
- **Another business's record answers 404**, the same as a record that does not exist,
  never 403.
- **Every table carries a non-null `business_id`** pointing at `business`, child tables
  included, even where a parent already implies it, so any row can be checked on its
  own. Only `business`, `invitation` and `login_guard` are exempt: they decide which
  business a request is for.
- **Three tests guard it**, and each new capability has to join them:
  - `tests/test_business_isolation.py` records one of everything in a business, then
    calls every gated route from another: by id must answer 404, lists must show none of
    it, and the first business still reads everything afterwards. A route without an
    example body or with an unseeded parameter fails. It was proven by removing one
    filter from the varieties repository: six routes failed.
  - `tests/migrations/test_business_ownership.py` fails for a table without the column.
  - `tests/test_gated_routes.py` fails for a route that answers without a session.

## Consequences

- Every capability pays a little: a `business_id` column per table, a seeder and example
  bodies in the sweep. That cost is the point; it makes forgetting visible.
- Nothing is shared across businesses: the same person buying from two sellers is two
  customers, one in each.

## Considered and rejected

- **The business in the URL with a permission check per route**: each route can forget
  its check, and a guessed id reveals that a business exists.
- **One database per business**: total isolation, but migrations, backups and the
  invitation flow multiply by the number of businesses for a handful of friends.
- **Row-level security in the database**: SQLite has none.
