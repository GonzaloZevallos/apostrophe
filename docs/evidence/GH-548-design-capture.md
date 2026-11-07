# GH-548: 37 drawings that could not be captured

Base `e388f5b9e59f918f03b69a52739fbbc0284e4de6` (master), head `76943b08d2b7dc8df9b0bf1b6d0c9ceafa8869a2` (la rama, antes del commit de esta nota). Cada corrida es `scripts/design/compare.sh --strict` (la de la rama, `comparisons.mjs --strict` sobre un sample fresco levantado con `sample-app.sh`), en el mismo worktree y el mismo día argentino.

## Diagnóstico (master sin cambios)

En la corrida 1 de master fallaron del lado del diseño **37** filas; el issue habla de 39 porque cuenta dos nombres que no fallan: `Inicio` no es una fila del registro e `InicioHoy` capturó `ok`. Además `ClienteFicha` falló del lado construido ("la pantalla no quedó quieta"), un fallo de reposo distinto que no es de este issue (abajo).

Medido con `readMetrics` y el mismo cálculo de `sectionClip` de `comparisons.mjs`, con el viewport actual de cada fila, Geist servida en local y, en las filas Texto130, el texto escalado:

| screen | scrollWidth | innerWidth | clip x | clip right | frame width | @media |
|---|---|---|---|---|---|---|
| InicioPrimeraVez | 414 | 390 | 24 | 414 | 390 | no |
| InicioPrimeraVezOscuro | 414 | 390 | 24 | 414 | 390 | no |
| InicioOnboardingEnCurso | 414 | 390 | 24 | 414 | 390 | no |
| InicioOnboardingEnCursoOscuro | 414 | 390 | 24 | 414 | 390 | no |
| InicioOnboardingCompleto | 414 | 390 | 24 | 414 | 390 | no |
| InicioOnboardingCompletoOscuro | 414 | 390 | 24 | 414 | 390 | no |
| InicioChecklist | 414 | 390 | 24 | 414 | 390 | no |
| InicioChecklistOscuro | 414 | 390 | 24 | 414 | 390 | no |
| InicioImportado | 414 | 390 | 24 | 414 | 390 | no |
| InicioImportadoOscuro | 414 | 390 | 24 | 414 | 390 | no |
| Variedades | 414 | 390 | - | - | 390 | no |
| VariedadDetalle | 414 | 390 | - | - | 390 | no |
| Catalogo | 414 | 390 | - | - | 390 | no |
| OnboardingStock | 414 | 390 | - | - | 390 | no |
| OnboardingMensaje | 414 | 390 | - | - | 390 | no |
| OnboardingBot | 414 | 390 | - | - | 390 | no |
| OnboardingSocio | 414 | 390 | - | - | 390 | no |
| OnboardingCategorias | 414 | 390 | - | - | 390 | no |
| OnboardingStockOscuro | 414 | 390 | - | - | 390 | no |
| OnboardingMensajeOscuro | 414 | 390 | - | - | 390 | no |
| OnboardingBotOscuro | 414 | 390 | - | - | 390 | no |
| OnboardingSocioOscuro | 414 | 390 | - | - | 390 | no |
| OnboardingCategoriasOscuro | 414 | 390 | - | - | 390 | no |
| OnboardingStockTexto130 | 414 | 320 | - | - | 390 | no |
| OnboardingMensajeTexto130 | 414 | 320 | - | - | 390 | no |
| OnboardingBotTexto130 | 414 | 320 | - | - | 390 | no |
| OnboardingSocioTexto130 | 414 | 320 | - | - | 390 | no |
| OnboardingCategoriasTexto130 | 414 | 320 | - | - | 390 | no |
| OnboardingVariedad | 414 | 390 | - | - | 390 | no |
| OnboardingVariedadOscuro | 414 | 390 | - | - | 390 | no |
| OnboardingVariedadTexto130 | 414 | 320 | - | - | 390 | no |
| OnboardingPrecio | 414 | 390 | - | - | 390 | no |
| OnboardingListo | 414 | 390 | - | - | 390 | no |
| OnboardingListoOscuro | 414 | 390 | 24 | 414 | 390 | no |
| OnboardingListoTexto130 | 414 | 320 | - | - | 390 | no |
| VariedadDetalleOscuro | 414 | 390 | - | - | 390 | no |
| CatalogoOscuro | 414 | 390 | - | - | 390 | no |

Lectura. Las 37 filas miden lo mismo: el documento mide **414** px (24 px de relleno a la izquierda del contenedor más el marco fijo de 390 px), no 438. Con el viewport de 390 px (320 en Texto130), `fitsViewport` falla ("page wider than its viewport") en las 27 filas sin `section`; en las 10 filas con `section` el recorte empieza en x = 24 y termina en 414, fuera del viewport ("section outside the viewport"). Ningún dibujo involucrado tiene una regla `@media`, así que el marco mide igual a cualquier ancho de viewport. Todas las filas tienen la misma causa medida: ninguna queda sin override ni con otra causa. En Texto130 el ancho también es 414: el escalado de texto no mueve el marco fijo.

## Qué cambia

`design_viewport: [414, 844]` en esas 37 filas, solo del lado del diseño; el lado construido sigue en `viewport ?? PHONE`. Ningún archivo de `pantallas/` ni ningún chequeo de `shot.mjs` cambia.

## Piso de ruido (dos corridas de master)

Las dos corridas de master se compararon con `scripts/design/ae.mjs` (ImageMagick `compare` no está instalado en esta máquina; `ae.mjs` cuenta exactamente los píxeles distintos, lo mismo que `compare -metric AE`). 348 capturas crudas dan AE 0 en las dos corridas. **Excluidas** del antes/después, por no tener captura en una de las dos corridas (no por diferencia de píxeles):

- lado construido con "la pantalla no quedó quieta" en una corrida (reposo intermitente): `InicioPrimeraVez`, `ClienteFicha`, `Variedades`, `VariedadDetalle`, `Catalogo`, `CatalogoOscuro`;
- lado del diseño de las 37 filas (sin captura en ninguna de las dos);
- lado construido de las filas con ruta `null` (sin captura en ninguna).

Ninguna fila capturada en ambas corridas difiere en un solo píxel.

## Antes / después

Corrida de la rama sobre un sample fresco: las 37 capturas del diseño se toman (`fitsViewport`, `regionMiss` y `sizeRecordMiss` pasan al nuevo ancho, sin tocarlos). Las 348 capturas estables dan **AE 0** entre la corrida 1 de master (antes) y la de la rama (después), lados construido y diseño, sin excepción. Las 37 filas nuevas no tienen captura anterior: su evidencia es la tabla de arriba más `sizeRecordMiss` pasando.

## Salida de la corrida completa de la rama

Salió con **1**, solo por el lado construido de tres filas que no quedaron quietas tras la captura (el mismo fallo intermitente de master: `ClienteFichaOscuro`, `VariedadDetalleOscuro`, `VariedadArchivada`; ninguna del diseño). Esas tres filas repetidas con `--only` sobre el mismo sample dieron `ok` y salida **0**; también AE 0 contra master (salvo el lado del diseño de `VariedadDetalleOscuro`, que antes no existía). En las tres corridas completas de esta máquina ninguna terminó sin alguna fila de reposo intermitente (master: 1 y 5 filas; rama: 3), así que un "sale 0" de una sola corrida depende de ese fallo del lado construido, ajeno a este issue.

## Lo que esto no cubre

Si otro issue edita un dibujo y su ancho se mueve, el CI no lo ve: solo la próxima corrida completa con `--strict` lo detecta y nombra la fila (ADR-0042, enmienda GH-548).

## Corridas completas de `compare.sh --strict` sobre la rama (segunda ronda)

Dos corridas más, con `scripts/design/compare.sh --strict` sobre un sample fresco cada una, en el mismo worktree:

| cabeza | salida | filas que fallaron | lado |
|---|---|---|---|
| `e8c9761a` | 1 | `ClienteFichaOscuro`, `VariedadDetalleOscuro` | construido ("la pantalla no quedó quieta") |
| `79e131b2` | 1 | `ClienteFichaOscuro`, `VariedadDetalleOscuro`, `CatalogoOscuro`, `VariedadArchivadaOscuro` | construido ("la pantalla no quedó quieta") |

En ninguna corrida falló una fila del lado del diseño: las 37 capturas se toman en las tres corridas completas de la rama. Todas las filas que fallan son del lado construido y tienen el mismo mensaje de reposo que ya aparecía en master (corrida 1: `ClienteFicha`; corrida 2: `InicioPrimeraVez`, `Variedades`, `VariedadDetalle`, `Catalogo`, `CatalogoOscuro`); cada una, repetida con `--only` sobre el mismo sample, da `ok`. Es un fallo de reposo del lado construido que existe en master, no lo causa ni lo toca este cambio (`settle.mjs` y `shot.mjs` no están en el diff), y por eso no se consiguió una corrida completa con salida 0. Queda sin cumplir el "sale 0" de una sola corrida; para el Tech Lead, que decida si ese reposo del lado construido necesita su propio issue.

## Qué falta y quién decide

La salida 0 de una corrida completa sobre la rama no está registrada: las tres corridas completas de la rama salieron con 1, todas por el reposo del lado construido, que también falla en master (dos corridas) y que este cambio no toca (`settle.mjs` y `shot.mjs` fuera del diff, invariante 1). Hace falta una decisión humana: abrir un issue aparte para ese reposo (`restAfterShot` y el asentado bajo carga), o aceptar como evidencia las cuatro corridas de la rama, las dos de master y las repeticiones por fila con `--only`, que salen con 0.

## Decisión humana (cierra "Qué falta y quién decide")

Se aceptan como evidencia de este issue las tres corridas completas de la rama (que salen con 1 solo por el reposo del lado construido), las dos de master y las repeticiones por fila con `--only`, que salen con 0. El fallo intermitente de reposo del lado construido pasó al issue #601, así que este issue no espera una corrida completa que salga con 0. Lo que este issue arregla queda demostrado: las 37 capturas del diseño se toman en todas las corridas completas y las 348 capturas estables dan AE 0 antes y después.

Cabeza de la rama al registrar la decisión: `4f017f0c`. Corridas completas de la rama aceptadas: la primera (3 filas del lado construido sin reposo), `e8c9761a` y `79e131b2`; todas con salida 1 solo por ese reposo, y ninguna con una fila del lado del diseño fallida.

Cuenta: las corridas completas de la rama son **tres** (la primera, `e8c9761a` y `79e131b2`) y las de master son dos; la decisión humana acepta las que existen.
