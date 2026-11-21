---
status: accepted
date: 2026-10-03
summary: "la liquidación se calcula al leer; registrar un pago protege el saldo en una sola sentencia"
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
  - The account is laid out by `account_of()` in `app/payments/domain/account.py`. Its
    order and running-balance rules are in the addendum *Account order and running balance
    (GH-829)* below, which follows
    `20261120-the-customer-account-is-a-ledger-walk-not-a-settlement-view.md`.
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

## Account order and running balance (GH-829)

Addendum, 2026-11-21. Reúne en un solo lugar el orden de la cuenta del Customer y sus
reglas de saldo corrido, tal como las dejó la parte 1 de GH-829. Sigue a
`20261120-the-customer-account-is-a-ledger-walk-not-a-settlement-view.md`, no lo reabre, y
no agrega ninguna regla: cada una nombra el test o la función que la respalda.

- **La clave** es `(date, recorded_at, Sale antes que Payment, id)`. Es la misma de
  `ledger_key` en `app/payments/domain/account.py` y la del ADR del ledger walk.
  Respaldo: `test_ledger_key_is_date_then_recorded_at_then_sale_before_payment_then_id` y
  el test de propiedad `test_ledgers_in_any_order_keep_the_newest_row_equal_to_the_balance`.
- **Con `date` y `recorded_at` iguales, va primero el Sale.** Respaldo:
  `test_an_equal_date_and_recorded_at_tie_puts_the_sale_first_so_no_row_is_negative`.
- **Es un orden de ledger propio, no el orden del Settlement.** El orden del Settlement no
  cambia: Sales, después Payments, cada uno por fecha y luego por orden de registro; sigue
  decidiendo qué Sale paga cada Payment. En la cuenta, en cambio, un Payment fechado antes
  de su Sale va primero (`test_a_payment_dated_before_its_sale_is_a_negative_row_and_not_partial`).
  El orden del Settlement lo respaldan, en `tests/payments/test_settlement.py`,
  `test_owed_sales_on_the_same_date_are_taken_oldest_recorded_first` y
  `test_later_payments_on_the_same_date_are_applied_oldest_recorded_first`.
- **El running balance de la fila más nueva es siempre igual a `settle().balance`.**
  Respaldo: se afirma en cada caso de `tests/payments/test_account.py` y en el test de
  propiedad.
- **Una fila por cada Payment later, por su monto completo.** Sin partir entre Sales y sin
  fila de Credit: `AccountRow` es solo `SaleRow | PaymentRow`. Respaldo:
  `test_a_payment_covering_several_sales_is_still_one_row_with_its_full_amount` y
  `test_a_payment_beyond_every_debt_is_one_negative_row_in_credit`.
- **Un running balance bajo cero es un punto del ledger, no un Credit guardado.** La
  pantalla dice "In your favor" (`web/src/screens/clientes/ClienteFicha.test.tsx`).
- **`is_partial` es verdadero cuando el running balance tras el Payment es mayor que 0**, y
  falso en exactamente 0 y por debajo. Se calcula solo en `account_of()` y nunca se guarda.
  Respaldo: `test_partial_marks_above_zero_true_exactly_zero_and_below_false`.
- **`recorded_at` se fija una sola vez.** Asignarle un Customer a un Sale que no tenía no lo
  cambia: el repositorio actualiza solo `customer_id`
  (`test_a_sale_assigned_a_customer_later_keeps_its_place_in_the_account`). Un Payment
  borrado y vuelto a registrar es un Payment nuevo, con su propio `recorded_at` y su
  propio `id`: `record_payment()` en `app/payments/application/record_payment.py` lo
  inserta con `insert_later(..., recorded_at)`, y `insert_later` y `delete_later` son las
  únicas escrituras de `app/payments/adapters/sql_payments.py`, por lo que ningún camino
  actualiza el `recorded_at` de un Payment existente.
