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
A strain a business sells by the gram, identified by its name within that business.
_In the app_: Variedad
_Avoid_: product, strain, item, SKU

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
A person a business sells to, identified within that business by their phone number: two of its customers never share one. The same person buying from two businesses is a different customer in each. The name is how a user recognises them.
_In the app_: Cliente
_Avoid_: client, buyer, contact, user

**Phone number**:
A customer's number in international form: an Argentine number always as a mobile (+54 9 and 10 digits with area code), a foreign one as + and its country code and digits. The same number typed with or without spaces, dashes, a leading 0, the 15, the country code or the mobile 9 is the same number.
_Avoid_: contact, handle, username
_In the app_: Teléfono

**Channel**:
Where a customer talks to the business: Telegram or WhatsApp. A customer may have neither, and then has no channel.
_In the app_: Canal
_Avoid_: platform, app, source

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
Money a customer hands over on a date, in cash or by transfer, with no note. Either an on-the-spot payment recorded with its sale, or a later payment recorded through Registrar cobro. Its date, amount and method never change; it is deleted and recorded again, never edited.
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
The grams of a variety on hand: everything that came in minus everything sold or gifted. Can go negative when a sale or gift is recorded for grams not yet in: the figure still shows, never hidden.
_In the app_: Stock
_Avoid_: inventory, balance

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
Sales (shipping included, paid or not) minus cost of goods sold minus expenses, over a period, each counted on its own date. Purchases never enter it. It may be negative, and is then shown with a minus sign, never hidden. _In the app_: Ganancia.
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
The catalog message pinned in the business's Telegram chat, kept in step whenever a price changes or a variety sells out.
_In the app_: Mensaje fijado
_Avoid_: post, broadcast

**Test send**:
The catalog sent only to the user's own Telegram chat, to see how it looks before publishing.
_In the app_: Enviarme una prueba
_Avoid_: preview, draft

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
What a variety shows in the catalog: whether it is shown, its emoji, its indica share and its aroma. They never affect prices, stock or sales. _In the app_: edited from Qué sale en el catálogo.
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
A business's own text opening and closing the catalog, multi-line and up to 500 characters each. Either may be blank, and is then left out. They start as "🌿 **CATÁLOGO** 🌿" and "📩 Consultas y pedidos por privado.". _In the app_: Encabezado, Pie.
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
Every sale of a business that is not fully paid once settlement is applied, partially paid ones included, each counted once. _In the app_: te debe (in Ventas) and the count in Te deben.
_Avoid_: unpaid orders, pending sales, open invoices

**Total owed**:
The sum of every customer's balance above $0 in a business; credits never subtract from it. _In the app_: the total heading Te deben and in Clientes' header.
_Avoid_: receivables, outstanding

**Panel**:
Inicio's one-screen view of a business for today, this week (Monday to Sunday) or this month in Argentina time: sales, cost of goods sold, expenses, purchases, profit and cash, then money owed and stock per variety. Read only; every figure comes from the server. _In the app_: Inicio (tabs Hoy · Semana · Mes).
_Avoid_: dashboard, overview, home, summary, Análisis

**Average sale**:
A period's sales total, shipping included, divided by its number of sales (not lines), rounded half up to the whole peso. Not shown when the period has no sales.
_Avoid_: average ticket, mean order, ticket promedio

**Spreadsheet import**:
The one-time load of a business's history from the `Control_de_ventas_y_gastos` spreadsheet into that business. The installation's operator runs it on switch day, and only into a business with no records yet. It never appears in the app; on screen, imported data is the same as data entered by hand.
_Avoid_: migration, sync, upload, restore

**Unfinished row**:
A row of Ventas, Entradas or Gastos that the spreadsheet import leaves out because the sheet itself marks it not ready: Ventas by text instead of a number in its Total formula, Entradas and Gastos by a non-blank Revisar. It is listed in the import's report with the sheet's own text, creates no customer, no VIP and no kept spelling, and never blocks the import.
_Avoid_: incomplete row, invalid row, skipped row
_In the app_: (operator terminal only; never shown on screen)
