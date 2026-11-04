# GH-543: evidencia del flake de `web-e2e` en `full_checks`

Cabezas de las mediciones: `323ee6c3` y `e6d47abc` (con `web-build` todavía en `checks`) y `5a0fd032` (sin él). Son corridas únicas
en una máquina compartida de 16 núcleos, registradas una vez en `docs/evidence/GH-543/stress.log`
(arnés `docs/evidence/GH-543/stress.sh`, adaptado de GH-506). Ninguna mide una tasa.

## Conclusión

**Defecto encontrado y corregido; la causa de GH-483 no se mostró.** Ninguna corrida roja tiene la firma
de interferencia entre checks (asset 404, `net::ERR_*`, `MissingBuiltFront`, raíz en blanco), así que no
se escribe "causa reproducida" ni "arreglado". Lo que sí se encontró leyendo el código es que dos pares de
checks de `parallel_checks: true` escriben la misma ruta (Paso 0b); `tests/test_stack_parallel_writers.py`
lo fija y `web-build` sale de `checks`.

Con `web-build` ya fuera, la corrida posterior 2 salió **roja** en `analysis.spec.ts`: es una carrera de
spec, sin relación con `web/dist` (ver Clasificación). Es una causa distinta de la corregida aquí y no se
sabe si es la de GH-483. Sigue en pie; `web/e2e/` no se toca en esta tarea.

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

Orden: checks que interfieren, app, carrera de spec, capacidad.

- **Checks que interfieren:** para GH-483 no hay mensaje, así que no se puede descartar ni mostrar; queda como
  defecto encontrado en el código (Paso 0b). En la corrida previa 2, `web-build` reescribió `web/dist` 10 s
  después del primer test terminado y `web-e2e` siguió verde (1728 s): no se mostró un rojo por esta vía.
- **Carrera de spec (corrida posterior 2, roja, cabeza `5a0fd032`, sin `web-build`):** `analysis.spec.ts:178`
  falló en 15.4 s (test 5 de 252, lejos del límite de 160 s) con `locator.fill: Element is not an <input>…
  waiting for getByLabel('Name') … locator resolved to <button type="button" class="boton-icono"
  aria-label="Edit name">` en `analysis.spec.ts:191` (`page.getByLabel('Name').fill(name)`, tras `goto` y el clic en
  "New variety"). Lo más probable (inferencia, no probada): la etiqueta `Name` coincidió con el botón "Edit name" de la pantalla anterior antes de que
  la navegación terminara. Sin firma de interferencia (`signature=-`). Traza y captura:
  `web/test-results/5a0fd032-20261104T042634Z/` (no versionada; salida y listado de `web/dist` en
  `docs/evidence/GH-543/stress-red-all-5a0fd032-2*.txt`). Es una sola corrida roja: no mide tasa y no
  se probó que sea el flake de GH-483.
- **Capacidad:** `web-e2e` tardó 1693 s, 1728 s, 1741 s, 1733 s y 1665 s con los otros 7 u 8 checks en
  paralelo, por encima de los 1500 s del límite del sistema agéntico, que no está en este repo.
  **Hallazgo `outside`:** si ese límite es el que cortó GH-483, el tiempo medido está en la tabla;
  `web/playwright.config.ts` no se tocó.

## Corridas

Una corrida = todos los comandos de `checks` a la vez. Cargas en promedio de 1, 5 y 15 min.

| Corrida | Cabeza | Carga antes | Carga después | Checks junto a `web-e2e` | Resultado | Paso que falló |
|---|---|---|---|---|---|---|
| previa 1 (modo `offset`) | `323ee6c3` | 4.63 5.00 4.96 | 6.97 8.76 12.81 | tests, tests-fast, lint, types, web-types, web-lint, web-tests (`web-build` **no arrancó**: el arnés esperaba una línea de inicio de test que el reporter `list` no imprime sin tty) | `web-e2e` verde, 1693 s | ninguno en `web-e2e`; `tests` rojo (el pytest nuevo, esperado) y `lint` rojo (dos líneas largas del test nuevo, corregidas) |
| previa 2 (modo `offset`, `web-build` 10 s tras la primera línea de test terminado) | `e6d47abc` | 6.44 8.43 12.55 | 8.98 11.11 16.09 | tests, tests-fast, lint, types, web-types, web-lint, web-tests y `web-build` (arrancó con desfase 10 s; `web/dist` al arrancar: `assets icons index.html manifest.webmanifest sw.js`) | `web-e2e` **verde**, 1728 s, pese a `web-build` reescribiendo `web/dist` durante la corrida; `web-build` verde (142 s); `tests` y `web-tests` rojos | ninguno en `web-e2e` (la interferencia no se manifestó en esta corrida) |
| posterior 1 (modo `all`, sin `web-build`) | `5a0fd032` | 9.41 15.12 16.47 | 11.10 12.94 17.44 | tests, tests-fast, lint, types, web-types, web-lint, web-tests | `web-e2e` verde, 1741 s; los demás checks verdes | ninguno |
| posterior 2 (modo `all`) | `5a0fd032` | 11.10 12.94 17.44 | 7.16 10.10 16.31 | los mismos 7 | `web-e2e` **rojo**, 1733 s; los demás checks verdes | `analysis.spec.ts › Análisis reads Cost of goods sold, Stock shortfall, Marketing and Own use, fully and partly pending` (carrera de spec, ver Clasificación) |
| posterior 3 (modo `all`) | `5a0fd032` | 6.93 9.76 16.00 | 9.14 9.95 14.83 | los mismos 7 | `web-e2e` verde, 1665 s; los demás checks verdes | ninguno |

Un verde es una corrida, no una tasa.

El listado de `web/dist` al final de cada corrida posterior está en `docs/evidence/GH-543/stress-dist-all-5a0fd032-<n>.txt`.
En las corridas previas solo se guardó el listado al arrancar `web-build` (corrida previa 2): el arnés guardaba
el final únicamente en las rojas, y ninguna previa lo fue. Las corridas posteriores no tienen `web-build`:
`web/dist` tiene un solo escritor, `web-e2e`. `web-tests` salió rojo en la corrida previa 2 y verde en las tres
posteriores; no se investigó por qué.

## Hallazgos fuera de esta tarea (`outside`)

- Una tarea de seguimiento debe esperar el formulario de "New variety" antes de `getByLabel('Name').fill(...)` en
  `web/e2e/analysis.spec.ts:191`; esta tarea no puede tocar `web/e2e/` ni `web/src/`.
- El sistema agéntico debe conservar el junit, la traza y el mensaje de un `web-e2e` rojo en `full_checks`.
- El límite de 1500 s del sistema agéntico queda por debajo de los 1665 a 1741 s medidos para `web-e2e` en el nivel
  completo en paralelo.
