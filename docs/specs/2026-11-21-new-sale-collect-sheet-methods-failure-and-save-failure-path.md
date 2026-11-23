---
status: draft
---
## Goal

This part adds the failure paths of the Collect Sheet (`web/src/screens/ventas/CollectSheet.tsx`), the closing step of New sale. It covers two failures: the payment methods list does not load, or the save does not go through. In both cases the seller sees in plain words what happened and finishes with one more tap, with the lines and the chosen method intact. A failed save never looks like a success. The Sheet stays unrouted until the flip part of GH-496.

## Acceptance criteria

- When the methods read fails, by server error or offline, the Selector shows its own failure line and reloads on tap. The Sheet adds no text of its own, and Collect stays enabled.
- When the methods read has failed, a $0 sale with no method saves with payment null.
- When the methods read has failed, tapping Collect on a sale above $0 shows "Choose how they pay to collect." with the Attention icon, sends 0 requests and moves focus to the Selector.
- Every save failure calls `onSavingChange(false)`.
- A 401 on save is left to the session boundary, and the Sheet shows no text of its own.
- The 404 `payment_method.unavailable` keeps the chosen method with its name and the "no longer available" mark, and invalidates `keys.paymentMethods()`.
- After that refusal, the method counts as no method. Above $0, the next Collect tap sends 0 requests and moves focus to the Selector. At $0, it saves with payment null.
- Every other save failure shows "The sale was not saved. Your lines are kept, so try again." above Collect, with the Attention icon and the alert role. The API's `detail` is never shown.
- After any failure, the lines and the method are kept, one tap on Collect makes exactly one more request, Close works again, and focus is on Collect.
- The "not saved" text clears when a retry starts, when another method is picked, or when a save succeeds. It never clears on a timer.
- The save-failed text is one new English key in `SALES_TEXT` (`web/src/copy/`).
- The Sheet still has no route, navigation entry, `screens.json` row or `WalkState`. The same eight invariants as #918 hold, and vitest passes.

## Out of scope

- Routing the Sheet or wiring it into any screen (the flip part of GH-496).
- Specific texts for refusals other than the method one, and handing them back to the host form.
- Any change to the Selector, `usePaymentMethodOptions`, the Attention icon or the Icon and text rule.
- Protection against recording a sale twice when the response was lost (server work).
- The "Owes it" option (#944).
- A new drawing for the failure states.

## Decisions

- An offline methods read is treated the same as a server-error read: Collect stays enabled and the Sheet shows no offline notice.
  - Reason: otherwise an offline read could block a $0 sale, against the settled criterion that a failed list never blocks it, and the PM decided the Sheet adds no text of its own.
- After the method refusal, focus returns to Collect, and the next Collect tap moves focus to the Selector.
  - Reason: this reconciles "focus stays on Collect after a failure" with "a method that is no longer offered moves focus to the Selector on Collect" without dropping either decision.
- "A failed save leaves no recorded sale behind" applies only to failures the front sees.
  - Reason: a response lost after the server saved the sale is the known double-record gap, which needs server work and stays outside this part.

## Risks

- A failure the retry cannot fix, such as a future date, still says "try again". The seller has to Close and fix it in the host form.
- The double-record gap remains: if the server saved the sale and the response was lost, a retry records the sale twice. It must be fixed before the flip.
- `usePaymentMethodOptions` may keep the field loading while offline. Making the Sheet treat that as a failure must not change New sale or Record payment.

## Screens

The Sheet is unrouted, so this part has no screen image. The look of the failure states comes from the design stage and from the shared components (Selector, Attention icon).

## Slices

### collect-sheet-failure-paths

#### Acceptance criteria

- When the methods read fails, by server error or offline, a $0 sale saves with payment null. Above $0, the no-method text shows with 0 requests and focus on the Selector.
- After a save failure, the lines and the method are kept, the "not saved" text shows with the alert role, a retry makes exactly one more request and clears the text, and Close works again.
- After the method-archived refusal, the "no longer available" mark shows, the methods list is read again, and the next Collect tap above $0 sends 0 requests.
- A 401 shows no Sheet text.
- Picking another method clears the "not saved" text.
- One new English copy key is added to `SALES_TEXT`, and the Sheet stays unrouted.

#### Risks

- offline-methods-read-stays-loading
- double-record-on-lost-response
