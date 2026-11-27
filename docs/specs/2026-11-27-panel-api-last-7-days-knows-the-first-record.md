---
status: draft
---
## Goal

La lectura del Panel (`/panel`) entrega `last_7_days` sabiendo dónde empieza la historia del Business. Así, el gráfico del teléfono de una parte posterior de GH-320 puede mostrar las Sales de cada uno de los últimos 7 días sin inventar un $0 antes del First record y sin dibujar una serie de un solo punto. Es para el vendedor que abre Home en el teléfono y quiere saber si la semana va bien. Esta parte es solo backend.

## Acceptance criteria

- `read_panel` conserva el `first_record` que `scan` ya devuelve. No se agrega ninguna lectura, y la prueba de cantidad de sentencias del Panel no cambia su constante.
- `last_7_days` es `null` cuando el Business no tiene ningún registro, según un test HTTP.
- `last_7_days` es `null` cuando el First record es hoy, es decir, cuando solo hoy tiene historia, según un test HTTP.
- `today_series.last_7_days` devuelve `None` cuando el First record es posterior a hoy, según un test de dominio.
- Cuando el First record es anterior a hoy, `last_7_days` tiene 7 elementos, del más antiguo a hoy.
- Cada día anterior al First record trae `sales: null`, según un test HTTP.
- Cada día desde el First record trae su monto, 0 incluido cuando no hubo ventas.
- El elemento de hoy es exactamente igual a "You sold today" (`today.sales`) del mismo Panel, según un test HTTP.
- `DaySales.sales` es `int | None`, y el schema del Panel admite `null` para `sales` y para todo `last_7_days`.
- Se actualizan a la forma nueva las aserciones de forma de `/panel` en `tests/test_business_isolation.py`, los tests del Panel y `web/src/api/fixtures/panel.json`.
- La serie se calcula en un módulo de dominio a partir de los mismos day buckets que "You sold today". Ningún adaptador, assembler ni código del front la recalcula.
- No se agrega ninguna entrada a `web/src/mobile-standard/offenders/*.json`.
- `docs/product/results.md` describe la regla nueva y ya no dice "siempre 7 días, con 0 en un día sin ventas".

## Out of scope

- Cualquier gráfico o pantalla que muestre `last_7_days`, y cualquier texto del Copy module. Son de partes posteriores de GH-320.
- Cambiar cómo se calculan las Sales, el First record o los day buckets.
- Cambios en Week, Month, Money in, `low_stock`, `best_sellers` o `month_profit`.

## Decisions

- Cuando el First record es posterior a hoy, todo `last_7_days` es `null`.
  - Reason: una Sale puede tener fecha futura, y la regla aplicada tal cual daría 7 días nulos, una serie sin ningún punto. Esto contradice el criterio de no dibujar una serie vacía ni de un solo punto.
- Cuando `last_7_days` está presente, el elemento de hoy nunca es `null`.
  - Reason: el campo solo está cuando el First record es anterior a hoy, y el criterio exige que hoy sea igual a "You sold today".

## Risks

- Hoy el front lee `sales` como número. Que pase a admitir `null` podría romper un tipo del front que use la fixture. Se cubre actualizando `panel.json` y el tipo en el mismo cambio.
- Si el First record no se compara en el mismo corte de día que los buckets, un día del borde podría quedar mal marcado como nulo o como 0.

## Screens

none

## Slices

### panel-last-7-days-first-record

#### Acceptance criteria

- `last_7_days` es `null` sin registros y con el First record hoy, según tests HTTP, y con el First record posterior a hoy, según un test de dominio.
- Los días anteriores al First record traen `sales: null`, y los demás su monto, 0 incluido.
- El elemento de hoy es igual a "You sold today".
- `read_panel` usa el `first_record` de `scan` sin ninguna lectura nueva.
- `DaySales.sales` es `int | None`, el schema lo mapea, y las aserciones de aislamiento, los tests del Panel y `panel.json` siguen la forma nueva.
- `docs/product/results.md` describe la regla nueva.

#### Risks

- front-type-nullable-sales
- day-boundary-first-record