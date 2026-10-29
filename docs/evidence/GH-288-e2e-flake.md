# GH-288: evidence for the `panel.spec.ts` "Customer saved" flake

Base head of the measurements: `fbc4fdc0`. The flake was seen once on GH-188's head `8c611f10`
(`panel.spec.ts` › "a seller sees the panel agree with GET /panel…", `expect(page.getByText('Customer
saved')).toBeVisible()`, right after `expectPath(page, CUSTOMER)` passed) and passed on the rerun; its
trace is lost. These are one-off runs on a shared 16-core developer machine, recorded once. None is a
gate step and none measures a rate.

## Cause

**App failure reproduced: the same history-state toast rendered twice (a fourth class, not (i), (ii) or
(iii)), fixed by the commit that changes `web/src/screens/clientes/Clientes.tsx`, test "on a computer,
the toast a new customer lands with shows once, in the card, never also in the list"
(`web/src/screens/clientes/Clientes.test.tsx`).**

- Run 1 (below) failed at the saved-customer step in 2.1 s, not at the 17 s ceiling, with
  `strict mode violation: getByText('Customer saved') resolved to 2 elements`, both
  `<span class="toast__texto">`. Screenshot: `docs/evidence/GH-288/customer-saved-twice.png`; trace:
  `docs/evidence/GH-288/customer-saved-twice-trace.zip` (1.5 MB, sha256
  `f27772b71174aad84d356405d335f3b9c101a37c210cbd4268c3f748bfc54795`; the screenshot's is
  `74339137e4cf8f4aa916f0de2d392a8c7543c0313d7cd43f8d056e51c0ef5555`).
- The classes of the request were each excluded by the instrumentation on that run:
  - (i) slow card: `GET /customers/1` answered 200 in 130 ms, before `path-passed`; the card heading was in the DOM;
  - (ii) card error: no `role=alert`, no `SinConexion`/`ErrorGenerico`, the GET was 200;
  - (iii) state lost: `history.state.usr` still held the `toast` key at the miss.
- What the page held: two `role=status` elements, one in the list pane (`Clientes`), one in the card
  (`ClienteFicha`), both "Customer saved". `ClientesLayout` mounts `Clientes` beside the card when it
  goes from `/customers/new` (the form has the whole width, no list) to `/customers/{id}` on a computer
  viewport. `Clientes` read the entry's state on mount (`readFeedback(location.state)`), which is the
  card's toast, so both panes rendered it.
- Why it passes most of the time (an explanation consistent with the trace, not proven on GH-188's
  failing run): until `GET /customers/{id}` answers the card is `Loading`, so only the list's copy is on
  the page and `getByText` matches one element. On a loaded machine the card has already loaded when the
  first check runs, so there are two matches and Playwright's strict mode fails the step at once.
- Fix: a list that mounts beside a card ignores the entry's state (the card owns it). A list mounted at
  `/customers` keeps its state feedback (the gone notice) as before. No timer, wait or ceiling changed.
  The Testing Library test (`renderTwoPanes` at a computer viewport, `fetch` faked) fails without the
  fix with `expected [ …(2) ] to have a length of 1 but got 2`.
- The step has no product timer, so this is not the timer race below.

## The loop

Method: `npx playwright test e2e/panel.spec.ts --workers=3 --trace on` (the file has one test in the
`secure-origin` project, so Playwright used 1 worker), against a `vite build` of the head, with
`uv run --no-project pytest -n auto -q` looping in another shell and CDP
`Emulation.setCPUThrottlingRate` at 4 set from the spec. The machine was also loaded by other work
(load average 77 before run 1). Every run's load averages (1, 5, 15 min):

| run | CPU throttle | load before | load after | build | outcome |
|---|---|---|---|---|---|
| 1 | 4x | 77.64 75.95 68.74 | 91.71 80.47 71.57 | without the fix | red at "Customer saved": two matches (the Cause above) |
| 2 | 4x | 94.33 83.43 73.16 | 113.31 97.46 80.99 | without the fix | red earlier, at `getByText('Price saved')`: not found in 17 s. A toast on its own timer gone between polls: test timing, not the saved-customer step |
| 3 | 4x | 90.73 93.33 84.19 | 120.64 99.94 88.34 | with the fix | "Customer saved" passed; the test then timed out at 160 s on a later `More` click (load above 100) |
| 4 | 4x | 121.47 100.45 88.57 | 127.82 104.71 90.51 | with the fix | void: the worker's backend was not ready in 30 s |

Four runs, not 20: the loop stopped once a failure classified, and the machine was too loaded to go on
(run 4 never started). Run 3 timing out later shows the loaded runs measure nothing about the step
itself. **The four loaded runs measure no rate**: a count of reds out of these runs says nothing about how
often the flake happens.

Instrumentation (local, uncommitted, **reverted**; `git status` shows only the fix, its test and `docs/**`):
an `addInitScript` wrapping `history.pushState`/`replaceState` (it logged only the feedback marker's
key), `page.on('request'|'response'|'requestfinished')` for `/customers`, and on a miss a snapshot of
`history.state`, `document.readyState`, `location.pathname`, which of the loading, card-heading, alert
and status elements were in the DOM, and the last console messages. Names and phone numbers were never
logged. The backend's stderr was kept by the Playwright `[WebServer]` capture in each run's stdout; it
held only uvicorn start-up lines.

The trace holds only throwaway fixture data (a business "Flores del Panel …", `Carla Pérez`, an
`@example.com` owner). Its stacks and the copied spec source also carry the developer's local checkout
path.

## The clocks

| Timer | Value | Source | Renders |
|---|---|---|---|
| `TOAST_MS` | 2.5 s | `web/src/flash/FlashProvider.tsx:23,36` | `AvisoExito` (`.aviso-exito`) |
| `ASSIGN_TOAST_MS` | 2.5 s | `web/src/screens/ventas/VentaDetalle.tsx:61,167` | the assigned toast |
| `UNDO_WINDOW_MS` | 5 s | `web/src/screens/ventas/VentaDetalle.tsx:72,142` | the Undo window |
| category toasts | 2.5 s | `web/src/screens/settings/ExpenseCategoriesEditor.tsx:141,146` | `Aviso` (`.aviso-toast`) |
| integrations toast | 3 s | `web/src/screens/settings/IntegrationsGroup.tsx:116` | |
| pin publish toast | 3 s | `web/src/screens/PinPublish.tsx:129` | |
| catalogue toast | 3 s | `web/src/screens/Catalogo.tsx:67` | |

The request put the editor at line 134; at this head the timers are at 141 and 146. None of them was
changed.

## Elements with `role="status"` in `web/src`

| Element | Class | Recorded |
|---|---|---|
| `components/AvisoExito.tsx:60` | `.aviso-exito` | yes |
| `components/Notice.tsx:14`, `kind === 'toast'` | `.toast` | yes |
| `screens/clientes/ClienteFicha.tsx:194` (payment deleted) | `.toast` | yes |
| `components/Notice.tsx:14`, other kinds | `.aviso-ambar` | no |
| `components/SinConexion.tsx:13` via `AvisoAmbar` | `.aviso-ambar` | no |
| `components/GoneNotice.tsx:20` | `.aviso-neutro` | no |
| `components/Aviso.tsx:20` | `.aviso-toast` | no |
| `screens/ventas/VentaDetalle.tsx:287` | `.venta-guardada` | no |
| `screens/Inicio.tsx:116` | `.aviso-ambar` | no |
| `screens/settings/IntegrationsGroup.tsx:290` | `.aviso-ambar` | no |
| `screens/inicio/ImportNotice.tsx:35` | `.aviso-ambar` | no |

## Known risks

- The Undo window at `sales.spec.ts:245` is 5 s (`UNDO_WINDOW_MS`): not fixed here.
- A repeated identical toast while one is still showing is not detectable without a product change
  (`flashReducer` resets on a location change only).
- The `.aviso-toast` category sites (`flow.spec.ts:184, 188`) and the `.venta-guardada` "Sale saved"
  sites cannot be seen by the recorder and stay on page text.
- Other `getByText('Customer saved')` sites (`customers.spec.ts:65,85`, `clientesCobrar.spec.ts:39`,
  `flow.spec.ts:49`, `payments.spec.ts:77`) hit the same step; the fix removes the second match for all.
- The loaded runs measure no rate.

## Kept sites and proofs

The guard (`web/src/architecture/e2eToastRule.test.ts`) prints, from `npm --prefix web test -- e2eToastRule`
(at part 1, kept as history; the current counts are under "After part 3" below):

```
e2eToastRule: 27 sites observed in the page, 6 kept on page text, 86 pending
```

`panel.spec.ts`, `flow.spec.ts`, `sales.spec.ts`, `helpers/seed.ts` and `helpers/ledger.ts` are migrated
(27 `expectToast` calls in those five files; the recorder's own spec is not counted). The 86 sites in the other specs wait on `PENDING` for parts 2 and 3; the list only shrinks.

Kept on page text, with the reason (each is also a `KEPT` line in the guard):

| Site | Text | Reason |
|---|---|---|
| `flow.spec.ts:50` | Customer saved | no product timer: page visibility is the stronger check (`expectToast` runs on the click as well) |
| `panel.spec.ts:210` | Customer saved | no product timer: page visibility is the stronger check (`expectToast` runs on the click as well) |
| `toastRecorder.spec.ts:163` | Customer saved | no product timer: page visibility is the stronger check (`expectToast` runs on the click at :160; the recorder's own spec, so not counted above) |
| `flow.spec.ts:176` | Category saved | `.aviso-toast`: the recorder does not watch the category toasts |
| `flow.spec.ts:180` | Category deleted | `.aviso-toast`: the recorder does not watch the category toasts |
| `flow.spec.ts:188` | Business renamed | no product timer: page visibility is the stronger check (`expectToast` runs on the click as well) |
| `settings.spec.ts:95` | Category saved | `.aviso-toast`: the recorder does not watch the category toasts |
| `settings.spec.ts:108` | Category deleted | `.aviso-toast`: the recorder does not watch the category toasts |

Not flagged and left alone: "Sale saved" and "Sale deleted" (`.venta-guardada`, not in `SuccessToast`).
One migrated step replaced by a comment: the second "Expense saved" in `flow.spec.ts` (editing the
expense opens in place on the list, no route changes, so a repeated identical toast cannot be told
from the first; the row assertion that follows stays).

**Not run here.** The owner suspended local e2e runs (PR #434, and the human decision recorded on this
task): the throttled red/green on "Entry saved" and the five smoke runs of `npm --prefix web run e2e`
were not made. The e2e evidence for the migrated steps comes from the pull request's GitHub CI, where
e2e runs sharded; a red there is a finding to fix. Nothing in this section measures a rate.

**After merging `master`.** `master` carries three of the toasts as `common:` keys
(`common:customerSaved`, `common:entrySaved`, `common:entryDeleted`) in `SuccessToast`, and
history state carries the key, not the English. The guard follows: those three entries of
`SUCCESS_TOASTS` are `{ key }` entries, matched by the English `t` resolves them to (what a spec
sees), and the `Equal` check reads a `{ key }` entry as its key. `master` also moved the sites in
`catalog.spec.ts` and `catalogInsecureOrigin.spec.ts`, so those nine `PENDING` lines were renumbered
(same sites, no new ones). The Clientes test looks for the resolved "Customer saved" text; it still
fails without the fix (`expected [ …(2) ] to have a length of 1 but got 2`, checked again after the
merge by reverting the fix for one run). The counts are unchanged: 27 observed, 6 kept, 86 pending.

**Diff scope** (`git diff --stat fbc4fdc0..bef8e033 -- . ':!docs/evidence/GH-288-e2e-flake.md'`: the task's own work, from the base
this branch started on to the head before `master` was merged, without this doc): 21 files changed, 1202 insertions, 84 deletions. The merge of `master` brings its own 391 files, and the follow-up commit touches the guard and the Clientes test only. Under `web/src` only `screens/clientes/Clientes.tsx` and its
test (the Cause's fix) and the guard `architecture/e2eToastRule.test.ts` changed; nothing under
`app/`; no product timer.

**Gate timeouts on `web-e2e`.** The delivery gate's `npm --prefix web run e2e` was cut off at 1500 s on
`86dbc93d` and `4b159a40`, every test it printed green, while the host's load average was 22 to 23 (other
worktrees' Playwright runs). The mobile walk cells took about 4.7 min each; `web/playwright.config.ts`
(the comment above the `mobile` project) records 239 to 246 s for them at 3 workers on two cores and 294 to 305 s on a loaded 16-core box, so
the 4.7 min seen (about 282 s) sits between the two-core figure and the loaded one, so load explains it and the slow part is the walk under load, not this branch. This branch's only change on that path is
`withToastRecorder` around `newContext` in `web/e2e/mobile/cells.ts`; the recorder does constant work
per mutation record (`matches`, `querySelectorAll` on added nodes, `closest`). Not measured: local e2e is
off, so this is read from the code and the config. `11dc1586` passed the full run in 995.6 s.

## After part 3

Part 3 migrates the 12 specs `analysis`, `withdrawals`, `settings`, `catalog`, `archivadas`, `pinnedCatalog`,
`catalogInsecureOrigin`, `insets`, `varietiesAutoSelect`, `priceModal`, `tapBudget` and `passwords`. They held 47
`PENDING` sites. 44 are wrapped in `expectToast`, 2 are kept (the `.aviso-toast` category toasts, in the kept table above)
and 1 is a repeat. The guard prints, from `npm --prefix web test -- e2eToastRule`:

```
e2eToastRule: 71 sites observed in the page, 8 kept on page text, 39 pending
```

The 39 sites left are in the specs of part 2. `PENDING_CEILING` is 39, equal to `PENDING.length`, because part 2 has not
merged. Whichever of parts 2 and 3 merges second sets the ceiling to 0 and empties `PENDING`; the existing shrink test then asserts it stays empty.

**Classification of the 47 sites**, made before any edit. Lines are those of the base (`8d77fe04`), before the specs changed;
the kept rows give the new line too. A migrated site is wrapped in `expectToast(page, text, action)`: no earlier toast with
the same text was raised in the same document without a `goto` or a route change since, so the recorder sees a new element.

| Site (base) | Text | Class | Action, and what separates it from an earlier toast with the same text |
|---|---|---|---|
| `analysis.spec.ts:41` | Variety saved | migrate | click "Add the variety"; `goto(VARIETIES)` before, first in its document |
| `analysis.spec.ts:46` | Price saved | migrate | click "Save the price"; different text from :41, and routes changed since |
| `analysis.spec.ts:57` | Entry saved | migrate | click "Save the entry"; `goto(STOCK_ENTRY_NEW)` before, first in its document |
| `analysis.spec.ts:75` | Expense saved | migrate | click "Save the expense"; `goto(SALE_NEW)` and route changes before, first in its document |
| `analysis.spec.ts:167` | Entry saved | migrate | `recordEntry` click "Save the entry"; `goto(STOCK_ENTRY_NEW)` at the top of the helper |
| `analysis.spec.ts:180` | Withdrawal saved | migrate | `recordWithdrawal` click "Save the withdrawal"; `goto(WITHDRAWAL_NEW)` at the top of the helper |
| `analysis.spec.ts:198` | Variety saved | migrate | click "Add the variety" in the loop; `goto(VARIETIES)` at the top of each round |
| `analysis.spec.ts:209` | Price saved | migrate | click "Save the price"; `goto(VARIETIES)` and route changes since the last toast |
| `archivadas.spec.ts:41` | Variety saved | migrate | `addVariety` click "Add the variety"; `goto(VARIETIES)` at the top of the helper (called twice) |
| `archivadas.spec.ts:51` | Variety deleted | migrate | click "Yes, delete it"; different text, `goto(VARIETIES)` before |
| `archivadas.spec.ts:61` | Price saved | migrate | click "Save the price"; `goto(VARIETIES)` before |
| `archivadas.spec.ts:71` | Variety archived | migrate | click "Yes, archive it"; different text, `goto(VARIETIES)` before |
| `archivadas.spec.ts:106` | Variety restored | migrate | click "Restore"; different text, `goto(VARIETIES)` and route changes before. The comment lines between click and assertion stay after the wrapped click |
| `catalog.spec.ts:65` | Variety saved | migrate | click "Add the variety"; `goto(VARIETIES)` before, first in its document |
| `catalog.spec.ts:70` | Price saved | migrate | click "Save the price"; different text, route changes since |
| `catalog.spec.ts:77` | Entry saved | migrate | click "Save the entry"; `goto(STOCK_ENTRY_NEW)` before |
| `catalog.spec.ts:91` | Catalog saved | migrate | click "Save the catalog"; `goto(VARIETIES)` before, first in its document |
| `catalog.spec.ts:102` | Catalog saved | migrate | click "Save the message"; `goto(CATALOG)` and a route change since :91 |
| `catalog.spec.ts:127` | Catalog copied | migrate | click "Copy"; different text, first in its document |
| `catalogInsecureOrigin.spec.ts:108` | Price saved | migrate | click "Save the price"; `goto(VARIETIES)` before, first in its document |
| `catalogInsecureOrigin.spec.ts:115` | Entry saved | migrate | click "Save the entry"; `goto(STOCK_ENTRY_NEW)` before |
| `catalogInsecureOrigin.spec.ts:124` | Catalog copied | migrate | click "Copy"; `goto(CATALOG)` before, first in its document |
| `insets.spec.ts:119` | Variety saved | migrate | click "Add the variety"; `goto(VARIETIES)` before, first in its document |
| `insets.spec.ts:124` | Price saved | migrate | click "Save the price"; different text, route changes since |
| `passwords.spec.ts:70` | Password changed · we signed out your other sessions | migrate | sheet click "Save"; `goto(SETTINGS_ACCOUNT)` before, first in its document |
| `pinnedCatalog.spec.ts:43` | Variety saved | migrate | click "Add the variety"; `goto(VARIETIES)` before, first in its document |
| `pinnedCatalog.spec.ts:48` | Price saved | migrate | click "Save the price"; different text, route changes since |
| `pinnedCatalog.spec.ts:88` | Test sent | migrate | click "Test it"; the earlier Probarlo at :72 raised an alert, not a toast, so first in its document |
| `pinnedCatalog.spec.ts:100` | Test sent | repeat | second identical "Test sent" on the still-mounted toast of :88, no location change and no assertion that saw the first go away; the recorder's per-element `lastText` records nothing. The `tested` response wait stays, the assertion becomes a one-line comment and the link, Publish and "Up to date" steps after it carry the proof |
| `pinnedCatalog.spec.ts:108` | Catalog published | migrate | click "Publish"; different text, route changed to the catalog screen since |
| `priceModal.spec.ts:21` | Variety saved | migrate | `addVariety` click "Add the variety"; `goto(VARIETIES)` at the top of the helper (called twice) |
| `settings.spec.ts:47` | Expense saved | migrate | click "Save the expense"; first in its document |
| `settings.spec.ts:66` | Business renamed | migrate | click "Save the name"; different text, `goto(HOME)` and route changes since :47 |
| `settings.spec.ts:80` | Test sent | migrate | click "Test it"; different text, route changes (`close()`, `openGroup`) since |
| `settings.spec.ts:91` | Catalog saved | migrate | click "Save the message"; different text, route changes since |
| `settings.spec.ts:98` | Category saved | keep | `.aviso-toast` (`Aviso.tsx`): the recorder does not watch the category toasts; now `settings.spec.ts:95` |
| `settings.spec.ts:111` | Category deleted | keep | `.aviso-toast` (`Aviso.tsx`): the recorder does not watch the category toasts; now `settings.spec.ts:108` |
| `settings.spec.ts:130` | Password changed · we signed out your other sessions | migrate | sheet click "Save"; different text, route changes since |
| `tapBudget.spec.ts:106` | Expense saved | migrate | click "Save the expense" plus the `expectPath(MORE)` that belongs to it; `goto(MORE)` before, first in its document |
| `varietiesAutoSelect.spec.ts:31` | Variety saved | migrate | click "Add the variety"; `goto(VARIETIES)` before, first in its document |
| `withdrawals.spec.ts:33` | Variety saved | migrate | click "Add the variety"; `goto(VARIETIES)` before, first in its document |
| `withdrawals.spec.ts:40` | Entry saved | migrate | click "Save the entry"; different text, `goto(VARIETIES)` before |
| `withdrawals.spec.ts:52` | Withdrawal saved | migrate | click "Save the withdrawal"; first in its document (from Más) |
| `withdrawals.spec.ts:64` | Withdrawal saved | migrate | click "Save the withdrawal"; `goto(VARIETIES)` since :52 |
| `withdrawals.spec.ts:74` | Withdrawal saved | migrate | click "Save the withdrawal"; route changes (`openMas`, the link to the form) since :64 |
| `withdrawals.spec.ts:85` | Withdrawal deleted | migrate | click "Yes, delete it"; different text, `goto(VARIETIES)` before |
| `withdrawals.spec.ts:96` | Withdrawal saved | migrate | click "Yes, save"; `goto(VARIETIES)` since :74 |

**Repeat.** `pinnedCatalog.spec.ts:100`: the second identical "Test sent" lands on the toast of `:88`, still mounted; the
recorder keeps `lastText` per element (`web/e2e/toastRecorder.ts`), so `expectToast` cannot see it. The spec keeps its
`tested` response wait and replaces the assertion with a one-line comment; it adds no wait.

**`catalogInsecureOrigin.spec.ts`** uses the `page` fixture, whose context already installs the recorder (`fixtures.ts`), so it needs no `withToastRecorder`.

**Looked at, not flagged** (a `getByText`/`filter` with a regex, a substring or a held text in the 12 specs, code left as it is):

- `settings.spec.ts:107` "It can't be deleted: it still has expenses. You can rename it." is a refusal alert, not a success toast.
- `withdrawals.spec.ts:83` `/1 g go back to stock\./` is the confirmation's page text.
- `archivadas.spec.ts:108, 111` `/Archived \(/` are the list's page text, as negative assertions.
- `pinnedCatalog.spec.ts:85, 89` "Saved on" is page text.
- `analysis.spec.ts:64, 230` and `archivadas.spec.ts:65` "Sale saved" is `.venta-guardada`, not in `SuccessToast`.
- `passwords.spec.ts:128` the dead-link message is page text.

**Not run here.** Local e2e is suspended (PR #434): no local e2e run is claimed. The e2e proof for these steps is the pull request's CI `e2e` job. It is not shown yet: no pull request exists for this head, so the criterion "CI `e2e` is green" is met only when the PR's `e2e` job passes. The owner's rule is that the PR's own CI checks it at landing.
