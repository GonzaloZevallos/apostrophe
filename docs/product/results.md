# Results

Whether a business makes money and how much it actually has, over today, this week and this month: the panel on Inicio. It is read only and seen only by its business (ADR-0004). It reads:

- sales and their totals from sales;
- cost of goods sold and stock shortfall from stock's lots (ADR-0009, ADR-0010);
- expenses from expenses;
- purchases from stock;
- payments, balances and settlement from payments (ADR-0012);
- stock status and days left from stock.

It computes nothing those capabilities already compute, beyond adding them up. Its period figures come from the one computation Análisis also reads (ADR-0020): Ganancia here and profit in Análisis are the same figure.

## Jobs

**When** I open the app, or stop between orders or at the end of the day to see how today, this week or this month is going, **I want to** see on one screen what I sold, what it cost me, what I spent, what I earned (Ganancia), the money that actually moved (Caja), who owes me and what I have left of each variety, **so I can** tell whether I'm making money and how much I actually have, and know whether to restock or chase a debt, without opening Ventas, Clientes and Stock one by one or doing any arithmetic myself.

Ganancia and Caja exist nowhere else in the product, and they are why the panel exists. The spreadsheet's Panel got profit wrong: its profit dropped the week flower was bought. Showing debt and stock on the same screen is a convenience on top of that.

Success criteria:

1. **A glance, from the phone**: the panel opens, and switching between Hoy, Semana (Monday to Sunday) and Mes answers, in under 300 ms with a few hundred sales. Each period shows its date range.
2. **It never disagrees with the dedicated screens**:
   - the period's sales total and count equal Ventas for the same period;
   - Te deben's total, count and oldest date equal the Te deben screen and Clientes' header;
   - each variety's grams, status and days left equal Stock;
   - Semana's and Mes's Ganancia, cost of goods sold, stock shortfall, expenses and Caja equal Análisis's row for the same week and month.

   Any figure that disagrees is a defect.
3. **Ganancia and Caja are honest**:
   - Ganancia = sales − cost of goods sold − stock shortfall − expenses (CONTEXT.md: Profit).
   - Caja = payments received − expenses − purchases, each counted on its own date.
   - They appear side by side under those names.
   - A negative figure is shown as it is, never hidden or floored.
   - Pending cost is flagged, never treated as $0 (ADR-0009). Ganancia is then worked out over the costed part.
   - Flower lost to a negative adjustment lowers Ganancia on the adjustment's date.
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

Each figure is counted on its own date. Sales, cost of goods sold, stock shortfall, expenses, Ganancia and Caja come from the same period computation as Análisis (ADR-0020), never from a second sum.

- **Sales**: the sum of the period's sale totals, shipping included, paid or not. It is the same figure as Ventas' total. Its heading follows the tab: "Vendiste hoy", "Vendiste esta semana" or "Vendiste este mes".
- **Number of sales**: counts sales, not lines.
- **Average sale**: sales ÷ number of sales, rounded half up to the whole peso. Nothing shows when there are no sales.
- **Grams sold**: the grams of the period's lines that are not gifts.
- **Grams gifted** ("Regalaste"): the grams of the period's gift lines.
- **Cost of goods sold** ("Costo de lo vendido"): what the grams of the period's sale lines (gifts included) cost, from their lots as the lots stand now (ADR-0009, ADR-0010). A negative adjustment's cost is not part of it.
- **Stock shortfall** ("Faltante de stock"): what the grams taken out by the period's negative adjustments cost, on the adjustment's date, from their lots as they stand now, oldest first (CONTEXT.md: Stock shortfall). It shows as "Faltante de stock $ X" only when the period has any negative adjustment; otherwise the line is left out.
- **Expenses** ("Gastos"): the sum of the period's expenses.
- **Purchases** ("Compras de flores"): the total cost of the period's purchase stock entries.
- **Ganancia**: sales − cost of goods sold − stock shortfall − expenses.
  - When any of its cost is pending, it is worked out over the costed part: the sales of pending grams are left out (sales − (sales without shipping − sales of costed grams) − costed cost of goods − costed shortfall − expenses), with sales of costed grams per line as CONTEXT.md's Margin defines them (line total × costed grams ÷ line grams, half up). The sales figure shown stays the full sales.
  - It is the same figure Análisis shows as profit for the same week or month.
  - It takes the design's accent treatment whatever its sign: the accent marks the headline figure, not whether it is good or bad.
- **Caja**: payments received − expenses − purchases. Payments received are every payment dated in the period, on-the-spot and later ones alike, each on its own payment date. Caja is shown side by side with Ganancia.

### Pending cost

- A fixed "incluye costo pendiente" note, with no grams or amounts:
  - under Costo de lo vendido, when any of the period's sale lines has pending grams as the lots stand now;
  - under Faltante de stock, when any of the period's negative adjustments has pending grams;
  - under Ganancia, when either of those applies.
- Caja never carries it: pending cost is not money that moved.
- With nothing pending, no figure shows the note.

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
  - each variety's grams, status, days left and detail against Stock;
  - Semana's and Mes's Ganancia, cost of goods sold, stock shortfall, expenses and Caja against `GET /analysis`'s row for the same week and month, over a seeded history that includes a negative adjustment with costed grams, one with pending grams, and a sale line with pending grams.
- **Formulas (criterion 3)**: a matrix, 100% passing, covering:
  - Ganancia and Caja;
  - payments counted on their own date, not the sale's;
  - a backdated purchase or an edited stock entry moving cost of goods sold and Ganancia;
  - a negative adjustment lowering Ganancia by its costed shortfall on its own date, showing "Faltante de stock $ X", and leaving cost of goods sold and Caja unchanged;
  - a period with no negative adjustment showing no Faltante de stock line;
  - pending grams on a sale line leaving their sales out of Ganancia while "Vendiste" keeps the full sales;
  - pending cost showing the note under Costo de lo vendido, Faltante de stock and Ganancia as defined, and never under Caja;
  - negative Ganancia and Caja shown as "−$ X".
- **Period edges**: a week that crosses a month and a year, Monday as the first day, and a day boundary in Argentina time. 100% passing.
- **Debtors teaser (criterion 4)**: ordered by balance, then owing since, then name; credits excluded; "Nadie te debe" when nobody owes. No state is told by color alone.
- **Isolation (criterion 5)**: from another business, the panel route shows none of the first business's figures. After a full front run, the console and browser storage hold no figures or names.
- **Nothing invented (criterion 6)**:
  - an empty business shows $ 0 and 0 g, with no average sale and no Faltante de stock line;
  - every figure on screen equals the API's answer.
- **No curl**: the end-to-end front run opens Inicio, switches across the three periods, opens Te deben from the block and a customer from the teaser.

## Out of scope

- Fechas or any custom range; comparing with earlier periods; charts.
- Recording anything from the panel.
- Live updates between partners.
- Margins per variety (#8) and stock shortfall per variety.
- Pending grams counted on the panel ("y N g sin costo"): the panel's note is fixed and carries no grams; Análisis shows the counts.
- Stock's total grams on the panel.
