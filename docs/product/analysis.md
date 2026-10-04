# Analysis

Where a business makes and loses money, across periods and down to each variety: margins per variety for a chosen month, sales, profit and cash over the last 8 weeks and 12 months, the weekday pattern, totals since the first record, and expenses by category. Read only and seen only by its business (ADR-0004). Every figure it shares with Results (#7) comes from #7's computation; cost of goods and stock shortfall follow the lots as they stand today (ADR-0009, ADR-0010). Reads sales, stock, payments and expenses.

## Jobs

**When** I close out a week or a month, or want to know why a period went well or badly, **I want to** see from my phone which varieties earn me money and how much, how sales, profit and cash moved over recent weeks and months, which weekday sells best, and where my expense money goes, **so I can** decide what to restock, reprice, push or stop spending on, without the spreadsheet's Análisis tab and with margins from the real cost of each lot.

This serves the brief's results job ("When I look at a day, a week or a month, I want sales, profit and cash side by side, so I can tell whether I make money and how much I actually have") across periods and by variety, and feeds the stock job. The daily check of cash stays with Results (#7).

Success criteria:

1. **Answers without arithmetic**: from one screen on the phone, a seller can name the chosen month's variety with the highest margin and the one with the lowest, the best of the last 8 weeks, the best weekday, and the expense category that took the most that month.
2. **One computation**: every figure equals what Results (#7) shows for the same period and a direct computation over the same sales, stock entries, payments and expenses: sales, cost of goods sold, stock shortfall, expenses, profit and cash, per week, per month and since the first record. 0 differences.
3. **Honest cost** (ADR-0009, ADR-0010): margins come from each lot's actual cost as the lots stand today. When a variety's or a period's cost includes pending grams, it says so and never treats them as costing $0. Flower lost to a negative adjustment lowers profit. A stock entry corrected later shows in every affected past week and month the next time the screen is opened. No period is ever closed.
4. **Nothing read from color alone, nothing invented**: every bar and row carries its own figure. A period with no activity shows $0 or is left out by a stated rule, never with a placeholder figure.
5. **Businesses never mix** (ADR-0004): every figure covers only the session's business.

## Behaviour

### Windows

- **Chosen month**: opens on the current month in Argentina time; moved one month at a time, as in Gastos; from the month of the business's first record to the current month. No custom range (no Fechas).
- **Last 8 weeks**: Monday-to-Sunday weeks in Argentina time, the current one included, as in Ventas.
- **Last 12 months**: calendar months, the current one included.
- **Since the first record**: from the business's first record (its earliest sale, stock entry, payment or expense in the app) to today. The spreadsheet's history is the import's job (#11).
- **Sparse history**:
  - weeks and months before the first record are absent, with no placeholder rows;
  - inside the history, a week or month with no activity shows $0;
  - a business with no record yet shows a fixed line saying there is nothing to analyse yet, and no figures.

### Shared definitions (identical to Results #7)

- **Sales** on week, month and all-time rows: sale totals, shipping included, paid or not, each on its own date, as in Ventas and Results.
- **Cost of goods sold, expenses and cash**: CONTEXT.md's definitions, read through Results' (#7) computation, never a second one. Cash is payments (on-the-spot and later) on their own dates − expenses − purchases on their dates.
- **Stock shortfall**: the cost of the grams negative adjustments take out in the period, on the adjustment's date, from their lots as they stand today, oldest first, through the same allocation as sale lines. A part beyond every lot is pending and the figure carries its own "y N g sin costo".
- **Sales of costed grams**: per sale line, line total × costed grams ÷ line grams, rounded half up to the peso. A fully costed line counts its whole total, a fully pending line $0, a gift $0.
- **Profit**: sales − cost of goods sold − stock shortfall − expenses. When any of its cost is pending, profit is worked out over the costed part: the sales of pending grams are left out (sales − (sales without shipping − sales of costed grams) − costed cost of goods − costed shortfall − expenses).
  - It carries "y N g sin costo", where N adds every pending gram behind it: grams sold or gifted and grams taken out by negative adjustments, each counted in the period of its own date.
  - Example: a week that sold 4 g with no cost yet and whose count took out 2 g with no cost yet reads profit "y 6 g sin costo", and its Faltante de stock "y 2 g sin costo".
  - The sales figure shown next to it stays the full sales.
- **Pending grams** are never costed $0 anywhere. Every figure they touch carries "y N g sin costo", with N counting only the grams behind that figure.

### The chosen month, by variety

- **Rows**: only varieties sold or gifted that month.
- **Sales without shipping**: the sum of the variety's stored line totals that month; gifts $0, a special price its typed total.
- **Share of the month**: its sales without shipping over the month's sales without shipping. Not shown when the month's sales without shipping are $0.
- **Grams**: grams sold and grams gifted, as two figures. A negative adjustment is neither and stays out of every variety's grams, cost and margin.
- **Cost of goods sold**: what its sold and gifted grams cost, from their lots as they stand today, with the pending mark when it applies.
- **Margin**: sales of costed grams − costed cost of goods sold, in pesos; it can be negative. With no pending grams, sales of costed grams equal sales without shipping.
- **Margin percentage**: margin over the variety's sales of costed grams; not shown when those are $0 (only gifted, or every gram pending).
- **Pending grams**: margin and percentage carry "y N g sin costo", N counting only that variety's sold and gifted pending grams. Example: 10 g sold for $10.000, 6 g from a $3.000 purchase and 4 g pending show sales $10.000, margin $3.000 "y 4 g sin costo", 50%.
- **Sorting**: by margin in pesos, highest first; a marked margin sorts by its shown figure and keeps its mark.
- **Month header**:
  - sales (shipping included), grams sold or gifted, and the average margin;
  - the average margin is the month's total margin over its sales of costed grams, marked (sold and gifted grams only) when any variety carries pending grams, with no percentage when those sales are $0;
  - "Faltante de stock $ X" when the month has any stock shortfall, with its own pending mark;
  - the screen states that the variety table adds up to the month's sales minus shipping.
- **A month with no sales or gifts**: totals at $0, no variety rows, and a fixed line saying nothing was sold that month.

### Week by week (last 8) and month by month (last 12)

- **Each row**: sales, grams sold or gifted (one combined figure), expenses, profit and cash. Profit includes stock shortfall and carries the pending mark when it applies.
- **Best week**: the highest sales; on a tie, the most recent week. When all 8 weeks are $0, none is marked.
- **Months**: no "best" mark.

### By weekday, since the first record

- **Each weekday, Monday to Sunday**: the sales total and the number of sales, by each sale's date in Argentina time.
- **Best day**: the highest sales total; on a tie, the earlier day in Monday-to-Sunday order. When every day is $0, none is marked.

### Since the first record

- Sales, expenses, profit and cash, with the same definitions as the week and month rows, plus "Faltante de stock $ X" when there is any.
- Labelled as money moved since the first record, never as money on hand: the app has no opening cash balance.

### Expenses by category: the chosen month, and since the first record

- Two breakdowns, each listing only the categories with expenses in its window, sorted by name as in Gastos, each with its total.
- Flower purchases are always their own line in both, $0 included, with "Van aparte, se cargan en Stock". They are never counted inside expenses.
- How the two sit together is design's call.

### On screen (`Analisis`, `AnalisisCompu`)

- **Más entry**: "Análisis · Variedades, semanas, meses y días".
- **Computer**: the `AnalisisCompu` layout.
- **Charts**: the accent and the tokens only; every bar carries its figure. Best marks, pending marks and negatives are told by word or shape, never by color alone.
- **Language and formats**: Rioplatense Spanish with vos; money `$ 11.000`, grams `3,5 g`, dates `dd/mm`.
- **Read only**: no forms and no toasts. Figures come from the API on every open; the browser computes nothing.
- **Feedback**: network loss and server errors follow accounts.md.

### Constraints

- The business comes from the session. Every route joins the isolation sweep and the gated-route test.
- No amounts or names go to logs, the console or browser storage (CODING_STANDARDS §9, ADR-0005).

## Metrics

- **Answers without arithmetic (criterion 1)**: a front test over a seeded business reads from the screen alone the best and worst variety by margin, the marked best week, the marked best weekday and the month's largest category, each matching the expected answer.
- **One computation (criterion 2)**: for every week, month and the all-time window of a seeded history, sales, cost of goods, stock shortfall, expenses, profit and cash equal Results' (#7) figures and a direct computation. 0 differences. The variety table's sales add up to the month's sales minus its shipping.
- **Honest cost (criterion 3)**: 100% passing.
  - A backdated or edited stock entry moves the affected past weeks', months' and varieties' cost and margin on the next read, and nothing else.
  - Pending grams always show "y N g sin costo" and are never costed $0.
  - A negative adjustment lowers profit on its date by its lots' cost and moves no variety's margin.
  - A week with 4 g sold pending and 2 g adjusted out pending reads profit "y 6 g sin costo" and Faltante de stock "y 2 g sin costo".
- **Margin matrix**: 100% passing. It covers:
  - a variety only gifted (negative margin, no percentage);
  - a mix of sold and gifted;
  - pending grams: 10 g for $10.000 with 6 g costing $3.000 shows $3.000 "y 4 g sin costo" and 50%, sorted by shown figure;
  - a line split across costed and pending grams, with the half-up rounding of its costed sales;
  - a negative adjustment kept out of the variety table and counted as shortfall;
  - a month with only gifts (no share, no average percentage).
- **Best and ties**: 100% passing. It covers a best week by sales (not profit), a week tie going to the most recent, a weekday tie going to the earlier day, and all $0 marking none.
- **Nothing invented (criterion 4)**:
  - no week or month before the first record;
  - $0 rows inside the history;
  - an empty month shows its fixed line and no variety rows;
  - a business with no records shows its fixed line;
  - every bar carries its figure, and no state is told by color alone.
- **Isolation (criterion 5)**: every analysis route is in the sweep and answers only its own business's figures, never the seeded other business's data.
- **No echo**: after a full front run, the console and browser storage hold no amounts or names.
- **Speed**: the screen answers in under 300 ms with a year of a few hundred sales and a few dozen varieties (ADR-0010's revisit trigger).
- **No curl**: the end-to-end front run opens Más → Análisis, moves back a month and reads each section.

## Out of scope

- A custom date range (Fechas) or a week picker.
- Editing anything from Análisis.
- An opening cash balance or money on hand.
- Stock shortfall per variety.
- Importing the spreadsheet's history: #11.
- Exporting, printing or sharing the analysis.
- Live updates between partners while the screen is open.
- Forecasts beyond stock's days left.
