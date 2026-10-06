# Apostrophe

The back office of small businesses that sell flower by the gram: what each sells and at what price, what comes in and goes out of stock, who owes what, what it spends, and whether it makes money. One installation keeps several businesses, and they never mix. Replaces the spreadsheet `Control_de_ventas_y_gastos`.

Each term carries `_In the app_`: the Spanish word a user sees on screen. Code, tests and docs use the English term.

## Businesses and users

**Business**:
One seller's operation and everything recorded for it: varieties, prices, customers, sales, stock, expenses and catalog. Nothing recorded for one business is ever visible from another.
_In the app_: Negocio
_Avoid_: tenant, account, store, shop, organization

**User**:
A person who logs in to the app and works on exactly one business.
_In the app_: Usuario
_Avoid_: operator, admin, member, seller, customer (customers never log in)

**Invitation**:
A link that lets one person in, once, within seven days: either to open a new business of their own, or to join the business that issued it.
_In the app_: Invitación
_Avoid_: signup link, referral, code

## Catalog and prices

**Variety**:
A strain a business sells by the gram, identified by its name within that business. Its stock, entries, prices, low-stock warning and catalog attributes are all on its own page in the Variedades tab. In the app: Variedad; the tab is Variedades.
_Avoid_: product, strain, item, SKU
_In the app_: Variedad

**Price entry**:
A variety's list price, bulk price and bulk minimum, effective from a date onwards. Never edited once recorded: a later entry supersedes it from its own date. A mistaken entry is deleted, never rewritten; a sale is unaffected because every sale line records the price it was sold at.
_In the app_: Precio (historial de precios)
_Avoid_: price change, price update, tariff

**Current price**:
For a variety on a given date, the price entry with the latest effective date on or before that date. A variety with no such entry has no price that day.
_In the app_: Precio vigente
_Avoid_: today's price, active price

**List price**:
The price per gram of a variety when no other rule applies.
_In the app_: Precio x g
_Avoid_: base price, regular price

**Bulk price**:
A lower price per gram that applies from the bulk minimum upwards, and always for a VIP customer. Optional: a price entry has both bulk price and bulk minimum, or neither.
_In the app_: Precio por cantidad
_Avoid_: discount, wholesale price

**Bulk minimum**:
The grams from which the bulk price applies.
_In the app_: Cantidad mínima
_Avoid_: threshold, minimum order

## Customers and money owed

**Customer**:
A person a business sells to, identified within that business by their own record. The name is how a user recognises them; the phone number, when there is one, is optional contact data and never required to register or keep selling to someone. The same person buying from two businesses is a different customer in each.
_Avoid_: client, buyer, contact, user
_In the app_: Cliente

**Phone number**:
Optional contact data for a customer, in international form: an Argentine number always as a mobile (+54 9 and 10 digits with area code), a foreign one as + and its country code and digits. A blank value means none. Two customers of a business never share one when both have one; any number of customers may have none.
_Avoid_: contact, handle, username, identifier
_In the app_: Teléfono

**VIP customer**:
A customer who always pays the bulk price, whatever the grams.
_In the app_: Cliente VIP
_Avoid_: friend, Amigo, preferred customer

**Sale**:
Everything a customer takes in one go: a date, at most one customer, the shipping charged, an optional note, and one or more sale lines. A sale counts on its own date, paid or not. Its customer may be left out only when nothing stays owed.
_In the app_: Venta
_Avoid_: order, transaction, purchase (that is flower coming in)

**Sale without a customer**:
A sale paid in full on the spot to someone not registered as a customer, often a buyer who may never come back. It counts in every total and in no customer's history. A customer can be assigned to it later, once; it never moves from one customer to another.
_In the app_: Sin cliente
_Avoid_: anonymous sale, walk-in, guest, consumidor final

**Sale line**:
One variety and its grams within a sale, with the price per gram it was sold at. The bulk minimum is measured per line, never across the sale.
_In the app_: Línea
_Avoid_: item, row, product

**Gift**:
Grams handed over for free: charged $0, still taken from stock.
_In the app_: Regalo
_Avoid_: sample, freebie, promo

**Special price**:
A whole-peso total above $0, typed by hand for one sale line, that replaces the computed one. A free line is a gift, never a $0 special price.
_In the app_: Precio especial
_Avoid_: override, custom price, discount

**Pricing rule**:
Which rule priced a sale line: list, bulk, VIP, gift or special price. Exactly one per line, stored with its price when the sale is recorded and never recomputed.
_In the app_: lista, por cantidad, VIP, regalo, especial
_Avoid_: type, price type, Amigo

**Shipping charged**:
What the customer pays for delivery, added on top of what they bought.
_In the app_: Envío cobrado
_Avoid_: delivery fee, shipping cost (that is an expense)

**Note**:
Free text on a sale to remember what the rest does not say, such as who bought it when there is no customer.
_In the app_: Nota
_Avoid_: comment, description, memo

**Payment**:
Money a customer hands over on a date, in cash or by transfer, with no note. Either an on-the-spot payment recorded with its sale, or a later payment recorded through Registrar cobro, opened by "Cobrar" on a debtor row of Clientes or Inicio or from the customer's card. Its date, amount and method never change; it is deleted and recorded again, never edited. In the app: Cobro.
_Avoid_: collection, settlement, receipt, abono
_In the app_: Cobro

**Balance**:
What a customer owes: what they bought and did not pay, minus their payments, worked out live. A later payment always settles the oldest debt first. Below zero it is a credit. _In the app_: Te debe.
_Avoid_: debt account, tab, cuenta corriente
_In the app_: Cuenta corriente / Debe

**Owing since**:
The date of a customer's oldest sale that is not fully paid.
_In the app_: Desde
_Avoid_: overdue date, due date

## Stock

**Stock entry**:
Grams of a variety coming in on a date, with one origin: purchase, harvest, opening stock or adjustment. A purchase carries its total cost; an adjustment may be negative. Unlike a price entry, any stock entry may be edited or deleted at any time, whatever it already fed: its date, grams, cost or origin (ADR-0009).
_In the app_: Entrada
_Avoid_: restock, delivery, intake

**Purchase**:
A stock entry the business paid for. Its cost is money out on its date.
_In the app_: Compra
_Avoid_: order, buy

**Lot**:
The grams of one stock entry together with their cost per gram. A harvest costs $0 unless a cost is recorded. Grams sold or gifted come out of the oldest lot of their variety first, oldest by date; a stock entry recorded late or corrected takes its place by date and the lots after it are worked out again (ADR-0009).
_In the app_: Lote
_Avoid_: batch

**Stock**:
The grams of a variety on hand: everything that came in minus everything sold or gifted. Can go negative when a sale or gift is recorded for grams not yet in: the figure still shows, never hidden. In the app: Stock, shown on Variedades and a variety's page; there is no Stock tab.
_Avoid_: inventory, balance
_In the app_: Stock

**Pending cost**:
What grams sold or gifted beyond everything recorded as coming in cost: not yet known, and never shown as $0. A later stock entry of that variety, wherever its date falls in the lot order, settles it (ADR-0009).
_In the app_: Costo pendiente
_Avoid_: unknown cost, zero cost

**Draw**:
Grams going out of a variety, taking from its lots oldest first: a sale line (gifts included) or a negative adjustment. It has a costed part and, beyond every lot, pending grams.
_In the app_: no word of its own; on screen it is the line's "Costo de lo vendido".
_Avoid_: outflow, consumption, movement, out

**Lot order**:
The one order a variety's lots and draws are taken in: by date, then by recording order.
_In the app_: no word of its own.
_Avoid_: chain, chain position, FIFO order

**Low-stock threshold**:
Optional grams under which a variety's stock counts as low.
_In the app_: Avisar con menos de
_Avoid_: reorder point, alert level

## Results

**Cost of goods sold**:
What the grams sold or gifted in a period cost, taken from the lots they came out of as those lots stand today, oldest first; it is worked out again whenever an earlier stock entry changes, however far back (ADR-0009). Part of it may be pending cost.
_In the app_: Costo de lo vendido
_Avoid_: COGS, average cost, cost per gram

**Expense**:
Money spent on something other than flower, filed under one expense category. Flower bought is a purchase, never an expense.
_In the app_: Gasto
_Avoid_: cost, outflow, bill

**Expense category**:
A business's own heading for its expenses, with a name unique within that business whatever the case or spacing. Every business starts with "Insumos de cultivo", "Packaging", "Envíos y traslados" and "Otros"; a category cannot be removed while it has expenses.
_In the app_: Categoría
_Avoid_: type, tag, label, account, cost center

**Profit**:
Sales (shipping included, paid or not) minus cost of goods sold minus stock shortfall minus expenses, over a period, each counted on its own date. Purchases never enter it. When any of that cost is pending, it is worked out over the costed part (the sales of pending grams are left out) and marked "y N g sin costo", N adding the pending grams sold, gifted and taken out by negative adjustments in the period. It may be negative, and is then shown with a minus sign, never hidden. _In the app_: Ganancia.
_Avoid_: margin, earnings, net
_In the app_: Ganancia

**Cash**:
Payments received minus expenses minus purchases, over a period: the money that actually moved.
_In the app_: Caja
_Avoid_: cash flow, balance, profit

## Telegram

**Catalog**:
The text that offers every shown variety with stock above zero and a current price today: its emoji, name, indica share, aroma and prices, between the business's header and footer. It keeps its **bold** markers and its own money format ($11.000). _In the app_: Catálogo.
_Avoid_: menu, price list, flyer
_In the app_: Catálogo

**Pinned catalog**:
The catalog message pinned in the business's Telegram channel chat by its own bot. Once first published, it is edited in place whenever the catalog text changes, and it is never posted again in that chat. When nothing qualifies, it shows the header, "Por ahora no tenemos nada para ofrecer." and the footer. _In the app_: Mensaje fijado.
_Avoid_: post, broadcast
_In the app_: Mensaje fijado

**Test send**:
The catalog sent only to the user's own Telegram chat, using the bot settings typed on the screen. They are saved only if it succeeds. A successful test since the settings last changed is required before Publicar. _In the app_: Probarlo.
_Avoid_: preview, draft
_In the app_: Enviarme una prueba

**Upkeep**:
The automatic edit of the pinned catalog after a change that may affect its text, or at the start of a new Argentina day. It only ever edits; it never posts or pins. _In the app_: no word of its own.
_Avoid_: sync, auto-publish, refresh
_In the app_: no word of its own

**Last published text**:
The source text (markers included) last sent to the pinned message of the current bot and channel chat. _In the app_: no word of its own.
_Avoid_: cache, last snapshot
_In the app_: no word of its own

## Language

**Stock status**:
How a variety stands on stock, the first that fits in this order: no entries (nothing has moved, with no stock entry and no sale or gift), sold out (stock at or below zero, including sales with no entry), low (above zero and under its low-stock threshold), ok. It is told by shape and word, never by color alone. _In the app_: Sin entradas, agotada, baja, ok.
_Avoid_: stock level, alert, availability

**Days left**:
A variety's stock divided by the average daily grams sold or gifted over the last 30 days, rounded down to whole days. Not shown when stock is at or below zero or nothing went out in those 30 days. _In the app_: Al ritmo de los últimos 30 días.
_Avoid_: runway, coverage, forecast

**Opening stock**:
A stock entry recording grams already on hand when a business starts keeping stock. It is an ordinary origin with no limit per variety, and its lot costs $0 unless a cost is recorded. _In the app_: Stock inicial.
_Avoid_: initial balance, baseline, starting inventory

**Harvest**:
A stock entry of grams the business grew. Its lot costs $0 unless a cost is recorded; cultivation inputs are expenses, never spread over harvests. _In the app_: Cosecha.
_Avoid_: crop, yield, production

**Adjustment**:
A stock entry recording the difference between a physical count and the stock the app shows, plus or minus. A negative adjustment carries no cost and takes its grams out of the oldest lots, as grams going out do. _In the app_: Ajuste.
_Avoid_: correction, recount, shrinkage, write-off

**Catalog attributes**:
What a variety shows in the catalog: whether it is shown, its emoji, its indica share and its aroma. They never affect prices, stock or sales, and are edited only on the variety's own page. In the app: En el catálogo.
_Avoid_: catalog settings, metadata, tags

**Hidden variety**:
A variety the seller chose to leave out of the catalog, whatever its price or stock. Hidden means only that; a variety out for lack of price or stock is not hidden. _In the app_: Oculta.
_Avoid_: inactive, archived, disabled

**Indica share**:
A variety's indica percentage, a whole number from 0 to 100; sativa is the rest. Optional; unknown means the catalog leaves its line out. _In the app_: % índica.
_Avoid_: genetics, ratio, type

**Aroma**:
One line of free text describing a variety's aroma and flavour for the catalog, up to 200 characters. _In the app_: Aroma/sabor.
_Avoid_: description, notes, flavor profile

**Catalog header and footer**:
A business's own text opening and closing the catalog, multi-line and up to 500 characters each; either may be blank, and is then left out. They start as "🌿 **CATÁLOGO** 🌿" and "📩 Consultas y pedidos por privado." and are edited only in Configuración. In the app: Encabezado, Pie, under Mensaje del catálogo.
_Avoid_: title, signature, intro, outro

**On-the-spot payment**:
The payment recorded together with a sale paid in full in cash or by transfer. It settles that sale alone, never an older debt, and is deleted only with its sale. _In the app_: Pagada por efectivo / Pagada por transferencia.
_Avoid_: cash sale, immediate payment

**Settlement**:
Which sales a later payment covers: the customer's oldest debt first (sales by date, then recording order; payments by date, then recording order), whatever the payment's own date. It is worked out live from the sales and payments as they stand now, and never stored. _In the app_: A cuenta de la venta del dd/mm.
_Avoid_: allocation, application, imputación

**Credit**:
A balance below zero, left only when a sale that payments had settled is deleted; recording never creates one. It applies automatically to the customer's next sales left owing and counts in no debt figure. _In the app_: A favor.
_Avoid_: refund, saldo a favor, overpayment

**Sales still owing**:
Every sale of a business that is not fully paid once settlement is applied, partially paid ones included, each counted once. In the app: te debe (in Ventas) and the count line of Clientes' Te deben section and Inicio's Te deben block.
_Avoid_: unpaid orders, pending sales, open invoices

**Total owed**:
The sum of every customer's balance above $0 in a business; credits never subtract from it. In the app: the total heading Clientes' Te deben section and Inicio's Te deben block.
_Avoid_: receivables, outstanding

**Margin**:
A variety's sales of costed grams in a period minus what those grams cost, in pesos; gifts add their cost and $0 of sales, so it can be negative. Sales of costed grams are, per line, line total × costed grams ÷ line grams, half up; pending grams are left out and marked "y N g sin costo". In the app: Margen.
_Avoid_: profit, earnings, markup, ganancia

**Margin percentage**:
A variety's margin over its sales of costed grams in the period. There is none when those are $0, as for a variety only gifted or with every gram pending. In the app: Margen %.
_Avoid_: markup, rentabilidad, return

**Average margin**:
A month's total margin across its varieties over the month's sales of costed grams, marked when any variety carries pending grams. In the app: Margen promedio.
_Avoid_: average profit, mean margin

**First record**:
The earliest sale, stock entry, payment or expense a business recorded in the app. Análisis's history and its since-the-start totals begin there. In the app: Desde el primer registro.
_Avoid_: start date, opening date, inception

**Best week**:
Of the last 8 Monday-to-Sunday weeks, the one with the highest sales, shipping included; on a tie the most recent wins, and none is marked when all are $0. In the app: Mejor semana.
_Avoid_: top week, record week

**Best weekday**:
Since the first record, the weekday with the highest sales total; on a tie the earlier day from Monday to Sunday wins, and none is marked when all are $0. In the app: Mejor día.
_Avoid_: peak day, top day

**Stock shortfall**:
What the grams taken out by negative adjustments in a period cost, on the adjustment's date, from their lots as they stand today, oldest first; a part beyond every lot is pending, never $0. It lowers profit. In the app: Faltante de stock.
_Avoid_: shrinkage, write-off, loss, merma

**Publish**:
Posting and pinning the catalog in the business's channel chat, or editing the already pinned message there. It always sends, even when the text has not changed. _In the app_: Publicar.
_Avoid_: broadcast, push, sync

**Bot settings**:
A business's one Telegram bot token, stored encrypted and never shown again once saved, plus its channel chat and the user's own chat. Changing any of them requires a new test send before publishing. In the app: Integraciones, in Configuración.
_Avoid_: integration, connection, config

**Out of date**:
The pinned catalog's state when customers are not seeing today's catalog: the last automatic update failed (Telegram down, bot can't post, message deleted, text too long), or a new token or channel was tested but not yet published. It shows one fixed reason and, when the current chat has been published to, the last publish date. Its only other state is up to date. _In the app_: Desactualizado / Al día.
_Avoid_: stale, pending, out of sync, error

**Panel**:
Inicio's one-screen view of a business in Argentina time: Hoy shows what was sold today, money owed and stock per variety; Semana (Monday to Sunday) and Mes add cost of goods sold, expenses, grams gifted, purchases, profit and cash. Read only; every figure comes from the server. In the app: Inicio (tabs Hoy · Semana · Mes).
_Avoid_: dashboard, overview, home, summary, Análisis

**Average sale**:
A period's sales total, shipping included, divided by its number of sales (not lines), rounded half up to the whole peso. Not shown when the period has no sales.
_Avoid_: average ticket, mean order, ticket promedio

**Operator**:
The person who runs the installation from outside the app. They run scripts/invite-business.sh, scripts/reset-password.sh and the business removal, deploy, keep the backups and run the restore drill. Not a user of any business; nothing they do happens from a signed-in session, and they never see or choose a user's password.
_Avoid_: admin, administrator, superuser, owner, PM

**Business export**:
One JSON file holding every recorded fact of a business as stored, each record naming what it refers to, with no computed figure, password hash, secret or invitation. It is written only as the first step of removing the business.
_Avoid_: backup, dump, archive

**Business removal**:
The operator's command that exports a business and then deletes every row of it, users and invitations included, along with its users' login-attempt history, in one transaction. Nothing is deleted unless the export was written, read back, and its counts match what is deleted.
_Avoid_: offboarding, account deletion, purge, wipe


**Login brake**:
What stops password guessing at login and at a password change. An email is locked after 5 failures in a row, and a client address after 20 failed logins within 15 minutes, each for 15 minutes. Every refused attempt counts for both, a wrong current password on a password change included. A successful login, password change or reset resets only the email's count, and both locks answer the same. _In the app_: the brake message under Entrar and in Cambiar contraseña.
_Avoid_: rate limit, throttle, ban, captcha

**Restore drill**:
A script the operator runs by hand to restore the backup into a scratch target, never the running app. It reports the integrity check, row counts and the time of the restored copy's latest change.
_Avoid_: backup test, recovery check, DR test

**Spreadsheet import**:
The one-time load of a business's history from the `Control_de_ventas_y_gastos` spreadsheet into that business. The installation's operator runs it on switch day, and only into a business with no records yet. It never appears in the app; on screen, imported data is the same as data entered by hand.
_Avoid_: migration, sync, upload, restore

**Unfinished row**:
A row of Ventas, Entradas or Gastos that the spreadsheet import leaves out because the sheet itself marks it not ready: Ventas by text instead of a number in its Total formula, Entradas and Gastos by a non-blank Revisar. It is listed in the import's report with the sheet's own text, creates no customer, no VIP and no kept spelling, and never blocks the import.
_Avoid_: incomplete row, invalid row, skipped row
_In the app_: (operator terminal only; never shown on screen)

**Session**:
A signed-in device of one user, lasting 30 days as a cookie and a token. A change of that user's password closes every session of theirs, except the device that changed it by Change, which gets a fresh one. _In the app_: Sesión (Cerrar sesión).
_Avoid_: login, device, token, connection

**Password change**:
A user setting a new password with their current one, from Configuración → Tu cuenta. The only rule is at least 10 characters, and the same password is accepted. It closes every other session of that user and retires their unused reset links, while the device that made the change stays signed in. In the app: Cambiar contraseña.
_Avoid_: password update, rotation, edit password

**Reset link**:
A link the operator prints with scripts/reset-password.sh that lets one user choose a new password themselves, once, within 24 hours, without the current one. A user has at most one live link: a newer link or any password change retires it. A retired, used, expired or unknown link answers the same 404. _In the app_: enlace ("Este enlace ya no sirve").
_Avoid_: recovery code, reset token, magic link, forgot-password email

**Navigation**:
The app's fixed structure for a business: the tabs, Más, Configuración, and the one rule that gives every screen its chrome and its way back. It decides where each capability is reached from, never what it does. In the app: no word of its own.
_Avoid_: menu, sitemap, routing, shell

**Tab root**:
A screen reached straight from the bar or the sidebar (Inicio, Ventas, Clientes, Variedades, Gastos, Análisis, Más); it shows the bar and "+ Nueva venta". Every other screen is a card or detail (with a back arrow to its parent) or a form or sheet (with "Cerrar").
_Avoid_: home, main screen, section

**Settings**:
The one place holding every business-wide setting, in groups: Negocio, Usuarios, Integraciones, Mensaje del catálogo, Categorías de gastos, Apariencia and Tu cuenta. A setting of one variety lives on the variety, never here, and nothing of the operator's is here. In the app: Configuración.
_Avoid_: Ajustes (in the spreadsheet that held prices), preferences, admin, Negocio (that is one group)

**First-run checklist**:
Four steps on Inicio for a business that has not yet both priced a variety for today and recorded a stock entry: those two, plus publishing the pinned catalog and adding a second user, which are optional. Each step is worked out from the business's data and reads "Hecho" when met; the checklist goes for good the first time the two required steps are met and never returns.
_Avoid_: onboarding, tour, wizard, setup guide, welcome

**Theme choice**:
A device's choice of Claro or Oscuro. It is made only in Configuración → Apariencia, applies at once and is kept on that device alone. It is not tied to a user or a business, survives logging out and holds nothing else. With none stored, the app opens light whatever the system setting.
_Avoid_: preference, dark mode setting, skin, user setting
