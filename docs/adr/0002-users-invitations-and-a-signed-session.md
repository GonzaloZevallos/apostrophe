---
status: accepted
date: 2026-10-02
---

# Users with email and password, invitations as the only way in, a signed session

Several businesses share one installation (docs/adr/0004). It runs on the home network
for now and is meant to be published later, so whatever lets someone in has to hold up
on the internet from the start.

## Decision

- **Users** log in with **email and password**. An email has one user across the whole
  installation, and a user works on exactly one business. Passwords are stored as
  **scrypt** hashes (OWASP parameters: n=2^17, r=8, p=1), each hash carrying its own
  parameters; at least 10 characters.
- **Invitations are the only way in**; there is no open registration and no
  administrator inside the app.
  - A **new-business invitation** is printed by `scripts/invite-business.sh`, run by
    whoever operates the installation. Its user names the business and creates their
    own user.
  - A **join invitation** is issued from the app by any user of a business
    (`POST /invitations`) and adds one more user to that business only.
  - Either works **once** and **expires after 7 days**. Only a SHA-256 digest of the
    token is stored. Unknown, used and expired look the same from outside: 404.
- **Login brake**: five failed logins in a row for an email lock it for 15 minutes,
  even with the right password (429). A success resets the count. Unknown emails are
  braked and timed like known ones (a dummy hash is computed), so neither the answer nor
  its timing tells which emails exist.
- **Session**: a stateless token (user id, opening time, a keyed fingerprint of the
  password hash), HMAC-SHA256 under `APOSTROPHE_SECRET_KEY`, valid **30 days**, sent as
  an `HttpOnly`, `SameSite=Lax` cookie and accepted as a bearer header. A changed
  password closes that user's sessions; a changed secret key closes everyone's.
- **Every route is gated** but `/health`, login, logout and the two invitation routes;
  `tests/test_gated_routes.py` enforces it over the OpenAPI document.

## Consequences

- Password reset and password change do not exist yet; the operator of the installation
  resets one by hand until a task adds them. The app sends no email.
- The cookie is not `Secure` while the app is served over plain http on the home
  network. Publishing it brings TLS first, then `Secure`.
- One session cannot be closed alone; a password change closes them all.

## Considered and rejected

- **One shared password** (this ADR's first version, for a single business): no way to
  tell users or businesses apart.
- **Open registration**: strangers in the day the app is published.
- **An administrator user in the app**: a key that crosses businesses (docs/adr/0004).
- **A sessions table**: per-device revocation nobody asked for, a lookup per request.
