# GH-45 evidence: Inicio before and after, against its design

The before/after pair of GH-45 (Hoy cut to what can be acted on, the first-run checklist and
the after-import notice), compared by exact AE (ADR-0042, with the GH-219 amendment's
overlay). It changes no product code. Images are attached to the PR, never committed.

## 1. What was run

| Item | Value |
| --- | --- |
| Base ("before") | `716822cb3dd9838dc04e2d76ef80777be0c37bed`, the merge base of the task branch with `origin/master` |
| Head ("after") | `b696c406be6a7922f134525e0d6c33dcedb8187a` |
| Overlay | head's whole `scripts/design/` over the base's own `app/` and `web/` (built and served by the base) |
| Overlay diff stat | `git diff --stat 716822cb..b696c406 -- scripts/design` printed `scripts/design/screens.json \| 9 ++++++---` and `1 file changed, 6 insertions(+), 3 deletions(-)`. The two copies of `scripts/design/` were byte-identical (checked with `cmp` on every file). |
| Installed `@fontsource/plus-jakarta-sans` | `5.3.0` (`web/package.json` asks `^5.3.0`); the base copy's `web/node_modules` is a symlink to the head worktree's, so both sides use one install. `pyproject.toml` and `uv.lock` do not differ between the two SHAs, so the base copy's `.venv` is also a symlink to the head's. |
| Base copy | `git archive 716822cb` of the repository into `/tmp/gh45-base`, then `git archive HEAD scripts/design` over it. Not a `git worktree`. |
| Command, each side | `scripts/design/compare.sh --strict --out <dir>`: the whole registry in file order, no `--only`, each on a fresh sample (151 screens) |
| Argentina day | Both sides ran on 2026-10-17 (`date.today()` of the sample, read at noon by the capture's fake clock). After: 10:54 to 11:02; before: 11:03 to 11:11. |
| Result | Both runs exited 0 under `--strict`. |
| Comparison | `node scripts/design/ae.mjs before after` over the raw captures: 292 of 302 side-captures have AE 0; the other 10 are listed in section 2. It exits 1 by design when anything differs. |

One attempt of the before run failed first: the base copy had no `.venv`, so
`uv run --no-project uvicorn` could not spawn (`sample-app: the server exited before
answering /health`). I linked the head's `.venv` and ran it again; the only complete before
run is the second. The after run had run at the same time as that failed attempt, on the loaded
machine; captures taken loaded are valid as they are (ADR-0042 settles on layout, not on time).

Attached to the PR (all in `/tmp/gh45-evidence/attach/`): `before-<screen>.png` and
`after-<screen>.png` for `Inicio`, `InicioHoy`, `InicioOscuro`, `InicioCompu`, `InicioHoyCompu`
and `InicioHoyCompuOscuro` (phone and computer, both themes), and `ae.txt`. The complete sets
are `/tmp/gh45-evidence/before` and `/tmp/gh45-evidence/after`.

## 2. Every non-zero difference

All 151 design sides are AE 0 on both runs: the design column did not move. The non-zero ones
are all on the built side.

| Screen | Side | AE | Class | Why |
| --- | --- | --- | --- | --- |
| `Inicio` (Semana, phone) | built | 466379 | intended | `hoy-and-cobrar` drew Semana in the design's order (Regalaste first, Ganancia and Caja last, commit `fe165ec1`) and the first-run notice moved with it. |
| `InicioCompu` (Semana, computer) | built | 1131340 | intended | Same reorder of Semana on a computer. |
| `InicioHoy` | built | different dimensions | intended | Hoy no longer draws Ganancia, Caja, Costo de lo vendido, Faltante de stock, Gastos, Regalaste or Compras (criterion 2), so the page is shorter. Not comparable by pixel; read by eye. |
| `InicioOscuro` | built | different dimensions | intended | Same cut, dark. |
| `InicioHoyCompu` | built | different dimensions | intended | Same cut, computer. |
| `InicioHoyCompuOscuro` | built | different dimensions | intended | Same cut, computer, dark. |
| `InicioPrimeraVez` | built | different dimensions | intended | Same cut on the Hoy page that shows the Onboarding notice. |
| `InicioPrimeraVezCompu` | built | different dimensions | intended | Same. |
| `InicioPrimeraVezOscuro` | built | different dimensions | intended | Same. |
| `VariedadesCompu` | built | 2888 | follow-up #273 | Only the switch of the open variety differs (gray before, black after). Two more captures of each side: the base was gray both times, the head black once and gray once, so the capture is unstable. Cause not investigated. |

> `VariedadesCompu` above: resolved by GH-273, cause not a transition (docs/evidence/GH-273-capture-at-rest.md; ADR-0042, GH-273 and GH-291 amendments). Row kept as observed.

## 3. What the captures still show against the drawings

Read by eye in the "after" sheets of `Inicio`, `InicioHoy`, `InicioOscuro`, `InicioCompu`,
`InicioHoyCompu` and `InicioHoyCompuOscuro`. The "before" sheet of `InicioHoy` shows the tabs, the Te deben
block and the Lo que te queda rows as they are now, so none of those comes from this task.

| Difference | Where | Class |
| --- | --- | --- |
| "Seguí con la configuración" above the figures where the drawing shows none | all six | intended: the sample's La Huerta is in the Onboarding (slot 1 of the notices); `InicioPrimeraVez*` draws it |
| Dates and week figures (17/10, 12/10 to 18/10, `$ 369.000`) against the static 07/10 and 05/10 to 11/10 | all six | not a defect: the sample is seeded on the day it runs, the drawings are static |
| Pill tabs, the selected one blue-tinted, instead of underlined text tabs | all six | follow-up #271 |
| Te deben: "2 ventas · desde 28/09" where the drawing reads "2 ventas debiendo"; rows laid out as name, balance, "desde dd/mm" line, Cobrar below, where the drawing has two lines and Cobrar at the right | all six | follow-up #271 |
| Cobrar carries a cash icon and is larger than the drawing's compact button | all six | follow-up #271 |
| Lo que te queda: the status word is not a chip (ok and baja are not drawn at all), days sit under the grams | all six | follow-up #271 |
| Semana and Mes figures stacked as full-width rows on a computer, where the drawing has a three-column grid of cards beside the headline | `InicioCompu` | follow-up #272 |
| Dark computer capture is compared against the light drawing | `InicioHoyCompuOscuro` | intended: dark twins check structure only; its colors read right by eye against `tokens.css` |
| Design column of `InicioHoyCompu` and `InicioHoyCompuOscuro` holds both Hoy and Semana | both | design gap, #274: `InicioCompu.dc.html` has no unique Hoy label, so no `section` can crop it (`assertScreens` refuses `section: "Hoy"`: it occurs 3 times) |

No difference was fixed here: the brief allows CSS-only fixes, but every item above is in the
product's front, which `hoy-and-cobrar` and `first-run-front` own, and this subtask changes
design tooling and evidence only.

## 4. Design gaps and what the registry cannot reach

- **No drawing of the four-step checklist** (no "Hecho" mark in any Inicio drawing;
  `InicioPrimeraVez*.dc.html` draws the Onboarding notice and the after-import notice text).
  Not invented. Issue #274.
- **No row for the checklist or the after-import notice.** `sample_app.py` opens every business
  through an invitation, which gives it an `onboarding` row; the checklist needs a business with
  none, and `imported_at` is stamped only by the import's command line. Neither is reachable
  over HTTP, and the brief says to escalate rather than patch product code. Those two states are
  covered by Testing Library in `web/src/screens/Inicio.test.tsx`; the end-to-end spec
  (`web/e2e/firstRun.spec.ts`) covers only the brand-new and joined cases, since
  `tests.e2e_app` offers no command that seeds a pre-Onboarding or imported business. Issue #274.
- **Hoy rows added**: `InicioHoy` (crop "Hoy · la pestaña con la que abre el panel"),
  `InicioOscuro` (no step, the dark drawing is Hoy alone), `InicioHoyCompu` and
  `InicioHoyCompuOscuro` (whole file, see above); the Semana rows `Inicio` and `InicioCompu`
  crop to their Semana block.
