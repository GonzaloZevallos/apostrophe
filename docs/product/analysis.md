# Analysis

Where a business makes and loses money, across periods and down to each variety: margins per variety for a chosen month, sales, profit and cash over the last 8 weeks and 12 months, the weekday pattern, totals since the first record, and expenses by category. Read only and seen only by its business (ADR-0004). Every figure it shares with Results (#7) comes from #7's computation; cost of goods, stock shortfall and the cost of stock withdrawals follow the lots as they stand today (ADR-0009, ADR-0010). Reads sales, stock (entries and withdrawals), payments and expenses. Reached from Más on the phone and from the sidebar on a computer (navigation.md).

## Jobs

**When** I close out a week or a month, or want to know why a period went well or badly, **I want to** see from my phone which varieties earn me money and how much, how sales, profit and cash moved over recent weeks and months, which weekday sells best, and where my expense money goes, **so I can** decide what to restock, reprice, push or stop spending on, without the spreadsheet's Análisis tab and with margins from the real cost of each lot.

This serves the brief's results job ("When I look at a day, a week or a month, I want sales, profit and cash side by side, so I can tell whether I make money and how much I actually have") across periods and by variety, and feeds the stock job. The daily check of cash stays with Results (#7).

**When** I review a week or month in Análisis and its Ganancia is not what I expected, **I want to** see that period's Costo de lo vendido and Faltante de stock on its own row, next to Promoción, Consumo propio and Gastos, **so I can** tell what moved my profit without leaving the screen or doing the arithmetic myself.

This refines the first job above; it is not a new job. Before it, a seller could not get these figures back for a past period. Inicio covers only the current week and month. Análisis showed Faltante de stock only on the month header and since the first record, and on week rows it was hidden inside Ganancia.

**When** I take grams out of my own stock without selling them (to share at a party so people get to know the business, or for my own use), **I want** to record them from my phone in a few taps (date, varieties and grams, the reason), **so I can** keep stock right and see in Ganancia what promoting the business and my own consumption cost me, without recording a sale nobody made or an adjustment that reads as lost flower. (Served here by the Promoción and Consumo propio lines; the withdrawal is defined in stock.md.)

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often, with analysis within reach for the weekly or monthly look, **so I can** get back to the customer instead of hunting through menus. (The navigation job, navigation.md.)

Success criteria:

1. **Answers without arithmetic**: from one screen on the phone, a seller can name the chosen month's variety with the highest margin and the one with the lowest, the best of the last 8 weeks, the best weekday, and the expense category that took the most that month.
2. **One computation**: every figure equals what Results (#7) shows for the same period and a direct computation over the same sales, stock entries, withdrawals, payments and expenses: sales, cost of goods sold, stock shortfall, promotion cost, own-use cost, expenses, profit and cash, per week, per month and since the first record. 0 differences. The rule is stated once in results.md.
3. **Honest cost** (ADR-0009, ADR-0010):
   - Margins come from each lot's actual cost as the lots stand today.
   - When a variety's or a period's cost includes pending grams, it says so and never treats them as costing $0.
   - Flower lost to a negative adjustment lowers profit.
   - Grams withdrawn for promotion or own use lower profit on their own lines, never inside cost of goods sold, stock shortfall or a margin.
   - A stock entry or withdrawal corrected later shows in every affected past week and month the next time the screen is opened. No period is ever closed.
4. **Nothing read from color alone, nothing invented**: every bar and row carries its own figure. A period with no activity shows $0 or is left out by a stated rule, never with a placeholder figure.
5. **Businesses never mix** (ADR-0004): every figure covers only the session's business.
6. **Each row explains its own Ganancia**:
   - Every week and month row shows Costo de lo vendido, and Faltante de stock when the period has a negative adjustment.
   - Together with sales, Promoción, Consumo propio and Gastos, worked out over the costed part, those lines give the row's Ganancia, so no arithmetic is needed outside the row.
   - Each figure carries its own pending mark and is never shown as $0 while pending.
   - Nothing else on the screen moves.

## Behaviour

### Windows

- **Chosen month**: opens on the current month in Argentina time; moved one month at a time, as in Gastos; from the month of the business's first record to the current month. No custom range (no Fechas).
- **Last 8 weeks**: Monday-to-Sunday weeks in Argentina time, the current one included, as in Ventas.
- **Last 12 months**: calendar months, the current one included.
- **Since the first record**: from the business's first record (its earliest sale, stock entry, stock withdrawal, payment or expense in the app) to today. A withdrawal dated before every other record starts the history, so its cost is never left out. The spreadsheet's history is the import's job (#11).
- **Sparse history**:
  - weeks and months before the first record are absent, with no placeholder rows;
  - inside the history, a week or month with no activity shows $0;
  - a business with no record of any of the five kinds yet shows a fixed line saying there is nothing to analyse yet, and no figures.

### Shared definitions (identical to Results #7)

- **One computation per period**: Análisis's week and month rows and Inicio's Semana and Mes come from one computation per period (ADR-0020), as results.md states. Neither restates it.
- **Sales** on week, month and all-time rows: sale totals, shipping included, paid or not, each on its own date, as in Ventas and Results. Withdrawals are never sales.
- **Cost of goods sold, expenses and cash**: CONTEXT.md's definitions, read through Results' (#7) computation, never a second one.
  - Cost of goods sold is the cost of the period's sale lines, gifts included. A withdrawal's or a negative adjustment's cost never enters it.
  - Cash is payments (on-the-spot and later) on their own dates − expenses − purchases on their dates.
- **Stock shortfall**: the cost of the grams negative adjustments take out in the period, on the adjustment's date, from their lots as they stand today, oldest first, through the same allocation as sale lines. A part beyond every lot is pending and the figure carries its own "y N g sin costo". It never includes a withdrawal.
- **Promotion cost ("Promoción") and own-use cost ("Consumo propio")**: the cost of the grams the period's withdrawals of that reason take out, on the withdrawal's date, from their lots as they stand today, oldest first, through the same allocation. A part beyond every lot is pending, and each figure carries its own "y N g sin costo", counting only its own reason's pending grams.
- **Sales of costed grams**: per sale line, line total × costed grams ÷ line grams, rounded half up to the peso. A fully costed line counts its whole total, a fully pending line $0, a gift $0.
- **Profit**: sales − cost of goods sold − stock shortfall − promotion cost − own-use cost − expenses. When any of its cost is pending, profit is worked out over the costed part: the sales of pending grams are left out (sales − (sales without shipping − sales of costed grams) − costed cost of goods − costed shortfall − costed promotion cost − costed own-use cost − expenses).
  - It carries "y N g sin costo", where N adds every pending gram behind it: grams sold or gifted, grams taken out by negative adjustments and grams withdrawn, each counted in the period of its own date.
  - Example: a week sold 4 g with no cost yet, its count took out 2 g with no cost yet, and it withdrew 1 g for promotion with no cost yet. It reads profit "y 7 g sin costo", Faltante de stock "y 2 g sin costo" and Promoción "y 1 g sin costo".
  - The sales figure shown next to it stays the full sales.
- **Pending grams** are never costed $0 anywhere. Every figure they touch carries "y N g sin costo", with N counting only the grams behind that figure.
- **Pending forms**, the same everywhere on this screen (variety rows, month header, week and month rows, since the first record):
  - all of a figure pending: "N g sin costo" only, with no peso amount, never "$ 0";
  - part of it pending: the costed amount, then "y N g sin costo";
  - nothing pending: the amount alone.

### The chosen month, by variety

- **Rows**: only varieties sold or gifted that month. A variety only withdrawn that month has no row.
- **Sales without shipping**: the sum of the variety's stored line totals that month; gifts $0, a special price its typed total.
- **Share of the month**: its sales without shipping over the month's sales without shipping. Not shown when the month's sales without shipping are $0.
- **Grams**: grams sold and grams gifted, as two figures. A negative adjustment and a withdrawal are neither, and stay out of every variety's grams, cost and margin.
- **Cost of goods sold**: what its sold and gifted grams cost, from their lots as they stand today, with the pending mark when it applies.
- **Margin**: sales of costed grams − costed cost of goods sold, in pesos; it can be negative. With no pending grams, sales of costed grams equal sales without shipping.
- **Margin percentage**: margin over the variety's sales of costed grams; not shown when those are $0 (only gifted, or every gram pending).
- **Pending grams**: margin and percentage carry "y N g sin costo", N counting only that variety's sold and gifted pending grams. Example: 10 g sold for $10.000, 6 g from a $3.000 purchase and 4 g pending show sales $10.000, margin $3.000 "y 4 g sin costo", 50%.
- **Sorting**: by margin in pesos, highest first; a marked margin sorts by its shown figure and keeps its mark.
- **Month header**:
  - sales (shipping included), grams sold or gifted, and the average margin;
  - the average margin is the month's total margin over its sales of costed grams. It is marked (sold and gifted grams only) when any variety carries pending grams, and has no percentage when those sales are $0;
  - "Faltante de stock $ X" when the month has any stock shortfall, with its own pending mark. It is the same figure as that month's row in Month by month, with 0 differences;
  - "Promoción $ X" and "Consumo propio $ X" when the month has a withdrawal of that reason, each with its own pending mark, apart from Faltante de stock;
  - the screen states that the variety table adds up to the month's sales minus shipping.
- **A month with no sales or gifts**: totals at $0, no variety rows, and a fixed line saying nothing was sold that month. Its Faltante de stock, Promoción and Consumo propio still show when it has them.

### Week by week (last 8) and month by month (last 12)

- **Each row** shows sales and grams sold or gifted, then its cost lines in Inicio's order, then profit and cash:
  - sales;
  - grams sold or gifted, as one combined figure. Grams taken out by negative adjustments or withdrawals are never in it;
  - **Costo de lo vendido**, always;
  - **Faltante de stock**, when the period has a negative adjustment;
  - **Promoción** and **Consumo propio**, each when the row has one;
  - **Gastos**;
  - profit, which includes stock shortfall and promotion and own-use cost, and carries the pending mark when it applies;
  - cash.
- **Costo de lo vendido on a row**:
  - It is the cost of the period's sale lines, gifts included, from their lots as they stand today.
  - It is a real $ 0 exactly when the period has no sale lines.
  - A week with only gift lines shows what the gifts cost. It shows no Promoción unless it also has a promotion withdrawal.
  - A week with only withdrawals or negative adjustments shows $ 0 here, and their cost on their own lines.
  - Its pending N counts sold and gifted grams only.
- **Faltante de stock on a row**:
  - It shows always when the period has at least one negative adjustment, even with nothing costed, and never otherwise.
  - It never includes a withdrawal.
  - Its pending N counts only grams taken out by negative adjustments.
- **Pending forms**: both lines follow the screen's pending forms above. Profit's own mark is unchanged.
- **The row adds up**: worked out over the costed part, the row's sales, Costo de lo vendido, Faltante de stock, Promoción, Consumo propio and Gastos give its profit, as Profit is defined above.
- **Agreement**: the current week's and current month's rows equal Inicio's Semana and Mes (results.md):
  - the same costed amounts;
  - Inicio's fixed pending note shows exactly when the row carries pending grams.
- **Best week**: the highest sales; on a tie, the most recent week. When all 8 weeks are $0, none is marked. Withdrawals never affect it.
- **Months**: no "best" mark.

### By weekday, since the first record

- **Each weekday, Monday to Sunday**: the sales total and the number of sales, by each sale's date in Argentina time. Withdrawals never count.
- **Best day**: the highest sales total; on a tie, the earlier day in Monday-to-Sunday order. When every day is $0, none is marked.

### Since the first record

- Sales, expenses, profit and cash, with the same definitions as the week and month rows, plus "Faltante de stock $ X", "Promoción $ X" and "Consumo propio $ X" when there is any.
- Labelled as money moved since the first record, never as money on hand: the app has no opening cash balance.

### Expenses by category: the chosen month, and since the first record

- Two breakdowns, each listing only the categories with expenses in its window, sorted by name as in Gastos, each with its total.
- Flower purchases are always their own line in both, $0 included, with "Van aparte, se cargan en Stock". They are never counted inside expenses.
- Withdrawals are never expenses and never appear here.
- How the two sit together is design's call.

### On screen (`Analisis`, `AnalisisCompu`)

- **Where**: a tab root (navigation.md). On the phone, the Más entry "Análisis · Variedades, semanas, meses y días"; on a computer, "Análisis" in the sidebar, under the divider.
- **Computer**: the `AnalisisCompu` layout. Week and month rows show the same lines with the same words as on the phone.
- **Row layout**: how Costo de lo vendido and Faltante de stock fit on the phone row (wrapping, truncation) is design's call, within the icon and text rule's length limits.
- **Charts**: the accent and the tokens only; every bar carries its figure. Best marks, pending marks and negatives are told by word or shape, never by color alone.
- **Language and formats**: Rioplatense Spanish with vos; money `$ 11.000`, grams `3,5 g`, dates `dd/mm`.
- **Read only**: no forms and no toasts. Figures come from the API on every open; the browser computes nothing.
- **Feedback**: network loss and server errors follow accounts.md.

### API

- `GET /analysis?month=` answers every figure, mark, sort and percentage (ADR-0020).
- Each week row and month row carries:
  - `cost_of_goods`: `{amount, pending}`, never `null`;
  - `shortfall`: `{amount, pending}`, `null` exactly when the period has no negative adjustment, the same shape as `promotion` and `own_use`.
- `pending` is in grams. A figure that is all pending has amount 0 and pending above 0, and the screen shows it as grams only.

### Constraints

- The business comes from the session. Every route joins the isolation sweep and the gated-route test.
- No amounts or names go to logs, the console or browser storage (CODING_STANDARDS §9, ADR-0005).

## Metrics

- **Answers without arithmetic (criterion 1)**: a front test over a seeded business reads from the screen alone, each matching the expected answer:
  - the best and worst variety by margin;
  - the marked best week;
  - the marked best weekday;
  - the month's largest category.
- **One computation (criterion 2)**:
  - For every week, month and the all-time window of a seeded history, these equal Results' (#7) figures and a direct computation, with 0 differences: sales, cost of goods, stock shortfall, promotion cost, own-use cost, expenses, profit and cash.
  - The variety table's sales add up to the month's sales minus its shipping.
- **First record includes withdrawals (criterion 2)**:
  - A withdrawal dated before every other record starts the history.
  - Its week and month rows and the since-the-first-record profit carry its cost, and equal Inicio's figures for the same week and month, with 0 differences.
  - A business whose only record is a withdrawal shows that history, not the nothing-to-analyse line.
- **Honest cost (criterion 3)**: 100% passing.
  - A backdated or edited stock entry or withdrawal moves the affected past weeks', months' and varieties' cost and margin on the next read, and nothing else.
  - Pending grams always show "y N g sin costo" and are never costed $0.
  - A negative adjustment lowers profit on its date by its lots' cost and moves no variety's margin.
  - A withdrawal of each reason lowers profit on its date by its lots' cost and shows on its own line. It moves none of these:
    - a variety's row, grams, margin or share;
    - the average margin;
    - the best week or the best weekday;
    - cost of goods sold or stock shortfall.
  - A week with 4 g sold pending, 2 g adjusted out pending and 1 g withdrawn for promotion pending reads profit "y 7 g sin costo", Faltante de stock "y 2 g sin costo" and Promoción "y 1 g sin costo".
- **Rows explain Ganancia (criterion 6)**: 100% passing.
  - **Against Inicio**: for the current week and month, each row's `cost_of_goods` and `shortfall` equal `/panel`'s `periods.week` and `periods.month`, with 0 differences:
    - the costed amounts are equal;
    - the panel's pending flag is set exactly when the row has pending grams.
  - **Against a direct computation**: for every seeded week and month, both figures equal a direct computation over the period's sale lines and negative adjustments. 0 differences.
  - **Header equals row**: the month header's shortfall equals that month's row. 0 differences.
  - **Absence and zeros**:
    - no negative adjustment: `shortfall` is `null` and the line does not show;
    - no sale lines: Costo de lo vendido is $ 0;
    - a week with only gifts shows what the gifts cost;
    - a week with only withdrawals or adjustments shows Costo de lo vendido $ 0 and its cost on its own line.
  - **Pending forms**:
    - a figure that is all pending shows grams only and no peso amount;
    - a partly pending one shows the amount and the mark;
    - a fully costed one shows the amount alone;
    - each N counts only its own grams, and nothing pending ever shows "$ 0".
  - **Adds up**: for every seeded period, the row's lines, over the costed part, give its profit.
  - **Nothing else moves**: these are identical before and after the change: variety rows, margins, shares, best week, best weekday, Caja, the expense breakdowns and the since-the-first-record figures.
- **Sample screen (ADR-0035)**:
  - The seed holds, inside the captured weeks and months:
    - a period with a costed shortfall;
    - a period with a pending figure on a row;
    - a period with no negative adjustment.
  - `muestra.md` is recaptured with its script and passes its byte-for-byte check.
  - `tests/design/test_muestra_seed.py` checks the current week's and month's rows against `/panel`, instead of asserting the shortfall is absent.
  - The guard checks the rows' new lines against `muestra.md`.
- **Margin matrix**: 100% passing. It covers:
  - a variety only gifted (negative margin, no percentage);
  - a mix of sold and gifted;
  - pending grams: 10 g for $10.000 with 6 g costing $3.000 shows $3.000 "y 4 g sin costo" and 50%, sorted by shown figure;
  - a line split across costed and pending grams, with the half-up rounding of its costed sales;
  - a negative adjustment kept out of the variety table and counted as shortfall;
  - a withdrawal kept out of the variety table and counted on its reason's line;
  - a month with only gifts (no share, no average percentage).
- **Best and ties**: 100% passing. It covers:
  - a best week by sales (not profit);
  - a week tie going to the most recent;
  - a weekday tie going to the earlier day;
  - all $0 marking none.
- **Nothing invented (criterion 4)**:
  - no week or month before the first record;
  - $0 rows inside the history, Costo de lo vendido included;
  - an empty month shows its fixed line and no variety rows;
  - a period with no withdrawal of a reason shows no line for it, and one with no negative adjustment shows no Faltante de stock line;
  - a business with no records shows its fixed line;
  - every bar carries its figure, and no state is told by color alone.
- **Isolation (criterion 5)**: every analysis route is in the sweep and answers only its own business's figures, never the seeded other business's data.
- **No echo**: after a full front run, the console and browser storage hold no amounts or names.
- **Speed**:
  - `GET /analysis` issues the same number of SQL statements on a small and a seeded year of history (ADR-0020).
  - The screen's target stays under 300 ms with a year of a few hundred sales and a few dozen varieties. This is ADR-0010's revisit trigger, not a timed test.
- **Design**: `scripts/design/compare.sh` runs before and after for Análisis, phone and computer, both themes, attached to the PR and judged by eye.
- **No curl**: the end-to-end front run opens Más → Análisis on the phone (and the sidebar entry on a computer), moves back a month and reads each section. That includes Promoción, Consumo propio, and the rows' Costo de lo vendido and Faltante de stock.

## Out of scope

- A custom date range (Fechas) or a week picker.
- Editing anything from Análisis.
- An opening cash balance or money on hand.
- Stock shortfall per variety; promotion or own-use cost per variety.
- Changing the month header or the since-first-record block, beyond the rule that the header's shortfall equals its row.
- Importing the spreadsheet's history: #11.
- Exporting, printing or sharing the analysis.
- Live updates between partners while the screen is open.
- Forecasts beyond stock's days left.
- Tying a promotion to later sales.
