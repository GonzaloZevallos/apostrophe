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

**Cost.** `screens.json` has 147 rows, which is at most 678 settles per run, counted from its
steps (design: first and final, 2 per row, plus one more for each of the 7 `text_scale` rows, 301;
built: first and final, 2 per row, plus one per step, 76 in all, plus one more for each
`text_scale` row, 377). Each settle samples 3 frames typically and 120 at worst, so at most 81,360
frames, each costing one pass over the page's elements. A full `--strict` run of the merged
registry took 7 min 22 s on a shared machine (an earlier run of the 130-row registry, before
GH-224 and GH-254 were merged, took 9 min 29 s): documentation only, not an assertion.

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

## Amendment: text at 130 % and the strict section crop (GH-224)

- **`text_scale` in `screens.json`.** An entry may carry `text_scale` (the one value is
  `TEXT_SCALE` in `scripts/design/textScale.mjs`, 1.3). `comparisons.mjs` applies it on both
  the design page and the built page, after the first `settle()` and the entry's steps; the
  page then settles again (`SETTLE_ADVANCE_MS`) and the final `settle()` of the GH-220 amendment
  is still the call right before the screenshot. It lives only in `scripts/design/`: nothing under `app/` or `web/src`
  reads, sets or branches on it. `screens.mjs` validates the field (the `registry-checks`
  subtask), `comparisons.mjs` only reads it.
- **Verify twice.** The apply is one `page.evaluate` and the first verify a second one right
  after it (a late-mounted element still shows up untagged); the screenshot is taken; a
  second verify runs in the same page. Between the scaling and the screenshot a React
  re-render can mount elements the stylesheet never saw, and the second verify is what makes
  that a failure instead of a screenshot that says "130 %" over unscaled text. A miss in
  either verify is a note on the sheet and in that screen's `index.json` entry, and a non-zero
  exit under `--strict`, the same path as a failed applied-check: that side is `null` and no PNG
  is written under any name (after the screenshot, the capture is discarded). The first verify
  runs before the final settle, so nothing runs between that settle and the screenshot. A note
  names the side and a count, never page text.
- **Two copies of one model.** `scripts/design/textScale.mjs` repeats the scaling model of
  `web/e2e/helpers/textScale.ts` (GH-104): tag `<html>` and every element under the root, set
  each `font-size` to baseline × factor (`!important`), scale a px `line-height` the same
  way, leave `normal` alone. The e2e helper is a gate helper five specs use and is not
  edited, so only `textScale.mjs`'s header names its twin (the helper does not name
  `scripts/design`), and `web/src/design/textScale.test.ts` reads
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

## Amendment: before-run tooling (GH-219)

Narrows point 6. Point 6 says one script from one install; it does not say how a base that
predates the registry's newest rows is captured.

- **The overlay.** A before-run takes head's whole `scripts/design/` (the capture script, the
  sample app, `screens.json`) and head's font install, and puts them over the base's own `app/`
  and `web/`, which are what gets served and captured. The seed speaks only HTTP, so head's
  sample app seeds the base's server; the two sides still capture the same registry by the same
  script.
- **How it runs.** Each side captures the whole registry in file order with `--strict` and no
  `--only`, each on a fresh sample, on the same Argentina day. `--only` is for `ae.mjs`, never
  for a capture.
- **What the evidence records.** The base and head SHAs, the overlay's diff stat (it must equal
  `git diff --stat <base>..<head> -- scripts/design`) and the installed fontsource version.
- **A seed the base cannot run.** A head seed that needs an API the base lacks makes the
  before-run fail. That escalates: the base is never patched and no exception is recorded.
- **Guards on a partial run.** A registry row may name `needs`, the earlier row whose state it
  relies on. `assertScreens` refuses a `needs` that names no earlier screen, and
  `assertSelectedNeeds` makes `comparisons.mjs` exit 2 before capturing when a selection keeps
  a row and drops the one it needs.

**Which rule governs a later before-run.** GH-219's: the whole registry in file order, with no
`--only`, on each side; `--only` stays for `ae.mjs`. GH-224's evidence (docs/evidence/GH-224-onboarding-captures.md)
captured one explicit `--only` list for both sides, as its plan required; that is safe only
because `assertSelectedNeeds` refuses a selection that drops a row another one needs, and it is
not a precedent. The two before-run methods are not mixed within one evidence note.

## Amendment: every registry row reaches its screen (GH-254)

Narrows points 3 and 4. A whole-registry `--strict` run exits 0 only if every row reaches its
screen and passes the applied-check; three rows did neither.

- **`offline` loads the fonts first.** Before the network goes, the step loads every face of
  `document.fonts` that is still `unloaded`, whatever its family, waits for `document.fonts.ready`
  and only then calls `setOffline(true)`. A face the page had not drawn yet (a weight, a
  unicode-range subset) would otherwise be fetched offline and end in `error`. The preload records
  no failure and no note: the applied-check, unchanged, is the only verdict on fonts, so a face
  that still errors is reported once, by it.
- **`press` for an icon-only control.** `{ "press": "<name>" }` finds a button by role and exact
  accessible name, with no `.first()`: zero matches or two fail the row. `click` keeps matching
  exact text, so no other row changes what it targets. `EstadosConfirmar` uses `press`, because
  "Borrar venta" is only the accessible name of an icon button.
- **A closed list of step shapes.** `assertScreens` refuses a step that is not an object with
  exactly one key of `click`, `press`, `wait` (a non-empty string), `fill` (`label` and `value`,
  strings), `select` (`label` string, `index` a non-negative integer) or `offline` (`true`). The
  message names the entry and the step's index, never the step's data.

## Amendment: a request ends when its body is read, and a frame in which one ended is not calm (GH-261)

Supersedes only the GH-220 amendment's sentence on what the in-flight counter covers, as to when a
request ends. Everything else there stands, including that the counter covers `fetch` only.

GH-247's whole-registry run showed one row (`VariedadArchivadaOscuro`, built) at AE 20214 against
AE 0 on the first run of the same code. The cause is in the probe every row shares
(`scripts/design/probe.mjs`), not in that row: the counter released a request when its `Response`
resolved, which is when the headers arrive. `web/src/api/client.ts` then reads the body with
`await response.json()`, and react-query tells its observers on a `setTimeout(0)` of the paused
clock. A frame could therefore see "no request in flight", hash the page before the answer was
drawn, and complete the run of three equal frames. The late lines of PriceRows (bulk and VIP, which
wait on `GET /pricing-settings`) are one instance, not the only one.

**The rules**

1. A request is in flight until its response body has been read, or until it fails. The wrapper
   reads `response.clone().arrayBuffer()` inside a `.then` it attaches before it returns the
   promise, so the clone is made before the app's own continuation and never meets a body the app
   already read. A rejected fetch, a synchronous throw, a body that cannot be read and a response
   with no body (a 204 reads as empty) all count as done.
2. A frame in which any request completed since the previous frame is not idle, and neither is the
   first frame after a navigation. `window.__captureQuiet()` waits for no request in flight, then
   answers whether the number of completed requests is unchanged since its previous call, and
   records it. The next `clock.runFor(16)` fires the notify timer and the render. `settleWith` and
   `settle.mjs` are unchanged: a frame that is not idle already resets the run.
3. Every response the app reads is finite. `api/client.ts` holds the only `fetch` in `web/src`;
   there is no `EventSource`, stream reader, long poll or `refetchInterval`, and `retry` is off. A
   streaming or long-poll channel, or any new request channel, is excluded or counted by name in
   the diff that adds it. A body that never ends holds the counter until `withinTimeout` rejects,
   and the row fails with `SETTLE_REASON_REJECTED`; that is a real failure and is never excused.

**Why not a `wait` step on the issue's row.** The issue named `VariedadArchivadaOscuro`. GH-131
moved every `VariedadArchivada*` row to Blue Dream, which is seeded with no bulk and no VIP price,
so `PriceRows` has no conditional line to draw there. A `wait` in the registry would fix one query
on one screen and leave the probe wrong for every other row (the Golden Cookies rows
`VariedadDetalle`, `VariedadesCompu`, `VerTodas` and `PrecioNuevoCompu*` still show the lines).

**Cost.** Each `fetch` in a capture reads its body one more time, through a clone, and a settle may
sample one extra frame after a request completes; the cost stays bounded by `SETTLE_BOUND` and
`TIMEOUT`. Nothing here runs in the app or the gate, and the capture is still not a gate step.

**What the evidence shows.** Ten whole-registry `--strict` runs on one Argentina day
(2026-10-20), each on a fresh sample, no `--only`: five of the base head `c4987540` and five of
the fixed head `a3db92ab`; every run exited 0. `@fontsource/plus-jakarta-sans` was 5.3.0.
`ae.mjs` compared run 1 with runs 2 to 5 on each side.

- No run, before or after, showed the issue's difference (the bulk and VIP lines of a Golden
  Cookies price row, nor `VariedadArchivadaOscuro`): every line was AE 0 except one. So the claim
  that the request race is closed rests on `web/src/design/probe.test.ts`, which drives the real
  `settleWith` over the real probe and fails without either half of the change (red on the
  unchanged probe, red on the body-read-only probe, green on the fixed one). The repeats show only
  that the fix did not regress what they cover.
- The one non-zero line, on both sides, is `VariedadesCompu built: AE 2888` (a 88 x 52 px area at
  x 2424-2512, y 1458-1510 of the 2560 x 2180 capture): a toggle drawn grey, mid colour
  transition, in some runs and dark in others. It has two states: before1, after1 and after3 in
  one, before2 to before5 and after2, after4, after5 in the other, and the fix does not change
  which one a run lands in. It is not a request race. It is an unsettled CSS transition, a
  separate cause that this change does not address and that a later task has to.
- Consequently the fixed head is not AE 0 on every row and side across the five runs.

**Known risk.** `probe.test.ts` models the paused clock and react-query's notify timer. It does not
run react-query itself, so a change in how react-query schedules its notification is not covered.
