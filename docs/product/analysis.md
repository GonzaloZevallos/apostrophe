# Analysis

Where a business makes and loses money, across periods and down to each variety: margins per variety for a chosen month, sales, cost of goods sold, stock shortfall, profit and cash over the last 8 weeks and 12 months, the weekday pattern, totals since the first record, and expenses by category. Read only and seen only by its business (ADR-0004). Every figure it shares with Results (#7) comes from #7's computation; cost of goods, stock shortfall and the cost of stock withdrawals follow the lots as they stand today (ADR-0009, ADR-0010). Reads sales, stock (entries and withdrawals), payments and expenses. Reached from More on the phone and from the sidebar on a computer (navigation.md).

## Jobs

**When** I close out a week or a month, or want to know why a period went well or badly, **I want to** see from my phone which varieties earn me money and how much, how sales, profit and cash moved over recent weeks and months, which weekday sells best, and where my expense money goes, **so I can** decide what to restock, reprice, push or stop spending on, without the spreadsheet's Analysis tab and with margins from the real cost of each lot.

This serves the brief's results job ("When I look at a day, a week or a month, I want sales, profit and cash side by side, so I can tell whether I make money and how much I actually have") across periods and by variety, and feeds the stock job. The daily check of cash stays with Results (#7).

**When** I close a week or a month in Analysis, or see that one earned less than I expected, **I want** to see on that period's row what the sales cost me and what I lost to stock shortfall, next to the profit, **so I can** understand where the profit came from without going back to Home or doing the arithmetic, and trust that Analysis and Home say the same thing.

This refines the job above for each week and month row; it is not a new job. Before it, cost of goods and shortfall for a past period could not be seen anywhere: the shortfall was only inside profit, where it could not be separated out, and Home shows the current week and month only.

**When** I take grams out of my own stock without selling them (to share at a party so people get to know the business, or for my own use), **I want** to record them from my phone in a few taps (date, varieties and grams, the reason), **so I can** keep stock right and see in Profit what promoting the business and my own consumption cost me, without recording a sale nobody made or an adjustment that reads as lost flower. (Served here by the Promotion and Own use lines; the withdrawal is defined in stock.md.)

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often, with analysis within reach for the weekly or monthly look, **so I can** get back to the customer instead of hunting through menus. (The navigation job, navigation.md.)

**When** I want to know how a month went, from my phone and between other things, **I want to** pick the month first and read every Analysis figure straight down the screen, without scrolling sideways or zooming, **so I can** tell whether I made money that month and which varieties earned it. (GH-319, Analysis on the phone. It refines the first job for the phone and changes only the layout, never what a section shows. Before it, the owner scrolled sideways and lost which variety or period a figure belonged to, or waited until they were at the computer.)

Success criteria:

1. **Answers without arithmetic**: from one screen on the phone, a seller can name the chosen month's variety with the highest margin and the one with the lowest, the best of the last 8 weeks, the best weekday, and the expense category that took the most that month.
2. **One computation**: every figure equals what Results (#7) shows for the same period and a direct computation over the same sales, stock entries, withdrawals, payments and expenses. That covers sales, cost of goods sold, stock shortfall, promotion cost, own-use cost, expenses, profit and cash, on every week row, every month row and since the first record. For the current week and month, the rows' cost of goods sold and stock shortfall equal Home's Week and Month. For the current month, the stock shortfall is one figure, read the same way, in the month header, on the month row and on Home's Month. 0 differences.
3. **Honest cost** (ADR-0009, ADR-0010):
   - Margins come from each lot's actual cost as the lots stand today.
   - When a figure's cost includes pending grams, it says so with its own grams and never treats them as costing $0. A cost figure that is entirely pending never shows "$ 0", wherever it appears.
   - Flower lost to a negative adjustment lowers profit.
   - Grams withdrawn for promotion or own use lower profit on their own lines, never inside cost of goods sold, stock shortfall or a margin.
   - A stock entry or withdrawal corrected later shows in every affected past week and month the next time the screen is opened. No period is ever closed.
4. **Nothing read from color alone, nothing invented**: every bar and row carries its own figure. A period with no activity shows $0 or is left out by a stated rule, never with a placeholder figure.
5. **Businesses never mix** (ADR-0004): every figure covers only the session's business.
6. **Every row explains its profit**: all 8 week rows and all 12 month rows show Cost of goods sold, and Stock shortfall when the period has one, next to Promotion, Own use, expenses, profit and cash.
7. **Read straight down on the phone**: at 320 px and at 246 px (130 % text), with a 60-character variety name and nine-digit figures, the owner can change month and read each section with no sideways scroll.
8. **Nothing lost on the phone**: every figure of every table row appears on its card with the same existing label and in the same order, and the month selector is the first control on the screen.
9. **Computer unchanged**: the `AnalisisCompu` capture comes out the same as before the phone cards.
10. **Readable at a glance**: on the phone every headline figure fits on one line, no text is under 12 px, and every tap target, the month arrows included, is at least 44×44.

## Behaviour

### Windows

- **Chosen month**: opens on the current month in Argentina time and moves one month at a time, as in Expenses. It runs from the month of the business's first record to the current month. There is no custom range (no Dates).
- **Last 8 weeks**: Monday-to-Sunday weeks in Argentina time, the current one included, as in Sales.
- **Last 12 months**: calendar months, the current one included.
- **Since the first record**: from the business's first record (its earliest sale, stock entry, stock withdrawal, payment or expense in the app) to today. A withdrawal dated before every other record starts the history, so its cost is never left out. The spreadsheet's history is the import's job (#11).
- **Sparse history**:
  - weeks and months before the first record are absent, with no placeholder rows;
  - inside the history, a week or month with no activity shows $0;
  - a business with no record of any of the five kinds yet shows a fixed line saying there is nothing to analyse yet, and no figures.

### Shared definitions (identical to Results #7)

- **Sales** on week, month and all-time rows: sale totals, shipping included, paid or not, each on its own date, as in Sales and Results. Withdrawals are never sales.
- **Cost of goods sold, expenses and cash**: CONTEXT.md's definitions, read through Results' (#7) computation, never a second one.
  - Cost of goods sold is what the grams of the period's sale lines (gifts included) cost, from their lots as they stand today. It never includes a negative adjustment or a withdrawal.
  - Cash is payments (on-the-spot and later) on their own dates − expenses − purchases on their dates.
- **Stock shortfall**: the cost of the grams negative adjustments take out in the period, on the adjustment's date, from their lots as they stand today, oldest first, through the same allocation as sale lines. A part beyond every lot is pending, and the figure carries its own "and N g without cost". It never includes a withdrawal and never enters cost of goods sold.
- **Promotion cost ("Promotion") and own-use cost ("Own use")**: the cost of the grams the period's withdrawals of that reason take out, on the withdrawal's date, from their lots as they stand today, oldest first, through the same allocation. A part beyond every lot is pending, and each figure carries its own "and N g without cost", counting only its own reason's pending grams.
- **Sales of costed grams**: per sale line, line total × costed grams ÷ line grams, rounded half up to the peso. A fully costed line counts its whole total, a fully pending line $0, a gift $0.
- **Profit**: sales − cost of goods sold − stock shortfall − promotion cost − own-use cost − expenses.
  - When any of its cost is pending, profit is worked out over the costed part, leaving out the sales of pending grams: sales − (sales without shipping − sales of costed grams) − costed cost of goods − costed shortfall − costed promotion cost − costed own-use cost − expenses.
  - It carries "and N g without cost", where N adds every pending gram behind it: grams sold or gifted, grams taken out by negative adjustments and grams withdrawn, each counted in the period of its own date.
  - Example: a week that sold 4 g with no cost yet, whose count took out 2 g with no cost yet, and that withdrew 1 g for promotion with no cost yet reads profit "and 7 g without cost", its Stock shortfall "2 g without cost" and its Promotion "1 g without cost".
  - The sales figure shown next to it stays the full sales.
- **Pending grams** are never costed $0 anywhere. Every figure they touch carries "and N g without cost", with N counting only the grams behind that figure.
- **A fully pending cost figure**:
  - When every gram behind Cost of goods sold, Stock shortfall, Promotion or Own use is pending, the figure shows only its pending grams in words (e.g. "2 g without cost"), never "$ 0" and never "$ 0 and N g without cost". The exact wording is design's.
  - This holds wherever the figure appears in Analysis: the week and month rows, the month header, and the since-the-first-record lines.
  - A partly pending figure shows its costed amount plus "and N g without cost".
  - The line is never hidden because its cost is pending.
  - Profit, margins, margin percentages and the average margin keep their own rules.
  - The API says whether a figure is fully pending, once per figure; the front only formats it.

### The chosen month, by variety

- **Rows**: only varieties sold or gifted that month. A variety only withdrawn that month has no row.
- **Sales without shipping**: the sum of the variety's stored line totals that month. A gift counts $0 and a special price its typed total.
- **Share of the month**: its sales without shipping over the month's sales without shipping. Not shown when the month's sales without shipping are $0.
- **Grams**: grams sold and grams gifted, as two figures. A negative adjustment and a withdrawal are neither, and stay out of every variety's grams, cost and margin.
- **Cost of goods sold**: what its sold and gifted grams cost, from their lots as they stand today, with the pending mark when it applies.
- **Margin**: sales of costed grams − costed cost of goods sold, in pesos; it can be negative. With no pending grams, sales of costed grams equal sales without shipping.
- **Margin percentage**: margin over the variety's sales of costed grams. Not shown when those are $0 (only gifted, or every gram pending).
- **Pending grams**: margin and percentage carry "and N g without cost", N counting only that variety's sold and gifted pending grams. Example: 10 g sold for $10.000, 6 g from a $3.000 purchase and 4 g pending, shows sales $10.000, margin $3.000 "and 4 g without cost" and 50%.
- **Sorting**: by margin in pesos, highest first. A marked margin sorts by its shown figure and keeps its mark.
- **Month header**:
  - sales (shipping included), grams sold or gifted, and the average margin;
  - the average margin is the month's total margin over its sales of costed grams. It is marked when any variety carries pending grams (counting sold and gifted grams only), and has no percentage when those sales are $0;
  - "Stock shortfall $ X" when the month has any stock shortfall, with its own pending mark, or only its pending grams when it is fully pending. It is the same figure, read the same way, as the month row's and Home's Month;
  - "Promotion $ X" and "Own use $ X" when the month has a withdrawal of that reason, each with its own pending mark (or only its pending grams when fully pending), apart from Stock shortfall;
  - the screen states that the variety table adds up to the month's sales minus shipping;
  - the header carries no Cost of goods sold total.
- **A month with no sales or gifts**: totals at $0, no variety rows, and a fixed line saying nothing was sold that month. Its Stock shortfall, Promotion and Own use still show when it has them.

### Week by week (last 8) and month by month (last 12)

- **Each row**, in this order (the same order as Home's Week and Month, results.md):
  1. sales;
  2. grams sold or gifted, as one combined figure;
  3. Cost of goods sold, on every row;
  4. Stock shortfall, only when the period has a negative adjustment;
  5. Promotion, only when the period has a withdrawal of that reason;
  6. Own use, likewise;
  7. expenses;
  8. profit;
  9. cash.

  Withdrawn and adjusted grams are never in the grams figure.
- **Cost of goods sold** on a row is the period's cost of goods sold, past periods included. A period with no sales shows a real $0. It never includes a shortfall or a withdrawal.
- **Stock shortfall** on a row is the period's stock shortfall, a separate figure that never enters Cost of goods sold. A period with no negative adjustment has no Stock shortfall line.
- **Pending grams on a row**:
  - Cost of goods sold, Stock shortfall, Promotion and Own use each show their costed amount plus their own "and N g without cost", or only their pending grams when fully pending (see Shared definitions).
  - N counts only the grams behind that figure, each in the period of its own date:
    - Cost of goods sold: sold and gifted grams;
    - Stock shortfall: grams taken out by negative adjustments;
    - Promotion and Own use: grams withdrawn for that reason.
  - Profit keeps its own rule and its total N.
  - Example: a week with 4 g sold, 2 g adjusted out and 1 g withdrawn for promotion, all with no cost yet, reads:
    - Cost of goods sold "4 g without cost";
    - Stock shortfall "2 g without cost";
    - Promotion "1 g without cost";
    - profit "and 7 g without cost".
- **Agreement with Home**: for the current week and the current month, the row's Cost of goods sold and Stock shortfall equal Home's Week and Month. Any difference is a defect.
- **Profit** includes stock shortfall, promotion and own-use cost, and carries the pending mark when it applies.
- **Best week**: the highest sales; on a tie, the most recent week. When all 8 weeks are $0, none is marked. Withdrawals never affect it.
- **Months**: no "best" mark.
- No chart, variation or comparison between periods is drawn.

### By weekday, since the first record

- **Each weekday, Monday to Sunday**: the sales total and the number of sales, by each sale's date in Argentina time. Withdrawals never count.
- **Best day**: the highest sales total; on a tie, the earlier day in Monday-to-Sunday order. When every day is $0, none is marked.

### Since the first record

- Sales, expenses, profit and cash, with the same definitions as the week and month rows. "Stock shortfall $ X", "Promotion $ X" and "Own use $ X" are added when there is any, each with its own pending mark, or only its pending grams when fully pending. No Cost of goods sold total.
- Labelled as money moved since the first record, never as money on hand: the app has no opening cash balance.

### Expenses by category: the chosen month, and since the first record

- Two breakdowns, each listing only the categories with expenses in its window, sorted by name as in Expenses, each with its total.
- Flower purchases are always their own line in both, $0 included, with "Kept apart, added in Stock". They are never counted inside expenses.
- Withdrawals are never expenses and never appear here.
- How the two sit together is design's call.

### On screen (`Analisis`, `AnalisisCompu`)

- **Where**: a tab root (navigation.md). On the phone, the More entry "Analysis · Varieties, weeks, months and days"; on a computer, "Analysis" in the sidebar, under the divider.
- **Computer**: the `AnalisisCompu` layout, with the three sections as tables. The phone layout never changes it: its capture stays the same.
- **Week and month rows**: on the phone they are cards (see On the phone); on a computer, how Cost of goods sold and Stock shortfall sit on a row (lines or sub-rows) is design's call. Each figure is in words, and pending and negative are told by word or sign, never by color alone, in both themes.
- **Charts**: the accent and the tokens only; every bar carries its figure. Best marks, pending marks and negatives are told by word or shape, never by color alone.
- **Language and formats**: the copy is the product language's (product-language.md), every text from the copy module. Formats stay Argentine: money `$ 11.000`, grams `3,5 g`, dates `dd/mm`.
- **Read only**: no forms and no toasts. Figures come from the API on every open; the browser computes nothing, including whether a figure is fully pending.
- **Feedback**: network loss and server errors follow accounts.md.

### On the phone (under the 900 px breakpoint)

- **Month selector first**: it is the first control on Analysis. Expenses' ordering rule for its own month selector is scoped to Expenses and never reaches Analysis.
- **One layout at a time**: at phone width the three sections (by variety, last 8 weeks, last 12 months) render as lists of cards and no table is in the page; at computer width they render as tables and no card is in the page. The month selector, the section headings and the aside are the same elements in both. No figure is exposed twice to assistive technology. Analysis has no forms, so crossing 900 px loses nothing.
- **Variety card**: the name, then sales, share of the month, grams sold, grams gifted, cost of goods sold, margin with its percentage. Share and percentage show under the same rules as on the computer.
- **Week card and month card**: the period label, then the row's figures in the row's order (Week by week, above). Stock shortfall, Promotion and Own use appear only when the period has them.
- **Same figures, same order, same labels**: each card carries every figure of the row it replaces, in that row's order, with the labels the copy module already has. Nothing is reordered, hidden behind a tap or collapsed, and there are no section jumps.
- **Headline**: sales is a card's headline figure; it stays on one line and its "$" is never split from its number.
- **Fit**:
  - Names and period labels truncate with an ellipsis; the full name stays readable on the computer and on the variety's own page.
  - Figures never truncate, wrap or split, and never lose their "$".
  - A pending mark ("and N g without cost", or "N g without cost" when the whole figure is pending) goes on the line below its figure inside the same card, never cut or truncated, so a partly pending figure is never read as complete.
  - No sideways scroll at 320 px or at 246 px (130 % text), with a 60-character name and nine-digit figures; no text under 12 px; every tap target at least 44×44, the month arrows included.
- **Marks**: the best-week mark, the "no best week" line and the empty-month line show with the words they have on the computer. The current week's card is set apart by shape (such as an edge or outline), never by background color alone, and by a word only if the copy module already has one.
- **Aside**: the weekday bars, the since-the-first-record lines, the two expense breakdowns and the purchases line "Kept apart, added in Stock" keep their content and order and do not become cards. They meet the same fit limits; long category names truncate with an ellipsis.

### Constraints

- The business comes from the session. Every route joins the isolation sweep and the gated-route test.
- No amounts or names go to logs, the console or browser storage (CODING_STANDARDS §9, ADR-0005).
- Every phone rule sits under the 900 px breakpoint; the computer's captures do not change because of it.

## Metrics

- **Answers without arithmetic (criterion 1)**: a front test over a seeded business reads, from the screen alone, the best and worst variety by margin, the marked best week, the marked best weekday and the month's largest category. Each matches the expected answer.
- **One computation (criterion 2)**:
  - Over every week, every month and the all-time window of a seeded history, sales, cost of goods, stock shortfall, promotion cost, own-use cost, expenses, profit and cash equal Results' (#7) figures and a direct computation. 0 differences.
  - The variety table's sales add up to the month's sales minus its shipping.
  - The seeded history includes a costed negative adjustment, a pending one, a sale line with pending grams, a costed withdrawal and a pending withdrawal. Over it, every week and month row's cost of goods and shortfall equal a direct computation. The current week and month equal `/panel`'s `periods.week` and `periods.month`. The current month's shortfall is the same, and reads the same, in the header, the row and the panel. 0 differences.
  - `tests/design/test_muestra_seed.py` checks the rows against the panel instead of asserting the shortfall is absent.
- **First record includes withdrawals (criterion 2)**: a withdrawal dated before every other record starts the history.
  - Its week and month rows, and the since-the-first-record profit, carry its cost and equal Home's figures for the same week and month. 0 differences.
  - A business whose only record is a withdrawal shows that history, not the nothing-to-analyse line.
- **Honest cost (criterion 3)**: 100% passing.
  - A backdated or edited stock entry or withdrawal moves the cost and margin of the affected past weeks, months and varieties on the next read, and nothing else.
  - Pending grams always show their grams and are never costed $0.
  - A negative adjustment lowers profit on its date by its lots' cost, shows on its period's Stock shortfall, and moves no variety's margin or Cost of goods sold.
  - A withdrawal of each reason lowers profit on its date by its lots' cost and shows on its own line. It moves none of these:
    - a variety's row, grams, margin or share;
    - the average margin;
    - best week or best weekday;
    - cost of goods sold or stock shortfall.
  - The 4 g / 2 g / 1 g example week reads:
    - Cost of goods sold "4 g without cost";
    - Stock shortfall "2 g without cost";
    - Promotion "1 g without cost";
    - profit "and 7 g without cost".
  - Each row figure's N counts only its own grams. Profit's N is unchanged.
  - A fully pending figure shows grams, never "$ 0": on a row, in the month header (Stock shortfall, Promotion, Own use) and on the since-the-first-record lines. A current month whose only shortfall is 2 g with no cost reads "2 g without cost" in the header and on the row alike.
- **Rows explain profit (criterion 6)**: a front test over a seeded history reads Cost of goods sold on all 8 week rows and all 12 month rows, in the stated order, and Stock shortfall only on periods with a negative adjustment.
- **Margin matrix**: 100% passing. It covers:
  - a variety only gifted (negative margin, no percentage);
  - a mix of sold and gifted;
  - pending grams: 10 g for $10.000, with 6 g costing $3.000, shows $3.000 "and 4 g without cost" and 50%, sorted by shown figure;
  - a line split across costed and pending grams, with the half-up rounding of its costed sales;
  - a negative adjustment kept out of the variety table and counted as shortfall;
  - a withdrawal kept out of the variety table and counted on its reason's line;
  - a month with only gifts (no share, no average percentage).
- **Best and ties**: 100% passing. It covers:
  - a best week chosen by sales, not profit;
  - a week tie going to the most recent week;
  - a weekday tie going to the earlier day;
  - all $0 marking none.
- **Nothing invented (criterion 4)**:
  - no week or month before the first record;
  - $0 rows inside the history, Cost of goods sold included;
  - an empty month shows its fixed line and no variety rows;
  - a period with no negative adjustment shows no Stock shortfall line;
  - a period with no withdrawal of a reason shows no line for it;
  - a business with no records shows its fixed line;
  - every bar carries its figure, and no state is told by color alone.
- **Unchanged figures**: over the same seeded history, these keep their values before and after the rows gained Cost of goods sold and Stock shortfall:
  - profit and cash;
  - the month header;
  - the since-the-first-record figures;
  - the by-variety table;
  - best week.

  The only display change outside the rows is a fully pending Stock shortfall, Promotion or Own use in the header or since the first record, which now shows only its grams instead of "$ 0 and N g without cost".
- **Read straight down on the phone (criterion 7)**: with the seed's extreme data (a 60-character name, nine-digit figures), at 320 px and at 246 px (130 %), the Mobile check finds no sideways scroll on any of Analysis's walked states; the name ends in an ellipsis, every figure is whole with its "$", and a pending mark shows whole on the line below its figure.
- **Nothing lost on the phone (criterion 8)**: a front test with `fetch` faked at a phone viewport finds the month selector as the first control and, in each section, cards carrying every figure of its table rows with the existing labels and in the row's order, and no table in the page. The best-week mark, "no best week" and the empty-month line show with their existing words; the current-week card is set apart by something other than background color.
- **One layout at a time**: at a computer viewport the same test finds the tables and no card; at both viewports the month selector, the section headings and the aside are the same elements.
- **Computer unchanged (criterion 9)**: the `AnalisisCompu` capture from `scripts/design/compare.sh` is identical before and after.
- **Readable at a glance (criterion 10)**: the Mobile check passes on Analysis's walked states with no `touch-target`, `text-size`, `h-scroll`, `name-overflow` or `figure-split` entry left for an Analysis content cell this work fixed; every such entry turned green is deleted, and none is added outside gate.md's rules.
- **Isolation (criterion 5)**: every analysis route is in the sweep and answers only its own business's figures, never the seeded other business's data.
- **No echo**: after a full front run, the console and browser storage hold no amounts or names.
- **Speed**: the screen answers in under 300 ms with a year of a few hundred sales and a few dozen varieties (ADR-0010's revisit trigger).
- **No curl**: the end-to-end front run:
  - opens More → Analysis on the phone, and the sidebar entry on a computer;
  - moves back a month;
  - reads each section, including Cost of goods sold, Stock shortfall, Promotion and Own use on the rows (cards on the phone).
- **Design**: `scripts/design/compare.sh` runs before and after for Analysis, phone and computer, both themes, with the captures, the `mobile` e2e result and the offender counts attached to the PR.

## Out of scope

- A custom date range (Dates) or a week picker.
- Editing anything from Analysis.
- An opening cash balance or money on hand.
- Stock shortfall per variety; promotion or own-use cost per variety.
- A Cost of goods sold total in the month header or since the first record.
- Charts, variations or comparisons between periods.
- Changing Home's fixed "includes pending cost" note.
- Importing the spreadsheet's history: #11.
- Exporting, printing or sharing the analysis.
- Live updates between partners while the screen is open.
- Forecasts beyond stock's days left.
- Tying a promotion to later sales.
- On the phone: collapsible sections, section jumps, or new copy for the cards or the current week.
- The bottom bar, the floating "+ New sale" and the bar labels on Analysis (navigation's, GH-319 part 1).

## Planned in GH-318

Not built yet. Until the part named ships, the sections above are what the app does.

Each passage names the ADR that decides it, the part that will deliver it, and the current sentence it will replace. The part that delivers a passage removes it from here and edits Behaviour and Out of scope in the same diff.

### Units: "and N … without cost" per unit

Decided in docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md; delivered by the units part.

- Quantities of different units will never be added. A pending quantity will be counted per unit, so a figure will read "and N <label> without cost" once for each unit it has pending, and the grams of a week, a month and a variety will become one amount per unit, each with its label.
- It will replace: "It carries "and N g without cost", where N adds every pending gram behind it" and "**Grams**: grams sold and grams gifted, as two figures."

### Money

Decided in docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md; delivered by the money part.

- Sales, margins and profit will be worked out from amounts stored at the business's scale; the rounding of sales of costed quantity will go through `round_half_up`, which the money part creates in `app/shared/money.py` (ADR-0058). Raising a business's money decimals will leave every figure equal in value.
- It will replace: "**Sales of costed grams**: per sale line, line total × costed grams ÷ line grams, rounded half up to the peso."

### The business day

Decided in docs/adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md; delivered by the time-zone part.

- Windows, weeks and the weekday table will follow the business's own time zone.
- It will replace: "**Chosen month**: opens on the current month in Argentina time" and "**Each weekday, Monday to Sunday**: the sales total and the number of sales, by each sale's date in Argentina time."

### Grouping by category

Decided in docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; delivered by the categories part.

- The chosen month's table will be groupable by category and subcategory, in addition to by product.
- It will replace: "### The chosen month, by variety" and "the screen states that the variety table adds up to the month's sales minus shipping".

### The Marketing cost line

Decided in docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; delivered by the withdrawal reasons part.

- The withdrawal reason now called "Promotion" will be called "Marketing", in its cost line in the month header, the week and month rows and since the first record, with its own pending mark kept (`stock.md`).
- It will replace: "**Promotion cost ("Promotion") and own-use cost ("Own use")**" and ""Promotion $ X" and "Own use $ X" when the month has a withdrawal of that reason".
- In Out of scope, "Tying a promotion to later sales." will stay out: applied promotions will be recorded on the sale itself (docs/adr/0060-the-applied-promotion-snapshot-is-typed-sale-promotion-rows-recorded-as-the-sale-stood-when-saved-and-never-recomputed.md; `sales.md`), not tied afterwards.
