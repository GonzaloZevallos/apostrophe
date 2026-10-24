# Phone first

The owner's product and design criteria (2026-10-21) as the roles apply them. This file records the job and how its success is measured. The rules themselves are written once, in the documents listed below, and this file holds no rule text: where they differ, those documents win.

## Jobs

- When a role builds, reviews or scopes a screen, I want it to apply my criteria (the drawing is a guide, the phone flow comes before polish, the user is a small-business owner on a phone with little time), so that the work goes into what that owner understands and does on the phone, and none of it goes into pixel differences that change neither.

Used at three moments:
- A designer or reviewer is about to open a "differs from the drawing" finding or issue.
- A task has to choose between getting the phone flow working and visual polish.
- The PM or Product Analyst is deciding scope or priority for a capability and has to weigh the phone against the computer.

## Where each criterion lives

- Drawing as guide (rule 1): `DESIGN_STANDARDS.md`.
- Phone first (rule 2): `DESIGN_STANDARDS.md`.
- The primary user (rule 3) and the priority line: `BRIEF.md`, "Problem and who has it".
- Icon and text rule, attention icon, tappable notice, design capture: `DESIGN_STANDARDS.md`, the authoritative copy.
- Mobile standard: `CODING_STANDARDS.md` §10 "Phone", pointed to from `DESIGN_STANDARDS.md`.
- Mobile check (phone rows, offender lists, growth conditions): `docs/product/mobile-check.md` and `docs/product/gate.md`.

## Rollout

- Until agentic-system#295 delivers `DESIGN_STANDARDS.md` to the design roles, `docs/product/icon-and-text-rule.md` and `docs/product/design-capture.md` stay as temporary copies.
  - Their rule text is unchanged, and each opens with a line naming `DESIGN_STANDARDS.md` as authoritative and saying the file is removed when #295 lands.
  - Any change to either rule is made in `DESIGN_STANDARDS.md` and copied identically into the temporary copy.
- Once #295 lands, a follow-up task deletes both copies and points every citation to `DESIGN_STANDARDS.md`.

## Success criteria

1. A difference from the drawing becomes a finding or an issue only when it changes what the person understands or does. A pixel or layout difference that changes neither opens nothing.
2. When a task has to choose, the phone flow works first. Polish is a separate, later task.
3. Each role reads these criteria in the document it already uses: `DESIGN_STANDARDS.md` for the design roles, `BRIEF.md` / `docs/product/` for product.
4. The design rules have one home in `DESIGN_STANDARDS.md`, with no copy left in `docs/product/` once the post-#295 follow-up merges. Glossary entries stay and point there.
5. Every open "differs from the drawing" follow-up, design-capture review follow-ups included, has been reviewed against rule 1. The ones it makes moot are closed with a note quoting rule 1. The PM decides borderline ones with the same test. The rest stay open.

## Metrics

- "Differs from the drawing" findings or issues opened after the criteria land that fail the rule 1 test: target 0.
- Tasks blocked, or shipped phone flows reopened, because of a polish gap: target 0.
- Polish tasks opened from a finding rather than scheduled by the owner or PM: target 0.
- Two checks, both true: `BRIEF.md` states the primary user and the priority line pointing to `DESIGN_STANDARDS.md`, and `DESIGN_STANDARDS.md` holds rules 1 and 2.
- While the temporary copies exist, differences between them and `DESIGN_STANDARDS.md`: 0.
- After the post-#295 follow-up merges:
  - Design rule text left in `docs/product/`: 0.
  - Broken links to the removed files, checked once when that follow-up merges: 0.
- Glossary entries still carrying moved rule text: 0.
- Share of open "differs from the drawing" follow-ups reviewed: 100%.
- Closed follow-ups carrying a note quoting rule 1: 100%.
- Borderline cases left undecided: 0.

## Out of scope

- Rewriting any moved rule.
- Changing the content of `gate.md`, `navigation.md` or `product-language.md`; only links to moved files are updated.
- Changing the Mobile check, its offender lists or their growth conditions.
- A standing check for citations of removed `docs/product/` files.
- Moving the mobile standard out of `CODING_STANDARDS.md` §10, or removing its duplicate in the design README.
- Reopening or removing existing computer-specific designs (ADR-0044).
- Scheduling any polish task.
- Any change to what the app does for a seller.
