---
status: draft
---
## Goal

On the Add expense form, a seller recording an expense from the phone sees, right under the amount, which rule the number breaks: more decimals than the Business uses, or not more than zero. Save stays disabled while the amount is wrong, as set by the human's decision 1 in part 2 of GH-839. The seller can fix the number in one go and save, so the Expense counts in Profit and Cash. Add and Edit are one form and behave the same. The computer gets the same sentences with no dedicated polish.

## Acceptance criteria

- Save is disabled while the amount is empty, unreadable, not more than zero, or has more decimals than the Business's Money format allows. The existing Save rules (category chosen, not sending, no rejected Payment method pending) do not change.
- While Save is disabled, tapping it sends no request. Save is enabled again as soon as the amount is valid and no other rule blocks it.
- An empty amount shows no reason, before or after leaving the field, and the button reads "Save expense".
- A value with more decimals than the Money format allows shows the too-many-decimals sentence from tooManyDecimalsMessage(money.format) under the field, live, without leaving the field. It wins over the above-zero reason.
- After the seller leaves the field, any other non-empty value that is not a positive amount (0, "-5", "abc", "1.2.3") shows the new expenses:form.amountAboveZero sentence, "The amount must be more than" followed by money.format(0).
- "1," while the field has focus shows nothing.
- The reason clears as soon as the value becomes valid.
- The generic footer refusal is no longer used for the amount.
- A server refusal of the amount shows its sentence under the field until the value changes. Then the live rule takes over.
- Edit opens with no reason shown.
- No sentence is reused for a different rule, and no sentence hard-codes "$" or 0 decimals: both follow the Money format.
- One reason element under the field uses the existing campo__error style and placement. No new border, colour or Attention icon.
- The reason is the amount input's accessible description. aria-invalid is set only while a reason shows.
- The reason is announced when it first appears and when it changes to another rule's sentence, never on a keystroke that keeps the same sentence.
- The sentence is never cut at phone width, including in en-XA. It may wrap, is brought into view if covered, and is never a More info line.
- expenses:form.amountAboveZero exists in the Copy module with the Tech Writer's text, in en, en-XA and the baseline.
- ExpenseTooManyDecimals.test.tsx types the value, reads the reason live and checks that Save is disabled instead of tapping it.
- The Testing Library cases pass on Add and on Edit, at 0 and 2 decimals and with another currency symbol.
- The Mobile check passes on the form's phone rows with no new offenders.

## Out of scope

- Other fields of the form and other forms (parts 1 and 3 of GH-839).
- Changing the other Save rules or the Save label rule.
- Any new invalid look on the field (border, colour or icon), which the owner decides; an Attention icon on the reason; a More info line for the reason.
- A new rule for reading an amount.
- Measuring abandoned forms.

## Decisions

- The amount disables Save in this task, on top of the existing Save rules.
  - Reason: the human's decision 1 in part 2 of GH-839 moved this to #1164, and #1133 hands it over rather than deciding it.
- Negative and unreadable values show the same amountAboveZero sentence as 0, under the field, and the generic footer is no longer used for the amount.
  - Reason: one rule gets one sentence in one place, and "must be more than zero" is true and fixable for every such value.
- When a value breaks both rules, the too-many-decimals reason wins.
  - Reason: it is the rule the seller can fix directly, and showing one reason keeps the invariant clear.
- An empty amount only disables Save and never shows a reason.
  - Reason: the request says an empty field shows nothing, and an empty field is not a mistake to correct.
- A server refusal of the amount stays only until the value changes.
  - Reason: the sentence under the field must always describe the current value, never a stale one.
- Add and Edit behave the same, and Edit opens with no reason.
  - Reason: they are one component, and nothing should complain about a field the seller has not touched.
- The reason is announced once per change of rule, not on every keystroke.
  - Reason: a live reason announced on every key would interrupt a screen reader while the seller types.
- The reason reuses the existing campo__error style, with no new mark on the field.
  - Reason: any new invalid look is a visible departure from the drawing that the owner decides.

## Risks

The client's decimals and readability check could disagree with the server's and accept or reject a value differently. It must use the same Money format reading, and the server refusal stays as the backstop.
The current role="alert" on the amount error would announce on every keystroke if kept as is.
E2e specs or helpers that tap Save with a bad amount to reach a reason will break. They must be migrated in the same task, never by re-enabling Save (D-69509906).
No one has checked the visible behaviour against the approved drawing.

## Screens

The screens come from the design stage.

## Slices

### expense-amount-reasons

#### Acceptance criteria

- Save is disabled for an empty, unreadable, not-above-zero or too-many-decimals amount, with the existing Save rules unchanged, and sends no request while disabled.
- Too many decimals shows the tooManyDecimalsMessage(money.format) sentence live and wins over the above-zero reason. Any other non-empty, non-positive or unreadable value shows the expenses:form.amountAboveZero sentence with money.format(0) after the seller leaves the field. An empty field and "1," while focused show nothing.
- The reason clears when the value is valid, a server refusal clears when the value changes, and Edit opens with no reason.
- One campo__error element is the input's description, aria-invalid is set only while a reason shows, and the reason is announced once per change of rule.
- The new key is in en, en-XA and the baseline. ExpenseTooManyDecimals.test.tsx is updated. The Testing Library cases pass on Add and Edit, at 0 and 2 decimals and with another symbol. The Mobile check has no new offenders.

#### Risks

- client-server-amount-parity
- screen-reader-announcement-per-keystroke
- e2e-locators-tapping-save
