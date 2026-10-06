---
status: accepted
date: 2026-10-05
---

# The theme choice is the only thing the browser stores

The app opens light unless Oscuro is chosen on that device, and the choice survives
reloads and logging out, Entrar included (accounts.md, criteria 23-26). That needs one
value kept in the browser, while `forbiddenApis.ts` bans `localStorage` everywhere and
the e2e specs assert zero stored keys (CODING_STANDARDS §9: no personal data in the
browser). A theme is not personal data, but the exception must stay one, and checked.

## Decision

- **`web/src/theme.ts` is the only module that names `localStorage`.** `forbiddenApis.ts`
  allows that rule by exact path (`src/theme.ts`), as it does for `clipboard.ts`.
  `forbiddenApis.test.ts` is written first: a fixture outside `theme.ts` fails, and
  `theme.ts` passes.
- **One key, `tema`, whose only stored value is `oscuro`.** Choosing Claro removes the
  key. Any other value (stale, tampered, `claro`) reads as light, is left alone, and
  sets no attribute. Every access sits in `try/catch`: a storage error gives light, and
  choosing still applies the attribute for the page's lifetime.
- **`theme.ts` exports `applyStoredTheme()` and `chooseTheme('claro' | 'oscuro')`**, and
  nothing else touches `data-tema` on `<html>`.
- **It is read in `main.tsx`, synchronously, before `createRoot`.** There is no inline
  script in `index.html`: an inline script sits outside `tsc` strict and outside the
  `forbiddenApis` scan of `src/`, and would be a second, unchecked author of the rule.
  Known cost: a device with Oscuro stored may paint one frame of the light page
  background before the module runs.
- **The e2e "zero storage" assertion becomes one helper** in `web/e2e/`: stored keys are a
  subset of `{tema}`, and `tema`, when present, equals `oscuro`. `sessionStorage` and
  `indexedDB` stay asserted empty.
