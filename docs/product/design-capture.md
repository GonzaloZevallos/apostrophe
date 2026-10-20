# Design capture

The evidence a reviewer uses to judge that a screen looks as designed: the design file and the built app are captured side by side from the screens registry (`scripts/design/screens.json`), with pinned fonts, by `scripts/design/comparisons.mjs`, and when a change needs a before/after pair, the raw captures are compared by exact AE with `scripts/design/ae.mjs` (ADR-0042). This file holds what the capture and its registry must guarantee for the people who rely on them. It changes no product behaviour: no capability's rule, screen, route, step or copy is defined here, and the capture always follows the product, never the reverse. It is review evidence attached to a PR and judged by eye; it is never a step of the gate (gate.md). Sellers and the operator see nothing of it.

## Jobs

**When** I run the design capture over Inicio and the Onboarding before approving a change, **I want** every screen the registry lists, both themes of Listo included, to be reached the way a seller reaches it and captured whole, and the registry, its tests and the plan to agree, **so I can** trust a green `--strict` run as evidence and approve without hand-patching a test, accepting a screen that was never reached, or recording an exception.

- Its protagonist is the maintainer, or the reviewer acting for them, as in accounts.md's and gate.md's maintainer jobs. The seller is affected only indirectly: a capture nobody can trust holds up the changes they are waiting for.
- It refines the "looks as designed" criteria (navigation.md criterion 7, onboarding.md criterion 5 and its design metric, icon-and-text-rule.md criterion 6); it is not a new product job.
- It also serves when a design guard or a registry test fails and the maintainer must tell a real defect from a broken registry row.
- Before it (GH-142's follow-up): a one-test edit broke the plan's own invariant, the OnboardingListo row could not reach Listo, the OnboardingListoOscuro crop was clipped, and those two defects had no issue.

**When** I am about to approve the Onboarding restyle from GH-164 and the evidence on the PR covers only some of its screens, **I want** every Onboarding step and "Listo" compared with its design (phone and computer viewports, light and dark, the narrowest phone at 130 % text) and a before/after pair of the restyle, **so I can** approve knowing that only the intended things changed and that nothing a seller reads or taps there moved, without approving on partial evidence or holding the PR.

- Its protagonist is the maintainer, or the reviewer acting for them; the seller is affected only indirectly.
- It refines onboarding.md criterion 5 and icon-and-text-rule.md criterion 6; it is not a new product job.
- Before it (GH-164's follow-up): approval rested on two of the seven screens (Bot and Listo); Socio and Categorías were never read; there was no dark theme, no 320 px / 130 % check and no before/after pair.

**When** I review a change against the design capture, **I want** every row of the screens registry to name the screen and the record it actually reaches and captures, **so I can** approve from the capture alone, without checking the registry against the screenshots by hand and without leaving a finding open on an approved head.

- This refines the first job and its criterion 2; it is not a new job. Its protagonist is the same maintainer or reviewer.
- Before it (GH-166's follow-up): the light `VariedadArchivada` row declared `/varieties/{low}` while it navigated to `/varieties/{sold_out}` and captured Sir Jack. ADR-0033's cross-check reads both placeholders as `{id}`, so no test saw it, and the reviewer reconciled the row by hand.

**When** I run the design capture over the whole registry, as a before/after run does (ADR-0042), **I want** every row to reach its screen and every capture to pass its font check, **so I can** read a non-zero exit as a real failure and attach the run as evidence without explaining away rows that always fail.

- This refines the first job and its criterion 1 for the whole registry; it is not a new job. Its protagonist is the same maintainer or reviewer.
- Before it (GH-219's and GH-150's evidence): `EstadosConfirmar` never reached "Borrar venta", and `EstadosSinConexionCompu` and `EstadosSinConexionCompuOscuro` failed the font check on their offline step, on base and head alike, so every whole-registry `--strict` run exited 1 with every other row ok.

**When** I review a change to how Análisis looks, **I want** current before and after captures of Análisis, a comparison over every other screen in the registry, and a plan that names every file the change edits, **so I can** approve or reject from the PR's evidence alone, without retaking captures, hand-checking screens or carrying an open finding into the next task.

- Its protagonist is the maintainer, or the reviewer acting for them (in the end Zeta). The seller is affected only indirectly: a change nobody can approve holds up the Costo de lo vendido and Faltante de stock rows they are waiting for.
- It refines analysis.md's design metric and the job above; it is not a new product job and adds no product behaviour.
- Before it (GH-141's follow-up): the muestra guard was edited outside the plan's declared seam, and the design evidence was missing or stale. The same spec-scope finding was raised three times on one head.

**When** I review a change whose before/after design capture (`compare.sh` / `comparisons.mjs`) was taken on the shared development machine, where other agents and worktrees are always running, **I want** that capture to count as evidence whatever load the machine was under, **so I can** approve on it without the Developer recording a rule as "unsatisfiable" and shipping past it.

- Same protagonist as the job above; it refines that job and is not a new product job.
- Before it (GH-150's follow-up): a plan invariant asked for `compare.sh` runs with no foreign load; all six runs had load, so it could never hold, and it was recorded as unsatisfiable and shipped past.

Success criteria:

1. **One green run.** One `--strict` call over Inicio* and the Onboarding block exits 0.
2. **Reached and whole.** Every Onboarding screen the registry lists, Listo in light and dark included, is reached as onboarding.md defines and captured whole. No crop is clipped, and no row captures a screen other than the one it names.
3. **Registry, tests and plan agree.** The change needs no recorded exception and no test edited outside a declared seam.
4. **Nothing a seller sees changes.** onboarding.md, navigation.md and every screen read and behave as before, and every test passes. The only edited tests are the two registry tests; the only other edited files are design tooling (`scripts/design/screens.json`, `scripts/design/screens.mjs`, `scripts/design/sample_app.py`, `scripts/design/comparisons.mjs`); no file under `app/` or `web/src/` changes beyond those two tests.
5. **No test loosened.** A changed registry or enforcement test keeps everything it guarded and states the corrected rule.
6. **Every row tells the truth about its record.** A row's declared path names the same sample record its route and steps reach and capture. The light `VariedadArchivada` row names Sir Jack (`{sold_out}`), an archived variety reached from Archivadas. A dark twin's own declaration matches its own capture; it need not show the light row's record.
7. **The registry, its tests and navigation.md agree on the archived variety's page** and its parent "‹ Archivadas", with no recorded exception and no loosened test.
8. **Truthfulness costs the seller nothing.** Fixing a row's declaration changes no capability doc, nothing under `app/`, and nothing under `web/src/` but `web/src/design/screens.test.ts` within its declared seam. No row's steps change to make it truthful.
9. **A wrong record never passes unnoticed again.** An entry whose path names a record different from the one its route names fails the registry test in the diff that introduces it.
10. **The whole registry runs green.** One `--strict` call over the whole registry, with no `--only`, exits 0. No row is removed, skipped, excused or listed as a known failure to get there.
11. **Offline captures keep their fonts.** A row that takes the app offline is captured with the page's own fonts applied, and the applied-check runs on it exactly as on every other row.
12. **Reaching every row costs the seller nothing.** Making a row reach its screen changes only that row's steps, the sample data and the capture tooling under `scripts/design/`, plus the two registry tests within their declared seams. No screen, copy, capability doc or the app's own font loading changes.

Success criteria, the Onboarding restyle's evidence (GH-164 follow-up) (numbered on their own; Metrics cites them as "Onboarding criterion N", and the plain "criterion N" there is the list above).

6. **Every Onboarding screen covered.** Each of the six steps and "Listo" has captures for the phone and computer viewports, in light and dark, plus one phone capture at 320 px with text at 130 %, in light only, all from one `--strict` run that exits 0. A missing screen, a missing side or a one-sided `null` is a failure, never a pass.
7. **A before/after pair of the restyle.** "Before" is the code without GH-164's change (once it has merged, the merging head with only that change undone, the undo diff in the PR); "after" is the head that merges. Both come from the head's own `comparisons.mjs`, one install, the same Argentina day, fonts pinned, and are compared as raw captures by exact AE with `ae.mjs`. The PR records the installed `@fontsource/plus-jakarta-sans` version.
8. **Every difference accounted for.** Each non-zero difference, and each difference between the design and the docs, is listed in the PR with its screen and side, as intended (by GH-164's brief) or fixed. Where onboarding.md and the drawing disagree, onboarding.md wins and the drawing is the defect. A difference neither the brief nor the docs can settle goes to Zeta in the PR.
9. **Nothing clipped.** At 320 px with text at 130 %, no line, control or crop of any step or "Listo" is clipped, and controls stay at least 44 px.
10. **No seller-visible change beyond a listed fix.** Every suite passes; no test is edited to fit, the two registry tests excepted when rows are added.

Success criteria, reviewing GH-141's change to Análisis:

6. **Current captures of Análisis.** The PR has before and after captures of Análisis on phone and computer, in light and dark.
   - "After" is the head that merges the change; "before" is that same head with only GH-141's change undone (pinned-catalog.md's "Restyling Integraciones" rule), with the undo diff in the PR.
   - If undoing GH-141 alone changes more than GH-141 did, the PR says so and lists the extra differences for Zeta; nothing more is undone.
   - Both sides come from head's `comparisons.mjs --strict`, one install, one Argentina day, fonts pinned (ADR-0042). The PR records the fontsource version.
7. **Every other screen compared, every difference explained.** `ae.mjs` runs over the raw captures of every other screen in the registry, with its output attached. AE 0 is expected; every non-zero line is accounted for (see Behaviour). A missing side, a one-sided `null` or an unreadable capture is a failure, never AE 0.
8. **The guard edit is declared, not loosened.** The plan's seam for `muestra` names `tests/design/test_muestra_screens.py` and `tests/design/muestra_guard.py`, for that plan only, and the guard keeps everything it checked before.
9. **Nothing a seller sees changes** beyond GH-141's decided intent: analysis.md and ADR-0020's GH-141 amendment stand, and every suite passes.

Success criteria, captures under load (numbered on their own; Metrics cites them as "Load criterion N"):

6. **Accepted under load.** A before/after captured while the machine carries foreign load is valid evidence. No plan invariant or evidence rule asks for an idle machine, and nothing is recorded as "unsatisfiable" or as an exception.
7. **Load doesn't change the result.** A commit captured under load and captured idle gives exact AE 0 on every raw capture, design side and built side. If load changes a capture's pixels, that is a capture defect, fixed in the capture, never by asking for an idle machine and never by loosening the comparison.
8. **The gate is untouched.** The capture stays review evidence judged by eye and is never a gate step. No elapsed-time check is added (ADR-0038).
9. **Nothing a seller sees changes.** No screen, copy, route or product rule changes. Every suite passes with no test loosened.

## Behaviour

### What a capture is

- Fonts are pinned and the design capture never touches the network; `--strict` turns a font or screen-level failure into a non-zero exit, after every screen ran and `index.json` was written (ADR-0042).
- Each screen writes its composed sheet and its raw design and built captures; a before/after compares the raw captures by exact AE, never the sheet (ADR-0042).
- A capture is review evidence, judged by eye in the PR. It is never a gate step, and no new automated check is added for it.
- **A capture's result does not depend on machine load.** No plan invariant or evidence rule asks for an idle machine; a capture taken on the shared, loaded development machine is valid evidence as it stands.

### Every row reaches its screen

- Every row of the registry, not only Inicio* and the Onboarding, reaches its screen the way a seller does and captures its named section whole. A whole-registry `--strict` run exits non-zero only when a row truly fails.
- **`EstadosConfirmar`** reaches Antes de borrar on a sale's detail as a seller does: it opens a sale that exists in the sample and taps "Borrar venta". Its capture shows the confirmation whole: the question naming the sale's date, amount and grams that return, and "No, dejala / Sí, borrala" (sales.md).
- **`EstadosSinConexionCompu` and `EstadosSinConexionCompuOscuro`** show "Sin conexión" in the computer layout, light and dark. The page's own fonts are in place before the network drops, so going offline never leaves a page font in error. The capture's fonts stay pinned and local (ADR-0042).
- The applied-check is unchanged and covers every row, offline rows included: a font in error stays a failure, never a pass.
- A row is made to reach its screen by its steps, the sample data or the capture tooling alone. Never by changing the screen, its copy, the app's own `font-display`, or the applied-check, and never by dropping or excusing the row.
- A row that fails because the app itself no longer shows the seller's path is a product defect: it is escalated to the PM, never excused in the registry.

### A row names what it reaches

- The record a row names in its path is the record its route and steps reach and capture. A path that names no record (a form such as `/varieties/entries/new`, reached from a record) makes no claim about one.
- **The light `VariedadArchivada` row** declares `/varieties/{sold_out}`. Its route (`/varieties/{sold_out}`), its steps (archive, open "Archivadas (1)", click "Sir Jack") and its capture are unchanged.
- **`VariedadArchivadaOscuro`** declares and reaches `/varieties/{low}` (opens "Archivadas (2)", clicks Golden Cookies). The two themes need not show the same record.
- **The `EntradaStockSinEntradas` rows** (light, dark, Compu and CompuOscuro) declare the stock entry form, `/varieties/entries/new`, and start from `/varieties/{no_entries}`: that is how a seller reaches the form with "Stock inicial" preselected, and they are true as they stand.
- **A row found naming a record other than the one it reaches** (path and route naming different records, or steps clicking a different record):
  - a fix to its declaration alone is made in the task that finds it;
  - a fix needing different steps or sample data becomes a follow-up issue linked from that task's PR;
  - nothing found is left unexplained in the PR.

### Registry rows for Listo

- **Every Listo row reaches Listo the way a seller does**: it starts on an optional step once both required steps are met, on an account of its own in that state, and passes the remaining optional steps as onboarding.md defines them. The account state is setup, not behaviour.
- **Listo has four rows**: phone light, phone dark, computer light and computer dark, so that it is covered on both viewports in both themes like every other Onboarding screen.
- **`OnboardingListo`** (the default row, phone light) follows that rule, on its own account written by the sample app (`scripts/design/sample_app.py`'s `ONBOARDING_ACCOUNTS`). It does not start at `/onboarding/categories`, does not run the whole flow through step 6, and never clicks "Saltar el resto" on step 6.
- **`OnboardingListoCompu` and `OnboardingListoOscuro`** keep their accounts, `listo_compu` and `listo_oscuro`.
- **The computer dark row** (GH-164 follow-up) is new: it follows the registry's dark-twin convention for its name, on an account of its own written by the sample app. Its exact row and account names are the Tech Lead's.
- **Each Listo entry has a distinct `open` account**; two entries on one account are refused, and a Listo entry never names an `ended` account (the kind is in `facts.account_kinds`, ADR-0042's GH-189 amendment).
- **Capture accounts are design tooling only**: written by the sample app alone, never by product code or by the seed `muestra.md` is rendered from.
- **No product rule bends for a capture**: "Saltar el resto" never appears on step 6, and Listo is reached when the last optional step is passed (step 6 by "Seguir").

### Captured whole

- "Whole" means the entire named section as the design file in `docs/product/design-system/pantallas/` draws it. For Listo that is its title, every step line ("Hecho", or "Para después" with where) and its two actions ("Cargar mi primera venta", "Ir a Inicio"). It never means `muestra.md`, which holds the sample business's figures, not the layout.
- The same rule holds in light, dark and Compu (light and dark), each at its own registered width: a clipped section is fixed in the crop, never by widening the screen.
- The section crop takes the section's whole content, not a narrow label column beside it. Fixing it leaves every crop that already fit unchanged.
- A crop that cuts any line of the section is a capture defect and is never accepted.

### Registry enforcement tests

- The real-registry test in `web/src/design/screens.test.ts` states the account rule, enforced by the registry's rule module (`scripts/design/screens.mjs`):
  - an entry may only name an account the sample writes, each with a kind in `facts.account_kinds` (`open` or `ended`; `assertAccountKinds` refuses a missing, partial or mismatched map);
  - an `open` account belongs to one Listo entry: an `open` account on any other entry fails, and a Listo entry on an account that is not `open` fails;
  - an `ended` account (a business whose Onboarding the sample ended at seed time) may be shared by read-only entries, such as the six `Inicio*` rows, and no Listo entry names it;
  - a Listo entry that names an account the sample does not write fails;
  - two Listo entries on one account are refused (`assertSelectedAccounts`), the default Listo row included.
- The account-validation tests and `assertSelectedAccounts` keep everything they guarded; the old static rule "an account only on a Listo entry" now lives in `assertSelectedAccounts`, against the kinds.
- **Same record in path and route**: the same test states that when an entry's `path` names at least one `{name}` placeholder, its placeholders equal the `route`'s exactly: the same names, in the same order, compared as written, before any normalisation.
  - A path with no placeholder names no record and passes, whatever its route holds. This is part of the rule, not an exemption: no entry is listed as exempt.
  - It only adds to the cross-check; ADR-0033's normalisation to `{id}` for matching against the front registry is unchanged.
  - A failure names the entry and the two placeholder lists, nothing else.
  - Known blind spot, accepted: a row whose path names no record while its route does is not checked by this rule. Its steps and capture are still checked by the audit and by eye.

### Plan rules for a registry change

- A change to `scripts/design/screens.json` rows declares both registry enforcement tests, `web/src/design/screens.test.ts` and `routes.test.ts`, as its seams. Its invariants read "screens.json plus the two registry tests", with the design tooling the change needs named alongside.
- Any other edited test means the implementation is wrong.
- The muestra guard seam of GH-141's follow-up (below) is declared for that plan only and does not change this rule.
- No plan invariant asks for an idle or unloaded machine for a capture run.

### Failures

- A row that cannot reach its screen fails while it steps there, so `--strict` exits non-zero. That row is a defect to fix, never a known failure to report around.
- A font left in error on a capture, an offline step included, fails the applied-check, so `--strict` exits non-zero.
- **A row whose screen has not finished drawing when it is captured fails.** Under `--strict` it gives a non-zero exit, like a row that cannot reach its screen. It is never captured half-drawn and never accepted as a pass. How the capture tells that a screen has finished drawing is the Tech Lead's decision; this file names no mechanism.
- A difference that machine load causes in a capture's pixels is a capture defect, fixed in the capture; the comparison is never loosened and an idle machine is never asked for.
- A capture that shows a screen other than its row names, or a clipped section, is caught by eye in review and blocks approval. Neither is ever accepted as a pass.
- A Listo entry naming an account the sample does not write fails the registry test.
- An entry whose path names placeholders different from its route's fails the registry test.

### Evidence in the PR

- The output of one `--strict` call over Inicio* and the Onboarding block, exit 0.
- For a change that makes a row reach its screen: the output of one `--strict` call over the whole registry with no `--only`, exit 0, and the captures of every row it fixed, judged by eye.
- The Listo captures on phone and computer, in light and dark, judged by eye.
- The list of crops whose result changed: only ones that were clipped.
- The installed `@fontsource/plus-jakarta-sans` version (ADR-0042).
- No before/after AE pair is required for a change with no seller-visible difference whose "before" row never reached its screen.
- For a change that corrects a row's record: the captures of the corrected row and its twin, light and dark, judged by eye, and the audit of every row (rows checked, fixes made, follow-ups linked).

### The Onboarding restyle's evidence (GH-164 follow-up)

- **Screens**: the six Onboarding steps (variety and price, opening stock, header and footer, Telegram bot, partner, expense categories) and "Listo", which has its four rows (phone and computer, light and dark), each reached as above.
- **Computer** means the Onboarding's one phone-width column captured at the computer viewport; the Onboarding has no computer layout of its own (onboarding.md).
- **Per screen**: phone and computer, light and dark; plus one phone capture at 320 px with text at 130 %, light only. Each shows its named section whole.
- **Registry**: every capture is a row of `scripts/design/screens.json`. A missing row is added as design tooling, with the two registry tests as its seams; a row that cannot reach its screen is a defect, never an exemption. Any mechanism for the 130 % text lives in `scripts/design/` only, never in product code.
- **Before/after**: "before" is the code without GH-164's change; once GH-164 has merged, it is the merging head with only GH-164's own change undone, and the PR shows that undo diff. If undoing it alone changes more than GH-164 did, the PR says so and lists the extra differences for Zeta; nothing more is undone. "After" is the merging head. Both are taken by the head's own `comparisons.mjs`, from one install, on the same Argentina day, fonts pinned, `--strict`; raw captures are compared by exact AE with `ae.mjs`, never the composed sheet.
- **Judging**: every capture by eye against its design file; every non-zero AE line and every design-vs-docs difference listed with its screen and side as intended (by GH-164's brief) or fixed. Where onboarding.md and the drawing disagree, onboarding.md wins and the drawing is the defect. What neither the brief nor the docs can settle goes to Zeta in the PR.
- **Mismatches fixed here** only when the fix is CSS only, within the existing tokens (no token value changed), adds no component or colour, and changes nothing a seller reads or does: a clip at 320–430 px or 130 % text, or a step frame that strays from `OnboardingVariedad` and `OnboardingCategorias`. After a fix, both sides are captured again from the fixed head and compared again.
- **Never fixed here**: a wording difference is never fixed by changing copy (the doc wins, the difference is listed); anything that changes behaviour, copy, steps, actions or routes is split into its own bug and only listed in the PR.
- **Everything matches**: the PR says so with the evidence; that is a valid outcome.

### Reviewing GH-141's change to Análisis (criteria 6–9)

- **The Análisis cells**: four, each captured before and after: phone and computer, light and dark. A cell missing on either side means the work is not done.
- **Before and after**: "after" is the merging head; "before" is the merging head with only GH-141's change undone, the undo diff shown in the PR. Extra differences the undo causes because later changes rely on GH-141 are listed for Zeta; nothing more is undone.
- **How both sides are taken**: head's `comparisons.mjs --strict`, one install, one Argentina day, pinned fonts. The PR records the head SHA, the undo diff, the fontsource version, and the overlay's diff stat only if ADR-0042's GH-219 overlay is used.
- **Every other screen**: `ae.mjs` runs over the raw captures of every other screen in the registry, output attached. Each non-zero line is listed with its screen and side as one of:
  - intended by GH-141's decided intent;
  - a defect caused by GH-141's change or its drawing edits, fixed in this task (existing tokens only, no token value changes), after which both sides are retaken from the fixed head and compared again;
  - an extra difference from the undo, listed for Zeta;
  - a difference GH-141 did not cause, filed as a follow-up issue the PR links, not fixed here.
- A difference the brief and the docs cannot settle goes to Zeta in the PR. A missing screen or side, a one-sided `null` or an unreadable capture is a failure, never AE 0.
- **Where and how long**: all the evidence is in the PR description, in one place. A set is valid only for the SHA it was taken on; a later commit editing an Análisis drawing, or any merge of master, makes it stale (a stale capture counts as missing), and it is retaken. Approval is given only on a set whose SHA is the merging head.
- **The seam**: that plan declares `tests/design/test_muestra_screens.py` and `tests/design/muestra_guard.py` as seams for `muestra`, for that plan only. The guard keeps every check it had; any other edited test means the implementation is wrong.
- **Escalation**: a cell that cannot be captured, or a head seed the undone state cannot run, stops the work and escalates. The undone state is never patched and no exception is recorded.
- If nothing differs, `ae.mjs` exits 0 and the PR says so.
- Captures taken on the loaded shared machine are submitted as they are, with no note about load, no "unsatisfiable" entry and no exception.
- **Load-independence proof (once, for the change that settled it, GH-150's follow-up)**: the change's base and head are each captured twice, once under foreign load (at least one other worktree's checks running) and once idle (no other check, agent or worktree run, recorded as ADR-0041 records it), all by the head's own `comparisons.mjs`, from one install, on the same Argentina day (ADR-0042). For each commit, `ae.mjs` compares the loaded run with the idle run. It is never repeated as a recurring check or a gate step.

## Metrics

No telemetry; read from the PR evidence and from tests.

- **One green run (criterion 1)**: the PR holds the `--strict` output, exit 0.
- **Reached and whole (criterion 2)**: the four Listo captures are attached, each showing its whole section as the design file draws it, judged by eye; no row captures a screen other than the one it names; every crop that changed was clipped before.
- **Agree (criterion 3)**: `web/src/design/screens.test.ts` and `routes.test.ts` pass with the corrected rule; the plan's invariants and Seams line name both; the PR records no exception.
- **Nothing a seller sees changes (criterion 4)**: every suite passes; the only edited tests are the two registry tests; the only other edited files are `screens.json`, `screens.mjs`, `sample_app.py` and `comparisons.mjs`; nothing else under `app/` or `web/src/` changes.
- **No test loosened (criterion 5)**: the real-registry test keeps every guard, and each of these is a tested case: an account on an entry that does not reach Listo fails; a Listo entry with an unwritten account fails; two entries on one account fail.
- **Run B closed**: the clipped OnboardingListoOscuro crop and the unreachable OnboardingListo row are fixed by the same task; no issue is left open for either.
- **Onboarding coverage (Onboarding criterion 6)**: the `--strict` output, exit 0; `index.json` holds a result for each of the seven screens at phone and computer in light and dark (Listo's computer dark row included), and each one's 320 px / 130 % capture in light; 0 missing sides.
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
- **Offline fonts (criterion 11)**: the two `EstadosSinConexionCompu*` rows pass the applied-check with no note; the applied-check's code and its weights are unchanged; their captures show "Sin conexión" in the computer layout in the app's own font, judged by eye in both themes.
- **Reached as a seller does**: the `EstadosConfirmar` capture shows Antes de borrar whole, with the sale's date, amount and grams and both answers, judged by eye.
- **Costs the seller nothing (criterion 12)**: the diff touches only `scripts/design/` and, if needed, the two registry tests within their seams; every suite passes with no other test edited; nothing under `app/` or `web/src/` (outside those tests) changes.
- **Current Análisis captures (Análisis criterion 6)**: all 4 cells attached on both sides, 0 missing; the recorded SHA equals the merging head; the undo diff and the fontsource version are present.
- **Every difference explained (Análisis criterion 7)**: `ae.mjs` exits 0, or every non-zero line is matched to intended, a fix, an undo extra for Zeta, or a linked follow-up; 0 unlisted differences; 0 failures from a missing or unreadable side.
- **Guard declared, not loosened (Análisis criterion 8)**: the plan's seam names the two muestra files; the only edited tests are those two; the guard's existing checks all still run.
- **Nothing a seller sees changes (Análisis criterion 9)**: every suite passes; no capture or comparison step is added to `.agentic/stack.yaml`, CI or the gate.
- **Business measure**: spec-scope findings for missing or stale design evidence on the merging head: goal 0 (GH-141 had 3).
- **Accepted under load (Load criterion 6)**: the PR's before/after evidence was taken on the loaded shared machine with no "unsatisfiable" note and no recorded exception; no plan invariant asks for an idle machine.
- **Load doesn't change the result (Load criterion 7)**: the PR holds the load-independence proof; for both commits, `ae.mjs` shows exact AE 0 between the loaded and the idle run on every raw capture, design and built side, with no missing or one-sided capture, and exits 0; the installed `@fontsource/plus-jakarta-sans` version is recorded.
- **Unfinished screen fails**: a deliberately unsettled row under `--strict` exits non-zero and is not captured as a pass, shown once in the PR.
- **Gate untouched (Load criterion 8)**: no change to `.agentic/stack.yaml` or CI, no new gate step, no elapsed-time assertion.
- **Nothing a seller sees changes (Load criterion 9)**: every suite passes and no test is loosened, read from the diff.

## Out of scope

- Any change to onboarding.md, navigation.md, a screen's copy or its steps to make it easier to capture.
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
- Removing, skipping or excusing a row, or keeping a list of rows known to fail, to make a `--strict` run exit 0.
- Loosening the applied-check, letting a capture load fonts from the network, or changing the app's own font loading to make a capture pass.
- Widening the standing seam rule so every registry change declares the muestra guard files.
- Fixing, in GH-141's follow-up, design differences GH-141 did not cause: they are filed as follow-ups.
- Any change to Análisis's behaviour, figures or copy.
- Requiring an idle or unloaded machine for a capture.
- Recording the machine's load alongside a capture, or narrowing a capture's claim by it.
- A pixel tolerance in the comparison.
- Timed evidence (mypy timings, e2e worker runs): ADR-0038, ADR-0040 and ADR-0041.
- Re-judging GH-150's capture runs.
