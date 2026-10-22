# GH-278 evidence: Customers and the customer's card, before and after

Method: ADR-0042 (GH-219 amendment). Images are attached to the PR, never committed. This note
changes no product code.

| Item | Value |
| --- | --- |
| Base (`git merge-base HEAD origin/master`) | `4e9751e278cefbb0dfae6da21f8db7ed6790e317` |
| Head | `d06039d0ead87e68f201f7792b96e5381bbd66c0` |
| Overlay | none needed: `diff -rq scripts/design` base vs head is empty (the base carries head's tooling), so the base side is the base's own `app/`, `web/` and `scripts/design/` exported with `git archive`; `pyproject.toml`, `uv.lock` and `web/package*.json` are byte-equal |
| Design drawings | `docs/product/design-system/pantallas/` identical on both sides. `README.md` differs by one line (head adds `.lista-clientes__fila > svg` to the `--tenue` icon row; the contrast table gains no row) |
| `@fontsource/plus-jakarta-sans` | 5.3.0, one install (`web/node_modules`) shared by both sides (symlinked into the base export) |
| Python env | head's `.venv`, shared |
| Capture | `scripts/design/compare.sh --strict`, whole registry (157 rows) in file order, no `--only`, each side on its own fresh sample, same Argentina day (2026-10-22); both runs completed with every row `ok`, no notes, and no `null` design or built capture in either `index.json` (`GH-278-strict-base.txt`, `GH-278-strict-head.txt`) |
| Compare | `node scripts/design/ae.mjs <before> <after>`: output in `GH-278-ae-full.txt`; exit 1 as expected (314 lines = 157 screens x design, built) |

The two sides ran at the same time on one machine; capture at rest (ADR-0042, GH-273) does not
depend on load.

## AE result

All 157 `design` lines are AE 0. Of the 157 `built` lines, 8 are not AE 0, every one `FAIL different
dimensions` (the page got shorter or taller, so no pixel count exists); the other 149 are AE 0.

| Screen (built) | Line | Verdict |
| --- | --- | --- |
| Clientes, ClientesOscuro | different dimensions | intended: header, avatars, chevrons (this task) |
| ClientesCompu, ClientesCompuOscuro | different dimensions (sheet 1083 -> 1058 px) | intended: header, avatars, chevrons, ledger, pinned footer |
| ClienteFicha, ClienteFichaOscuro | different dimensions | intended: label over figure, ledger, pinned footer |
| CobroCompu, CobroCompuOscuro | different dimensions (sheet 1052 -> 1027 px) | not one of the six, judged by eye on the CobroCompu before and after sheets (the dark twin shares its structure): the modal (title, close icon, amount, "All" chip, date, Cash/Transfer, split box, Save) is identical on both sides at the same position and size. What changed is the Clientes list pane behind it: the title row carries "+ New customer" in place of the separate button and the "4 customers" line, rows carry avatars, and the card pane shows the label-over-figure block, the ledger rows and the footer "New sale to Nico Parra" (the old footer sat under the ledger, the new one is pinned at the pane's foot). That is the 25 px shorter sheet, the same delta as ClientesCompu. A consequence of this task's own intended changes, behind the dimmed overlay: not defective, no follow-up. Differences from the drawing are the ones already listed for Customers (header word, wording, brand) |

No other row differs: the 149 remaining `built` lines, among them the Cobro phone rows,
NuevaVentaCliente, ClienteNuevo, ClienteEditar and the shell screens, are AE 0.

## By eye (built side against the drawing, after)

Judged on the sheets `Clientes`, `ClientesOscuro`, `ClientesCompu`, `ClientesCompuOscuro`,
`ClienteFicha`, `ClienteFichaOscuro` (after; the `Clientes` before sheet was also viewed). Dark
twins have no dark drawing: the design column stays light, so a dark twin is judged for structure
and tokens only.

| Row | Verdict |
| --- | --- |
| Clientes | Matches the drawing's structure: the title row carries the action at its right, no "4 customers" line, an avatar with initials on every row, the chevron on Lu Fernandez and Mica Solano (rows that owe nothing), "Collect" kept on debtors. Remaining differences below. |
| ClientesOscuro | Same structure in the dark tokens; avatars read against the row (`--superficie` circle), amber amounts and the inverted "Collect" button read. |
| ClientesCompu | List pane: header row with the action, avatars, chevrons. Card pane: small label over a large figure, "Account · running balance", each ledger row title over sub-line with amount over "balance $ X" on one line each, "New sale to Nico Parra" at the foot of the pane. Remaining differences below. |
| ClientesCompuOscuro | Same, dark tokens. |
| ClienteFicha | Money block as label over figure; ledger label, title over sub-line, amount over balance, debt amber, no wrapped "$" figure; "New sale to Nico Parra" pinned at the foot. Remaining differences below. |
| ClienteFichaOscuro | Same, dark tokens: the figure and balances are the dark amber, the footer button is the inverted one. |

## Remaining differences from the drawings

Every one has one verdict.

| Screen and side | Difference | Verdict |
| --- | --- | --- |
| Clientes, ClientesOscuro, ClientesCompu, ClientesCompuOscuro (built) | "+ New customer" (icon and word) where the drawing has a bare "+" | docs win: icon-and-text-rule.md (the closed icon-only list does not include it) |
| ClienteFicha, ClienteFichaOscuro, ClientesCompu, ClientesCompuOscuro (built) | Sale row title "Sale" and sub-line "Left owing" / "Paid in cash" where the drawing writes "Sale · Golden Cookies 1 g" | docs win: payments.md (card section); the account API names no lines |
| ClientesCompu, ClientesCompuOscuro (design vs built) | The shell's sidebar has no "apostrophe" brand at its top | out of scope: navigation.md lists the sidebar's contents and a brand is not one; a navigation issue of its own |
| ClientesCompu, ClientesCompuOscuro (built) | No selected-row background in the built list pane, so the drawing's `--papel` avatar on a selected row is not built (the avatar stays `--superficie`) | outside this bug: the pane draws no selected row; recorded by subtask `rows` |
| ClientesCompu (built) | Compact one-line "Owed to you" header over compact rows in the drawing; built keeps the phone's large total, count line and taller rows | pre-existing on the base (E2 in GH-46-clientes-captures.md), not this task |
| ClienteFicha, ClienteFichaOscuro, ClientesCompu (built) | The money figure is 38 px (`cifra-l`); the drawing's is larger (about 42 px) | recorded for the Tech Lead: a token-size difference, tokens are not changed by this task (invariant 10) |
| ClienteFicha (built) | "‹ Customers" back link, the edit pencil below the name, the trash icon on its own line under the payment row where the drawing has the word "Borrar cobro" on its own line | docs win (icon-and-text-rule.md for edit and delete; customers.md for the back link); layout of the pencil and of the trash pre-exist on the base |
| ClienteFicha (built) | Phone and VIP rows come after the money block; the drawing puts them before | pre-existing on the base (E1 in GH-46-clientes-captures.md), not this task |
| All six (design vs built) | Wording ("Customers", "Phone or name", "Collect", "owes you since", "Everyone · A-Z", "Owes you", "Record payment") | docs win, English app (CODING_STANDARDS section 10) |
| All six | Dates, names' order and figures (03/10, 20/10; $ 25.000 sale, $ 5.000 payment) | not a defect: the sample runs on today's date, the drawings are static |
| Clientes (built phone) | The capture is the page without the bottom bar and "+ New sale"; the drawing shows the shell | the built capture is the page's `/customers` content only, as on the base |
| ClienteFicha (built phone) | At 299 px and narrower the avatar is hidden (finding on subtask `rows`) | listed in the Tech Lead's findings; not visible at the capture width |

## Phone check (mobile project)

`npm --prefix web run e2e -- --project=mobile` (after `npx vite build`, `--workers=4`), run on head
`359b6699`'s product code (`d06039d0`): **33 passed (7.6 m)**, no failure. That includes every
`phone standard at <size>, claro/oscuro` cell (430x932 and 246x437 seen in the output) and the
checker, walk and getting-in tests. So no offender list has a stale entry (an entry whose cell now
passes) and no new offender exists; what the lists hold is what `compare.sh` printed, attached
below as counts on each side.

| | Base | Head |
| --- | --- | --- |
| Known offender cells | 10826 | 10830 |
| #46 | 736 | 748 |
| #59 | 664 | 656 |
| chrome-at-load | 350 | 344 |
| chrome-mid-scroll | 314 | 312 |
| data-while-loading | 40 | 32 |
| figure-split | 258 | 246 |
| h-scroll | 174 | 172 |
| unreachable | 52 | 50 |
| text-size | 1460 | 1470 |
| touch-action | 5308 | 5328 |
| touch-target | 794 | 800 |

Seven rules shrink; three grow (text-size +10, touch-action +20, touch-target +6), net +4 cells, all
under #46 (+12) against #59 (-8). Invariant 12 says the lists only shrink. Subtask `ledger`'s
commit `69f70080` records why part of this cannot hold: the Delete payment step becomes reachable
at 246 px, so its `unreachable` entry goes and its now-measured offenders (CobroBorrar's shell
elements) are listed. The Tech Lead should judge whether the three growing rules are all from that
step.

## Test lookups and assertions the other subtasks changed

Nothing is loosened; each is a lookup that follows a split or an assertion that is reversed.

- Reversed: `Clientes.test.tsx` "Te deben sits above everyone A-Z...": `findByText('2 customers')` is
  now `queryByText(/^\d+ customers?$/)` not in the document (the count line is gone), and the
  region lookup `Everyone · A-Z` stands in as the await.
- Reversed: `customers.spec.ts`, the balance type scale: the figure was `cifra-m` (25 px, 27.5 line,
  -0.875 tracking) on the joined "Owes you $ 4.000" text; it is now `cifra-l` (38 px, 39.9, -1.52)
  on the `.monto-deuda` figure, plus "larger than its label".
- Changed lookup: the row's text content gained the avatar's initials (`TeDeben.test.tsx`,
  `Clientes.test.tsx`: `'Ana Pérez$ 15.000owes you...'` is now `'APAna Pérez$ 15.000owes you...'`).
- Split lookup: the joined `Owes you $ N` text is now a label and a figure
  (`ClienteFicha.test.tsx`, `payments.spec.ts`, `panel.spec.ts`, `customers.spec.ts`: the
  `.ficha-deuda` block with `/Owes you\s*\$ N/`), and `Credit $ 2.000` is the label
  `.ficha-deuda__rotulo` over its figure.
- Split lookup: the joined `Payment · cash · On account of the sale of dd/mm` is now the title
  `Payment · cash` and the sub-line `On account of the sale of dd/mm` (`ClienteFicha.test.tsx`,
  `payments.spec.ts`).

## Integration: invariant 12 at 246x437

Command, run on head `9dffab3f`'s product code, three times with different offender lists (the lists were
swapped for runs A and B and restored after):
`cd web && npm run e2e -- --project=mobile -g "246x437, claro"` (vite build, then the setup test and the
246x437 claro cell; about 3.6 m each).

Why the lists grow there: ClienteFicha used to overflow horizontally at 246 px, so CobroBorrar (the Delete
payment step) could not be reached and the base listed one `unreachable` entry for it. The ledger fix removes
the overflow, so the step is reachable and measured for the first time. Its offenders are the shell's (bottom
bar links, text size, touch action), the ones every other screen already lists at 246 px (#59).

**A. Base lists (`git checkout 4e9751e2 -- web/src/mobile-standard/offenders/`): exit 1**, `1 failed, 1 passed`:

```
[mobile] › e2e/mobile.spec.ts:38:5 › phone standard at 246x437, claro
  expect(diffOffenders(own, actual)).toEqual({ unlisted: [], fixedButListed: [] })
  - Expected  -   2
  + Received  + 231
  "fixedButListed": Array [   // 10 entries, all now passing
    { "rule": "unreachable", "screen": "CobroBorrar", "size": "246x437", "target": "", "theme": "claro" }
    { "rule": "h-scroll", "screen": "ClienteFicha", ... }        plus 8 ClienteFicha/Clientes figure-split and
                                                                 data-while-loading entries
  "unlisted": Array [         // 21 entries, all "screen": "CobroBorrar", "size": "246x437"
    chrome-at-load 1, chrome-mid-scroll 1, figure-split 1, text-size 5, touch-action 10, touch-target 3
```

**B. Shipped lists minus every CobroBorrar `246x437` size (21 entries touched): exit 1**, `1 failed, 1 passed`:

```
[mobile] › e2e/mobile.spec.ts:38:5 › phone standard at 246x437, claro
  - Expected  -   1
  + Received  + 149
  "fixedButListed": Array [],
  "unlisted": Array [         // 21 entries, all "screen": "CobroBorrar"
    chrome-at-load 1, chrome-mid-scroll 1, figure-split 1, text-size 5, touch-action 10, touch-target 3
```

**C. Shipped lists (HEAD): exit 0**, `2 passed (3.7m)`.

Net count, in the check's own unit (entry x size x theme, an entry with no `sizes` or `themes` meaning all
4 sizes and both themes; it reproduces `compare.sh`'s 10826 to 10830): **+4 cells**. Per rule: chrome-at-load
-6, chrome-mid-scroll -2, data-while-loading -8, figure-split -12, h-scroll -2, unreachable -2,
text-size +10, touch-action +20, touch-target +6. The growth (+36) is CobroBorrar at 246x437, both themes
(21 claro entries counted in run A, plus the oscuro twins; the rest of the +4 is the shrinkage listed above).
An earlier note here gave "+14"; that counted an entry once per size and ignored themes, and is withdrawn.

Checked again on resume at `462e07c8`: clean tree, no conflict markers; the offender lists are the ones run C passed with.
