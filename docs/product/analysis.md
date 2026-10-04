# Analysis

Where a business makes and loses money, across periods and down to each variety: margins per variety for a chosen month, sales, profit and cash over the last 8 weeks and 12 months, the weekday pattern, totals since the first record, and expenses by category. Read only and seen only by its business (ADR-0004). Every figure it shares with Results (#7) comes from #7's computation; cost of goods follows the lots as they stand today (ADR-0009, ADR-0010). Reads sales, stock, payments and expenses.

## Jobs

**When** I close out a week or a month, or want to know why a period went well or badly, **I want to** see from my phone which varieties earn me money and how much, how sales, profit and cash moved over recent weeks and months, which weekday sells best, and where my expense money goes, **so I can** decide what to restock, reprice, push or stop spending on, without the spreadsheet's Análisis tab and with margins from the real cost of each lot.

This serves the brief's results job ("When I look at a day, a week or a month, I want sales, profit and cash side by side, so I can tell whether I make money and how much I actually have") across periods and by variety, and feeds the stock job. The daily check of cash stays with Results (#7).

Success criteria:

1. **Answers without arithmetic**: from one screen on the phone, a seller can name the chosen month's variety with the highest margin and the one with the lowest, the best of the last 8 weeks, the best weekday, and the expense category that took the most that month.
2. **One computation**: every figure equals what Results (#7) shows for the same period and a direct computation over the same sales, stock entries, payments and expenses: sales, cost of goods sold, expenses, profit and cash, per week, per month and since the first record. 0 differences.
3. **Honest cost** (ADR-0009, ADR-0010): margins come from each lot's actual cost as the lots stand today. When a variety's or a period's cost of goods includes pending grams, it says so and never shows them as $0. A stock entry corrected later shows in every affected past week and month the next time the screen is opened. No period is ever closed.
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
- **Cost of goods sold, expenses, profit and cash**: CONTEXT.md's definitions, read through Results' (#7) computation, never a second one.
  - Cash: payments (on-the-spot and later) on their own dates − expenses − purchases on their dates.
  - A negative adjustment's draw counts in a period's profit exactly as #7 counts it.
- **Pending cost**: cost of goods is shown over its costed part with "y N g sin costo" whenever pending grams are included; never treated as $0.

### The chosen month, by variety

- **Rows**: only varieties sold or gifted that month.
- **Sales without shipping**: the sum of the variety's stored line totals that month; gifts $0, a special price its typed total.
- **Share of the month**: its sales without shipping over the month's sales without shipping. Not shown when the month's sales without shipping are $0.
- **Grams**: grams sold and grams gifted, as two figures. A negative adjustment is neither.
- **Cost of goods sold**: what its sold and gifted grams cost, from their lots as they stand today, with the pending mark when it applies.
- **Margin**: sales without shipping − cost of goods sold, in pesos; it can be negative.
- **Margin percentage**: margin over the variety's own sales without shipping; not shown when those sales are $0 (only gifted).
- **Pending grams**: margin and percentage are worked out over the costed part and carry "y N g sin costo".
- **Sorting**: by margin in pesos, highest first; a marked margin sorts by its shown figure and keeps its mark.
- **Month header**:
  - sales (shipping included), grams sold or gifted, and the average margin;
  - the average margin is the month's total margin over its sales without shipping, marked when any variety carries pending grams, and with no percentage when those sales are $0;
  - the screen states that the variety table adds up to the month's sales minus shipping.
- **A month with no sales or gifts**: totals at $0, no variety rows, and a fixed line saying nothing was sold that month.

### Week by week (last 8) and month by month (last 12)

- **Each row**: sales, grams sold or gifted (one combined figure), expenses, profit and cash. Profit carries the pending mark when its cost of goods includes pending grams.
- **Best week**: the highest sales; on a tie, the most recent week. When all 8 weeks are $0, none is marked.
- **Months**: no "best" mark.

### By weekday, since the first record

- **Each weekday, Monday to Sunday**: the sales total and the number of sales, by each sale's date in Argentina time.
- **Best day**: the highest sales total; on a tie, the earlier day in Monday-to-Sunday order. When every day is $0, none is marked.

### Since the first record

- Sales, expenses, profit and cash, with the same definitions as the week and month rows.
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
- **One computation (criterion 2)**: for every week, month and the all-time window of a seeded history, sales, cost of goods, expenses, profit and cash equal Results' (#7) figures and a direct computation. 0 differences. The variety table's sales add up to the month's sales minus its shipping.
- **Honest cost (criterion 3)**: a backdated or edited stock entry moves the affected past weeks', months' and varieties' cost and margin on the next read, and nothing else. Pending grams always show "y N g sin costo" and are never costed $0. 100% passing.
- **Margin matrix**: 100% passing. It covers:
  - a variety only gifted (negative margin, no percentage);
  - a mix of sold and gifted;
  - pending grams (marked, sorted by shown figure);
  - a negative adjustment kept out;
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
- Importing the spreadsheet's history: #11.
- Exporting, printing or sharing the analysis.
- Live updates between partners while the screen is open.
- Forecasts beyond stock's days left.
