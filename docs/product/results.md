# Results

Whether a business makes money and how much it actually has, over today, this week and this month: the panel on Inicio. It is read only and seen only by its business (ADR-0004). It reads:

- sales and their totals from sales;
- cost of goods sold, stock shortfall and the cost of stock withdrawals (promotion and own use) from stock's lots (ADR-0009, ADR-0010);
- expenses from expenses;
- purchases from stock;
- payments, balances and settlement from payments (ADR-0012);
- stock status and days left from stock.

It computes nothing those capabilities already compute, beyond adding them up. Its period figures come from the one computation Análisis also reads (ADR-0020): Ganancia here and profit in Análisis are the same figure. Inicio also carries the Onboarding's notice (onboarding.md), the first-run checklist and the after-import notice (navigation.md); their place on Inicio is set here. An archived variety (varieties.md) leaves Lo que te queda and "Start with varieties", while every period figure keeps it.

## Jobs

**When** I open the app, or stop between orders or at the end of the day to see how today, this week or this month is going, **I want to** see on one screen what I sold, what it cost me, what I spent, what I earned (Ganancia), the money that actually moved (Caja), who owes me and what I have left of each variety, **so I can** tell whether I'm making money and how much I actually have, and know whether to restock or chase a debt, without opening Ventas, Clientes and Variedades one by one or doing any arithmetic myself.

Ganancia and Caja exist nowhere else in the product, and they are why the panel exists. The spreadsheet's Panel got profit wrong: its profit dropped the week flower was bought. Showing debt and stock on the same screen is a convenience on top of that.

**When** I open the app between orders or at the end of the day, **I want** to see what I sold today, who owes me and what is running out, and act on it at once (collect from a debtor, open a variety that is running low, fix what a notice tells me), **so I can** get back to the customer without going through Clientes and Variedades one by one or doing any arithmetic.

This refines the panel job above and the navigation job for Hoy (GH-45); it is not a new job. Its protagonist is the seller, on the phone, with little time; Semana and Mes are for the weekly or monthly look, Análisis for anything deeper. Before it, the seller went into Clientes to collect and into Variedades variety by variety, and set the business up without a guide, often forgetting the bot.

**When** I take grams out of my own stock without selling them (to share at a party so people get to know the business, or for my own use), **I want** to record them from my phone in a few taps (date, varieties and grams, the reason), **so I can** keep stock right and see in Ganancia what promoting the business and my own consumption cost me, without recording a sale nobody made or an adjustment that reads as lost flower. (Served here by the Promoción and Consumo propio lines of Semana and Mes; the withdrawal is defined in stock.md.)

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often, **so I can** get back to the customer instead of hunting through menus. (The navigation job, navigation.md: served here by Hoy showing what can be acted on today, with "Cobrar" on each debtor.)

**When** I have just opened my business and it is still empty, **I want** to be walked through what it needs, one short step at a time, with defaults already filled in, **so I can** record my first sale the same day without hunting through Configuración, Variedades and the catalog screen. (Served here by the "Seguí con la configuración" notice at the top of Inicio, the only way back into the Onboarding; defined in onboarding.md.)

**When** a variety I loaded by mistake, or one I no longer work with, keeps showing in my lists and pickers, **I want** to take it out from my phone in a few taps, deleting it if it never moved and archiving it if it has history, **so** my lists show only what I still sell, no past sale, stock, cost or profit figure changes, and I can bring it back exactly as it was if I start selling it again. (Served here by Lo que te queda leaving archived varieties out while every period figure stays the same; defined in varieties.md.)

Success criteria:

1. **A glance, from the phone**: the panel opens, and switching between Hoy, Semana (Monday to Sunday) and Mes answers, in under 300 ms with a few hundred sales. Each period shows its date range.
2. **It never disagrees with the dedicated screens**:
   - the period's sales total and count equal Ventas for the same period;
   - Te deben's total, count and oldest date equal Clientes' Te deben section;
   - each variety's grams, status and days left equal Variedades;
   - Semana's and Mes's Ganancia, cost of goods sold, stock shortfall, Promoción, Consumo propio, expenses and Caja equal Análisis's row for the same week and month.

   Any figure that disagrees is a defect.
3. **Ganancia and Caja are honest**:
   - Ganancia = sales − cost of goods sold − stock shortfall − promotion cost − own-use cost − expenses (CONTEXT.md: Profit).
   - Caja = payments received − expenses − purchases, each counted on its own date.
   - They appear side by side under those names, in Semana and Mes.
   - A negative figure is shown as it is, never hidden or floored.
   - Pending cost is flagged, never treated as $0 (ADR-0009). Ganancia is then worked out over the costed part.
   - Flower lost to a negative adjustment lowers Ganancia on the adjustment's date.
   - Grams withdrawn for promotion or own use lower Ganancia on the withdrawal's date, each reason on its own line, never folded into cost of goods sold or stock shortfall.
   - Corrected stock entries and withdrawals show the next time the panel opens: a period has no closing date.
   - Archiving or restoring a variety moves no figure.
4. **Who owes and what's left, at a glance**: money owed, each debtor one tap from collecting, and stock per unarchived variety with its status. Status is told by shape and word, never by color alone.
5. **Businesses never mix** (ADR-0004): every figure comes from the caller's business alone, and the panel route joins the isolation sweep. No figure goes to the console or browser storage.
6. **Nothing invented, nothing computed in the browser**:
   - every figure comes from the server;
   - a period with no activity shows real zeros;
   - average sale shows nothing when the period has no sales.
7. **A withdrawal is not a sale**: recording one leaves sales, number of sales, average sale, grams sold, Regalaste, cost of goods sold, stock shortfall and Caja exactly as they were.
8. **Collect in one tap from Hoy**: "Cobrar" on each debtor row of the Te deben block opens Registrar cobro with that customer chosen, accessible name "Cobrar a <name>"; back or "Cerrar" leaves it in one move.
9. **Hoy is only what can be acted on**: sold today, then Te deben, then Lo que te queda; a low variety links to its page; no result figure (Ganancia, Caja, costs, Gastos, Regalaste, Compras) shows on Hoy.
10. **First run follows today's definition**: a brand-new business gets the Onboarding notice; only a business that existed before the Onboarding shipped sees the four-step checklist; an imported business sees the dismissable after-import notice; at most one first-run element shows at a time (navigation.md).
11. **Every notice leads to its fix**: "Your Telegram catalog is out of date" opens the catalog screen; the business avatar opens Configuración.
12. **Looks as designed**: Inicio, InicioOscuro and InicioCompu match `docs/product/design-system/pantallas/`, phone and computer, both themes.

## Behaviour

### Periods

- Hoy, Semana and Mes, in Argentina time, with the same definitions as Ventas. There is no Fechas.
  - Semana is the Monday-to-Sunday week that contains today.
  - Mes is the current calendar month.
- The panel opens on Hoy.
- **Ranges**: "Hoy 03/10", "28/09 – 04/10" and "01/10 – 31/10".
  - Always `dd/mm`, with no month names, even when a week crosses into another month or year.
  - A range covers the whole period, including days still to come. The figures cover only what has been recorded.

### Figures per period

Each figure is counted on its own date. Sales, cost of goods sold, stock shortfall, promotion and own-use cost, expenses, Ganancia and Caja come from the same period computation as Análisis (ADR-0020), never from a second sum. They count every variety, archived ones included.

- **Sales**: the sum of the period's sale totals, shipping included, paid or not. It is the same figure as Ventas' total. Its heading follows the tab: "Vendiste hoy", "Vendiste esta semana" or "Vendiste este mes". Withdrawals are never sales.
- **Number of sales**: counts sales, not lines.
- **Average sale**: sales ÷ number of sales, rounded half up to the whole peso. Nothing shows when there are no sales.
- **Grams sold**: the grams of the period's lines that are not gifts.
- **Grams gifted** ("Regalaste"): the grams of the period's gift lines. Withdrawn grams are never gifted grams.
- **Cost of goods sold** ("Cost of goods sold"): what the grams of the period's sale lines (gifts included) cost, from their lots as the lots stand now (ADR-0009, ADR-0010). Neither a negative adjustment's cost nor a withdrawal's is part of it.
- **Stock shortfall** ("Stock shortfall"): what the grams taken out by the period's negative adjustments cost, on the adjustment's date, from their lots as they stand now, oldest first (CONTEXT.md: Stock shortfall). It shows as "Faltante de stock $ X" only when the period has any negative adjustment; otherwise the line is left out. It never includes a withdrawal.
- **Promotion cost** ("Promotion") and **own-use cost** ("Own use"): what the grams of the period's withdrawals of that reason cost, on the withdrawal's date, from their lots as they stand now, oldest first. Each shows as "Promoción $ X" or "Consumo propio $ X" only when the period has a withdrawal of that reason; otherwise its line is left out.
- **Expenses** ("Gastos"): the sum of the period's expenses.
- **Purchases** ("Compras de flores"): the total cost of the period's purchase stock entries.
- **Ganancia**: sales − cost of goods sold − stock shortfall − promotion cost − own-use cost − expenses.
  - When any of its cost is pending, it is worked out over the costed part: the sales of pending grams are left out (sales − (sales without shipping − sales of costed grams) − costed cost of goods − costed shortfall − costed promotion cost − costed own-use cost − expenses), with sales of costed grams per line as CONTEXT.md's Margin defines them (line total × costed grams ÷ line grams, half up). The sales figure shown stays the full sales.
  - It is the same figure Análisis shows as profit for the same week or month.
  - It takes the design's accent treatment whatever its sign: the accent marks the headline figure, not whether it is good or bad.
- **Caja**: payments received − expenses − purchases. Payments received are every payment dated in the period, on-the-spot and later ones alike, each on its own payment date. Caja is shown side by side with Ganancia. A withdrawal never touches it.

### What each tab shows

- **Hoy** shows what can be acted on today, top to bottom: what was sold today (sales, number of sales, average sale and grams sold), then the Te deben block, then Lo que te queda.
- **Semana and Mes** show sales, number of sales, average sale, grams sold, Regalaste, Costo de lo vendido, Faltante de stock (when the period has one), Promoción and Consumo propio (each when the period has one), Gastos, Compras de flores, Ganancia and Caja, then the Te deben block and Lo que te queda. Promoción and Consumo propio sit right after Faltante de stock and before Gastos.
- Ganancia, Caja, Costo de lo vendido, Faltante de stock, Promoción, Consumo propio, Gastos, Regalaste and Compras never show on Hoy.

### Pending cost

- A fixed "incluye costo pendiente" note, with no grams or amounts:
  - under Costo de lo vendido, when any of the period's sale lines has pending grams as the lots stand now;
  - under Faltante de stock, when any of the period's negative adjustments has pending grams;
  - under Promoción, when any of the period's promotion withdrawals has pending grams; under Consumo propio, likewise for own use;
  - under Ganancia, when any of those applies.
- Caja never carries it: pending cost is not money that moved.
- With nothing pending, no figure shows the note.

### Negative figures

- Ganancia and Caja may go below zero.
- A negative figure reads with a minus sign before the app's money format: "−$ 4.500".
- It is shown in the neutral treatment, never red or amber, and is never hidden or floored. The sign tells the state.
- "A favor" stays reserved for a customer's credit.

### Te deben block

- **Figures**: the total owed, the count of sales still owing ("1 venta debiendo" or "N ventas debiendo") and the oldest owing-since date, as payments.md defines them.
- **Teaser**: up to 3 customers with the highest balance above $0. Ties go by owing since (oldest first), then by name. The design may tune the number.
  - Each row shows the balance in amber and "desde dd/mm", and carries "Cobrar" (accessible name "Cobrar a <name>"), which opens Registrar cobro with that customer already chosen (payments.md), as an entry in the app's history.
  - Tapping the rest of the row opens that customer's card.
- Tapping the block's heading opens Clientes, on its Te deben section.
- Customers in credit never appear and count in no figure.
- **Nobody owes**: the block stays and reads a fixed "Nadie te debe", with nothing to tap.
- **After "Cobrar"**: Registrar cobro follows payments.md unchanged (a partial payment allowed, a payment above the balance refused inline keeping everything typed, "Todo" filling the whole balance). Saving or "Cerrar" returns to Inicio in one move. The toast is payments.md's "Cobro guardado · queda debiendo $ X", or "Cobro guardado" when nothing is left owing; it never names the customer. The block refreshes from the API:
  - the total, the count and the oldest date update;
  - a debtor still owing stays, with the new balance;
  - a debtor paid in full leaves, and the teaser refills to 3 by its own order;
  - with nobody left owing, it reads "Nadie te debe".

  Inicio adds no animation and no rule of its own.

### Lo que te queda

- Every unarchived variety, sorted by name, including varieties with no entries. Archived varieties are left out (varieties.md).
- Each one shows what Variedades shows:
  - grams;
  - its status mark, told by shape and word;
  - days left;
  - its detail line: "Sin gramos desde el 30/09", "Avisás abajo de 20 g" or "Cargale la primera entrada".
- A variety that is low links to its page (varieties.md).
- A variety with no threshold shows no warning line.
- Low varieties are not moved first; the order is by name.
- There is no total grams.

### On screen (Inicio, InicioOscuro, InicioCompu)

- Inicio is the panel and a tab root (navigation.md), and remains the landing screen after login and after accepting a join invitation. Accepting a new-business invitation lands in the Onboarding instead (onboarding.md).
- **At its top**: the business's avatar, which opens Configuración.
- **Top to bottom, above the figures**:
  1. the first-run element of the business, at most one of:
     - "Seguí con la configuración", while the Onboarding is not over (onboarding.md): "N de 6 pasos" and what is next, not dismissible;
     - the first-run checklist while it shows (navigation.md), for a business that existed before the Onboarding.

     Once neither applies, "Start with varieties" takes this place whenever no unarchived variety has a current price today. It never shows together with the Onboarding notice or the checklist;
  2. "Your Telegram catalog is out of date", while the pinned catalog is out of date (pinned-catalog.md). It opens the catalog screen (catalog.md);
  3. "Connect the bot so the pinned catalog updates itself", for a business loaded by the spreadsheet import, until dismissed or the bot is first published (navigation.md);
  4. the tab's figures, as listed above.
- First-run state belongs to the business: every user of it, a partner who joined included, sees the same element.
- Semana and Mes keep the same notices above their own figures.
- On a computer, it uses `InicioCompu`'s two-column layout, with the same notices in the same order at the top.
- It follows the light and dark themes, and matches `docs/product/design-system/pantallas/` in both.
- It is not an action menu:
  - it records nothing itself and has no toasts of its own;
  - its one main action is the shell's "+ Nueva venta"; "Cobrar" on debtor rows is the only other direct action, besides the notices, which only open where their fix is.
- The figures are read when the panel is opened, with no live updates.
- A dropped network shows "Sin conexión"; a server error shows the generic retry (accounts.md).

### Constraints

- The business comes from the session.
- The panel route joins the isolation sweep and the gated-route test.
- Every figure is computed on the server, and so is which first-run element and which notices show, the Onboarding notice's count and what is next, and each checklist step.
- No figure or name goes to logs, the console or browser storage.

## Metrics

- **Speed (criterion 1)**: the panel, and each period switch, answer in under 300 ms with a few hundred sales and a few dozen varieties and customers. Guarded by query plan and statement count, never elapsed time (ADR-0038): the same number of statements on a small seeded business as on a seeded year.
- **Agreement (criterion 2)**: 0 differences, per period:
  - sales total and count against Ventas;
  - Te deben figures against Clientes' Te deben section;
  - each variety's grams, status, days left and detail against Variedades;
  - Semana's and Mes's Ganancia, cost of goods sold, stock shortfall, Promoción, Consumo propio, expenses and Caja against `GET /analysis`'s row for the same week and month, over a seeded history that includes a negative adjustment with costed grams, one with pending grams, a sale line with pending grams, a costed withdrawal of each reason and a withdrawal with pending grams.
- **Formulas (criterion 3)**: a matrix, 100% passing, covering:
  - Ganancia and Caja;
  - payments counted on their own date, not the sale's;
  - a backdated purchase or an edited stock entry moving cost of goods sold and Ganancia;
  - a negative adjustment lowering Ganancia by its costed shortfall on its own date, showing "Faltante de stock $ X", and leaving cost of goods sold and Caja unchanged;
  - a withdrawal of each reason lowering Ganancia on its own date, showing its own line, and leaving cost of goods sold, stock shortfall and Caja unchanged;
  - a period with no negative adjustment showing no Faltante de stock line, and one with no withdrawal of a reason showing no line for it;
  - pending grams on a sale line leaving their sales out of Ganancia while "Vendiste" keeps the full sales;
  - pending cost showing the note under Costo de lo vendido, Faltante de stock, Promoción, Consumo propio and Ganancia as defined, and never under Caja;
  - negative Ganancia and Caja shown as "−$ X".
- **Archiving moves nothing (criterion 3)**: every period figure is identical before archiving a variety with history, after archiving and after restoring; the archived variety is absent from Lo que te queda and does not count for "Start with varieties".
- **Not a sale (criterion 7)**: after recording a withdrawal, 0 differences in sales, number of sales, average sale, grams sold, Regalaste, cost of goods sold, stock shortfall and Caja.
- **Tabs (criterion 9)**: front tests, phone and computer, show Hoy with sold today, Te deben and Lo que te queda only, in that order, and Ganancia, Caja, Costo de lo vendido, Faltante de stock, Promoción, Consumo propio, Gastos, Regalaste and Compras only on Semana and Mes, Promoción and Consumo propio right after Faltante de stock.
- **One-tap collect (criterion 8)**: the end-to-end front run, phone and computer viewports, taps "Cobrar a <name>" on Hoy, Registrar cobro opens with that customer chosen, a payment is saved, and one back move returns to Inicio.
- **Refresh after Cobrar**: front tests show a partial payment leaving the debtor with the new balance, a full payment removing the row and the teaser refilling to 3 by its order, "Nadie te debe" when nobody is left owing, and both toasts reading as specified with no customer name.
- **Inicio's order (criteria 10, 11)**: front tests, phone and computer, show at most one of the Onboarding notice, the checklist or "Start with varieties" (never two), then the out-of-date notice, then the after-import notice, then the figures; the out-of-date notice opens the catalog screen and the avatar opens Configuración.
- **First run (criterion 10)**: the first-run matrices of navigation.md, 100% passing.
- **Period edges**: a week that crosses a month and a year, Monday as the first day, and a day boundary in Argentina time. 100% passing.
- **Debtors teaser (criterion 4)**: ordered by balance, then owing since, then name; credits excluded; "Nadie te debe" when nobody owes; "Cobrar" with its accessible name on every row. No state is told by color alone, in both themes.
- **Isolation (criterion 5)**: from another business, the panel route shows none of the first business's figures, Onboarding state or first-run state. After a full front run, the console and browser storage hold no figures or names.
- **Nothing invented (criterion 6)**:
  - an empty business shows $ 0 and 0 g, with no average sale and no Faltante de stock, Promoción or Consumo propio line;
  - every figure on screen equals the API's answer.
- **Looks as designed (criterion 12)**: `scripts/design/compare.sh` runs before and after for Inicio, InicioOscuro and InicioCompu, phone and computer, with the captures attached to the PR and every difference from the design listed.
- **No curl**: the end-to-end front run opens Inicio, switches across the three periods, reads Promoción and Consumo propio after recording a withdrawal of each reason, opens Clientes from the block's heading, a customer from the teaser, and Registrar cobro from a teaser row's "Cobrar".
- **Business measure**, read by the operator from existing records only, never shown in the app: the share of pre-Onboarding businesses that complete the checklist, and the share of imported businesses that publish the catalog.

## Out of scope

- Fechas or any custom range; comparing with earlier periods; charts.
- Recording anything from the panel other than through "+ Nueva venta" and "Cobrar".
- Live updates between partners.
- Margins per variety (#8), stock shortfall per variety, and promotion or own-use cost per variety.
- Pending grams counted on the panel ("y N g sin costo"): the panel's note is fixed and carries no grams; Análisis shows the counts.
- Stock's total grams on the panel.
- Dismissing the Onboarding notice.
- Archived varieties on the panel.
- Putting low varieties first in Lo que te queda.
- Restyling Registrar cobro to `Cobro.dc.html`: the payments screen's own work.
- A checklist for a brand-new business: it gets the Onboarding.
