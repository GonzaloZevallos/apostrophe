---
status: accepted
date: 2026-11-07
---

# A design-capture side that misses for load is recaptured whole from a fresh context, unless it wrote

GH-601. `compare.sh --strict` over the whole registry rarely exited 0: in GH-548's five full runs, 1 to 5 built-side
rows failed with `la pantalla no quedó quieta`, a different set each run, and every one passed alone with `--only`.
Extends ADR-0042 (rules 6 and 7) and ADR-0052 without amending them.

## Decision
- **A side is captured again, whole, at most `CAPTURE_ATTEMPTS = 3` times.** Each attempt opens its own `browser.newContext` and page and creates its own census side. `isCalm`, `shotKept`, the equal-hash rule, `SETTLE_*` and `TIMEOUT` are unchanged: a run passes more often only by re-capturing a whole side, never by accepting a frame that is not calm. The bound counts attempts; no wait or timeout is added.
- **The kinds are a closed set**, set where each reason is produced and never read from reason text: `unsettled`, `rejected`, `network`, `rest-mismatch`, `rest-unread`, `shot-timeout`, `step-timeout` and `other`. Every kind but `other` is retried. `step-timeout` is read from `error.name === 'TimeoutError'` only.
- **Never retried:** a font failure, the applied check, the text-scale check, a size, region, layer or viewport miss, any other thrown error, and any attempt whose page sent a request that is not GET or HEAD (the write probe, `page.on('request')`; the login goes through `context.request` before the page exists and does not count).
- **A step that sent a write waits for the write's response** (`writesAnswered`, bounded by `TIMEOUT`, the same for every row and both sides) before it settles. **Rows that write are not rescued by a retry:** the two `Save sale` rows and `OnboardingVariedad`, plus any other row the probe finds. A miss on them is still a failure. Reseeding the sample per attempt is out of scope.
- **Census:** only the last attempt's census is written to `index.json`; no `settledHash`, census record or PNG of a failed attempt reaches it or the disk.
- **Visibility.** A side that passes after a miss gets the note `built: settled on attempt N of 3 after <kinds>`; a side that misses every attempt keeps its Spanish failure plus ` (after 3 attempts: <kinds>)`; every run prints `retries: N rows, M attempts` (rows with a side captured more than once; M sums those sides' attempts). Notes and the line carry no page text, sample data, amounts or names.
- **Excuse guard.** A row retried in 2 or more of the 3 recorded runs is a defect of that row, not noise. More than 5 rows retried in a run, a miss rate on attempt 1 above 15 %, or more than half of the retries missing again on attempt 2 stops the work: the cause is the load and no bound is loosened.
- Both sides go through the same wrapper; nothing branches on the side, row, file or width (ADR-0052).
- **Rows with no built screen (human decision 5).** A whole-registry `--strict` run (no `--only`) counts the rows whose `route` is `null` as `not compared: no built screen: N rows` and does not fail on them; they stay in `index.json` by name with `capture: 'not-captured'`. A row with a built route that is not captured, a failed capture and a failed design side still fail `--strict`, and so does a row with no built screen asked for by name with `--only`. The rule reads only `route === null`, never the side, row name, file or width.

## Measured miss rates
`docs/evidence/GH-601-built-settle.md` has the runs. Before this ADR's write rule was complete, one whole-registry run (head `00166830`) missed 4 of 173 built rows on attempt 1: 2 were retried and passed on attempt 2, and the 2 `Save sale` rows wrote, so they were not retried and the run exited 1. Two whole-registry runs at the same time exited 0 with no miss. On head `51f4c4ae` three consecutive runs exited 0: attempt 1 missed 1, 2 and 0 of 173 built rows (at most 0.012), 0 of 3 retried rows missed again on attempt 2, at most 2 rows were retried in a run, and no row was retried in two runs. All retries were `rest-mismatch`.

On the head after the master merge (`3accc29e`), three whole-registry runs on a heavily loaded machine retried no row (0 of 174 built rows missed on attempt 1) and `ae.mjs` gave AE 0 on every side between them; they exited 1 only because master's `--strict` also fails on the 119 rows with no built screen yet.

With human decision 5 in place (head `57c53adc`), three consecutive whole-registry `--strict` runs exited 0: 0 of 174 built rows missed on attempt 1, no row was retried, 119 rows were counted as `not compared: no built screen`, and `ae.mjs` gave AE 0 on every side between the runs.

## Risks
- An intermittent late refetch can pass on a later attempt; the note and the summary line keep that visible.
- How `restAfterShot` and the step catch pick their kind is shown by the wiring cases and the recorded runs, not by unit tests.
