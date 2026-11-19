---
status: accepted
date: 2026-11-19
summary: "las New sale suggestions son una lectura de solo ids: el último medio se elige antes de juzgar si está archivado, Most sold comparte la ventana de Days left, cada tabla se filtra por business_id y no hay índice nuevo"
---

# New sale suggestions are ids only, the last method is picked before it is judged, and Most sold shares the Days left window

GH-496, parte 1 de 14. Registra la lectura `GET /sales/suggestions?on=YYYY-MM-DD`, sin pantalla: la pantalla de New sale que la muestra llega en partes posteriores.

## Contexto

Para registrar una venta en el teléfono, la vendedora busca al cliente, recorre los productos y elige el medio de la lista completa cada vez. La nueva pantalla necesita tres atajos: los Customers a los que vendió más recientemente, los Products que más se vendieron en los últimos 30 días y el Payment method de la última venta pagada en el momento. Las sugerencias solo acortan elecciones: nunca fijan un precio, un monto ni una cantidad.

## Decisión

- **Solo ids.** La respuesta es `{recent_customer_ids, most_sold_product_ids, last_payment_method_id}`. Nunca un nombre, un precio ni un monto, y nunca un nombre de medio o un indicador de efectivo: el medio es un id.
- **El último medio se elige primero y se juzga después.** Se toma el pago en el momento (`payment.sale_id` no nulo) de la venta con el mayor Sale number, sea cual sea su fecha. Recién entonces el caso de uso devuelve `null` si el medio tiene `archived_at`. La consulta nunca filtra medios archivados y nunca cae a una venta o un medio más viejo. Una venta que quedó debiendo o de $0 no tiene pago en el momento, así que se saltea sola; no hay una segunda comprobación por total.
- **Most sold comparte la ventana de Days left.** `[on − 29, on]`, ambos extremos incluidos, sale de `trailing_window` y `DAYS_LEFT_WINDOW` en `app/shared/calendar.py`; ningún módulo de ventas escribe 29 ni 30, y ventas no importa `app.stock`. Se suma la cantidad (centésimas) de las líneas que no son Gift, de Products no archivados (los ocultos siguen), y se dejan afuera los que suman 0.
- **Desempate determinista.** Cantidad vendida de mayor a menor, después el `name_key` guardado y después el id del Product. Los empates ignoran mayúsculas pero no acentos, porque `name_key` solo pasa a minúsculas (`casefold`); ningún código recalcula la clave ni hay `lower()` en SQL.
- **Recent customers, un Customer una vez.** Cada Customer se ordena por su venta más reciente: la fecha más nueva y, dentro de esa fecha, el mayor Sale number. Nunca `MAX(number)` separado de la fecha: una venta cargada tarde con una fecha vieja y un número alto no adelanta a nadie. Las ventas sin Customer quedan afuera, y una venta a la que se le asignó un Customer después cuenta para él. `on` no interviene.
- **Tope y errores.** `SUGGESTIONS_PER_LIST = 8` se lee solo en el caso de uso; la ruta no tiene parámetro de límite. Un `on` que falta o está mal formado (cualquier cosa que no sea `YYYY-MM-DD` real) responde 422 `RequestInvalid`; cualquier fecha bien formada, pasada, de hoy o futura, responde 200.
- **Aislamiento.** El adaptador `SqlNewSaleSuggestions(session, business_id)` filtra `business_id` en cada tabla de cada sentencia, las unidas incluidas, y une el pago con su medio por la clave compuesta `(business_id, payment_method_id)`. Está en el sembrador de `tests/test_business_isolation.py`, y se prueba por la ausencia de los ids de A en la respuesta de B y por la forma vacía exacta de B.

## Costo (§8)

- **Recent customers:** un recorrido ordenado de las ventas del negocio por el índice `(business_id, sold_on)`, que se corta al ver 8 Customers distintos. En el peor caso es lineal en las ventas del negocio.
- **Most sold:** una suma agrupada que crece con la cantidad de líneas de venta dentro de la ventana de 30 días.
- **No se agrega ningún índice.**

## Consecuencias

- La pantalla de New sale podrá preseleccionar el medio por id y mostrar las dos listas sin pedir nada más. `docs/product/sales.md` (criterio 34, "el medio nunca viene puesto") sigue como está hasta la parte que lo preselecciona.
- Cambiar la ventana de Days left cambia también Most sold, a propósito: es una sola constante.
