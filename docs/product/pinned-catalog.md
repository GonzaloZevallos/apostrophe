# Pinned catalog

Each business's own Telegram bot delivers the catalog text (catalog.md) to the business's chat as one pinned message and keeps it in step on its own. The seller sees a test copy in their own chat first. Seen only by its business (ADR-0004). The text comes from the catalog's single author (ADR-0022). This capability sends it and keeps it current. The bot only publishes; it never takes orders.

Where its pieces live (navigation.md):
- the bot settings, Buscar mi chat and Probarlo are in Configuración → Integraciones, with a plain link to the catalog screen;
- the pin's status and Publicar are on the catalog screen (catalog.md);
- Inicio carries the out-of-date notice.

## Jobs

**When** something changes what my catalog says (a price is recorded or deleted, a variety sells out or comes back, I hide, archive, restore or edit a variety, I change the header or footer, I switch bulk pricing on or off), **I want** the catalog pinned in my business's Telegram chat to update by itself, after I've seen a test copy in my own chat before customers do, **so** my customers never see a stale price or a variety I can't sell, and I never have to remember to copy, paste and pin it again.

**When** I connect my bot in Configuración → Integraciones and tap Probarlo, **I want** it to tell me, if it fails, in one sentence what I have to fix (the token, my chat not started, or my chat number), **so I can** fix it from my phone, test again and get to publishing the catalog without guessing or asking anyone for help.

This refines the setup step of the first job (the test copy before customers see it); it is not a new job. It was filed as a bug: Probarlo blamed the channel for own-chat failures, and the own-chat help line promised something the screen did not do. Before the fix, the seller guessed, checking the token and the number blindly, or asked someone.

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** every business setting in one place, **so I can** never wonder which of several screens holds what I need. (The navigation job, navigation.md: served here by the bot settings in Configuración → Integraciones.)

**When** I need to change how my business is set up (rename it, bring in a partner, connect or switch the Telegram bot, edit the catalog's header and footer, manage my expense categories, switch to dark, change my password or log out), **I want** every business-wide setting in one place, each in its own short screen, **so I can** change it in a few taps from my phone and get back to the customer, without wondering which screen holds it. (Served here by Integraciones: the bot's token, chats, Buscar mi chat and Probarlo, and a way forward to publish.)

**When** a variety I loaded by mistake, or one I no longer work with, keeps showing in my lists and pickers, **I want** to take it out from my phone in a few taps, deleting it if it never moved and archiving it if it has history, **so** my lists show only what I still sell, no past sale, stock, cost or profit figure changes, and I can bring it back exactly as it was if I start selling it again. (Served here by archiving and restoring being upkeep triggers; defined in varieties.md.)

Success criteria:

1. **No step of my own**: once a change that affects the catalog is saved, the pin already shows it the next time anyone looks at Telegram. This includes a price entry whose date arrives with nobody saving anything.
2. **One message, always the same one**: publishing or syncing edits the pinned message in place. The chat never fills with old catalogs. Switching the bot or the channel leaves the previous chat's pin untouched, and the seller is told so.
3. **What customers read is the catalog**: the same text as the in-app preview and as Probarlo's test send, with real bold from the same left-to-right `**` pairing (ADR-0022).
4. **Never surprised by a failure**: the save that triggered a sync (sale, price, stock, withdrawal, catalog edit, archive or restore, pricing settings) always succeeds on its own terms, and the sync happens after it. A stuck pin shows as "Desactualizado", with a one-line reason, on the catalog screen and on Inicio.
5. **Businesses never mix and the token stays secret**: one bot, token, channel chat and own chat per business. The token is never shown again once saved. Nothing about the settings or a sync leaks across businesses (ADR-0004, ADR-0005).
6. **Done from the phone**: setup, Buscar mi chat and Probarlo in Integraciones, Publicar and seeing whether the pin is out of date on the catalog screen all work from the phone, with no API call by hand. From Integraciones a plain link leads on to the catalog screen to publish.
7. **Each cause of a failed Probarlo has its own fixed reason**, with a concrete action.
   - An invalid token and an own chat not started each show their own reason.
   - Telegram's "chat not found" can't tell a wrong number from a chat not started. Its one reason names both fixes, so it never points at the wrong one.
   - No reason repeats what was typed, and everything typed stays in the form.
8. **Probarlo never blames the channel**: no Probarlo failure says "El bot no puede publicar en el canal", because Probarlo does not touch the channel. That reason stays unchanged for Publicar and upkeep, with their states and Inicio's notice.
9. **The help line tells the truth**: before testing, the own-chat help says to tap Iniciar on the bot and where to get the number, and the screen does what it promises.
10. **The seller gets to a successful test alone**: with a valid token, the seller goes from a failed Probarlo to a successful one from the phone, following only the screen's reasons and help.

Setup (token, chats, Buscar mi chat, first Probarlo and Publicar) is judged by criteria 3, 5, 6, 7, 8, 9 and 10. Upkeep is judged by criteria 1, 2, 4 and 8. Upkeep starts only after the first successful Publicar.

## Behaviour

### Bot settings, per business (Configuración → Integraciones)

- One token, one channel chat and one own chat per business.
- **Where**: the Integraciones group of Configuración, a form (navigation.md): "Cerrar", and a confirmation when leaving with something typed and not saved. It is the only place they are seen or changed; the catalog screen no longer holds them, and old paths to them redirect here.
- **Token**:
  - stored encrypted, keyed from `APOSTROPHE_SECRET_KEY`;
  - once saved, no route returns it and it is never logged;
  - on screen: "Guardado el dd/mm · no se muestra más" with **Cambiar**.
- **Channel chat and own chat**:
  - free text, checked only for "not blank";
  - shown in plain text and editable in place;
  - never sent to logs, the console or browser storage;
  - each field has a short fixed help line.
- **The own chat's help line**: "Abrí tu bot en Telegram y tocá Iniciar. Tu número lo ves con @userinfobot, o tocá Buscar mi chat." It replaced "Abrí tu chat con el bot y escribile cualquier cosa para verlo acá.", which promised something the screen did not do. The channel chat's help line is unchanged.
- **Nothing saved yet**: empty fields and no "Guardado" line.
- **Saved only through Probarlo**: settings are saved only when a test of the typed values succeeds, so the saved settings have always been tested.
- **Changing any of the three** re-arms the test gate. The successful Probarlo that saves the change satisfies it again.
- **Changing only the own chat** leaves the channel and its pin as they were: upkeep goes on and the status doesn't change.
- **Link to publish**: a plain link to the catalog screen, where Publicar and the pin's status live. It carries no status and always opens the catalog screen. It is the reverse of the catalog screen's link to Integraciones shown when Publicar is unavailable.
- **No status here**: Integraciones shows no pin status and no Publicar; one fact, one place.

### Buscar mi chat (in Integraciones)

- **Where**: a button next to the "Tu chat" field.
- **Token used**: the token Probarlo would use.
  - It is the typed token, if the seller tapped Cambiar and typed one.
  - Otherwise it is the saved one, which never leaves the server and is never shown, logged or returned.
- **No token of either kind**: the button is disabled and says "Cargá el token primero" in words, never by color alone.
- **What it reads**: only the private chats that wrote to the bot.
  - One private chat counts as one person, whatever the number of messages.
  - Groups and channels never count.
  - It never reads or touches the channel chat field.
- **Exactly one person found**: the field is filled with that chat's number, replacing any number already there, with no confirmation.
- **Any other outcome**: the field stays as it was.
- **It saves nothing.** Settings are still saved only by a successful Probarlo, and the seller can edit the number by hand afterwards.
- **Filling the field counts as a typed change**: leaving Integraciones without saving asks before discarding, like any other change in the group.
- **It shows only the number**, placed in the field: never a name or a username of anyone who wrote to the bot.
- **Its reasons** show inline, in the same place as Probarlo's. Each is fixed text that never repeats what was typed, and what was typed stays.

| Outcome | Reason |
|---|---|
| Nobody has written to the bot | "Todavía no vemos mensajes en tu bot: abrilo en Telegram, tocá Iniciar y buscá de nuevo." |
| More than one person wrote privately | "Le escribió más de una persona a tu bot: buscá tu número con @userinfobot y escribilo acá." |
| Messages can't be read (for example a bot with a webhook), or any other failure | "No pudimos leer los mensajes de tu bot: buscá tu número con @userinfobot y escribilo acá." |
| Invalid token | "El token no es válido: copialo de nuevo de @BotFather." |
| Telegram down, 429 or no connection | "Telegram no respondió" |

- **The app never changes the bot's setup.** It neither asks the seller to change it in Telegram nor changes it itself. An unreadable bot is rare, since the app never sets a webhook, and the manual path through @userinfobot is enough.

### Probarlo (test send, in Integraciones)

- It tests the values typed on the screen, not the saved ones.
- It needs the token and the own chat. The channel chat may be blank, and Probarlo never checks or touches it.
- **On success**: the typed values are saved, the test counts for the gate, and the toast "Prueba enviada" shows.
- **On failure**: nothing is saved. A fixed inline reason shows that never repeats what was typed, and everything typed stays.

| Cause | Reason |
|---|---|
| Invalid token (401) | "El token no es válido: copialo de nuevo de @BotFather." |
| Own chat not started, or the seller blocked the bot (403) | "Abrí tu bot en Telegram y tocá Iniciar, después probalo de nuevo." |
| Own chat not found (400 "chat not found"): a wrong number, or a right number whose chat was never started, which Telegram does not tell apart | "No encontramos tu chat: revisá el número y tocá Iniciar en tu bot." |
| Telegram down, 429 or no connection | "Telegram no respondió" |
| Text over Telegram's limit | "Es demasiado largo para Telegram: acortá aromas u ocultá variedades." |
| Any other failure | "No pudimos enviarte la prueba: revisá el token y tu chat." |

- **None of Probarlo's reasons mentions the channel.** Reasons depend on the action, not only on Telegram's answer.
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
  - A wrong channel, or a bot that can't post or pin there, fails inline with a fixed reason that never repeats what was typed. A 401, 403 or 400 against the channel reads "El bot no puede publicar en el canal", as before; Publicar has no token reason of its own.
  - A text over Telegram's limit fails inline with "Es demasiado largo para Telegram: acortá aromas u ocultá variedades." Nothing is sent.

### Upkeep (automatic sync)

- It applies to a channel chat only after the first successful Publicar to it.
- **Triggers**:
  - price entries recorded or deleted;
  - catalog attributes, header or footer;
  - a variety renamed;
  - a variety archived or restored (varieties.md);
  - stock entries recorded, edited or deleted;
  - stock withdrawals recorded, edited or deleted;
  - sales recorded or deleted, Deshacer included;
  - a save of Configuración → Precios that changes either pricing switch (pricing-settings.md), since the bulk line depends on Precio por cantidad;
  - the start of a new day in Argentina time, for price entries that come into force that day.
- **Rule**: the text is rebuilt on a trigger. The pinned message is edited only if the new text differs from the last text published. Topping up a variety already in the catalog, or withdrawing grams that leave it with stock above zero, sends nothing.
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
- **Not affected by Probarlo or Buscar mi chat**: their failures never change the status.
- **Before the first Publicar ever**: no status shows.
- **Retrying**: a failed sync is retried automatically on the next trigger, or by Publicar. There is no "Reintentar".
- **Where it shows**:
  - on the catalog screen, next to Publicar (catalog.md);
  - on Inicio: while the status is "Desactualizado", the fixed line "Tu catálogo en Telegram está desactualizado", which opens the catalog screen. It is a notice, not a figure (results.md);
  - never in Integraciones.

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

- Exactly the catalog text from the one author (ADR-0022), which never includes an archived variety, never carries a VIP price and carries the bulk line only while Precio por cantidad is on (catalog.md).
- `**` markers become real Telegram bold, paired left to right. A final unpaired `**` shows as typed.
- The test copy and the published copy are identical for the same data.
- **Length**: measured as Telegram measures it, on the message as sent. Over Telegram's limit it is never split or cut; it is refused, as above.

### Constraints

- Telegram sits behind a port with a fake adapter in tests. No test reaches the network or uses a real token.
- Every settings and sync table carries `business_id`, taken from the session.
- Every route, Buscar mi chat's included, joins the isolation sweep and the gated-route test, and every table route joins the ownership migration test.
- Refusal codes go in `contract.json` (ADR-0008), one per reason:
  - Probarlo's token invalid, own chat not started, own chat not found and generic failure;
  - Buscar mi chat's no messages, several chats and unreadable messages.
- No route, error, log line or status reveals another business or its bot (ADR-0004, ADR-0005).
- The token, the chats, the number found, the text sent and anything Telegram answers never appear in logs, the console or browser storage. Buscar mi chat's answer holds only the number found or a refusal code: never a name, a username, the token or Telegram's own text.

## Metrics

- **Trigger matrix (criterion 1)**: for every trigger, stock withdrawals, the day change, archiving and restoring a variety and a Precios save included, an edit is attempted exactly when the built text differs from the last one published. A withdrawal that takes a variety's stock to zero or below edits the pin; one that leaves the text unchanged sends nothing. Switching Precio por cantidad on a business with a bulk price in force edits the pin; switching only Clientes VIP sends nothing, since the text does not change. 100% passing.
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
  - every triggering save, a withdrawal included, succeeds and answers normally;
  - the status reads "Desactualizado" with the right reason on the catalog screen, and Inicio shows its line, which opens the catalog screen;
  - the next successful trigger or Publicar clears it.

  100% passing.
- **Settings changes (criteria 2, 4)**:
  - changing only the own chat keeps upkeep running and the status unchanged;
  - a tested token or channel change reads "Falta publicarlo con el bot o el canal nuevo", with no "El último fue", until Publicar.
- **Unavailable Publicar**: with no saved channel or no successful Probarlo since the last change, the catalog screen shows Publicar disabled with its reason in words and a link that opens Integraciones.
- **Integraciones**: a front test shows:
  - the link to the catalog screen, no pin status and no Publicar;
  - empty fields and no "Guardado" line with nothing saved;
  - the "desfijalo vos en Telegram" line after a token or channel change.
- **Probarlo's reasons (criterion 7)**: 100% passing.
  - There is one test per cause: 401; 403 (both "can't initiate conversation" and "blocked by the user"); 400 chat not found, which shows "No encontramos tu chat: revisá el número y tocá Iniciar en tu bot."; Telegram down, 429 or no connection; too long; and any other failure.
  - Each shows its fixed text, repeats nothing typed, keeps the form and saves nothing.
- **Probarlo never blames the channel (criterion 8)**: across every Probarlo failure, "El bot no puede publicar en el canal" never appears. Publicar and upkeep against the channel still produce it, and their states and Inicio's notice are unchanged. 100% passing.
- **Help line (criterion 9)**: a front test shows the new own-chat help line and the unchanged channel help line.
- **Buscar mi chat**: 100% passing.
  - Exactly one private chat (with several messages) fills the field and replaces an existing number.
  - Each of these shows its own reason and leaves the field as it was: no messages, more than one private chat, unreadable messages, another failure, a bad token and Telegram down.
  - Groups and channels are never counted.
  - The typed token is used over the saved one.
  - With no token, the button is disabled with "Cargá el token primero".
  - The search saves nothing.
  - A filled field triggers the unsaved-changes confirmation.
  - The answer holds only the number or a refusal code.
- **Secrecy and isolation (criterion 5)**:
  - after a full front run, the token, the number found and any text from Telegram are in no answer beyond the number placed in the field, and in no log line or browser storage;
  - every route, Buscar mi chat's included, is in the sweep and the gated-route test, and answers 404 or empty from another business.

  0 leaks.
- **No curl (criteria 6, 10)**: an end-to-end front run, from a phone viewport:
  - in Configuración → Integraciones, enters the token, runs Probarlo with a chat not started, and sees its reason;
  - fills the own chat with Buscar mi chat and enters the channel chat;
  - runs Probarlo successfully;
  - follows Integraciones' link to the catalog screen, sees Publicar enabled and runs it;
  - sees "Al día" on the catalog screen and no line on Inicio.

## Out of scope

- Taking orders through the bot.
- More than one channel per business.
- Unpinning or deleting old messages.
- Splitting a long catalog across several messages, or cutting it short.
- Upkeep posting a new message on its own.
- A pending state, or a "Reintentar" control.
- The pin's status or Publicar in Integraciones.
- Checking chat formats.
- Live updates while a screen is open.
- A bot shared between businesses.
- Changing the reasons of the channel, Publicar or upkeep.
- Any check of the channel in Probarlo or Buscar mi chat.
- Telling a wrong own-chat number from a chat not started when Telegram answers "chat not found" for both.
- Changing the bot's setup in Telegram (a webhook, for one), or asking the seller to.
- Saving a number found by Buscar mi chat without a successful Probarlo.
- Showing the names or usernames of people who wrote to the bot, or letting the seller pick among several.
