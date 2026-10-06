---
status: accepted
date: 2026-10-05
---

# The getting-in screens share one `AuthPage`

Reset was built by copying Invitacion's layout by class name (`entrar__contenido`,
`invitacion__titulo`, `formulario`). A third and fourth copy (Entrar, NegocioNuevo)
would have drifted the same way, so the layout is shared instead of copied.

## Decision

- **Every getting-in screen renders its page through `AuthPage`**
  (`web/src/components/AuthPage.tsx`): Entrar, Invitacion in both kinds and Reset. One
  centred, phone-width column on every viewport. There is no per-screen variant and no
  computer-only layout (PRD item 16); a screen that looks different on a computer is a
  fork this decision refuses.
- **Props:** `title` (optional, so a screen still loading or showing a shared state
  sits in the same column without a heading), optional `subtitle`, and `children`.
  Anything else a screen needs (a badge, a footer line) goes in `children`, not in a
  new prop.
- **`PasswordField` owns the reveal** (`web/src/components/PasswordField.tsx`): the
  hidden input, the "Mostrar"/"Ocultar" button and the inline `role="alert"` error. A
  screen never rebuilds that toggle.
- **Shared copy lives in `web/src/screens/authMessages.ts`.** A screen never imports a
  message constant from another screen. `Invitacion.tsx` re-exports
  `WEAK_PASSWORD_MESSAGE` and `Reset.tsx` re-exports `DEAD_LINK_MESSAGE` only so
  existing test imports keep working.
- **Navigation to an in-app route is a router `Link`**, never an `<a href>` that
  reloads the page and drops the app's state.

## Consequences

- The layout's CSS is one commented section of `web/src/styles/app.css`
  (`auth-layout`), tokens only.
- A new getting-in screen uses `AuthPage`; copying Invitacion's classes is a review
  finding.
