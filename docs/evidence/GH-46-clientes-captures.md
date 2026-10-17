# GH-46 evidence: Clientes, the card, Registrar cobro and Nuevo cliente, before and after

Method: ADR-0042 (GH-219 amendment). Images are attached to the PR, never committed. This note
changes no product code.

| Item | Value |
| --- | --- |
| Base (task base: `git merge-base HEAD origin/master`) | `e08228dd44cd0fbb632ac0dc4d90931daffd07dd` |
| Head | `1ad2bc226d7255081cbfa6948e2a74c7f84ad44a` |
| Overlay (head's `scripts/design/` over the base's `app/` and `web/`) | `sample_app.py` 14 +-, `screens.json` 5 +; 2 files, 11 insertions, 8 deletions, equal to `git diff --stat <base>..<head> -- scripts/design` |
| Design docs | `docs/product/design-system` identical on both sides (`diff -rq`) |
| `@fontsource/plus-jakarta-sans` | 5.3.0, one install (`web/node_modules`) shared by both sides |
| Python env | head's `.venv`, shared; `pyproject.toml`, `uv.lock`, `web/package*.json` unchanged base..head |
| Capture | `scripts/design/compare.sh --strict`, whole registry (156 rows) in file order, no `--only`, each side on a fresh sample, same Argentina day (2026-10-17); both exit 0, no notes |
| Compare | `node scripts/design/ae.mjs <before> <after>` (output: `GH-46-ae-full.txt`); exit 1 |

(A first attempt used the stale local `master` as base. It was discarded: the design files for
Archivadas did not exist there. The base above is the fork point from `origin/master`.)

## AE result

312 lines (156 screens x design, built). All 156 `design` lines are AE 0. Of the 156 `built`
lines 14 are non-zero, all on the screens of this task; the other 142 are AE 0.

| Screen | built | Verdict |
| --- | --- | --- |
| Clientes, ClientesOscuro | different dimensions | intended: Te deben on top, header without debt figure, two sections (B) |
| ClientesCompu, ClientesCompuOscuro | different dimensions | intended: two panes, the card on the right (B) |
| ClienteFicha (461731), ClienteFichaOscuro (463365) | AE | intended: Te debe block with Registrar cobro, "Canal" row gone, "Nueva venta a <name>" (C1a, C2) |
| Cobro (931838), CobroOscuro (931933) | AE | intended: its own page, not a sheet over the card (C2) |
| CobroCompu, CobroCompuOscuro | different dimensions | intended: modal over Clientes (C2) |
| ClienteNuevo, ClienteEditar (156453) | AE | intended: Canal fieldset removed (C1a) |
| ClienteNuevoCompu, ClienteEditarCompu (455733) | AE | intended: same |
| NuevaVentaCliente, NuevaVentaClienteOscuro | AE 0 | the picker never carried a channel; unchanged |

## By eye (built side against the design, after)

Judged on the sheets: Clientes, ClientesCompu, ClientesOscuro, ClienteFicha, ClienteFichaOscuro,
Cobro, CobroCompu, CobroOscuro, NuevaVentaCliente, NuevaVentaClienteOscuro, and the form rows
ClienteNuevo (before and after). Dark twins have no dark drawing: the design column stays light,
so a dark twin is judged for structure and the tokens only. CobroOscuro: the built page is the
Cobro page in the dark tokens (text, the "Todo" chip, the field backgrounds and the dark button
all read; the two radio circles are dim against the dark field, which belongs to the radios in
#279). Its structure is Cobro's, so its verdicts are Cobro's.

Better than before: Te deben leads, the balance is amber at the row's end with "te debe desde
dd/mm", "Cobrar" on each debtor row, Registrar cobro in the card's Te debe block, "Nueva venta a
Nico Parra", Cobro as a modal on a computer, no Canal anywhere.

Every difference below has exactly one verdict. "Pre-existing" ones are in the before capture
(the base `e08228dd`) and are filed and linked. Three introduced by this task fit none of the three
verdicts and are escalated (E1 to E3), not hidden.

### Intended (introduced by this task)

| Where | Difference | Why |
| --- | --- | --- |
| ClientesCompu | Two panes, the list left and the card right | The design draws them; customers.md |
| Clientes, ClientesCompu | "Cobrar" on every debtor row, which the compu drawing's compact rows lack | customers.md: every row of a customer who owes has "Cobrar"; the docs win |
| Clientes, ClientesCompu | "Cobrar" and "Sin cliente" carry an icon the drawing does not | icon-and-text-rule.md: icon + text for everything outside the closed lists |
| ClientesCompu | A "‹ Clientes" link at the top of the card pane; the compu drawing has none | customers.md: the card is "a card with ‹ Clientes"; the docs win |
| ClienteFicha, ClientesCompu | The edit pencil where the drawing writes "Editar"; a trash icon where it writes "Borrar cobro" | icon-and-text-rule.md: edit and delete are icon-only with the word as accessible name |
| Cobro, CobroCompu, CobroOscuro | A close icon where the drawing writes "Cerrar" | Same rule: close is icon-only everywhere |
| Cobro, CobroCompu | Title "Registrar cobro" where the drawing writes "Registrá un cobro" | payments.md names the screen "Registrar cobro"; the docs win |
| CobroCompu | A modal over the Clientes panes | The design draws it; ADR-0044 |
| Cobro | The amount drawn as a large unboxed figure with a "Todo: $ X" chip | Brought to the design by this task |
| Cobro (all captures) | No "Le queda debiendo $ X" row | Correct for the capture: it pays the whole balance, and the row shows for a partial amount (`ClienteFicha.test.tsx` pins both); the design's example is a partial one |
| ClienteNuevo, ClienteEditar (4 rows) | The Canal fieldset is gone | The task's point |
| Clientes, ClientesCompu, ClienteFicha, Cobro | Dates and sample figures (28/09 against 16/09, today's date against 05/10) | The sample runs on today's date; the drawings are static |
| NuevaVentaCliente, NuevaVentaClienteOscuro | None | AE 0 before and after; the picker never carried a channel |

### Pre-existing, filed

| Difference | Filed |
| --- | --- |
| Clientes header: a "Nuevo cliente" button and a "4 clientes" line where the drawing has a "+" | #278 |
| No avatar initials and no chevron on rows | #278 |
| No sidebar brand and no "Cuenta · saldo acumulado" label | #278 |
| Ledger rows wrap their amounts and have no sub-line; "Nueva venta a" sits under the ledger instead of at the foot; the Te debe amount is label-sized | #278 |
| Cobro: digits as typed, native date input ("10/17/2026" against "Hoy 05/10"), radios against a segmented control, "Monto" against "Cuánto te pagó", and "Guardar" against "Guardá el cobro" (payments.md names no save label, so the drawing wins and the built wording differs) | #279 |
| Nuevo cliente form: Teléfono before Nombre, VIP as a bare checkbox, no focus ring on the first field; the "Elegir cliente" sheet lists everyone and opens the form from a button, where the drawing searches and shows the form inline | #279 |

### Introduced by this task and fitting none of the three: escalated to the Tech Lead

- **E1, ClienteFicha (phone, dark twin, and the compu card).** The Te debe block sits above the
  phone and VIP rows. The drawing and customers.md (:106-109, phone and VIP first, then "Te debe")
  put it below. Introduced by C2. It is a JSX order change, not CSS only, so it was not fixed
  here.
- **E2, ClientesCompu and ClientesCompuOscuro.** The Te deben section in the left pane keeps the
  phone's large total and a count line over taller rows; the compu drawing is one compact line
  ("Te deben · $ 32.000 · 2 ventas debiendo") over compact rows. The docs fix only the content,
  not the size. A CSS-only candidate that was not fixed: a fix retakes both sides (about 25
  minutes for the whole registry) and changes the rows the phone shares.
- **E3, Cobro (phone, CobroOscuro).** The built Cobro is a full page; the drawing is a sheet over
  the faded card, and payments.md calls it "A sheet". The plan chose a form screen on the phone
  and a modal on a computer; chrome (no bar, close, leave-confirmation) is the same. A sheet
  needs a structural change, so it was not fixed here.

## Design vs docs wording

Resolved against the docs, one per line:

- "Registrá un cobro" (design) and "Registrar cobro" (docs): the docs win; built says "Registrar cobro".
- "Cerrar", "Editar" and "Borrar cobro" as words (design) and icon-only with that accessible name (docs): the docs win; built is icon-only.
- "Elegí el cliente" (design) and "Elegir cliente" (docs, sales.md and the PRD): the docs win; built says "Elegir cliente".
- "Guardá el cobro" (design), "Guardar" (built): payments.md names no label. The drawing is the only source and the built word differs: pre-existing, #279.
- "Hoy 05/10" (design): the docs say only "the date comes filled with today"; built shows a raw date input: pre-existing, #279.
- "Cuánto te pagó" (design), "Monto" (built): the docs name no label: pre-existing, #279.
- "Guardá y usá": the design and the built form agree, and the docs name no label: nothing to resolve.
