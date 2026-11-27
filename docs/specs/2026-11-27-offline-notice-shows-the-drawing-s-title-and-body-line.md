---
status: draft
---
## Goal

The seller's phone sometimes can't reach the server. When that happens, the offline notice tells them plainly that they are offline and that the app needs a connection, so they know the signal is the problem, not the app. The notice shows a title and a body line from the 'Sin conexión' state of `Estados.dc.html`. It is identical in the global banner and in the inline notice after a failed request. This is part 1 of 2 of GH-1073.

## Acceptance criteria

- `common:offline` reads "You're offline" and the new `common:offlineDetail` reads "apostrophe needs a connection.", with "apostrophe" in lowercase.
- `SIN_CONEXION_MENSAJE` in `web/src/copy/common.ts` equals the new title.
- `en.baseline.json` and `baselineKeys/common.json` pass the copy baseline checks.
- Inside `AvisoAmbar`, `SinConexion` renders `span.aviso-ambar__titulo` with the title and `span.aviso-ambar__detalle` with the body, with the Attention icon, role=status and tokens only, in light and dark.
- The global banner and the inline notice after a failed request show the same two lines.
- The four `EstadosSinConexion*` rows in `scripts/design/screens.json` wait on "You're offline".
- "Offline: check your internet and try again." appears nowhere in `web/` or `scripts/design/`.
- `Estados.test.tsx` asserts the title and the body.
- `NuevaVentaProductos.test.tsx` and `ClienteForm.test.tsx` read the key instead of a hard-coded sentence.
- Tests that use the key or the constant pass unchanged.
- The mobile e2e project shows no new offender, and no offender list grows.
- In `docs/product/accounts.md`, "No connection" becomes "You're offline" where it names this notice.
- In both 'Sin red' entries of `accounts.md`, the body line and a pointer to `docs/product/offline-notice.md` are added. Nothing else there changes.
- `docs/product/offline-notice.md` exists.
- Light and dark Design captures of EstadosSinConexion and of Settings → Business after a failed save are attached to the PR.

## Out of scope

- The drawn "...and retries on its own" half of the body line.
- Any retry action or button.
- Changes to the automatic re-read of the New sale Products list.
- Part 2 of GH-1073.
- Rewording other docs that name other things.

## Decisions

- The body line stops at "apostrophe needs a connection." and leaves out the drawn "...and retries on its own".
  - Reason: The app does not retry on its own. The owner accepted the departure in GH-1073, Drawing 1, and the human confirmed it in Decision 1.
- "apostrophe" stays lowercase at the start of the body line.
  - Reason: It is the Wordmark, which no setting or language renames.
- The PM writes `docs/product/offline-notice.md` as a new capability with the glossary term Offline notice.
  - Reason: The 'Sin red' pointer in `accounts.md` needs a real target, and the file did not exist.
- The New sale Products list keeps its automatic re-read unchanged.
  - Reason: It is an existing, documented exception, and the new body line promises no retry, so the two don't contradict each other.

## Risks

- An e2e locator or helper may match the old sentence. It must move to the key or the new title in the same task (D-69509906).
- The new body line may trip the mobile check. It is fixed in tokens, never listed.

## Screens

The screens come from the design stage.

## Slices

### offline-notice-title-and-detail

#### Acceptance criteria

- `SinConexion` shows "You're offline" and "apostrophe needs a connection." inside `AvisoAmbar` (Attention icon, role=status, tokens only, light and dark), both in the global banner and in the inline notice.
- The copy keys, `SIN_CONEXION_MENSAJE`, the copy baselines and the `EstadosSinConexion*` rows in `screens.json` are updated.
- The old sentence is gone from `web/` and `scripts/design/`.
- `Estados.test.tsx` asserts both lines.
- `NuevaVentaProductos.test.tsx` and `ClienteForm.test.tsx` read the key.
- The mobile e2e project shows no new offender.
- `accounts.md` names the notice "You're offline", and its 'Sin red' entries carry the body line and the pointer to `offline-notice.md`.

#### Risks

- e2e-locator-on-old-sentence
- mobile-check-on-body-line
