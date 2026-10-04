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
  - **Per-address brake** (ADR-0015, published install): on top of the per-email
    brake, 20 failed logins from one client address within 15 minutes lock that
    address's logins for 15 minutes too, with the same 429 and the same timing.
    Every refused login counts for both brakes at once, lock refusals included; a
    success resets only the email's count, never the address's. The address itself is
    never stored — only its HMAC, under `APOSTROPHE_SECRET_KEY` — and its state lives
    in `login_address_guard`, a platform table (docs/adr/0004, CODING_STANDARDS §9).
- **Session**: a stateless token (user id, opening time, a keyed fingerprint of the
  password hash), HMAC-SHA256 under `APOSTROPHE_SECRET_KEY`, valid **30 days**, sent as
  an `HttpOnly`, `SameSite=Lax` cookie and accepted as a bearer header. A changed
  password closes that user's sessions; a changed secret key closes everyone's.
- **Every route is gated** but `/health`, login, logout and the two invitation routes;
  `tests/test_gated_routes.py` enforces it over the OpenAPI document.

## Consequences

- Password reset and password change do not exist yet; the operator of the installation
  resets one by hand until a task adds them. The app sends no email.
- `Secure` on the session cookie is decided only by configuration
  (`Settings.secure_cookie`, derived from `public_url`), never guessed from the
  request (docs/adr/0015). Plain http on the home network keeps the cookie without
  `Secure`, unchanged; the published install's `APOSTROPHE_PUBLIC_URL=https://…` turns
  it on.
- One session cannot be closed alone; a password change closes them all.

## Considered and rejected

- **One shared password** (this ADR's first version, for a single business): no way to
  tell users or businesses apart.
- **Open registration**: strangers in the day the app is published.
- **An administrator user in the app**: a key that crosses businesses (docs/adr/0004).
- **A sessions table**: per-device revocation nobody asked for, a lookup per request.
