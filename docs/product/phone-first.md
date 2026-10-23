# Phone first

The owner's product and design criteria (2026-10-21) as the roles apply them. This file records the job and how its success is measured; the rules themselves are written once, in `DESIGN_STANDARDS.md` (Drawing as guide, Phone first) and `BRIEF.md` (the primary user and the priority line). This file holds no rule text.

## Jobs

- When a role builds, reviews or scopes a screen, I want it to apply my criteria (the drawing is a guide, the phone flow comes before polish, the user is a small-business owner on a phone with little time), so that the work goes into what that owner understands and does on the phone, and none of it goes into pixel differences that change neither.

Used at three moments:
- A designer or reviewer is about to open a "differs from the drawing" finding or issue.
- A task has to choose between getting the phone flow working and visual polish.
- The PM or Product Analyst is deciding scope or priority for a capability and has to weigh the phone against the computer.

## Where each criterion lives

- **Drawing as guide** (rule 1): `DESIGN_STANDARDS.md`, including the test of what counts as a finding. `docs/product/` and the ADRs win over a drawing; a decision held only in a drawing binds once it is written into `docs/product/`.
- **Phone first** (rule 2): `DESIGN_STANDARDS.md`. Working on the phone means the flow can be completed on a phone-sized screen, touch targets meet the mobile standard, and the gate is green, Mobile check included. Polish is never opened from a finding; it is a task only when the owner or PM schedules it, and it never blocks a task or reopens a shipped phone flow.
- **The primary user** (rule 3): `BRIEF.md`, "Problem and who has it": the owner of a small business, working from the phone with little time. The computer keeps every capability but gets no dedicated polish; a computer-only refinement is never scoped ahead of a phone need and never justifies a phone compromise. Existing computer-specific designs stay (ADR-0044's price-form modal is applied as written).
- **Design rules**: the icon and text rule (with the attention icon and tappable notice), the design capture and the mobile standard live in `DESIGN_STANDARDS.md`. `docs/product/mobile-check.md` keeps only the Mobile check itself (phone rows, offender lists, growth conditions with `gate.md`).

## Success criteria

1. A difference from the drawing becomes a finding or an issue only when it changes what the person understands or does. A pixel or layout difference that changes neither opens nothing.
2. When a task has to choose, the phone flow works first. Polish is a separate, later task.
3. Each role reads these criteria in the document it already uses: `DESIGN_STANDARDS.md` for the design roles, `BRIEF.md` / `docs/product/` for product.
4. The design rules have one home in `DESIGN_STANDARDS.md`, with no copy left in `docs/product/`; glossary entries stay and point there.
5. Every open "differs from the drawing" follow-up (design-capture review follow-ups included) has been reviewed against rule 1: the ones it makes moot are closed with a note quoting rule 1, borderline ones are decided by the PM with the same test, the rest stay open.

## Metrics

- Findings or issues of type "differs from the drawing" opened after the criteria land that fail the rule 1 test: target 0.
- Tasks blocked, or shipped phone flows reopened, because of a polish gap: target 0. Polish tasks opened from a finding rather than scheduled by the owner or PM: target 0.
- `BRIEF.md` states the primary user and the priority line pointing to `DESIGN_STANDARDS.md`, and `DESIGN_STANDARDS.md` holds rules 1 and 2: both true.
- Design rule text left in `docs/product/`: 0. Broken links to moved files: 0. Glossary entries still carrying moved rule text: 0.
- Share of open "differs from the drawing" follow-ups reviewed: 100%. Closed ones carrying a note quoting rule 1: 100%. Borderline cases left undecided: 0.

## Out of scope

- Rewriting any moved rule; changing the content of `gate.md`, `navigation.md` or `product-language.md` (link updates only); changing the Mobile check, its offender lists or their growth conditions.
- Reopening or removing existing computer-specific designs (ADR-0044).
- Scheduling any polish task; any change to what the app does for a seller.
