# GH-491 parte 1: evidencia de la línea base y de la corrida posterior

## Línea base y entorno

- Base sha: `e388f5b9e59f918f03b69a52739fbbc0284e4de6` (la cabeza de la rama antes de editar nada).
- `git diff --quiet e388f5b9 HEAD -- web/package.json web/package-lock.json`: sin diferencias (las dos corridas `master` y la corrida `after` usan las mismas dependencias).
- Las corridas `master` salieron de un export del sha base (`git archive e388f5b9`) en un directorio de scratch, con `web/node_modules` y `.venv` enlazados al checkout de la tarea. No se usó `git worktree add`: el sistema lo rechaza (los worktrees los crea el sistema). El contenido es el mismo árbol del sha base.
- Chromium: `~/.cache/ms-playwright/chromium-1243` (headless shell 1243). Python: `uv run --no-project python --version` = 3.13.15. `nproc` = 16.
- Los PNG no están en git. Las corridas están fuera del repo, en `~/.cache/apostrophe/GH-491/{master-1,master-2,after2}`; los tres `*.index.json` de esta carpeta son sus índices con cada ruta reducida a su basename.
- Un `index.json` de `master-*` no tiene `capture` ni `reasons` (es el código sin cambios); el de `after` sí.

## Las tres corridas, una tras otra, en primer plano

| Corrida | Código | `facts.today` | Inicio (AR) | Fin (AR) | Duración |
|---|---|---|---|---|---|
| master-1 | sha base | 2026-11-07 | 05:17:39 | 05:26:07 | 8 min 28 s |
| master-2 | sha base | 2026-11-07 | 05:26:13 | 05:34:10 | 7 min 57 s |
| after | rama, commit `1634967e` | 2026-11-07 | no registrado | no registrado | no registrado |

Las tres corrieron el mismo día argentino (2026-11-07). Entre corridas sólo corrió `ae`. Una primera corrida `after` con el commit `b9236523` (antes del arreglo de abajo) dejó `VariedadDetalle` y `CatalogoOscuro` sin lado `built`; la evidencia de esta carpeta es la corrida con `1634967e`, que la reemplaza.

## Causa y arreglo del lado `built` que no se capturaba

`VariedadDetalle` y `CatalogoOscuro` fallaban de forma intermitente con `shot: did not settle (built)`. El cuadro después del shot veía una mutación `style` sobre `div.disposicion`: al crecer el viewport, el evento `resize` de `visualViewport` llegaba a la página un cuadro del navegador más tarde que los cuadros ya quietos y el shot, y `useVisualViewport` del shell escribía entonces ese `style`. El arreglo está en `scripts/design/comparisons.mjs` (`growViewport`): instala antes del cambio un listener que sólo marca una bandera (no toca el DOM) y espera ese evento, con una cota de 100 consultas, antes de asentar y sacar el shot. Con `--only CatalogoOscuro,VariedadDetalle`, 10 corridas: el lado `built` se capturó 10 de 10.

## Conjuntos capturados

219 filas en el registro. Lado `design`: 182 capturados en las tres corridas, el mismo conjunto. Lado `built`: master-1 172, master-2 167, after 172. Filas con las dos imágenes: master-1 135, master-2 132, after 135.

- Unión de las filas con las dos imágenes en las corridas `master`: 135. El conjunto de `after` es igual a esa unión: no falta ninguna fila y no sobra ninguna.
- Lado `built` que capturó en master-1 y no en master-2 (flaky en master): `InicioChecklist`, `InicioChecklistOscuro`, `ClientesOscuro`, `VariedadArchivada`, `VariedadArchivadaOscuro`. `after` las capturó todas.
- En `after`, 135 filas son `captured` y 84 `not-captured`, por estas razones fijas: 47 `shot: no built screen yet (built)`, 26 `shot: page wider than its viewport (design)` y 11 `shot: section outside the viewport (design)`. Ninguna fila falla por `shot: did not settle`.
- `VariedadDetalle`, `VariedadDetalleOscuro` y `CatalogoOscuro` tienen el lado `built` capturado en `after`; su lado `design` falla siempre con `page wider than its viewport`, también en las dos corridas `master`, y no es parte de esta tarea.

## `ae` de las parejas

`node scripts/design/ae.mjs <antes> <después>`.

| Pareja | Lados `AE 0` | Lados con `AE` mayor que 0 | `FAIL` | `not compared` (sin falla) |
|---|---|---|---|---|
| master-1 contra after | 354 | 0 | 0 | 84 |
| master-2 contra after | 349 | 0 | 0 | 89 |

Ninguna pareja tiene un lado con imagen antes y sin imagen después, así que no hay `FAIL not compared`. Las salidas completas están en `ae-master-1-after.txt` y `ae-master-2-after.txt`.

## Filas y lados con AE mayor que 0

**Ninguno.** En las dos parejas, cada lado capturado en los dos lados de la pareja da `AE 0`: ni el reduced motion, ni la hoja de estilos calma, ni el `await document.fonts.ready`, ni la espera del `resize` cambian un solo píxel de ninguna captura que antes existía. La lista de filas con AE mayor que 0 que alimenta la parte 3 es vacía.

## Archivos de esta carpeta

- `master-1.index.json`, `master-2.index.json`: índices del código base, el mismo día.
- `after.index.json`: índice de la rama en `1634967e`, con cada ruta reducida a su basename.
- `ae-master-1-after.txt`, `ae-master-2-after.txt`: salida de `ae` de cada `master` contra `after`.
- Los PNG no están en git. La parte 3 lee la evidencia de esta carpeta.
