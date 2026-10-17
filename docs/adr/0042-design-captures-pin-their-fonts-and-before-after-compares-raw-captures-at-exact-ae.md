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

## Amendment: a capture is taken only once the page has finished drawing (GH-220)

GH-150's evidence rule asked for `compare.sh` runs on an idle machine, which could never hold on
a shared one. The defect was in the capture: `settle()` swallowed its `networkidle` timeout,
waited for no frame and no timer, and left animations running at screenshot time, so what was
captured depended on machine speed. Machine load is never a condition of valid evidence
(design-capture.md, criteria 6 to 9).

**Settled, in this order** (this supersedes point 3's "after the final `settle()`"):

1. `networkidle` once after each `goto`, never swallowed: a timeout is a failure.
2. The applied-check, which also loads the fonts. It runs before the fake clock moves and before
   any frame is sampled, on every settle.
3. A paused fake clock advanced by `SETTLE_ADVANCE_MS` (0 on the final settle), then frames of
   `clock.runFor(16)`, each followed by one `evaluate` in the page. The evaluate awaits the
   page's in-flight fetch counter at zero, yields one real macrotask (a `MessageChannel`), and
   answers only a FNV-1a hash of the layout and booleans. A frame is counted only when that
   counter is zero in that evaluate; `networkidle` is not used as a wait after the first load.
4. Settled after 3 consecutive counted frames with equal hashes, none with a running finite
   animation, fonts loaded (`document.fonts.status === 'loaded'`). At most 120 frames are
   sampled; a fetch that never settles is cut by the evaluate timeout (`TIMEOUT`). Both are
   bounds on how long the capture waits and assert nothing about duration.

Each side settles after its first load and after each step, then once more with `advanceMs: 0`
immediately before the screenshot; nothing runs between that settle and the screenshot, and every
screenshot passes `animations: 'disabled'` and `caret: 'hide'`. The section crop's clip is read
before that final settle, so the screenshot stays the next call after it.

**The fake clock** is installed and paused before `goto` on both the design and the built
context, at `<facts.today>T12:00:00-03:00` (Argentina, matching ADR-0042's day). `today` is
written by `scripts/design/sample_app.py` from the same `date.today()` it seeds with; facts
without it are a usage error (exit 2), and there is no wall-clock fallback.

**`SETTLE_ADVANCE_MS` is 350**: the smallest advance that fires every debounce or wait whose
result a capture must show, `KEYBOARD_WAIT_MS` (300 ms, `web/src/shell/keepFocusVisible.ts`) and
the 150 ms debounces in `Clientes` and `Cobro`.

**The in-flight counter covers `fetch` only**, an init script that wraps `window.fetch` before
the app loads. That is every request channel the built app uses today:
`web/src/architecture/forbiddenApis.ts` allows `fetch` only in `api/client.ts` and bans
`XMLHttpRequest`, and `web/src` has no `lazy(` or `import(`, beacon, `EventSource` or
`WebSocket`. The first lazy route, or any other request channel, must extend the counter in the
same diff that adds it.

**A side that did not settle, whose applied-check fails, whose `networkidle` times out or whose
step throws** goes through `fail(ctx, …)`: that side is `null` in `index.json` and no `.design.png`
or `.built.png` is written (the sheet `<screen>.png` is still composed and draws "—" for it).
The note names the side, the step as JSON when a step failed, and a fixed reason; it carries no
page text, sample data, amounts or names, and the page sends back only a hash and booleans.
Under `--strict` the run exits non-zero after every screen ran and `index.json` was written. A
step that throws used to be only a note, so `--strict` stayed green; it now fails.

**Cost.** `screens.json` has 130 rows, which is at most 578 settles per run (design: first and
final, 260; built: first, one per step, final, 318; at most 5 steps in a row). Each settle samples
3 frames typically and 120 at worst, so at most 69,360 frames, each costing one pass over the
page's elements. A full `--strict` run took 9 min 29 s on a shared machine: documentation only, not
an assertion.

**Known risks.**

- The collector, the fake clock wiring and the counter have no unit test; only `settle.mjs` does.
  Two throwaway `--strict` demonstrations in the PR cover them (a rotating spinner settles; an
  endlessly reflowing block fails with the side `null` and no PNG).
- SVG children carry no `offset*`, so a change inside an SVG shows only through its HTML ancestors.
- Three yielded frames is a bound, not a proof, against long chains of React scheduler work.
- `sample_app.py` reads `date.today()` (the machine's local day) while the browser runs on the
  Argentina day; near midnight they can differ.
- If the fake clock stalls actions (a click, fill or select timing out because the page never
  advances), the task stops and goes back to the Tech Lead; the mechanism is not changed in place.
