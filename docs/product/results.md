# Results

Whether a business makes money and how much it actually has, over today, this week and this month: the panel on Inicio. It is read only and seen only by its business (ADR-0004). It reads:

- sales and their totals from sales;
- cost of goods sold from stock's lots (ADR-0009, ADR-0010);
- expenses from expenses;
- purchases from stock;
- payments, balances and settlement from payments (ADR-0012);
- stock status and days left from stock.

It computes nothing those capabilities already compute, beyond adding them up.

## Jobs

**When** I open the app, or stop between orders or at the end of the day to see how today, this week or this month is going, **I want to** see on one screen what I sold, what it cost me, what I spent, what I earned (Ganancia), the money that actually moved (Caja), who owes me and what I have left of each variety, **so I can** tell whether I'm making money and how much I actually have, and know whether to restock or chase a debt, without opening Ventas, Clientes and Stock one by one or doing any arithmetic myself.

Ganancia and Caja exist nowhere else in the product, and they are why the panel exists. The spreadsheet's Panel got profit wrong: its profit dropped the week flower was bought. Showing debt and stock on the same screen is a convenience on top of that.

Success criteria:

1. **A glance, from the phone**: the panel opens, and switching between Hoy, Semana (Monday to Sunday) and Mes answers, in under 300 ms with a few hundred sales. Each period shows its date range.
2. **It never disagrees with the dedicated screens**:
   - the period's sales total and count equal Ventas for the same period;
   - Te deben's total, count and oldest date equal the Te deben screen and Clientes' header;
   - each variety's grams, status and days left equal Stock.

   Any figure that disagrees is a defect.
3. **Ganancia and Caja are honest**:
   - Ganancia = sales − cost of goods sold − expenses.
   - Caja = payments received − expenses − purchases, each counted on its own date.
   - They appear side by side under those names.
   - A negative figure is shown as it is, never hidden or floored.
   - Pending cost is flagged, never treated as $0 (ADR-0009).
   - Corrected stock entries show the next time the panel opens: a period has no closing date.
4. **Who owes and what's left, at a glance**: money owed and stock per variety with its status. Status is told by shape and word, never by color alone.
5. **Businesses never mix** (ADR-0004): every figure comes from the caller's business alone, and the panel route joins the isolation sweep. No figure goes to the console or browser storage.
6. **Nothing invented, nothing computed in the browser**:
   - every figure comes from the server;
   - a period with no activity shows real zeros;
   - average sale shows nothing when the period has no sales.

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

Each figure is counted on its own date.

- **Sales**: the sum of the period's sale totals, shipping included, paid or not. It is the same figure as Ventas' total. Its heading follows the tab: "Vendiste hoy", "Vendiste esta semana" or "Vendiste este mes".
- **Number of sales**: counts sales, not lines.
- **Average sale**: sales ÷ number of sales, rounded half up to the whole peso. Nothing shows when there are no sales.
- **Grams sold**: the grams of the period's lines that are not gifts.
- **Grams gifted** ("Regalaste"): the grams of the period's gift lines.
- **Cost of goods sold** ("Costo de lo vendido"): what the grams of the period's sale lines (gifts included) cost, from their lots as the lots stand now (ADR-0009, ADR-0010). A negative adjustment's cost is not part of it.
- **Expenses** ("Gastos"): the sum of the period's expenses.
- **Purchases** ("Compras de flores"): the total cost of the period's purchase stock entries.
- **Ganancia**: sales − cost of goods sold − expenses. It takes the design's accent treatment whatever its sign: the accent marks the headline figure, not whether it is good or bad.
- **Caja**: payments received − expenses − purchases. Payments received are every payment dated in the period, on-the-spot and later ones alike, each on its own payment date. Caja is shown side by side with Ganancia.

### Pending cost

- When any of the period's sale lines has pending grams as the lots stand now, a fixed "incluye costo pendiente" shows under Costo de lo vendido and under Ganancia.
- The note carries no grams or amounts.
- Caja never carries it: pending cost is not money that moved.
- With nothing pending, neither figure shows the note.

### Negative figures

- Ganancia and Caja may go below zero.
- A negative figure reads with a minus sign before the app's money format: "−$ 4.500".
- It is shown in the neutral treatment, never red or amber, and is never hidden or floored. The sign tells the state.
- "A favor" stays reserved for a customer's credit.

### Te deben block

- **Figures**: the total owed, the count of sales still owing, and the oldest owing-since date, as payments.md defines them.
- **Teaser**: up to 3 customers with the highest balance above $0. Ties go by owing since (oldest first), then by name. The design may tune the number.
  - Each row shows the balance and "desde dd/mm", and opens that customer's card.
- Tapping the block's heading opens Te deben.
- Customers in credit never appear and count in no figure.
- **Nobody owes**: the block stays and reads a fixed "Nadie te debe", with nothing to tap.

### Lo que te queda

- Every variety, sorted by name, including varieties with no entries.
- Each one shows what Stock shows:
  - grams;
  - its status mark, told by shape and word;
  - days left;
  - Stock's own detail line: "Sin gramos desde el 30/09", "Avisás abajo de 20 g" or "Cargale la primera entrada".
- A variety with no threshold shows no warning line.
- There is no total grams.

### On screen (Inicio, InicioOscuro, InicioCompu)

- Inicio is the panel, and remains the landing screen after login and after accepting an invitation.
- When no variety has a current price today, "Arrancá por las variedades" shows above the panel, and the panel still shows its real figures.
- On a computer, it uses `InicioCompu`'s two-column layout.
- It follows the light and dark themes.
- It is read-only:
  - it records nothing and has no toasts;
  - the shell's "Nueva venta" button stays as on every screen.
- The figures are read when the panel is opened, with no live updates.
- A dropped network shows "Sin conexión" (accounts.md).

### Constraints

- The business comes from the session.
- The panel route joins the isolation sweep and the gated-route test.
- Every figure is computed on the server.
- No figure or name goes to logs, the console or browser storage.

## Metrics

- **Speed (criterion 1)**: the panel, and each period switch, answer in under 300 ms with a few hundred sales and a few dozen varieties and customers.
- **Agreement (criterion 2)**: 0 differences, per period:
  - sales total and count against Ventas;
  - Te deben figures against Te deben and Clientes' header;
  - each variety's grams, status, days left and detail against Stock.
- **Formulas (criterion 3)**: a matrix, 100% passing, covering:
  - Ganancia and Caja;
  - payments counted on their own date, not the sale's;
  - a backdated purchase or an edited stock entry moving cost of goods sold and Ganancia;
  - pending cost showing the note under Costo de lo vendido and Ganancia only;
  - negative Ganancia and Caja shown as "−$ X".
- **Period edges**: a week that crosses a month and a year, Monday as the first day, and a day boundary in Argentina time. 100% passing.
- **Debtors teaser (criterion 4)**: ordered by balance, then owing since, then name; credits excluded; "Nadie te debe" when nobody owes. No state is told by color alone.
- **Isolation (criterion 5)**: from another business, the panel route shows none of the first business's figures. After a full front run, the console and browser storage hold no figures or names.
- **Nothing invented (criterion 6)**:
  - an empty business shows $ 0 and 0 g, with no average sale;
  - every figure on screen equals the API's answer.
- **No curl**: the end-to-end front run opens Inicio, switches across the three periods, opens Te deben from the block and a customer from the teaser.

## Out of scope

- Fechas or any custom range; comparing with earlier periods; charts.
- Recording anything from the panel.
- Live updates between partners.
- Margins per variety (#8).
- How a negative adjustment's cost counts anywhere.
- Stock's total grams on the panel.
