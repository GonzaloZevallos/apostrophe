# GH-301: how a shot is taken, measured

Review evidence only: nothing here is a gate, CI or `.agentic/stack.yaml` step. Valid only for the SHAs below. Only class paths, sizes, booleans, counts and coordinates are recorded; no page text.

## Pinned inputs

- App commit (master at the start of the runs): `2c49d36164871ba3d0c92b4474376a98c3a618fa`. `git diff --stat 2c49d361 HEAD` outside `scripts/design`, `web/src/design` and `.agentic` is empty, so the branch's checkout is that app.
- Branch tooling commit: `a3c5ac83` (the census run's `scripts/design`).
- Old tooling: `6541887d`'s whole `scripts/design`, never patched, laid over a scratch tree of `2c49d361` (`git archive`, `web/node_modules` and `.venv` linked, the scratch tree's `web/src/design/*.test.ts` removed because the old `.d.mts` files fail `tsc -b`, the build the sample app runs first; the same measure GH-273 used).
- `@fontsource/plus-jakarta-sans`: 5.3.0. Node v24.21.0. Playwright from `web/node_modules`.
- Seed day: **not the pinned 2026-09-16**. `sample_app.py` has no `PINNED_DAY`; the sample takes the machine's day, `2026-10-24`, and the capture's clock is paused at that day's noon (`facts.today`). The census run and the probe both used `2026-10-24`.

## The old-tooling baseline: baseline not obtained

Command (in the scratch tree): `scripts/design/compare.sh --only Inicio --strict`. Exit 1, first error line:

```
Inicio: lo construido no se pudo capturar: estado no alcanzado en {"click":"Semana"}: locator.click: Timeout 8000ms exceeded.
```

The sample app starts and seeds; what fails is the old registry against the current app: its steps click Spanish labels the app no longer has (the app now says `Week`). 14 of the old registry's 15 distinct `click` labels are not in the current registry, and 27 of its 156 rows use one. The old tooling is never patched, so per the plan the two old runs were not taken. **Baseline not obtained: old run 1, old run 2, `ae --box` old1-vs-old2, `ae --box` old1-vs-census, the unstable rows and N are not available. No N is given.**

## Probe: CDP `Page.captureScreenshot`, `captureBeyondViewport: true`, explicit clip

Throwaway script, not committed. Built side of `PrecioNuevoCompu`, `VariedadesCompu` and `Inicio`; the fake clock paused as in the capture; `deviceScaleFactor` 2; clip `{x:0, y:0, width: viewport width, height: scrollHeight, scale: 2}` through `page.context().newCDPSession(page)`. Counted in the page across the shot: `resize` events, `innerHeight`, `(min-width: 900px)` change events, `fetch` calls started and completed (the method of GH-273's diagnosis).

| Row | Viewport | scrollHeight | resize events | innerHeight after | 900 px changes | fetches started/completed before -> after |
|---|---|---|---|---|---|---|
| PrecioNuevoCompu | 1280x920 | 1059 | 2 (`1x1`, `1280x920`) | 920 | `false`, `true` | 11/11 -> 20/20 |
| VariedadesCompu | 1280x920 | 1090 | 2 (`1x1`, `1280x920`) | 920 | `false`, `true` | 10/10 -> 19/19 |
| Inicio | 390x844 | 1699 | 2 (`1x1`, `390x844`) | 844 | none (already below 900) | 5/5 -> 5/5 |

- **Fixed criterion not met: the shot resizes the viewport.** Even with an explicit clip, Chromium takes a `1x1` then back-to-viewport resize inside the call. On the two 1280 px rows the 900 px query flips off and on and exactly nine fetches are re-issued (the remount of GH-273); `Inicio` has no flip and no refetch. A node marker on `.columna-principal` / `main` stayed the same, which does not rule a remount out: GH-273 found the contents of `.columna-principal` replaced, not the container, and the nine refetches are the evidence of it.
- Where the bar lands: a pixel comparison of the probe shot against a reference (viewport grown to `scrollHeight`, plain shot, same page afterwards) differs in `Inicio` over y 3104 to 3359 of 3398 px, in `PrecioNuevoCompu` over y 1396 to 2117 of 2118 px, and in `VariedadesCompu` in 3444 px at y 1458 to 2179. Crops of the last 420 rows (probe shot on top, magenta line, grown reference below): `GH-301/Inicio-bottom.png`, `GH-301/PrecioNuevoCompu-bottom.png`. In the `Inicio` crop the probe half (top) ends on the bottom bar (Home, Sales, Customers, Varieties, More) right above the magenta line, so there the bar is at the probe shot's end edge; the reference half (bottom) has no bar in its last rows, so the two shots do not agree on where the bar is. The probe fails on the resize alone, so the bar was not pursued further.
- The probe's list of `position: fixed` elements has no bar on `Inicio` and `VariedadesCompu` (the `Inicio` crop does show a bottom bar, so that list is not evidence of its absence) (the only fixed element on `PrecioNuevoCompu` is the modal layer, 0 to 920). The 900 px flip is measured here by the probe; `--vv-alto` is written by `useVisualViewport.ts`, which the census only reads.

## Census run (the branch's tooling, `--strict --census`, whole registry)

- Command: `scripts/design/compare.sh --strict --census`, no `--only`, a fresh sample app; start 2026-10-24 20:52:59 -03:00, end 21:04:43; exit 0; rows 179 (156 of the old registry plus 23 new).
- `deviceScaleFactor` read from each side's options: 2 on every side. Both sides of every row were captured (no `null` in `index.json`); no side failed; no `census_error`; no row is missing a census.
- `index.json` copied out of the temporary directory before this doc was written; not committed (it carries each PNG's temp path).
- Class per side (358 sides), precedence layer > grown > wide > neither: **layer 11, grown 210 (design 126, built 84), wide 4, neither 133**.

### Layer rows (all on the built side)

`section_is_device_size`: the row's design PNG width and height divided by the factor equal the row's viewport exactly.

| Row | Viewport | Design PNG | section_is_device_size | Grown | Layer's own box overflows | Frame inside viewport | Changed elements |
|---|---|---|---|---|---|---|---|
| NuevaVenta, NuevaVentaOscuro | 390x844 | 780x2152 | false | no | no | yes | 0 |
| NuevaVentaCliente, NuevaVentaClienteOscuro | 390x844 | 780x2000 | false | no | no | yes | 0 |
| Cobro, CobroOscuro | 390x844 | 780x2016 | false | yes (844 to 905) | no | yes | 11 |
| CobroCompu, CobroCompuOscuro | 1280x920 | 2560x1840 | true | no | no | yes | 0 |
| PrecioNuevoCompu, PrecioNuevoCompuOscuro | 1280x920 | 2560x1840 | true | yes (920 to 1059) | no | yes | 4 |
| VariedadNuevaCompu | 1280x920 | 2560x1840 | true | no | no | yes | 0 |

- `Cobro*` changed: `html`, `body`, `div`, `div.disposicion`, `div.columna-principal.columna-principal--sin-bar`, `main.pantalla`, `div.cobro-paneles__detalle`, `div.cuerpo` (ordinal 1) by under 1 px (904.89 to 905); `main.pantalla.cobro-hoja`, `div.cuerpo` (ordinal 0) from 740 to 801 and `form.formulario` from 567 to 628.
- `PrecioNuevoCompu*` changed: `div.variedades-paneles__lista`, `main.pantalla.variedades`, `div.cuerpo`, `main.pantalla.precio-modal`, each 920 to 1059.
- Inner scroll containers (client / scroll height, scrollTop 0): `NuevaVenta*` `div.nueva-venta__disposicion` 844 / 932; `Cobro` `main.pantalla.cobro-hoja` 740 / 740; `CobroCompu` `main.pantalla.cobro-modal` 920 / 920. Of the four design-side shapes, only the three Compu ones are a section of the device's size; the four phone layers' design files are taller than the phone.

### Grown rows

210 sides are grown. Elements with a changed size are recorded only on built sides: **73 grown sides have changed elements, 137 grown sides have none**; all 126 design sides that are grown have none. The recurrent changed paths, in the number of rows each appears in (all entries `same_node: true`, `query_900: n/a`, `vv_alto: absent`):

| Changed element | Rows |
|---|---|
| `html`, `body`, `div` (the root wrappers) | 75 |
| `div.disposicion` | 69 |
| `div.cuerpo` (not `.pantalla`, not an ancestor) | 68 |
| `div.columna-principal` | 67 |
| `main.pantalla` | 66 |
| `nav.riel-lateral` (not `.pantalla`) | 17 |
| `main.pantalla.variedades` | 10 |
| `div.variedades-paneles__lista` | 7 |
| `main.pantalla.onboarding` | 6 |
| `div.variedades-paneles`, `div.variedades-paneles__detalle` | 5 |
| `div.clientes-paneles`, `__lista`, `__detalle`, `main.pantalla.cobro-hoja`, `form.formulario`, `div.cobro-paneles__detalle`, `main.pantalla.precio-modal`, `div.gastos__mes`, `div.cuerpo.ajustes`, `div.columna-principal.columna-principal--sin-bar` | 2 each |
| `div.cuerpo.gastos` | 1 |

Across all 577 changed-element entries the flags are one value: the 900 px query `n/a` (the width never changes), `--vv-alto` `absent`, `same_node` true. So growing the viewport to the document's height changed no element's identity and flipped nothing, and the elements that move are the screen's height-bound boxes (`.pantalla`, its ancestors, `.cuerpo`, `.riel-lateral`). The 900 px flip belongs to the shot itself (the probe above), not to the growth.

### Wide rows

4 sides: the design side of `InicioChecklist`, `InicioChecklistOscuro`, `InicioImportado`, `InicioImportadoOscuro` (document 414 wide in 390, height 844, so a `fullPage` shot is asked for only there). Other sides whose document is wider than the viewport are classed grown because the document is also taller (the design sides of `Inicio`, `InicioHoy*`, `InicioPrimeraVez*`, `InicioOnboarding*`, `Variedades`, `VariedadDetalle`, `Catalogo`, `Onboarding*`).

### Neither: 133 sides.

## Rows absent from the old registry (23)

`InicioOnboardingEnCurso`, `InicioOnboardingEnCursoCompu`, `InicioOnboardingEnCursoOscuro`, `InicioOnboardingCompleto`, `InicioOnboardingCompletoCompu`, `InicioOnboardingCompletoOscuro`, `InicioChecklist`, `InicioChecklistCompu`, `InicioChecklistOscuro`, `InicioImportado`, `InicioImportadoCompu`, `InicioImportadoOscuro`, `InicioCompuOscuro`, `InicioMesCompu`, `InicioHoyCompu960`, `InicioCompu960`, `InicioMesCompu960`, `InicioHoyCompu960Texto130`, `InicioCompu960Texto130`, `InicioMesCompu960Texto130`, `InicioHoyCompuTexto130`, `InicioCompuTexto130`, `InicioMesCompuTexto130`. No row of the old registry is absent from the current one.

## `ae --box` and N

Not available: the old runs were not taken (see the baseline section). Unstable rows (old1 vs old2): not measured. Failed sides: none in the census run. Rows with no census: none. **N: not given.**
