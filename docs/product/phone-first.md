# Phone first

The owner's product and design criteria (2026-10-21; the fourth, Assume nothing, added 2026-10-23) as the roles apply them. This file records the jobs and how their success is measured. The rules themselves are written once, in the documents listed below, and this file holds no rule text: where they differ, those documents win.

## Jobs

- When a role builds, reviews or scopes a screen, I want it to apply my criteria (the drawing is a guide, the phone flow comes before polish, the user is a small-business owner on a phone with little time, and nothing about the business is assumed), so that the work goes into what that owner understands and does on the phone, and none of it goes into pixel differences that change neither.
- When I scope, draw or review something that names what a business sells, how it measures it, its currency, how it gets paid, how it prices or which channels it uses, I want one test to tell this seller's way of working from the product's: "would this still be right for a business that sells something else, in other units, other ways?" If not, it is a finding. Then I keep the choice as a setting with a neutral default, never as a fixed rule or a business-type preset.

Used at four moments:
- A designer or reviewer is about to open a "differs from the drawing" finding or issue.
- A task has to choose between getting the phone flow working and visual polish.
- The PM or Product Analyst is deciding scope or priority for a capability and has to weigh the phone against the computer.
- A role is about to write down a word, unit, field, option list or default for a business: a PRD line, a screen label, a review comment, or the PM deciding a default.

## Where each criterion lives

- Drawing as guide (rule 1): `DESIGN_STANDARDS.md`.
- Phone first (rule 2): `DESIGN_STANDARDS.md`.
- The primary user (rule 3) and the priority line: `BRIEF.md`, "Problem and who has it".
- Assume nothing (criterion 4): `DESIGN_STANDARDS.md`, section "Assume nothing", and `BRIEF.md`, next to the primary user and the priority line. Both state its test in identical wording. The PM decides borderline findings with criterion 4's test, as for rule 1. The owner is asked only when the PM cannot tell whether a choice belongs to the business or to the product.
- Icon and text rule, attention icon, tappable notice, design capture: `DESIGN_STANDARDS.md`, the authoritative copy.
- Mobile standard: `CODING_STANDARDS.md` §10 "Phone", pointed to from `DESIGN_STANDARDS.md`.
- Mobile check (phone rows, offender lists, growth conditions): `docs/product/mobile-check.md` and `docs/product/gate.md`.

## Rollout

- Until agentic-system#295 delivers `DESIGN_STANDARDS.md` to the design roles, `docs/product/icon-and-text-rule.md` and `docs/product/design-capture.md` stay as temporary copies.
  - Their rule text is unchanged, and each opens with a line naming `DESIGN_STANDARDS.md` as authoritative and saying the file is removed when #295 lands.
  - Any change to either rule is made in `DESIGN_STANDARDS.md` and copied identically into the temporary copy.
- Once #295 lands, a follow-up task deletes both copies and points every citation to `DESIGN_STANDARDS.md`.
- Criterion 4 applies to new scoping, design and review. It does not reclassify what exists: the brief's current constraints describe where the first businesses start, the existing assumptions are swept in #330, and the customizable model is #318. When new work extends an existing hard-coded choice, the test applies to the new part only. The finding is recorded and does not block on #330.

## Success criteria

1. A difference from the drawing becomes a finding or an issue only when it changes what the person understands or does. A pixel or layout difference that changes neither opens nothing.
2. When a task has to choose, the phone flow works first. Polish is a separate, later task.
3. Each role reads these criteria in the document it already uses: `DESIGN_STANDARDS.md` for the design roles, `BRIEF.md` / `docs/product/` for product.
4. The design rules have one home in `DESIGN_STANDARDS.md`, with no copy left in `docs/product/` once the post-#295 follow-up merges. Glossary entries stay and point there.
5. Every open "differs from the drawing" follow-up, design-capture review follow-ups included, has been reviewed against rule 1. The ones it makes moot are closed with a note quoting rule 1. The PM decides borderline ones with the same test. The rest stay open.
6. The four criteria read together, in the same order and with the same numbers, in `BRIEF.md` and `DESIGN_STANDARDS.md`. Criterion 4's test is stated in both with its verdict, and a role can apply it to a concrete case (product type, units, currency, payment methods, pricing rules, channels, and so on) without asking the PM.

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
- Criterion 4's test reads identically in `BRIEF.md` and `DESIGN_STANDARDS.md`: true.
- Wording in `BRIEF.md`, `DESIGN_STANDARDS.md`, `CONTEXT.md` or this file that presents the brief's current constraints as rules for new work: 0.
- New PRDs, designs or reviews after criterion 4 lands that fix a word, unit, field, option list or default for every business without a finding: target 0.
- Ready-made business-type presets introduced: 0.

## Out of scope

- Rewriting any moved rule.
- Changing the content of `gate.md`, `navigation.md` or `product-language.md`; only links to moved files are updated.
- Changing the Mobile check, its offender lists or their growth conditions.
- A standing check for citations of removed `docs/product/` files.
- Moving the mobile standard out of `CODING_STANDARDS.md` §10, or removing its duplicate in the design README.
- Reopening or removing existing computer-specific designs (ADR-0044).
- Scheduling any polish task.
- Any change to what the app does for a seller.
- Editing the brief's constraint lines, the sweep of existing assumptions (#330) and the customizable model (#318).
