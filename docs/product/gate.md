# Gate

The checks every change must pass before it merges: pytest, vitest and e2e (ADR-0039, ADR-0040, ADR-0041). The maintainer and the agentic development system rely on them. This file holds what the gate itself must guarantee, including how the mobile standard's offender lists may change. It changes no product behaviour: no capability's rule, screen, route, refusal or message is defined here. Sellers and the operator see nothing of it. The operator gains only indirectly, from a gate they can trust.

## Jobs

### Same result whenever it runs

**When** the gate goes red, **I want** (as the maintainer or the agent running it) that to mean something in the product broke, never that the calendar moved past an expiry or a day boundary, **so I can** fix real regressions inside the brief I'm working on instead of patching tests by hand in files nobody asked me to touch.

Before this, a test that depended on the real date (an invitation past its 7 days, a day boundary in Argentina) failed one day for no product reason. It was patched case by case outside any brief (GH-142, commit e73ecf4).

Success criteria:

1. **Same result whenever it runs.** Every check of the gate (pytest, vitest, e2e) gives the same verdict on any date and at any time of day. That includes more than 7 days after today and across a midnight in Argentina. A test that passes today cannot fail next week because the date changed.
2. **Time-based rules are tested at their edges on purpose.** These rules are tested by setting the time the test needs, never by the wall clock:
   - invitation expiry (7 days);
   - reset links (24 hours);
   - the login brakes (15 minutes);
   - the Argentina business day;
   - "a future date is refused".
3. **No product behaviour changes because of how tests keep time.** Every capability file reads and behaves the same.
4. **The gate stays fast and self-contained.** No waiting, no sleeping until something expires, and no checks on how long something took (ADR-0038, ADR-0041).
5. **No known test depends on the real clock.**

### A reachable screen trades its unreachable entry

**When** a change makes a screen that was listed as unreachable reachable by the mobile walk, **I want** (as the Developer making that change, or the reviewer approving it) a written rule for trading that screen's `unreachable` entry for its real offender cells in the same change, **so that** the gate does not read real, newly visible cells as a regression and nobody writes a one-off exception.

Before this (GH-293), invariant 9 of the GH-271 plan forbade any growth of the offender lists and did not foresee this case. Each such trade needed an exception recorded with evidence, task by task. CobroDesdeInicio was the case on record: one `unreachable` entry traded for seven 246x437 cells.

Success criteria:

1. When a screen becomes reachable, its `unreachable` entry is removed and its real cells are added to the offender lists in the same change.
2. The new cells are recorded and tracked like any other offender. They are never hidden, and never read as a regression.
3. The exception covers only that screen. The only growth allowed by the trade is the cells of the screen whose `unreachable` entry is removed in that same change.
4. A reviewer can check the trade from the offender files and the change alone, without reading the Developer's evidence notes.

### A new registry row brings its cells

**When** a change adds a row to the screens registry that the mobile walk always walks, **I want** (as the Developer making that change, or the reviewer approving it) a written rule that lets that row bring all its real offender cells in the same change, **so that** a rule written for a change says what truly holds, the change can be approved, and later changes can be reviewed without arguing the same contradiction again.

Before this (GH-305, a follow-up of GH-274), the only allowed growth was the trade. GH-274 added the phone rows `InicioChecklist` (Home with the first-run checklist) and `InicioImportado` (Home with the after-import notice). They were never listed as unreachable, so their real cells (56 entries) could not be a trade, and the plan's invariant could not hold as written. The finding stayed open on GH-274's approved head.

Success criteria:

1. A row new to the screens registry brings all its real offender cells in the change that adds it. If the walk cannot reach it yet, it brings its `unreachable` coverage instead.
2. Those cells are tracked like any other offender. They are never hidden, and never read as a regression.
3. The growth covers only the new row's screen, at the sizes and themes that row covers, in the change that adds it. Any other growth still breaks invariant 9.
4. A reviewer can check it from the registry diff and the offender-file diff alone, by screen name.
5. No one-off exception is recorded for a new row. `InicioChecklist` and `InicioImportado` are accepted by this rule, with none.

### A fix renumbers an untouched offender

**When** a change fixes some failing nodes on a screen and an untouched failing node with the same masked text changes its target ordinal as a result, **I want** (as the Developer making that change, or the reviewer approving it) a written rule that lets the same change replace the old key with the new one, **so that** fixing offenders is never blocked or escalated because a node nobody touched was renamed by the count.

Before this (GH-297 part 1), a target's ordinal (for example `span:$ #.#.#[2]`) counted only the failing nodes on the screen with the same masked text, in page order. Fixing some of them on Analysis could renumber an untouched by-variety amount, and the old and new keys read as a removed entry plus an added one, which the rules did not cover.

Success criteria:

1. A renumbered target is replaced in the same change that caused it. It is not growth and needs no exception.
2. The replacement is allowed only when the renumbering comes from a fix in that change, and only for the same cell under a new ordinal.
3. The lists still never grow in failing cells. For that screen, rule and masked text, there are never more entries after the change than before.
4. A reviewer can check it from the offender-file diff, and the node's being untouched from the code diff, without the Developer's evidence notes.

## Behaviour

### Time in tests

- **Controlled time.** Every test whose result depends on the date or time runs on a time the test controls. This covers:
  - invitation expiry;
  - reset links;
  - the login brakes;
  - the Argentina business day and "today": the current price, a future date refused, and the day change that triggers upkeep.
- **The invitation clock.** Its separation from the app's injected clock (ADR-0001) leaves no test able to expire on the real clock. The mechanism is the Tech Lead's.
- **Allowed use of the real clock.** A test of the app's own clock (for example, that "today" is the Argentina business day) may read the real clock only if its verdict is the same on any date and at any hour.
- **Production code** that legitimately reads the real clock (the app's "today", the upkeep ticker) is not governed by this file.
- **Edited tests keep their meaning.** A test may change how it sets its time. No assertion about product behaviour is dropped, loosened or changed in meaning.

### Staying fixed

- A new test whose result depends on the real date or time is flagged when it is added, before it can go green.
- The mechanism is fast and checks no elapsed time.

### Exceptions

- A test that cannot be made independent of the real date or time is escalated to the PM.
- It is never deleted, and never kept as a known exception without a decision.

### Verification

- A one-time check that the gate's suites pass at a date more than 7 days ahead and across an Argentina midnight.
- It is recorded in the evidence of the task that changes how tests keep time.
- It is not repeated on every gate run.

### Mobile standard offender lists

The mobile standard keeps offender lists under `web/src/mobile-standard/offenders/`:

- `unreachable.json` lists screens the mobile walk cannot reach yet.
- The other lists, such as `touch-target.json` and `touch-action.json`, list the real cells that fall short of a rule.

This file is the one place the rule is written. The other live texts name the two allowed kinds of growth (the trade and a new registry row) in one sentence and point here: CODING_STANDARDS.md §10, its twin in `docs/product/design-system/README.md`, item 39 of `docs/product/accounts.md`, and the header of `web/src/mobile-standard/offenders/index.ts`. A renumbered target, below, is not growth, so those texts do not need to name it.

- **No growth (invariant 9).** The offender lists never grow, except by the trade or by a new registry row, both below. It was first written as invariant 9 of the GH-271 plan.

#### The trade

- **Per cell.** An offender cell (screen, size, theme) may be added only when the same change removes that screen's `unreachable` coverage at that size and theme. The real cells go in whichever offender lists they belong in.
  - Every added cell names the same screen as the removed entry's `screen`. Only those cells count toward the trade.
  - Partial reach: an entry that only narrows its `sizes` or `themes` trades only the cells it lost. For example, `VentaAsignarCliente` is listed as unreachable at 246x437 only.
  - A `*Texto130` screen is its own screen name and trades on its own.
  - One change may carry several trades.
- **Matched by screen, not by issue.** Whether a trade is valid depends only on the screen name. A traded cell must name an issue from `AREA_ISSUES`, and it may name either:
  - the removed `unreachable` entry's issue, or
  - the issue the same screen's existing offender entries carry.
  - A screen with no existing entries uses the removed entry's issue. If its existing entries span two issues, the reviewer accepts either.
  - CobroDesdeInicio's cells carry #46, while its removed entry carried #45. Both are valid.
- **No offending cells.** A screen that becomes reachable with no offending cells just loses its `unreachable` coverage. Nothing is added.

#### A new registry row

- **Per cell.** An offender cell (screen, size, theme) may be added when the same change adds that screen's row to the screens registry at that size and theme. The row was not in the registry before the change. The real cells go in whichever offender lists they belong in.
  - Every added cell names the new row's screen. Only those cells count.
  - A `*Texto130` screen is its own screen name and counts on its own.
  - One change may add several rows.
- **Unreachable new row.** If the walk cannot reach the new row yet, the same change lists it in `unreachable.json` at the sizes and themes it cannot reach. Its real cells come later, through the trade.
- **Issue.** Each added cell names an issue from `AREA_ISSUES`.
- **Same change only.** Cells for a row that already existed before the change are never this kind of growth, even when that row was added only recently.
- **On record.** `InicioChecklist` (Home with the first-run checklist) and `InicioImportado`, the phone rows added by GH-274, brought their real cells in `touch-action.json` in that change. Each entry carries its reason. They are this rule's first case and need no exception.

#### A renumbered target

A target's ordinal (`[n]`) counts only the failing nodes on the screen with the same masked text, in page order. When a change fixes some of them, an untouched one can change key with no change to itself. That is the same cell under a new name, not growth.

- **Replaced in the same change.** The change removes the old key and adds the new one when all of these hold:
  1. **Same entry otherwise.** The added and removed entries have the same `screen`, `rule`, sizes, themes and issue. Their `target` differs only in its trailing ordinal: a different number, or the ordinal added or dropped.
  2. **A fix caused it.** The same change also removes at least one entry on that screen with the same rule and the same masked text, a node it fixed.
  3. **No net growth.** For that screen, rule and masked text, there are no more entries after the change than before.
  4. **The node is untouched.** The renumbered node's own markup is not in the change's code diff.
- **Otherwise it is growth.** A key change that fails any of these is an added entry like any other. It is fixed in the same change or escalated, never listed.
- **On record.** GH-297 part 1 (Analysis) is the first case: by-variety amounts left untouched could renumber when the summary strip, cost rows and "since the first record" block stopped failing. Those swaps keep #48 and are listed in the change's moved targets as `old key → new key`.
- **On record, GH-319 part 1 (New variety).** `VariedadNueva` lists `aria-busy` and `data-while-loading` (`span:Up to # characters · cannot repeat another variety's na`, issue 47) because a direct `/varieties/new` now draws Varieties behind the sheet (`BehindPane`), and that pane's read makes the held walk judge the form's own `main`: no `aria-busy`, and the form's static help line has digits. Removing the two entries makes the phone check report exactly them as unlisted. The pane may not carry `aria-busy` and the help text may not change; a clean fix is a walk that ignores reads made only for an inert pane, which would also change `ClienteNuevo`, `GastoNuevo` and `EntradaStock`, and is left for its own change.

#### Common to all three

- **Not allowed.** Any other growth breaks invariant 9:
  - cells for a screen whose `unreachable` entry stays;
  - cells for a row already in the registry before the change, except a renumbered target as above;
  - cells naming a different screen from the one whose entry was removed or whose row was added;
  - cells at a size or theme that the removed entry or the new row does not cover.
- **No cap.** A reachable screen or a new row brings all its real cells, however many.
- **Tracked like any other offender.** Added cells and renumbered targets are tracked like any other offender from then on. They are never hidden, never marked exempt, and never read as a regression.
- **Readable from the files.** Growth and renumbering can be checked by screen name from the before and after offender files, plus the screens registry diff for a new row and the code diff for an untouched renumbered node. The Developer's evidence notes are not needed.
- **Enforcement is by review only.** `diffOffenders` already makes listing and walking land together. A reachable screen's or a new row's real cells are `unlisted` until they are listed, and a reachable screen's `unreachable` cells turn `fixedButListed`. A renumbered target shows as its new key `unlisted` and its old key `fixedButListed` until the swap is made. Checking that the added cells name the removed or added screen, or are a valid renumbering, would need the base revision, which means git inside vitest, against ADR-0038 and ADR-0041. So the reviewer matches screen names and keys across the diffs. Listing an unrelated new failure to get green is caught only in review, as before.
- **No one-off exceptions.** No per-task exception is recorded for a screen becoming reachable, a row being added or a target renumbered. The rules accept `CobroDesdeInicio` (collecting from Home; its removed `unreachable` entry at 246x437, #45, traded for seven 246x437 cells on #46) and `InicioChecklist` and `InicioImportado` (GH-274) with none. The exception recorded on GH-271 is retired.

#### Worked examples

Each shows the offender files, and where it matters the screens registry, before and after one change, and the verdict.

**1. Valid trade: passes.** `Cuenta` becomes reachable and has one failing cell.

```diff
 unreachable.json
-  { "screen": "Cuenta", "rule": "unreachable", "target": "", "issue": 45 }
 touch-target.json
+  { "screen": "Cuenta", "rule": "touch-target", "target": "button:Save", "issue": 45 }
```

The added cell names the screen of the removed entry, and names an issue.

**2. Entry kept, cells added: fails.** `Cuenta` gains a cell, but its `unreachable` entry stays.

```diff
 unreachable.json
   { "screen": "Cuenta", "rule": "unreachable", "target": "", "issue": 45 }
 touch-target.json
+  { "screen": "Cuenta", "rule": "touch-target", "target": "button:Save", "issue": 45 }
```

Nothing was traded for the new cell, so the list grew.

**3. Cells naming another screen: fail.** `Cuenta` loses its entry, but the added cell names `Perfil`.

```diff
 unreachable.json
-  { "screen": "Cuenta", "rule": "unreachable", "target": "", "issue": 45 }
 touch-target.json
+  { "screen": "Perfil", "rule": "touch-target", "target": "button:Save", "issue": 45 }
```

The cell does not name the removed entry's screen, so it is not part of the trade.

**4. Reachable with no cells: passes.** `Cuenta` becomes reachable and nothing fails.

```diff
 unreachable.json
-  { "screen": "Cuenta", "rule": "unreachable", "target": "", "issue": 45 }
```

Only the entry leaves. Nothing is added.

**5. New row with its cells: passes.** The change adds the phone row `InicioChecklist`, and it has failing cells.

```diff
 screens registry
+  InicioChecklist (phone)
 touch-action.json
+  { "screen": "InicioChecklist", "rule": "touch-action", "target": "…", "issue": 46 }
```

The added cells name only the row added in the same change, and name an issue.

**6. Cells for an existing row: fail.** No row is added, and a cell for `InicioHoy`, already in the registry, is added.

```diff
 touch-action.json
+  { "screen": "InicioHoy", "rule": "touch-action", "target": "…", "issue": 46 }
```

The row was there before the change, so the new cell is a regression to fix, not a growth to list.

**7. New row, cells naming another screen: fail.** The change adds `InicioImportado`, but a cell for `Perfil` is also added.

```diff
 screens registry
+  InicioImportado (phone)
 touch-action.json
+  { "screen": "InicioImportado", "rule": "touch-action", "target": "…", "issue": 46 }
+  { "screen": "Perfil", "rule": "touch-action", "target": "…", "issue": 46 }
```

The `InicioImportado` cell is valid. The `Perfil` cell breaks invariant 9.

**8. Renumbered after a fix: passes.** The change fixes the first `Analisis` amount with masked text `$ #.#.#`. The untouched second one moves from `[2]` to `[1]`.

```diff
 figure-split.json
-  { "screen": "Analisis", "rule": "figure-split", "target": "span:$ #.#.#[1]", "issue": 48 }
-  { "screen": "Analisis", "rule": "figure-split", "target": "span:$ #.#.#[2]", "issue": 48 }
+  { "screen": "Analisis", "rule": "figure-split", "target": "span:$ #.#.#[1]", "issue": 48 }
```

One node was fixed and the other kept its cell under a new ordinal. The entries for that masked text went from two to one, and the renumbered node's markup is not in the code diff.

**9. Renumbered with nothing fixed: fails.** No `Analisis` entry with masked text `$ #.#.#` is fixed, yet a key moves.

```diff
 figure-split.json
-  { "screen": "Analisis", "rule": "figure-split", "target": "span:$ #.#.#[2]", "issue": 48 }
+  { "screen": "Analisis", "rule": "figure-split", "target": "span:$ #.#.#[3]", "issue": 48 }
```

Nothing with that masked text was fixed, so the shift means a new failing node appeared before it. That is a regression to fix, not a renumbering.

## Metrics

There is no telemetry. These are read from the task's evidence and from review.

- **Shifted-date pass (time job, criterion 1):** a run more than 7 days ahead and across an Argentina midnight passes.
- **Real-clock tests accounted for (time job, criteria 2 and 5):** every test that depended on the real clock is listed with how it is now covered. None is left uncovered and none is deleted.
- **No behaviour change (time job, criterion 3):** the gate passes, and every edited test keeps its product assertions. Checked in review.
- **Gate stays fast (time job, criterion 4):** no new waiting and no elapsed-time assertions. Checked in review against ADR-0038 and ADR-0041.
- **Staying fixed:** the flagging mechanism is shown catching a deliberately added real-clock-dependent test.
- **Trade recognised (trade job, criteria 1 and 3):** four cases are shown, each with the expected verdict:
  - a valid trade passes;
  - an entry kept plus cells added fails;
  - cells naming another screen fail;
  - a screen made reachable with no cells passes.
- **Nothing hidden (trade job, criterion 2):** after a trade, every cell of the newly reachable screen is in the offender lists, each naming an issue.
- **Self-evident trade (trade job, criterion 4):** the reviewer confirms the trade from the offender-file diff alone.
- **New row recognised (new-row job, criteria 1 and 3):** three cases are shown, each with the expected verdict:
  - a new row with its cells passes;
  - cells for an existing row fail;
  - cells naming another screen alongside a new row fail.
- **Nothing hidden (new-row job, criterion 2):** every real cell of `InicioChecklist` and `InicioImportado` is in the offender lists, each naming an issue and carrying its reason.
- **Self-evident new row (new-row job, criterion 4):** the reviewer confirms the growth from the registry diff and the offender-file diff alone. Compared with GH-274's base, the lists grow by exactly the entries for `InicioChecklist` and `InicioImportado`, and remove none.
- **Renumbering recognised (renumber job, criteria 1 to 3):** two cases are shown, each with the expected verdict:
  - a renumbering after a fix passes;
  - a renumbering with nothing fixed fails.
- **Self-evident renumbering (renumber job, criterion 4):** for each swapped key, the reviewer confirms from the offender-file diff that a same-text entry was removed and the count did not grow, and from the code diff that the node was untouched.
- **No one-off exceptions (all offender jobs):** no per-task exception for a screen becoming reachable, a row being added or a target renumbered remains, CobroDesdeInicio's and GH-274's included.
- **Twins aligned:** CODING_STANDARDS.md §10, the design-system README, item 39 of accounts.md and the header of `offenders/index.ts` each name both allowed kinds of growth in one sentence and point here.

## Out of scope

- Any product rule, screen, route, refusal or copy.
- Production code that legitimately reads the real clock.
- Repeating the shifted-date runs on every gate run.
- Timing assertions of any kind (ADR-0038).
- A cap on how many cells a reachable screen or a new row may bring.
- Changing the touch-target or touch-action standard itself, or fixing the cells that become visible.
- Changing how a target's ordinal is computed: the renumbering rule accepts the ordinal as it is.
- Letting offender lists grow in any case other than the trade or a new registry row.
- Translating `docs/product/design-system/README.md`.
