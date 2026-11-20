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

La salida 0 de una corrida completa sobre la rama no está registrada: las tres corridas completas de la rama salieron con 1, todas por el reposo del lado construido, que también falla en master (dos corridas) y que este cambio no toca (`settle.mjs` y `shot.mjs` fuera del diff, invariante 1). Hace falta una decisión humana: abrir un issue aparte para ese reposo (`restAfterShot` y el asentado bajo carga), o aceptar como evidencia las tres corridas de la rama, las dos de master y las repeticiones por fila con `--only`, que salen con 0.

## Decisión humana (cierra "Qué falta y quién decide")

Se aceptan como evidencia de este issue las tres corridas completas de la rama (que salen con 1 solo por el reposo del lado construido), las dos de master y las repeticiones por fila con `--only`, que salen con 0. El fallo intermitente de reposo del lado construido pasó al issue #601, así que este issue no espera una corrida completa que salga con 0. Lo que este issue arregla queda demostrado: las 37 capturas del diseño se toman en todas las corridas completas y las 348 capturas estables dan AE 0 antes y después.

Cabeza de la rama al registrar la decisión: `4f017f0c`. Corridas completas de la rama aceptadas: la primera (3 filas del lado construido sin reposo), `e8c9761a` y `79e131b2`; todas con salida 1 solo por ese reposo, y ninguna con una fila del lado del diseño fallida.

Cuenta: las corridas completas de la rama son **tres** (la primera, `e8c9761a` y `79e131b2`) y las de master son dos; la decisión humana acepta las que existen.

## CI

Las dos corridas de `ci-ok` que figuran como fallidas (cabezas `93516bdc` y `08efdb4f`) fueron canceladas por concurrencia ("Canceling since a higher priority waiting request ... exists"), no por una aserción: la corrida 42391028088 sobre `93516bdc` terminó en éxito.

Decisión humana sobre CI: las dos corridas fallidas de `ci-ok` fueron cancelaciones por concurrencia (defecto registrado como agentic-system #539), no fallos de prueba. La corrida 42394295598 sobre la cabeza `b6f26e01` terminó en éxito con todos los trabajos en verde; la 42393982482 fue cancelada por el nuevo push. Se acepta `b6f26e01` como verde.

Estado de las corridas de CI por cabeza (consultado con `gh run list`): `93516bdc` terminó en éxito (42391028088, tras la cancelada 42390700607); `08efdb4f` terminó en éxito (42392668135, tras la cancelada 42392355633); `b6f26e01` terminó en éxito (42394295598, tras la cancelada 42393982482). Las cabezas `e9f4aa28` (42403074078 y su repetición 42403366963) y `baf288ed` (42404157485) quedaron canceladas (el trabajo `ci-ok` lo registra como `cancelled` en pytest, docs y e2e-shard; no se verificó qué push las canceló); ninguna terminó con una prueba en rojo. La corrida de la cabeza final se deja correr sin más pushes.
En la corrida cancelada 42404157485 el trabajo `coverage` figura como fallo, pero su paso fallido es el mensaje «no pytest data … (a shard failed before uploading, or none ran)»: los fragmentos de pytest fueron cancelados antes de subir datos, y `ci_verdict.py` lo marca «failure (warning)». Es un efecto de la cancelación, no una prueba roja. La repetición 42404489186 sobre `baf288ed` seguía en curso cuando se escribió esta nota.

## GH-806: las seis filas BarraInferior

Las seis filas `BarraInferior320|375|430` (clara y `Oscuro`) comparan la sección «BarraInferior · RielLateral · Aviso · Confirmacion» de `Componentes.dc.html`. Esa sección es un marco de 390 px más una columna `1fr`, más ancha que cualquier viewport del lado construido (320, 375, 430), así que el lado del diseño falla con «section outside the viewport» si usa el viewport de la fila. Por eso llevan `design_viewport: [1360, 844]`, el ancho propio del dibujo. Medido con el mismo cálculo de `sectionClip`, Geist local:

| screen | scrollWidth | innerWidth | clip x | clip right | frame width | @media |
|---|---|---|---|---|---|---|
| BarraInferior320 (y Oscuro) | 1360 | 1360 | 56 | 1304 | 1360 | no |
| BarraInferior375 (y Oscuro) | 1360 | 1360 | 56 | 1304 | 1360 | no |
| BarraInferior430 (y Oscuro) | 1360 | 1360 | 56 | 1304 | 1360 | no |

Dos corridas de las seis filas sobre la misma cabeza: AE 0 en los doce PNG (construido y diseño de cada fila). El recorte del diseño es la fila del título de la sección (el padre del texto de la etiqueta), no los marcos de abajo. Las filas `Oscuro` salen idénticas a las claras, igual que `VentasOscuro` e `InicioOscuro` en esta cabeza: el atributo `data-tema` que pone la captura no llega a pintar el tema oscuro.

## GH-903 parte 2: Paso 0 del título de Productos en el teléfono (falla en las cuatro celdas)

Medido con una página estática desechable (no se confirma) que carga el `tokens.css` y el `app.css` reales y Geist local, con este marcado: `div.productos-cabecera` > `h1.encabezado__titulo` «Products», `a.boton.productos-cabecera__nueva` (icono `agregar` de 22 px, `aria-hidden`, y «New product») y `a.inicio__avatar` con dos iniciales. Fila `display: flex`, sin envolver, `gap: var(--espacio-md)` (12 px; `--espacio-sm` es 8 px, y el avatar tiene `margin: -4px`, así que 12 px de `gap` dejan 8 px entre el borde de la pastilla y la caja de 44 px del avatar). Pastilla `flex: none`, `height: var(--alto-tocable)`, `padding: 0 var(--espacio-lg)`. El título es el elemento flexible.

El ancho de la fila es el del viewport menos 2 × `--margen-pantalla` (24 px). El ancho que necesita es el natural del título (85,1) + el de la pastilla (172,2) + la caja de diseño del avatar (36) + 2 huecos de 12 = 317,3 px.

| viewport | tema | ancho de la fila | necesita | falta | título (ancho real) | pastilla | hueco título-pastilla | hueco pastilla-avatar | líneas título / pastilla | veredicto |
|---|---|---|---|---|---|---|---|---|---|---|
| 320 | claro | 272 | 317,3 | 45,3 | 39,8 | 172,2 | 12 | 8 | 1 / 1 | falla: recorte (el título pierde 45,3 px y su `scrollWidth` supera su `clientWidth`) |
| 320 | oscuro | 272 | 317,3 | 45,3 | 39,8 | 172,2 | 12 | 8 | 1 / 1 | falla: recorte (igual) |
| 246 | claro | 198 | 317,3 | 119,3 | 0 | 172,2 | 12 | 8 | 1 / 1 | falla: recorte, desborde lateral (`scrollWidth` del documento > `innerWidth`) y solape (el título queda en 0 px) |
| 246 | oscuro | 198 | 317,3 | 119,3 | 0 | 172,2 | 12 | 8 | 1 / 1 | falla: recorte, desborde lateral y solape (igual) |

Ninguna celda falla por tamaño (pastilla y avatar de 44 px o más) ni por hueco (12 y 8 px). Con 246 px ni siquiera caben la pastilla y el avatar solos (172,2 + 8 + 36 = 216,2 > 198). La fila no cabe en una línea sin recortar el título, y el encargo prohíbe todo rescate (encoger, elipsis, `min-width: 0` en la pastilla, letra o relleno menores, una etiqueta más corta, una pastilla solo con icono, una fila que envuelva). Se detiene en el Paso 0: no se construyó nada de la parte de producción y el dueño decide el diseño.

Comparación de `Productos` y `ProductosOscuro` (`compare.sh --only Productos,ProductosOscuro`): el lado construido sale `not-captured` («no built screen yet») porque las filas aún no tienen la ruta `/varieties`. En el dibujo (414 px, claro y oscuro) la fila es «Productos», un botón redondo «···» (el hueco de Publicar catálogo), la pastilla «+ Producto» y el avatar «ZE», en una línea. La pastilla del dibujo dice «+ Producto», unos 70 px más angosta que «New product» (172,2 px), que es la etiqueta visible que fija el encargo.

### GH-903 parte 2: qué falta y quién decide

Falta una decisión del dueño sobre el diseño de la fila; ningún rol puede tomarla porque el encargo prohíbe cada rescate (fila que envuelve, pastilla solo con icono, etiqueta más corta, letra o relleno menores). Hasta que exista, no se construye `ProductsPhone`, no se cambian las filas `Productos` y `ProductosOscuro` de `scripts/design/screens.json` y el cuerpo de la lista del teléfono sigue mostrando «New product». Al reanudar, los huecos de 8 px salen de `--espacio-sm` (`--espacio-md` es 12 px, no 8 px como decía el plan).

### GH-903 parte 2: resolución (decisión del dueño: botón redondo solo ícono)

El dueño decidió que la acción «New product» de la fila de título del teléfono es un botón redondo solo con el ícono `agregar`, de 44×44 px y nombre accesible «New product» (`common:newVariety`); el título y el avatar conservan tamaño y letra. Mismo medidor, misma página desechable, con `.productos-cabecera` (`gap: var(--espacio-md)`, 12 px, que deja 8 px hasta la caja de 44 px del avatar por su `margin: -4px`), el título flexible, `a.boton-icono.boton-icono--lleno.productos-cabecera__nueva` y el avatar. El bloque de CSS de la página y el de `app.css` son idénticos (`diff` vacío).

| viewport | tema | ancho de la fila | título (real / natural) | botón | avatar | hueco título-botón | hueco botón-avatar | sobra | veredicto |
|---|---|---|---|---|---|---|---|---|---|
| 320 | claro | 272 | 168 / 85,1 | 44×44 | 44×44 | 12 | 8 | 82,9 | ok |
| 320 | oscuro | 272 | 168 / 85,1 | 44×44 | 44×44 | 12 | 8 | 82,9 | ok |
| 246 | claro | 198 | 94 / 85,1 | 44×44 | 44×44 | 12 | 8 | 8,9 | ok |
| 246 | oscuro | 198 | 94 / 85,1 | 44×44 | 44×44 | 12 | 8 | 8,9 | ok |

Una línea, objetivos de 44 px o más, huecos de 8 px o más, sin recorte, solape ni desplazamiento lateral. Con 8 px de `gap` (`--espacio-sm`) el hueco hasta el avatar sería de 4 px: por eso se usa `--espacio-md`. Las capturas de `Productos` y `ProductosOscuro` a 414×844 (`compare.sh --only Productos,ProductosOscuro`, ambas filas «ok») muestran el título, el botón redondo con el «+» y el avatar en una línea; el dibujo trae además el botón «···» (el hueco de Publicar catálogo, sin elemento en esta parte), la búsqueda y las pestañas Catálogo | Stock | Promos, que son de partes posteriores de GH-845. Las filas `Variedades`, `Productos` y `ProductosOscuro` recorren una misma pantalla viva (`/varieties`): un ofensor futuro se lista bajo cada nombre que lo reporta, y la captura de `Variedades` puede diferir del `Variedades.dc.html` antiguo (el dibujo es guía).

### GH-903 parte 2: la pantalla viva a 320 y 246 px

Mismo medidor sobre `/varieties` en la app de muestra (`scripts/design/sample-app.sh`, la misma siembra de La Huerta que `mobile_seed.py` pone en el proyecto móvil), con sesión iniciada, móvil táctil, claro (`tema=claro`) y oscuro (`tema=oscuro`). Cada celda coincide con el veredicto del Paso 0 (anchos dentro de ±1 px; aquí idénticos):

| viewport | tema | fila | título | botón | avatar | hueco título-botón | hueco botón-avatar | una línea | desborde horizontal | fondo / texto del botón |
|---|---|---|---|---|---|---|---|---|---|---|
| 320 | claro | 272 | 168 | 44×44 | 44×44 | 12 | 8 | sí | 0 | rgb(30, 107, 71) / blanco |
| 246 | claro | 198 | 94 | 44×44 | 44×44 | 12 | 8 | sí | 0 | rgb(30, 107, 71) / blanco |
| 320 | oscuro | 272 | 168 | 44×44 | 44×44 | 12 | 8 | sí | 0 | rgb(92, 197, 148) / rgb(14, 20, 17) |
| 246 | oscuro | 198 | 94 | 44×44 | 44×44 | 12 | 8 | sí | 0 | rgb(92, 197, 148) / rgb(14, 20, 17) |

El título no se recorta (`scrollWidth` igual a `clientWidth`) y el único enlace «New product» de la pantalla es el de la fila de título. El fondo y el texto del botón son `--boton` y `--boton-texto` de cada tema. La salida cruda es `products-phone-header-live.txt`.

### GH-903 parte 2: 900 px, antes y después

«Antes» es la construcción de `f3c05d24` (la base de la rama) y «después» la de esta cabeza; las dos se cargaron en la misma app viva, a 900 px de ancho, claro y oscuro, con la sesión de La Huerta. En ambos temas las capturas son idénticas byte a byte (`products-phone-header-900-before-*.png` y `products-phone-header-900-after-*.png`) y se ve el diseño de computadora de siempre: «Products» como título del panel central, «New product» como enlace en el cuerpo de la lista, sin bloque de título del teléfono. El `outerHTML` de `main` coincide en un tema y en el otro difiere solo en `aria-current="page"` de la primera fila, que cambia de una corrida a otra del mismo lado (el estado de la selección al asentarse), no entre «antes» y «después»; la salida está en `products-phone-header-900.txt`.

No se corrió el proyecto móvil de e2e por completo: queda a CI al aterrizar.

Revisión final: `compare.sh --only Productos,ProductosOscuro` se corrió de nuevo sobre `f66149b2` (ambas filas «ok») y se vieron las dos comparaciones: la fila de título del teléfono muestra «Products», el botón redondo con «+» y el avatar en una línea, en claro y en oscuro, sin enlace «New product» en el cuerpo de la lista.
