---
status: accepted
date: 2026-11-25
summary: "un On-the-spot payment parcial existe solo como el Deposit de un Order y el Settlement arranca esa Sale en su total menos el Deposit; la cuenta muestra la Sale con su total completo seguida de una fila de Deposit (GH-1094, ya está en el código)"
---

# An on-the-spot payment may be partial only as an Order's Deposit, and Settlement starts its Sale at total minus it

GH-1083, parte 1. GH-1063 suma Orders con Deposit. Esta parte enseña a leer uno al
Settlement y a `SqlLedgers`; todavía nada lo registra, y toda Sale existente (monto en el
momento igual a su total) se lee igual que antes.

## Decisión

Hechos que ya están en el código, cada uno con su test en esta parte:

1. **Un On-the-spot payment parcial existe solo como el Deposit de un Order.** Un Sale
   común sigue pagándose por completo o quedando debiendo. `OwedSale` rechaza con un
   `ValueError` que dice solo la regla un monto en el momento menor que 0, mayor que el
   total, mayor que 0 sin medio, o un medio con monto 0 en una Sale con total; ningún
   mensaje lleva cifras, ids ni montos.
2. **El Settlement arranca esa Sale en su total menos el Deposit** (`opening_owed`). Un
   Deposit nunca cubre otra Sale ni una deuda más vieja. El Balance es la suma de lo que
   cada Sale debe al arrancar menos los Payments posteriores. `OwedSale.is_deposit` y
   `OwedSale.opening_owed` son los únicos lugares de `app/payments/` que comparan un monto
   en el momento con el total de una Sale para leerla; la validación de `OwedSale` los
   compara solo para rechazar un monto fuera de regla.
3. **Las cifras de deuda salen solo del Settlement**: Owing since, Total owed, Sales still
   owing y el Balance. El Owing since de una Sale con Deposit es la fecha de la propia Sale.
4. **El chequeo de `insert_later` es una segunda suma deliberada.** Se calcula en SQL con
   el mismo monto guardado: acepta exactamente el resto de una Sale con Deposit y rechaza
   una unidad mínima más, en las dos Money scales.
5. **Eliminar una Sale con Deposit elimina el Deposit con ella**, como a cualquier
   On-the-spot payment. Los Payments posteriores que habían cubierto el resto pasan a ser
   un Credit, con la regla de siempre.
6. **Cash y Money in cuentan un Deposit por su propio monto guardado**, en la fecha de la
   Sale, nunca por el total de la Sale.

## Decidido acá (la fila de Deposit de la cuenta, GH-1094, ya está en el código)

- La cuenta muestra la Sale con su total completo y enseguida una fila de Deposit que resta
  su monto, con la fecha de la Sale. Enmienda el punto 2 de
  `20261120-the-customer-account-is-a-ledger-walk-not-a-settlement-view.md` (ahí una Sale
  suma "0 si se pagó en el momento"). GH-1094 lo entregó: `account_of` suma el total de una Sale
  con Deposit y la fila de Deposit resta el monto, de modo que su fila más nueva sigue igual
  a `settle().balance`.
- `is_partial` de esa fila es un dato de posición del libro, como en una fila de Payment:
  dice si el saldo corrido después de ella sigue por encima de 0.
- `payment_state` lee el `still_owed` de una Sale con Deposit en 0..total-monto: 0 es Paid,
  más de 0 es Part-paid, nunca Unpaid.
- Ninguna parte puede registrar un Deposit antes de que esto entre.

## Todavía no está en el código

- `last_paid_method` (`app/sales/adapters/sql_suggestions.py`) saltea los Deposits. Lo
  entrega con su test la primera parte que registre un Deposit.

## Consecuencias

- `settle()` sigue siendo el único cálculo de deuda; el costo de la lectura no cambia.
- Una fila guardada a mano con un monto mayor que el total hace que la lectura de ese
  Customer falle con la regla; ningún camino del código produce una.
