# Gate

The checks every change must pass before it merges: pytest, vitest and e2e (ADR-0039, ADR-0040, ADR-0041). The maintainer and the agentic development system rely on them. This file holds what the gate itself must guarantee, including how the mobile standard's offender lists may change. It changes no product behaviour: no capability's rule, screen, route, refusal or message is defined here. Sellers and the operator see nothing of it. The operator gains only indirectly, from a gate they can trust.

## Jobs

### Same result whenever it runs

**When** the gate goes red, **I want** (as the maintainer or the agent running it) that to mean something in the product broke, never that the calendar moved past an expiry or a day boundary, **so I can** fix real regressions inside the brief I'm working on instead of patching tests by hand in files nobody asked me to touch.

Before this, a test that depended on the real date (an invitation past its 7 days, a day boundary in Argentina) failed one day for no product reason. It was patched case by case outside any brief (GH-142, commit e73ecf4).

Success criteria:

1. **Same result whenever it runs.** Every check of the gate (pytest, vitest, e2e) gives the same verdict on any date and at any time of day. That includes more than 7 days after today and across a midnight in Argentina. A test that passes today cannot fail next week because the date changed.
2. **Time-based rules are tested at their edges on purpose.** These rules are tested by setting the time the test needs, never by the wall clock:
   - invitation expiry (7 days);
   - reset links (24 hours);
   - the login brakes (15 minutes);
   - the Argentina business day;
   - "a future date is refused".
3. **No product behaviour changes because of how tests keep time.** Every capability file reads and behaves the same.
4. **The gate stays fast and self-contained.** No waiting, no sleeping until something expires, and no checks on how long something took (ADR-0038, ADR-0041).
5. **No known test depends on the real clock.**

### A reachable screen trades its unreachable entry

**When** a change makes a screen that was listed as unreachable reachable by the mobile walk, **I want** (as the Developer making that change, or the reviewer approving it) a written rule for trading that screen's `unreachable` entry for its real offender cells in the same change, **so that** the gate does not read real, newly visible cells as a regression and nobody writes a one-off exception.

Before this (GH-293), invariant 9 of the GH-271 plan forbade any growth of the offender lists and did not foresee this case. Each such trade needed an exception recorded with evidence, task by task. CobroDesdeInicio was the case on record: one `unreachable` entry traded for seven 246x437 cells.

Success criteria:

1. When a screen becomes reachable, its `unreachable` entry is removed and its real cells are added to the offender lists in the same change.
2. The new cells are recorded and tracked like any other offender. They are never hidden, and never read as a regression.
3. The exception covers only that screen. The only growth allowed is the cells of the screen whose `unreachable` entry is removed in that same change. Any other growth still breaks invariant 9.
4. A reviewer can check the trade from the offender files and the change alone, without reading the Developer's evidence notes.

## Behaviour

### Time in tests

- **Controlled time.** Every test whose result depends on the date or time runs on a time the test controls. This covers:
  - invitation expiry;
  - reset links;
  - the login brakes;
  - the Argentina business day and "today": the current price, a future date refused, and the day change that triggers upkeep.
- **The invitation clock.** Its separation from the app's injected clock (ADR-0001) leaves no test able to expire on the real clock. The mechanism is the Tech Lead's.
- **Allowed use of the real clock.** A test of the app's own clock (for example, that "today" is the Argentina business day) may read the real clock only if its verdict is the same on any date and at any hour.
- **Production code** that legitimately reads the real clock (the app's "today", the upkeep ticker) is not governed by this file.
- **Edited tests keep their meaning.** A test may change how it sets its time. No assertion about product behaviour is dropped, loosened or changed in meaning.

### Staying fixed

- A new test whose result depends on the real date or time is flagged when it is added, before it can go green.
- The mechanism is fast and checks no elapsed time.

### Exceptions

- A test that cannot be made independent of the real date or time is escalated to the PM.
- It is never deleted, and never kept as a known exception without a decision.

### Verification

- A one-time check that the gate's suites pass at a date more than 7 days ahead and across an Argentina midnight.
- It is recorded in the evidence of the task that changes how tests keep time.
- It is not repeated on every gate run.

### Mobile standard offender lists

The mobile standard keeps offender lists under `web/src/mobile-standard/offenders/`:

- `unreachable.json` lists screens the mobile walk cannot reach yet.
- The other lists, such as `touch-target.json`, list the real cells that fall short of a rule.

- **No growth (invariant 9).** The offender lists never grow, with one exception: the trade below.
- **The trade.** In the same change, a screen's `unreachable` entry is removed and its real cells are added to whichever offender lists they belong in.
  - Every added cell names the same screen as the removed entry's `screen`.
  - Only those cells count toward the trade.
- **Not a trade.** Any other growth breaks invariant 9:
  - cells for a screen whose `unreachable` entry stays;
  - cells naming a different screen from the one whose entry was removed.
- **No cap.** A reachable screen brings all its real cells, however many.
- **No offending cells.** A screen that becomes reachable with no offending cells just loses its `unreachable` entry.
- **Tracked like any other offender.** Traded cells are tracked like any other offender from then on. They are never hidden, never marked exempt, and never read as a regression.
- **Readable from the files.** The trade can be checked from the before and after offender files alone, by screen name, without the Developer's evidence notes.
- **No one-off exceptions.** No per-task exception is recorded for a screen becoming reachable. The CobroDesdeInicio exception of GH-271 is retired in favour of this rule.

## Metrics

There is no telemetry. These are read from the task's evidence and from review.

- **Shifted-date pass (time job, criterion 1):** a run more than 7 days ahead and across an Argentina midnight passes.
- **Real-clock tests accounted for (time job, criteria 2 and 5):** every test that depended on the real clock is listed with how it is now covered. None is left uncovered and none is deleted.
- **No behaviour change (time job, criterion 3):** the gate passes, and every edited test keeps its product assertions. Checked in review.
- **Gate stays fast (time job, criterion 4):** no new waiting and no elapsed-time assertions. Checked in review against ADR-0038 and ADR-0041.
- **Staying fixed:** the flagging mechanism is shown catching a deliberately added real-clock-dependent test.
- **Trade recognised (offender job, criteria 1 and 3):** four cases are shown, each with the expected verdict:
  - a valid trade passes;
  - an entry kept plus cells added fails;
  - cells naming another screen fail;
  - a screen made reachable with no cells passes.
- **Nothing hidden (offender job, criterion 2):** after a trade, every cell of the newly reachable screen is in the offender lists.
- **No one-off exceptions (offender job, criterion 3):** no per-task exception for a screen becoming reachable remains, CobroDesdeInicio's included.
- **Self-evident trade (offender job, criterion 4):** the reviewer confirms the trade from the offender-file diff alone.

## Out of scope

- Any product rule, screen, route, refusal or copy.
- Production code that legitimately reads the real clock.
- Repeating the shifted-date runs on every gate run.
- Timing assertions of any kind (ADR-0038).
- A cap on how many cells a reachable screen may bring.
- Changing the touch-target standard itself, or fixing the cells that become visible.
- Letting offender lists grow in any case other than the trade.
