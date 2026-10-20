# GH-273: capture at rest

## Diagnosis

Diagnostics, not before/after evidence. Run on the task base (`6541887d`, the base's own tooling, an uncommitted throwaway copy), single row `VariedadesCompu` (built side only, 1280x920, light), Playwright 1.63.0, `@tanstack/query-core` 5.104.1, on a machine already loaded (load average about 22 on 16 cores). Each run is a fresh context on the same sample database. The throwaway copy is not committed.

Per sampled frame it logged only: `button.interruptor`'s `disabled` and `aria-checked`, the probe's in-flight and completed counts, a MutationObserver flag, the number of extra real `MessageChannel` hops until the flag stayed clear (five clear hops in a row), and `getAnimations().length`. Outside the frames it also logged the fetch pathnames (ids replaced by `N`), the `resize`, `focus`, `visibilitychange` and `(min-width: 900px)` change events, and the names of the DOM nodes replaced after the shot. No page text, amounts or names. The gray/black verdict is the pixel of the switch's track in the PNG itself (`121,118,113` gray, `35,30,24` black), never a guess from the DOM.

### Result: base fails, and it is neither hole (a) nor hole (b)

Neither of the brief's two holes is the cause. In every run the switch was `disabled=false`, `aria-checked="true"`, with no request in flight and the mutation flag clear in all the settled frames (the first one, three equal frames, and the final settle). `isFetching` was not true while the counter read idle, and the flip did not land among the three equal frames. The gray appears only **after** the settled frames, **inside `page.screenshot({ fullPage: true })`**.

The chain, measured:

1. A `fullPage` screenshot of a page taller than the viewport makes Chromium resize the viewport momentarily to 1x1 (`resize:1x1`, then `resize:1280x920`).
2. At 1x1, `matchMedia('(min-width: 900px)')` changes to `false` and back to `true` (`mq900:false`, `mq900:true`). `useViewport` flips `computer` to `phone` to `computer`, and `Shell` replaces the contents of `.columna-principal` twice (two removals, two additions).
3. The page remounts, its queries re-subscribe, and all nine of them refetch (`Ie.onSubscribe` in the stack): `/pricing-settings`, `/varieties/N`, `/varieties/N/prices`, `/stock`, `/stock/varieties/N/movements`, `/catalog`, `/varieties`, `/first-run`, `/varieties`. The completed count goes from 10 to 19.
4. `VarietyThresholdSection` is `disabled={saving || refreshing}` with `refreshing = stockQuery.isFetching`, and `.interruptor:disabled` draws at opacity 0.6. A shot taken while `/stock` is being re-read is gray; one taken before the dance reaches the page is black.
5. Whether the pixels are taken before or after the disabled state is painted is a race against the load of the machine, hence the unrepeatable result. It is not a fetch the counter missed, and it is not a transition. The refetch runs on the real network, but its answer is drawn only when the fake clock advances, so the page stays disabled until the next frame.

The same dance happens on a phone row, but there `(min-width: 900px)` is false at 390 px as well, so no flip and no remount follow. It only bites rows of 900 px or more that are taller than their viewport.

### Failure rate p

Whole-run N, `--only`-style single row, full-page shot as the base does it:

| CPU throttling (CDP `Emulation.setCPUThrottlingRate`) | N | gray | p |
|---|---|---|---|
| none (1) | 20 | 2 | 0.10 |
| 4 | 12 | 10 | 0.83 |
| 10 | 12 | 8 | 0.67 |

At no throttling p varied between runs of the same command with the machine's load: an earlier batch of 6 had 5 gray and another of 4 had 4 gray. A better-grounded statement is p = 0.1 to 0.8 depending on load. Every gray run had `after.disabled=true` and `completed=19` right after the shot (`completed=10` and enabled in every black one), so the refetch is what makes it gray.

The gray runs always settled in 7 or 8 frames and returned no failure from `settleWith`: base reports them as a pass.

### Control: no dance, no gray

The same row, the viewport set to the document's `scrollHeight` (1280 wide, so no media-query change) before the final settle, then a plain (not full-page) screenshot: **0 gray in 24** (12 at throttling 4, 12 at throttling 10), no resize event after the settled frames, no fetch after the shot, `completed` stayed at 10.

### Commit lag, in hops

- **Largest lag observed: 0 extra real hops**, in every frame of every run (settled frames and 12 frames after the shot, over 20+12+12+24 runs, throttling up to 10x). After the standard real hop, the mutation flag was never set by a commit landing later than that hop; a mutation that was seen was seen in the first read. The extra hops therefore found nothing to wait for at these rates.
- **Proposed `SETTLE_QUIET_HOPS`: 2** (observed 0, plus a margin of 2 on a count that is cheap). This is a safety margin on a figure measured as 0, not a measured need. It must not be read as evidence that the hops fix this: **they do not**, because the commit that matters happens after the settle, during the shot.
- The lag is bounded, so the stop condition "no fixed hop count covers it" does not apply. No time-based wait is proposed anywhere.

### What this means for the plan (for the Tech Lead)

- Base can be made to fail (p up to 0.83), so the second stop condition does not apply.
- **The plan's mechanism 3 (quiet hops) and 5 (three calm frames) cannot fix this cause**, since the settled frames are all clean. Only mechanism 6 (the check after the shot) sees it: in the gray runs the first frame after the shot has `idle=false` and the mutation flag set (the remount), while in black runs it is calm. The hash is the same in both (`5ec840d1`, the base's hash does not see `disabled`), so only the mutation flag and the in-flight count tell them apart.
- Consequence: with the check as planned, a `Compu` row whose shot dances the viewport would fail its row in roughly the same proportion as it is gray today (p of 0.1 to 0.8), instead of being repeatable. The capture needs to stop causing the refetch it then waits for. The control above shows one way that was measured: size the viewport to the document before the final settle and take a plain shot, so the screenshot never resizes the viewport. A decision for the Tech Lead; it changes `comparisons.mjs` (both sides, every row taller than its viewport) and says something about rows whose layout depends on viewport height. It was not tried on other rows.
- The cause is also in `ADR-0042`'s record: the GH-261 amendment's "unsettled CSS transition" is wrong (the switch has no transition), and so is a "background re-read the screen started on its own": the re-read is started by the capture's own screenshot.
- Not investigated: why some full-page shots, at no throttling, do not reach the `1x1` flip before the pixels are taken (the black runs show a single `resize` event).

## Evidence on the head (captured 2026-10-20, Argentina day, shared loaded machine)

Review evidence only: nothing here is a gate, CI or `.agentic/stack.yaml` step. Valid only for the SHAs below.

- Task base (tooling and app before the change): `6541887d3c808164d0d1da97ea21084e81e2854a`.
- Head captured: `27eefcb060f4b74b3e2cd855827c554cb5484417`. Its only later commit is this evidence.
- `@fontsource/plus-jakarta-sans`: 5.3.0 (head's `web/node_modules`). Node v24.21.0.
- Overlay (ADR-0042, GH-219) used for the base side that was prepared: head's whole `scripts/design/` over the base's own `app/` and `web/`; its diff stat is the stat of `git diff --stat 6541887d..HEAD -- scripts/design`: 4 files changed, 224 insertions(+), 46 deletions(-) (`comparisons.mjs`, `probe.mjs`, `settle.d.mts`, `settle.mjs`).

### Five whole-registry `--strict` runs of the head (done)

Each on a fresh sample, no `--only`, one after the other, on the shared machine (load average 6 to 17 around them). Per run: `head-runN/{strict-console.txt,exit-code,times.txt,index.json}`.

| Run | Start | End | Exit |
|---|---|---|---|
| 1 | 10:01:57 | 10:08:55 | 0 |
| 2 | 10:09:54 | 10:18:13 | 0 |
| 3 | 10:19:10 | 10:25:56 | 0 |
| 4 | 10:26:45 | 10:35:13 | 0 |
| 5 | 10:46:28 | 10:55:22 | 0 |

A first attempt at run 5 was cut off by the capture wrapper's own 590 s cap (not by the capture), left no `index.json` and does not count; run 5 above is its retake from scratch, on the same sample method.

`ae.mjs` run 1 against runs 2 to 5 (`ae-head-1-vs-N.txt`): each prints 312 lines (156 rows, both sides), every one `AE 0`, exit 0. **0 non-zero lines, `VariedadesCompu built` included; no `null` side in any `index.json`.**

### The switch, judged by eye and by pixel

`VariedadesCompu-built-switch-head-run1.png` (a crop of the head's run-1 capture, 2x): the "Aviso de stock bajo" switch is **enabled and on** (black track, white thumb at the right), the state the sample's stored threshold gives it, not the grey of the disabled state. The track pixel is `35,30,24` (black) in all five runs. The registry has no dark `VariedadesCompu` row, so there is no dark capture of it.

### Not done in this delivery (named, never hidden)

The turn cap ran out before these were captured. Nothing below is claimed:

1. The five base runs (overlay) and the base-against-head `ae.mjs`. The first attempt failed: the overlay's `settle.d.mts` no longer matches the base's two test files under `tsc -b` (the scratch base needs them removed, they are not served), and a scratch tree made with `git archive` needs the checkout's `.venv` linked for the sample server.
2. The two throwaway demonstrations (a row re-issuing a fetch on a fake-clock `setInterval` while a button stays disabled, and a row restarting a finite transition every tick) shown failing under `--strict`.
3. The diagnostic pair of the head's tooling under CPU throttling (the diagnosis above has the base's p of 0.1 to 0.8 and the no-dance control at 0 of 24).
4. A by-eye pass of the other rows that carry the switch or an animated element (`VariedadDetalle`, `VariedadArchivada*`, `ArchivadasCompu`): they are AE 0 across the five head runs, which is not the same as judged.
