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
