---
status: accepted
date: 2026-10-25
---

# One shot method for every design-capture row and both sides

GH-301 (the request called this ADR-0050; 0050 and 0051 were taken). Supersedes ADR-0042's GH-273
rule 5, "The shot never disturbs the page", on how the shot is taken only. The measurements are in
`docs/evidence/GH-301-shot-method.md`.

## Decision

- **One method.** Every row and both sides call the same `takeShot` (`scripts/design/comparisons.mjs`).
  Every decision in it is a pure function in `scripts/design/shot.mjs`; nothing branches on the row,
  the side, the design file, the viewport width or the kind of screen. The side only names a failure.
  `fullPage` and the `block.screenshot` branch are gone: every shot is a plain `page.screenshot`
  with the section's clip when the row has one.
- **Layer or grow, decided first.** `planShot` evaluates `coversScreen` before anything moves: a fixed
  element counts only when displayed, visible, opacity above 0, and its intersection with the viewport
  spans the full width and at least half the height. A layer is never grown. Its frame must lie inside
  the viewport and no element inside it may be scrolled (`layerMiss`); a list that scrolls inside a layer
  by design is shown at its top and `scrollTop` is never reset. Any other page grows the viewport once,
  to the document's height at the registered width, before the final settle.
- **Checks after the final settle** (`sizeRecordMiss`, `regionMiss`). The size rule is a predicate on
  the change, never a list of selectors: on a grown side, a top that moves (fixed and sticky elements
  and their descendants exempt from the top only), a width change, a height shrink, a replaced node or a
  count change is a miss. Then the document fits the viewport in both axes (a built page wider than its
  registered width fails; it used to be a note), or, for a section, the clip does. After the shot the
  viewport must still be the size it was at the settle (`viewportUnchanged`).
- **A miss is a failure of the side.** `sideOutcome(reason, null)`: `null` in `index.json`, no PNG, a
  fixed English reason of the form `shot: <what> (design|built)` (no page text, no number, no error
  text; a timeout is `shot: timed out taking the shot (<side>)`), and `--strict` exits non-zero after
  every row has run. Each step is bounded at 8 s. The existing Spanish reasons are kept.
- **Stale files.** Before a row runs, its `<screen>.design.png` and `<screen>.built.png` are deleted
  from `--out` by exact name, so a side PNG only ever comes from that run's own buffer. Each evidence
  run uses a fresh `compare.sh` directory.
- **Fonts.** The design context serves Google Fonts from `@fontsource/plus-jakarta-sans`; the built
  page loads its own. A design-side font the route cannot serve fails the row through `fail(ctx)` but
  does not null that side's buffer: outside the method, recorded as a risk.

## Why the viewport grows, and the seller's view

The probe (evidence doc) tried CDP `captureScreenshot` with `captureBeyondViewport: true` and an
explicit clip: Chromium resizes the viewport to 1x1 and back inside the call, and on the 1280 px rows
the 900 px query flips off and on and nine fetches are re-issued. It fails its pass criterion, so
`captureBeyondViewport` is not used. Growing the viewport first moves nothing at the registered width.

The seller's view: fixed chrome appears once, at the document's edges, and `dvh` boxes keep their
registry size. A layer is never grown, so the `dvh` boxes of a layer keep their registry size. A page
whose in-flow elements follow a `min-height: 100dvh` box (the phone bottom bar under `.disposicion`)
does not: growing the viewport moves them, and the size rule then fails that side instead of shooting a
view the seller never sees (risk 1).

## The layer class and the design side

A layer is a fixed element covering at least half the screen (the half-height predicate: a phone
sheet that starts just under the top counts, a 60 px bar or a toast does not). The design side reaches
it as a section of the device's size: no prototype uses `vh`, `dvh`, `position: fixed` or
`height: 100%` (0 matches), so a prototype is never a layer, and the three Compu sections are exactly
the device's size. The four phone layer rows reach the design side as a section taller than the phone.
A shot of a layer is taken at the viewport; the document behind it may scroll and is not checked.

## Criteria

(a) repeatable; (b) one method for every row and both sides; (c) the seller's view at the row's
registry viewport, with nothing moved, stretched or cut off by the shot; (d) every difference against
the old tooling judged.

## Cost

Linear in the drawn elements of each grown side: two snapshots and one identity pass. Constant work on
the other sides. Nothing runs in the app, the gate or CI.

## Known risks

1. The first real grown shot is first seen in the hand checks; the census compared sizes on pages it
   threw away, and did not read tops. A red strict run stops the work; no check is loosened. A first
   smoke run of this tooling (`--only` of eight rows, 2026-10-25) shot `NuevaVenta`, `Cobro`,
   `CobroCompu`, `PrecioNuevoCompu` and `InicioCompu` on both sides and missed: `Inicio` built (the
   bottom bar and the new-sale button move their top by the growth: `shot: the page changed when the
   viewport grew`), `Gastos` built (same), `VariedadesCompu` built (`shot: page taller than its
   viewport`: after the growth the document is still taller than the viewport) and `Inicio` design (the
   section's clip spans x 24 to 414 in a 390 px viewport: `shot: section outside the viewport`).
2. A design-side font the route cannot serve fails the row but does not null that side's buffer.
3. A large grown page may miss the 8 s bound and fail with the fixed timeout reason.
4. A grown page shows its background below its content.
5. The four phone layer rows reach the design side as a section taller than the phone.
6. The seed day was 2026-10-24, not the pinned 2026-09-16, and 50 rows have no old counterpart (27
   old rows with Spanish labels and 23 new rows); (d) is judged against the census run.

## Amendment (GH-440): the step bound is an option

Known risk 3 was met by the census test: the gate's `web-tests` failed once with `shot: timed out
taking the shot (design)`, because under `parallel_checks` the census runs beside pytest, mypy, tsc and
the build, and a starved page load takes 8 to 20 s.

- The step bound still defaults to 8000 ms.
- `--step-timeout <ms>` (an integer of at least 1; anything else exits with status 2) sets it for the
  whole run, in `withinTimeout` and in the built page's Playwright default.
- The design page's Playwright default is the larger of 30000 ms and the bound.
- The settle bounds count frames and are unchanged.
- The census test runs at `CENSUS_STEP_MS` (60 s), because under `parallel_checks` its group no longer
  has an idle CPU.
- `compare.sh` still runs at 8 s.

## Amendment (GH-491), 2026-11-07

Las filas de teléfono se sacan en su viewport real, con scroll y costura. Escritorio sigue creciendo, y
las capas siguen sin moverse. Lo de arriba no se reescribe: esta enmienda lo completa. `takeShot` y sus
ayudas viven ahora en `scripts/design/take-shot.mjs`; las decisiones puras siguen en `scripts/design/shot.mjs`
y `scripts/design/stitch.mjs` solo copia filas.

### El problema

Crecer el viewport hasta la altura del documento, en el teléfono, mueve el chrome fijo, las cajas
`min-height: 100dvh` y la barra inferior, y `sizeRecordMiss` rechaza la toma (`the page changed when the
viewport grew`). Home con la barra de #373 y Analysis, clara y oscura, no se podían capturar.

### Método

- **Una sola rama sobre la clase de fila.** `planShot` devuelve `layer` si `coversScreen` se cumple, `scroll`
  si no y el ancho del viewport es menor que 900, y `grow` en cualquier otro caso, igual que antes. Vale para
  el lado de diseño y para el construido; el lado solo nombra la falla.
- **`fullPage` y `captureBeyondViewport` siguen sin usarse.** Los dos agrandan el viewport (el segundo por
  dentro de la llamada), y eso es justo lo que mueve el chrome fijo y las cajas `100dvh`. El método nuevo
  nunca cambia el viewport: lo fija el contexto una vez.
- **Un cuadro por tramo.** `scrollPlan` arma los cuadros `{ offset, cropTop, cropHeight }`: empiezan en 0 (o en
  `clip.y`), avanzan de a una altura de viewport, cortan en los bordes de los sticky, achican el último
  `offset` a `scrollHeight - height` y recortan lo que se repite. Con un `clip` cubre su rango vertical; un
  `clip` más ancho que el viewport sigue siendo `section outside the viewport`. Un `dpr` que no es entero se
  rechaza con `device scale factor is not a whole number`.
- **Redondeo en un solo lugar.** Solo `scrollPlan` redondea: los offsets en px CSS enteros, los recortes en px
  de dispositivo enteros. `stitch` y `take-shot.mjs` reciben enteros y nunca redondean; `stitch` tira un
  error ante un valor que no lo sea.
- **El documento es el único que scrollea.** `innerScrollMiss` rechaza la página (`the page scrolls inside an
  element`) cuando un elemento que no es una capa scrollea y el documento no. Nunca se cose el scroll
  interno de un elemento.

### Lo fijado: `pinnedClass` es una regla

`pinnedClass` es el único lugar que clasifica un elemento fijado, y lo hace por el `position` computado del
elemento mismo: `fixed` es `chrome` (se dibuja en el cuadro 0 y se oculta después, no ocupa lugar en el flujo)
y `sticky` es `content` (se dibuja una vez, en su lugar natural). `fixed` gana sobre cualquier ancestro. No hay
selector ni bloque contenedor en la regla; `.bar-inferior`, `.nueva-venta-flotante` o un encabezado sticky son
ejemplos, no la condición. `shot-page.mjs` solo informa el `position`, y `fixedInPage` lo sigue leyendo para
el predicado de capa sin clasificar.

- **`viewportFixed`.** Un `fixed` se prueba pegado al viewport cuando `rect.top = insetTop + marginTop` o
  `rect.bottom = viewport.height - insetBottom - marginBottom`, con 0,5 px CSS de tolerancia (una
  comparación, no un redondeo). Si los dos insets son `auto`, si no vale ninguna de las dos ecuaciones (un
  ancestro con `transform`) o si su propio `transform` no es `none`, el lado no se captura con `a pinned
  element could not be placed`.
- **`hiddenRule`.** Devuelve el texto de la hoja de una sola toma. Oculta subárboles enteros (la cadena de
  `:nth-child` y sus descendientes, más `::before` y `::after`) con `visibility: hidden !important`, para
  todo lo que no va en este cuadro, y hace visible, por su propia cadena, a un descendiente `fixed` que sí va
  en este cuadro. La hoja es una `CSSStyleSheet` adoptada y se saca después de cada cuadro: ningún módulo
  toca un nodo, un estilo ni un atributo de la página.
- **Lugar natural por sondeo.** Para cada sticky, `stickyProbeOffset` da el offset al que sale de su
  contenedor (abajo: `clamp(containerContentBottom + insetBottom - viewport.height, 0, maxOffset)`; arriba:
  `clamp(containerContentTop - insetTop, 0, maxOffset)`). Se scrollea ahí, se asienta con `advanceMs: 0`, y el
  lugar natural es `rect.top + offset`. Si el elemento sigue pegado en ese offset, no se puede medir su lugar
  y el lado no se captura.
- **S0 y S0'.** Se toma la foto S0 en 0, se sondea cada sticky, se vuelve a 0, se asienta y se toma S0'.
  `shiftMiss(S0, S0')` tiene que pasar, y también compara el `--vv-alto` en línea: así se descubre un
  encabezado que colapsa o una carga perezosa antes de sacar un solo cuadro.
- **`stickyPlacement` asigna cada elemento a un único cuadro.** El chrome va al cuadro 0; un sticky va al cuadro
  cuyo recorte contiene su rectángulo natural entero. Devuelve `a pinned element could not be placed` cuando
  el chrome no se ve en el cuadro 0, un sticky es más alto que un cuadro, el borde de un cuadro corta a otro
  elemento fijado o dos bordes se contradicen.
- **Un hueco o un doble dibujo nunca se aceptan.** Lo que las decisiones puras no pueden ubicar es un lado
  `not-captured` con una razón con nombre, y no se parcha.
- **`shiftMiss` en cada cuadro.** Se compara cada cuadro contra el cuadro 0. Es una falla: `scrollTop` fuera
  del offset planeado; otro `scrollHeight` o viewport; para un elemento no fijado, otra posición en la página
  (`top + scrollTop`), otro ancho o alto, o un nodo reemplazado; un cambio de cantidad; y, para un fijado, otro
  tamaño (su `top` no se compara). La razón es `the page changed while it was shot`.

### Costo

Una captura, una foto de tamaños y una pasada de identidad por cuadro, más un scroll por cada sticky:
lineal en los elementos dibujados por la cantidad de cuadros. Escritorio y capas no cambian de costo.

### Riesgo 5, resuelto

El riesgo 5 (las cuatro filas de capa de teléfono llegan al lado de diseño como una sección más alta que el
teléfono) se resuelve: ese lado ahora es `scroll`, y `scrollPlan` cubre el rango vertical del `clip` con
varios cuadros y recorta al `clip`.

### Riesgos nuevos

1. Un sticky que el borde de un cuadro no puede evitar, dos sticky cuyos bordes se contradicen, o un `fixed`
   que no se puede probar pegado al viewport, se rechazan y nunca se parchan: la fila queda `not-captured`
   con `a pinned element could not be placed`.
2. Si la lectura de vuelta del sondeo falla (el elemento sigue pegado, o S0' difiere de S0), el lado es
   `not-captured`: no se adivina un lugar natural.

Date: 2026-10-27.
