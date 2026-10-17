# Results

Inicio: the panel a business opens on. Hoy is for acting on today (what was sold, who owes with a one-tap Cobrar, what is running low) and, for a business still setting up, what is left to do. Semana and Mes say whether the business makes money and how much it actually has. Seen only by its business (ADR-0004). It reads:

- sales and their totals from sales;
- cost of goods sold from stock's lots (ADR-0009, ADR-0010);
- expenses from expenses;
- purchases from stock;
- payments, balances and settlement from payments (ADR-0012);
- stock status and days left from stock;
- for the setup checklist and the bot notice: current prices (varieties), stock entries (stock), whether the catalog was ever published (pinned-catalog) and the business's users (accounts).

It computes nothing those capabilities already compute, beyond adding them up.

## Jobs

**When** I open the app between orders or at the end of the day, **I want to** see what I sold today, who owes me with one tap to collect from each of them, and which varieties are running low, **so I can** act right away (collect a debt, restock a variety) instead of reading figures and then looking for the screen where I can act.

**When** my business is new, or has just come in from the spreadsheet, **I want to** see what is still left to set up before I can sell and publish my catalog, and see it go away once done, **so I can** reach my first real sale and a catalog customers can read without guessing where to start.

**When** I stop to see how this week or this month is going, **I want to** see on one screen what I sold, what it cost me, what I spent, what I earned (Ganancia) and the money that actually moved (Caja), **so I can** tell whether I'm making money and how much I actually have, without opening other screens or doing any arithmetic myself.

The first two are served by Hoy; the third by Semana and Mes. Ganancia and Caja exist nowhere else in the product. The spreadsheet's Panel got profit wrong: its profit dropped the week flower was bought.

Success criteria, the period figures:

1. **A glance, from the phone**: the panel opens, and switching between Hoy, Semana (Monday to Sunday) and Mes answers, in under 300 ms with a few hundred sales. Each period shows its date range.
2. **It never disagrees with the dedicated screens**, wherever a figure shows:
   - the period's sales total and count equal Ventas for the same period;
   - Te deben's total, count and oldest date equal the Te deben screen and Clientes' header;
   - each variety's grams, status and days left equal Stock.

   Any figure that disagrees is a defect.
3. **Ganancia and Caja are honest** (Semana and Mes):
   - Ganancia = sales − cost of goods sold − expenses.
   - Caja = payments received − expenses − purchases, each counted on its own date.
   - They appear side by side under those names.
   - A negative figure is shown as it is, never hidden or floored.
   - Pending cost is flagged, never treated as $0 (ADR-0009).
   - Corrected stock entries show the next time the panel opens: a period has no closing date.
4. **Who owes and what's left, at a glance** (Hoy): money owed and stock per variety with its status. Status is told by shape and word, never by color alone.
5. **Businesses never mix** (ADR-0004): every figure and every checklist or notice state comes from the caller's business alone, and the panel's routes join the isolation sweep. No figure goes to the console or browser storage.
6. **Nothing invented, nothing computed in the browser**:
   - every figure comes from the server;
   - a period with no activity shows real zeros;
   - average sale shows nothing when the period has no sales.

Success criteria, Hoy and the first run:

7. **Collect in one tap.** From Hoy, a seller records a payment from a debtor in under a minute, starting from that debtor's "Cobrar". The sheet opens with the customer already chosen. Every payments.md rule holds: oldest debt first, no amount above the balance, preview = stored.
8. **Set up by following the list.** A new business gets a variety priced for today and its stock in place by following the checklist alone, without going into Más. Each step opens the screen where it is done.
9. **Hoy is for acting and nothing is lost.** Hoy shows only sold today, Te deben with Cobrar and Lo que te queda. Ganancia, Caja, Gastos, Regalaste and Compras stay on Semana and Mes with the same definitions and figures.
10. **Nobody is told to do what's done.** A step reads "Hecho" exactly when its condition is true in the data. The checklist is gone once its required steps are done. A business that came in through the import is never handed the setup checklist for things it already has; it gets only the bot notice.
11. **Nothing told by color alone, nothing invented.** "Hecho" is told by box and word, low stock by mark and word, a tappable row by its shape. No placeholder figures.

## Behaviour

### Inicio overall

- Hoy · Semana · Mes, opening on Hoy. Inicio remains the landing screen after login and after accepting an invitation.
- Inicio records only two things: Cobrar's payment and the bot notice's dismissal. Every figure comes from the server; the browser computes nothing.
- Figures are read when Inicio is opened, with no live updates. A step done on another screen, a partner's change or a rename shows the next time Inicio is opened; no toast is added for any of it.
- Everything is per business: every user of a business sees the same state.

### Periods

- Hoy, Semana and Mes, in Argentina time, with the same definitions as Ventas. There is no Fechas.
  - Semana is the Monday-to-Sunday week that contains today.
  - Mes is the current calendar month.
- **Ranges**: "Hoy 03/10", "28/09 – 04/10" and "01/10 – 31/10".
  - Always `dd/mm`, with no month names, even when a week crosses into another month or year.
  - A range covers the whole period, including days still to come. The figures cover only what has been recorded.

### Hoy, in this order

#### Sold today

- "Vendiste hoy": the sum of today's sale totals (shipping included, paid or not), the number of sales (sales, not lines) and the grams sold (lines that are not gifts).
- With no sales today: real zeros ($ 0, 0 sales, 0 g), and no average sale.
- The total and count equal Ventas' Hoy.

#### Te deben

- **Figures**: the total owed, the count of sales still owing, and the oldest owing-since date, as payments.md defines them.
- **Teaser**: up to 3 customers with the highest balance above $0. Ties go by owing since (oldest first), then by name. The design may tune the number.
  - Each row shows the balance and "desde dd/mm", and its area opens that customer's card.
  - Each row carries a separate **"Cobrar"** button, accessible name "Cobrar a <name>".
- Tapping the block's heading opens Te deben.
- Customers in credit never appear and count in no figure.
- **Nobody owes**: the block stays and reads a fixed "Nadie te debe", with nothing to tap.
- **Cobrar** opens payments.md's Registrar cobro with that customer already chosen:
  - "Todo" fills the amount with the balance as it stands now, never the figure shown on Inicio;
  - the date comes filled with today;
  - the oldest-debt-first preview and inline refusals work as defined there.
- **After saving**: the sheet closes and the seller stays on Inicio. The toast is payments.md's own ("Cobro guardado · queda debiendo $ X", or "Cobro guardado"). The block and its totals are read again from the API. A debtor paid in full leaves the block, and the next one moves up.
- **Closing the sheet without saving** returns to Inicio and changes nothing.
- **Stale Cobrar**: a partner may already have paid. A partial payment shows as the smaller balance in the sheet. A full one makes saving meet payments.md's "above the balance" refusal, inline, keeping what was typed. After closing, Inicio reads the block again and the customer is gone. No new state or message exists.

#### Lo que te queda

- Every variety, sorted by name, including varieties with no entries.
- Each one shows what Stock shows:
  - grams;
  - its status mark, told by shape and word;
  - days left;
  - Stock's own detail line: "Sin gramos desde el 30/09", "Avisás abajo de 20 g" or "Cargale la primera entrada".
- A variety with no threshold shows no warning line. There is no total grams.
- Rows whose status is "baja" or "agotada" open that variety's detail (Variedad detail). Rows "ok" and "sin entradas" are not tappable. A tappable row is told by its shape (a chevron or link treatment), never by color alone.

#### Not on Hoy

Hoy shows none of: Ganancia, Caja, Gastos, Regalaste, Compras, Costo de lo vendido, average sale.

### Semana and Mes

Each figure is counted on its own date.

- **Sales**: the sum of the period's sale totals, shipping included, paid or not. It is the same figure as Ventas' total. Its heading follows the tab: "Vendiste esta semana" or "Vendiste este mes".
- **Number of sales**: counts sales, not lines.
- **Average sale**: sales ÷ number of sales, rounded half up to the whole peso. Nothing shows when there are no sales.
- **Grams sold**: the grams of the period's lines that are not gifts.
- **Grams gifted** ("Regalaste"): the grams of the period's gift lines.
- **Cost of goods sold** ("Costo de lo vendido"): what the grams of the period's sale lines (gifts included) cost, from their lots as the lots stand now (ADR-0009, ADR-0010). A negative adjustment's cost is not part of it.
- **Expenses** ("Gastos"): the sum of the period's expenses.
- **Purchases** ("Compras de flores"): the total cost of the period's purchase stock entries.
- **Ganancia**: sales − cost of goods sold − expenses. It takes the design's accent treatment whatever its sign: the accent marks the headline figure, not whether it is good or bad.
- **Caja**: payments received − expenses − purchases. Payments received are every payment dated in the period, on-the-spot and later ones alike, each on its own payment date. Caja is shown side by side with Ganancia.
- Te deben and Lo que te queda do not appear on Semana or Mes.

#### Pending cost

- When any of the period's sale lines has pending grams as the lots stand now, a fixed "incluye costo pendiente" shows under Costo de lo vendido and under Ganancia.
- The note carries no grams or amounts.
- Caja never carries it: pending cost is not money that moved.
- With nothing pending, neither figure shows the note.

#### Negative figures

- Ganancia and Caja may go below zero.
- A negative figure reads with a minus sign before the app's money format: "−$ 4.500".
- It is shown in the neutral treatment, never red or amber, and is never hidden or floored. The sign tells the state.
- "A favor" stays reserved for a customer's credit.

### Setup checklist (Hoy only)

- **Heading**: "Para empezar a vender".
- Four steps, in this order, each with a box. A done step shows its box ticked and the word "Hecho". Each step opens the screen where it is done. Conditions are read live from the business's data:
  1. **"Cargá una variedad con su precio"** (required): Hecho when at least one variety has a current price today. Opens Variedades.
  2. **"Cargá tu stock inicial"** (required): Hecho when the business has at least one stock entry of any origin; a purchase counts as much as opening stock. Opens Nueva entrada in Stock.
  3. **"Conectá el bot de Telegram"**, marked "Opcional": Hecho when the catalog has been published at least once (a first successful Publicar, pinned-catalog.md). A successful Probarlo alone is not enough. Opens Catálogo.
  4. **"Invitá a un socio"**, marked "Opcional": Hecho when the business has more than one user. A join link created but not accepted is not done. Opens Negocio's "Invitá a un socio".
- The optional steps show only while the checklist shows.
- The checklist is gone once both required steps are true at the same time, whatever the optional ones. Once gone, it never comes back for that business or any of its users, even if a price or a stock entry is later deleted.
- While it shows, it replaces "Arrancá por las variedades".
- After it is gone, if no variety has a current price today, "Arrancá por las variedades" shows above Hoy, and the panel still shows its real figures.
- This copy governs. #58's design is the reference for layout and treatment, checked by eye.

### Bot notice (Hoy only)

- **Copy**: "Conectá el bot para publicar tu catálogo en Telegram.", with the button "Conectar el bot", which opens Catálogo, and the dismiss control "No mostrar más".
- It shows when all hold: the checklist is not showing; the business has at least one sale or stock entry; its catalog was never published; nobody in the business has dismissed it.
- Dismissing is one decision for the whole business, shared by all its users, and permanent, even with no bot connected. It shows no toast; the notice simply goes.
- It goes on its own once the catalog is first published.
- Because the spreadsheet import is invisible on screen, it reaches a business that came in through the import and a hand-built one that skipped the bot step alike. That is intended.

### Notices on Inicio

Only three, on Hoy:

- the setup checklist, or "Arrancá por las variedades";
- the bot notice;
- "Tu catálogo en Telegram está desactualizado" (pinned-catalog.md), which keeps its rule and opens Catálogo.

### Businesses that exist when this shipped

- One rule, no special case. A business whose two required steps were already true when the change shipped has its checklist gone from that moment and never sees it. Otherwise it sees the checklist with its done steps marked "Hecho". A business set up but never published sees the bot notice until it is dismissed or the catalog is published.
- No migration writes a "gone" or "dismissed" fact ahead of time for anyone.
- A business with stock but no price today sees the checklist with the stock step "Hecho". That is true: it cannot sell today.

### Inicio's setup state on removal

- The "checklist gone" and "bot notice dismissed" facts are a business's Inicio setup state. Removing the business deletes them, counted as deleted only, and the export file never holds them (accounts.md).

### Avatar

- The first character of the business's name, upper-cased, in a circle. A first character that is not a letter (a digit, an emoji) shows as it is. No image; nothing new is stored.
- At the top of Inicio on Hoy, Semana and Mes, on the phone and the computer. A renamed business shows the new initial the next time Inicio is opened.
- Its accessible name is "Configuración", never the business's name. It is told by shape and name, never by color.
- It opens the Negocio screen (accounts.md). No route or navigation entry is added, renamed or moved by it.

### On screen (Inicio, InicioOscuro, InicioCompu)

- On a computer, it uses `InicioCompu`'s two-column layout. #58's design is the reference, checked by eye.
- It follows the light and dark themes.
- The shell's "Nueva venta" button stays as on every screen.
- A dropped network shows "Sin conexión" (accounts.md).

### Constraints

- The business comes from the session.
- The panel's routes, the dismissal included, join the isolation sweep and the gated-route test. The checklist's "gone" fact and the dismissal carry `business_id`.
- Every figure and every step condition is computed on the server.
- No figure or name goes to logs, the console or browser storage.

## Metrics

- **Speed (criterion 1)**: the panel, with the checklist and notice states, and each period switch, answer in under 300 ms with a few hundred sales and a few dozen varieties and customers.
- **Agreement (criteria 2, 9)**: 0 differences:
  - each period's sales total and count against Ventas;
  - Te deben figures against Te deben and Clientes' header;
  - each variety's grams, status, days left and detail against Stock.
- **Nothing lost (criterion 9)**: Semana's and Mes's figures are unchanged from before the redesign, 0 differences; Hoy shows none of Ganancia, Caja, Gastos, Regalaste, Compras, Costo de lo vendido or average sale.
- **Formulas (criterion 3)**: a matrix, 100% passing, covering:
  - Ganancia and Caja;
  - payments counted on their own date, not the sale's;
  - a backdated purchase or an edited stock entry moving cost of goods sold and Ganancia;
  - pending cost showing the note under Costo de lo vendido and Ganancia only;
  - negative Ganancia and Caja shown as "−$ X".
- **Period edges**: a week that crosses a month and a year, Monday as the first day, and a day boundary in Argentina time. 100% passing.
- **Debtors teaser (criterion 4)**: ordered by balance, then owing since, then name; credits excluded; "Nadie te debe" when nobody owes. No state is told by color alone.
- **Collect in one tap (criterion 7)**:
  - the end-to-end front run, from a phone viewport, taps "Cobrar a <name>" on Hoy, records a payment with "Todo" and ends on Inicio in under 60 s;
  - the sheet opens with that customer and the current balance;
  - a debtor paid in full leaves the block and the next one moves up;
  - a stale Cobrar shows the existing refusal and keeps what was typed.
  - Cobrar's share of payments is not measured: a payment records no origin.
- **Set up by the list (criterion 8)**: the end-to-end run takes an empty business through the checklist alone (priced variety, then stock) with no visit to Más, and the checklist disappears. Indicator only: businesses whose checklist went before their first sale.
- **"Hecho" is true (criterion 10)**: a matrix, 100% passing, of every step's condition against the box and word shown (a price today or not; one stock entry of each origin; a published catalog versus Probarlo only; one user, two, and a pending join link). It also covers the checklist gone at both required steps and still gone after a deletion, a business meeting both at deploy never seeing it, and stock without a price showing stock "Hecho".
- **Copy**: the checklist heading, the four step labels, "Opcional", "Hecho" and the bot notice's line, button and dismiss control read exactly as written above, checked by front tests.
- **Bot notice**: a matrix of its four conditions, 100% passing; one user's dismissal hides it for a partner; it goes on first publish; it never shows with the checklist; no pre-dismissed or pre-gone fact exists after migration.
- **Notices**: Inicio shows no notices other than the three; the stale-catalog notice opens Catálogo.
- **Hoy's rows**: "baja" and "agotada" rows open Variedad detail, "ok" and "sin entradas" are not tappable; Cobrar's accessible name equals "Cobrar a <name>"; the row's other area opens the card.
- **Avatar**: the upper-cased first character (letter and non-letter cases), accessible name "Configuración", opens Negocio, on all three tabs and the computer layout; a rename shows on the next open.
- **Isolation (criterion 5)**: from another business, the panel's routes show none of the first business's figures or checklist and notice state. After a full front run, the console and browser storage hold no figures or names.
- **Nothing invented (criteria 6, 11)**:
  - an empty business shows $ 0 and 0 g, with no average sale;
  - every figure on screen equals the API's answer;
  - "Hecho", status marks and tappable rows are told by shape and word, checked in both themes.
- **Design comparison**: the `scripts/design/compare.sh` before-and-after comparisons are attached to the PR.
- **No curl**: the end-to-end front run opens Inicio, switches across the three periods, opens Te deben from the block, a customer from the teaser, collects with Cobrar, opens a low variety, and dismisses the bot notice.

## Out of scope

- Fechas or any custom range; comparing with earlier periods; charts.
- Recording anything from Inicio other than Cobrar's payment and the bot notice's dismissal.
- Recording which route a payment came from.
- Live updates between partners.
- Margins per variety (analysis.md).
- How a negative adjustment's cost counts on the panel.
- Stock's total grams on the panel.
- The bar, routes and renaming Negocio to Configuración: part 2.
- Bringing the checklist back once gone; undoing a dismissal.
- Exporting Inicio's setup state.
- An image or color of the business's own for the avatar.
