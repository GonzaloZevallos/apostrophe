# GH-273: capture at rest

## Diagnosis

Diagnostics, not before/after evidence. Run on the task base (`6541887d`, the base's own tooling, an uncommitted throwaway copy), single row `VariedadesCompu` (built side only, 1280x920, light), Playwright 1.63.0, `@tanstack/query-core` 5.104.1, on a machine already loaded (load average about 22 on 16 cores). Each run is a fresh context on the same sample database. The throwaway copy is not committed.

Per sampled frame it logged only: `button.interruptor`'s `disabled` and `aria-checked`, the probe's in-flight and completed counts, a MutationObserver flag, the number of extra real `MessageChannel` hops until the flag stayed clear (five clear hops in a row), and `getAnimations().length`. Outside the frames it also logged the fetch pathnames (ids replaced by `N`), the `resize`, `focus`, `visibilitychange` and `(min-width: 900px)` change events, and the names of the DOM nodes replaced after the shot. No page text, amounts or names. The gray/black verdict is the pixel of the switch's track in the PNG itself (`121,118,113` gray, `35,30,24` black), never a guess from the DOM.

### Result: base fails, and it is neither hole (a) nor hole (b)

Neither of the brief's two holes is the cause. In every run the switch was `disabled=false`, `aria-checked="true"`, with no request in flight and the mutation flag clear in all the settled frames (the first one, three equal frames, and the final settle). `isFetching` was not true while the counter read idle, and the flip did not land among the three equal frames. The gray appears only **after** the settled frames, **inside `page.screenshot({ fullPage: true })`**.

The chain, measured:

1. A `fullPage` screenshot of a page taller than the viewport makes Chromium resize the viewport momentarily to 1x1 (`resize:1x1`, then `resize:1280x920`).
2. At 1x1, `matchMedia('(min-width: 900px)')` changes to `false` and back to `true` (`mq900:false`, `mq900:true`). `useViewport` flips `computer` to `phone` to `computer`, and `Shell` replaces the contents of `.columna-principal` twice (two removals, two additions).
3. The page remounts, its queries re-subscribe, and all nine of them refetch (`Ie.onSubscribe` in the stack): `/pricing-settings`, `/varieties/N`, `/varieties/N/prices`, `/stock`, `/stock/varieties/N/movements`, `/catalog`, `/varieties`, `/first-run`, `/varieties`. The completed count goes from 10 to 19.
4. `VarietyThresholdSection` is `disabled={saving || refreshing}` with `refreshing = stockQuery.isFetching`, and `.interruptor:disabled` draws at opacity 0.6. A shot taken while `/stock` is being re-read is gray; one taken before the dance reaches the page is black.
5. Whether the pixels are taken before or after the disabled state is painted is a race against the load of the machine, hence the unrepeatable result. It is not a fetch the counter missed, and it is not a transition. The refetch runs on the real network, but its answer is drawn only when the fake clock advances, so the page stays disabled until the next frame.

The same dance happens on a phone row, but there `(min-width: 900px)` is false at 390 px as well, so no flip and no remount follow. It only bites rows of 900 px or more that are taller than their viewport.

### Failure rate p

Whole-run N, `--only`-style single row, full-page shot as the base does it:

| CPU throttling (CDP `Emulation.setCPUThrottlingRate`) | N | gray | p |
|---|---|---|---|
| none (1) | 20 | 2 | 0.10 |
| 4 | 12 | 10 | 0.83 |
| 10 | 12 | 8 | 0.67 |

At no throttling p varied between runs of the same command with the machine's load: an earlier batch of 6 had 5 gray and another of 4 had 4 gray. A better-grounded statement is p = 0.1 to 0.8 depending on load. Every gray run had `after.disabled=true` and `completed=19` right after the shot (`completed=10` and enabled in every black one), so the refetch is what makes it gray.

The gray runs always settled in 7 or 8 frames and returned no failure from `settleWith`: base reports them as a pass.

### Control: no dance, no gray

The same row, the viewport set to the document's `scrollHeight` (1280 wide, so no media-query change) before the final settle, then a plain (not full-page) screenshot: **0 gray in 24** (12 at throttling 4, 12 at throttling 10), no resize event after the settled frames, no fetch after the shot, `completed` stayed at 10.

### Commit lag, in hops

- **Largest lag observed: 0 extra real hops**, in every frame of every run (settled frames and 12 frames after the shot, over 20+12+12+24 runs, throttling up to 10x). After the standard real hop, the mutation flag was never set by a commit landing later than that hop; a mutation that was seen was seen in the first read. The extra hops therefore found nothing to wait for at these rates.
- **Proposed `SETTLE_QUIET_HOPS`: 2** (observed 0, plus a margin of 2 on a count that is cheap). This is a safety margin on a figure measured as 0, not a measured need. It must not be read as evidence that the hops fix this: **they do not**, because the commit that matters happens after the settle, during the shot.
- The lag is bounded, so the stop condition "no fixed hop count covers it" does not apply. No time-based wait is proposed anywhere.

### What this means for the plan (for the Tech Lead)

- Base can be made to fail (p up to 0.83), so the second stop condition does not apply.
- **The plan's mechanism 3 (quiet hops) and 5 (three calm frames) cannot fix this cause**, since the settled frames are all clean. Only mechanism 6 (the check after the shot) sees it: in the gray runs the first frame after the shot has `idle=false` and the mutation flag set (the remount), while in black runs it is calm. The hash is the same in both (`5ec840d1`, the base's hash does not see `disabled`), so only the mutation flag and the in-flight count tell them apart.
- Consequence: with the check as planned, a `Compu` row whose shot dances the viewport would fail its row in roughly the same proportion as it is gray today (p of 0.1 to 0.8), instead of being repeatable. The capture needs to stop causing the refetch it then waits for. The control above shows one way that was measured: size the viewport to the document before the final settle and take a plain shot, so the screenshot never resizes the viewport. A decision for the Tech Lead; it changes `comparisons.mjs` (both sides, every row taller than its viewport) and says something about rows whose layout depends on viewport height. It was not tried on other rows.
- The cause is also in `ADR-0042`'s record: the GH-261 amendment's "unsettled CSS transition" is wrong (the switch has no transition), and so is a "background re-read the screen started on its own": the re-read is started by the capture's own screenshot.
- Not investigated: why some full-page shots, at no throttling, do not reach the `1x1` flip before the pixels are taken (the black runs show a single `resize` event).

## Evidence on the head (captured 2026-10-20, Argentina day, shared loaded machine)

Review evidence only: nothing here is a gate, CI or `.agentic/stack.yaml` step. Valid only for the SHAs below.

- Task base (tooling and app before the change): `6541887d3c808164d0d1da97ea21084e81e2854a`.
- Head captured: `27eefcb060f4b74b3e2cd855827c554cb5484417`. Its only later commit is this evidence.
- `@fontsource/plus-jakarta-sans`: 5.3.0 (head's `web/node_modules`). Node v24.21.0.
- Overlay (ADR-0042, GH-219) used for the base side: head's whole `scripts/design/` over the base's own `app/` and `web/`; its diff stat is the stat of `git diff --stat 6541887d..HEAD -- scripts/design`: 4 files changed, 224 insertions(+), 46 deletions(-) (`comparisons.mjs`, `probe.mjs`, `settle.d.mts`, `settle.mjs`).

### Five whole-registry `--strict` runs of the head (done)

Each on a fresh sample, no `--only`, one after the other, on the shared machine (load average 6 to 17 around them). Per run: `head-runN/{strict-console.txt,exit-code,times.txt,index.json}`.

| Run | Start | End | Exit |
|---|---|---|---|
| 1 | 10:01:57 | 10:08:55 | 0 |
| 2 | 10:09:54 | 10:18:13 | 0 |
| 3 | 10:19:10 | 10:25:56 | 0 |
| 4 | 10:26:45 | 10:35:13 | 0 |
| 5 | 10:46:28 | 10:55:22 | 0 |

A first attempt at run 5 was cut off by the capture wrapper's own 590 s cap (not by the capture), left no `index.json` and does not count; run 5 above is its retake from scratch, on the same sample method.

`ae.mjs` run 1 against runs 2 to 5 (`ae-head-1-vs-N.txt`): each prints 312 lines (156 rows, both sides), every one `AE 0`, exit 0. **0 non-zero lines, `VariedadesCompu built` included; no `null` side in any `index.json`.**

### The switch, judged by eye and by pixel

`VariedadesCompu-built-switch-head-run1.png` (a crop of the head's run-1 capture, 2x): the "Aviso de stock bajo" switch is **enabled and on** (black track, white thumb at the right), the state the sample's stored threshold gives it, not the grey of the disabled state. The track pixel is `35,30,24` (black) in all five runs. The registry has no dark `VariedadesCompu` row, so there is no dark capture of it.

### Five whole-registry `--strict` runs of the base, with head's tooling (overlay)

Base = `6541887d` (its own `app/` and `web/`), head's whole `scripts/design/` over it. The scratch tree is `git archive 6541887d` with the overlay, `web/node_modules` and `.venv` linked from this checkout; the base's two `web/src/design/*.test.ts` files were removed from the scratch tree because they are not served and the overlay's `settle.d.mts` no longer fits them under `tsc -b` (the build the sample app runs first). Fresh sample per run, no `--only`, same Argentina day. Per run: `base-runN/`.

| Run | Start | End | Exit |
|---|---|---|---|
| 1 | 11:37:35 | 11:44:49 | 0 |
| 2 | 11:45:37 | 11:54:37 | 0 |
| 3 | 11:55:31 | 12:04:15 | 0 |
| 4 | 12:05:20 | 12:12:23 | 0 |
| 5 | 12:13:13 | 12:19:46 | 0 |

- `ae.mjs` base run 1 against runs 2 to 5 (`ae-base-1-vs-N.txt`): 312 lines each, **0 non-zero**.
- `ae.mjs` base run 1 against head runs 1 to 5 (`ae-base1-vs-headN.txt`): 312 lines each, **0 non-zero**, `VariedadesCompu built` included, no `null` side in any `index.json`.

This compares the same app under the same (head's) tooling, so it shows the head's own change to `app/` and `web/` (tests only) leaves every pixel as it was. It does not compare the shot change against the old shots: that is the next section.

### The old tooling against the new, on the same app (the `fitViewport` / `fullPageIfWide` question)

Two more whole-registry `--strict` runs, `6541887d`'s own `scripts/design` on `6541887d` (`oldtool-run1/2`, both exit 0, run after the base runs), each compared with head run 1 (`ae-oldtool1-head1.txt`, `ae-oldtool2-head1.txt`) and with each other (`ae-oldtool1-2.txt`).

- **48 non-zero rows, every one a `built` side**, identical in both old runs (the same 48 rows with the same AE, so it is a deterministic difference of the tooling, not noise). No `design` side differs and none is `different dimensions`. Old run 1 against old run 2 has 0 non-zero line(s).
- The pattern is the phone rows with a fixed bottom bar (AE about 80,000 on `Inicio`, `Ventas`, `Clientes`, `Variedades`, `Gastos`, `Mas`, `EstadosSinConexion`, ...; about 7,600 to 8,000 on the others), a few large (`CobroCompu` 128,000, `PrecioNuevoCompu` 711,680, `Analisis` 199,324, `EstadosConfirmar` 331,646, `VariedadNuevaCompu` 277,682) and `VariedadesCompu built` 468. Not looked at row by row.
- Reading: growing the viewport to the document's height and taking a plain shot moves what depends on the viewport's height (fixed bars, `dvh`, `min-height`) compared with the old full-page shot. **This is an unbriefed pixel change of the capture on 48 built lines. It is not excused and not judged here**: it is escalated to the Tech Lead (the open plan rows on `comparisons.mjs:392` and `:402`). Captures taken by the old tooling are not comparable with captures taken by this one.

> Tracked as issue #310 (opened by GH-291). Finding above kept as written.

### The diagnostic pair (single `VariedadesCompu` row, built, 1280x920, light)

`--only VariedadesCompu --strict`, one `comparisons.mjs` run per sample, one sample app per tree, CPU throttling by CDP `Emulation.setCPUThrottlingRate` set in a throwaway copy (not committed). The verdict is the pixel of the switch's track in the PNG (`121,118,113` gray, `35,30,24` black), read from every PNG. Counts in `diagnostic-pair/counts.txt`.

| Tooling (tree) | Throttling | N | gray | black | no capture |
|---|---|---|---|---|---|
| head's (head) | 4 | 12 | 0 | 12 | 0 |
| head's (head) | 10 | 12 | 0 | 12 | 0 |
| head's (head) | none | 30 | 0 | 30 | 0 |
| base's own (base) | 4 | 12 | 3 | 9 | 0 |

The same N as the diagnosis for 4 and 10 and more than 3/p for the lowest rate seen (p = 0.1 gives 30). Base's p today was 0.25 at throttling 4 (the diagnosis measured 0.83 at 4 on a busier moment), so **the base can fail on this row and the head did not in 54 runs**, which is what supports 'resolved'.

### The two never-rests demonstrations (throwaway, not committed)

Two rows added to a scratch copy of the head (`/tmp`, a registry entry each and a `.dc.html` each; not in this checkout and not in the registry), each run once with `--only <row> --strict`. Output in `demo-fetch/` and `demo-transition/` (console, exit code, `index.json`, list of files written):

- `ZzSondaFetch`: a button disabled while a `fetch` re-issued every 16 ms on the fake clock's `setInterval` runs.
- `ZzSondaTransicion`: a finite 400 ms CSS transition whose target changes on every 16 ms tick.

Each: exit **1**; message `<row>: el diseño no se pudo capturar: la pantalla no quedó quieta` (names the row and the side, the fixed sentence, no page text); `index.json` has `"design": null`; no `.design.png` is written (only `<row>.png`, the composed sheet with "—", and `<row>.built.png`, since the built side of that row is an ordinary screen that did rest). Two first attempts did not show it and are not evidence: the throwaway had no applied font on its first text (a different, font failure), and with a 50 ms interval a run of three calm frames fits between ticks, so the row passed. A 16 ms interval ticks on every frame, which no pause can fit.

### By eye, in light and dark where the registry has both

From head run 1 (`27eefcb0`); each at rest, nothing mid-change:

- `VariedadesCompu built` (no dark row exists): switch enabled and on (black track, thumb right), the state the stored threshold gives; track pixel black in all five head runs. Crop above.
- `VariedadDetalle` and `VariedadDetalleOscuro` built: "Aviso de stock bajo" switch enabled and on in both (dark track on light theme, light track on dark theme, thumb right).
- `ConfiguracionPrecios` built: both switches (`Precio por cantidad`, `Clientes VIP`) on, enabled, blue, thumb right. (The 120 ms thumb transition of `OpcionInterruptor` is the only transition on a switch in the app.)
- `NuevaVentaOscuro` built: the `Regalo` switch off, thumb left, enabled.
- `VariedadArchivada` built: the archived variety shows its low-stock notice as text, with no switch.

The remaining rows, also from head run 1, viewed on contact sheets of the built captures (the `Compu` tiles were shown at about 0.19 scale, so for those the judgment is coarse: layout, presence and on/off of a control, not text). Each is at rest: no half-drawn control, no loading placeholder, no grey switch.

- `VariedadArchivadaOscuro`, `VariedadArchivadaCompu`, `VariedadArchivadaCompuOscuro` built: the low-stock notice is plain text ("Avisame abajo de 15 g"), no switch, as in the light row.
- `Archivadas`, `ArchivadasOscuro`, `ArchivadasCompu`, `ArchivadasCompuOscuro` built: the list of archived varieties, each with its "Restaurar" button; no switch.
- `Catalogo`, `CatalogoOscuro`, `CatalogoCompu`, `CatalogoCompuOscuro` built: the Telegram preview, "Copiar", and a dimmed "Publicar" button in all four. I did not check why it is dimmed (it is not a switch); it is identical in all ten runs (AE 0), and the settle saw no request and no mutation before it, so it is a resting state, not a capture in the middle of a refresh.
- `NuevaVenta` built: `Regalo` off, thumb left, enabled (as in the dark row above). `NuevaVentaCompu`, `NuevaVentaCompuOscuro`: the `Regalo` control is off (coarse).
- `NuevaVentaCliente`, `NuevaVentaClienteOscuro` built: the client picker sheet over the form.
- `Configuracion`, `ConfiguracionCompu` built: the settings list.
- `ConfiguracionNegocio`, `ConfiguracionNegocioCompu` built: the business-name form.
- `ConfiguracionUsuarios`, `ConfiguracionUsuariosCompu` built: the user list and "Invitá a un socio".
- `ConfiguracionPreciosCompu` built: both switches on, blue (as in the phone row above; coarse). No dark `ConfiguracionPrecios*` row exists.
- `ConfiguracionIntegraciones`, `ConfiguracionIntegracionesOscuro`, `ConfiguracionIntegracionesCompu`, `ConfiguracionIntegracionesCompuOscuro` built: empty token and chat fields, "Probarlo" enabled, "Cargá el token primero".
- `ConfiguracionMensaje`, `ConfiguracionMensajeCompu` built: the two text areas filled ("Encabezado", "Pie") and "Guardá el mensaje" enabled.
- `ConfiguracionCategorias`, `ConfiguracionCategoriasCompu` built: the five categories with edit and delete buttons, an empty "Nueva categoría" field and a dimmed "+ Categoría" (not checked why; I take it to be the empty field, and it is a button, not a switch).
- `ConfiguracionApariencia`, `ConfiguracionAparienciaCompu` built: the theme selector with "Claro" selected.
- `ConfiguracionCuenta`, `ConfiguracionCuentaCompu` built: "Cambiar contraseña" and "Cerrar sesión".

Where a dark row does not exist in the registry (`VariedadesCompu`, `ConfiguracionPrecios*`, and the `Configuracion*` rows other than `Integraciones`), only the light one was viewed. Every row in the list was judged by eye as well as being AE 0 across the five head runs and the five base runs.
