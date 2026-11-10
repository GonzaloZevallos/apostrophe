---
status: accepted
date: 2026-11-10
---

# Los medios de pago se identifican por id y la columna `payment.method` queda congelada

Épica GH-318 (GH-407). Hasta acá un Payment decía cómo se pagó con una palabra fija (`cash` o `transfer`).
Ahora cada Business tiene su propia lista de Payment methods (CONTEXT.md: Payment method). Esto registra
cómo se enlazan.

## Decisión

- **Un Payment apunta a su medio por id.** La tabla `payment_method` lleva `business_id` no nulo, `name`,
  `name_key`, `icon`, `position` y `archived_at`. Renombrar un medio cambia el nombre que muestran los
  Payments pasados: es deliberado. El `name_key` lo deriva solo el objeto de valor `PaymentMethodName`; la
  migración escribe claves literales y un test las ata a esa derivación.
- **`payment.method` queda congelada y pasa a ser nullable.** Una migración nunca cambia el valor de una
  columna que ya existía; la 0030 (pieza `switch`) agrega `payment.payment_method_id`, la llena desde el
  valor congelado según el Business y relaja `method` a nullable; las filas nuevas escriben NULL. Solo
  `app/payments/adapters/tables.py` y `app/migrations/` nombran esa columna.
- **Clave foránea compuesta con RESTRICT.** `(business_id, payment_method_id)` referencia
  `payment_method(business_id, id)` con `ON DELETE RESTRICT`. Por eso `payment_method` lleva la unicidad
  `(business_id, id)` desde la 0029.
- **Una sola respuesta para un medio inutilizable.** Desconocido, de otro Business, archivado o eliminado:
  siempre 404 con código `payment_method.unavailable`, sin nombrar el medio. Cada escritor (Payment
  posterior, On-the-spot payment) lo comprueba dentro de su único `INSERT … SELECT` guardado, que mira el
  Business de la sesión y `archived_at IS NULL`; ningún otro camino escribe `payment_method_id`.
- **El último medio ofrecido no se archiva ni se elimina.** La sentencia misma (`UPDATE`/`DELETE … WHERE
  EXISTS` otro ofrecido del Business) lo impide, así que dos pedidos simultáneos no pasan ambos una
  comprobación hecha antes de escribir. Un medio con Payments solo se archiva.
- **Un hexágono propio, sin importar `app.payments`.** `app/payment_methods/` expone `PaymentMethodUsage`
  ("¿tiene Payments?") como puerto; `app/main.py` lo cablea. Los demás hexágonos solo ven
  `PaymentMethodId` (escritura) y `PaymentMethodLabel` (lectura) de `app/shared/payment_method.py`.
- **La importación.** Resuelve la palabra de la hoja (`cash`/`transfer`) al nombre por defecto del Business:
  si un medio ofrecido tiene ese nombre, lo usa; si ninguno lo tiene, agrega uno al final con el ícono
  `other`; si uno archivado tiene el nombre, rechaza el plan con `import.payment_method_archived`.

## Consecuencias

- Las aperturas de un Business nuevo siembran "Cash" y "Transfer" en su idioma guardado; los Business
  existentes los reciben en inglés por la migración.
- La API de pagos y ventas rompe (`payment_method_id` en lugar de `method`): el PR lleva `Breaking-API:`
  (ADR-0066).
