# Accounts

Businesses, their users, and the only ways in: an invitation and a login. Every other capability reads one thing from here, the business of the user asking, and serves that business alone (ADR-0004). It also holds the app as a whole:

- how it is served, installed and navigated;
- how the installation is published on the internet and backed up (ADR-0014);
- the feedback rules every screen follows;
- the Negocio screen.

Inicio, where the app opens, is the panel defined in results.md.

## Jobs

**When** a friend wants to use the app for their own business, **I want** to hand them a link that opens a business of their own, **so I can** add them without seeing or touching anything they will record.

**When** I sell together with a partner, **I want** to invite them into my business, **so we** both record sales on the same books.

**When** I open the app on my phone, **I want** to log in once and stay in, **so I can** record a sale in seconds, while nobody else on the network or who guesses at passwords gets in.

**When** I run my business from my phone (handing over an order, answering a customer on Telegram, paying for something, or catching up at the end of the day), **I want to** get in with the link I was sent and keep my customers, my prices, my stock and my expenses up to date from the phone, **so I can** stop keeping them in the spreadsheet and have real data in place when sales arrive. The computer is the same job on a bigger screen.

**When** a seller needs the app away from my home network, **I want** the installation published on the internet over HTTPS, with every business's data copied off the server continuously, encrypted, and proven restorable, **so I can** let sellers work from anywhere without one lost server, disk or leaked backup costing anyone their books or exposing their customers.

- The protagonist of this last job is the operator of the installation, not a user in the app.
- For a seller, only two things change: where they can reach the app from, and that it is on HTTPS.

Success criteria:

1. Nothing of one business is reachable from another, through any route: by id it does not exist (404), in a list it is absent.
2. Nobody gets in without an invitation; each invitation lets one person in, once, within seven days.
3. Repeated wrong passwords stop working for a while, and nothing in the answers tells which emails have a user.
4. No `curl` at any point. From the phone alone, a seller can do everything the backend does, starting with opening or joining a business from the invitation link.
5. It feels like a phone app.
   - It sits on the home screen with its own name and icon. On iOS it installs over the home network. On Android it is a home-screen shortcut there, and a full install on the published installation with TLS.
   - It follows the phone's light or dark setting.
   - It says "Sin conexión" when the network drops.
   - No state is told by color alone (blue ↔ amber, never green ↔ red).
6. Businesses stay invisible to each other in the browser too.
   - No business in a URL.
   - No personal data or money in the console or browser storage.
   - The session lives only in the backend's cookie.
   - Serving the front reaches nothing outside the built app.
7. Nothing invented: no placeholder figures, and no navigation entry for something that does not exist yet.
8. **Nothing weakens on the internet.**
   - A seller logs in and works from any network with the same guarantees as on the home network: ADR-0002, ADR-0004 and ADR-0005.
   - Over HTTPS the session cookie is `Secure`. This is set in configuration, never guessed from the request.
   - Plain http on the home network keeps working unchanged.
9. **Guessing is braked by email and by address.**
   - One address trying many emails is locked out.
   - One email tried from many addresses is locked out.
   - Both locks answer the same, with the same timing.
   - No client address goes to a log.
10. **Losing the server is recoverable.**
    - At worst, under 1 minute of recent work (sales, payments, stock entries) is lost, from Turso's 24-hour write log.
    - Beyond those 24 hours, the daily encrypted copy is the fallback, and its loss bound is one day.
    - A drill restores the backup into a scratch target and proves it intact (integrity, row counts, recency), with no effect on the running app.
11. **Rebuildable from the repository.**
    - `deploy/README.md` documents every step to stand the installation up from zero.
    - No secret is in the repository.

## Behaviour

### Invitations and login

- **New-business invitation**: printed by `scripts/invite-business.sh`. Accepting it takes a business name, an email and a password, and opens the business with that user in it.
- **Join invitation**: any user creates one from the app (`POST /invitations`). Accepting it takes an email and a password and adds the user to the inviting business; a business name sent along is ignored.
- **Accepting either invitation** signs the person in, as a login does. They land on Inicio of that business.
- **Looking up an invitation** tells its kind, the business it leads to (join only) and when it expires. An unknown, used or expired invitation is not found.
- **Email**: trimmed and lowercased; one user per email across the whole installation.
- **Password**: at least 10 characters; stored only as a hash.
- **Login**: email and password answer a session that lasts 30 days, as a cookie and a token. A wrong password and an unknown email get the same answer.
- **Session cookie**:
  - It is `Secure` only when HTTPS is configured for the deployment, and never inferred from the request's scheme or headers.
  - On the home network's plain http it is not `Secure`, as before.
- **Login brakes**: two, both on `/auth/login` only. The invitation routes have none.
  - **Per email**: five failures in a row for an email lock it for 15 minutes, even for the right password. A success resets that email's count.
  - **Per address**: 20 failed logins from one client address within 15 minutes lock that address's logins for 15 minutes. A success never resets this count.
  - **Cross-counting**: every refused attempt counts for both the email and the address, whatever lock is already active. That includes the right password refused under a lock.
  - **Same answer**:
    - Both locks answer 429 with the same timing, and the screen shows the same brake message.
    - Nothing reveals a count, the address or which brake fired.
  - **Address source**:
    - By default it is the connection's address.
    - It is taken from the forwarded-address header only when the request comes from the trusted proxy (Render's, ADR-0014).
    - The trusted proxy is set in configuration, never guessed.
    - The same rule holds on the home network and on the published installation.
  - **Logs**: no client address, email or token is logged.
  - **Shared addresses**: people sharing one address can together trip the address lock. This is accepted at 20 failures in 15 minutes.
- `GET /auth/me` answers the user's email and their business's name.
- Logging out drops the cookie.

### Business

- **Reading the business** answers its name and its users. Users are shown by email only, sorted by email.
- **Renaming the business**:
  - The name is trimmed, inner spaces are collapsed, it is up to 60 characters and it cannot be blank.
  - There is no uniqueness check across the installation, since a refusal would reveal another business.
- Both routes take the business only from the session. They are in `tests/test_gated_routes.py` and the isolation sweep.

### The app

- **Serving**: the backend serves the built front from `web/dist` on the API's origin and port.
  - Front paths never collide with API paths.
  - Nothing outside `web/dist` is reachable.
  - Front routes are public static files, outside the API's route list.
- **Installable, with no offline mode**:
  - a manifest with name, colors and icons for Android and iOS;
  - a service worker that caches nothing.
- **Install on the home network**, served over plain http (ADR-0002):
  - iOS installs through "Agregar a inicio", with no walkthrough;
  - Android gets a home-screen shortcut, since browsers allow a service worker and the install prompt only on a secure origin;
  - the app shows no banner or explanation of the difference.
- **Install on the published installation**, over Render's TLS: Android's own install prompt is offered when the browser makes it available. The manifest and service worker already in place need no further work for it.
- **No network**: when a request fails because the network dropped, the open app shows "Sin conexión" on any origin. This does not rely on the service worker.
- **Theme**: light and dark follow the phone. The font is self-hosted.
- **Language and formats**: every word on screen in Rioplatense Spanish with vos. Money `$ 11.000`, a negative amount `−$ 4.500`, grams `3,5 g`, dates `dd/mm`. The catalog text keeps its own Telegram format (`$11.000`, catalog.md).
- **Getting in** (`Entrar`, `NegocioNuevo`, `Invitacion`):
  - Login shows a fixed hint under the button that five failed attempts lock the email for 15 minutes. It shows no count of attempts left.
  - Either lock shows the brake message. No copy names the address brake.
  - A request answered 401 goes to login.
  - An unknown, used or expired invitation shows "Esta invitación ya no sirve".
  - Opening `/invitation/{token}` while signed in logs out first, through the backend, then shows the invitation as if signed out. That includes the user's own business's join link.
- **Shell**:
  - The bottom bar on the phone and the side rail on a computer show only Inicio, Ventas, Clientes, Stock and Más, in that order (the design's).
  - A fixed **"Nueva venta"** button, separate from the tabs, opens the sale form directly (sales.md). It is not a tab.
  - It shows on every signed-in screen except the sale form itself and its customer sheet.
- **Inicio**: the panel (results.md).
  - Hoy · Semana · Mes, with sales, Ganancia, Caja, money owed and stock per variety.
  - When no variety has a current price today, "Arrancá por las variedades" shows above the panel, and the panel still shows its real figures.
- **Más**: Gastos, Variedades, Catálogo ("Catálogo · El mensaje de hoy, listo para copiar", catalog.md), Negocio.
- **Negocio**:
  - rename the business;
  - the users by email, the signed-in one marked "vos";
  - "Invitá a un socio": each tap creates one fresh join link, to copy or share with the phone's share sheet;
  - log out.

### The published installation (ADR-0014)

- **Hosting**:
  - Render hosts the app and deploys automatically on every merge to `master`.
  - Turso (libSQL, `aws-us-east-1`) holds the database, with point-in-time restore over the last 24 hours. ADR-0001's SQLite stands.
- **Uptime**: UptimeRobot pings the health endpoint every 5 minutes. The health endpoint answers nothing about any business, not even that one exists: no name, id or count.
- **Daily backup**: a GitHub Actions workflow copies the database every day and encrypts the copy with `age`.
  - The copy is stored outside Render and Turso.
  - The decrypting identity is kept outside the repository and both providers.
- **Secrets**: none in the repository.
- **`deploy/README.md`** gives every step from zero: Render's service, Turso's setup, the backup workflow and UptimeRobot's monitor.
  - Render's network boundary and TLS replace binding to `127.0.0.1` behind a reverse proxy.
- **Restore drill**: a script the operator runs by hand, with no timer and no notification channel.
  - It restores from Turso's point-in-time restore and from the daily encrypted copy into a scratch target, with no effect on the running app.
  - Each run reports the integrity check result, row counts and the time of the restored copy's latest change.
  - Its cadence is set in `deploy/README.md`: once before going live, after any change to how the app or its backup are configured, and monthly.
- **Publishing is a gate**:
  - Nobody is given the public address until criteria 8–11 hold.
  - Sellers may still be invited on the home network meanwhile.
  - Publishing belongs to the installation as a whole: every business becomes reachable at once, kept apart only by session isolation (ADR-0004).
- **No admin surface** (ADR-0002):
  - Brake state, backup health and drill results are read from outside the app: logs, the drill's output and the GitHub Actions run.
  - Nothing is seen or done from a signed-in session, and the app gains no screen, route or navigation entry for it.

### Feedback, on every screen

- **Success toasts** are short, fixed and carry no data, with one deliberate exception.
  - This capability's toasts: "Negocio renombrado", and "Invitación lista" unless the link is shown on the screen.
  - The exception is "Cobro guardado · queda debiendo $ X" (payments.md). It names what the customer still owes, because seeing that is the point of recording a payment. When nothing is left owing it reads "Cobro guardado".
- **No "Deshacer" on success toasts, with one deliberate exception**: "Venta guardada" (sales.md) carries Deshacer, because recording a sale is the fastest and most frequent entry. It still carries no data. No other success notice gets one.
- **Leaving a form** discards what was typed without asking, with one deliberate exception: Nueva venta asks "¿Descartás la venta?" once anything has been entered (sales.md).
- **Refusals** show inline and keep what was typed.
- **No network** shows "Sin conexión"; a server error shows a generic retry.
- **A record that is gone** answers 404 whether it was deleted, never existed or belongs to another business (ADR-0004). The app never says who deleted it or that it once existed.
  - **Saving an edit, confirming a delete or undoing** on a record that is gone:
    - the form or dialog closes and what was typed is discarded;
    - the list it came from refreshes;
    - a fixed notice shows: "Eso ya no está. La lista ya está al día."
  - The notice is not a success toast. It has no data, no "Deshacer" and no "Reintentar", and it is announced like a toast.
  - Confirming the delete of a record already gone gives the same notice, not the delete's success toast.
  - **Opening the detail of a record that is gone** (a variety, a customer, an expense, a sale or a stock entry) shows "Eso ya no está." with one button back to its list: "Volver a Variedades", "Volver a Clientes", "Volver a Gastos" (the current month), "Volver a Ventas" or "Volver a Stock". It carries no id, name or date.

## Metrics

- **No curl (criterion 4)**: an end-to-end run through the front alone passes. It accepts a new-business invitation, renames the business, creates a join link and accepts it as a second user.
- **Isolation (criteria 1, 6)**:
  - the business routes sit in the isolation sweep and the gated-route test;
  - serving tests prove no path reaches outside `web/dist`;
  - after a full run, browser storage and the console hold nothing personal or money;
  - no front URL carries a business id;
  - a record of another business, opened by id, shows the same "Eso ya no está." as a deleted one.
- **Phone app (criterion 5)**:
  - the manifest passes the browser's installability check, run on `localhost`;
  - installing on a phone is not checked automatically;
  - both themes render from the tokens;
  - an offline check shows "Sin conexión";
  - no state is told by color alone.
- **Nothing invented (criterion 7)**:
  - the bar shows exactly Inicio, Ventas, Clientes, Stock and Más, plus the "Nueva venta" button;
  - Más shows exactly Gastos, Variedades, Catálogo and Negocio;
  - every figure on Inicio equals the API's answer, with real zeros for a period with no activity (results.md).
- **Publishing (criteria 8–11)**: no test reaches the network, Render, Turso or GitHub.
  - **Brakes (criteria 3, 9)**: tested at the HTTP seam with a fake clock, 100% passing. They cover:
    - the email brake (5 in a row, 15 minutes);
    - the address brake (20 within 15 minutes, 15 minutes);
    - cross-counting, lock refusals included;
    - a success resetting only the email's count;
    - the same 429 answer and timing from both locks, disclosing nothing.
  - **Address source (criterion 9)**: the forwarded header is used only from the configured trusted proxy and ignored from anywhere else.
  - **Cookie (criterion 8)**: `Secure` is present when HTTPS is configured and absent otherwise.
  - **No leakage (criteria 8, 9)**:
    - no log line from the login path contains a client address, email or token;
    - the health endpoint answers no business name, id or count.
  - **Rebuildable (criterion 11)**: a check that the repository holds no Turso credential, `age` identity or other secret.
  - **Drill (criterion 10)**:
    - Automated: against a local scratch copy, the drill produces integrity, row counts and the latest change.
    - By hand: the run before going live shows, from the recency field, that the restore is within the under-1-minute bound.

## Out of scope

- Changing or resetting a password from the app; removing a user.
- Listing past or pending invitations; revoking an invitation.
- Exporting or deleting a business.
- Roles within a business.
- Offline use; an install walkthrough on iOS or Android.
- TLS on the home network, including local certificates: the published installation gets TLS from Render (ADR-0014).
- Live updates between partners: a list refreshes when it is opened or after a save, not when the other partner changes something.
- The Análisis entry: it comes with its own task.
- Stopping a guessing run spread across many addresses and many emails at once.
- Braking the invitation routes.
- A scheduled restore drill; any notification channel to the operator.
- An admin screen, route or navigation entry, or anything operated from a signed-in session.
- A per-business publishing flag or staged rollout.
