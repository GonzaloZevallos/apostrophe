# GH-491 parte 1: evidencia de la línea base y de la corrida posterior

Esta evidencia se tomó sobre la cabeza fusionada `349c9b67` (la rama con la base `e0d59766` ya dentro, incluidos los viewports por lado de GH-548). Reemplaza a la de `1634967e`, que no cubría las filas con `design_viewport`.

## Línea base y entorno

- Base sha: `e0d59766990d5d807f7619065bbe6b7463c649d6`, la base fusionada en la rama. El código de las corridas `master` es ese árbol sin los cambios de esta parte.
- `git diff --quiet e0d59766 HEAD -- web/package.json web/package-lock.json`: sin diferencias (las dos corridas `master` y la corrida `after` usan las mismas dependencias).
- Las corridas `master` salieron de un export del sha base (`git archive e0d59766`) en un directorio de scratch, con `web/node_modules` y `.venv` enlazados al checkout de la tarea. No se usó `git worktree add`: el sistema lo rechaza (los worktrees los crea el sistema).
- Chromium: `~/.cache/ms-playwright/chromium-1243` (headless shell 1243). Python: `uv run --no-project python --version` = 3.13.15. `nproc` = 16.
- Los PNG no están en git. Las corridas están fuera del repo, en `~/.cache/apostrophe/GH-491/{m3-1,m3-2,a3}`; los tres `*.index.json` de esta carpeta son sus índices con cada ruta reducida a su basename.
- Un `index.json` de `master-*` no tiene `capture` ni `reasons` (es el código sin cambios); el de `after` sí.

## Las tres corridas, una tras otra, en primer plano

| Corrida | Código | Inicio (AR) | Fin (AR) | Duración |
|---|---|---|---|---|
| master-1 | base `e0d59766` | 2026-11-07 19:48:01 | 19:57:33 | 9 min 32 s |
| master-2 | base `e0d59766` | 2026-11-07 19:57:36 | 20:06:33 | 8 min 57 s |
| after | rama, commit `349c9b67` | 2026-11-07 20:06:36 | 20:18:12 | 11 min 36 s |

Las tres corrieron el mismo día argentino (2026-11-07), antes de medianoche, sin otra cosa entre ellas que `ae`.

## Conjuntos capturados

219 filas en el registro. Lado `design`: 219 capturados en las tres corridas. Lado `built`: master-1 169, master-2 171, after 172. Filas con las dos imágenes: master-1 169, master-2 171, after 172.

- Unión de las filas con las dos imágenes en las corridas `master`: 172. El conjunto de `after` es igual a esa unión: no falta ninguna fila y no sobra ninguna. La igualdad se comprobó por nombre de pantalla, fila por fila, no sólo por conteo.
- Lado `built` que no es igual entre las dos corridas `master` (flaky en master): `ClienteFichaOscuro` capturó en master-1 y no en master-2; `InicioHoy`, `Catalogo` y `CatalogoOscuro` capturaron en master-2 y no en master-1. `after` capturó las cuatro.
- En `after`, 172 filas son `captured` y 47 `not-captured`, todas por la razón fija `shot: no built screen yet (built)`. Ninguna fila falla por `shot: did not settle`.
- `VariedadDetalle`, `VariedadDetalleOscuro` y `CatalogoOscuro` quedan `captured` en `after`.

## Causa y arreglo del lado `built` que no se capturaba

`VariedadDetalle` y `CatalogoOscuro` fallaban de forma intermitente con `shot: did not settle (built)`. El cuadro después del shot veía una mutación `style` sobre `div.disposicion`: al crecer el viewport, el evento `resize` de `visualViewport` llegaba a la página un cuadro del navegador más tarde que los cuadros ya quietos y el shot, y `useVisualViewport` del shell escribía entonces ese `style`. El arreglo está en `scripts/design/comparisons.mjs` (`growViewport`): instala antes del cambio un listener que sólo marca una bandera (no toca el DOM) y espera ese evento, con una cota de 100 consultas, antes de asentar y sacar el shot.

## `ae` de las parejas

`node scripts/design/ae.mjs <antes> <después>`.

| Pareja | Lados `AE 0` | Lados con `AE` mayor que 0 | `FAIL` | `not compared` (sin falla) | Exit |
|---|---|---|---|---|---|
| master-1 contra after | 388 | 0 | 0 | 50 | 0 |
| master-2 contra after | 390 | 0 | 0 | 48 | 0 |
| master-1 contra master-2 | 387 | 0 | 1 | 51 | 1 |

El único `FAIL` es `ClienteFichaOscuro built: FAIL not compared — no reason recorded`, entre las dos corridas del código base: tenía imagen en master-1 y no en master-2, es la intermitencia que el código base ya tiene. Contra `after` no hay ningún `FAIL`. Las salidas completas están en `ae-master-1-after.txt`, `ae-master-2-after.txt` y `ae-master-1-master-2.txt`.

## Filas y lados con AE mayor que 0

**Ninguno.** En las tres parejas, cada lado capturado en los dos lados de la pareja da `AE 0`: ni el reduced motion, ni la hoja de estilos calma, ni el `await document.fonts.ready`, ni la espera del `resize` cambian un solo píxel de ninguna captura que antes existía. La lista de filas con AE mayor que 0 que alimenta la parte 3 es vacía.

## Archivos de esta carpeta

- `master-1.index.json`, `master-2.index.json`: índices del código base, el mismo día.
- `after.index.json`: índice de la rama en `349c9b67`, con cada ruta reducida a su basename.
- `ae-master-1-after.txt`, `ae-master-2-after.txt`, `ae-master-1-master-2.txt`: salida de `ae` de cada pareja.
- Los PNG no están en git. La parte 3 lee la evidencia de esta carpeta.

## Dónde vive esta evidencia

Esta carpeta es la ruta de la evidencia de GH-491 por decisión del dueño (la tarea no pidió `.agentic/tasks/`); nada de esto va bajo `.agentic/`.

## Límite conocido de `growViewport`

La espera del `resize` tiene una cota de 100 consultas a la página, no de tiempo. Si una página nunca recibe el evento, la captura sigue sin dejar una razón de que la espera se agotó. No hay una prueba en los seams declarados, porque hace falta un navegador real: la evidencia es esta corrida.
