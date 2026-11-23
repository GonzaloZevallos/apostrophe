---
status: draft
---
## Goal

After a seller saves a Sale from New sale, a 5-second notice "Sale to {name} saved · Undo" appears on the screen New sale returns to. One tap on Undo deletes that Sale with no confirmation, and the seller always sees how it ended. This lets a seller who just saved a wrong Sale take it back right there and record it again. The change is front only (`web/`) and is reachable only through NewSaleSheetHost until the New sale flip.

## Acceptance criteria

- After a Sale is saved through NewSaleSheetHost (host → Collect → save), "Sale to {name} saved · Undo" is on the destination screen at 4.9 s and gone at 5 s.
- The notice is armed with `armAfterLeaving` from `onSaved` before `leave()`, never raised with `showNow`.
- A Sale with no Customer shows the existing "No customer" Copy module text in place of the name.
- Only the Sale's id and name are held; a newer `announceSaved` call replaces the previous one.
- Undo calls `deleteSale` through a `useMutation` and `mutateAsync`, with no confirmation and no direct fetch. Outcomes are handled after the await.
- On success, the mounted Sales, Stock and Customer's account reads are fetched again, the `['sale-form','suggestions']` query is invalidated, and a "deleted" result notice shows.
- A 404 (`isGone`) shows the "gone" notice, a NetworkError shows "offline", any other refusal shows "failed", and a 401 shows nothing of its own.
- Each result notice shows after the 5 s and after the host has unmounted and the route has changed.
- Offline and failed notices carry the Attention icon and say the Sale is still saved and can be deleted from its detail in Sales; deleted and gone carry no Attention icon. No notice has a Retry action or a Sale name.
- With Home's panel query mounted, the panel fetch count does not change after Undo and a re-render, and rises by one after Home remounts. `keys.panel()` is never removed, invalidated or refetched.
- All new text lives in the Copy module, in English.
- `useUndoSale` is listed in `web/scripts/docs/front-exclude.json`.

## Out of scope

- Reopening New sale pre-filled with the deleted Sale.
- A Retry on a failed Undo.
- Any change to deleting from the Sale detail.
- Backend changes.
- Routing NewSaleSheetHost or removing the front-exclude entry.

## Decisions

- A successful Undo leaves a Home already on screen with its frozen figures; they refresh when Home opens again.
  - Reason: PM's rule from the interview, so figures never jump under the seller's eyes; measured by the panel fetch count.
- Result notices carry no Sale name.
  - Reason: the seller tapped Undo a moment before, so the name adds scope and buys nothing.
- Offline and failed point to deleting from the Sale detail instead of offering Retry.
  - Reason: the 5-second window is over and the Sale detail already has the delete.
- Undo follows exactly the same deletion rules as the Sale detail, including Credit, with no extra warning.
  - Reason: Undo is the same deletion, only faster.
- The hook is added to front-exclude until the New sale flip.
  - Reason: owner's rule D-62e6dc23.

## Risks

- User data deletion: Undo deletes a Sale and its On-the-spot payment with no confirmation. The only guards are the 5-second window and holding only the last saved id.
- Drawing check unverified: no approved drawing was compared. If a drawing shows another confirmation after saving, the owner decides.

## Screens

The screens come from the design stage.

## Slices

### undo-saved-sale

#### Acceptance criteria

- The saved toast is armed before leaving, shows on the destination, and is present at 4.9 s and gone at 5 s.
- Undo deletes through `deleteSale` with no confirmation and shows deleted, gone, offline or failed (nothing for a 401), even after the host has unmounted.
- After success, the Sales, Stock, Customer's account and suggestions reads are refreshed and the panel fetch count does not move until Home remounts.
- The hook is listed in `web/scripts/docs/front-exclude.json`, and all new text is in the Copy module.

#### Risks

- user-data-deletion
