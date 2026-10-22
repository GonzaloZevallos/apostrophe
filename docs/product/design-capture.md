# Design capture

## Jobs

- When I review a PR that changes how a screen looks, I want the before/after design captures to differ only where the PR changed something, so I can approve on the evidence without wondering whether a difference comes from the screen or from the tool.

The person is the PR reviewer, not a seller. Design captures change nothing a seller sees.

## What it is

A design capture puts a screen's design file and the built app side by side. It is taken from the screens registry with pinned fonts and attached to a PR as review evidence, to be judged by eye. It is never a step of the gate. Decisions: ADR-0042, as amended by GH-261 and GH-273.

## Behaviour

- **How a row is captured.** A registry row reaches its screen the way a seller does and captures its named section whole.
- **Only at rest.** The capture is taken only once the screen is at rest: no animated change running, no request pending, and no control still disabled or busy while it waits. A screen that never comes to rest fails its row.
- **Load-independent.** A capture's result never depends on how loaded the machine is.
- **Before/after compares raw captures at exact AE.**
- **The guarantee, stated once.** Whole-registry `--strict` runs of one commit give AE 0 on every row and side. ADR-0042's current text holds this statement; amendments and evidence notes point to it rather than restate it.
- **The request-body-read rule, the frame rule and the `probe.test.ts` evidence from GH-261 stand.**
- **`VariedadesCompu built: AE 2888` is resolved by GH-273.** The cause was not a transition: ten whole-registry `--strict` runs gave 0 non-zero lines of 312 (`docs/evidence/GH-273-capture-at-rest.md`). GH-261's sentence calling it "an unsettled CSS transition" that "a later task has to address" is kept as history, marked superseded. GH-261's "AE 0 on every row and side" acceptance is met by GH-273.
- **Open escalation: 48 phone `built` lines.** GH-273's Rule 5 changes pixels on 48 phone `built` lines that depend on viewport height. Nobody has judged them by eye. They are escalated, not excused, and stay visibly open. Their own GitHub issue owns judging them, and ADR-0042 and the GH-273 evidence note both cite it. They are a before/after difference across that viewport change, outside the one-commit guarantee, and not a regression of the switch finding.
- **No excuses.** Every difference that is still unexplained is either its own issue or a decision recorded in ADR-0042. None is excused in a note, and an escalation written only in an evidence note does not count as owned.

## Metrics

- **Stale claims left:** places in ADR-0042 and `docs/evidence/` that present a superseded claim as current. Target: 0.
- **Reopened findings:** `important` findings that the follow-up check reopens over a difference already resolved in ADR-0042. Target: 0.
- **Current guarantee statements:** statements in ADR-0042 that present what a capture guarantees as current. Target: exactly 1.
- **Unexplained differences without an owner:** capture differences with neither an issue cited in ADR-0042 nor a decision recorded in it. Target: 0.
- **Same-commit consistency:** non-zero AE lines in whole-registry `--strict` runs of one commit. Target: 0 of every row and side.
