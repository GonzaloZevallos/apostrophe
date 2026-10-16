# Design capture

The evidence a reviewer uses to judge that a screen looks as designed: the design file and the built app are captured side by side from the screens registry (`scripts/design/screens.json`), with pinned fonts, by `scripts/design/comparisons.mjs`, and when a change needs a before/after pair, the raw captures are compared by exact AE with `scripts/design/ae.mjs` (ADR-0041, ADR-0042). This file holds what the capture and its registry must guarantee for the people who rely on them. It changes no product behaviour: no capability's rule, screen, route, step or copy is defined here, and the capture always follows the product, never the reverse. It is review evidence attached to a PR and judged by eye; it is never a step of the gate (gate.md). Sellers and the operator see nothing of it.

## Jobs

**When** I run the design capture over Inicio and the Onboarding before approving a change, **I want** every screen the registry lists, both themes of Listo included, to be reached the way a seller reaches it and captured whole, and the registry, its tests and the plan to agree, **so I can** trust a green `--strict` run as evidence and approve without hand-patching a test, accepting a screen that was never reached, or recording an exception.

- Its protagonist is the maintainer, or the reviewer acting for them, as in accounts.md's and gate.md's maintainer jobs. The seller is affected only indirectly: a capture nobody can trust holds up the changes they are waiting for.
- It refines the "looks as designed" criteria (navigation.md criterion 7, onboarding.md criterion 5 and its design metric, icon-and-text-rule.md criterion 6); it is not a new product job.
- It also serves when a design guard or a registry test fails and the maintainer must tell a real defect from a broken registry row.
- Before it (GH-142's follow-up): a one-test edit broke the plan's own invariant, the OnboardingListo row could not reach Listo, the OnboardingListoOscuro crop was clipped, and those two defects had no issue.

Success criteria:

1. **One green run.** One `--strict` call over Inicio* and the Onboarding block exits 0.
2. **Reached and whole.** Every Onboarding screen the registry lists, Listo in light and dark included, is reached as onboarding.md defines and captured whole. No crop is clipped, and no row captures a screen other than the one it names.
3. **Registry, tests and plan agree.** The change needs no recorded exception and no test edited outside a declared seam.
4. **Nothing a seller sees changes.** onboarding.md, navigation.md and every screen read and behave as before, and every test passes. The only edited tests are the two registry tests; the only other edited files are design tooling (`scripts/design/screens.json`, `scripts/design/screens.mjs`, `scripts/design/sample_app.py`, `scripts/design/comparisons.mjs`); no file under `app/` or `web/src/` changes beyond those two tests.
5. **No test loosened.** A changed registry or enforcement test keeps everything it guarded and states the corrected rule.

## Behaviour

### What a capture is

- Fonts are pinned and the design capture never touches the network; `--strict` turns a font or screen-level failure into a non-zero exit, after every screen ran and `index.json` was written (ADR-0042).
- Each screen writes its composed sheet and its raw design and built captures; a before/after compares the raw captures by exact AE, never the sheet (ADR-0042).
- A capture is review evidence, judged by eye in the PR. It is never a gate step, and no new automated check is added for it.

### Registry rows for Listo

- **Every Listo row reaches Listo the way a seller does**: it starts on an optional step once both required steps are met, on an account of its own in that state, and passes the remaining optional steps as onboarding.md defines them. The account state is setup, not behaviour.
- **`OnboardingListo`** (the default row) follows that rule, on its own account written by the sample app (`scripts/design/sample_app.py`'s `ONBOARDING_ACCOUNTS`). It does not start at `/onboarding/categories`, does not run the whole flow through step 6, and never clicks "Saltar el resto" on step 6.
- **`OnboardingListoCompu` and `OnboardingListoOscuro`** keep their accounts, `listo_compu` and `listo_oscuro`.
- **Each Listo entry has a distinct account**; two entries on one account are refused.
- **Capture accounts are design tooling only**: written by the sample app alone, never by product code or by the seed `muestra.md` is rendered from.
- **No product rule bends for a capture**: "Saltar el resto" never appears on step 6, and Listo is reached when the last optional step is passed (step 6 by "Seguir").

### Captured whole

- "Whole" means the entire named section as the design file in `docs/product/design-system/pantallas/` draws it. For Listo that is its title, every step line ("Hecho", or "Para después" with where) and its two actions ("Cargar mi primera venta", "Ir a Inicio"). It never means `muestra.md`, which holds the sample business's figures, not the layout.
- The same rule holds in light, dark and Compu, each at its own registered width: a clipped section is fixed in the crop, never by widening the screen.
- The section crop takes the section's whole content, not a narrow label column beside it. Fixing it leaves every crop that already fit unchanged.
- A crop that cuts any line of the section is a capture defect and is never accepted.

### Registry enforcement tests

- The real-registry test in `web/src/design/screens.test.ts` states the account rule, enforced by the registry's rule module (`scripts/design/screens.mjs`):
  - an account is allowed only on an entry that reaches Listo, and only if it names an account the sample writes;
  - any other entry that names an account fails;
  - a Listo entry that names an account the sample does not write fails;
  - two entries on one account are refused (`assertSelectedAccounts`), the default Listo row included.
- The account-validation tests and `assertSelectedAccounts` keep everything they guarded.

### Plan rules for a registry change

- A change to `scripts/design/screens.json` rows declares both registry enforcement tests, `web/src/design/screens.test.ts` and `routes.test.ts`, as its seams. Its invariants read "screens.json plus the two registry tests", with the design tooling the change needs named alongside.
- Any other edited test means the implementation is wrong.

### Failures

- A row that cannot reach its screen fails while it steps there, so `--strict` exits non-zero.
- A capture that shows a screen other than its row names, or a clipped section, is caught by eye in review and blocks approval. Neither is ever accepted as a pass.
- A Listo entry naming an account the sample does not write fails the registry test.

### Evidence in the PR

- The output of one `--strict` call over Inicio* and the Onboarding block, exit 0.
- The Listo captures in light, dark and Compu, judged by eye.
- The list of crops whose result changed: only ones that were clipped.
- The installed `@fontsource/plus-jakarta-sans` version (ADR-0042).
- No before/after AE pair is required for a change with no seller-visible difference whose "before" row never reached its screen.

## Metrics

No telemetry; read from the PR evidence and from tests.

- **One green run (criterion 1)**: the PR holds the `--strict` output, exit 0.
- **Reached and whole (criterion 2)**: the three Listo captures are attached, each showing its whole section as the design file draws it, judged by eye; no row captures a screen other than the one it names; every crop that changed was clipped before.
- **Agree (criterion 3)**: `web/src/design/screens.test.ts` and `routes.test.ts` pass with the corrected rule; the plan's invariants and Seams line name both; the PR records no exception.
- **Nothing a seller sees changes (criterion 4)**: every suite passes; the only edited tests are the two registry tests; the only other edited files are `screens.json`, `screens.mjs`, `sample_app.py` and `comparisons.mjs`; nothing else under `app/` or `web/src/` changes.
- **No test loosened (criterion 5)**: the real-registry test keeps every guard, and each of these is a tested case: an account on an entry that does not reach Listo fails; a Listo entry with an unwritten account fails; two entries on one account fail.
- **Run B closed**: the clipped OnboardingListoOscuro crop and the unreachable OnboardingListo row are fixed by the same task; no issue is left open for either.

## Out of scope

- Any change to onboarding.md, navigation.md, a screen's copy or its steps to make it easier to capture.
- Widening a screen beyond its registered width to fit a crop.
- Making the design comparison a gate step, or any new automated check of a capture.
- A before/after AE pair for a change with nothing seller-visible to compare.
- Judging whether a screen looks good: the capture finds unintended differences.
