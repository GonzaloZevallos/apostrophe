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
Cobro, CobroCompu, NuevaVentaCliente, NuevaVentaClienteOscuro, and the form rows ClienteNuevo
(before and after). Dark twins have no dark drawing: the design column stays light, so a dark
twin is judged for structure and the tokens only.

Better than before: Te deben leads, balance is amber at the row's end with "te debe desde dd/mm",
"Cobrar" on each debtor row, Registrar cobro in the card's Te debe block, "Nueva venta a Nico
Parra", Cobro as a modal on a computer, no Canal anywhere.

Still different from the design (none is CSS-only: each needs structure, so none was "fixed" here
and nothing was retaken). Pre-existing or follow-up of this task; **not filed**: this run has no
issue-tracker step, so each needs an issue by Zeta.

1. Clientes (phone): the built list has a "Nuevo cliente" button and a count line "4 clientes"
   where the design has a "+" in the header; no avatar initials, no chevron on non-debtors; the
   Te deben rows repeat in A-Z (design too). "Cobrar" carries an icon the design does not.
2. ClientesCompu: no sidebar brand; the card pane shows an edit pencil under the name where the
   design has "Editar" at the right, no "Cuenta · saldo acumulado" label, ledger rows do not show
   "A cuenta de la venta del..." as a second line and the pane's "Nueva venta a" button sits
   under the ledger rather than at the foot.
3. ClienteFicha: Te debe block is below the phone/VIP rows in the design, above here; the amount is
   not the large figure; "Registrar cobro" in design is a full-width inside the block (same), the
   ledger rows wrap ("$ / 25.000", "saldo $ / 25.000") instead of the design's right-aligned
   amount over "saldo $ X"; no "Cuenta · saldo acumulado" label; "Borrar cobro" is a trash icon.
4. Cobro (phone): a full page "Registrar cobro" with "Monto" as a plain number (`20000`, no
   `$ 10.000` formatting), date as a native date input (design: "Hoy 05/10"), Efectivo and
   Transferencia as radio inputs (design: a segmented control), button "Guardar" (design:
   "Guardá el cobro"), no "Le queda debiendo" row in the preview. The design draws a sheet over the
   card with "Cerrar"; the built page uses an icon close. The docs win on wording: payments.md
   says "Registrar cobro", "Todo: $ X" and "Le queda debiendo $ X".
5. CobroCompu: the modal exists as drawn but carries the same inner differences as 4; behind it,
   Clientes keeps its scrim.
6. NuevaVentaCliente: the picker is "Elegir cliente" with a full list and "Nuevo cliente" button;
   the design shows a search result and the inline "Nuevo cliente" form with "Guardá y usá". The
   form itself is at `/customers/new` (ClienteNuevo): Teléfono comes before Nombre, VIP is a bare
   checkbox, not the design's "No" switch.
7. Sample dates differ from the design's fixed ones (16/09 against 28/09): intended, sample data.

## Design vs docs wording

None found beyond item 4: the built text follows the docs; the design's "Guardá el cobro" and
"Registrá un cobro" are not used.
