---
status: accepted
date: 2026-10-25
---

# A shareable text is worked out in the front from facts the server sends

GH-322 part 1. A seller shares a sale with its customer (CONTEXT.md: Sale bill). This records where
the text comes from and how the facts reach the front.

## Decision

- **A closed structured bill, never display text.** `GET /sales/{id}` answers a new field, `bill`:
  business name, date, shipping charged, total, lines (product, quantity, amount, rule, unit price),
  payment (state, still owed) and balance. The models are `extra="forbid"`. The words around the facts
  and the unit wording are the front's (part 2), in its keyed copy module.
- **One `settle()` pass.** The bill rides in the detail. `OwingSales.settlement_of(customer_id)` runs
  one ledger read and one `settle()` and answers the balance and, per sale, the amount still owed
  (every sale not paid on the spot, a paid one at 0). The detail's `still_owing` and the bill both come
  from that one object, so they cannot disagree. A sale with no customer makes no settlement read.
  Sales still never imports `app.payments`: the port is wired on `app.state.owing_sales`.
- **Null on a broken invariant.** When the payment facts cannot be reconciled (paid on the spot yet
  reported as owed; no customer, not paid on the spot, total above $0; a customer's sale missing from
  settlement) `bill` is null and the rest of the detail is unchanged. The exception's message names the
  rule only, never an id, an amount or a name, and nothing is logged. A race between the sale read and
  the ledger read (no snapshot isolation under SQLite) lands on null, never on a wrong figure.
- **Cost.** The detail makes at most one extra statement, `SELECT name` by primary key, only for a sale
  whose payment facts reconcile. The settlement read replaces the detail's earlier `still_owing` read.

## Rejected

- **Server-built text with its own gettext catalog.** A second catalog for the same words the front
  already keys, and a text the server would have to keep in step with the screen.
- **A separate `/bill` route.** Two reads that can disagree about the same sale, and a fetch on tap
  breaks Copy over plain http, where the clipboard needs the click's own synchronous call.
