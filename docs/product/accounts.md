# Accounts

Businesses, their users, the only way in (an invitation and a login), and the only way out (an operator's command that exports a business and removes it). Every other capability reads one thing from here, the business of the user asking, and serves that business alone (ADR-0004). It also holds the app as a whole: how it is served, installed and navigated, the feedback rules every screen follows, and the Negocio screen. Inicio, where the app opens, is the panel defined in results.md.

## Jobs

**When** a friend wants to use the app for their own business, **I want** to hand them a link that opens a business of their own, **so I can** add them without seeing or touching anything they will record.

**When** I sell together with a partner, **I want** to invite them into my business, **so we** both record sales on the same books.

**When** I open the app on my phone, **I want** to log in once and stay in, **so I can** record a sale in seconds, while nobody else on the network or who guesses at passwords gets in.

**When** I run my business from my phone (handing over an order, answering a customer on Telegram, paying for something, or catching up at the end of the day), **I want to** get in with the link I was sent and keep my customers, my prices, my stock and my expenses up to date from the phone, **so I can** stop keeping them in the spreadsheet and have real data in place when sales arrive. The computer is the same job on a bigger screen.

**When** a friend stops using the app, or asks to be taken out of it, **I want** to hand them everything the app holds of their business in one file and then remove that business from the installation completely, **so that** they keep their books and their customers' names, phone numbers and balances are no longer held by me or by anyone else on the installation. A business opened by mistake is covered by the same command. The business goes as a whole, every user included. The operator has agreed with every user of the business beforehand; the command does not check it.

Success criteria:

1. Nothing of one business is reachable from another, through any route: by id it does not exist (404), in a list it is absent.
2. Nobody gets in without an invitation; each invitation lets one person in, once, within seven days.
3. Repeated wrong passwords stop working for a while, and nothing in the answers tells which emails have a user.
4. No `curl` at any point. From the phone alone, a seller can do everything the backend does, starting with opening or joining a business from the invitation link.
5. It feels like a phone app.
   - It sits on the home screen with its own name and icon. On iOS it installs over the home network. On Android it is a home-screen shortcut there, and a full install once the app is published with TLS.
   - It follows the phone's light or dark setting.
   - It says "Sin conexión" when the network drops.
   - No state is told by color alone (blue ↔ amber, never green ↔ red).
6. Businesses stay invisible to each other in the browser too.
   - No business in a URL.
   - No personal data or money in the console or browser storage.
   - The session lives only in the backend's cookie.
   - Serving the front reaches nothing outside the built app.
7. Nothing invented: no placeholder figures, and no navigation entry for something that does not exist yet.

Success criteria, removing a business:

8. **The file is their books and stands on its own**: one JSON file holds every recorded fact of the business, opens without the app, identifies the business by its name, and names what each record refers to as well as its id. It holds no password hash, no stored secret and no invitation.
9. **Named back before anything is lost**: the dry run names the business and counts by kind what would go, writing nothing. The real run asks for the business name typed exactly before it touches anything.
10. **Nothing deleted until the export is safe**: the delete runs only after the file was written and read back in the same run, and the exported counts equal the deleted counts. Any failure or mismatch deletes nothing.
11. **Nothing survives**: no row carrying the business's id is left in any table, including tables added later. Its invitations of every status and its users' login-attempt history go too. The export is built from the same tables as the delete; invitations are deleted, never exported.
12. **Every other business is untouched**: their record counts are the same before and after, and they keep working, are never slowed on purpose and are never told anything.
13. **No personal data outside the file, and a clean slate**: the terminal and logs show only the business name, the file's path and counts. Afterwards the same email can open a new business with nothing carried over.

## Behaviour

### Invitations and login

- **New-business invitation**: printed by `scripts/invite-business.sh`. Accepting it takes a business name, an email and a password, and opens the business with that user in it.
- **Join invitation**: any user creates one from the app (`POST /invitations`). Accepting it takes an email and a password and adds the user to the inviting business; a business name sent along is ignored.
- **Accepting either invitation** signs the person in, as a login does. They land on Inicio of that business.
- **Looking up an invitation** tells its kind, the business it leads to (join only) and when it expires. An unknown, used or expired invitation is not found.
- **Email**: trimmed and lowercased; one user per email across the whole installation.
- **Password**: at least 10 characters; stored only as a hash.
- **Login**: email and password answer a session that lasts 30 days, as a cookie and a token. A wrong password and an unknown email get the same answer.
- **Brake**: five failures in a row for an email lock it for 15 minutes, even for the right password; a success resets the count.
- `GET /auth/me` answers the user's email and their business's name.
- Logging out drops the cookie.

### Business

- **Reading the business** answers its name and its users. Users are shown by email only, sorted by email.
- **Renaming the business**:
  - The name is trimmed, inner spaces are collapsed, it is up to 60 characters and it cannot be blank.
  - There is no uniqueness check across the installation, since a refusal would reveal another business.
- Both routes take the business only from the session. They are in `tests/test_gated_routes.py` and the isolation sweep.

### Removing a business (operator command)

- **The command**: a server command run by the operator, like `scripts/invite-business.sh`. No administrator and no entry for it in the app (ADR-0002).
  - It names the business by the email of any of its users, trimmed and lowercased as at login.
  - An email matching no user prints a plain "no business for that email" and does nothing, in either mode.
- **Dry run**:
  - names the business found;
  - prints counts by kind: users, customers, varieties, price entries, stock entries, sales, sale lines, payments, expenses, expense categories, catalog settings, and invitations (deleted only);
  - writes no file, changes no row, never asks for confirmation.
- **Real run**:
  1. Names the business and asks the operator to type its name exactly; it cannot skip this. A wrong name, a cancel or no answer writes nothing and deletes nothing.
  2. Writes the export file, then reads it back.
  3. In one transaction, deletes every row of the business across every table discovered from the schema (not a hand-kept list): the business, its users, every invitation whatever its status, and the removed users' emails' login-attempt history.
  4. Commits and reports success only if the exported counts equal the deleted counts for every exported kind.
  5. Reports the business name, the file's path, and the counts exported and deleted.
- **Any failure before the commit** deletes nothing: writing or reading back the file, a count mismatch, or a database busy with other businesses' writes. The operator runs it again. A record created by the leaving business's own users between export and delete makes the counts differ, and the delete is blocked rather than losing it.
- **Other businesses** keep using the app during the run, are never slowed on purpose and are never told anything.
- **The export file**:
  - one JSON file per real run, owner-only permissions, written to the server's file system and never anywhere the app serves;
  - its name carries the business name (slugified) and the run's date and time; an existing file is never overwritten;
  - plain values: ISO 8601 dates, whole pesos, grams as decimals with up to two places;
  - each record names what it refers to (customer, variety, category) as well as its id;
  - it holds every recorded fact as stored: the business name; users (email and joining date); customers (name, phone number, channel, VIP); varieties with their low-stock threshold and catalog attributes; price entries; stock entries (date, variety, grams, origin, total cost, note; a lot is its stock entry, not a separate record); sales (date, customer, shipping charged, note, how it was paid); sale lines (variety, grams, stored price per gram, pricing rule, line total); payments (date, amount, method, customer, and their sale for an on-the-spot payment); expense categories and expenses; the catalog header and footer;
  - it leaves out computed figures (balances, owing since, settlement, stock, cost per gram, cost of goods), password hashes, any stored secret (such as a future Telegram bot token), invitations and login-attempt history.
- **After removal**:
  - a session left open by a removed user gets 401 and goes to login;
  - a new invitation to the same email opens a new business like any other, with a clean login-attempt count and nothing of the old business.
- **Privacy** (ADR-0005): nothing personal is printed or logged (no emails, names, phone numbers, amounts or file contents). The business name is not personal data and may be printed.

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
- **Install once published with TLS**: Android's own install prompt is offered when the browser makes it available. The manifest and service worker already in place need no further work for it.
- **No network**: when a request fails because the network dropped, the open app shows "Sin conexión" on any origin. This does not rely on the service worker.
- **Theme**: light and dark follow the phone. The font is self-hosted.
- **Language and formats**: every word on screen in Rioplatense Spanish with vos. Money `$ 11.000`, a negative amount `−$ 4.500`, grams `3,5 g`, dates `dd/mm`. The catalog text keeps its own Telegram format (`$11.000`, catalog.md).
- **Getting in** (`Entrar`, `NegocioNuevo`, `Invitacion`):
  - Login shows a fixed hint under the button that five failed attempts lock the email for 15 minutes. It shows no count of attempts left. The lock shows the brake message.
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
  - installing on a phone over the home network is not checked automatically;
  - both themes render from the tokens;
  - an offline check shows "Sin conexión";
  - no state is told by color alone.
- **Nothing invented (criterion 7)**:
  - the bar shows exactly Inicio, Ventas, Clientes, Stock and Más, plus the "Nueva venta" button;
  - Más shows exactly Gastos, Variedades, Catálogo and Negocio;
  - every figure on Inicio equals the API's answer, with real zeros for a period with no activity (results.md).
- **Nothing survives (criterion 11)**: after a real run on one of two seeded businesses with one of everything, 0 rows carry its id in any table discovered from the schema; pending, used and expired invitations all go; `login_guard` holds nothing for the removed emails; a table added to the schema later is covered without changing the command, proven by a test.
- **Export = delete (criteria 8, 11)**: for every exported kind, the count in the file equals the count deleted; every stored field listed above is present and every reference carries a name and an id; no password hash, invitation digest or secret is in the file.
- **Others untouched (criterion 12)**: every table's row count for the other business is identical before and after, and it reads all its data afterwards.
- **Guards (criteria 9, 10)**: 0 rows changed after each of: a dry run (and no file), an unknown email, a wrong name, a cancel or no answer at the prompt (and no file), and a forced failure writing the file, reading it back, at the count check, or during the delete.
- **File (criterion 8)**: owner-only permissions; an existing file of the same name is never overwritten; the name carries the business name, date and time.
- **No echo (criterion 13)**: the captured terminal output and logs of both modes hold no email, customer name, phone number or amount, only the business name, the path and counts.
- **Clean slate (criterion 13)**: after removal, a removed user's token answers 401, and a new-business invitation accepted with the same email opens an empty business with a clean brake count.
- Removal metrics run as fast, self-contained tests.

## Out of scope

- Changing or resetting a password from the app; removing one user while the business stays.
- Listing past or pending invitations; revoking an invitation.
- Exporting a business without removing it (a backup of an active one); importing an export back; removing a business from the app; checking that every user agreed; removing the export file from the server after handing it over.
- Roles within a business.
- Offline use; an install walkthrough on iOS or Android.
- TLS on the home network, including local certificates: it comes with publishing the app (ADR-0002), and with it the full Android install.
- Live updates between partners: a list refreshes when it is opened or after a save, not when the other partner changes something.
- The Análisis entry: it comes with its own task.
