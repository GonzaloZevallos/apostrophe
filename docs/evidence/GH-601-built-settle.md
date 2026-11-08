# GH-601: evidencia del reintento de un lado que no queda quieto

Estado: **la regla de parada se cumplió, el trabajo se detuvo** (la corrida 1 salió con 1). Faltan las corridas 2 y 3,
la reproducción con un segundo `compare.sh` y el AE 0 entre corridas; no se corrieron porque la regla de parada manda
detenerse y informar, sin agregar intentos ni aflojar ninguna cota.

## Hecho
- Política pura en `scripts/design/settle.mjs` (tests en `web/src/design/settle.test.ts`).
- Cableado en `scripts/design/comparisons.mjs`, probado con tres casos que sirve el propio proceso de test
  (`web/src/design/census.test.ts`): pasa en el segundo intento, nunca queda quieto, y el censo del intento que pasó.

## Corrida 1: `scripts/design/compare.sh --strict` sobre todo el registro
- Head: `00166830a38bcca0542d1aeecfae15dc51e93401`.
  Muestra nueva, sin `--only`, sin `--census`. Carga ambiente de la máquina (promedio de carga de 5 a 12 al empezar, otros
  procesos corriendo), no un segundo `compare.sh` puesto a propósito. Duración: 540 s.
- **Código de salida: 1.**
- Línea impresa: `retries: 2 rows, 4 attempts`.
- Filas reintentadas, las dos con éxito en el intento 2:
  - `InicioPrimeraVezOscuro`: `built: settled on attempt 2 of 3 after rest-mismatch`.
  - `ClienteFichaOscuro`: `built: settled on attempt 2 of 3 after rest-mismatch`.
- Filas que fallaron: `VentaGuardada` y `VentaGuardadaOscuro`, las dos filas `Save sale`
  (`la pantalla no quedó quieta`). Mandan una escritura, así que el sondeo de escrituras no las reintenta: es el riesgo
  conocido del plan ("Rows that save are not rescued"). Solas, con `--only VentaGuardada,VentaGuardadaOscuro` y una muestra
  nueva, pasan (`ok`, `retries: 0 rows, 0 attempts`, salida 0), con el promedio de carga en 26.

## Tasas medidas (una sola corrida)
- Filas con lado construido: 173 (220 filas menos 47 que todavía no existen en la app).
- Fallas en el intento 1: 4 (2 reintentadas, 2 filas de escritura sin reintento) → 4 / 173 = 0,023, bajo el umbral de 0,15.
- Fallas en el intento 2 tras una falla en el intento 1: 0 de 2 (0 %), bajo el umbral de 0,5.
- Filas reintentadas: 2, bajo el umbral de 5.
- Fallas por tipo de las filas reintentadas: 2 `rest-mismatch`. El tipo de las dos filas de escritura no se imprime, porque no se
  reintentan.

## Qué falta, y por qué
La regla de parada se activa por "las tres corridas no salen todas con 0". Lo que la cumple es la corrida 1 con las dos
filas de escritura. Decidir queda para el Tech Lead: reponer la muestra por intento está fuera de alcance del plan, y
cualquier otra salida (por ejemplo, tratar una escritura idempotente de esas filas) cambia el alcance. Sin las corridas 2 y
3 no se puede decir si las dos filas fallan en cada corrida o solo en esta.

Sin correr: la reproducción con un segundo `compare.sh` a la vez; las corridas 2 y 3; `ae.mjs` AE 0 entre corridas.
