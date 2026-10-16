# GH-224 evidence: the Onboarding restyle (GH-164) against its design

Follow-up of GH-164 ("open important findings"): the Onboarding's seven screens compared with
their designs on every side, and a before/after pair of GH-164's restyle compared by exact AE
(ADR-0042). This file is written in sections by the subtasks that make the evidence. It
changes no product code. Images are attached to the PR, never committed.

## 1. "Before": the head with GH-164 undone

Built by the `before-build` subtask. "Before" is the head this task branched from, with only
GH-164's merge (`2645926`, the merge of PR #222) undone and never committed.

### 1.1 The tooling is the same on both sides

`git diff --stat 2645926^1 2645926 -- scripts/design web/src/design web/e2e` printed nothing
(empty, as the plan requires): GH-164 touched no capture tooling, no registry row, no test
of the registry and no e2e file, so "before" carries the head's own `comparisons.mjs`,
`screens.json`, `sample_app.py` and `textScale.mjs`. The capture tooling is therefore identical
on both sides by construction.

### 1.2 How it was built

| Item | Value |
| --- | --- |
| Head (the branch's `HEAD` when "before" was made) | `78c3084e35e1b91a830cb65bc2d25d4a2c18be60` |
| GH-164 merge that is undone | `2645926` (parents `d9784c0`, `50fb96a`), an ancestor of the head |
| Command, run from the head's tree | `git revert --no-commit -m 1 2645926` (never committed; the index holds the undo) |
| Copy of the head used | `/tmp/GH-224-before.3eEfP3/repo` (see 1.6: a clone, not a `git worktree`) |
| Undo diff (`git diff HEAD` there) | `/tmp/GH-224-before.3eEfP3/undo.diff`, 1091 lines, sha256 `227043c4b26f3c3b…`; attach it to the PR |
| Installed `@fontsource/plus-jakarta-sans` | `5.3.0` (`web/package.json` asks `^5.3.0`); the copy's `web/node_modules` is the branch worktree's, so both sides use one install |
| Build | `npm --prefix web run build` (`tsc -b && vite build`), exit 0 |
| Before `web/dist` | `/tmp/GH-224-before.3eEfP3/repo/web/dist` (26 files under `assets/`; `index.html` sha256 `67fa01f79d5f8f26…`, entry `assets/index-DS_Twmsb.js`) |

The after side is built later from the branch's own worktree. Its `web/dist/index.html` must
differ from the one above, or the run is void (plan, "Two apps").

### 1.3 Conflicts, and how each was resolved

The revert did not apply cleanly: five files conflict, six hunks. Each was resolved by keeping
the later change (GH-166, GH-144 or GH-135/GH-141) and dropping only GH-164's lines. These are
the hunks where **the undo differs from GH-164's own diff**, listed for Zeta:

| File | Hunk | Kept (later change) | Dropped (GH-164) |
| --- | --- | --- | --- |
| `CONTEXT.md` | glossary tail | the **Gate** and **Design capture** entries | the **Tappable notice** entry |
| `docs/product/icon-and-text-rule.md` | list of the closed lists | the "+ is the icon" and "An action never looks like a link" bullets (GH-166) | the **Tappable notice** bullet and its three sub-bullets |
| `docs/product/icon-and-text-rule.md` | metrics | "Icon and word not doubled", "One back per screen", "Actions are not links" (GH-166) | GH-164's wording of "One rule (criterion 2)" ("…the tappable notice included"), restored to the pre-GH-164 sentence |
| `web/src/screens/onboarding/CategoriesStep.tsx` | the editor and the submit | `addCollapsed` on `ExpenseCategoriesEditor` (GH-144) | `StepSubmit`; the plain `<button className="boton">` is back |
| `web/src/screens/onboarding/OnboardingStep.tsx` | the "Atrás" control | GH-166's `<Boton variant="secondary" icon="atras">Atrás</Boton>` | none: GH-164 had written `<Boton variant="back">‹ Atrás</Boton>` and GH-166 rewrote that very line, so no GH-164 line is left to drop; "Atrás" is the same on both sides |
| `web/src/screens/onboarding/Steps.test.tsx` | imports | `PUBLISH_LINE` from `./BotStep` (GH-144) | the `expectIconAndTextRule, iconAndTextProblems` import |

One edit outside any conflict marker: `OnboardingStep.tsx` lost the `import Icono` line the
revert had put back, because the kept "Atrás" no longer uses `Icono` and `tsc -b` refuses an
unused import (`TS6133`). Nothing renders from it.

Consequences for the evidence:

- **"Atrás" is not a GH-164 difference.** It looks the same before and after (GH-166's
  secondary button with the `atras` icon). A zero AE on it says nothing about GH-164.
- "Cerrar" in the step frame, "Seguir" on step 6 and the other steps' submits are undone to
  their pre-GH-164 form, so they are the differences the capture can show.
- `CategoriesStep` before keeps `addCollapsed`, so step 6's "add" action is collapsed on both
  sides.

### 1.4 The undo against GH-164's own diff

`git diff --numstat 2645926^1 2645926` (GH-164) against `git diff --numstat HEAD` in the copy
(the undo). Both touch the same 28 files. GH-164 totals +465/−97 and the undo +92/−462.

For 27 files the undo is exactly GH-164's numbers mirrored (insertions and deletions swapped).
For one file they differ:

| File | GH-164 | Undo | Why |
| --- | --- | --- | --- |
| `web/src/screens/onboarding/OnboardingStep.tsx` | +4/−8 | +3/−1 | GH-166 rewrote the "Atrás" line GH-164 had changed; only "Cerrar" and the `Icono` import come back (1.3) |

Equal numbers can still hide a different line (a conflict hunk kept the later line): that is
the case of `CONTEXT.md`, `icon-and-text-rule.md` and `CategoriesStep.tsx`, all listed in 1.3.
The 23 files that merged with no conflict are the exact mirror of GH-164's hunks.

### 1.5 What the undo touches, by whether a capture can see it

**Touches no capture** (documents, glossary, tests, test helpers): `CONTEXT.md`,
`docs/adr/0037-boton-draws-the-icon-and-text-rule-as-a-type.md`,
`docs/product/design-system/README.md`, `docs/product/icon-and-text-rule.md`,
`web/src/architecture/closingGuards.real.test.ts`, `web/src/components/Boton.test.tsx`,
`Boton.types.test.tsx`, `BotonLink.test.tsx`, `web/src/screens/Inicio.test.tsx`,
`web/src/screens/onboarding/Onboarding.test.tsx`, `Steps.test.tsx`, `StepSubmit.test.tsx`,
`web/src/screens/settings/PricingGroup.test.tsx`, `web/src/test/iconAndTextRule.test.tsx` and
`iconAndTextRule.ts`.

**Renders inside the Onboarding** (the captures can show a difference; each non-zero AE line
is classified against GH-164's brief in the comparison section): `BotStep.tsx`,
`CatalogMessageStep.tsx`, `CategoriesStep.tsx`, `Listo.tsx`, `OnboardingNotice.tsx`,
`OnboardingStep.tsx`, `PartnerStep.tsx`, `StockStep.tsx` and `StepSubmit.tsx` (removed).

**Shared rendering files**: `web/src/components/Boton.tsx`, `botonVisual.tsx` and
`web/src/styles/app.css` (the `.onboarding__enlace`, `.onboarding__boton-resto`,
`.onboarding__boton-saltar`, `.aviso-onboarding` and `.onboarding__envio` rules and the
`.boton-aviso` rule). Undoing them also changes "before" outside the Onboarding, and so does
`web/src/screens/settings/PricingGroup.tsx` (Configuración's price group). Those screens are
not captured: the PRD scopes the evidence to the Onboarding's seven screens. Inside the
Onboarding block, "shared component" is no reason to excuse a non-zero AE.

### 1.6 Deviation: a clone, not a worktree

The plan asks for a throwaway `git worktree`. In this run the shell refuses every `git
worktree` command ("the system creates and removes the worktrees"), so "before" was made in
`git clone --no-hardlinks . "$(mktemp -d)/repo"`, a standalone copy outside the repository
tree at the same head (`78c3084`). It is the same artefact the plan describes, a directory
outside the tree whose own `web/dist` a sample app serves, and it never touched the branch,
the repository's worktree list, the config or any other worktree. If the clone is removed
before the capture, redo 1.2 from the same head with the same command and the same six
resolutions.

## 2. The two captures

Made by the `capture-compare` subtask. No tooling or test was written; both runs use this
branch's `scripts/design/comparisons.mjs` and `ae.mjs`, unchanged.

### 2.1 The run

| Item | Value |
| --- | --- |
| Argentina day | 2026-10-16 for both captures (`TZ=America/Argentina/Buenos_Aires date +%F`) |
| Install | one `web/node_modules`; `@fontsource/plus-jakarta-sans` **5.3.0** |
| "Before" app | started from `/tmp/GH-224-before.3eEfP3/repo` (1.2), fresh sample `/tmp/GH-224-evidence/before-app`, serving bundle `assets/index-DS_Twmsb.js`; run with `VIRTUAL_ENV` set to this worktree's `.venv`, because the clone has none (it is the same Python install) |
| "After" app | started from this branch's worktree after `npm --prefix web run build`, fresh sample `/tmp/GH-224-evidence/after-app`, bundle `assets/index-jfeT3zyR.js` |
| `web/dist/index.html` sha256 | before `67fa01f79d5f8f26…`, after `db0c87f0f7598c96…`: they differ, the run is valid |
| Outputs | `--out /tmp/GH-224-evidence/before-out` and `.../after-out` (attach the sheets and raw captures to the PR) |
| Exit codes | before 0, after 0, both with `--strict` |

Command of each capture: `node scripts/design/comparisons.mjs --facts <app>/sample.json --out <out> --only "$ONLY" --strict`.
Each printed 35 lines, every one `<screen>: ok`; no line had a note. In both `index.json`
files all 35 entries have a `design` and a `built` path and empty `notes`.

### 2.2 The `--only` list (the same for both captures and for `ae.mjs`)

35 rows: `OnboardingStock, OnboardingMensaje, OnboardingBot, OnboardingSocio, OnboardingCategorias`
and the same five with the suffixes `Oscuro`, `Compu`, `CompuOscuro` and `Texto130`;
`OnboardingVariedad, OnboardingVariedadOscuro, OnboardingVariedadCompu, OnboardingVariedadTexto130,
OnboardingVariedadCompuOscuro`; `OnboardingListo, OnboardingListoCompu, OnboardingListoOscuro,
OnboardingListoCompuOscuro, OnboardingListoTexto130`.

### 2.3 The artboard check (Texto130)

The design raw capture of every `…Texto130` row is 828 px wide (414 CSS px: the artboard is
wider than the 320 px viewport by construction), but **no "wider than its viewport" note was
raised on either side**. The built raw capture is 640 px wide (exactly 320 CSS px). So the
rule "judge built overflow against the design's own width" was not needed: the built side
does not overflow its viewport, and no note exists to compare.

### 2.4 `ae.mjs` before against after (exit 1, as expected: GH-164 changed things)

`node scripts/design/ae.mjs before-out after-out --only "$ONLY"`, full output:

```
OnboardingStock built: AE 6415
OnboardingStock design: AE 0
OnboardingMensaje built: AE 6415
OnboardingMensaje design: AE 0
OnboardingBot built: AE 6415
OnboardingBot design: AE 0
OnboardingSocio built: AE 6415
OnboardingSocio design: AE 0
OnboardingCategorias built: AE 6415
OnboardingCategorias design: AE 0
OnboardingStockOscuro built: AE 6396
OnboardingStockOscuro design: AE 0
OnboardingMensajeOscuro built: AE 6396
OnboardingMensajeOscuro design: AE 0
OnboardingBotOscuro built: AE 6396
OnboardingBotOscuro design: AE 0
OnboardingSocioOscuro built: AE 6396
OnboardingSocioOscuro design: AE 0
OnboardingCategoriasOscuro built: AE 6396
OnboardingCategoriasOscuro design: AE 0
OnboardingStockCompu built: AE 6415
OnboardingStockCompu design: AE 0
OnboardingMensajeCompu built: AE 6415
OnboardingMensajeCompu design: AE 0
OnboardingBotCompu built: AE 6415
OnboardingBotCompu design: AE 0
OnboardingSocioCompu built: AE 6415
OnboardingSocioCompu design: AE 0
OnboardingCategoriasCompu built: AE 6415
OnboardingCategoriasCompu design: AE 0
OnboardingStockCompuOscuro built: AE 6396
OnboardingStockCompuOscuro design: AE 0
OnboardingMensajeCompuOscuro built: AE 6396
OnboardingMensajeCompuOscuro design: AE 0
OnboardingBotCompuOscuro built: AE 6396
OnboardingBotCompuOscuro design: AE 0
OnboardingSocioCompuOscuro built: AE 6396
OnboardingSocioCompuOscuro design: AE 0
OnboardingCategoriasCompuOscuro built: AE 6396
OnboardingCategoriasCompuOscuro design: AE 0
OnboardingStockTexto130 built: AE 6833
OnboardingStockTexto130 design: AE 0
OnboardingMensajeTexto130 built: AE 6833
OnboardingMensajeTexto130 design: AE 0
OnboardingBotTexto130 built: AE 6833
OnboardingBotTexto130 design: AE 0
OnboardingSocioTexto130 built: AE 6833
OnboardingSocioTexto130 design: AE 0
OnboardingCategoriasTexto130 built: AE 6833
OnboardingCategoriasTexto130 design: AE 0
OnboardingVariedad built: AE 6415
OnboardingVariedad design: AE 0
OnboardingVariedadOscuro built: AE 6396
OnboardingVariedadOscuro design: AE 0
OnboardingVariedadCompu built: AE 6415
OnboardingVariedadCompu design: AE 0
OnboardingVariedadTexto130 built: AE 6833
OnboardingVariedadTexto130 design: AE 0
OnboardingVariedadCompuOscuro built: AE 6396
OnboardingVariedadCompuOscuro design: AE 0
OnboardingListo built: FAIL different dimensions
OnboardingListo design: AE 0
OnboardingListoCompu built: AE 25916
OnboardingListoCompu design: AE 0
OnboardingListoOscuro built: FAIL different dimensions
OnboardingListoOscuro design: AE 0
OnboardingListoCompuOscuro built: AE 25892
OnboardingListoCompuOscuro design: AE 0
OnboardingListoTexto130 built: FAIL different dimensions
OnboardingListoTexto130 design: AE 0
ae: the before/after differ, or could not be compared
```

Every `design` side is AE 0 (the design files and the pinned fonts did not move).

## 3. The differences, one line each

Judged by eye: the Stock sheet (design next to built, light and dark, after), Stock before and
after built, the seven 320 px / 130 % built captures (after). The other rows were judged by
their AE: every step row has the same AE for the same capture kind, which says the same
region of the same size changed on all of them (the other steps' before/after pairs were not
read one by one).

| Screen and side | Difference | Verdict |
| --- | --- | --- |
| `OnboardingStock`, `Mensaje`, `Bot`, `Socio`, `Categorias`, `Variedad` built, phone light | AE 6415 on each | **intended**: the step frame's "Cerrar" text link is now a `Boton` icon button with an X (seen on Stock before/after); GH-164's brief, the step frame's `Boton` |
| same six, built, phone dark and computer dark | AE 6396 on each | **intended**, same cause |
| same six, built, computer light | AE 6415 | **intended**, same cause |
| same six `…Texto130`, built | AE 6833 on each | **intended**, same cause, at 130 % |
| `OnboardingListo`, `OnboardingListoOscuro`, `OnboardingListoTexto130`, built | `FAIL different dimensions` (Listo phone light: 1706 px before, 1718 px after, 6 CSS px taller) | **for Zeta**: not read by eye before against after in this run; the height change is real |
| `OnboardingListoCompu`, built | AE 25916 | **for Zeta**, same reason |
| `OnboardingListoCompuOscuro`, built | AE 25892 | **for Zeta**, same reason |
| every row, design side | AE 0 | nothing changed |

Design against the docs and the build (from the Stock sheet; the "Atrás" and the step frame
repeat on the other steps):

- The design draws "Atrás" and "Cerrar" as text links; the build has a secondary `Boton` with
  the `atras` icon (GH-166, not GH-164) and the X icon button (GH-164). For Zeta.
- The primary of step 2 reads "Guardá el stock" in the design and "Guardá la entrada" in the
  build; the build also shows "Hoy tiene 0 g", which the design does not. A copy difference:
  never fixed here, the doc wins. For Zeta, split into its own bug.
- The design draws the step inside a rounded card on a grey page; the build is full-bleed.
  Not read against the docs. For Zeta.

### 3.1 At 320 px with text at 130 %, after (the seven captures)

- Nothing is clipped: no line, control or crop is cut in `Variedad`, `Stock`, `Mensaje`,
  `Bot`, `Socio`, `Categorias` or `Listo`. The built page is exactly 320 CSS px wide on all seven.
- The "Cerrar" X button is 88 px at DPR 2 (44 CSS px); "Atrás", the primaries and the secondary
  buttons are taller. The small `i` icon next to the hint in step 4 (Bot) and the narrow
  "Tu chat" field were not measured: **for Zeta**.
- In `Mensaje` the two text areas show one or two lines of their content with their own
  scroll; that is the field, not a cropped screen.
- In `Listo` the primary "Cargar mi primera venta" wraps to two lines and grows; it is not cut.

## 4. What follows

**`css-fixes` may take:** nothing. No built-side note, no clip at 320–430 px or 130 %, and no
step frame straying from `OnboardingVariedad` / `OnboardingCategorias` was found (Variedad has
no "Atrás" because it is step 1; the frame is otherwise the same on all six).

**Split into their own bugs / for Zeta:** the copy difference of step 2 and the "Hoy tiene
0 g" line; the design's "Atrás" and "Cerrar" text links against the built buttons; the card
frame; the three Listo rows with different dimensions and the two Listo computer AEs, not
classified; the `i` icon's tap size in step 4.

Not every non-zero AE is a defect: the six steps' lines are the intended close control.
