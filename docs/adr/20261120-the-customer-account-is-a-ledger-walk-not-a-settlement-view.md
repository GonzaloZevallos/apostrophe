---
status: accepted
date: 2026-11-20
summary: "la cuenta del cliente es un recorrido plano del libro: una fila por Sale y una por cada Payment posterior, ordenadas por ledger_key; una fila puede quedar bajo cero sin ser un Credit guardado; is_partial se calcula solo en account_of()"
---

# The customer account is a ledger walk, not a Settlement view

GH-829, parte 1 de 2. Reemplaza solo el punto de la cuenta de ADR-0012 (la cuenta se
armaba desde el resultado de `settle()`, con una fila por split y una fila `credit`).

## Decisión

1. **Una fila por Sale y una por cada Payment posterior**, ordenadas por `ledger_key`
   (`app/payments/domain/account.py`): `(date, recorded_at, 0 para Sale / 1 para Payment, id)`.
   Es la única ordenación de la cuenta; ni el router, ni los schemas, ni el script, ni el
   navegador reordenan filas.
2. **Una Sale suma su total** (0 si se pagó en el momento) y **un Payment resta su monto
   completo**, sin importar qué Sales liquida.
3. **El saldo corrido de una fila puede quedar bajo cero** (un Payment fechado antes de su
   Sale, o registrado antes de una Sale del mismo día). Su `standing` es entonces `credit`
   y la pantalla dice "In your favor", pero no es un Credit guardado.
4. **`settle()` decide solo** el Balance, Owing since, `standing` de la cuenta y el
   `applied_to` de registrar y previsualizar un pago. La fila más nueva siempre es igual a
   `settle().balance`, porque ambos suman los mismos deltas.
5. **`is_partial`** (saldo corrido > 0 después del Payment) se calcula solo en
   `account_of()`. El navegador nunca compara un monto: el punto de `standing` de ADR-0012
   sigue en pie.

## Consecuencias

- `GET /api/customers/{id}/account` pierde `applied_to` en las filas de pago y la clase de
  fila `credit`, y gana `number` en las filas de Sale e `is_partial` en las de Payment
  (Breaking-API). `AppliedToOut`, `Split` y las respuestas de registrar y previsualizar no
  cambian.
- El costo es una pasada sobre las Sales y Payments de un Customer, con un ordenamiento
  O(n log n).
