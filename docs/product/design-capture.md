# Design capture

The evidence a reviewer uses to judge that a screen looks as designed: the design file and the built app are captured side by side from the screens registry (`scripts/design/screens.json`), with pinned fonts, by `scripts/design/comparisons.mjs`, and when a change needs a before/after pair, the raw captures are compared by exact AE with `scripts/design/ae.mjs` (ADR-0042). How a shot is taken is frozen by ADR-0052 (the GH-301 request called it ADR-0050). This file holds what the capture and its registry must guarantee for the people who rely on them. It changes no product behaviour: no capability's rule, screen, route, step or copy is defined here, and the capture always follows the product, never the reverse. It is review evidence attached to a PR and judged by eye; it is never a step of the gate (docs/product/gate.md). Sellers and the operator see nothing of it.

## Jobs

**When** I run the design capture over Home and the Onboarding before approving a change, **I want** every screen the registry lists, both themes of the last Onboarding screen included, to be reached the way a seller reaches it and captured whole, and the registry, its tests and the plan to agree, **so I can** trust a green `--strict` run as evidence and approve without hand-patching a test, accepting a screen that was never reached, or recording an exception.

- Its protagonist is the maintainer, or the reviewer acting for them, as in docs/product/accounts.md's and docs/product/gate.md's maintainer jobs. The seller is affected only indirectly: a capture nobody can trust holds up the changes they are waiting for.
- It refines the "looks as designed" criteria (docs/product/navigation.md criterion 7, docs/product/onboarding.md criterion 5 and its design metric, docs/product/icon-and-text-rule.md criterion 6); it is not a new product job.
- It also serves when a design guard or a registry test fails and the maintainer must tell a real defect from a broken registry row.
- Before it (GH-142's follow-up): a one-test edit broke the plan's own invariant, the `OnboardingListo` row could not reach the last Onboarding screen, the `OnboardingListoOscuro` crop was clipped, and those two defects had no issue.

**When** I am about to approve the Onboarding restyle from GH-164 and the evidence on the PR covers only some of its screens, **I want** every Onboarding step and "Done" compared with its design (phone and computer viewports, light and dark, the narrowest phone at 130 % text) and a before/after pair of the restyle, **so I can** approve knowing that only the intended things changed and that nothing a seller reads or taps there moved, without approving on partial evidence or holding the PR.

- Its protagonist is the maintainer, or the reviewer acting for them; the seller is affected only indirectly.
- It refines docs/product/onboarding.md criterion 5 and docs/product/icon-and-text-rule.md criterion 6; it is not a new product job.
- Before it (GH-164's follow-up): approval rested on two of the seven screens (Bot and the last Onboarding screen); Partner and Expense categories were never read; there was no dark theme, no 320 px / 130 % check and no before/after pair.

**When** I review a change against the design capture, **I want** every row of the screens registry to name the screen and the record it actually reaches and captures, **so I can** approve from the capture alone, without checking the registry against the screenshots by hand and without leaving a finding open on an approved head.

- This refines the first job and its criterion 2; it is not a new job. Its protagonist is the same maintainer or reviewer.
- Before it (GH-166's follow-up): the light `VariedadArchivada` row declared `/varieties/{low}` while it navigated to `/varieties/{sold_out}` and captured Sir Jack. ADR-0033's cross-check reads both placeholders as `{id}`, so no test saw it, and the reviewer reconciled the row by hand.

**When** I run the design capture over the whole registry, as a before/after run does (ADR-0042), **I want** every row to reach its screen and every capture to pass its font check, **so I can** read a non-zero exit as a real failure and attach the run as evidence without explaining away rows that always fail.

- This refines the first job and its criterion 1 for the whole registry; it is not a new job. Its protagonist is the same maintainer or reviewer.
- Before it (GH-219's and GH-150's evidence): `EstadosConfirmar` never reached "Delete sale", and `EstadosSinConexionCompu` and `EstadosSinConexionCompuOscuro` failed the font check on their offline step, on base and head alike, so every whole-registry `--strict` run exited 1 with every other row ok.

**When** I review a change to how Analysis looks, **I want** current before and after captures of Analysis, a comparison over every other screen in the registry, and a plan that names every file the change edits, **so I can** approve or reject from the PR's evidence alone, without retaking captures, hand-checking screens or carrying an open finding into the next task.

- Its protagonist is the maintainer, or the reviewer acting for them (in the end Zeta). The seller is affected only indirectly: a change nobody can approve holds up the Cost of goods sold and Stock shortfall rows they are waiting for.
- It refines docs/product/analysis.md's design metric and the job above; it is not a new product job and adds no product behaviour.
- Before it (GH-141's follow-up): the muestra guard was edited outside the plan's declared seam, and the design evidence was missing or stale. The same spec-scope finding was raised three times on one head.

**When** I review a change whose before/after design capture (`compare.sh` / `comparisons.mjs`) was taken on the shared development machine, where other agents and worktrees are always running, **I want** that capture to count as evidence whatever load the machine was under, **so I can** approve on it without the Developer recording a rule as "unsatisfiable" and shipping past it.

- Same protagonist as the job above; it refines that job and is not a new product job.
- Before it (GH-150's follow-up): a plan invariant asked for `compare.sh` runs with no foreign load; all six runs had load, so it could never hold, and it was recorded as unsatisfiable and shipped past.

**When** I review a change to Home's first-run elements before approving it, **I want** the tests, the `/first-run` contract and the design capture to prove what docs/product/navigation.md, docs/product/results.md and ADR-0046 say in every state they can be in and in both themes, **so I can** approve from the evidence alone, without trusting partial checks or carrying open findings into the next task.

- Same protagonist as the jobs above; it refines this file's second and third jobs for the Home rows and is not a new product job. Its test and contract side is docs/product/navigation.md's.
- Served here by the `InicioHoyCompu` row naming its own section, and by a by-eye audit of the other `Inicio*` rows.
- Before it (GH-45's follow-up): `InicioHoyCompu` named no section, so its Today-only capture was compared with the whole `InicioCompu.dc.html`, which also draws Week, and its difference was non-zero by construction.

**When** I review a design capture, base against head or one run against another, **I want** every screen captured in the state it comes to rest in, with no switch or other element caught partway through a change (an animation, a background refresh, a control still disabled while it waits), **so I can** read AE 0 as "nothing changed" and any non-zero line as a real difference, and approve without rerunning, explaining a difference away, or carrying an open finding into the next task.

- Same protagonist as the jobs above; it refines the captures-under-load job and is not a new product job. The trigger is a non-zero AE line on a screen the PR did not touch. The seller is affected only indirectly.
- Before it (GH-45's evidence and GH-261's runs): `VariedadesCompu built: AE 2888`, the open variety's "Low stock warning" switch caught grey in some runs and black in others. ADR-0042's GH-261 amendment read it as an unsettled CSS transition; it was the switch drawn disabled while the page re-read stock in the background, and enabled once that read ended. Reviewers reran, or listed the line as unexplained.

**When** I review a change that touches Home and I look at its design capture before approving it, **I want** every first-run element Home can show (the Onboarding notice, the first-run checklist with its "Done" marks, the after-import notice) and the Today tab on the computer each captured on its own and compared against a drawing of exactly that, **so I can** approve or reject from the PR's evidence alone, without checking those states by hand on a business I set up myself, and without reading Week's figures into a comparison of Today.

- Its protagonist is the maintainer, or the reviewer acting for them; the seller is affected only indirectly: Home changes that can't be approved from evidence wait longer.
- It refines the first job above ("every row reaches its screen") and docs/product/results.md criterion 12 ("Looks as designed"); it is not a new product job and adds no product behaviour.
- Before it (GH-45's evidence, docs/evidence/GH-45-inicio-captures.md): no drawing showed the first-run checklist or the after-import notice and no capture could reach a business that shows them, so a reviewer judged them by hand if at all; `InicioHoyCompu` and `InicioHoyCompuOscuro` compared against the whole `InicioCompu` file, Week included.

**When** I am asked to accept GH-272's Home restyle, **I want** to see how Home measures against its design on every Home variant (light and dark, phone and computer), and how it holds at 960 px, 1280 px and 960 px with text at 130 %, **so I can** approve it knowing the seller's Home looks as designed, instead of trusting that it was built right.

- Its protagonist is the PM, who reviews and approves GH-272. The seller gets no new behaviour; their Home (the Panel, tabs Today, Week and Month) on their devices and with enlarged text is what is protected. A later change that must not break Home's look can reuse the same evidence.
- It refines docs/product/results.md criterion 12 ("Looks as designed") and the Analysis and Onboarding evidence jobs above; it is not a new product job and adds no product behaviour.
- Before it (GH-272's follow-up): GH-272 was approved with invariant 12 resting on construction alone. There was no `ae.mjs` after-run, no list of `InicioCompu` (Home, computer layout) and `InicioCompuOscuro` AE lines and no screenshots at 960 px, 1280 px or 130 % text, so the Coverage block marked it "Not touched" and an `important` finding stayed open at `web/src/styles/app.css:3098`.

**When** I review the shot method that ADR-0052 froze, **I want** one document showing that the method gives the same result run after run, and showing every row where it differs from the old capture, with an image of each, **so I can** judge each difference once, on evidence I could reproduce, and close GH-273's five findings.

- Its protagonist is the PR reviewer. The seller is affected only indirectly: a capture method nobody can trust holds up the changes they are waiting for.
- It refines the captures-at-rest job and its Rest criterion 1 for the shot method; it is not a new product job and adds no product behaviour.
- Before it (GH-273): five findings stood open against the old way of taking a shot, `VariedadesCompu built` among them, captured gray by the old tool. No evidence showed the new method repeating itself or accounted for each row where it differs from the old one.
- Served by `docs/evidence/GH-301-shot-method.md` and its side-by-side images under `docs/evidence/GH-301/` (GH-301 part 3), the only files that task changes. It waits on two separate pieces of work: a retaken baseline (a newly pinned app commit and part 1's census rerun on it) and a fix that lets the four sides ADR-0052 risk 1 names produce an image.

Success criteria:

1. **One green run.** One `--strict` call over `Inicio*` (Home) and the Onboarding block exits 0.
2. **Reached and whole.** Every Onboarding screen the registry lists, the last Onboarding screen in light and dark included, is reached as docs/product/onboarding.md defines and captured whole. No crop is clipped, and no row captures a screen other than the one it names.
3. **Registry, tests and plan agree.** The change needs no recorded exception and no test edited outside a declared seam.
4. **Nothing a seller sees changes.** docs/product/onboarding.md, docs/product/navigation.md and every screen read and behave as before, and every test passes. The only edited tests are the two registry tests; the only other edited files are design tooling (`scripts/design/screens.json`, `scripts/design/screens.mjs`, `scripts/design/sample_app.py`, `scripts/design/comparisons.mjs`); no file under `app/` or `web/src/` changes beyond those two tests.
5. **No test loosened.** A changed registry or enforcement test keeps everything it guarded and states the corrected rule.
6. **Every row tells the truth about its record.** A row's declared path names the same sample record its route and steps reach and capture. The light `VariedadArchivada` row names Sir Jack (`{sold_out}`), an archived variety reached from Archived. A dark twin's own declaration matches its own capture; it need not show the light row's record.
7. **The registry, its tests and docs/product/navigation.md agree on the archived variety's page** and its parent "‹ Archived", with no recorded exception and no loosened test.
8. **Truthfulness costs the seller nothing.** Fixing a row's declaration changes no capability doc, nothing under `app/`, and nothing under `web/src/` but `web/src/design/screens.test.ts` within its declared seam. No row's steps change to make it truthful.
9. **A wrong record never passes unnoticed again.** An entry whose path names a record different from the one its route names fails the registry test in the diff that introduces it.
10. **The whole registry runs green.** One `--strict` call over the whole registry, with no `--only`, exits 0. No row is removed, skipped, excused or listed as a known failure to get there.
11. **Offline captures keep their fonts.** A row that takes the app offline is captured with the page's own fonts applied, and the applied-check runs on it exactly as on every other row.
12. **Reaching every row costs the seller nothing.** Making a row reach its screen changes only that row's steps, the sample data and the capture tooling under `scripts/design/`, plus the two registry tests within their declared seams. No screen, copy, capability doc or the app's own font loading changes.

Success criteria, the Onboarding restyle's evidence (GH-164 follow-up) (numbered on their own; Metrics cites them as "Onboarding criterion N", and the plain "criterion N" there is the list above).

6. **Every Onboarding screen covered.** Each of the six steps and "Done" has captures for the phone and computer viewports, in light and dark, plus one phone capture at 320 px with text at 130 %, in light only, all from one `--strict` run that exits 0. A missing screen, a missing side or a one-sided `null` is a failure, never a pass.
7. **A before/after pair of the restyle.** "Before" is the code without GH-164's change (once it has merged, the merging head with only that change undone, the undo diff in the PR); "after" is the head that merges. Both come from the head's own `comparisons.mjs`, one install, the same Argentina day, fonts pinned, and are compared as raw captures by exact AE with `ae.mjs`. The PR records the installed `@fontsource/plus-jakarta-sans` version.
8. **Every difference accounted for.** Each non-zero difference, and each difference between the design and the docs, is listed in the PR with its screen and side, as intended (by GH-164's brief) or fixed. A difference between docs/product/onboarding.md and the drawing on what a step shows is a defect in the drawing. A difference neither the brief nor the docs can settle goes to Zeta in the PR.
9. **Nothing clipped.** At 320 px with text at 130 %, no line, control or crop of any step or "Done" is clipped, and controls stay at least 44 px.
10. **No seller-visible change beyond a listed fix.** Every suite passes; no test is edited to fit, the two registry tests excepted when rows are added.

Success criteria, reviewing GH-141's change to Analysis:

6. **Current captures of Analysis.** The PR has before and after captures of Analysis on phone and computer, in light and dark.
   - "After" is the head that merges the change; "before" is that same head with only GH-141's change undone (docs/product/pinned-catalog.md's "Restyling Integrations" rule), with the undo diff in the PR.
   - If undoing GH-141 alone changes more than GH-141 did, the PR says so and lists the extra differences for Zeta; nothing more is undone.
   - Both sides come from head's `comparisons.mjs --strict`, one install, one Argentina day, fonts pinned (ADR-0042). The PR records the fontsource version.
7. **Every other screen compared, every difference explained.** `ae.mjs` runs over the raw captures of every other screen in the registry, with its output attached. AE 0 is expected; every non-zero line is accounted for (see Behaviour). A missing side, a one-sided `null` or an unreadable capture is a failure, never AE 0.
8. **The guard edit is declared, not loosened.** The plan's seam for `muestra` names `tests/design/test_muestra_screens.py` and `tests/design/muestra_guard.py`, for that plan only, and the guard keeps everything it checked before.
9. **Nothing a seller sees changes** beyond GH-141's decided intent: docs/product/analysis.md and ADR-0020's GH-141 amendment stand, and every suite passes.

Success criteria, captures under load (numbered on their own; Metrics cites them as "Load criterion N"):

6. **Accepted under load.** A before/after captured while the machine carries foreign load is valid evidence. No plan invariant or evidence rule asks for an idle machine, and nothing is recorded as "unsatisfiable" or as an exception.
7. **Load doesn't change the result.** A commit captured under load and captured idle gives exact AE 0 on every raw capture, design side and built side. If load changes a capture's pixels, that is a capture defect, fixed in the capture, never by asking for an idle machine and never by loosening the comparison.
8. **The gate is untouched.** The capture stays review evidence judged by eye and is never a gate step. No elapsed-time check is added (ADR-0038).
9. **Nothing a seller sees changes.** No screen, copy, route or product rule changes. Every suite passes with no test loosened.

Success criteria, the Home Today capture (GH-45 follow-up) (numbered on their own; Metrics cites them as "Today criterion N"):

1. **The capture tells the truth.** On the design side, `InicioHoyCompu` is compared against its own named section, the Today frame, not the whole `InicioCompu.dc.html`. On the built side it shows the app as it opens, on Today. A non-zero difference there is a real difference.
2. **Every Home row accounted for.** The PR audits every other `Inicio*` row by eye. Each declaration-only fix is made in the same task, every other fix is a linked follow-up issue, and nothing found is left unexplained.
3. **Nothing loosened, nothing a seller sees.** Only `screens.json`, the two registry tests (within their declared seams, each keeping every guard it had) and the one Today frame caption of `InicioCompu.dc.html` change. No screen, copy a seller reads or capability rule changes, the capture script is untouched, and no capture step joins the gate.

Success criteria, captures at rest (numbered on their own; Metrics cites them as "Rest criterion N"):

1. **Repeatable.** Five whole-registry `--strict` runs per commit, with no `--only`, each on a fresh sample and on the same Argentina day, each compared with the first run by `ae.mjs`, give AE 0 on every row and side, `VariedadesCompu built` included. Base and head, both captured with head's tooling, give AE 0 on every row the change did not touch. Runs on the loaded shared machine count; an idle machine is never required.
2. **The resting state.** What is captured is the state the screen comes to rest in once nothing is still changing: no animated change running, no request pending (a background re-read included) and no control still disabled or busy while it waits. For the open variety's "Low stock warning" switch on VariedadesCompu, that is the switch enabled, on or off as the sample's stored threshold gives it, never drawn disabled mid-refresh.
3. **Never half-drawn.** A screen that has not come to rest when it is captured fails its row under `--strict`. It is never accepted as a pass.
4. **Nothing loosened, nothing a seller sees changes.** There is no pixel tolerance. No row is excused, skipped or listed as a known failure. The app's own behaviour (its animated changes, a control disabled while a refresh runs), screens and copy are not changed to make the capture pass. Capture stays review evidence and never becomes a gate step.

Success criteria, Home's first-run and Today evidence (GH-45 follow-up) (numbered on their own; Metrics cites them as "First-run criterion N"):

1. **Every first-run element has a drawing and registry rows.** `pantallas/` draws the first-run checklist with its "Done" marks and the after-import notice, and each has registry rows that reach it the way a seller sees it, capturing its section whole.
2. **Today is compared as Today.** `InicioHoyCompu` and `InicioHoyCompuOscuro` crop to a section holding only Today, never one that also draws Week.
3. **Whole registry green, nothing a seller sees changes.** One whole-registry `--strict` run with no `--only` exits 0, with no row removed, skipped or excused. No capability doc's rule, screen, route or app copy changes. The only edited tests are the two registry tests within their declared seams and `tests/design/test_sample_app.py`, this plan's own declared seam, extended only; every other test passes unedited.
4. **Differences are listed.** Wherever a drawing and the docs differ on wording or on what is shown (docs/product/navigation.md for the checklist and the after-import notice, docs/product/results.md for Home's order), the PR lists every difference.

Success criteria, the Home restyle's evidence (GH-272 follow-up) (numbered on their own; Metrics cites them as "Home criterion N"):

1. **Exact match on five screens.** `Inicio` (Home), `InicioOscuro` (Home, dark theme), `InicioHoy` (Home on the Today tab), `InicioHoyCompu` (Home on the Today tab, computer layout) and `InicioHoyCompuOscuro` (the same, dark theme) each show exact AE 0, design side and built side, in an `ae.mjs` output attached to the PR. "Near zero" does not pass; a missing side, a one-sided `null` or an unreadable capture is a failure, never AE 0.
2. **Every `InicioCompu` line accounted for.** Every AE line of `InicioCompu` (Home, computer layout) and `InicioCompuOscuro` is listed with its screen and side, each at 0 or with a one-line reason the PM accepted on the PR, saying the difference is intended by GH-272 or comes from the design file itself. A reason naming no cause ("rendering noise") is not accepted; a line without an accepted reason is a mismatch.
3. **Home holds at every width.** Screenshots of Home's computer layout, light theme, Today, Week and Month tabs, are attached at 960 px, 1280 px and 960 px with 130 % text. In each, nothing is clipped, overlapping, truncated mid-word or unreachable, and every figure and control can still be read and used.
4. **Invariant 12 covered.** The Coverage block carries a one-line result for invariant 12, moved from "Not touched" to covered and pointing at the PR evidence, and the finding at `web/src/styles/app.css:3098` is closed from it.
5. **Nothing loosened, nothing new a seller sees.** No design file is edited; any fix brings the build to the design within what GH-272 restyled on Home and changes no copy, behaviour, figure or route; no capture step joins the gate.

Success criteria, the shot method's evidence (GH-301 part 3) (numbered on their own; Metrics cites them as "Shot criterion N"):

1. **Repeatable, criterion (a).** For the head and for the base (the earliest commit before the pinned app commit whose app shows every label today's registry clicks, captured with the head's `scripts/design` as overlay), five whole-registry `--strict` runs each, no `--only`, each on a fresh sample, all ten on one Argentina day and each exiting 0; `ae.mjs` comparing run 1 with runs 2 to 5 on each side shows 0 non-zero lines, no missing side and no one-sided `null`. Anything else is reported as a defect, never smoothed over or re-run until it passes.
2. **Old versus new, criterion (d).** Head run 1 is compared with part 1's census run (ADR-0052 risk 6), retaken on the newly pinned app commit and on the same Argentina day as the ten runs, using `ae.mjs --box`. Every differing row and side has a side-by-side PNG committed under `docs/evidence/GH-301/` and one line in the verdict table linking it. No line is caused by the seed date alone.
3. **One loud failure.** The method is shown failing a row, with its non-zero exit code under `--strict`, its `null` side, no PNG under any name and its fixed English reason naming the side.
4. **Judged, not just listed.** The reviewer has judged every line of the verdict table, with 0 wrong and 0 unjudged. A complete but unjudged table is not done.
5. **Reproducible.** The reviewer could repeat the runs from what the document records.
6. **Nothing else moves.** Only `docs/evidence/GH-301-shot-method.md` and the side-by-side PNGs under `docs/evidence/GH-301/` change; nothing under `app/` or the product part of `web/src/`, no registry row, and nothing in the gate, CI or `.agentic/stack.yaml`. What the capture records and prints carries no page text, names, amounts or pixel data; the committed images show only the sample business.
7. **Every side has an image.** No side is recorded as a known failure: the four sides ADR-0052 risk 1 names (`Inicio` design and built, `Gastos` built, `VariedadesCompu` built) each produce a real image before GH-273's findings close.

## Behaviour

### What a capture is

- Fonts are pinned and the design capture never touches the network; `--strict` turns a font or screen-level failure into a non-zero exit, after every screen ran and `index.json` was written (ADR-0042).
- Each screen writes its composed sheet and its raw design and built captures; a before/after compares the raw captures by exact AE, never the sheet (ADR-0042).
- A row's `section` crops the design side only; the built side is captured whole, as the screen is reached.
- A capture is review evidence, judged by eye in the PR. It is never a gate step, and no new automated check is added for it.
- **A capture's result does not depend on machine load.** No plan invariant or evidence rule asks for an idle machine; a capture taken on the shared, loaded development machine is valid evidence as it stands.
- **A capture is taken only once the screen is at rest**, on the design side and the built side, on every row of the registry. At rest means nothing is still changing:
  - every animated change that ends (transitions and finite animations, on any element of the captured screen) has finished;
  - no request is still pending, a background re-read the screen started on its own included;
  - no control is still between states, such as disabled or busy while a refresh runs.
- An element is captured in the state it comes to rest in. For VariedadesCompu's open variety, the "Low stock warning" switch is captured enabled, on or off as the sample's stored threshold gives it, never grey because the capture landed while stock was being re-read.
- **How a shot is taken** is ADR-0052's: one method for every row and both sides, showing the seller's view at the row's registry viewport with nothing moved, stretched or cut off by the shot.

### Capturing at rest

- **Elements that never stop**: an element that never stops moving does not fail its row just for moving, and gets no exemption either: like every row, it must give the same capture on every run, whatever the machine's load. No registry row is designed to keep moving at rest (loading states are shaped like the content, docs/product/accounts.md), so no exception is named. A row that needed one is a product question for PM, never a registry entry.
- **Slow screens**: a slow screen passes once it comes to rest. A screen that has not come to rest within a bound fails its row (see Failures). The bound limits how long the capture waits; it is never a statement about duration, and nothing asserts elapsed time (ADR-0038). It is generous enough that load alone never fails a row. Its value, and how rest is detected (animations, pending requests, a control's state), are the Tech Lead's call.
- **No per-run state check**: waiting for rest is a condition on when to capture, never a check of what the screen shows. The capture never compares a screen's content with the sample data. The resting state is verified by eye in the evidence of the task that settled it, and a later regression to a stable but wrong state shows as a non-zero AE in a before/after or as a mismatch with the design file, caught by eye in review.
- **The app is not changed for it**: a control the app keeps disabled while a refresh runs (the seller's guard against acting mid-refresh) stays as it is; the capture waits for the refresh to end.
- **Which state is settled** is decided: the state the screen comes to rest in once nothing is still changing. GH-261's finding (`VariedadesCompu built: AE 2888`, the switch caught disabled while stock was re-read) is resolved by this rule.

### Every row reaches its screen

- Every row of the registry, not only `Inicio*` (Home) and the Onboarding, reaches its screen the way a seller does and captures its named section whole. A whole-registry `--strict` run exits non-zero only when a row truly fails.
- **`EstadosConfirmar`** reaches the delete confirmation (the caption `Antes de borrar` in `Estados.dc.html`) on a sale's detail as a seller does: it opens a sale that exists in the sample and taps "Delete sale". Its capture shows the confirmation whole: the question naming the sale's date, amount and grams that return, and "No, keep it / Yes, delete it" (docs/product/sales.md).
- **`EstadosSinConexionCompu` and `EstadosSinConexionCompuOscuro`** show "No connection" in the computer layout, light and dark. The page's own fonts are in place before the network drops, so going offline never leaves a page font in error. The capture's fonts stay pinned and local (ADR-0042).
- The applied-check is unchanged and covers every row, offline rows included: a font in error stays a failure, never a pass.
- A row is made to reach its screen by its steps, the sample data or the capture tooling alone. Never by changing the screen, its copy, the app's own `font-display`, or the applied-check, and never by dropping or excusing the row.
- A row that fails because the app itself no longer shows the seller's path is a product defect: it is escalated to the PM, never excused in the registry.

### A row names what it reaches

- The record a row names in its path is the record its route and steps reach and capture. A path that names no record (a form such as `/varieties/entries/new`, reached from a record) makes no claim about one.
- **The light `VariedadArchivada` row** declares `/varieties/{sold_out}`. Its route (`/varieties/{sold_out}`), its steps (archive, open "Archived (1)", click "Sir Jack") and its capture are unchanged.
- **`VariedadArchivadaOscuro`** declares and reaches `/varieties/{low}` (opens "Archived (2)", clicks Golden Cookies). The two themes need not show the same record.
- **The `EntradaStockSinEntradas` rows** (light, dark, Compu and CompuOscuro) declare the stock entry form, `/varieties/entries/new`, and start from `/varieties/{no_entries}`: that is how a seller reaches the form with "Initial stock" preselected, and they are true as they stand.
- **A row found naming a record other than the one it reaches** (path and route naming different records, or steps clicking a different record):
  - a fix to its declaration alone is made in the task that finds it;
  - a fix needing different steps or sample data becomes a follow-up issue linked from that task's PR;
  - nothing found is left unexplained in the PR.

### A row captures the part it names (GH-45 follow-up)

- **`InicioHoyCompu`** names its own `section`: the Today frame of `InicioCompu.dc.html`, never the whole drawing, which also draws Week. On the design side the section matches exactly one element (ADR-0042's strict crop); any other count fails the row under `--strict`. The built side is captured whole, as the app opens, on Today, judged by eye to show Today; no crop is added on the built side and the capture script is not changed. Its route, steps and record are unchanged. The exact section name is the Tech Lead's.
- **The one drawing edit**: the Today frame's caption in `InicioCompu.dc.html` changes from the bare word `Hoy` (Today), which also appears twice as a tab label, to `Hoy · la pestaña con la que abre el panel` (Today, the tab the panel opens on), the caption `Inicio.dc.html` (Home) already uses for the same frame. It is a frame caption no seller sees; nothing else in the drawing changes. Any difference it causes on the design side of rows drawn from that file is listed in the PR as intended. If no caption change makes the section match exactly once, the row stays as it is and becomes a linked follow-up issue.
- **No generic check** is added for a row that captures one part of a screen and names no section: no static rule can tell which part of a design file a row means, and a guess or an exemption list is refused.
- **The audit instead**: the PR carries a by-eye audit of every other `Inicio*` row, done as "A row names what it reaches" above. A row that compares a one-tab capture with a multi-tab drawing and names no section is fixed in the task when the fix is a declaration only; any other fix becomes a follow-up issue linked from the PR; nothing found is left unexplained.
- The change touches `scripts/design/screens.json`, the two registry tests as their declared seams, and the one caption above. The corrected row's capture is attached and judged by eye, with a before/after under ADR-0042.

### Registry rows for the last Onboarding screen

- **Every last-Onboarding-screen row reaches the last Onboarding screen the way a seller does**: it starts on an optional step once both required steps are met, on an account of its own in that state, and passes the remaining optional steps as docs/product/onboarding.md defines them. The account state is setup, not behaviour.
- **the last Onboarding screen has four rows**: phone light, phone dark, computer light and computer dark, so that it is covered on both viewports in both themes like every other Onboarding screen.
- **`OnboardingListo`** (the default row, phone light) follows that rule, on its own account written by the sample app (`scripts/design/sample_app.py`'s `ONBOARDING_ACCOUNTS`). It does not start at `/onboarding/categories`, does not run the whole flow through step 6, and never clicks "Skip the rest" on step 6.
- **`OnboardingListoCompu` and `OnboardingListoOscuro`** keep their accounts, `listo_compu` and `listo_oscuro`.
- **The computer dark row** (GH-164 follow-up) is new: it follows the registry's dark-twin convention for its name, on an account of its own written by the sample app. Its exact row and account names are the Tech Lead's.
- **Each last-Onboarding-screen entry has a distinct `open` account**; two entries on one account are refused, and a Done entry never names an `ended` account (the kind is in `facts.account_kinds`, ADR-0042's GH-189 amendment).
- **Capture accounts are design tooling only**: written by the sample app alone, never by product code or by the seed `muestra.md` is rendered from.
- **No product rule bends for a capture**: "Skip the rest" never appears on step 6, and the last Onboarding screen is reached when the last optional step is passed (step 6 by "Continue").

### Registry rows for Home's first-run elements and Today (GH-45 follow-up)

- **Rows**: the first-run checklist and the after-import notice get three rows each, phone, computer and phone-dark, like the existing `InicioPrimeraVez*` rows: 6 new rows. There is no computer-dark row for a first-run element; a later change to Home's dark computer layout adds one if it needs it. The existing `InicioPrimeraVez`, `InicioPrimeraVezCompu` and `InicioPrimeraVezOscuro` rows keep covering what they cover. Exact row and account names are the Tech Lead's.
- **The checklist's drawing and capture**:
  - design draws the four steps (docs/product/navigation.md) with their "Done" marks from existing design-system elements only: no new component, colour or token value;
  - the drawing and the capture show the same state, a mix with at least one step "Done" and at least one pending; never both required steps (1 and 2) "Done", since the checklist goes for good the first time both are met. Assumed mix: step 1 "Done" (a variety priced today), step 2 and both optional steps pending; any mix meeting the constraint serves equally;
  - each step reads its box and the word "Done", never colour alone, and the checklist carries no attention icon; the step labels are design's wording within the icon and text rule's limits;
  - its capture account is a business with no Onboarding state, as a business that existed before the Onboarding shipped.
- **The after-import notice's drawing and capture**:
  - the row captures the notice alone and whole: "Connect the bot so the pinned catalog updates by itself", its attention icon and its dismiss control; whatever sits in slot 1 is outside the crop;
  - its capture account is a business the spreadsheet import really loaded, as the import records it (docs/product/import.md, ADR-0046), captured before the notice is dismissed and before the bot is first published;
  - an imported business that also showed the checklist is a product defect (docs/product/navigation.md), never a state to capture.
- **The Today label**: only `InicioCompu.dc.html` changes. It gains a label for its Today section that occurs exactly once in the file, worded like the `InicioHoy` section label (`Hoy · la pestaña con la que abre el panel`, Today, the tab the panel opens on). It is a drawing annotation, not app copy. `InicioHoyCompu` and `InicioHoyCompuOscuro` crop to that section by that text. The built screen is untouched; if the crop could only be named by changing the built screen, the work stops and comes back to the PM as a copy question.
- **Capture accounts**: written by design tooling alone, never by product code, a product route or the seed `muestra.md` is rendered from. No last-Onboarding-screen entry ever names one, and any new account kind is declared in `facts.account_kinds`, refused when missing or mismatched as before. The mechanism is the Tech Lead's, and so is recording it as an amendment to ADR-0042, next to the GH-189 amendment that defined the account kinds.
- **Edited files**:
  - `scripts/design/`, the drawings under `pantallas/`, and the two registry tests within their declared seams, every guard kept;
  - `tests/design/test_sample_app.py`, declared as a seam of this plan only, like GH-141's muestra seam: it is only extended with cases for the new capture accounts, and every existing case and assertion is kept, none loosened or rewritten;
  - the ADR-0042 amendment, append-only.

  Nothing else under `app/`, `web/src/` or `tests/` changes, and any other edited test means the implementation is wrong.
- **No before/after AE pair** is required: nothing a seller sees changes, the six rows are new, and the Today rows change only their crop.

### Captured whole

- "Whole" means the entire named section as the design file in `docs/product/design-system/pantallas/` draws it. For the last Onboarding screen that is its title, every step line ("Done", or "For later" with where) and its two actions ("Add my first sale", "Go to Home"). It never means `muestra.md`, which holds the sample business's figures, not the layout.
- The same rule holds in light, dark and Compu (light and dark), each at its own registered width: a clipped section is fixed in the crop, never by widening the screen.
- The section crop takes the section's whole content, not a narrow label column beside it. Fixing it leaves every crop that already fit unchanged.
- A crop that cuts any line of the section is a capture defect and is never accepted.

### Registry enforcement tests

- The real-registry test in `web/src/design/screens.test.ts` states the account rule, enforced by the registry's rule module (`scripts/design/screens.mjs`):
  - an entry may only name an account the sample writes, each with a kind in `facts.account_kinds` (`open` or `ended`; `assertAccountKinds` refuses a missing, partial or mismatched map);
  - an `open` account belongs to one last-Onboarding-screen entry: an `open` account on any other entry fails, and a Done entry on an account that is not `open` fails;
  - an `ended` account (a business whose Onboarding the sample ended at seed time) may be shared by read-only entries, such as the six `Inicio*` rows, and no last-Onboarding-screen entry names it;
  - a Done entry that names an account the sample does not write fails;
  - two last-Onboarding-screen entries on one account are refused (`assertSelectedAccounts`), the default last-Onboarding-screen row included.
- The account-validation tests and `assertSelectedAccounts` keep everything they guarded; the old static rule "an account only on a Done entry" now lives in `assertSelectedAccounts`, against the kinds.
- **Same record in path and route**: the same test states that when an entry's `path` names at least one `{name}` placeholder, its placeholders equal the `route`'s exactly: the same names, in the same order, compared as written, before any normalisation.
  - A path with no placeholder names no record and passes, whatever its route holds. This is part of the rule, not an exemption: no entry is listed as exempt.
  - It only adds to the cross-check; ADR-0033's normalisation to `{id}` for matching against the front registry is unchanged.
  - A failure names the entry and the two placeholder lists, nothing else.
  - Known blind spot, accepted: a row whose path names no record while its route does is not checked by this rule. Its steps and capture are still checked by the audit and by eye.

### Plan rules for a registry change

- A change to `scripts/design/screens.json` rows declares both registry enforcement tests, `web/src/design/screens.test.ts` and `routes.test.ts`, as its seams. Its invariants read "screens.json plus the two registry tests", with the design tooling the change needs named alongside.
- Any other edited test means the implementation is wrong.
- The muestra guard seam of GH-141's follow-up (below) is declared for that plan only and does not change this rule.
- The `tests/design/test_sample_app.py` seam of GH-45's first-run follow-up (above) is declared for that plan only, extended only, and does not change this rule either.
- No plan invariant asks for an idle or unloaded machine for a capture run.

### Failures

- A row that cannot reach its screen fails while it steps there, so `--strict` exits non-zero. That row is a defect to fix, never a known failure to report around.
- A font left in error on a capture, an offline step included, fails the applied-check, so `--strict` exits non-zero.
- **A row whose screen has not finished drawing when it is captured fails.** Under `--strict` it gives a non-zero exit, like a row that cannot reach its screen. It is never captured half-drawn and never accepted as a pass. How the capture tells that a screen has finished drawing is the Tech Lead's decision; this file names no mechanism.
- **A row whose screen has not come to rest within the bound fails**, whatever was still changing (an animation, a pending request, a control still disabled or busy). The failure names the row and the side, with a fixed sentence saying the screen had not come to rest. It is reported like a screen that never finished drawing: that side is `null` in `index.json`, no `.design.png` or `.built.png` is written for it, the sheet is still composed with "—" for that side, and under `--strict` the run finishes every row, writes `index.json` and exits non-zero. It never shows up as an AE difference, and it carries no page text, sample data, amounts or names.
- **A shot-method miss is that side's failure reason** (ADR-0052): `null` in `index.json`, no PNG under any name, a fixed English reason naming the side, and a non-zero exit under `--strict` after every row has run. Like any other failing side it is a defect to fix, never a known failure: a side the method cannot shoot by design is fixed in the capture tooling (with ADR-0052 amended where needed), never excused, and never fixed by changing a screen or the app.
- A difference that machine load causes in a capture's pixels is a capture defect, fixed in the capture; the comparison is never loosened and an idle machine is never asked for.
- A capture that shows a screen other than its row names, or a clipped section, is caught by eye in review and blocks approval. Neither is ever accepted as a pass.
- A last-Onboarding-screen entry naming an account the sample does not write fails the registry test.
- An entry whose path names placeholders different from its route's fails the registry test.
- A row whose section matches no element of its drawing, or more than one, fails under `--strict`; it is a defect to fix, never a known failure.
- A difference between a drawing and the docs is never fixed by changing app copy; the difference is listed in the PR.

### Evidence in the PR

- The output of one `--strict` call over `Inicio*` (Home) and the Onboarding block, exit 0.
- For a change that makes a row reach its screen: the output of one `--strict` call over the whole registry with no `--only`, exit 0, and the captures of every row it fixed, judged by eye.
- The last-Onboarding-screen captures on phone and computer, in light and dark, judged by eye.
- The list of crops whose result changed: only ones that were clipped.
- The installed `@fontsource/plus-jakarta-sans` version (ADR-0042).
- No before/after AE pair is required for a change with no seller-visible difference whose "before" row never reached its screen.
- For a change that corrects a row's record: the captures of the corrected row and its twin, light and dark, judged by eye, and the audit of every row (rows checked, fixes made, follow-ups linked).
- For a change that gives a row its own section: the corrected row's capture judged by eye, its before/after under ADR-0042 with every non-zero difference listed (a caption edit's design-side differences as intended), and the audit of the rows of its family.
- For the change that settles capture at rest (GH-261's follow-up): five whole-registry `--strict` runs per commit, base and head, on the loaded shared machine on one Argentina day, with the `ae.mjs` outputs comparing run 1 with runs 2 to 5 on each side and base with head; the VariedadesCompu captures, and those of every row with an animated element or a control that waits on a refresh, judged by eye against the sample's stored data in light and dark where the registry has both, with the switch's resting state stated (enabled, on or off as the stored threshold gives it); one deliberately unsettled row shown failing under `--strict`; and the closing record marking GH-261's finding resolved and correcting its cause to a background refresh with the control disabled.
- For Home's first-run and Today evidence: one whole-registry `--strict` output with no `--only`, exit 0; the six first-run captures and the two Today computer captures, judged by eye; every drawing-versus-docs difference listed with its screen.
- For the Home restyle's evidence (GH-272 follow-up): see that section below.
- For the shot method's evidence (GH-301 part 3): see that section below.

### The Onboarding restyle's evidence (GH-164 follow-up)

- **Screens**: the six Onboarding steps (variety and price, opening stock, header and footer, Telegram bot, partner, expense categories) and "Done", which has its four rows (phone and computer, light and dark), each reached as above.
- **Computer** means the Onboarding's one phone-width column captured at the computer viewport; the Onboarding has no computer layout of its own (docs/product/onboarding.md).
- **Per screen**: phone and computer, light and dark; plus one phone capture at 320 px with text at 130 %, light only. Each shows its named section whole.
- **Registry**: every capture is a row of `scripts/design/screens.json`. A missing row is added as design tooling, with the two registry tests as its seams; a row that cannot reach its screen is a defect, never an exemption. Any mechanism for the 130 % text lives in `scripts/design/` only, never in product code.
- **Before/after**: "before" is the code without GH-164's change; once GH-164 has merged, it is the merging head with only GH-164's own change undone, and the PR shows that undo diff. If undoing it alone changes more than GH-164 did, the PR says so and lists the extra differences for Zeta; nothing more is undone. "After" is the merging head. Both are taken by the head's own `comparisons.mjs`, from one install, on the same Argentina day, fonts pinned, `--strict`; raw captures are compared by exact AE with `ae.mjs`, never the composed sheet.
- **Judging**: every capture by eye against its design file; every non-zero AE line and every design-vs-docs difference listed with its screen and side as intended (by GH-164's brief) or fixed. A difference between docs/product/onboarding.md and the drawing on what a step shows is a defect in the drawing. What neither the brief nor the docs can settle goes to Zeta in the PR.
- **Mismatches fixed here** only when the fix is CSS only, within the existing tokens (no token value changed), adds no component or colour, and changes nothing a seller reads or does: a clip at 320–430 px or 130 % text, or a step frame that strays from `OnboardingVariedad` and `OnboardingCategorias`. After a fix, both sides are captured again from the fixed head and compared again.
- **Never fixed here**: a wording difference is never fixed by changing copy (the difference is listed); anything that changes behaviour, copy, steps, actions or routes is split into its own bug and only listed in the PR.
- **Everything matches**: the PR says so with the evidence; that is a valid outcome.

### Reviewing GH-141's change to Analysis (criteria 6–9)

- **The Analysis cells**: four, each captured before and after: phone and computer, light and dark. A cell missing on either side means the work is not done.
- **Before and after**: "after" is the merging head; "before" is the merging head with only GH-141's change undone, the undo diff shown in the PR. Extra differences the undo causes because later changes rely on GH-141 are listed for Zeta; nothing more is undone.
- **How both sides are taken**: head's `comparisons.mjs --strict`, one install, one Argentina day, pinned fonts. The PR records the head SHA, the undo diff, the fontsource version, and the overlay's diff stat only if ADR-0042's GH-219 overlay is used.
- **Every other screen**: `ae.mjs` runs over the raw captures of every other screen in the registry, output attached. Each non-zero line is listed with its screen and side as one of:
  - intended by GH-141's decided intent;
  - a defect caused by GH-141's change or its drawing edits, fixed in this task (existing tokens only, no token value changes), after which both sides are retaken from the fixed head and compared again;
  - an extra difference from the undo, listed for Zeta;
  - a difference GH-141 did not cause, filed as a follow-up issue the PR links, not fixed here.
- A difference the brief and the docs cannot settle goes to Zeta in the PR. A missing screen or side, a one-sided `null` or an unreadable capture is a failure, never AE 0.
- **Where and how long**: all the evidence is in the PR description, in one place. A set is valid only for the SHA it was taken on; a later commit editing an Analysis drawing, or any merge of master, makes it stale (a stale capture counts as missing), and it is retaken. Approval is given only on a set whose SHA is the merging head.
- **The seam**: that plan declares `tests/design/test_muestra_screens.py` and `tests/design/muestra_guard.py` as seams for `muestra`, for that plan only. The guard keeps every check it had; any other edited test means the implementation is wrong.
- **Escalation**: a cell that cannot be captured, or a head seed the undone state cannot run, stops the work and escalates. The undone state is never patched and no exception is recorded.
- If nothing differs, `ae.mjs` exits 0 and the PR says so.
- Captures taken on the loaded shared machine are submitted as they are, with no note about load, no "unsatisfiable" entry and no exception.
- **Load-independence proof (once, for the change that settled it, GH-150's follow-up)**: the change's base and head are each captured twice, once under foreign load (at least one other worktree's checks running) and once idle (no other check, agent or worktree run, recorded as ADR-0041 records it), all by the head's own `comparisons.mjs`, from one install, on the same Argentina day (ADR-0042). For each commit, `ae.mjs` compares the loaded run with the idle run. It is never repeated as a recurring check or a gate step.

### The Home restyle's evidence (GH-272 follow-up) (Home criteria 1–5)

- **Screens**: Home only, seven registry rows: `Inicio` (Home), `InicioOscuro`, `InicioHoy`, `InicioHoyCompu`, `InicioHoyCompuOscuro`, `InicioCompu` and `InicioCompuOscuro`. Other screens GH-272 touched get their own follow-up if they carry their own finding.
- **Before and after**: "after" is the merging head; "before" is that head with only GH-272's change undone, the undo diff in the PR. If undoing it alone changes more than GH-272 did, the PR says so and lists the extra differences for the PM; nothing more is undone. Both sides come from head's `comparisons.mjs --strict`, one install, one Argentina day, fonts pinned (ADR-0042); `ae.mjs` compares the raw captures, design side and built side, never the composed sheet. Each capture is also judged by eye against its design file.
- **The five exact screens**: `Inicio` (Home), `InicioOscuro` (Home, dark theme), `InicioHoy` (Home on the Today tab), `InicioHoyCompu` (Home on the Today tab, computer layout) and `InicioHoyCompuOscuro` (the same, dark theme) must show exact AE 0 on both sides. "Near zero" does not pass, and a missing side, a one-sided `null` or an unreadable capture is a failure.
- **The two listed screens**: every AE line of InicioCompu and InicioCompuOscuro is listed with its screen and side, each at 0 or carrying a one-line reason next to it. A reason is acceptable only when it says the difference is intended by GH-272 or comes from the design file itself; the PM decides on the PR whether it is accepted. A reason that names no cause ("rendering noise") is refused; a line with no accepted reason is a mismatch.
- **The width and text-size sets**: screenshots of Home's computer layout, light theme, showing the Today, Week and Month tabs, at 960 px, at 1280 px and at 960 px with text at 130 %. Nothing on Home is clipped, overlapping, truncated mid-word or unreachable, and every figure and control of the three tabs can still be read and used. 1280 px at 130 % is captured only if the 960 px / 130 % set shows a break, to confirm the fix holds at the wider width. Any mechanism for the widths or the 130 % text lives in `scripts/design/` only, as registry rows with the two registry tests as seams, never in product code.
- **When the evidence fails** (an AE above 0 on one of the five screens, a listed line without an accepted reason, a break at 130 % text): the build is fixed toward the design, limited to what GH-272 restyled on Home, never changing copy, behaviour, figures or routes; then both sides are captured again from the fixed head and compared again, and the affected sets are retaken.
- **The design file is never edited here.** If AE 0 can only be reached by changing the design, or holding at 130 % means departing from it, the difference is listed with what looks wrong and goes to the PM before either side changes.
- **Where and how long**: the PR carries the `ae.mjs` output, the InicioCompu/InicioCompuOscuro line list with reasons, the screenshot sets, the head SHA, the undo diff and the installed `@fontsource/plus-jakarta-sans` version. A set is valid only for the SHA it was taken on; a later commit touching Home's styles or drawings, or any merge of master, makes it stale (stale counts as missing), and it is retaken.
- **Closing**: the plan's Coverage block carries a one-line result for invariant 12, moved from "Not touched" to covered and pointing at the PR evidence; the finding at `web/src/styles/app.css:3098` is closed from that line.
- **Everything matches**: the PR says so with the evidence; that is a valid outcome.
- Assumed: before this follow-up Home had no check of its look beyond the construction argument and the reviewer's trust.

### The shot method's evidence (GH-301 part 3) (Shot criteria 1–7)

- **Where it lives**: one document, `docs/evidence/GH-301-shot-method.md`, and its side-by-side images, committed under `docs/evidence/GH-301/` next to part 1's. These are the only files the task changes. Each image is one old-versus-new side-by-side PNG for one differing row and side, named by row and side; nothing else is committed there (no raw captures, no `index.json`, no smoke-check output, no `/tmp` scratch row). Images are committed rather than uploaded to the PR because the Developer cannot upload PR attachments and a hand-dragged image left out would leave a row unjudged. What the capture records and prints carries only class paths, sizes, booleans and coordinates: no page text, names, amounts or pixel data; the committed images show only the sample business.
- **Baseline first**: before any run, `main` is checked against the pinned app commit for `app/`, `web/src/` and the registry. If any of the three moved, the work stops with no partial evidence and reports which moved and between which commits.
- **Retaking the baseline is separate work**: a piece of work of its own, which this task is blocked by, pins a new app commit and reruns part 1's census on it. This task then runs on that new pin, in place of part 1's `2c49d361`, and redoes the baseline check against it before its first run.
- **Every side has an image first**: the four sides that fail by design under ADR-0052 risk 1 (`Inicio` design and built, `Gastos` built, `VariedadesCompu` built) are a defect, fixed in a separate piece of work this task is also blocked by. How the method shoots them, and any ADR-0052 amendment, is the Tech Lead's; the fix keeps the seller's view at the registry viewport (criterion c) and changes no screen and nothing in the app. They are never recorded as known failures, and GH-273's findings never close on a side with no image.
- **The base commit**: the request's `6541887d` cannot serve, because its app is still in Spanish ("Entrar", "Semana") and the registry clicks English labels. The base is instead the earliest commit before the pinned app commit whose app shows every label today's registry clicks, so base and head are two different apps. The Tech Lead picks it and confirms it with a smoke check of one `--only` row per label the registry clicks; that smoke check only chooses the commit, is never evidence and never counts as a repeatability run. If no commit before the pin passes, the work stops and comes back to the PM; the base side is never dropped on the author's own call, and a failing registry row is never a reason to choose a base.
- **Repeatability runs (criterion a)**: ten whole-registry `--strict` runs, none with `--only`, each on a fresh sample and each exiting 0: five of the head and five of the base with the head's `scripts/design` as overlay (ADR-0042, GH-219). All ten are taken on one Argentina day; if they cannot be, the work starts again on a single day and never mixes days. On each side `ae.mjs` compares run 1 with runs 2, 3, 4 and 5, and the document reports per side the non-zero lines, the rows with a missing side and the rows with a one-sided `null`, target 0 each. Anything else is a defect reported with its row, side and run pair, never smoothed over or re-run until it passes.
- **Reproducibility record**: the pinned app commit, the head SHA, the base SHA and its date, the base smoke-check command and its result, one line saying `6541887d` was replaced and why, the overlay diff stat (against the chosen base), the fontsource version, the Argentina day and the commands. The reviewer does not re-run the tooling as a step of the review; being able to is what makes the evidence trustworthy.
- **Old versus new (criterion d)**: per ADR-0052 risk 6, head run 1 is compared with part 1's census run, as retaken on the new pin, by `ae.mjs --box`; the old tool's own runs cannot be taken (its registry clicks Spanish labels the app no longer has, and it is not patched). The retaken census run is taken on the same Argentina day as the ten runs, so both carry the same sample dates and no difference comes from the seed date alone; if they cannot share a day, the census is retaken again on the day of the runs. Every differing row and side gets an old-versus-new side-by-side PNG committed under `docs/evidence/GH-301/`; a row differing on one side only gets an image and a line for that side only. `VariedadesCompu built` is compared with the census run's capture, and a gray old capture, where it appears, is noted as the old tool's known GH-273 defect. The rows with no old counterpart (ADR-0052 counts 27 old rows with Spanish labels and 23 new rows) are listed, not judged. If nothing differs, the document says so with the counts compared.
- **The verdict table**: one line per differing row and side, holding the row, the side, the relative link to its committed image, a proposed reason and an empty verdict cell. Every line links an image that exists, and every committed image has a line; a mismatch either way is a defect fixed before review. Order: layer rows first; then rows whose layout depends on viewport height (fixed bars, `dvh`/`min-height`), under a heading naming them as such for metric (c); then the rest. A reason is proposed only where ADR-0052, the layer rule or the viewport-height rule plainly explains the row; every other row reads "no proposed reason". The reviewer's verdicts are same, intended difference with a one-line reason, or wrong; the author never fills one.
- **One loud failure**: the method is shown failing a row, a real one if one fails, else a throwaway scratch row in `/tmp` (as GH-273 did, e.g. a layer taller than the viewport) that never enters `screens.json` and is never committed. The document records the non-zero exit code under `--strict`, reached after every row ran, the `null` side in `index.json`, that no PNG exists under any name, and the fixed English reason naming the side. If the method does not fail the row, that is reported as a defect, never presented as the loud failure.
- **Optional fields**: every new `index.json` field stays optional for `ae.mjs`, `compare.sh`, `composeSheet` and `web/src/design/*.test.ts`; the document depends on none being present.
- **Closing**: the document ends with a closing record listing GH-273's five findings by number, each pointing to the evidence that closes it. They close once every side has an image and every verdict is filled with 0 wrong and 0 unjudged; a wrong verdict keeps them open and its row is the follow-up.

## Metrics

No telemetry; read from the PR evidence and from tests.

- **One green run (criterion 1)**: the PR holds the `--strict` output, exit 0.
- **Reached and whole (criterion 2)**: the four last-Onboarding-screen captures are attached, each showing its whole section as the design file draws it, judged by eye; no row captures a screen other than the one it names; every crop that changed was clipped before.
- **Agree (criterion 3)**: `web/src/design/screens.test.ts` and `routes.test.ts` pass with the corrected rule; the plan's invariants and Seams line name both; the PR records no exception.
- **Nothing a seller sees changes (criterion 4)**: every suite passes; the only edited tests are the two registry tests; the only other edited files are `screens.json`, `screens.mjs`, `sample_app.py` and `comparisons.mjs`; nothing else under `app/` or `web/src/` changes.
- **No test loosened (criterion 5)**: the real-registry test keeps every guard, and each of these is a tested case: an account on an entry that does not reach the last Onboarding screen fails; a Done entry with an unwritten account fails; two entries on one account fail.
- **Run B closed**: the clipped OnboardingListoOscuro crop and the unreachable OnboardingListo row are fixed by the same task; no issue is left open for either.
- **Onboarding coverage (Onboarding criterion 6)**: the `--strict` output, exit 0; `index.json` holds a result for each of the seven screens at phone and computer in light and dark (the last Onboarding screen's computer dark row included), and each one's 320 px / 130 % capture in light; 0 missing sides.
- **Onboarding before/after (Onboarding criterion 7)**: `ae.mjs` output for every screen and side is attached, with the undo diff when GH-164 had merged; the PR records the script, the single install, the date and the fontsource version.
- **Differences accounted for (Onboarding criterion 8)**: every non-zero `ae.mjs` line and every design-vs-docs difference is matched in the PR to "intended" or "fixed": 0 unlisted. Items sent to Zeta are named.
- **Nothing clipped (Onboarding criterion 9)**: 0 clipped crops, judged by eye on the seven 320 px / 130 % captures.
- **No seller-visible change (Onboarding criterion 10)**: every suite passes; the only edited tests are the two registry tests; each CSS fix is listed with its screen; each behaviour, copy, step, action or route mismatch is reported with its own bug.
- **Row tells the truth (criterion 6)**: the light `VariedadArchivada` entry's `path` and `route` name the same placeholder; the same-record rule passes on it and is shown failing on the uncorrected row; it passes the `EntradaStockSinEntradas` rows, whose path names no record, with no exemption listed.
- **Archived page agrees (criterion 7)**: both registry tests pass; only `screens.test.ts` is edited, with no guard dropped or loosened; the PR records no exception.
- **Nothing a seller sees changes (criterion 8)**: the diff touches only `scripts/design/screens.json`, `web/src/design/screens.test.ts` and this file; every suite passes; no row's steps change.
- **Audit**: the PR lists every row checked and every mismatch found, each fixed there or linked to a follow-up issue: 0 unexplained. The GH-166 finding is linked as closed, with the light and dark captures of the corrected row attached.
- **Recurrence (criterion 9)**: an entry whose path names placeholders different from its route's fails the registry test in the diff that adds it; the blind spot (a path with no placeholder) is named in the test's description and the PR.
- **Whole registry green (criterion 10)**: the PR holds one whole-registry `--strict` output, no `--only`, exit 0; the registry has the same rows as before the fix, `EstadosConfirmar`, `EstadosSinConexionCompu` and `EstadosSinConexionCompuOscuro` included.
- **Offline fonts (criterion 11)**: the two `EstadosSinConexionCompu*` rows pass the applied-check with no note; the applied-check's code and its weights are unchanged; their captures show "No connection" in the computer layout in the app's own font, judged by eye in both themes.
- **Reached as a seller does**: the `EstadosConfirmar` capture shows the delete confirmation (the caption `Antes de borrar` in `Estados.dc.html`) whole, with the sale's date, amount and grams and both answers, judged by eye.
- **Costs the seller nothing (criterion 12)**: the diff touches only `scripts/design/` and, if needed, the two registry tests within their seams; every suite passes with no other test edited; nothing under `app/` or `web/src/` (outside those tests) changes.
- **Current Analysis captures (Analysis criterion 6)**: all 4 cells attached on both sides, 0 missing; the recorded SHA equals the merging head; the undo diff and the fontsource version are present.
- **Every difference explained (Analysis criterion 7)**: `ae.mjs` exits 0, or every non-zero line is matched to intended, a fix, an undo extra for Zeta, or a linked follow-up; 0 unlisted differences; 0 failures from a missing or unreadable side.
- **Guard declared, not loosened (Analysis criterion 8)**: the plan's seam names the two muestra files; the only edited tests are those two; the guard's existing checks all still run.
- **Nothing a seller sees changes (Analysis criterion 9)**: every suite passes; no capture or comparison step is added to `.agentic/stack.yaml`, CI or the gate.
- **Business measure**: spec-scope findings for missing or stale design evidence on the merging head: goal 0 (GH-141 had 3).
- **Accepted under load (Load criterion 6)**: the PR's before/after evidence was taken on the loaded shared machine with no "unsatisfiable" note and no recorded exception; no plan invariant asks for an idle machine.
- **Load doesn't change the result (Load criterion 7)**: the PR holds the load-independence proof; for both commits, `ae.mjs` shows exact AE 0 between the loaded and the idle run on every raw capture, design and built side, with no missing or one-sided capture, and exits 0; the installed `@fontsource/plus-jakarta-sans` version is recorded.
- **Unfinished screen fails**: a deliberately unsettled row under `--strict` exits non-zero and is not captured as a pass, shown once in the PR.
- **Gate untouched (Load criterion 8)**: no change to `.agentic/stack.yaml` or CI, no new gate step, no elapsed-time assertion.
- **Nothing a seller sees changes (Load criterion 9)**: every suite passes and no test is loosened, read from the diff.
- **Today capture tells the truth (Today criterion 1)**: `InicioHoyCompu` names a section that matches exactly one element of its drawing; the built side shows Today, judged by eye; its capture is attached and judged by eye; its before/after is attached under ADR-0042 (one script, one install, one Argentina day, fontsource version recorded), with every non-zero difference listed, the caption's design-side differences as intended.
- **Home rows accounted for (Today criterion 2)**: the PR lists every other `Inicio*` row checked, each declaration-only fix made and each follow-up linked: 0 unexplained.
- **Nothing loosened (Today criterion 3)**: among design files the diff touches only `scripts/design/screens.json`, the two registry tests and the one caption of `InicioCompu.dc.html`; both tests keep every guard; `comparisons.mjs` is unchanged; no capture step is added to `.agentic/stack.yaml`, CI or the gate.
- **Repeatable (Rest criterion 1)**: for base and for head, five whole-registry `--strict` outputs (no `--only`, each exit 0) taken on one Argentina day on the shared, loaded machine, and the `ae.mjs` output comparing run 1 with runs 2 to 5 on each side, plus the base-vs-head `ae.mjs` output: 0 non-zero lines, `VariedadesCompu built` included, no missing side and no one-sided `null`.
- **Resting state (Rest criterion 2)**: the `VariedadesCompu` captures, and those of every row with an animated element or a control that waits on a refresh, attached and judged by eye against the sample's stored data, in light and dark where the registry has both; the PR states which state the switch rests in.
- **Never half-drawn (Rest criterion 3)**: a deliberately unsettled row (something that never comes to rest within the bound) under `--strict` exits non-zero, its side `null`, no PNG written, with the fixed message naming the row and side, shown once in the PR; it is never read as an AE difference.
- **Nothing loosened (Rest criterion 4)**: read from the diff: no tolerance in the comparison; the registry has the same rows as before; no seller-visible change under `app/` or `web/src/`, the switch's disabled-while-refreshing behaviour included; no change to `.agentic/stack.yaml`, CI or the gate; no elapsed-time assertion (ADR-0038).
- **Finding closed**: the closing record marks GH-261's `VariedadesCompu built: AE 2888` resolved, with its cause corrected to a background refresh with the control disabled, citing the five runs per commit. Business measure: spec-scope findings for an unexplained AE on a screen the PR did not touch, goal 0.
- **First-run rows exist (First-run criterion 1)**: `index.json` holds a result for each of the 6 new rows, 0 missing sides and no one-sided `null`; each capture shows its whole section, judged by eye. The checklist captures show at least one "Done" and at least one pending step and never both required steps "Done", judged against docs/product/navigation.md; the after-import capture shows the notice alone with its icon and dismiss control.
- **Today compared as Today (First-run criterion 2)**: the Today label occurs exactly once in `InicioCompu.dc.html`; the two Today computer captures show no Week content, judged by eye.
- **Whole registry green (First-run criterion 3)**: the PR holds one whole-registry `--strict` output, no `--only`, exit 0, and the installed fontsource version; every suite passes; the diff touches only `scripts/design/`, `pantallas/`, the two registry tests, `tests/design/test_sample_app.py` (new cases only, every existing assertion kept), the ADR-0042 amendment and this file; the plan's Seams line names the three tests; no step is added to `.agentic/stack.yaml`, CI or the gate.
- **Differences are listed (First-run criterion 4)**: every drawing-versus-docs difference is listed in the PR with its screen: 0 unlisted.
- **First-run business measure**: spec-scope findings for missing first-run or Today design evidence on a merging head: goal 0.
- **Exact match (Home criterion 1)**: the attached `ae.mjs` output shows AE 0 on both sides of `Inicio` (Home), `InicioOscuro` (Home, dark theme), `InicioHoy` (Home on the Today tab), `InicioHoyCompu` (Home on the Today tab, computer layout) and `InicioHoyCompuOscuro` (the same, dark theme): 10 lines at 0, 0 missing sides, 0 one-sided `null`; the recorded SHA equals the merging head; the undo diff and the fontsource version are present.
- **Lines accounted for (Home criterion 2)**: every InicioCompu and InicioCompuOscuro line is listed with its side; 0 non-zero lines without a PM-accepted reason on the PR; 0 reasons that name no cause.
- **Holds at every width (Home criterion 3)**: the 960 px, 1280 px and 960 px / 130 % sets are attached, each with Today, Week and Month; 0 clipped, overlapping, mid-word truncated or unreachable items, judged by eye; a 1280 px / 130 % set is present only when the 960 px / 130 % set showed a break.
- **Invariant 12 covered (Home criterion 4)**: the Coverage block line for invariant 12 reads covered and points at the PR evidence; the `web/src/styles/app.css:3098` finding is closed.
- **Nothing loosened (Home criterion 5)**: read from the diff: no design file under `pantallas/` edited; any fix is under what GH-272 restyled on Home and touches no copy module entry, route or figure; every suite passes; no step added to `.agentic/stack.yaml`, CI or the gate.
- **Home business measure**: spec-scope findings for missing Home design evidence on a merging head: goal 0 (GH-272 had 1).
- **Repeatable (Shot criterion 1)**: per side (head, base), across runs 2 to 5 against run 1: 0 non-zero lines, 0 missing sides, 0 one-sided `null`; all ten runs exit 0, on one recorded Argentina day; the base is a commit before the pin that passed the label smoke check, its SHA and the smoke check recorded.
- **Old versus new (Shot criterion 2)**: the count of differing rows and sides against the retaken census run; 100 % with a side-by-side PNG committed under `docs/evidence/GH-301/` and a verdict-table line linking it, with 0 lines whose image is missing and 0 images with no line; 0 lines caused by the seed date alone (census retake and runs on one recorded Argentina day); the count of viewport-height rows (metric c), named in their group; the count of rows with no old counterpart; `VariedadesCompu built` shown against the census run.
- **Loud failure (Shot criterion 3)**: present, with non-zero exit code, `null` side, no PNG and fixed reason (yes/no).
- **Judged (Shot criterion 4)**: verdict counts of same, intended difference, wrong and unjudged: 0 wrong, 0 unjudged; GH-273's five findings closed, 5 of 5, each pointing to its evidence.
- **Reproducible (Shot criterion 5)**: the pinned app commit, head and base SHAs, the base smoke check, the `6541887d` replacement line, overlay diff stat, fontsource version, Argentina day and commands are all present.
- **Nothing else moves (Shot criterion 6)**: read from the diff: only `docs/evidence/GH-301-shot-method.md` and side-by-side PNGs under `docs/evidence/GH-301/` change; no step added to `.agentic/stack.yaml`, CI or the gate; what the capture records and prints holds no page text, names, amounts or pixel data.
- **Every side has an image (Shot criterion 7)**: in every run, `Inicio` design and built, `Gastos` built and `VariedadesCompu` built each have a PNG; 0 sides recorded as known failures.

## Out of scope

- Any change to docs/product/onboarding.md, docs/product/navigation.md, a screen's copy or its steps to make it easier to capture.
- Widening a screen beyond its registered width to fit a crop.
- Making the design comparison a gate step, or any new automated check of a capture.
- A before/after AE pair for a change with nothing seller-visible to compare.
- Judging whether a screen looks good: the capture finds unintended differences.
- A dark capture at 320 px / 130 % text for the Onboarding.
- Fixing an Onboarding mismatch that changes behaviour, copy, steps, actions or routes inside the evidence task: it is its own bug.
- Making a light row and its dark twin show the same record.
- Changing a row's route, steps or sample data to make its declaration truthful: that is a follow-up issue. Changing a row's steps or sample data so it reaches its screen as a seller does is in scope.
- Any change to ADR-0033's normalisation, or any exemption in the registry cross-check.
- Checking, by rule, a row whose path names no record while its route does.
- A static registry check for a row that captures one part of a screen and names no section; an exemption list for such rows.
- A section crop on the built side, or any change to the capture script for one.
- Any edit to `InicioCompu.dc.html` beyond the Today frame's caption.
- Fixing, in the Home Today task, an audited row whose fix is more than a declaration: it is a linked follow-up issue.
- Removing, skipping or excusing a row, or keeping a list of rows known to fail, to make a `--strict` run exit 0.
- Loosening the applied-check, letting a capture load fonts from the network, or changing the app's own font loading to make a capture pass.
- Widening the standing seam rule so every registry change declares the muestra guard files, or `tests/design/test_sample_app.py`.
- Fixing, in GH-141's follow-up, design differences GH-141 did not cause: they are filed as follow-ups.
- Any change to Analysis's behaviour, figures or copy.
- Requiring an idle or unloaded machine for a capture.
- Recording the machine's load alongside a capture, or narrowing a capture's claim by it.
- A pixel tolerance in the comparison.
- Timed evidence (mypy timings, e2e worker runs): ADR-0038, ADR-0040 and ADR-0041.
- Re-judging GH-150's capture runs.
- A per-run check, inside the capture, that a screen's state matches the sample data.
- A list of exceptions for elements that never stop moving.
- Changing the app's own transitions, animations, background refreshes, the switch's disabled-while-refreshing state or any screen to make a capture rest sooner.
- Naming the wait bound's value in this file.
- A computer-dark row for a first-run element.
- A caption or any copy change on the built Home screen to name the Today crop: that is a product copy question for the PM.
- Creating a capture account through product code, a product route or the `muestra.md` seed.
- Any change to what a seller sees on Home, the first-run elements included, beyond a GH-272 follow-up fix that brings the build back to its design.
- In GH-272's follow-up: other screens GH-272 touched; any edit to a design file; new Home behaviour, figures or copy; dark screenshot sets at 960 px, 1280 px or 130 %; a 1280 px / 130 % set when 960 px / 130 % shows no break.
- In GH-301 part 3: any change beyond `docs/evidence/GH-301-shot-method.md` and the side-by-side PNGs under `docs/evidence/GH-301/`; committing raw captures, run `index.json` files, smoke-check output or the `/tmp` scratch row; relying on hand-uploaded PR attachments for the side-by-side images; retaking the baseline or fixing the four sides ADR-0052 risk 1 names inside this task (each is its own blocking piece of work); running or patching the old tool; running the base on `6541887d` or any commit whose app lacks a label the registry clicks; dropping the base side without the PM; counting the base smoke check as evidence; a verdict line for a difference caused only by the seed date; recording a side as a known failure; the author proposing a verdict, or a reason not plainly explained by ADR-0052, the layer rule or the viewport-height rule; the reviewer re-running the tooling as a step of the review; partial evidence on a moved baseline or on mixed Argentina days; reopening how a shot is taken beyond what fixing the four failing sides requires.
