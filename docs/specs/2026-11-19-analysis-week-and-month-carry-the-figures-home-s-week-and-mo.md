---
status: draft
---
## Goal

`GET /analysis` gains the figures that Home's Week and Month show today but Analysis lacks: Average sale, quantity sold, quantity gifted, Purchases and Cash, plus one What you have left list. Every value comes from the same `totals_between` computation as the Panel. A seller looking back over a week or a month can then find every period figure in Analysis, with the same value as Home. This part covers the server and the docs only (part 5 of GH-497, Human Decision 3 / Drawing 9). No screen changes.

## Acceptance criteria

- Every week row and every month row of `GET /analysis` carries Average sale, quantity sold, quantity gifted and Purchases. The month header carries those four plus Cash.
- Rows keep their existing Cash and their existing sold-or-gifted figure, with no duplicate field.
- For the current week and the current month, TestClient tests check that each new figure equals `/panel` `periods.week` and `periods.month`.
- The figures Analysis already reported (rows' Cash included) also equal Home's for the current week and month.
- A past week row equals `totals_between` for that week.
- Each new figure has a domain figure test: Average sale, quantity sold, quantity gifted, Purchases, the month header's Cash, and What you have left.
- In a period with no Sales, Average sale is absent, never 0.
- In an empty period, quantity sold, quantity gifted and Purchases are a real 0, and Cash keeps its sign (it can be 0 or negative).
- The response has one What you have left list, as of the Business's today. It is identical to Home's list and does not change with the month requested.
- What you have left holds every non-archived Product in Products order, each with its name, Stock, Stock status and Days left.
- What you have left includes "no entries", Hidden and unpriced Products, and shows negative Stock.
- What you have left leaves Days left out where the glossary says to.
- Archived Products never appear in What you have left.
- The isolation sweep covers every new field. With two Businesses seeded, each Business's Analysis returns only its own figures and Products.
- Domain code under `app/results/domain/` takes the time zone as a tzinfo and never imports `app.clock` or `zoneinfo`.
- An ADR-0038-style test guards that the statement count of `GET /analysis` does not grow with history size.
- Product names and amounts in the new fields never go to logs or error messages.
- `docs/product/analysis.md` carries Drawing 9 in Spanish: the added figures, and the statement that the stock list is today's stock, not the stock at the end of the month being viewed.
- No screen changes.

## Out of scope

- Showing the new figures or the list on any screen in Analysis or Home. That is the screen part of GH-497.
- Removing Week or Month from Home.
- Comparison with a previous period.
- A stock list per week or month row, or historical stock.
- Changing any figure Analysis already reports.

## Decisions

- The rows' existing Cash and existing sold-or-gifted figure are kept and not added again. Only the month header gains Cash.
  - Reason: in the interview the PM decided that a figure already reported with the same meaning for the same period is not duplicated (Round 2, Q5).
- Quantities are named "quantity sold" and "quantity gifted", not grams.
  - Reason: this follows Assume nothing and the planned Unit (ADR-0056). The values are today's, unchanged.
- Days are counted exactly as Analysis counts them today. The Business time zone arrives with its own GH-318 part.
  - Reason: ADR-0057's time-zone part is not delivered yet, and this part must not change how periods are cut.
- What you have left is a single list per response, as of today.
  - Reason: a list per row would imply historical stock, which the product does not compute.

## Risks

Drawing 9 is not in the repo as text. The docs follow `.agentic/tasks/GH-497.md` and the interview decisions, and the owner decides any disagreement.
Tenant isolation of the new fields and the Product list is the main risk. The isolation sweep must cover them.
Building the stock list per row instead of once per response would make the statement count grow. The ADR-0038 guard must catch it.

## Screens

none

## Slices

### analysis-week-month-figures

#### Acceptance criteria

- `GET /analysis` rows and the month header carry the new figures, and the response carries What you have left. All of them equal the Panel's values for the current week and month, and a past week equals `totals_between`.
- Every new figure has a domain test. Empty periods behave as specified: Average sale absent, quantities and Purchases a real 0, Cash with its sign.
- The isolation sweep and the statement-count guard cover the new fields.
- `docs/product/analysis.md` documents Drawing 9 in Spanish.

#### Risks

- tenant-isolation
- statement-count-growth