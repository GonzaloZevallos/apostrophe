# Gate

The checks every change must pass before it merges (pytest, vitest and e2e; ADR-0039, ADR-0040, ADR-0041), as the maintainer and the agentic development system rely on them. This file holds what the gate itself must guarantee. It changes no product behaviour: no capability's rule, screen, route, refusal or message is defined here. Sellers and the operator see nothing of it; the operator gains only indirectly, from a gate they can trust.

## Jobs

**When** the gate goes red, **I want** (as the maintainer or the agent running it) that to mean something in the product broke, never that the calendar moved past an expiry or a day boundary, **so I can** fix real regressions inside the brief I'm working on instead of patching tests by hand in files nobody asked me to touch.

Before it, a test that depended on the real date (an invitation past its 7 days, a day boundary in Argentina) failed one day for no product reason, and it was patched case by case outside any brief (GH-142, commit e73ecf4).

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

## Metrics

No telemetry; read from the task's evidence and from review.

- **Shifted-date pass (criterion 1):** a run more than 7 days ahead and across an Argentina midnight passes.
- **Real-clock tests accounted for (criteria 2, 5):** every test that depended on the real clock is listed with how it is now covered. None is left uncovered and none is deleted.
- **No behaviour change (criterion 3):** the gate passes, and every edited test keeps its product assertions. Checked in review.
- **Gate stays fast (criterion 4):** no new waiting and no elapsed-time assertions. Checked in review against ADR-0038 and ADR-0041.
- **Staying fixed:** the flagging mechanism is shown catching a deliberately added real-clock-dependent test.

## Out of scope

- Any product rule, screen, route, refusal or copy.
- Production code that legitimately reads the real clock.
- Repeating the shifted-date runs on every gate run.
- Timing assertions of any kind (ADR-0038).
