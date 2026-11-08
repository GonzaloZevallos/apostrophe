# GH-601: evidencia del reintento de un lado que no queda quieto

Estado: **incompleto**. Lo que sigue no está hecho en esta entrega y queda para el Tech Lead.

## Hecho
- Política pura en `scripts/design/settle.mjs` (tests en `web/src/design/settle.test.ts`).
- Cableado en `scripts/design/comparisons.mjs`, probado con tres casos que sirve el propio proceso de test
  (`web/src/design/census.test.ts`): pasa en el segundo intento (`built: settled on attempt 2 of 3 after unsettled`,
  `retries: 1 rows, 2 attempts`), nunca queda quieto (`(after 3 attempts: unsettled, unsettled, unsettled)`, salida 1)
  y el censo del intento que pasó (con `--census`, sin `census_error` ni `census_settle`).

## No hecho
- La reproducción bajo carga (dos `compare.sh` a la vez, sin `--census`), con las fallas por tipo y las tasas de falla en el
  intento 1 y en el intento 2: no se corrió.
- Las tres corridas seguidas de `compare.sh --strict` sobre todo el registro en el head del PR, con SHA, código de salida,
  línea `retries:` y filas reintentadas: no se corrieron.
- `ae.mjs` AE 0 entre corridas: no se corrió.

Hasta que existan esas corridas no se puede decir que la regla de parada (tasa en el intento 1 mayor a 0,15, más de la mitad
de los reintentos fallando otra vez, más de 5 filas reintentadas, o alguna corrida con salida distinta de 0) no se cumple.
