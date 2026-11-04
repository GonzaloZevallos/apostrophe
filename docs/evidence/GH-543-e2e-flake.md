# GH-543: evidencia del flake de `web-e2e` en `full_checks`

Cabeza base de las mediciones: `e6d47abc` (con `web-build` todavía en `checks`). Son corridas únicas
en una máquina compartida de 16 núcleos, registradas una vez en `docs/evidence/GH-543/stress.log`
(arnés `docs/evidence/GH-543/stress.sh`, adaptado de GH-506). Ninguna mide una tasa.

## Conclusión

**Defecto encontrado y corregido; la causa de GH-483 no se mostró.** No hay ninguna corrida roja con la
firma de interferencia (asset 404, `net::ERR_*`, `MissingBuiltFront`, raíz en blanco), así que no se
escribe "causa reproducida" ni "arreglado". Lo que sí se encontró leyendo el código es que dos checks
de `parallel_checks: true` escriben la misma ruta (Paso 0b); `tests/test_stack_parallel_writers.py` lo
fija y `web-build` sale de `checks`.

**Pendiente (no hecho en esta entrega):** las 3 corridas posteriores a la corrección y el resultado de
la corrida previa 2 (ver la tabla). No hay evidencia posterior a la corrección.

## Paso 0a: qué quedó de la salida de GH-483

Solo `.agentic/kept/GH-483/sales-and-sale-bill-checks-output.txt` (139 bytes), que no trata de `web-e2e`:

```
python3: can't open file '/home/zeta/.cache/agentic/scratch/2996b5300205/GH-483/r-51647425/checks.py': [Errno 2] No such file or directory
```

No hay `web/test-results/` ni junit ni traza de la corrida roja. **Hallazgo `outside`:** el sistema
agéntico debería conservar el junit y la traza de un `web-e2e` rojo en `full_checks` (y el mensaje), para
que un flake se pueda clasificar sin reproducirlo.

## Paso 0b: lo que escribe cada check (de la fuente)

| Check | Escribe | Fuente |
|---|---|---|
| `web-build` | `web/dist`, buildinfo `web/node_modules/.tmp` | `web/package.json:8` (`tsc -b && vite build`) |
| `web-e2e` | `web/dist` (lo vacía y lo reescribe), `web/test-results/` | `web/scripts/e2e.sh:23` (`npx vite build`); el servidor lo sirve (`app/main.py:336-347`) |
| `web-types` | buildinfo `web/node_modules/.tmp` | `web/package.json:9` (`tsc -b`) |

Dos pares con un mismo escritor: `web/dist` (`web-build` y `web-e2e`) y el buildinfo (`web-types` y
`web-build`). Salida del pytest nuevo sobre el árbol sin corregir (`e6d47abc`):

```
checks 'web-types' and 'web-build' both write web/node_modules/.tmp and run at the same moment
checks 'web-build' and 'web-e2e' both write web/dist and run at the same moment
```

## Clasificación

Orden: checks que interfieren, app, carrera de spec, capacidad. Sin mensaje de fallo no se puede
descartar ninguno; el primero queda como defecto encontrado en el código (Paso 0b). Capacidad: la corrida
1 tardó 1693 s en `web-e2e` (28 min) con los otros 7 checks en paralelo, por encima de los 1500 s del
límite del sistema agéntico, que no está en este repo. **Hallazgo `outside`:** si ese límite es el que
cortó GH-483, el tiempo medido es 1693 s; `web/playwright.config.ts` no se tocó.

## Corridas

Una corrida = todos los comandos de `checks` a la vez. Cargas en promedio de 1, 5 y 15 min.

| Corrida | Cabeza | Carga antes | Carga después | Checks junto a `web-e2e` | Resultado | Paso que falló |
|---|---|---|---|---|---|---|
| previa 1 (modo `offset`) | `323ee6c3` | 4.63 5.00 4.96 | 6.97 8.76 12.81 | tests, tests-fast, lint, types, web-types, web-lint, web-tests (`web-build` **no arrancó**: el arnés esperaba una línea de inicio de test que el reporter `list` no imprime sin tty) | `web-e2e` verde, 1693 s | ninguno en `web-e2e`; `tests` rojo (el pytest nuevo, esperado) y `lint` rojo (dos líneas largas del test nuevo, corregidas) |
| previa 2 (modo `offset`, `web-build` 10 s tras la primera línea de test terminado) | `e6d47abc` | 5.xx (ver `stress.log`) | sin terminar al entregar | los 7 anteriores y `web-build` | **no terminó al entregar**; el listado de `web/dist` al arrancar `web-build`: `assets icons index.html manifest.webmanifest sw.js` | n/a |
| posteriores 1-3 | n/a | n/a | n/a | n/a | **no hechas** | n/a |

Un verde es una corrida, no una tasa.
