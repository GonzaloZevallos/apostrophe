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
_Avoid_: override, custom price, discount
_In the app_: Precio especial

**Shipping charged**:
What the customer pays for delivery, added on top of what they bought.
_In the app_: Envío cobrado
_Avoid_: delivery fee, shipping cost (that is an expense)

**Note**:
Free text on a sale to remember what the rest does not say, such as who bought it when there is no customer.
_In the app_: Nota
_Avoid_: comment, description, memo

**Payment**:
Money a customer hands over on a date, in cash or by transfer.
_In the app_: Cobro
_Avoid_: collection, settlement, receipt

**Balance**:
What a customer owes: what they bought and did not pay, minus their payments. A payment always settles the oldest debt first.
_In the app_: Cuenta corriente / Debe
_Avoid_: debt account, tab, credit

**Owing since**:
The date of a customer's oldest sale that is not fully paid.
_In the app_: Desde
_Avoid_: overdue date, due date

## Stock

**Stock entry**:
Grams of a variety coming in on a date, with one origin: purchase, harvest, opening stock or adjustment. A purchase carries its total cost; an adjustment may be negative.
_In the app_: Entrada
_Avoid_: restock, delivery, intake

**Purchase**:
A stock entry the business paid for. Its cost is money out on its date.
_In the app_: Compra
_Avoid_: order, buy

**Lot**:
The grams of one stock entry together with their cost per gram. A harvest costs $0 unless a cost is recorded. Grams sold or gifted come out of the oldest lot of their variety first.
_In the app_: Lote
_Avoid_: batch

**Stock**:
The grams of a variety on hand: everything that came in minus everything sold or gifted.
_In the app_: Stock
_Avoid_: inventory, balance

**Low-stock threshold**:
Optional grams under which a variety's stock counts as low.
_In the app_: Avisar con menos de
_Avoid_: reorder point, alert level

## Results

**Cost of goods sold**:
What the grams sold or gifted in a period cost, taken from the lots they came out of.
_In the app_: Costo de lo vendido
_Avoid_: COGS, average cost, cost per gram

**Expense**:
Money spent on something other than flower, filed under one expense category. Flower bought is a purchase, never an expense.
_In the app_: Gasto
_Avoid_: cost, outflow, bill

**Profit**:
Sales minus cost of goods sold minus expenses, over a period. A sale counts on its own date, paid or not.
_In the app_: Ganancia
_Avoid_: margin, earnings, net

**Cash**:
Payments received minus expenses minus purchases, over a period: the money that actually moved.
_In the app_: Caja
_Avoid_: cash flow, balance, profit

## Telegram

**Catalog**:
The text that offers every shown variety with stock and a current price: name, emoji, indica share, aroma and prices, between a header and a footer.
_In the app_: Catálogo
_Avoid_: menu, price list, flyer

**Pinned catalog**:
The catalog message pinned in the business's Telegram chat, kept in step whenever a price changes or a variety sells out.
_In the app_: Mensaje fijado
_Avoid_: post, broadcast

**Test send**:
The catalog sent only to the user's own Telegram chat, to see how it looks before publishing.
_In the app_: Enviarme una prueba
_Avoid_: preview, draft

## Language

**Pricing rule**:
Which rule priced a sale line: list, bulk, VIP, gift or special price. Exactly one per line, stored with its price when the sale is recorded and never recomputed.
_Avoid_: type, price type, Amigo
