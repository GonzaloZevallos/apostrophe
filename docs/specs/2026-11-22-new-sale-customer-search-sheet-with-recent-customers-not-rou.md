---
status: draft
---
## Goal
Deliver the New sale customer search Sheet (`web/src/screens/ventas/CustomerSearchSheet.tsx`), built from the drawing NuevaVentaCliente and its dark twin. It is for the seller recording a sale on the phone. The seller can pick a recent customer with one tap, or find one by a few letters of the name (accents ignored) or digits of the phone. The seller can also create a customer from the query, or continue without one, without losing the lines in the sale. The component is not routed: nothing mounts it until the flip part of GH-496.

## Acceptance criteria
- `CustomerSearchSheet.tsx` is a default export with props `onChoose(customer)`, `onContinueWithout()`, `onCreate(query)` and `recent: { status; ids }`, and no level prop.
- The level comes from `useContext(SheetLevel)`, Close uses `useSheet(level + 1)`, and the content is wrapped in `SheetLevel.Provider value={level + 1}` and is inert while a level above is open.
- The header shows the title "Customer", "Close", the Sheet name "Choose a customer" and the hint "Search by name or phone, with or without accents.".
- The search field is focused on open, `type=search`, `autocomplete=off`, `enterkeyhint=search`, with no `inputmode`, a font of at least 16px, and a search key that never chooses anyone.
- With an empty query, the heading "Recent customers" and up to `RECENT_ROWS` rows show, unresolved ids are dropped before the limit, and nothing shows when none resolve.
- With a typed query, matches show with no heading, ordered and highlighted by `web/src/sales/customerSearch.ts`, with a `<mark>` styled from tokens.
- A row shows the name plus the grouped Phone number on a second line only when the customer has one, with the phone highlighted when its digits matched, and no Balance, Owing since, Customer type or VIP mark.
- No row carries `aria-selected` or a selected style.
- "Create «query»" (accessible name "Create customer query") shows only with a non-blank query, below the matches and even on an exact name match. It raises `onCreate(query)` without closing the Sheet and cuts a long query with an ellipsis.
- "No customer" (accessible name "Continue without a customer") shows last in every state and raises `onContinueWithout()`.
- While loading, `RECENT_ROWS` skeleton rows show under `aria-busy` (name "Loading customers") until both the customers read and `recent` are ready.
- With no match, "No customer matches «query»." shows with no icon.
- A failed customers read shows "Customers did not load." with the Attention icon and "Try again", replacing the rows only. A failed suggestions read only means no recent rows.
- The customers read uses `keys.saleFormCustomers()` with `listCustomers('')`, `gcTime: 0`, `staleTime: Infinity` and `refetchOnMount: true`, with no refetch on focus or reconnect.
- Every text is in `web/src/copy/sales.ts`, in English, registered and measured with `SAMPLES.name`, and the component has no literal text or hex.
- The Sheet does not import `NuevaVentaCliente.tsx`, `keys.saleFormCustomerSearch`, `useSaleDraft` or `saleDraft.ts`, and none of the files listed as untouched are modified.
- `CustomerSearchSheet.test.tsx` covers every listed case and passes in the vitest job.

## Out of scope
- Mounting the Sheet from any route or navigation entry; that is the flip part of GH-496.
- How a customer saved from Create comes back into the sale.
- The re-pricing note.
- Any change to `NuevaVentaCliente.tsx`, `NuevaVenta.tsx`, `useSaleDraft`, `saleDraft.ts`, `keys.saleFormCustomerSearch`, `placeholders.ts`, `emptyStates.ts`, WalkState or `screens.json`.

## Decisions
- A row shows the name plus the grouped Phone number on a second line, and nothing about debt or Customer type.
  - Reason: the job is to identify the right person; the phone tells same-named people apart, and debt is shown by the sale form after the choice.
- "Create «query»" still shows when the query exactly matches an existing name.
  - Reason: two different people can share a name, and the existing match is shown right above it.
- The search key only closes the on-screen keyboard and never chooses a customer.
  - Reason: a silent wrong pick attaches the sale to the wrong account, the costly mistake this job prevents.
- "No customer" is the last item of the scrolling list, after Create, in every state.
  - Reason: it follows the job's order (find them, else create them, else go on without a customer).
- The phone highlight range fits the grouped string that is shown and comes only from `customerSearch.ts`.
  - Reason: invariant 3 forbids applying an index from another form of the string.

## Risks
The drawing NuevaVentaCliente was not checked during the interview, so the row contents, Create on an exact match and the position of No customer may differ from it; any difference is raised as a departure for the owner.
`customerSearch.ts` from part 1 may give phone ranges only on the stored form, which would need a mapping added there.

## Screens
The screens come from the design stage (NuevaVentaCliente and its dark twin); the Sheet is not routed and has no screen registry entry.

## Slices
### customer-search-sheet
#### Acceptance criteria
- `CustomerSearchSheet.tsx` and its copy are delivered with the behaviour, states and contract above, and no route mounts the component.
- `CustomerSearchSheet.test.tsx` covers the accent-insensitive match with highlight, the recent list with an unresolved id skipped, skeletons while recent loads, no match, failure and Try again, continue without a customer, choosing sets the draft customer, Close and back keep the lines, the query surviving Create and resetting on reopen, invalidating 'customers' triggering no request, a reopening reading a fresh vip, and the input attributes, and it passes in the vitest job.
#### Risks
- drawing-unverified-row-and-order
- phone-highlight-on-grouped-number
