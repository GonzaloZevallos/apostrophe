---
status: accepted
date: 2026-10-14
---

# Design captures pin their fonts, and a before/after compares raw captures at exact AE

GH-156 (follow-up of #106 / PR #154). The before/after evidence for #106 gated on a
whole-sheet `compare -metric AE`. The first pair gave AE 4239 although the design file was
byte-identical on both sides, and the difference lay wholly in the design half of the sheet.

## Cause

`settle()` in `scripts/design/comparisons.mjs` already awaits `document.fonts.ready`, so
waiting for fonts was never the missing piece. The design files load Plus Jakarta Sans from
Google Fonts with `display=swap`: the capture could paint the fallback face before the font
arrived over the network, and whether it did varied from run to run.

## Decision

1. **A design capture never touches the network.** `captureDesign` routes its context
   (`context.route('**')`): `file://` continues; the Google Fonts stylesheet and font files
   are answered from the app's own `@fontsource/plus-jakarta-sans` package
   (`scripts/design/fonts.mjs`); every other request is aborted. This holds with and without
   `--strict`.
2. **The stylesheet is built locally** from `@fontsource/plus-jakarta-sans/<weight>.css`
   for the weights the request names, with `font-display: block` in place of `swap` and each
   `./files/<name>` URL rewritten to a fixed `fonts.gstatic.com` prefix. A gstatic request is
   served from `files/` only for names matching `^[a-z0-9-]+\.woff2?$`. A weight with no local
   CSS throws: there is no fallback to the network. The files come from the version installed
   under `web/node_modules`; a before/after PR records that version.
3. **The applied-check.** After the final `settle()`, both captures verify in the page: a
   loaded `FontFace` of the page's own first family, no face with status `error`, and
   `document.fonts.check` true for weights 400 to 700 with latin sample text. The family is
   the first one of `document.body`'s computed `font-family`; a design file sets its font on
   an inner block, not on the body (its body is the browser default), so for the design it is
   the first element that draws text. Weights the page does not draw are loaded first, so
   `check` means "this weight is available". The built app keeps its own `font-display: swap`
   (`web/src/main.tsx`, product code): the check guards it.
4. **Lenient by default, `--strict` on demand.** A font failure (missing font root or file, a
   throw from `fontCss`, an aborted font request, a failed applied-check) is a note on the
   sheet and in that screen's `index.json` entry; the exit code does not change. With
   `--strict` the run finishes the remaining screens, writes `index.json`, and exits non-zero.
   Each screen runs in its own `try` (an unexpected throw is a note and the next screen still
   runs), and `index.json` is written in a `finally`. Under `--strict` a screen-level failure
   also exits non-zero.
5. **Raw captures.** Besides `<screen>.png`, whose composition is unchanged, the exact buffers
   are written as `<screen>.design.png` and `<screen>.built.png` (the DPR 2 full-page capture,
   not resampled). `index.json` lists them as `design` and `built`: an absolute path, or `null`
   when there is no capture.
6. **A before/after is captured by one script from one install**: the head's
   `comparisons.mjs`, against each commit's own app and sample data, on the same Argentina day
   (the sample data carries dates).
7. **The comparison is exact AE over the raw captures**, never over the composed sheet: images
   of different dimensions, a missing screen, a one-sided `null` and an unreadable PNG are
   failures, never AE 0. PNGs are decoded with `pngjs` (a dev dependency of `web`); decoding in
   the browser is out of vitest's reach and Playwright's bundled decoder is private. Detailed
   by subtask `ae-gate`, which amends this ADR if needed.

## Known risks

- The browser wiring (routing, applied-check, `--strict`) has no unit test; only `fonts.mjs`
  does. The evidence run exercises it, including a missing font root.
- Design sheets may differ in glyph shape from sheets captured before this change, since the
  fonts are now fontsource's. Nothing compares against old sheets.
- The built side keeps the app's own `swap` and relies on the applied-check.

## Amendment: the `ae-gate` shape

- `scripts/design/ae.mjs <before-dir> <after-dir> [--only A,B]` prints one line per screen and
  side (`<screen> built: AE 0`, `<screen> design: FAIL different dimensions`, and so on) and
  exits 1 when any side fails or has an AE above 0, 2 on bad usage. No pixel data is printed.
- A name in `--only` that is in neither `index.json` is a failure (`FAIL in neither index`),
  so a typo cannot pass by comparing nothing. A screen missing on one side is one `FAIL
  missing in <side>` line.
- `ae(a, b)`, `decode(buffer)` and `compareIndexes(before, after, only, load)` are exported
  and pure apart from `decode`'s use of `pngjs`; the command runs only when the file is the
  entry point. `@types/pngjs` is a dev dependency so the test file type-checks.

## Amendment: text at 130 % and the strict section crop (GH-224)

- **`text_scale` in `screens.json`.** An entry may carry `text_scale` (the one value is
  `TEXT_SCALE` in `scripts/design/textScale.mjs`, 1.3). `comparisons.mjs` applies it on both
  the design page and the built page, after the final `settle()` and the entry's steps and
  before the screenshot. It lives only in `scripts/design/`: nothing under `app/` or `web/src`
  reads, sets or branches on it. `screens.mjs` validates the field (the `registry-checks`
  subtask), `comparisons.mjs` only reads it.
- **Verify twice.** The apply and a first verify run in one `page.evaluate`; the screenshot is
  taken; a second verify runs in the same page. Between the scaling and the screenshot a React
  re-render can mount elements the stylesheet never saw, and the second verify is what makes
  that a failure instead of a screenshot that says "130 %" over unscaled text. A miss in
  either verify is a note on the sheet and in that screen's `index.json` entry, and a non-zero
  exit under `--strict`, the same path as a font failure. A note names the side and a count,
  never page text.
- **Two copies of one model.** `scripts/design/textScale.mjs` repeats the scaling model of
  `web/e2e/helpers/textScale.ts` (GH-104): tag `<html>` and every element under the root, set
  each `font-size` to baseline × factor (`!important`), scale a px `line-height` the same
  way, leave `normal` alone. The e2e helper is a gate helper five specs use and is not
  edited. Each file's header names the other, and `web/src/design/textScale.test.ts` reads
  the helper with `?raw` and ties its `TEXT_SCALE` and `TOLERANCE` literals to the module's
  exports. Accepted risk: a change in the scaling rule beyond those two constants is not
  caught by anything.
- **The crop authority is the DOM count.** A `section` crop requires
  `page.getByText(section, { exact: true })` to match exactly one element; any other count is
  a screen that threw (`<screen>: section matches N elements, expected 1`), written in
  `index.json` and a non-zero exit under `--strict`. This replaces the silent `.first()`.
  `sectionOccurrences` (a count of `>label<` in the design file, in `screens.mjs`) is only an
  earlier, weaker static guard: when the two disagree the run stops, and a crop never moves
  silently.
