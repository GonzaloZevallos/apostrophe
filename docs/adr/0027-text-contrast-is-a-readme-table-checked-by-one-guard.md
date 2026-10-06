---
status: accepted
date: 2026-10-06
---

# Text contrast is a README table checked by one pytest guard; surfaces are a closed list; `--tenue` is icon-only

The design README's accessibility rule 5 says text on its background is 4.5:1 at least.
The built app broke it (`--tinta2` on `--superficie` and `--deuda-fondo`, `--deuda2` on
`--deuda-fondo`, `--nav-inactivo` on `--papel`, `.pie` in `--tenue`), and nothing would
have caught a later token change doing it again.

## Decision

- **The README table is the single source.** `docs/product/design-system/README.md`, under
  rule 5, lists each text token, its kind, its background, and its ratio in each theme.
  `tests/test_design_contrast.py` reads it, computes WCAG 2.x relative luminance and
  contrast from `web/src/styles/tokens.css` (per theme block), and fails on a row under
  4.5, or whose printed ratio is not the computed one to two decimals. The guard holds no
  colour and no pair of its own.
- **Surfaces are a closed list**: `--papel`, `--superficie`, `--deuda-fondo`,
  `--acento-suave`. A new surface is a new row, so a new set of ratios.
- **Three kinds of token.** *General* text tokens (`--tinta`, `--tinta2`, `--acento`,
  `--deuda`, `--deuda2`) need 4.5:1 on every surface, so where a rule sits in the DOM
  stops mattering. *Paired* tokens (`--boton-texto`, `--critico-texto`,
  `--nav-inactivo`) have one background; a rule using one declares that background, or
  its selector is listed in the table (text drawn on a container's background, and the
  bottom-bar label). *Icon-only* tokens are not text and are not measured.
- **The rule check** covers `app.css` and `tokens.css`: every `color: var(--X)` is a
  general or paired token, or an icon-only one on a selector the table names; and a rule
  with a text colour and a surface or paired background is a pair the table allows.
- **No ancestor-background inference.** CSS alone cannot know the DOM, and a guess would
  break on a refactor. The closed surface list is what makes inference unnecessary.
- **It is pytest, not vitest**, because Vite's `server.fs.allow` stops a front test from
  reading `docs/product/design-system/`, as `tests/test_design_tokens.py` already found.
  That file also gains the check that `tokens.ts` and `web/src/styles/tokens.css` carry
  the same colours in both themes.
- **`--tenue` left text use.** It is 3.03:1 on `--papel` in light, and keeps its values
  as the colour of chevrons (`.mas__item-flecha`, `.fila-venta > svg`). `.pie` moved to
  `--tinta2`.
- No second token for text on panels was needed: one darker `--tinta2` clears 4.5:1 on
  all four surfaces.

## Known gap

Colours set inline in components (`.tsx`) are not seen by the rule check. `hexColors.ts`
still guards hex literals there; a `var(--token)` set inline escapes the pair check.
