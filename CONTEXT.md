# Apostrophe

The back office of small businesses that sell flower by the gram: what each sells and at what price, what comes in and goes out of stock, who owes what, what it spends, and whether it makes money. One installation keeps several businesses, and they never mix. Replaces the spreadsheet `Control_de_ventas_y_gastos`.

Each term carries `_In the app_`: the English word a user sees on screen (the app is in English, `docs/product/product-language.md`); where the glossary term would read as code, the screen word is a plainer English one. Code, tests and docs use the glossary term.

## Businesses and users

**Business**:
One seller's operation and everything recorded for it: varieties, prices, customers, sales, stock, expenses and catalog. Nothing recorded for one business is ever visible from another.
_In the app_: Business
_Avoid_: tenant, account, store, shop, organization

**User**:
A person who logs in to the app and works on exactly one business.
_In the app_: User
_Avoid_: operator, admin, member, seller, customer (customers never log in)

**Invitation**:
A link that lets one person in, once, within seven days: either to open a new business of their own, or to join the business that issued it.
_In the app_: Invitation
_Avoid_: signup link, referral, code

## Catalog and prices

**Variety**:
A strain a business sells by the gram, identified by its name within that business. Its stock, entries, prices, low-stock warning and catalog attributes are all on its own page in the Varieties tab. A variety with no history can be deleted; one with history can be archived and restored. _In the app_: Variety; the tab is Varieties.
_Avoid_: product, strain, item, SKU
_In the app_: Variety

**Price entry**:
A variety's list price, and optionally a bulk price with its bulk minimum, and optionally a VIP price, effective from a date onwards. Never edited once recorded: a later entry supersedes it from its own date. A mistaken entry is deleted, never rewritten; a sale is unaffected because every sale line records the price it was sold at. A rule switched off when it is recorded stores nothing for that rule. Planned in GH-318 (not yet in the code): what changes beside this entry is told in the closing block below. _In the app_: Price (price history).
_Avoid_: price change, price update, tariff
_In the app_: Price (price history)

**Current price**:
For a variety on a given date, the price entry with the latest effective date on or before that date. A variety with no such entry has no price that day.
_In the app_: Current price
_Avoid_: today's price, active price

**List price**:
The price per gram of a variety when no other rule applies.
_In the app_: Price per gram
_Avoid_: base price, regular price

**Bulk price**:
A lower price per gram that applies from the bulk minimum upwards. Optional: a price entry has both bulk price and bulk minimum, or neither. Only in a business with bulk pricing (Bulk price) switched on. _In the app_: Bulk price.
_Avoid_: discount, wholesale price
_In the app_: Bulk price

**Bulk minimum**:
The grams from which the bulk price applies.
_In the app_: Minimum in grams
_Avoid_: threshold, minimum order

## Customers and money owed

**Customer**:
A person a business sells to, identified within that business by their own record. The name is how a user recognises them; the phone number, when there is one, is optional contact data and never required to register or keep selling to someone. The same person buying from two businesses is a different customer in each.
_Avoid_: client, buyer, contact, user
_In the app_: Customer

**Phone number**:
Optional contact data for a customer, in international form: an Argentine number always as a mobile (+54 9 and 10 digits with area code), a foreign one as + and its country code and digits. A blank value means none. Two customers of a business never share one when both have one; any number of customers may have none.
_Avoid_: contact, handle, username, identifier
_In the app_: Phone

**VIP customer**:
A customer who pays a variety's VIP price when it has one and it is lower than what any other rule gives. Only in a business with VIP customers switched on; while it is off, the mark stays stored but neither shows nor applies. _In the app_: VIP customer.
_Avoid_: friend, Amigo, preferred customer
_In the app_: VIP customer

**Sale**:
Everything a customer takes in one go: a date, at most one customer, the shipping charged, an optional note, and one or more sale lines. A sale counts on its own date, paid or not. Its customer may be left out only when nothing stays owed.
_In the app_: Sale
_Avoid_: order, transaction, purchase (that is flower coming in)

**Sale without a customer**:
A sale paid in full on the spot to someone not registered as a customer, often a buyer who may never come back. It counts in every total and in no customer's history. A customer can be assigned to it later, once; it never moves from one customer to another.
_In the app_: No customer
_Avoid_: anonymous sale, walk-in, guest, consumidor final

**Sale line**:
One variety and its grams within a sale, with the price per gram it was sold at. The bulk minimum is measured per line, never across the sale.
_In the app_: Line
_Avoid_: item, row, product

**Gift**:
Grams handed over for free inside a sale: charged $0, still taken from stock. Grams shared to promote the business are a promotion, never a gift. _In the app_: Gift.
_Avoid_: sample, freebie
_In the app_: Gift

**Special price**:
A whole-peso total above $0, typed by hand for one sale line, that replaces the computed one. A free line is a gift, never a $0 special price.
_In the app_: Special price
_Avoid_: override, custom price, discount

**Pricing rule**:
Which rule priced a sale line: list, bulk, VIP, gift or special price. Exactly one per line, stored with its price when the sale is recorded and never recomputed. VIP means the VIP price was charged, including when it equalled the bulk price. _In the app_: list, bulk, VIP, gift, special.
_Avoid_: type, price type, Amigo
_In the app_: list, bulk, VIP, gift, special

**Shipping charged**:
What the customer pays for delivery, added on top of what they bought.
_In the app_: Shipping charged
_Avoid_: delivery fee, shipping cost (that is an expense)

**Note**:
Free text on a sale to remember what the rest does not say, such as who bought it when there is no customer.
_In the app_: Note
_Avoid_: comment, description, memo

**Payment**:
Money a customer hands over on a date, in cash or by transfer, with no note. Either an on-the-spot payment recorded with its sale, or a later payment recorded through Record payment, opened by "Collect" on a debtor row of Customers or Home or from the customer's card. Its date, amount and method never change; it is deleted and recorded again, never edited. _In the app_: Payment.
_Avoid_: collection, settlement, receipt, abono
_In the app_: Payment

**Balance**:
What a customer owes: what they bought and did not pay, minus their payments, worked out live. A later payment always settles the oldest debt first. Below zero it is a credit. _In the app_: Owes you.
_Avoid_: debt account, tab, cuenta corriente
_In the app_: Account / Owes

**Owing since**:
The date of a customer's oldest sale that is not fully paid.
_In the app_: Since
_Avoid_: overdue date, due date

## Stock

**Stock entry**:
Grams of a variety coming in on a date, with one origin: purchase, harvest, opening stock or adjustment. A purchase carries its total cost; an adjustment may be negative. Unlike a price entry, any stock entry may be edited or deleted at any time, whatever it already fed: its date, grams, cost or origin (ADR-0009).
_In the app_: Entry
_Avoid_: restock, delivery, intake

**Purchase**:
A stock entry the business paid for. Its cost is money out on its date.
_In the app_: Purchase
_Avoid_: order, buy

**Lot**:
The grams of one stock entry together with their cost per gram. Grams sold, gifted or withdrawn come out of the oldest lot of their variety first, oldest by date; a stock entry or withdrawal recorded late or corrected takes its place by date, and the lots after it are worked out again (ADR-0009). _In the app_: Lot.
_Avoid_: batch
_In the app_: Lot

**Stock**:
The grams of a variety on hand: everything that came in minus everything sold, gifted or withdrawn. It can go negative, and the figure still shows, never hidden. _In the app_: Stock, shown on Varieties and a variety's page.
_Avoid_: inventory, balance
_In the app_: Stock

**Pending cost**:
What grams sold, gifted or withdrawn beyond everything recorded as coming in cost: not yet known, and never shown as $0. A later stock entry of that variety, wherever its date falls in the lot order, settles it (ADR-0009). _In the app_: Pending cost.
_Avoid_: unknown cost, zero cost
_In the app_: Pending cost

**Draw**:
Grams going out of a variety, taking from its lots oldest first: a sale line (gifts included), a negative adjustment or a stock withdrawal line. It has a costed part and, beyond every lot, pending grams. In the app it has no word of its own.
_Avoid_: outflow, consumption, movement, out
_In the app_: no word of its own; on screen it is the line's "Cost of goods sold".

**Lot order**:
The one order a variety's lots and draws are taken in: by date, then by recording order.
_In the app_: no word of its own.
_Avoid_: chain, chain position, FIFO order

**Low-stock threshold**:
Optional grams under which a variety's stock counts as low.
_In the app_: Warn below
_Avoid_: reorder point, alert level

## Results

**Cost of goods sold**:
What the grams sold or gifted in a period cost, taken from the lots they came out of as those lots stand today, oldest first; it is worked out again whenever an earlier stock entry changes, however far back (ADR-0009). Part of it may be pending cost.
_In the app_: Cost of goods sold
_Avoid_: COGS, average cost, cost per gram

**Expense**:
Money spent on something other than flower, filed under one expense category. Flower bought is a purchase, never an expense.
_In the app_: Expense
_Avoid_: cost, outflow, bill

**Expense category**:
A business's own heading for its expenses, with a name unique within that business whatever the case or spacing. A new business starts with four defaults in its stored language at opening (in English "Growing supplies", "Packaging", "Shipping and transport" and "Other"), which a language change never renames; earlier businesses keep the defaults they received, Spanish ones included. A category cannot be removed while it has expenses.
_Avoid_: type, tag, label, account, cost center
_In the app_: Category

**Profit**:
Sales (shipping included, paid or not) minus cost of goods sold, stock shortfall, promotion cost, own-use cost and expenses, over a period, each counted on its own date; purchases never enter it. When any cost is pending, it is worked out over the costed part and marked "and N g without cost", N adding the pending grams sold, gifted, taken out by negative adjustments and withdrawn in the period. It may be negative and is then shown with a minus sign; in the app: Profit.
_Avoid_: margin, earnings, net
_In the app_: Profit

**Cash**:
Payments received minus expenses minus purchases, over a period: the money that actually moved.
_In the app_: Cash
_Avoid_: cash flow, balance, profit

## Telegram

**Catalog**:
The text that offers every unarchived, shown variety with stock above zero and a current price today: its emoji, name, indica share, aroma and prices, between the business's header and footer. It keeps its **bold** markers and its own money format ($11.000). _In the app_: Catalog.
_Avoid_: menu, price list, flyer
_In the app_: Catalog

**Pinned catalog**:
The catalog message pinned in the business's Telegram channel chat by its own bot, edited in place whenever the catalog text changes and never posted again in that chat. When nothing qualifies, it shows the header, the empty line ("Nothing to offer for now." in English) and the footer; its fixed lines follow the business's shown language.
_Avoid_: post, broadcast
_In the app_: Pinned message

**Test send**:
The catalog sent only to the user's own Telegram chat, using the bot settings typed on the screen. They are saved only if it succeeds. A successful test since the settings last changed is required before Publish. _In the app_: Test it.
_Avoid_: preview, draft
_In the app_: Test it

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
How a variety stands on stock, the first that fits: no entries (nothing has moved: no stock entry, no sale or gift, no withdrawal), sold out (stock at or below zero), low (above zero and under its threshold), ok. It is told by shape and word, never by color alone. _In the app_: no entries, sold out, low, ok.
_Avoid_: stock level, alert, availability

**Days left**:
A variety's stock divided by the average daily grams sold, gifted or withdrawn over the last 30 days, rounded down to whole days. It is not shown when stock is at or below zero or nothing went out in those 30 days. _In the app_: At the pace of the last 30 days.
_Avoid_: runway, coverage, forecast

**Opening stock**:
A stock entry recording grams already on hand when a business starts keeping stock. It is an ordinary origin with no limit per variety, and its lot costs $0 unless a cost is recorded. _In the app_: Initial stock.
_Avoid_: initial balance, baseline, starting inventory

**Harvest**:
A stock entry of grams the business grew. Its lot costs $0 unless a cost is recorded; cultivation inputs are expenses, never spread over harvests. _In the app_: Harvest.
_Avoid_: crop, yield, production

**Adjustment**:
A stock entry recording the difference between a physical count and the stock the app shows, plus or minus. A negative adjustment carries no cost and takes its grams out of the oldest lots, as grams going out do. _In the app_: Adjustment.
_Avoid_: correction, recount, shrinkage, write-off

**Catalog attributes**:
What a variety shows in the catalog: whether it is shown, its emoji, its indica share and its aroma. They never affect prices, stock or sales, and are edited only on the variety's own page. _In the app_: In the catalog.
_Avoid_: catalog settings, metadata, tags

**Hidden variety**:
A variety the seller chose to leave out of the catalog, whatever its price or stock. Hidden means only that: a hidden variety is still in Varieties and every picker. A variety out for lack of price or stock is not hidden, and an archived variety is a separate thing that keeps its hidden flag. _In the app_: Hidden.
_Avoid_: inactive, disabled, archived (that is an archived variety)

**Indica share**:
A variety's indica percentage, a whole number from 0 to 100; sativa is the rest. Optional; unknown means the catalog leaves its line out. _In the app_: % indica.
_Avoid_: genetics, ratio, type

**Aroma**:
One line of free text describing a variety's aroma and flavour for the catalog, up to 200 characters. _In the app_: Aroma/flavor.
_Avoid_: description, notes, flavor profile

**Catalog header and footer**:
A business's own text opening and closing the catalog, multi-line and up to 500 characters each; a blank one is left out. A new business starts with the defaults in its stored language at opening (in English "🌿 **CATALOG** 🌿" and "📩 Questions and orders by private message."); from then on they are its own data, edited only in Settings, and a language change never rewrites them. Earlier businesses keep what they stored.
_Avoid_: title, signature, intro, outro

**On-the-spot payment**:
The payment recorded together with a sale paid in full in cash or by transfer. It settles that sale alone, never an older debt, and is deleted only with its sale. _In the app_: Paid in cash / Paid by transfer.
_Avoid_: cash sale, immediate payment

**Settlement**:
Which sales a later payment covers: the customer's oldest debt first (sales by date, then recording order; payments by date, then recording order), whatever the payment's own date. It is worked out live from the sales and payments as they stand now, and never stored. _In the app_: On account of the sale of dd/mm.
_Avoid_: allocation, application, imputación

**Credit**:
A balance below zero, left only when a sale that payments had settled is deleted; recording never creates one. It applies automatically to the customer's next sales left owing and counts in no debt figure. _In the app_: In your favor.
_Avoid_: refund, saldo a favor, overpayment

**Sales still owing**:
Every sale of a business that is not fully paid once settlement is applied, partially paid ones included, each counted once. _In the app_: owes you (in Sales) and the count line of the "Owed to you" section of Customers and of Home's "Owed to you" block.
_Avoid_: unpaid orders, pending sales, open invoices

**Total owed**:
The sum of every customer's balance above $0 in a business; credits never subtract from it. _In the app_: the total heading of the "Owed to you" section of Customers and of Home's "Owed to you" block.
_Avoid_: receivables, outstanding

**Margin**:
A variety's sales of costed grams in a period minus what those grams cost, in pesos; gifts add their cost and $0 of sales, so it can be negative. Sales of costed grams are, per line, line total × costed grams ÷ line grams, half up; pending grams are left out and marked "and N g without cost". _In the app_: Margin.
_Avoid_: profit, earnings, markup, ganancia

**Margin percentage**:
A variety's margin over its sales of costed grams in the period. There is none when those are $0, as for a variety only gifted or with every gram pending. _In the app_: Margin %.
_Avoid_: markup, rentabilidad, return

**Average margin**:
A month's total margin across its varieties over the month's sales of costed grams, marked when any variety carries pending grams. _In the app_: Average margin.
_Avoid_: average profit, mean margin

**First record**:
The earliest sale, stock entry, stock withdrawal, payment or expense a business recorded in the app. Analysis's history and its since-the-start totals begin there, so no withdrawal's cost is ever left out of them. _In the app_: Since the first record.
_Avoid_: start date, opening date, inception

**Best week**:
Of the last 8 Monday-to-Sunday weeks, the one with the highest sales, shipping included; on a tie the most recent wins, and none is marked when all are $0. _In the app_: Best week.
_Avoid_: top week, record week

**Best weekday**:
Since the first record, the weekday with the highest sales total; on a tie the earlier day from Monday to Sunday wins, and none is marked when all are $0. _In the app_: Best day.
_Avoid_: peak day, top day

**Stock shortfall**:
What the grams taken out by negative adjustments in a period cost, on the adjustment's date, from their lots as they stand today, oldest first; a part beyond every lot is pending, never $0. It lowers profit. _In the app_: Stock shortfall.
_Avoid_: shrinkage, write-off, loss, merma

**Stock withdrawal**:
A dated record of grams of one or more varieties taken out of stock for one reason, Promotion or Own use, with an optional note. No money moves and Cash is untouched. Its grams are costed on its date from the lots, oldest first, and a part beyond every lot is pending cost, never $0. The cost shows as its own line per reason and lowers profit; it never enters a variety's margin or the cost of goods sold. It can be edited or deleted at any time. _In the app_: Withdrawal, recorded with the action "Take from stock"; the reasons read Promotion and Own use.
_Avoid_: gift (a gift is a sale line at $0 price), shrinkage, write-off

**Publish**:
Posting and pinning the catalog in the business's channel chat, or editing the already pinned message there. It always sends, even when the text has not changed. _In the app_: Publish.
_Avoid_: broadcast, push, sync

**Bot settings**:
A business's one Telegram bot token, stored encrypted and never shown again once saved, plus its channel chat and the user's own chat. Changing any of them requires a new test send before publishing. _In the app_: Integrations, in Settings.
_Avoid_: integration, connection, config

**Out of date**:
The pinned catalog's state when customers are not seeing today's catalog: the last automatic update failed (Telegram down, bot can't post, message deleted, text too long), or a new token or channel was tested but not yet published. It shows one fixed reason and, when the current chat has been published to, the last publish date. Its only other state is up to date. _In the app_: Out of date / Up to date.
_Avoid_: stale, pending, out of sync, error

**Panel**:
Home's one-screen view of a business in Argentina time. Today shows what was sold today, money owed and stock per variety. Week and Month add cost of goods sold, stock shortfall, promotion and own-use cost, expenses, grams gifted, purchases, profit and cash; read only, every figure from the server. _In the app_: Home (tabs Today · Week · Month).
_Avoid_: dashboard, overview, home, summary, Analysis

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
What stops password guessing at login and at a password change. An email is locked after 5 failures in a row, and a client address after 20 failed logins within 15 minutes, each for 15 minutes. Every refused attempt counts for both, a wrong current password on a password change included. A successful login, password change or reset resets only the email's count, and both locks answer the same. _In the app_: the brake message under Sign in and in Change password.
_Avoid_: rate limit, throttle, ban, captcha

**Restore drill**:
A script the operator runs by hand to restore the backup into a scratch target, never the running app. It reports the integrity check, row counts and the time of the restored copy's latest change.
_Avoid_: backup test, recovery check, DR test

**Spreadsheet import**:
The one-time load of a business's history from the `Control_de_ventas_y_gastos` spreadsheet into that business. The installation's operator runs it on switch day, and only into a business with no records yet. It never appears in the app; on screen, imported data is the same as data entered by hand.
_Avoid_: migration, sync, upload, restore

**Unfinished row**:
A row of the sheet's Ventas, Entradas or Gastos that the spreadsheet import leaves out because the sheet itself marks it not ready: Ventas by text instead of a number in its Total formula, Entradas and Gastos by a non-blank Revisar. It is listed in the import's report with the sheet's own text, creates no customer, no VIP and no kept spelling, and never blocks the import.
_Avoid_: incomplete row, invalid row, skipped row
_In the app_: (operator terminal only; never shown on screen)

**Session**:
A signed-in device of one user, lasting 30 days as a cookie and a token. A change of that user's password closes every session of theirs, except the device that changed it by Change, which gets a fresh one. _In the app_: Session (Sign out).
_Avoid_: login, device, token, connection

**Password change**:
A user setting a new password with their current one, from Settings → Your account. The only rule is at least 10 characters, and the same password is accepted. It closes every other session of that user and retires their unused reset links, while the device that made the change stays signed in. _In the app_: Change password.
_Avoid_: password update, rotation, edit password

**Reset link**:
A link the operator prints with scripts/reset-password.sh that lets one user choose a new password themselves, once, within 24 hours, without the current one. A user has at most one live link: a newer link or any password change retires it. A retired, used, expired or unknown link answers the same 404. _In the app_: link ("This link no longer works").
_Avoid_: recovery code, reset token, magic link, forgot-password email

**Navigation**:
The app's fixed structure for a business: the tabs, More, Settings, and the one rule that gives every screen its chrome and its way back. It decides where each capability is reached from, never what it does. In the app: no word of its own.
_Avoid_: menu, sitemap, routing, shell

**Tab root**:
A screen reached straight from the bar or the sidebar (Home, Sales, Customers, Varieties, Expenses, Analysis, More); it shows the bar and "+ New sale". Every other screen is a card or detail (with a back arrow to its parent) or a form or sheet (with "Close").
_Avoid_: home, main screen, section

**Settings**:
The one place holding every business-wide setting, in groups: Business, Users, Prices, Integrations, Catalog message, Expense categories, Appearance and Your account. A setting of one variety lives on the variety, never here, and nothing of the operator's is here. _In the app_: Settings.
_Avoid_: Ajustes (in the spreadsheet that held prices), preferences, admin, Negocio (that is one group)

**First-run checklist**:
Four steps on Home for a business that existed before the Onboarding shipped and has not yet both priced a variety for today and recorded a stock entry: those two, plus publishing the pinned catalog and adding a second user, which are optional. Each step is worked out from the business's data and reads "Done" when met; the checklist goes for good the first time the two required steps are met and never returns. A brand-new business gets the Onboarding instead.
_Avoid_: tour, wizard, setup guide, welcome, Onboarding (that is a brand-new business's first run)

**Onboarding**:
The step-by-step setup a brand-new business is walked through after its new-business invitation is accepted, in place of the first-run checklist. It has two required steps (a variety priced today, its opening stock) and optional ones (catalog header and footer, Telegram bot, a partner, expense categories), each saving what Settings or the variety's page saves. It resumes where it was left, is over for good once its closing screen "Done" is reached or an import loads the business, and is never offered to a joined user's business or one that existed before it shipped.
_Avoid_: tour, wizard, welcome screen, setup guide

**Theme choice**:
A device's choice of Light or Dark. It is made only in Settings → Appearance, applies at once and is kept on that device alone. It is not tied to a user or a business, survives logging out and holds nothing else. With none stored, the app opens light whatever the system setting.
_Avoid_: preference, dark mode setting, skin, user setting

**Own chat lookup**:
Finding the seller's own chat number among the private chats that wrote to the business's bot, using the token Test it would use. It fills the own chat field only when exactly one person wrote privately, shows only the number and saves nothing; settings are still saved only by a successful test send. _In the app_: Find my chat.
_Avoid_: auto-detect, discovery, getUpdates, chat search, sync

**VIP price**:
An optional price per gram in a price entry, for VIP customers: a whole peso above $0 and below that entry's list price, independent of the bulk price. Never shown in the catalog. Planned in GH-318 (not yet in the code): what changes beside this entry is told in the closing block below. _In the app_: VIP price.
_Avoid_: friend price, discount, Amigo price

**Pricing settings**:
Which of bulk pricing (Bulk price) and VIP customers a business uses: two independent switches. A rule switched off is hidden and stops applying to new sales, while everything stored for it is kept. _In the app_: Prices, in Settings.
_Avoid_: price config, pricing mode, plan, tariff settings

**Archived variety**:
A variety the seller took out of every list and picker (Varieties, What you have left, New sale, the stock entry and price forms, the catalog and the pinned catalog), while every past record keeps its plain name and figures. Archive is the action offered for a variety with history, but an archived variety may have none. It keeps its name reserved and its hidden flag, is seen and restored only from Archived, has a read-only page, and restoring brings it back exactly as it was. In the app: Archived.
_Avoid_: deleted, hidden, inactive, disabled

**Variety history**:
Any sale line of a variety (gifts and special prices included) or any stock entry of it (any origin, an adjustment of either sign included), or any stock withdrawal line of it, worked out live and never stored. A variety with history can only be archived. A variety without history can be deleted for good, and its price entries, threshold and catalog attributes go with it.
_Avoid_: usage, activity, movements, references

**Promotion**:
A stock withdrawal to make the business known, e.g. grams shared at a party for several people to try. Its cost is what the withdrawn grams cost from their lots as they stand today, shown as its own line that lowers profit. _In the app_: Promotion.
_Avoid_: gift (a gift is a sale line, to someone, inside a sale), sample, freebie, promo

**Own use**:
A stock withdrawal the seller consumes personally. Its cost is what the withdrawn grams cost from their lots as they stand today, shown as its own line that lowers profit. _In the app_: Own use.
_Avoid_: personal, shrinkage

**More info**:
The longer how-or-why behind a shortened line, one tap away on an "i" at the end of that line, expanded in place and collapsed on a second tap; it always opens closed and is never remembered. Never a consequence, a refusal's fix or a state. _In the app_: More info (its accessible name, with aria-expanded).
_Avoid_: tooltip, popover, help modal, info sheet, details

**Icon and text rule**:
The one written rule for how every screen labels its entries, actions and notices. It decides how things are labelled, never what they do. Its full text lives in `docs/product/icon-and-text-rule.md`. In the app: no word of its own.
_Avoid_: style guide, UI guidelines, icon policy

**Attention icon**:
The one icon, the same everywhere, set next to the sentence of a notice or status that asks the seller to act or says something failed. Its full rule lives in `docs/product/icon-and-text-rule.md`. In the app: no word of its own.
_Avoid_: warning icon, alert icon, badge, error icon

**Gate**:
The checks every change must pass before it merges: pytest, vitest and e2e. A red gate must mean a product regression, never the calendar moving past an expiry or a day boundary. In the app: no word of its own.
_Avoid_: pipeline, build, test run

**Tappable notice**:
A notice the seller taps to open what it points to, such as Home's "Go on to the setup". Its sentence carries the meaning and is its accessible name. Its full rule lives in `docs/product/icon-and-text-rule.md`.
_Avoid_: banner, card button, row, callout, alert

**Design capture**:
The side-by-side capture of a screen's design file and the built app, attached to a PR as review evidence and judged by eye against Drawing as guide. It is never a step of the gate. Its full rule lives in `docs/product/design-capture.md`.
_Avoid_: screenshot test, visual regression test, snapshot, gate step

**Product language**:
The language the product writes in for a person to read. English is the source copy and, until a second language ships (#317), the only selectable language. It covers screens, accessible names, API messages, operator script output and the catalog's fixed lines, never the seller's own data. An API refusal's `detail` is an English diagnostic, never shown. Numeric and date formats stay Argentine.
_Avoid_: locale, i18n, translation, Rioplatense

**Language**:
A language the copy module has copy for, identified by its tag. In the app: no word of its own.
_Avoid_: locale, translation

**Selectable language**:
A language a business may be set to: every language with complete copy (every English message has a non-empty translation) except the test locale. Only English until #317. In the app: no word of its own.
_Avoid_: supported language, available locale

**Shown language**:
The language texts are shown in for a business: its stored language, unless the forced language overrides it. Until #317 every business is English. In the app: no word of its own.
_Avoid_: display locale, UI language

**Test locale**:
`en-XA`, generated from English and used only to judge layout, never character limits. Never selectable and never chosen by a request. In the app: no word of its own.
_Avoid_: pseudo-language, fake language

**Forced language**:
The test locale, switched on for the whole installation by the operator through `APOSTROPHE_FORCED_LANGUAGE`. It overrides the shown language and the pre-sign-in language, never the operator's output or a stored language. In the app: no word of its own.
_Avoid_: override mode, debug language

**Pre-sign-in language**:
The language of the page before sign-in, worked out from the phone's `Accept-Language` and the selectable languages alone, English when nothing matches. No business, user, invitation or link can influence it, so the page reveals nothing about any of them. In the app: no word of its own.
_Avoid_: browser language, default language

**Copy module**:
The one keyed place that holds every text the front shows, accessible names included. No screen holds a text of its own, so a rewording or an added language is a change there only.
_Avoid_: messages file, strings, translations, dictionary

**Mobile check**:
The Gate check that walks the screens registry's phone rows and fails on any offence against the mobile standard that the offender lists do not name. The mobile standard lives in CODING_STANDARDS.md §10 "Phone", and DESIGN_STANDARDS.md points to it. The check, its lists and their growth conditions are in docs/product/mobile-check.md and docs/product/gate.md.
_Avoid_: mobile test, phone audit, lint, allowlist

**Drawing as guide**:
A difference from the drawing is a finding only when the owner, on the phone, would read or do something differently. The written product definition and the ADRs win over the drawing. In the app: no word of its own; the rule lives in DESIGN_STANDARDS.md.
_Avoid_: exact spec, pixel-perfect, design fidelity, mockup diff

**Phone first**:
When a choice is needed, the flow working on the phone ships first. Polish is a later task the owner or PM chooses to schedule. The computer keeps every capability but gets no dedicated polish. In the app: no word of its own; the rule lives in DESIGN_STANDARDS.md.
_Avoid_: mobile-only, responsive, mobile first, polish pass

**Stored language**:
The one language recorded on a business. A new business gets it from the accepting phone when its invitation is accepted, an existing business has English, and afterwards only a user's choice in Settings → Business changes it. It is what the language control shows and edits, and it is the shown language unless the operator's forced language overrides it. In the app: no word of its own.
_Avoid_: locale, display language, preferred language, business locale

**Assume nothing**:
The owner's fourth criterion: the app never hard-codes one business's way of working (product type, units, currency, payment methods, pricing rules, channels, and so on), and each business runs it its own way through settings with neutral defaults. There are no ready-made business-type presets. Its test is "would this still be right for a business that sells something else, in other units, other ways?" If not, it is a finding, a default that fits one business included; it applies to new work, while existing assumptions are swept in #330 and made customizable in #318. In the app: no word of its own; the rule lives in DESIGN_STANDARDS.md.
_Avoid_: business-neutral, white label, vertical, preset, template, multi-tenant

**Sale bill**:
The facts about one recorded sale that a seller may share with that sale's customer: business name, date, shipping charged, total, lines, payment state and the customer's current balance. They are worked out live from settlement when the sale's detail is read, and never stored; the balance is the customer's whole current account. A bill is facts only, with no text; in the app it has no word of its own yet (part 2 of GH-322 chooses it).
_Avoid_: invoice, receipt, statement, ticket

## Planned in GH-318 (not yet in the code)

These terms are not entries of the present glossary. Code, tests and screens keep the present terms until the part named on each line ships; only that part moves its term into the glossary proper and amends the entry it replaces. Each line gives the term, the ADR that decides it, and its owning part by capability.

**Product**:
What a business sells, in code and in the API, whatever the business calls it on screen; it replaces Variety in code, and the columns that reference it stay `variety_id` until #75. Decided in docs/adr/0061-columns-keep-variety-id-until-75-while-code-and-the-api-say-product.md; owned by the Product rename on the wire. The Python names of the products hexagon (its modules, classes, ports, use-case parameters and domain attributes) and `app/catalog/domain/product.py` say Product from GH-386. Other hexagons' own fields, the wire, tables, columns and screens keep Variety until their parts (ADR-0061).
_Avoid_: item, SKU, article

**Unit**:
How a business measures a product: a label and 0 to 2 decimals that only validate input and decide display. Decided in docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md; owned by the units part.
_Avoid_: measure, UoM

**Quantity, in hundredths of a unit**:
A stored quantity of any unit, always a whole number of hundredths. Decided in docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md; owned by the units part.
_Avoid_: amount, grams

**Business time zone**:
The zone that decides when a business's day starts and ends; every existing business is given Argentina's. Decided in docs/adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md; owned by the time-zone part.
_Avoid_: locale, region

**Money scale**:
Whether a business stores its money in whole currency units (0) or in hundredths (2); existing businesses stay at 0 and new ones start at 2. Decided in docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md; owned by the money part.
_Avoid_: precision, cents mode

**Money format**:
The currency symbol and the decimals a business shows its money with. Decided in docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md; owned by the money part.
_Avoid_: currency settings

**Customer type**:
A seller-defined kind of customer, at most one per customer, that can have its own price. Decided in docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; owned by the customer types part.
_Avoid_: tier, segment, group

**Customer-type price**:
The price a customer type pays for a product, an effective-dated row. It replaces the VIP price for new writes; the price entry keeps its VIP price as it is, and the stored VIP prices and VIP marks stay in place, frozen with the values they hold. Decided in docs/adr/0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md; owned by the customer-type prices part.
_Avoid_: tier price, discount

**Payment method**:
A seller-defined way a customer pays. Decided in docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; owned by the payment methods part.
_Avoid_: payment type, channel

**Applied promotion**:
A promotion as a sale stood when it was saved, recorded as typed rows and never recomputed. Decided in docs/adr/0060-the-applied-promotion-snapshot-is-typed-sale-promotion-rows-recorded-as-the-sale-stood-when-saved-and-never-recomputed.md; owned by the promotions-at-sale-time part, which also settles how it differs from a promotion.
_Avoid_: discount line, coupon

**Product word**:
What a business calls its products on screen. Decided in docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; owned by the product word part.
_Avoid_: label, noun setting
