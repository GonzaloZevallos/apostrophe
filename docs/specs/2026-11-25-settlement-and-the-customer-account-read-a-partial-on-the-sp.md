---
status: draft
---
## Goal

Enseñarle al Settlement y a la cuenta del Customer a leer un Deposit: un On-the-spot payment parcial que salda solo su propia Sale. Es la base de los Orders con Deposit de GH-1063. Sirve al vendedor que quiere ver la Sale con su total completo y el Deposit como su propio pago contra esa misma Sale, para saber siempre cuánto le debe ese Customer y desde cuándo. En esta parte nada registra un Deposit, ninguna pantalla cambia y toda Sale existente se lee exactamente como antes.

## Acceptance criteria

- Toda Sale cuyo monto en el momento es igual a su total se lee exactamente como antes: no cambian el Balance, el Owing since, el Settlement, el Payment state ni las filas de la cuenta. Los tests existentes pasan sin cambiar sus aserciones.
- `OwedSale` tiene `on_the_spot_amount: int = 0` y la propiedad `opening_owed` (el total menos ese monto). Conserva `on_the_spot_method` y ya no tiene `paid_on_the_spot`.
- `OwedSale.__post_init__` lanza `ValueError` cuando el monto es menor que 0, mayor que el total, o mayor que 0 sin medio. El mensaje dice solo la regla, sin dígitos, ids ni montos.
- `settle()` recorre toda Sale con `opening_owed > 0` y la arranca en `opening_owed`. El Balance es la suma de `opening_owed` de las Sales recorridas menos los Payments posteriores. El docstring está actualizado.
- Un Deposit nunca cubre otra Sale ni una deuda más vieja, y nunca crea un Credit por sí solo. Una Sale con Deposit cubierta por completo está Paid, con un resto está Part-paid, y su Owing since es la fecha de la propia Sale.
- `HowPaid` incluye `deposit`: con medio y monto igual al total es `paid`, con medio y monto menor que el total es `deposit`, y si no `owing` o `none`.
- `account_of` suma por cada Sale su total menos un monto en el momento completo. En una Sale con Deposit agrega enseguida un `DepositRow` congelado (date, running_balance, standing, sale_id, amount, method, is_partial, kind `deposit`). Ese `DepositRow` resta el monto, toma la fecha de la Sale, tiene `is_partial = running > 0`, nunca entra en `entries` y deja `ledger_key` sin cambios.
- `sql_ledgers.py` llena `on_the_spot_amount` con el monto escalado de la fila en el momento guardada, mediante `domain_amount` y sin recortarlo. Un monto bajado a mano se lee como Deposit, y uno subido a mano lanza la regla.
- `SaleRefOut.how_paid` incluye `deposit`. Un `DepositAccountRowOut` sin `payment_id` forma parte de la unión de filas de la cuenta.
- `tests/fixtures/openapi_snapshot.json` se regenera con la misma llamada `create_app(...).openapi()` que usa `tests/test_static_spa.py`, con `json.dumps(indent=2, sort_keys=True)` más un salto de línea final. Se corre el chequeo oasdiff del job de docs, y si reporta ERR el PR declara `Breaking-API:`.
- `tests/payments/test_account_ledger_shape.py` existe, con semillas fijas de `random` de la stdlib y dos oráculos escritos en el archivo. El oráculo del Settlement afirma `still_owed`, `still_owing`, `owing_since` y el Balance. El oráculo de la cuenta afirma que el último `running_balance` es sum(total) − sum(monto) − sum(posteriores) y que cada `DepositRow` queda en i+1 de su `SaleRow`.
- Los libros con nombre corren siempre: un Deposit cubierto por completo después; un Payment con fecha anterior a su Sale con Deposit; dos Sales con igual (fecha, recorded_at); Sales de $0 pagadas en el momento y debiendo.
- En `test_sql_payments_guard.py`, con un monto en el momento bajado a mano, `insert_later` acepta exactamente el resto y rechaza una unidad mínima más, en las Money scales 0 y 2.
- Un test fija que un monto en el momento bajado a mano llega a Cash y a Money in como ese monto, nunca como el total de la Sale.
- Existe el ADR `docs/adr/20261125-an-on-the-spot-payment-may-be-partial-only-as-an-orders-deposit-and-settlement-starts-its-sale-at-total-minus-it.md`, en español. Registra: el Deposit como única forma de On-the-spot payment parcial; el arranque de la Sale en el total menos el Deposit; la Sale con su total completo seguida de una fila de Deposit, como enmienda del ADR del ledger-walk del 2026-11-20; el chequeo de `insert_later` como segunda suma deliberada; `payment_state` en 0..total-monto; que `last_paid_method` saltea los Deposits; la regla de las cifras de deuda; la línea de la eliminación; y la línea de Cash y Money in.
- La adenda "Account order and running balance (GH-829)" de ADR-0012 tiene una línea sobre la fila de Deposit que apunta al ADR nuevo.
- `CONTEXT.md` tiene un bloque "Planned in GH-1063 (not yet in the code)" para Deposit y Order que apunta al ADR. La definición viva de On-the-spot payment no cambia.
- No hay cambios en `web/**`, `method_usage.py`, `payments_ledger.py`, `sql_payments.py`, `docs/architecture/**` ni `docs/api/**`. CI termina en `ci-ok`.

## Out of scope

- Registrar un Deposit o un Order. Eso es de partes posteriores de GH-1063 y GH-1083.
- Cualquier cambio en `web/**` (`contract.json` y `payments.ts` incluidos), y en `method_usage.py`, `payments_ledger.py` y `sql_payments.py`.
- Cómo se ven en pantalla una fila o un chip de Deposit.
- Cambiar en código que `last_paid_method` saltee los Deposits. Esta parte solo lo registra en el ADR.
- Pasar Deposit y Order al glosario vivo, y cambiar la definición de On-the-spot payment.
- Hacer commit de `docs/architecture/**` o `docs/api/**`.

## Decisions

- La adenda de ADR-0012 gana una línea sobre la fila de Deposit que apunta al ADR nuevo.
  - Reason: `payments.md` hace de esa adenda el único lugar con el orden de la cuenta, y una fila de Deposit en i+1 de su Sale es una regla de ese orden.
- Cash y Money in cuentan un Deposit por su monto guardado en la fecha de la Sale, sin código nuevo y con un test que lo fija. Si el test muestra que leen el total de la Sale, la parte se detiene y lo informa.
  - Reason: un Deposit es un Payment ya recibido, y el pedido prohíbe tocar `payments_ledger.py` y `sql_payments.py`.
- Eliminar una Sale con Deposit elimina su Deposit con ella, y lo que pagaron los Payments posteriores pasa a ser un Credit con la regla de siempre. Queda en una línea del ADR, sin test nuevo.
  - Reason: es la regla existente del On-the-spot payment, y todavía nada registra un Deposit.
- El ADR establece que el Settlement es el único lugar que calcula lo que debe una Sale con Deposit, para Owing since, Total owed, Sales still owing, Balance y Payment state.
  - Reason: así ninguna cifra de deuda se contradice con otra.
- Deposit y Order se agregan solo como términos planificados en `CONTEXT.md`, no al glosario vivo.
  - Reason: todavía no hay código que los registre, y esa es la convención de los bloques Planned.

## Risks

Que una Sale existente se lea distinto si `opening_owed` o el `how_paid` nuevo se calculan mal para el caso del monto igual al total. Lo cubren el criterio 1 y la suite existente.
Que oasdiff marque como quiebre el valor nuevo de `how_paid` y el tipo de fila nuevo, y un cliente estricto los rechace. En ese caso el PR declara `Breaking-API:`.
Que los totales de Cash y Money in lean el total de la Sale en lugar del monto guardado. En ese caso la parte se detiene sin tocar los archivos prohibidos.

## Screens

none

## Slices

### deposit-read-in-settlement-and-account

#### Acceptance criteria

- Toda Sale con monto en el momento igual a su total se lee exactamente como antes, y los tests existentes pasan sin cambiar sus aserciones.
- `settle()` arranca cada Sale en `opening_owed`, y `OwedSale` rechaza los montos inválidos con un mensaje que dice solo la regla.
- `account_of` pone un `DepositRow` en i+1 de su Sale, con la fecha de la Sale e `is_partial = running > 0`, fuera de `entries`.
- `sql_ledgers.py` lee el monto guardado sin recortarlo, y `schemas.py` expone `deposit` y `DepositAccountRowOut`, con el snapshot de OpenAPI regenerado.
- Pasan los oráculos de `test_account_ledger_shape.py`, el chequeo de `insert_later` en las dos escalas y el test de Cash y Money in.
- Están escritos el ADR nuevo, la línea en la adenda de ADR-0012 y el bloque Planned de `CONTEXT.md`, sin cambios en `web/**` ni en los archivos prohibidos.

#### Risks

- existing-sales-read-differently
- breaking-api-for-strict-clients
- cash-reads-sale-total