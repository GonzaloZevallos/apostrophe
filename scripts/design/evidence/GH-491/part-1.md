# GH-491 parte 1: evidencia de la línea base y de la corrida posterior

## Línea base y entorno

- Base sha: `e388f5b9e59f918f03b69a52739fbbc0284e4de6` (la cabeza de la rama antes de editar nada).
- `git diff --quiet e388f5b9 HEAD -- web/package.json web/package-lock.json`: sin diferencias (las dos corridas `master` y la corrida `after` usan las mismas dependencias).
- Las corridas `master` salieron de un export del sha base (`git archive e388f5b9`) en un directorio de scratch, con `web/node_modules` y `.venv` enlazados al checkout de la tarea. No se usó `git worktree add`: el sistema lo rechaza (los worktrees los crea el sistema). El contenido es el mismo árbol del sha base.
- Chromium: `~/.cache/ms-playwright/chromium-1243` (headless shell 1243). Python: `uv run --no-project python --version` = 3.13.15. `nproc` = 16.
- Los PNG no están en git. Las corridas están fuera del repo, en `~/.cache/apostrophe/GH-491/{master-1,master-2,after}`; los tres `*.index.json` de esta carpeta son sus índices con cada ruta reducida a su basename.
- Un `index.json` de `master-*` no tiene `capture` ni `reasons` (es el código sin cambios); el de `after` sí.

## Las tres corridas, una tras otra, en primer plano

| Corrida | Código | `facts.today` | Inicio (AR) | Fin (AR) | Duración | Carga al inicio (1/5/15 min) |
|---|---|---|---|---|---|---|
| master-1 | sha base | 2026-11-07 | 05:17:39 | 05:26:07 | 8 min 28 s | 12.97 9.58 6.48 (había otros agentes en la máquina) |
| master-2 | sha base | 2026-11-07 | 05:26:13 | 05:34:10 | 7 min 57 s | 1.10 3.46 4.78 |
| after | rama, commit `b9236523` | 2026-11-07 | 05:34:15 | 05:42:20 | 8 min 05 s | 1.46 1.97 3.50 |

Las tres terminaron el mismo día argentino (2026-11-07), mucho antes de medianoche. Entre corridas sólo corrió `ae`. Ninguna clase de falla aparece en todas las filas: no hay falla de entorno.

## Conjuntos capturados

219 filas en el registro. Lado `design`: 182 capturados en las tres corridas, el mismo conjunto. Lado `built`: master-1 172, master-2 167, after 167. En `after`, 133 filas son `captured` y 86 `not-captured`: 47 por `shot: no built screen yet (built)`, 26 por `shot: page wider than its viewport (design)`, 11 por `shot: section outside the viewport (design)` y 5 por `shot: did not settle (built)` (algunas filas suman dos razones).

Lado `built` que no es igual entre corridas (todo en el lado `built`, ningún otro lado cambia):

| Fila | master-1 | master-2 | after |
|---|---|---|---|
| InicioChecklist | sí | no | no (`did not settle`) |
| InicioChecklistOscuro | sí | no | sí |
| ClientesOscuro | sí | no | sí |
| VariedadArchivada | sí | no | no (`did not settle`) |
| VariedadArchivadaOscuro | sí | no | no (`did not settle`) |
| VariedadDetalle | sí | sí | no (`did not settle`) |
| CatalogoOscuro | sí | sí | no (`did not settle`) |

**Flaky en master** (capturó en una corrida `master` y no en la otra): `InicioChecklist`, `InicioChecklistOscuro`, `ClientesOscuro`, `VariedadArchivada`, `VariedadArchivadaOscuro`.

**Capturaron en las dos corridas `master` y no en `after`**: `VariedadDetalle` y `CatalogoOscuro`, ambos en el lado `built`, con la razón `shot: did not settle (built)` (la nota en español es `la pantalla no quedó quieta`).

Se midió si es una regresión del cambio. Con la misma app de ejemplo levantada una vez, `comparisons.mjs --only VariedadDetalle,CatalogoOscuro`, seis veces cada código:

| Código | Corridas con falla en el lado `built` (de 6) |
|---|---|
| after | 1 |
| master (sha base) | 2 |

Es la misma intermitencia por carga de la máquina, en el código sin cambios también: el sha base falla `did not settle` en esas dos filas (2 de 6 corridas) y la rama en 1 de 6. No hay una causa que dependa del cambio, así que no hay nada que arreglar en esta parte; `VariedadDetalle` y `CatalogoOscuro` quedan listadas como flaky del lado `built`, sin un lado `design` capturado en ninguna corrida (su lado `design` falla siempre con `page wider than its viewport`).

## `ae` de las tres parejas

`node scripts/design/ae.mjs <antes> <después>`, exit 1 en las tres (por los lados `FAIL not compared`, ver abajo; ninguno por AE).

| Pareja | Lados `AE 0` | Lados con `AE` mayor que 0 | `FAIL not compared` | `not compared` (sin falla) |
|---|---|---|---|---|
| master-1 contra master-2 | 349 | 0 | 5 | 84 |
| master-1 contra after | 349 | 0 | 5 | 84 |
| master-2 contra after | 347 | 0 | 2 | 89 |

Los `FAIL not compared` son exactamente los lados `built` de la tabla de arriba que tenían imagen antes y no después. Con `master-*` (sin `reasons`) dice `no reason recorded`; contra `after` dice la razón fija, `shot: did not settle (built)`. Un lado sin imagen antes no es una falla.

- master-1 contra master-2: `InicioChecklist`, `InicioChecklistOscuro`, `ClientesOscuro`, `VariedadArchivada`, `VariedadArchivadaOscuro` (`built`).
- master-1 contra after: `InicioChecklist`, `VariedadDetalle`, `CatalogoOscuro`, `VariedadArchivada`, `VariedadArchivadaOscuro` (`built`).
- master-2 contra after: `VariedadDetalle`, `CatalogoOscuro` (`built`).

## Filas y lados con AE mayor que 0

**Ninguno.** En las tres parejas, cada lado capturado en los dos lados de la pareja da `AE 0`: ni el reduced motion, ni la hoja de estilos calma, ni el `await document.fonts.ready` cambian un solo píxel de ninguna captura que antes existía. La lista que alimenta la parte 3 es vacía por AE; lo que no es estable es sólo la captura del lado `built` de las filas flaky de arriba.

## Rerun after the resize fix (head 1634967e, 2026-11-07, same Argentina day as master-1 and master-2)

Cause of the built-side "did not settle" of VariedadDetalle and CatalogoOscuro: after the viewport grows, the visual-viewport resize event reached the page a browser frame later than the settled frames and the shot, and the shell's `useVisualViewport` then wrote a `style` on `div.disposicion`; the frame after the shot saw that mutation. The capture now waits for the resize event after growing (`growViewport` in `scripts/design/comparisons.mjs`).

- 10 runs of `--only CatalogoOscuro,VariedadDetalle`: built captured 10 of 10 (before the fix about 1 in 3 failed).
- `ae master-1 after` and `ae master-2 after`: 0 `FAIL` lines; VariedadDetalle, VariedadDetalleOscuro and CatalogoOscuro built: AE 0.
- Rows with both PNGs: master-1 135, master-2 132, union 135, after 135; none in the union is missing from after, none extra.
- Their design side is "page wider than its viewport" in both masters and in after: unchanged, not part of this task.
- Files: calm-capture-index-ae-after.index.json (replaced), calm-capture-index-ae-ae-master-{1,2}-after.txt.

## Files in this directory

master-1.index.json, master-2.index.json (base code, same day), after.index.json (head 1634967e), ae-master-1-after.txt and ae-master-2-after.txt (`ae` over each master against after: 0 rows with AE above 0, 0 FAIL). PNGs are not versioned. Part 3 reads the evidence from here.
