---
status: accepted
date: 2026-10-03
---

# Settlement is worked out on read by payments; recording guards the balance in one statement

Payments (docs/product/payments.md) settle what a customer's sales left owing, oldest
debt first, whatever the payment's date. The balance, owing since, sales still owing and
the total owed all follow from that settlement, and three other screens show it:
Clientes, Ventas and the customer's card. ADR-0007 left the `payment` table to a
payments hexagon. ADR-0009 and ADR-0010 set the never-frozen, computed-on-read shape for
cost of goods; settlement takes the same shape.

## Decision

- **`app/payments/` owns `payment`.** `PaymentRow` moves to
  `app/payments/adapters/tables.py` with no migration.
  - Two named expressions sit next to it: `LATER` (`sale_id IS NULL`) and
    `ON_THE_SPOT` (`sale_id IS NOT NULL`).
  - Sales' repository writes only on-the-spot rows, as part of the `Sale` aggregate.
  - Payments' repository inserts and deletes only `LATER` rows.
- **Nothing about a settlement is stored.**
  - One pure `settle()` in `app/payments/domain/` works out, from a customer's ledger:
    - which sale each later payment covers;
    - the balance and owing since;
    - the sales still owing.
  - An on-the-spot payment is matched to its own sale before the walk and never enters it.
  - The account is laid out from `settle()`'s result in `app/payments/domain/account.py`.
    Rows are ordered by `(date, sales before payments, recorded_at, id)`, and every row
    carries its own `running_balance`.
- **Other capabilities reach settlement only through ports they declare** (ADR-0006).
  - `Balances` is declared in customers; `OwingSales` is declared in sales.
  - Both are implemented by one payments adapter over one loader, and wired as factories
    in `app/main.py`.
  - `GET /payments/debtors` answers Te deben's rows together with its totals.
- **The API answers the sign, as `standing`** (`owes`, `credit` or `settled`), derived
  only by `standing_of`. The front never compares an amount to decide a label.
- **Above the balance is refused twice.**
  - The domain refuses first, over `settle()`'s balance, with the readable error.
  - The repository then inserts with one guarded `INSERT … SELECT … WHERE amount <=
    bought − paid`. Shipping and line totals are summed in separate subqueries.
  - SQLite serialises writers, so two partners paying at once cannot create a credit.
    The loser is refused, or gets a busy error shown as the generic retry.
- **The preview and the record share one function**, `settle_candidate`, so
  preview = stored by construction.

## Consequences

- Every read of a balance replays the customer's whole history: O(sales + payments) of
  the business for Clientes and Te deben, and the same over the page's customers for
  Ventas. We revisit if a measurement misses 300 ms.
- The guard's plain sum is a second statement of the balance. A repository test over real
  SQLite keeps it equal to `settle()`'s figure.
- Deleting a sale or a payment changes which sale every later payment is shown against,
  and can leave a credit. Nothing needs rebuilding, because nothing is stored.

## Considered and rejected

- **Storing each payment's allocation**: every sale and payment write, two of them in
  sales, would have to rebuild it. A missed writer leaves balances quietly wrong.
- **Read the balance, then insert unconditionally**: under pysqlite's legacy mode the read
  runs outside any transaction, so two simultaneous payments both pass.
- **`BEGIN IMMEDIATE` for the record use case**: it changes how every session begins,
  which is wider than this task.
- **Raw balances with the sign tested in the front**: five call sites, each with its own
  `>` or `>=`.
