# Design standards

The criteria the design roles apply to every screen, and the design rules they work to. This file holds the owner's four criteria and the rules that stay, in full; the Icon and text rule and Design capture are given in full in `docs/product/icon-and-text-rule.md` and `docs/product/design-capture.md`, and their sections below are the entry point. `docs/product/` and the ADRs win over a drawing: where a drawing and a written definition differ, the written definition governs.

## The owner's four criteria

The owner's four product and design criteria. Each one's full text lives where it is listed.

1. Drawing as guide: `DESIGN_STANDARDS.md`, "Drawing as guide".
2. Phone first: `DESIGN_STANDARDS.md`, "Phone first".
3. The primary user, with the priority line: `BRIEF.md`, "Problem and who has it".
4. Assume nothing: `DESIGN_STANDARDS.md`, "Assume nothing", with its test also in `BRIEF.md`.

## Drawing as guide

The drawing is a guide, not an exact spec. A difference from the drawing is fixed only when it changes what the person understands or does. A pixel or layout difference that changes neither is not a finding and opens no issue.

- A difference from the drawing is a finding only if the owner, on the phone, would read or do something differently. That covers:
  - a change of meaning (wording, label or icon);
  - a control, step or field that is missing, extra or reordered;
  - a figure or state that is hidden or shown differently;
  - a tap target too small.
- Colour, contrast and size count only when they carry meaning or legibility. A status told by colour alone breaks the Stock status rule, and text the owner can no longer read on the phone also counts. Otherwise, colour shade and font weight do not count.
- A difference that breaks a written rule (the icon and text rule, the attention icon, the mobile standard) is a finding against that rule, not against the drawing.
- `docs/product/` and the ADRs win over a drawing. A difference from the drawing alone is never a finding. A difference from the written definition always is.
- A product decision held only in a drawing (fixed copy, the order of a flow) binds only once it is written into `docs/product/`. Until then it is a guide like the rest of the drawing.
- Tie-breaker: "would the owner, on the phone, read or do something differently?" If not, it is not a finding.

## Phone first

Working on the phone comes before polish. When a choice is needed, the flow working on the phone ships first; visual polish is a later, separate task.

- "Working on the phone" means three things:
  - the flow can be completed on a phone-sized screen;
  - touch targets meet the mobile standard;
  - the gate is green, Mobile check included.
- Polish is never opened from a finding. It becomes a separate task only when the owner or PM chooses to schedule it.
- A polish gap never blocks a task and never reopens a phone flow that has shipped.

## Assume nothing

The owner's fourth criterion: the app never hard-codes one business's way of working. Each business runs it its own way, through settings with neutral defaults.

- The owner's examples are product type, units, currency, payment methods, pricing rules, channels, and so on. The list is open, so "it isn't on the list" is never a defence.
- A label, unit, field, option list or default drawn as fixed, as the only choice for every business, is a finding. A default that fits only one business is the same finding as a fixed word on screen.
- There are no ready-made business-type presets.
- Sample data and a seller's own data are not findings, for example a variety called "Blue Dream", 3.5 g in a drawing, or a seller's header text.
- Criterion 4 applies to new scoping, design and review. It does not reclassify what exists. Choices already written down are existing assumptions, not findings against new work that follows them: the brief's constraints, the formats and inputs in `CODING_STANDARDS.md` §10, the ADRs and `docs/product/`. #330 sweeps them and #318 makes them customizable.
- New work extends an existing choice when it reuses, unchanged, a word, unit or option list that `CONTEXT.md`, `BRIEF.md` or the code already fixes for every business (for example a new field in grams or whole pesos, or another "cash or transfer" choice). That finding is recorded as a review comment linking #330 (and #318 when the customizable model is what is missing), and the change merges; it does not wait for the sweep.
- Anything the new work adds to or changes in such a choice (a further fixed option, a new unit next to grams), or that appears in none of `CONTEXT.md`, `BRIEF.md` or the code, is the new work's own assumption. Its finding blocks the merge like any finding: before merge, the choice becomes a setting with a neutral default, or the PM rules it borderline and decides with criterion 4's test.
- When the reviewer cannot tell which case applies, they ask the PM before merge, and the PM decides.
- It works alongside "Drawing as guide" and does not reopen it.
- Test: Would this still be right for a business that sells something else, in other units, other ways? If not, it is a finding.

## Icon and text rule

How every screen labels its entries, actions and notices: which controls are icon-only, which are text only and which are icon + text; how long an always-visible line may be; and what may move behind More info. It decides how things are labelled, never what they do.

The full rule, including the attention icon and the tappable notice, is `docs/product/icon-and-text-rule.md`.

## Design capture

The evidence a reviewer uses to judge that a screen looks as designed: the design file and the built app are captured side by side from the screens registry (`scripts/design/screens.json`), with pinned fonts, by `scripts/design/comparisons.mjs`, and when a change needs a before/after pair, the raw captures are compared by exact AE with `scripts/design/ae.mjs` (ADR-0042). It is review evidence attached to a PR and judged by eye; it is never a step of the gate (docs/product/gate.md).

The full text is `docs/product/design-capture.md`.

## Mobile standard

This section is a pointer and holds none of the standard's requirements.

- The mobile standard is `CODING_STANDARDS.md` §10 "Phone", the one authoritative text. The design README's "En el celular" restates it; where the two differ, §10 wins.
- §10's requirements and checks are written rules, not differences from a drawing, so the test in "Drawing as guide" never exempts them.
- The Mobile check itself is in `docs/product/mobile-check.md` and `docs/product/gate.md`.
