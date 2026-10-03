# Pinned catalog

Each business's own Telegram bot delivers the catalog text (catalog.md) to the business's chat as one pinned message and keeps it in step on its own. The seller sees a test copy in their own chat first. Seen only by its business (ADR-0004). The text comes from the catalog's single author (ADR-0012, catalog). This capability sends it and keeps it current. The bot only publishes; it never takes orders.

## Jobs

**When** something changes what my catalog says (a price is recorded or deleted, a variety sells out or comes back, I hide or edit a variety, I change the header or footer), **I want** the catalog pinned in my business's Telegram chat to update by itself, after I've seen a test copy in my own chat before customers do, **so** my customers never see a stale price or a variety I can't sell, and I never have to remember to copy, paste and pin it again.

Success criteria:

1. **No step of my own**: once a change that affects the catalog is saved, the pin already shows it the next time anyone looks at Telegram. This includes a price entry whose date arrives with nobody saving anything.
2. **One message, always the same one**: publishing or syncing edits the pinned message in place. The chat never fills with old catalogs. Switching the bot or the channel leaves the previous chat's pin untouched, and the seller is told so.
3. **What customers read is the catalog**: the same text as the in-app preview and as Probarlo's test send, with real bold from the same left-to-right `**` pairing (ADR-0012, catalog).
4. **Never surprised by a failure**: the save that triggered a sync (sale, price, stock, catalog edit) always succeeds on its own terms, and the sync happens after it. A stuck pin shows as "Desactualizado", with a one-line reason, on Catálogo and on Inicio.
5. **Businesses never mix and the token stays secret**: one bot, token, channel chat and own chat per business. The token is never shown again once saved. Nothing about the settings or a sync leaks across businesses (ADR-0004, ADR-0005).
6. **Done from the phone**: setup, Probarlo, Publicar and seeing whether the pin is out of date all work from the phone, with no API call by hand.

Setup (token, chats, first Probarlo and Publicar) is judged by criteria 3, 5 and 6. Upkeep is judged by criteria 1, 2 and 4. Upkeep starts only after the first successful Publicar.

## Behaviour

### Bot settings, per business

- One token, one channel chat and one own chat per business.
- **Token**:
  - stored encrypted, keyed from `APOSTROPHE_SECRET_KEY`;
  - once saved, no route returns it and it is never logged;
  - on screen: "Guardado el dd/mm · no se muestra más" with **Cambiar**.
- **Channel chat and own chat**:
  - free text, checked only for "not blank";
  - shown in plain text and editable in place;
  - never sent to logs, the console or browser storage;
  - each field has a short fixed help line saying where to find it.
- **Changing any of the three** re-arms the test gate.

### Probarlo (test send)

- It tests the values typed on the screen, not the saved ones.
- It needs the token and the own chat. The channel chat may be blank.
- **On success**: the typed values are saved, the test counts for the gate, and the toast "Prueba enviada" shows.
- **On failure**: nothing is saved. A fixed inline reason shows that never repeats what was typed, and everything typed stays.
- It sends exactly what would be published, the empty-catalog case included.

### Publicar (publish and pin)

- **What it needs**: a saved channel chat, and a successful Probarlo since the token or either chat last changed. Until then it shows as disabled with "Probalo primero para ver cómo queda".
- **Posting and editing**:
  - The first Publicar to a channel chat posts and pins the message.
  - Every later Publicar edits that same pinned message.
  - It always sends, whether or not the text changed.
  - On success it shows the toast "Catálogo publicado".
- **Failure**: a wrong channel, or a bot that can't post or pin there, fails inline with a fixed reason that never repeats what was typed.

### Upkeep (automatic sync)

- It applies only after the first successful Publicar.
- **Triggers**:
  - price entries recorded or deleted;
  - catalog attributes, header or footer;
  - a variety renamed;
  - stock entries recorded, edited or deleted;
  - sales recorded or deleted, Deshacer included;
  - the start of a new day in Argentina time, for price entries that come into force that day.
- **Rule**: the text is rebuilt on a trigger. The pin is edited only if the new text differs from the last text published. Topping up a variety already in the catalog sends nothing.
- **The triggering save never waits for Telegram**:
  - it answers and shows its own toast on its own terms;
  - the sync happens after it;
  - its toast never mentions the sync;
  - a failed sync never fails, delays or rolls back that save.
- **Paused**: if the settings changed and were not yet tested, upkeep attempts nothing until Probarlo and Publicar succeed again.

### Status

- **Two states only**:
  - "Al día";
  - "Desactualizado", with "El último fue el dd/mm" and one fixed reason that carries no data:
    - "Telegram no respondió": retrying will do;
    - "El bot no puede publicar en el canal": the bot was removed or isn't an admin;
    - "Probalo primero para ver cómo queda": upkeep is paused after a settings change.
- **What it reflects**: the result of the last attempt. There is no pending state: while a sync runs, the previous state stays.
- **Before the first Publicar**: no status shows.
- **Retrying**: a failed sync is retried on the next trigger, or by Publicar. There is no "Reintentar".
- **Where it shows**:
  - on Catálogo, under Probarlo and Publicar;
  - on Inicio: while the pin is out of date, the fixed line "Tu catálogo en Telegram está desactualizado", which opens Catálogo. It is a notice, not a figure (accounts.md).

### Nothing qualifies

- The pin, Probarlo and Publicar use: the header, then "Por ahora no tenemos nada para ofrecer.", then the footer. A blank header or footer is left out.
- This counts as "Al día".
- Catálogo's own empty state and Copiar are unchanged: there is nothing to copy (catalog.md).
- When a variety qualifies again, upkeep restores the full catalog.

### Changing the channel or the token

- The app never edits, unpins or deletes the old pinned message again.
- After a new successful test, the next Publicar posts and pins a new message, and "El último fue" restarts from it.
- Changing either one shows: "El mensaje fijado anterior queda como está; desfijalo vos en Telegram."

### The text

- Exactly the catalog text from the one author (ADR-0012, catalog).
- `**` markers become real Telegram bold, paired left to right. A final unpaired `**` shows as typed.
- The test copy and the published copy are identical for the same data.

### Constraints

- Telegram sits behind a port with a fake adapter in tests. No test reaches the network or uses a real token.
- Every settings and sync table carries `business_id`, taken from the session.
- Every route joins the isolation sweep, the gated-route test and the ownership migration test.
- Refusal codes go in `contract.json` (ADR-0008).
- No route, error, log line or status reveals another business or its bot (ADR-0004, ADR-0005).
- The token, the chats and the text sent never appear in logs, the console or browser storage.

## Metrics

- **Trigger matrix (criterion 1)**: for every trigger, the day change included, an edit is attempted exactly when the built text differs from the last one published. 100% passing.
- **One message per chat (criterion 2)**:
  - one post per channel chat, then edits only: 0 new posts after the first;
  - a channel change gives exactly one new post, and 0 later calls against the old message.
- **Text fidelity (criterion 3)**: across catalog.md's reference set plus the empty case, 0 differences:
  - the source text given to the port equals `GET /catalog`'s text, or the empty-catalog message;
  - the rendered message (markers paired, then removed) equals the in-app preview;
  - the test copy equals the published copy.
- **Resilience (criterion 4)**: with the fake adapter failing:
  - every triggering save succeeds and answers normally;
  - the status reads "Desactualizado" with the right reason, and Inicio shows its line;
  - the next successful trigger or Publicar clears it.

  100% passing.
- **Secrecy and isolation (criterion 5)**:
  - the token is never in any answer, log line or browser storage across a full front run;
  - every route is in the sweep and answers 404 or empty from another business.

  0 leaks.
- **No curl (criterion 6)**: an end-to-end front run:
  - enters the token and own chat;
  - runs Probarlo, then sees Publicar enabled;
  - enters the channel chat and runs Publicar;
  - sees "Al día" on Catálogo and no line on Inicio.

## Out of scope

- Taking orders through the bot.
- More than one channel per business.
- Unpinning or deleting old messages.
- A pending state, or a "Reintentar" control.
- Checking chat formats.
- Live updates while a screen is open.
- A bot shared between businesses.
