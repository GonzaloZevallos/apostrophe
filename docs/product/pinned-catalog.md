# Pinned catalog

Each business's own Telegram bot delivers the catalog text (catalog.md) to the business's chat as one pinned message and keeps it in step on its own. The seller sees a test copy in their own chat first. Seen only by its business (ADR-0004). The text comes from the catalog's single author (ADR-0022). This capability sends it and keeps it current. The bot only publishes; it never takes orders.

Where its pieces live (navigation.md): the bot settings and Probarlo are in Configuración → Integraciones; the pin's status and Publicar are on the catalog screen (catalog.md); Inicio carries the out-of-date notice.

## Jobs

**When** something changes what my catalog says (a price is recorded or deleted, a variety sells out or comes back, I hide or edit a variety, I change the header or footer), **I want** the catalog pinned in my business's Telegram chat to update by itself, after I've seen a test copy in my own chat before customers do, **so** my customers never see a stale price or a variety I can't sell, and I never have to remember to copy, paste and pin it again.

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** every business setting in one place, **so I can** never wonder which of several screens holds what I need. (The navigation job, navigation.md: served here by the bot settings in Configuración → Integraciones.)

Success criteria:

1. **No step of my own**: once a change that affects the catalog is saved, the pin already shows it the next time anyone looks at Telegram. This includes a price entry whose date arrives with nobody saving anything.
2. **One message, always the same one**: publishing or syncing edits the pinned message in place. The chat never fills with old catalogs. Switching the bot or the channel leaves the previous chat's pin untouched, and the seller is told so.
3. **What customers read is the catalog**: the same text as the in-app preview and as Probarlo's test send, with real bold from the same left-to-right `**` pairing (ADR-0022).
4. **Never surprised by a failure**: the save that triggered a sync (sale, price, stock, catalog edit) always succeeds on its own terms, and the sync happens after it. A stuck pin shows as "Desactualizado", with a one-line reason, on the catalog screen and on Inicio.
5. **Businesses never mix and the token stays secret**: one bot, token, channel chat and own chat per business. The token is never shown again once saved. Nothing about the settings or a sync leaks across businesses (ADR-0004, ADR-0005).
6. **Done from the phone**: setup and Probarlo in Integraciones, Publicar and seeing whether the pin is out of date on the catalog screen all work from the phone, with no API call by hand.

Setup (token, chats, first Probarlo and Publicar) is judged by criteria 3, 5 and 6. Upkeep is judged by criteria 1, 2 and 4. Upkeep starts only after the first successful Publicar.

## Behaviour

### Bot settings, per business (Configuración → Integraciones)

- One token, one channel chat and one own chat per business.
- **Where**: the Integraciones group of Configuración, a form (navigation.md): "Cerrar", and a confirmation when leaving with something typed and not saved.
- **Token**:
  - stored encrypted, keyed from `APOSTROPHE_SECRET_KEY`;
  - once saved, no route returns it and it is never logged;
  - on screen: "Guardado el dd/mm · no se muestra más" with **Cambiar**.
- **Channel chat and own chat**:
  - free text, checked only for "not blank";
  - shown in plain text and editable in place;
  - never sent to logs, the console or browser storage;
  - each field has a short fixed help line saying where to find it.
- **Saved only through Probarlo**: settings are saved only when a test of the typed values succeeds, so the saved settings have always been tested.
- **Changing any of the three** re-arms the test gate. The successful Probarlo that saves the change satisfies it again.
- **Changing only the own chat** leaves the channel and its pin as they were: upkeep goes on and the status doesn't change.

### Probarlo (test send, in Integraciones)

- It tests the values typed on the screen, not the saved ones.
- It needs the token and the own chat. The channel chat may be blank.
- **On success**: the typed values are saved, the test counts for the gate, and the toast "Prueba enviada" shows.
- **On failure**: nothing is saved. A fixed inline reason shows that never repeats what was typed, and everything typed stays. A text over Telegram's limit fails with "Es demasiado largo para Telegram: acortá aromas u ocultá variedades."
- It sends exactly what would be published, the empty-catalog case included.

### Publicar (publish and pin, on the catalog screen)

- **What it needs**: a saved channel chat, and a successful Probarlo since the token or either chat last changed. Until then it shows as disabled with its reason in words ("Probalo primero para ver cómo queda", or that the channel is missing) and a link to Configuración → Integraciones.
- **Posting and editing**:
  - The first Publicar to a channel chat posts the message and pins it.
  - A later Publicar edits that same message and pins it again, so a message unpinned by hand is pinned back.
  - If that message no longer exists (deleted by hand), Publicar posts and pins a new one in the same chat. Upkeep then edits the new one.
  - It always sends, whether or not the text changed.
  - On success it shows the toast "Catálogo publicado".
- **Failure**:
  - A wrong channel, or a bot that can't post or pin there, fails inline with a fixed reason that never repeats what was typed.
  - A text over Telegram's limit fails inline with "Es demasiado largo para Telegram: acortá aromas u ocultá variedades." Nothing is sent.

### Upkeep (automatic sync)

- It applies to a channel chat only after the first successful Publicar to it.
- **Triggers**:
  - price entries recorded or deleted;
  - catalog attributes, header or footer;
  - a variety renamed;
  - stock entries recorded, edited or deleted;
  - sales recorded or deleted, Deshacer included;
  - the start of a new day in Argentina time, for price entries that come into force that day.
- **Rule**: the text is rebuilt on a trigger. The pinned message is edited only if the new text differs from the last text published. Topping up a variety already in the catalog sends nothing.
- **It only ever edits.** Upkeep never posts a new message, even when the old one was deleted by hand.
- **The triggering save never waits for Telegram**:
  - it answers and shows its own toast on its own terms;
  - the sync happens after it;
  - its toast never mentions the sync;
  - a failed sync never fails, delays or rolls back that save.
- **Too long**: a change that makes the text exceed Telegram's limit is still saved. The edit is not sent, and the pin keeps its last text until a later change brings the text back under the limit.
- **After a token or channel change**: nothing is attempted in the new chat until its first Publicar.

### Status

- **Two states only**:
  - "Al día";
  - "Desactualizado", with one fixed reason that carries no data:
    - "Telegram no respondió": retrying will do;
    - "El bot no puede publicar en el canal": the bot was removed or isn't an admin, and the seller must fix it in Telegram;
    - "El mensaje fijado ya no está: publicalo de nuevo": the message was deleted by hand;
    - "Falta publicarlo con el bot o el canal nuevo": a token or channel change was tested and saved, but not yet published;
    - "Es demasiado largo para Telegram: acortá aromas u ocultá variedades.": the text exceeds Telegram's limit.
- **"El último fue el dd/mm"**: shows whenever the current channel chat has been published to. After a token or channel change, it is left out until the first Publicar there.
- **What it reflects**: the result of the last attempt, or the unpublished token or channel change. There is no pending state: while a sync runs, the previous state stays.
- **Before the first Publicar ever**: no status shows.
- **Retrying**: a failed sync is retried automatically on the next trigger, or by Publicar. There is no "Reintentar".
- **Where it shows**:
  - on the catalog screen, next to Publicar (catalog.md);
  - on Inicio: while the status is "Desactualizado", the fixed line "Tu catálogo en Telegram está desactualizado", which opens the catalog screen. It is a notice, not a figure (results.md).

### Nothing qualifies

- The pin, Probarlo and Publicar use: the header, then "Por ahora no tenemos nada para ofrecer.", then the footer. A blank header or footer is left out.
- This counts as "Al día".
- The catalog screen's own empty state and Copiar are unchanged: there is nothing to copy (catalog.md).
- When a variety qualifies again, upkeep restores the full catalog.

### Changing the channel or the token

- The app never edits, unpins or deletes the old pinned message again.
- After the successful test that saves the change, the status reads "Desactualizado · Falta publicarlo con el bot o el canal nuevo".
- The next Publicar posts and pins a new message, and "El último fue" restarts from it.
- Changing either one shows, in Integraciones: "El mensaje fijado anterior queda como está; desfijalo vos en Telegram."

### The text

- Exactly the catalog text from the one author (ADR-0022).
- `**` markers become real Telegram bold, paired left to right. A final unpaired `**` shows as typed.
- The test copy and the published copy are identical for the same data.
- **Length**: measured as Telegram measures it, on the message as sent. Over Telegram's limit it is never split or cut; it is refused, as above.

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
  - one post per channel chat, then edits only: 0 new posts while that message exists;
  - a channel or token change gives exactly one new post, and 0 later calls against the old message;
  - with the message deleted in the fake adapter, upkeep posts nothing and reports "El mensaje fijado ya no está: publicalo de nuevo"; the next Publicar posts and pins exactly one new message;
  - every Publicar pins the message it edits.
- **Text fidelity (criterion 3)**: across catalog.md's reference set plus the empty case, 0 differences:
  - the source text given to the port equals `GET /catalog`'s text, or the empty-catalog message;
  - the rendered message (markers paired, then removed) equals the in-app preview;
  - the test copy equals the published copy.
- **Too long (criteria 3, 4)**: a text over Telegram's limit is never split or cut, and nothing is sent. Probarlo and Publicar refuse it inline. Upkeep leaves the pin as it was and reports the length reason. The triggering save succeeds. 100% passing.
- **Resilience (criterion 4)**: with the fake adapter failing:
  - every triggering save succeeds and answers normally;
  - the status reads "Desactualizado" with the right reason on the catalog screen, and Inicio shows its line, which opens the catalog screen;
  - the next successful trigger or Publicar clears it.

  100% passing.
- **Settings changes (criteria 2, 4)**:
  - changing only the own chat keeps upkeep running and the status unchanged;
  - a tested token or channel change reads "Falta publicarlo con el bot o el canal nuevo", with no "El último fue", until Publicar.
- **Unavailable Publicar**: with no saved channel or no successful Probarlo since the last change, the catalog screen shows Publicar disabled with its reason in words and a link that opens Integraciones.
- **Secrecy and isolation (criterion 5)**:
  - the token is never in any answer, log line or browser storage across a full front run;
  - every route is in the sweep and answers 404 or empty from another business.

  0 leaks.
- **No curl (criterion 6)**: an end-to-end front run:
  - in Configuración → Integraciones, enters the token, the own chat and the channel chat and runs Probarlo;
  - on the catalog screen, sees Publicar enabled and runs it;
  - sees "Al día" on the catalog screen and no line on Inicio.

## Out of scope

- Taking orders through the bot.
- More than one channel per business.
- Unpinning or deleting old messages.
- Splitting a long catalog across several messages, or cutting it short.
- Upkeep posting a new message on its own.
- A pending state, or a "Reintentar" control.
- Checking chat formats.
- Live updates while a screen is open.
- A bot shared between businesses.
