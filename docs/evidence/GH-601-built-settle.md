# GH-601: evidencia del reintento de un lado que no queda quieto

## Qué se probó
- Política pura en `scripts/design/settle.mjs` (tests en `web/src/design/settle.test.ts`).
- Cableado en `scripts/design/comparisons.mjs`, probado con cuatro casos que sirve el propio proceso de test
  (`web/src/design/census.test.ts`): pasa en el segundo intento, nunca queda quieto, no se repite tras una escritura y el
  censo del intento que pasó.
- Decisión de la persona que decide (Decisión 1): no se reintenta una escritura; un paso que manda una escritura espera
  su respuesta antes de asentarse (`writesAnswered`, igual para toda fila y ambos lados). No hizo falta la lista de
  excepciones `not compared: sends a write`: las filas `Save sale` pasaron en las tres corridas registradas.

## Corrida 0 (antes de esperar la respuesta de la escritura)
`scripts/design/compare.sh --strict` sobre todo el registro, head `00166830a38bcca0542d1aeecfae15dc51e93401`, 540 s,
**salida 1**, `retries: 2 rows, 4 attempts`. Reintentadas con éxito en el intento 2: `InicioPrimeraVezOscuro` y
`ClienteFichaOscuro` (las dos `rest-mismatch`). Fallaron `VentaGuardada` y `VentaGuardadaOscuro` (`la pantalla no quedó
quieta`): mandan una escritura, así que no se reintentan. Solas, con `--only` y una muestra nueva, pasan (salida 0).

## Reproducción bajo carga
Dos `compare.sh --strict` completos al mismo tiempo (el segundo arrancó cuando el primero ya imprimía filas, para que no
compitan por el build del front), sin `--census`, sobre `0a345044` más un cambio solo de texto de diagnóstico del mensaje
de falla (no se commiteó). Los dos terminaron con **salida 0** y `retries: 0 rows, 0 attempts`.
- Fallas en el intento 1: 0 de 173 filas con lado construido en cada uno (0,000, umbral 0,15).
- Fallas en el intento 2 tras una falla en el intento 1: no hubo ninguna falla en el intento 1.
- Fallas por tipo: ninguna.
Un primer intento de la misma prueba, con los dos arrancando juntos, no llegó a capturar: `compare: the sample app was not
ready in 120 s` en los dos (el build del front y la espera de 120 s de `compare.sh`). No cuenta como corrida.

### Bajo carga, en el head entregado
La prueba de arriba corrió antes de `writesAnswered`, así que no mide el head entregado. Se repitió sobre `c25093ae0a040ca3acd9c6175f6c24c06651bec8`
(el mismo código de captura que `51f4c4ae`; solo cambian docs), con la máquina cargada por las pruebas de otros trabajos
(carga media 19,6 / 25,5 / 22,2 al arrancar, de 1, 5 y 15 minutos). `compare.sh` no llegó a arrancar tres veces
(`the sample app was not ready in 120 s`, el build del front tardaba más de 120 s con esa carga; no capturó nada, no cuenta
como corrida). La cuarta se hizo con el mismo `sample-app.sh` y `comparisons.mjs --strict` pero esperando los datos de la app
sin el límite de 120 s (un guion en el directorio temporal). Resultado: **salida 0**, `retries: 1 rows, 2 attempts`: `InicioChecklistOscuro`
(`built: settled on attempt 2 of 3 after rest-mismatch`).
- Fallas en el intento 1: 1 de 171 filas con lado construido en `ok` (0,006, umbral 0,15).
- Fallas en el intento 2 tras una falla en el intento 1: 0 de 1 (umbral 0,5).
- Filas reintentadas: 1 (umbral 5).

## Tres corridas seguidas en el head del PR
Head `51f4c4ae27af417641e1c9aa293a15d24218bea0`, muestra nueva cada vez, sin `--only`, sin `--census`, una detrás de otra.

| Corrida | Salida | Duración | Línea `retries:` | Filas reintentadas |
|---|---|---|---|---|
| 1 | 0 | 683 s | `retries: 1 rows, 2 attempts` | `EstadosConfirmar`: `built: settled on attempt 2 of 3 after rest-mismatch` |
| 2 | 0 | 658 s | `retries: 2 rows, 4 attempts` | `Variedades` y `Catalogo`: `built: settled on attempt 2 of 3 after rest-mismatch` |
| 3 | 0 | 739 s | `retries: 0 rows, 0 attempts` | ninguna |

Antes de estas tres hubo un arranque que no capturó nada (`compare: the sample app was not ready in 120 s`, salida 1, a los
132 s): coincidió con un `tsc` y un `oxlint` que corrí a la vez. No cuenta como corrida y no se repitió; las tres de arriba
son las tres siguientes, seguidas.

- Fallas en el intento 1: 1, 2 y 0 de 173 filas con lado construido (0,006, 0,012 y 0,000; umbral 0,15).
- Fallas en el intento 2 tras una falla en el intento 1: 0 de 3 (umbral 0,5). Los tres reintentos fueron `rest-mismatch`.
- Filas reintentadas por corrida: 1, 2 y 0 (umbral 5). Ninguna fila se reintentó en 2 o más de las 3 corridas.
- `VentaGuardada`, `VentaGuardadaOscuro` y `OnboardingVariedad` pasaron en las tres, sin reintento.

## `ae.mjs` entre corridas
`node scripts/design/ae.mjs <corrida n> <corrida n+1>`, sin `--only`: corrida 1 contra 2 y 2 contra 3, las dos con **salida 0**.
En cada una, 391 líneas de lado con `AE 0`, 47 lados construidos sin captura en ninguna (las filas que todavía no existen en
la app) y ninguna otra línea. Es decir, AE 0 en toda fila capturada en las dos.

## Después del merge con master: tres corridas en el head entregado
Las corridas de arriba son del código anterior al merge con master. El merge trajo código de captura nuevo (`take-shot.mjs`,
`shot.mjs`, `stitch.mjs`, unas 1.100 líneas) y filas nuevas en `screens.json`; no solo movió los tipos de falla. Por eso se
repitieron sobre el head `3accc29e97db7b0095a6e1c5e6602d3eb2b6d12c`, una detrás de otra, cada una con una muestra nueva, sin
`--only` y sin `--census`. Mismos pasos que `compare.sh` (`sample-app.sh` y `comparisons.mjs --strict`) esperando los datos de
la app sin su límite de 120 s, porque la máquina estaba cargada por otros trabajos (carga media de 27 a 29 al arrancar cada una).

| Corrida | Head | Salida | Duración | Línea `retries:` | Filas reintentadas |
|---|---|---|---|---|---|
| 1 | `3accc29e` | **1** | 1081 s | `retries: 0 rows, 0 attempts` | ninguna |
| 2 | `3accc29e` | **1** | 1183 s | `retries: 0 rows, 0 attempts` | ninguna |
| 3 | `3accc29e` | **1** | 1241 s | `retries: 0 rows, 0 attempts` | ninguna |

Las tres salen con 1 por una sola causa, que no es una captura fallida ni un lado que no quedó quieto. Cada corrida tiene 293
filas: 174 con el lado construido capturado y 119 `not-captured`, todas con la razón `shot: no built screen yet (built)` (filas
con `route: null`, todavía sin pantalla en la app). Ninguna otra fila tiene razón de falla y la salida no tiene ninguna línea
`no se pudo capturar`. La regla de `--strict` de master (`results.some(not-captured)`) sale 1 por esas 119 filas, con o sin este
cambio: no se tocó (invariante 7) y no hay una excepción nombrada para ellas en el registro. Antes del merge esas filas no
hacían salir 1 (`failed` solo miraba las capturas), por eso las corridas de arriba dieron 0.

- Fallas en el intento 1: 0 de 174 filas con lado construido en cada corrida (umbral 0,15). Fallas en el intento 2 tras una
  falla en el intento 1: no hubo ninguna. Filas reintentadas: 0, 0 y 0 (umbral 5); ninguna se reintentó en 2 o más corridas.
- No se ejerció el camino de reintento en estas tres corridas: no hizo falta. Lo cubren los tres casos de `census.test.ts`.
- Carga: las tres corrieron con la máquina cargada por otros trabajos (carga media de 27 a 29), sin segunda corrida de
  `compare.sh` en paralelo; esa es la carga de la reproducción en este head.
- `ae.mjs` entre corridas, sin `--only`: 1 contra 2 y 2 contra 3, las dos con **salida 0**. En cada una, 467 líneas de lado con
  `AE 0` y 119 líneas `not compared — shot: no built screen yet (built)` (las mismas filas sin pantalla), nada más.

### Veredicto contra el criterio
El criterio pide tres corridas `--strict` seguidas que salgan 0. En este head salen 1, solo por las 119 filas sin pantalla
construida (la regla de master), y la regla de parada del encargo dice parar y avisar. No se cambió `--strict`, el registro ni se
listó nada como excepción para llegar a 0. Lo que sí se midió en este head: 174 de 174 lados construidos capturados en las tres
corridas, 0 reintentos, AE 0 en los 467 lados entre corridas.
