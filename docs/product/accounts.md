# Accounts

Businesses, their users, and how people get in and out:
- the only way in: an invitation and a login;
- the way back in: a password change and an operator-issued reset link;
- the only way out: an operator's command that exports a business and removes it.

Every other capability reads one thing from here, the business of the user asking, and serves that business alone (ADR-0004). It also holds the app as a whole:

- how it is served, installed and themed, including the theme choice each device remembers, and how the installed shell fills the phone's screen;
- how the installation is published on the internet and backed up (ADR-0016);
- the feedback rules every screen follows, and the shared states (`Estados`) that draw them;
- the Negocio, Usuarios, Apariencia and Tu cuenta groups of Configuración.

Where every screen sits (tabs, sidebar, Más, Configuración, the chrome and back rule, routes, first run) is navigation.md. Inicio, where the app opens, is the panel defined in results.md. The Precios group is pricing-settings.md.

## Jobs

**When** a friend wants to use the app for their own business, **I want** to hand them a link that opens a business of their own, **so I can** add them without seeing or touching anything they will record.

**When** I sell together with a partner, **I want** to invite them into my business, **so we** both record sales on the same books.

**When** I open the app on my phone, **I want** to log in once and stay in, **so I can** record a sale in seconds, while nobody else on the network or who guesses at passwords gets in.

**When** I know my password but no longer want it (I told it to someone, typed it on a shared device, or think it leaked), **I want** to set a new one myself from the phone in a few taps, **so that** whoever knew the old one is out of my business at once and I keep working on this device without asking anyone.

**When** I've forgotten my password and can't get into my business, **I want** the operator to hand me a link that lets me choose a new password myself, once and within a day, **so I can** get back to my books the same day, while nobody else (the operator included) learns or chooses my password and every device that was signed in as me is signed out.

These two refine the "log in once and stay in" job above. The operator's command is the reset job's mechanism, not a job of its own.

**When** I run my business from my phone (handing over an order, answering a customer on Telegram, paying for something, or catching up at the end of the day), **I want to** get in with the link I was sent and keep my customers, my prices, my stock and my expenses up to date from the phone, **so I can** stop keeping them in the spreadsheet and have real data in place when sales arrive. The computer is the same job on a bigger screen.

**When** I open the app from an invitation link for the first time, come back with a reset link after forgetting my password, log in again on my phone, or land on a screen that is empty, still loading or failing, **I want** one clear screen on my phone that gets me in or tells me in plain words what happened and what to do next, **so I can** get back to my books without asking anyone, guessing, or learning anything about other businesses or users.

This refines the "log in once and stay in", "get in with the link I was sent" and forgotten-password jobs above; it is not a new job. Its protagonist is the seller; the operator's commands stay outside the app.

**When** I open the app on my phone or computer, whatever my device's light or dark setting, **I want** to see it as it was designed ("Papel y azul": warm paper background, brown-black ink, one blue), **so I** always work in the one look that was designed and checked for reading figures, states and amounts, and the dark theme shows only once I choose it (in Configuración → Apariencia, navigation.md) and stays on that device once chosen.

**When** I need to change how my business is set up (rename it, bring in a partner, connect or switch the Telegram bot, edit the catalog's header and footer, manage my expense categories, switch to dark, change my password or log out), **I want** every business-wide setting in one place, each in its own short screen, **so I can** change it in a few taps from my phone and get back to the customer, without wondering which screen holds it. (Served here by Configuración's Negocio, Usuarios, Apariencia and Tu cuenta; the structure is navigation.md.)

**When** I open the installed app on my phone between orders or mid-chat with a customer, **I want** it to fill the screen and respond the way a phone app does (nothing hidden under the notch or the home bar, a status bar the colour of the app, no page bounce or pull-to-refresh, no blue flash or stray text selection when I tap, and the field I'm typing in never hidden by the keyboard), **so I can** tap, type and read figures fast and get back to the customer, without the app feeling like a web page in a frame.

This refines the "log in once and stay in" job above and criterion 5; it is not a new job. Its protagonist is the seller; the operator and Capacitor are not part of it.

**When** a friend stops using the app, or asks to be taken out of it, **I want** to hand them everything the app holds of their business in one file and then remove that business from the installation completely, **so that** they keep their books and their customers' names, phone numbers and balances are no longer held by me or by anyone else on the installation.
- A business opened by mistake is covered by the same command.
- The business goes as a whole, every user included.
- The operator has agreed with every user of the business beforehand; the command does not check it.

**When** a seller needs the app away from my home network, **I want** the installation published on the internet over HTTPS, with every business's data copied off the server continuously, encrypted, and proven restorable, **so I can** let sellers work from anywhere without one lost server, disk or leaked backup costing anyone their books or exposing their customers.

- The protagonist of this last job is the operator of the installation, not a user in the app.
- For a seller, only two things change: where they can reach the app from, and that it is on HTTPS.

**When** a backend check goes red on a diff that touches no backend code, **I want** the cookie-security test to give the same result on any day, using only a fixed time it is handed and never the real date or anything else outside the test, **so I can** trust that a red check means a real regression and merge a green one without re-running it.

- This refines the "log in once and stay in" job and criterion 14 for the people who merge through the gate (the agentic maintainers and the PM); it is not a seller's job.
- No product behaviour changes for it: the `Secure` rule and the 30-day session stay as they are.

The navigation job (navigation.md) decides where Negocio, Usuarios, Apariencia and Tu cuenta are reached from: Configuración.

Success criteria:

1. Nothing of one business is reachable from another, through any route: by id it does not exist (404), in a list it is absent.
2. Nobody gets in without an invitation; each invitation lets one person in, once, within seven days.
3. Repeated wrong passwords stop working for a while, and nothing in the answers tells which emails have a user.
4. No `curl` at any point. From the phone alone, a seller can do everything the backend does, starting with opening or joining a business from the invitation link.
5. It feels like a phone app.
   - It sits on the home screen with its own name and icon. On iOS it installs over the home network. On Android it is a home-screen shortcut there, and a full install on the published installation with TLS.
   - It opens in the light theme whatever the phone's setting; dark only when chosen on that device.
   - It says "Sin conexión" when the network drops.
   - No state is told by color alone (blue ↔ amber, never green ↔ red).
   - Installed, it fills the screen and responds like a phone app (criteria 33–36).
6. Businesses stay invisible to each other in the browser too.
   - No business in a URL.
   - No personal data or money in the console or browser storage. The only thing the browser keeps is the device's theme choice.
   - The session lives only in the backend's cookie.
   - Serving the front reaches nothing outside the built app.
7. Nothing invented: no placeholder figures, and no navigation entry for something that does not exist yet.
14. **Nothing weakens on the internet.**
   - A seller logs in and works from any network with the same guarantees as on the home network: ADR-0002, ADR-0004 and ADR-0005.
   - Over HTTPS the session cookie is `Secure`. This is set in configuration, never guessed from the request.
   - Plain http on the home network keeps working unchanged.
15. **Guessing is braked by email and by address.**
   - One address trying many emails is locked out.
   - One email tried from many addresses is locked out.
   - Both locks answer the same, with the same timing.
   - No client address goes to a log.
16. **Losing the server is recoverable.**
    - At worst, under 1 minute of recent work (sales, payments, stock entries) is lost, from Turso's 24-hour write log.
    - Beyond those 24 hours, the daily encrypted copy is the fallback, and its loss bound is one day.
    - A drill restores the backup into a scratch target and proves it intact (integrity, row counts, recency), with no effect on the running app.
17. **Rebuildable from the repository.**
    - `deploy/README.md` documents every step to stand the installation up from zero.
    - No secret is in the repository.

Success criteria, the theme:

23. **Light unless chosen on the device**: a device with no stored choice opens in the light theme on every screen, whether the system is set to light or dark. With the system in dark, the page background is `--papel` (#fcfbf8).
24. **Dark only on request, and it stays**: the dark theme (`InicioOscuro`) shows only when `data-tema="oscuro"` is set on `<html>`. Only the choice "Oscuro" in Configuración → Apariencia sets it (navigation.md). The device remembers it across closing the app, reloads and logging out, and shows it on every screen of that device, Entrar, the invitation and the reset screens included. Choosing "Claro" returns to light and is remembered the same way.
25. **The themes themselves don't change**: both keep the same tokens and values; only what picks the theme changed. Every rule about state (no state told by color alone, blue ↔ amber) holds in both.
26. **One rule, written the same everywhere**: the comment at the top of `web/src/styles/tokens.css`, `docs/product/design-system/tokens.css`, the design-system README and this file all state the same rule.

Success criteria, changing and resetting a password:

18. **Change, fast and final.**
    - From Configuración → Tu cuenta on the phone, a user with the right current password sets a new one (at least 10 characters) in under a minute.
    - Every other session of that user is closed at once.
    - The device that changed it stays signed in.
    - Partners' sessions are untouched.
19. **Reset, one command, one link.**
    - The operator gets a working link from one command, with no database edit.
    - The seller opens it within 24 hours, sets a new password and lands on Inicio signed in, with every earlier session of theirs closed.
    - The link works once.
    - Unknown, used, expired and retired links all answer the same 404, as invitations do.
20. **Nobody else knows it.**
    - The operator never sees or chooses the new password.
    - No password, token or link appears in a log, an answer, the console or browser storage.
    - Only a scrypt hash and a token digest are stored (ADR-0002, ADR-0005).
21. **The brake is not a side door.**
    - A wrong current password counts as a refused login for both login brakes.
    - While either lock is active, Change is refused with the same brake message.
    - Nothing in either flow tells whether an email has a user. The operator's terminal is the exception, because the operator is not a user.
22. **No curl.** Both flows run entirely from the phone. The operator's command is the only exception, and it sits outside the app as `invite-business.sh` does.

Success criteria, the getting-in screens and shared states as redesigned (GH-49):

27. **Getting in is fast.** From the phone, a seller opens an invitation link, or a reset link, and lands on Inicio signed in in under a minute, and logs in from Entrar in a few seconds. No step appears that the design does not draw.
28. **Every state is told by word and shape, never by color alone**: the brake message, "Esta invitación ya no sirve", "Este enlace ya no sirve. Pedile uno nuevo a quien te lo pasó.", "Sin conexión", empty, loading, the generic server-error retry and "Eso ya no está.". All copy in Rioplatense Spanish with vos.
29. **Phone and computer match the design.** Entrar, NegocioNuevo, Invitacion, the reset screen and Estados match `docs/product/design-system/pantallas/` on both, checked by eye; `scripts/design/compare.sh` runs before and after.
30. **The look reveals nothing new.**
    - No screen or state says whether an email has a user, which brake fired or how many attempts are left.
    - A dead link never says why.
    - "Eso ya no está." carries no id, name or date.
    - No personal data or money reaches the console or browser storage.
31. **Both themes.** These screens follow the theme rule (criteria 23–25), with no token change.
32. **No behaviour regresses.** Every accounts, navigation and feedback test passes unchanged.

Success criteria, the installed shell:

33. **Nothing under the system areas.**
    - On an installed phone with a notch and a home bar, in portrait, every screen's content is fully visible and tappable: the tab bar, the header, "+ Nueva venta", sheets and toasts included.
    - A screen's height follows the visible screen, so nothing jumps or is cut off when the browser's own bars appear or go away.
    - With the keyboard open, the focused field stays in view.
34. **The status bar is the app's colour.**
    - On Android it matches the paper of the theme in force: light `--papel` with no `data-tema`, the dark theme's own paper token with `data-tema="oscuro"`. It changes as soon as the attribute changes.
    - The phone's own light or dark setting picks nothing. There is no blue band in either theme.
    - The splash and the manifest's colours are light `--papel`.
    - On iOS the status bar stays light in both themes, because iOS fixes its style at launch. This is an accepted limitation, not a defect.
35. **Taps feel like a phone app's.**
    - Every button, row and bar item shows a pressed state at once.
    - No Android tap highlight; tapping never selects text on buttons, tabs or the bar.
    - No overscroll bounce or pull-to-refresh on the page as a whole.
    - Text inside lists and fields stays selectable where it is today.
    - The manifest passes the browser's installability check.
36. **Nothing regresses.**
    - Every accounts, navigation and feedback test passes unchanged.
    - The bar still fits at 320 px with text at 130%.
    - No state is told by colour alone, in either theme; the pressed state uses tokens only, in both themes.
    - No existing token value changes; only the four new inset tokens are added.

Success criteria, removing a business:

8. **The file is their books and stands on its own**:
   - one JSON file holds every recorded fact of the business and opens without the app;
   - it identifies the business by its name;
   - it names what each record refers to as well as its id;
   - it holds no password hash, no stored secret, no invitation and no reset link.
9. **Named back before anything is lost**: the dry run names the business and counts by kind what would go, writing nothing. The real run asks for the business name typed exactly before it touches anything.
10. **Nothing deleted until the export is safe**: the delete runs only after the file was written and read back in the same run, and the exported counts equal the deleted counts. Any failure or mismatch deletes nothing.
11. **Nothing survives**:
    - no row carrying the business's id is left in any table, including tables added later;
    - its invitations and its users' reset links, of every status, go too, and so does its users' login-attempt history;
    - the export is built from the same tables as the delete; invitations and reset links are deleted, never exported.
12. **Every other business is untouched**: their record counts are the same before and after, and they keep working, are never slowed on purpose and are never told anything.
13. **No personal data outside the file, and a clean slate**: the terminal and logs show only the business name, the file's path and counts. Afterwards the same email can open a new business with nothing carried over.

Success criteria, the cookie-security test (GH-130 follow-up):

37. **Same result on any day.** The cookie-security test uses only a fixed time handed to it through the injected clock (ADR-0001) and gives the same result whatever the real date, earlier or later, with no edit to its fixed time. Nothing in it reads the real clock.
38. **The rule is still proven.** It keeps asserting that `Secure` is present when HTTPS is configured, absent otherwise, and never inferred from the request's scheme or headers (criterion 14). No assertion is dropped or loosened.
39. **No product behaviour changes.** The session still lasts 30 days, as a cookie and a token. Product code found reading the real date wrongly is a separate bug item.
40. **The gate means something.** The full backend tests check is green.

## Behaviour

### Invitations and login

- **New-business invitation**: printed by `scripts/invite-business.sh`. Accepting it takes a business name, an email and a password, and opens the business with that user in it.
- **Join invitation**: any user creates one from the app (`POST /invitations`). Accepting it takes an email and a password and adds the user to the inviting business; a business name sent along is ignored.
- **Accepting either invitation** signs the person in, as a login does. Accepting a new-business invitation lands in the Onboarding of that business (onboarding.md); accepting a join invitation lands on Inicio of that business.
- **Looking up an invitation** tells its kind, the business it leads to (join only) and when it expires. An unknown, used or expired invitation is not found.
- **Email**: trimmed and lowercased; one user per email across the whole installation.
- **Password**: at least 10 characters; stored only as a hash.
- **Login**: email and password answer a session that lasts 30 days, as a cookie and a token. A wrong password and an unknown email get the same answer.
- **Session cookie**:
  - It is `Secure` only when HTTPS is configured for the deployment, and never inferred from the request's scheme or headers.
  - On the home network's plain http it is not `Secure`, as before.
- **Login brakes**: two, on `/auth/login` and on a password change. The invitation and reset routes have none.
  - **Per email**: five failures in a row for an email lock it for 15 minutes, even for the right password. A successful login, password change or reset resets that email's count.
  - **Per address**: 20 failed logins from one client address within 15 minutes lock that address's logins for 15 minutes. A success never resets this count.
  - **Cross-counting**: every refused attempt counts for both the email and the address, whatever lock is already active. That includes the right password refused under a lock, and a wrong current password on a password change.
  - **Same answer**:
    - Both locks answer 429 with the same timing, and the screen shows the same brake message.
    - Nothing reveals a count, the address or which brake fired.
  - **Address source**:
    - By default it is the connection's address.
    - It is taken from the forwarded-address header only when the request comes from the trusted proxy (Render's, ADR-0016).
    - The trusted proxy is set in configuration, never guessed.
    - The same rule holds on the home network and on the published installation.
  - **Logs**: no client address, email or token is logged.
  - **Shared addresses**: people sharing one address can together trip the address lock. This is accepted at 20 failures in 15 minutes.
- `GET /auth/me` answers the user's email and their business's name.
- Logging out drops the cookie and goes to login. It does not clear the device's theme choice.

### Changing a password

- **A gated route.** The user comes from the session. It takes the current password and a new one.
- **New password**: at least 10 characters, the only rule. A new password equal to the current one is accepted, and still counts as a change.
- **On success**:
  - the password hash changes, so every other session of the user closes on its own (ADR-0002);
  - the acting device gets a fresh session cookie and token in the same answer and stays signed in;
  - partners' sessions are untouched;
  - every unused reset link of the user is retired;
  - the email's brake count is reset and its lock lifted. The address's count is never touched.
- **A wrong current password** is refused and counts as a refused login for both brakes.
- **Under either lock**: Change is refused with the login's 429, the same timing and the same brake message, even with the right current password.

### Resetting a forgotten password

- **The command**: `scripts/reset-password.sh <email>`, run by the operator, like `scripts/invite-business.sh`. No database edit by hand.
  - The email is trimmed and lowercased, as at login.
  - **An email matching no user**: it prints a plain "no user for that email", writes nothing and retires nothing.
  - **Otherwise**: it creates a reset link for that user and retires the user's earlier unused one. It prints the link to the terminal only, never to a log.
  - It says nothing about earlier links, and logs nothing personal.
  - The operator never sees or chooses the new password.
- **Reset link**:
  - it works once and expires 24 hours after it is issued;
  - only a digest of its token is stored.
- **One live link per user**:
  - a new link retires any earlier unused one;
  - any password change, by Change or by a reset, retires every unused link of the user;
  - a retired link answers exactly like an unknown, used or expired one: 404.
- **Opening the link** (looking it up) spends nothing. Only a successful submit uses it. Expiry and retirement still apply while it is only being looked at.
- **Submitting** takes the new password only.
  - The rule is at least 10 characters, and a password used before is accepted.
  - On success, all of these happen:
    - the password is set;
    - the link is used;
    - the user's other unused links are retired;
    - every session of the user is closed;
    - this device is signed in and lands on Inicio;
    - the email's brake count is reset and its lock lifted, never the address's.
  - A link that went stale between opening and submitting answers 404.
- **No brake on the reset routes**: they are open and unbraked, like the invitation routes. A locked email is exactly who the link is for.

### Business

- **Reading the business** answers its name and its users. Users are shown by email only, sorted by email.
- **Renaming the business**:
  - The name is trimmed, inner spaces are collapsed, it is up to 60 characters and it cannot be blank.
  - There is no uniqueness check across the installation, since a refusal would reveal another business.
- Both routes take the business only from the session. They are in `tests/test_gated_routes.py` and the isolation sweep.
- **Pricing settings**: each business also holds its two pricing switches, defined in pricing-settings.md.

### Removing a business (operator command)

- **The command**: a server command run by the operator, like `scripts/invite-business.sh`. No administrator and no entry for it in the app (ADR-0002).
  - It names the business by the email of any of its users, trimmed and lowercased as at login.
  - An email matching no user prints a plain "no business for that email" and does nothing, in either mode.
- **Dry run**:
  - names the business found;
  - prints counts by kind: users, customers, varieties, price entries, stock entries, sales, sale lines, payments, expenses, expense categories, catalog settings, and invitations and reset links (deleted only);
  - writes no file, changes no row, never asks for confirmation.
- **Real run**:
  1. Names the business and asks the operator to type its name exactly; it cannot skip this. A wrong name, a cancel or no answer writes nothing and deletes nothing.
  2. Writes the export file, then reads it back.
  3. In one transaction, deletes every row of the business across every table discovered from the schema (not a hand-kept list). That includes:
     - the business and its users;
     - every invitation and every reset link of its users, whatever their status;
     - the removed users' emails' login-attempt history.
  4. Commits and reports success only if the exported counts equal the deleted counts for every exported kind.
  5. Reports the business name, the file's path, and the counts exported and deleted.
- **Any failure before the commit** deletes nothing: writing or reading back the file, a count mismatch, or a database busy with other businesses' writes. The operator runs it again.
  - It also removes the export file the run created, whether it was written fully or only partly, so no file is left behind (ADR-0015). This includes a write that fails after the file was already created on disk, and an interrupted run.
  - A record created by the leaving business's own users between export and delete makes the counts differ, and the delete is blocked rather than losing it.
- **Commit outcome unknown**: the commit itself fails in a way that leaves it unknown whether it was applied (for example, the connection to the database drops during the commit).
  - The commit is one transaction: either every row of the business is gone or every row is still there. There is no partial removal.
  - The command keeps the export file, since it may be the only copy left of the business's books. It never says "nothing deleted" and never reports success. It exits with a failure status.
  - It prints: "Commit outcome unknown; export kept at <path>. Run with --dry-run and the same email before anything else." With it: the business name and the counts exported, never counts deleted.
  - **Checking, then running again**: a rerun is allowed, with no lock or stored marker. The dry run with the same email tells which way it went:
    - "no business for that email": the removal happened. The kept file is the export to hand over.
    - The business is named with its counts: nothing was deleted. A real run is then an ordinary run.
      - It writes a new file under a new name, never overwriting the kept one. Only the newest file is handed over.
      - The operator deletes the kept, out-of-date file by hand, since it holds personal data. The command never touches a file it did not create in the same run.
- **Other businesses** keep using the app during the run, are never slowed on purpose and are never told anything.
- **The export file**:
  - one JSON file per real run, owner-only permissions, written to the server's file system and never anywhere the app serves;
  - its name carries the business name (slugified) and the run's date and time; an existing file is never overwritten;
  - plain values: ISO 8601 dates, whole pesos, grams as decimals with up to two places;
  - each record names what it refers to (customer, variety, category) as well as its id;
  - it holds every recorded fact as stored:
    - the business name and its pricing settings (Precio por cantidad and Clientes VIP);
    - users (email and joining date);
    - customers (name, phone number, VIP);
    - varieties with their low-stock threshold and catalog attributes;
    - price entries, with their VIP price;
    - stock entries (date, variety, grams, origin, total cost, note; a lot is its stock entry, not a separate record);
    - sales (date, customer, shipping charged, note, how it was paid);
    - sale lines (variety, grams, stored price per gram, pricing rule, line total);
    - payments (date, amount, method, customer, and their sale for an on-the-spot payment);
    - expense categories and expenses;
    - the catalog header and footer;
  - it leaves out:
    - computed figures (balances, owing since, settlement, stock, cost per gram, cost of goods);
    - password hashes;
    - any stored secret, such as a Telegram bot token;
    - invitations and reset links;
    - login-attempt history.
- **After removal**:
  - a session left open by a removed user gets 401 and goes to login;
  - a new invitation to the same email opens a new business like any other, with a clean login-attempt count and nothing of the old business.
- **Privacy** (ADR-0005): nothing personal is printed or logged (no emails, names, phone numbers, amounts or file contents). The business name is not personal data and may be printed.

### The app

- **Serving**: the backend serves the built front from `web/dist` on the API's origin and port.
  - Front paths never collide with API paths.
  - Nothing outside `web/dist` is reachable.
  - Front routes are public static files, outside the API's route list. Their paths are in English, with redirects from the old Spanish ones (navigation.md).
- **Installable, with no offline mode**:
  - a manifest with name, colors and icons for Android and iOS (its fields are in "The installed shell" below);
  - a service worker that caches nothing.
- **Install on the home network**, served over plain http (ADR-0002):
  - iOS installs through "Agregar a inicio", with no walkthrough;
  - Android gets a home-screen shortcut, since browsers allow a service worker and the install prompt only on a secure origin;
  - the app shows no banner or explanation of the difference.
- **Install on the published installation**, over Render's TLS: Android's own install prompt is offered when the browser makes it available. The manifest and service worker already in place need no further work for it.
- **No network**: when a request fails because the network dropped, the open app shows "Sin conexión" on any origin. This does not rely on the service worker.
- **Theme**: the app opens in the light theme whatever the phone or computer is set to, unless Oscuro is stored on that device. The dark theme applies only when it is chosen (`data-tema="oscuro"`), and the one place a person chooses it is Configuración → Apariencia, Claro or Oscuro (navigation.md).
  - The rule is one: no attribute on `<html>` means light, `data-tema="oscuro"` means dark. There is no exception per screen, route or session, and the system's light or dark setting picks nothing. `oscuro` is the only recognised value.
  - **The theme choice is remembered per device**:
    - tapping Claro or Oscuro applies and remembers it at once, with no save, toast or unsaved-changes warning;
    - the device keeps only the choice: nothing personal, no money, no session and nothing about a business;
    - it belongs to the device, not to the user or the business; a partner's device and the user's other devices are unaffected;
    - logging out does not clear it;
    - a stored Oscuro shows on every screen of that device, Entrar, the invitation and the reset screens included; a device with nothing stored opens light;
    - the screens before login have no theme control.
  - Native controls and scrollbars follow the app's theme, not the system's: light with no attribute, dark with `data-tema="oscuro"`.
  - Both themes keep the same tokens and values, and every state rule holds in both.
  - The manifest's colours and the splash are static and light. The status bar follows the app's chosen theme (`data-tema`), never the system's; on iOS it stays light, because iOS fixes its style at launch.
  - The font is self-hosted.
- **Language and formats**: every word on screen in Rioplatense Spanish with vos. Money `$ 11.000`, a negative amount `−$ 4.500`, grams `3,5 g`, dates `dd/mm`. The catalog text keeps its own Telegram format (`$11.000`, catalog.md).
- **Getting in** (`Entrar`, `NegocioNuevo`, `Invitacion`, the reset screen):
  - **Drawn from the design** in `docs/product/design-system/pantallas/` (GH-49). Where the design's wording differs from this file, this file wins and the difference is a defect in the design.
  - **One centred, phone-width layout** on every viewport, the computer's included; there is no computer-only layout for these screens.
  - **Entrar**:
    - the labels "Email" and "Contraseña" and the button "Entrá";
    - a fixed hint under the button that five failed attempts lock the email for 15 minutes, and no count of attempts left;
    - a wrong password and an unknown email show the same refusal; refusals show inline and keep what was typed.
  - Either lock shows the brake message. No copy names the address brake, and both locks look and read the same.
  - A request answered 401 goes to login.
  - An unknown, used or expired invitation shows "Esta invitación ya no sirve".
  - Opening `/invitation/{token}` or `/reset/{token}` while signed in logs out first, through the backend, then shows the invitation or the reset screen as if signed out. That includes the user's own business's join link, and a reset link for the same user.
  - **The reset screen** (`/reset/{token}`) reuses `Invitacion`'s layout; it has no design file of its own and is registered in `scripts/design/screens.json` as a signed-out phone screen:
    - "Elegí tu contraseña nueva", one field "Contraseña nueva" (hidden by default, with a reveal) and the button "Guardar y entrar";
    - a password under 10 characters shows the same refusal as accepting an invitation and keeps what was typed;
    - on success it goes to Inicio, with no toast.
  - **A dead reset link**: an unknown, used, expired or retired link shows "Este enlace ya no sirve. Pedile uno nuevo a quien te lo pasó."
    - It shows both when the link is opened and when a submit answers 404.
    - It keeps nothing typed and never says why the link is dead.
    - Its only button goes to Entrar.
- **Where screens sit**: the bar, the sidebar, Más, Configuración, the chrome and back rule and the first run are navigation.md. Inicio is the panel (results.md).

### The installed shell

How the app fills a phone's screen and responds to touch once installed (criteria 33–36). It changes no screen's own layout and no bar or header behaviour (#59), and it builds no theme choice: the status bar follows whatever sets `data-tema`.

- **Document and viewport**:
  - the viewport reads `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`;
  - there is no `maximum-scale` and no `user-scalable=no`: pinch-zoom stays allowed;
  - `mobile-web-app-capable` is set; `apple-mobile-web-app-status-bar-style` is `default`;
  - on iOS the top inset is handled, so content never sits under the notch;
  - `-webkit-text-size-adjust: 100%`.
- **Status bar**:
  - exactly one `theme-color` meta, with no `media` attribute, light `--papel` in the static HTML;
  - one place sets or removes `data-tema` and updates `theme-color` with it, including at app start, from the theme's paper token, never a copied value;
  - there is no pair of metas with `prefers-color-scheme`: the system setting picks nothing;
  - only Android follows it live; iOS keeps the light `default` strip in both themes.
- **Insets**: four tokens, `--inset-arriba`, `--inset-abajo`, `--inset-izquierda` and `--inset-derecha`, built from `env(safe-area-inset-*)`.
  - Top and bottom are used by the bar, the header, the fixed "+ Nueva venta", sheets and toasts.
  - Left and right keep content, the bar, sheets and toasts clear of a side cut-out, so landscape is safe but not designed.
- **Height**: every height tied to the screen uses `dvh`, `.pantalla`, `.disposicion` and the sheets included.
- **Gestures and press**:
  - `overscroll-behavior: none` on `html` and `body`, `contain` on scrolling regions;
  - `-webkit-tap-highlight-color` transparent; `touch-action: manipulation`;
  - `user-select: none` on buttons, tabs and the bar; text inside lists and fields stays selectable;
  - `.boton*`, rows and bar items get an `:active` state built from tokens, in both themes.
- **Keyboard**: on iOS and Android, when the keyboard opens, the page and every sheet keep the focused field in view and can scroll, so "Guardar" or "Registrar" is reachable by scrolling.
  - A save action pinned above the keyboard is not promised; that is each screen's own decision.
  - The tab bar and "+ Nueva venta" need not stay above the keyboard, since forms and sheets don't show them (navigation.md).
- **Manifest**:
  - `id` `"/"` (never changed once shipped), `scope` `"/"`, `lang` `"es"`, `display` `"standalone"`;
  - `theme_color` and `background_color` light `--papel`, and no `orientation`;
  - icons: the existing 192 and 512 keep `"purpose": "any"` unchanged;
  - a maskable 512 keeps today's look (same background and mark colours, full-bleed, the mark inside the safe zone), drawn by design.
- **Splash**: no `apple-touch-startup-image`; iOS shows its own blank launch screen, accepted. Android's splash comes from the manifest's `background_color` and icon.
- **Accepted limitations**: on iOS the status strip stays light with dark text above the dark paper in the dark theme; on iOS the launch screen is blank until the app paints.

### In Configuración: Negocio, Usuarios, Apariencia, Tu cuenta

These groups of Configuración (navigation.md) replace the former Negocio screen, which no longer exists; `/negocio` redirects to Configuración. Each is its own subscreen, a form: "Cerrar", and a confirmation when leaving with unsaved changes; an untouched one closes at once. (Precios, between Usuarios and Integraciones, is pricing-settings.md.)

- **Negocio**: rename the business. Toast "Negocio renombrado"; refusals inline, keeping what was typed.
- **Usuarios**:
  - the users by email, sorted by email, the signed-in one marked "vos"; it always lists at least the signed-in user;
  - "Invitá a un socio": each tap creates one fresh join link, to copy or share with the phone's share sheet.
- **Apariencia**: Claro and Oscuro, the current one marked by word or shape and `aria-checked` or equivalent, never by color alone. A tap applies and remembers the choice on the device (see Theme). It never has unsaved changes, so "Cerrar" always closes at once.
- **Tu cuenta**:
  - "Cambiar contraseña", above "Cerrar sesión", opens a sheet:
    - the fields are "Contraseña actual" and "Contraseña nueva";
    - "Contraseña nueva" is asked once, hidden by default with a reveal, here and on the reset screen;
    - on success, the toast "Contraseña cambiada · cerramos tus otras sesiones";
    - a wrong current password reads "La contraseña actual no es esa.". "Contraseña actual" is cleared and "Contraseña nueva" keeps what was typed;
    - a password under 10 characters shows the same refusal as accepting an invitation, and a lock shows the login brake message, keeping what was typed;
  - log out ("Cerrar sesión"), which goes to login.

### The published installation (ADR-0016)

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
  - Nobody is given the public address until criteria 14–17 hold.
  - Sellers may still be invited on the home network meanwhile.
  - Publishing belongs to the installation as a whole: every business becomes reachable at once, kept apart only by session isolation (ADR-0004).
- **No admin surface** (ADR-0002):
  - Brake state, backup health and drill results are read from outside the app: logs, the drill's output and the GitHub Actions run.
  - Nothing is seen or done from a signed-in session, and the app gains no screen, route or navigation entry for it. Configuración holds no operator setting.

### Constraints

- **Change route**: gated. It takes the user and the business only from the session, and joins `tests/test_gated_routes.py` and the isolation sweep.
- **Reset routes** (looking a link up, submitting a new password): open, like the invitation routes.
- **Refusal codes**: every refusal carries a code in `contract.json` (ADR-0008) and never repeats the input (ADR-0005). The codes are:
  - wrong current password;
  - new password too short;
  - brake lock;
  - reset link gone (one code for unknown, used, expired and retired).
- **Secrets**: passwords are stored only as scrypt hashes and reset tokens only as digests (ADR-0002). No password, hash, token, digest or link appears in logs, answers, the console or browser storage.
- **Browser storage** holds only the device's theme choice.
- **Tests of this capability are self-contained**: every time they depend on comes from the injected clock (ADR-0001), never from the real date, so a check gives the same result on any day.

### Feedback, on every screen

These states are drawn by `Estados` (GH-49), restyled from the design with their wording unchanged. Each is checked on the phone and inside every screen's own computer layout (InicioCompu, VentasCompu, the two-pane Clientes and Variedades), with the same words and shapes. `Estados` draws nothing for a state no capability defines.

- **Success toasts** are short, fixed and carry no data, with one deliberate exception.
  - This capability's toasts:
    - "Negocio renombrado";
    - "Invitación lista", unless the link is shown on the screen;
    - "Contraseña cambiada · cerramos tus otras sesiones".
  - Choosing a theme shows no toast.
  - The exception is "Cobro guardado · queda debiendo $ X" (payments.md). It names what the customer still owes, because seeing that is the point of recording a payment. When nothing is left owing it reads "Cobro guardado".
- **No "Deshacer" on success toasts, with one deliberate exception**: "Venta guardada" (sales.md) carries Deshacer, because recording a sale is the fastest and most frequent entry. It still carries no data. No other success notice gets one.
- **Loading**: while a screen waits for the server, it shows a loading state whose wording and shape follow the design. It shows no figure, no placeholder amount and no text that could be read as data (criterion 7).
- **Empty states** keep each capability's own fixed wording.
- **Leaving a form or sheet** with unsaved changes asks before discarding, and an untouched one closes at once (navigation.md). Nueva venta's question is "¿Descartás la venta?" (sales.md).
- **Refusals** show inline and keep what was typed. The one exception: a wrong current password clears "Contraseña actual".
- **No network** shows "Sin conexión"; a server error shows a generic retry.
- **A record that is gone** answers 404 whether it was deleted, never existed or belongs to another business (ADR-0004). The app never says who deleted it or that it once existed.
  - **Saving an edit, confirming a delete or undoing** on a record that is gone:
    - the form or dialog closes and what was typed is discarded;
    - the list it came from refreshes;
    - a fixed notice shows: "Eso ya no está. La lista ya está al día."
  - The notice is not a success toast. It has no data, no "Deshacer" and no "Reintentar", and it is announced like a toast.
  - Confirming the delete of a record already gone gives the same notice, not the delete's success toast.
  - **Opening the detail of a record that is gone** (a variety, a customer, an expense, a sale or a stock entry) shows "Eso ya no está." with one button back to its list:
    - "Volver a Variedades" (a variety or a stock entry);
    - "Volver a Clientes";
    - "Volver a Gastos" (the current month);
    - "Volver a Ventas".

    It carries no id, name or date.
- No state is told by color alone (blue ↔ amber, never green ↔ red), in either theme.

## Metrics

- **No curl (criterion 4)**: an end-to-end run through the front alone passes. It accepts a new-business invitation, renames the business from Configuración → Negocio, creates a join link from Usuarios and accepts it as a second user.
- **Isolation (criteria 1, 6)**:
  - the business routes sit in the isolation sweep and the gated-route test;
  - serving tests prove no path reaches outside `web/dist`;
  - after a full run, browser storage holds only the theme choice, and the console and browser storage hold nothing personal or money;
  - no front URL carries a business id;
  - a record of another business, opened by id, shows the same "Eso ya no está." as a deleted one.
- **Phone app (criterion 5)**:
  - the manifest passes the browser's installability check, run on `localhost`;
  - installing on a phone is not checked automatically;
  - both themes render from the tokens;
  - an offline check shows "Sin conexión";
  - no state is told by color alone.
- **Theme (criteria 23–26)**:
  - light wins: an e2e run with the system emulated in dark (`emulateMedia({ colorScheme: 'dark' })`), nothing stored and no attribute reads the page background as `--papel` (#fcfbf8), Entrar included;
  - dark on request: an e2e run with `data-tema="oscuro"` on `<html>`, whatever the system setting, reads the page background as the dark theme's own value from `tokens.css`;
  - choosing Oscuro in Configuración → Apariencia sets the attribute, and Claro removes it, with no toast, save button or unsaved-changes warning, and the current choice marked by more than color;
  - the choice survives a reload and a logout; with Oscuro stored, Entrar, the invitation and the reset screens show dark;
  - browser storage holds only the theme choice;
  - no test or fixture reaches the dark theme by emulating a dark system;
  - no token value changed;
  - native controls and scrollbars are checked by eye on a dark-system device, light with no attribute and dark with it; no fast test reads them;
  - the four places that state the rule say the same, and none names `claro` as an attribute value.
- **Installed shell (criteria 33–36)**:
  - meta tags, fast test: the viewport has its four parts and no zoom restriction; `mobile-web-app-capable` and the iOS status-bar style `default` are present; exactly one `theme-color`, with no `media`;
  - manifest, fast test: `id: "/"`, `scope: "/"`, `lang: "es"`, `display: "standalone"`, `theme_color` and `background_color` equal to `--papel`, no `orientation`; 192 and 512 icons `any` and a 512 `maskable` present;
  - installability: the manifest still passes the browser's installability check on `localhost` with its new fields;
  - status bar, front test driving `data-tema` directly: `theme-color` is light `--papel` with no attribute, the dark paper token with `oscuro`, light again once the attribute is removed, and stays light with the system emulated dark and no attribute;
  - static checks: no screen-tied `vh` left in `app.css` (`dvh` instead); the four inset tokens exist, and the bar, the header, "+ Nueva venta", sheets and toasts use them; no existing token value changed;
  - regression: the accounts, navigation and feedback suites pass unchanged; the bar fits at 320 px with text at 130 %; the pressed state uses tokens only, in both themes;
  - by eye, in portrait, on a real iPhone installed over the home network and a real Android phone on the published installation:
    - criterion 33, with Nueva venta, Registrar cobro and the expense form open with the keyboard;
    - criterion 35, with the pressed state visible in both themes;
    - the Android status bar in both themes;
    - the iOS light strip, with the top inset handled;
    - the maskable icon on the Android launcher.
- **Nothing invented (criterion 7)**:
  - the bar, the sidebar, Más and Configuración show exactly the entries navigation.md lists;
  - every figure on Inicio equals the API's answer, with real zeros for a period with no activity (results.md);
  - Inicio shows no notices other than the first-run checklist, "Arrancá por las variedades", the pinned catalog's and the after-import notice.
- **Password change (criterion 18)**:
  - after a Change, every earlier token of the user answers 401;
  - the acting device's fresh token works, and a partner's token in the same business still works;
  - through the front, from a phone viewport, a Change completes (`web/e2e/passwords.spec.ts`); its duration is not measured by any test.
- **Reset matrix (criterion 19)**, 100% passing:
  - a link works once;
  - it is dead after 24 hours (fake clock);
  - it is retired by a newer link;
  - it is retired by a Change and by another completed reset;
  - opening it twice spends nothing;
  - opening and submitting answer the same 404 whatever the cause;
  - a successful reset closes every earlier session.
- **Password secrecy (criterion 20)**:
  - no password, token, digest or link appears in any answer, refusal or log line;
  - after a full front run of both flows, none is in the console or browser storage;
  - the command's link goes to the terminal only.
- **Password brakes (criterion 21)**, with a fake clock:
  - a wrong current password counts for both brakes;
  - either lock refuses Change with the same 429 and timing as login;
  - a successful Change or reset resets only the email's count;
  - the reset routes are never braked.
- **Reset command (criteria 20, 22)**: an email with no user writes 0 rows and retires 0 links.
- **No curl for passwords (criterion 22)**: the end-to-end front run:
  - changes a password from Configuración → Tu cuenta, after which an old session is signed out and this one stays in;
  - completes a reset from a printed link through to Inicio;
  - sees the dead-link state for a used link.
- **Getting in, redesigned (criteria 27–32)**:
  - fast: from a phone viewport, the end-to-end front run accepts an invitation, completes a reset from a printed link and logs in at Entrar, each landing on Inicio signed in (`web/e2e/passwords.spec.ts`); the duration of the links is not measured by any test;
  - states: front tests show each fixed text (brake message, both dead-link texts, "Sin conexión", the retry, both "Eso ya no está." forms, loading); shape and color checked by eye in both themes;
  - loading is not data: a front test shows the loading state holds no digit, currency symbol or placeholder figure;
  - design:
    - `scripts/design/compare.sh` runs before and after for Entrar, NegocioNuevo, Invitacion, `/reset/{token}` and Estados, with the comparisons attached to the PR;
    - a by-eye pass at phone and computer viewports covers the getting-in screens and Estados inside the computer layouts;
    - every design-vs-docs wording difference is listed in the PR;
  - nothing revealed: the same refusal for a wrong password and an unknown email, no attempt count, no brake detail; dead-link and "Eso ya no está." carry no id, name, date or reason;
  - registry: `scripts/design/screens.json` holds `/reset/{token}` and `compare.sh` measures it;
  - no regression: the existing suite passes with no test edited to fit the new look.
- **Nothing survives (criterion 11)**:
  - after a real run on one of two seeded businesses with one of everything, 0 rows carry its id in any table discovered from the schema;
  - pending, used and expired invitations all go;
  - reset links of every status of its users go;
  - `login_guard` holds nothing for the removed emails;
  - a table added to the schema later is covered without changing the command, proven by a test.
- **Export = delete (criteria 8, 11)**:
  - for every exported kind, the count in the file equals the count deleted;
  - every stored field listed above is present, the pricing settings and VIP prices included, and every reference carries a name and an id;
  - no password hash, invitation digest, reset-link digest or secret is in the file;
  - the dry run counts reset links among what is deleted only.
- **Others untouched (criterion 12)**: every table's row count for the other business is identical before and after, and it reads all its data afterwards.
- **Guards (criteria 9, 10)**: 0 rows changed after each of:
  - a dry run (and no file);
  - an unknown email;
  - a wrong name, a cancel or no answer at the prompt (and no file);
  - a forced failure writing the file, reading it back, at the count check, or during the delete.
  - After every forced failure before the commit, no export file is left in the export directory. This includes a failure of the real file adapter after the file was created on disk, partway through writing or syncing it.
- **Commit outcome unknown**: a forced commit failure whose outcome is unknown:
  - keeps the export file, prints the fixed "Commit outcome unknown" line with the path, never prints "nothing deleted" or success, and exits with a failure status;
  - a dry run afterwards answers "no business for that email" when the commit was applied, and names the business with unchanged counts when it was not.
- **File (criterion 8)**: owner-only permissions; an existing file of the same name is never overwritten; the name carries the business name, date and time.
- **No echo (criterion 13)**: the captured terminal output and logs of both modes hold no email, customer name, phone number or amount, only the business name, the path and counts.
- **Clean slate (criterion 13)**: after removal, a removed user's token answers 401, and a new-business invitation accepted with the same email opens an empty business with a clean brake count.
- Removal and password metrics run as fast, self-contained tests.
- **Publishing (criteria 14–17)**: no test reaches the network, Render, Turso or GitHub.
  - **Brakes (criteria 3, 15)**: tested at the HTTP seam with a fake clock, 100% passing. They cover:
    - the email brake (5 in a row, 15 minutes);
    - the address brake (20 within 15 minutes, 15 minutes);
    - cross-counting, lock refusals included;
    - a success resetting only the email's count;
    - the same 429 answer and timing from both locks, disclosing nothing.
  - **Address source (criterion 15)**: the forwarded header is used only from the configured trusted proxy and ignored from anywhere else.
  - **Cookie (criteria 14, 37–38)**: `Secure` is present when HTTPS is configured and absent otherwise, and never follows the request's scheme or headers. The test uses only the fixed time it is handed and gives the same result with the real date moved earlier and later, its own fixed time unchanged; its assertions are never fewer.
  - **No leakage (criteria 14, 15)**:
    - no log line from the login path contains a client address, email or token;
    - the health endpoint answers no business name, id or count.
  - **Rebuildable (criterion 17)**: a check that the repository holds no Turso credential, `age` identity or other secret.
  - **Drill (criterion 16)**:
    - Automated: against a local scratch copy, the drill produces integrity, row counts and the latest change.
    - By hand: the run before going live shows, from the recency field, that the restore is within the under-1-minute bound.
- **Gate green (criteria 39–40)**: the full backend tests check (`uv run --no-project pytest -n auto`) is green, with passed equal to collected and 0 errors; the existing session-length tests pass unchanged. The PR names the cause of the red, and lists any other test that compares a fixed date with the real date (or says none was found).

## Out of scope

- Removing one user while the business stays.
- Sending any email, including the reset link.
- An in-app way to ask for a reset; the operator always issues it.
- Telling the user which sessions were closed; closing one session alone.
- Typing the new password twice.
- Password rules beyond 10 characters.
- Braking the reset routes or the invitation routes.
- The reset command reporting earlier or retired links.
- Listing past or pending invitations; revoking an invitation.
- Exporting a business without removing it (a backup of an active one).
- Importing an export back.
- Removing a business from the app.
- Checking that every user agreed to the removal.
- Removing the export file from the server after handing it over.
- Blocking or marking a rerun after a commit whose outcome is unknown; the dry run is the check.
- Roles within a business.
- Offline use; an install walkthrough on iOS or Android; Capacitor.
- A "follow the system" theme option; a theme control before login; syncing the theme choice per user, per business or across devices.
- A computer-only layout for the getting-in screens; a design file of its own for the reset screen.
- Any state drawn in Estados that no capability defines.
- TLS on the home network, including local certificates: the published installation gets TLS from Render (ADR-0016).
- Live updates between partners: a list refreshes when it is opened or after a save, not when the other partner changes something.
- Stopping a guessing run spread across many addresses and many emails at once.
- A scheduled restore drill; any notification channel to the operator.
- An admin screen, route or navigation entry, or anything operated from a signed-in session.
- A per-business publishing flag or staged rollout.
- The bar's and header's own behaviour (#59), and each screen's own layout, including a save action pinned above the keyboard.
- Building Configuración → Apariencia, and whether or where the theme choice is kept: its own issue.
- A dark splash, and iOS `apple-touch-startup-image` splash images.
- An iOS status bar that follows the theme live.
- A landscape-specific design; locking orientation or disabling zoom.
- A new icon look (a branding change).
- Fixing product code that reads the real date wrongly (its own bug item), and fixing tests that compare a fixed date with the real date but are not red.
