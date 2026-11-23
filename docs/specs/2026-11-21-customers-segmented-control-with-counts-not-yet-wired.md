---
status: draft
---
## Goal

Build the Customers segmented control ("All | Owed to you", with the count of each segment) as a finished, tested front-end component that is not yet on any screen. It serves the seller who opens Customers on the phone to chase what they're owed: they switch in one tap between all customers and the debtors, and see how many are in each. #934 wires the control into the Customers screen. Nothing changes for the seller until then.

## Acceptance criteria

- `SegmentedChoice` accepts an optional `suffix`. With a suffix, the option's accessible name stays its Fixed-set label and the visible count is linked by `aria-describedby`. Without a suffix, its markup is unchanged, and a test proves it.
- `segmentCount(n)` in `web/src/format/counts.ts` returns the count as `· 1.234`, with the Argentine thousands dot. It is covered by unit tests.
- `web/src/screens/clientes/CustomerSegments.tsx` is the only drawer of the control.
  - Its options come from `CUSTOMER_SEGMENTS`, never an inline array.
  - Its props are `segment`, `onChange`, `customerCount`, `debtorCount` and `pending`.
- The radios are named exactly "All" and "Owed to you". The group is named "Customers view", from a copy key in `web/src/copy/customers.ts`, with `en-XA` and `en.baseline.json` regenerated.
- Each count's accessible description is exactly the number, without the "·". The "·" is hidden from assistive technology.
- A real 0 is shown as `· 0`.
- While `pending`, only the two labels show: no digit, no "·", no description, no skeleton.
- Both options are always enabled and switch the segment, with a count of 0 and while `pending`.
- Each option is at least 44 px high, with `user-select: none` and `touch-action: manipulation`.
- The options share the width equally. Label and count may wrap inside their own option. Nothing has an ellipsis or `nowrap`, and the count is never dropped.
- The count uses the label's text style in Tabular figures. The selected state marks the whole option without restyling the count.
- No colour is written as a hex value, and every state-colour selector has its `colorCensus.ts` entry.
- No TypeScript divides, sums, rounds or compares a count beyond formatting it.
- The component is listed in `web/scripts/docs/front-exclude.json`.
- `docs/api/**` and `docs/architecture/**` are unchanged.
- CI `ci-ok` is green.

## Out of scope

- Wiring the control into the Customers screen (#934).
- What happens to the existing "Owed to you" section of Customers (#934).
- What the empty debtor list says (#934).
- Passing `pending` when the counts fail to load (#934).
- Any backend change: the counts already exist on master (#943).
- Any error state of its own in the control.
- Disabling or hiding an option for any reason.

## Decisions

- A count of 0 never disables or hides an option, and neither does `pending`.
  - Reason: a 0 is a real answer ("nobody owes me"), and a disabled option reads as broken.
- Switching works while the counts are pending.
  - Reason: Phone first; a seller on a slow connection picks the view at once, and the count never gates the tap.
- At narrow widths the two options keep equal widths. Label and count wrap inside their own option, with no ellipsis and no dropped count. D-8ecb8c1d does not apply.
  - Reason: the job is to see how many before tapping, and D-8ecb8c1d covers title-row actions, not a two-option choice.
- The count looks like the label, in Tabular figures, and the selected state does not restyle it separately.
  - Reason: it is a number read across a row, and there is no approved drawing calling for a quieter style.
- A screen reader reads only the number as the option's description, never the "·", and never as part of the name.
  - Reason: the option names must stay exactly "All" and "Owed to you", and the dot is decoration.
- Unavailable counts after a load error look exactly like `pending`. The component has no error prop, and its drawer passes `pending`.
  - Reason: a wrong "0" would mislead, and one gate keeps the component simple.
- The debtor count is the number of Customers with a Balance above $0, taken from the server.
  - Reason: same rule as Total owed (Credits never count), and the phone never computes figures.

## Risks

- `SegmentedChoice` is shared, so a change to its markup without `suffix` could break other screens and e2e landmarks. The no-suffix rendering must stay identical.
- If the `aria-describedby` target includes the "·", screen readers announce the dot. The number and the dot must be in separate elements.
- Narrow-width wrapping and `en-XA` stretching cannot be checked by the Mobile check until #934 wires the control into a screen.
- No approved drawing of the control with counts exists. A later drawing could ask for a different count style or narrow-width treatment, which the owner would decide.

## Screens

The screens come from the design stage. This task wires the control into no screen and changes no screen image.

## Slices

### customer-segments-control

#### Acceptance criteria

- `SegmentedChoice` gains an optional `suffix` linked by `aria-describedby`. Without it, its markup is unchanged.
- `segmentCount(n)` formats `· 1.234`.
- `CustomerSegments.tsx` draws "All" and "Owed to you" from `CUSTOMER_SEGMENTS` inside the group "Customers view", with the props `segment`, `onChange`, `customerCount`, `debtorCount` and `pending`.
- The counts are described as the number only. A real 0 shows as `· 0`. While `pending` there is no digit and no "·". Both options are always enabled.
- Options are at least 44 px high, with `user-select: none` and `touch-action: manipulation`, equal width and wrapping allowed.
- The copy key is added, and `en-XA` and `en.baseline.json` are regenerated.
- The component is listed in `web/scripts/docs/front-exclude.json`.
- Testing Library unit tests cover all of the above, and `ci-ok` is green.

#### Risks

- segmentedchoice-shared-markup
- describedby-reads-dot
- narrow-width-unchecked-until-wired