---
status: draft
---
## Goal

`GET /api/payments/debtors` gives the seller the data needed to collect what they are owed:
- how old each debtor's debt is;
- how the Total owed splits into three age groups;
- "N of M customers owe me" counts;
- each debtor's Customer type.

The per-Sale lines that make up each Balance were cut from this task by the human's Decision 1 and move to #899, which is blocked by this one.

This part is data only, built for the screens that later parts add. It changes no screen, and every existing field keeps its name and meaning.

## Acceptance criteria

- The response carries `customer_count`, `debtor_count` and `buckets` as `{this_week, days_8_30, over_30}`. Each debtor carries `age_days`, `bucket` and `customer_type_id`.
- `buckets` sums the amount still owed on each still-owing Sale, by that Sale's age (0–7, 8–30, 31 or more days). With a Credit customer present, the three groups add up exactly to `total_owed`. With no debtors, all three are 0.
- A debtor's `age_days` and `bucket` are the age of its Owing since, counted in Argentina days.
- A Sale dated after today has age 0 and is in `this_week`.
- Moving the clock from 30 days to past the next Argentina midnight changes `days_8_30` / 30 into `over_30` / 31.
- `customer_count` includes a Customer with no Sales and a Customer with a Credit. `debtor_count` includes neither.
- `customer_type_id` is null while the Customer types switch is off and is the stored id while it is on. The stored value never changes.
- Debtors are ordered by Owing since, then the larger Balance, then the name folded for case and accents, then the Customer id. A test covers each tie: same Owing since with a different Balance, same Balance with a different folded name, and same folded name.
- With a debtor, a Credit and a Customer with no Sales in another Business, none of their figures or counts appears.
- Home's debt summary uses the same order with no Customer type, and its teaser list is unchanged.
- `docs/product/payments.md` records the new fields, the new order and the fixed-boundary assumption for #330.
- Only `tests/fixtures/openapi_snapshot.json` is regenerated. Nothing under `web/` (except migrated test specs and the one contract fixture the human's Decision 2 allows), `docs/api/**` or `docs/architecture/**` is edited.
- Any e2e or vitest spec that asserted name order between debtors who share an Owing since is fixed in the same diff, with no change to web source.

## Out of scope

- Any screen, element or text change on Customers or Home.
- Migrations.
- Configurable age boundaries: the 7-day and 30-day boundaries are fixed, a known Assume-nothing assumption recorded for #330.
- The per-Sale lines of each debtor and the query flag that requested them: they move to #899.
- Glossary or ADR changes.

## Decisions

- The response-level age groups are summed per still-owing Sale, while a debtor's own `age_days` and `bucket` are those of its Owing since.
  - Reason: the part-1 ADR measures debt age per Sale still owing, which is what makes the groups add up to Total owed; the debtor's single age answers "whom to ask first".
- The debtor order is Owing since, then the larger Balance, then the folded name, then recording order, and is defined only in `debtors()`.
  - Reason: a stable order the seller can rely on from one visit to the next, with one place that defines it.
- `customer_type_id` is hidden only by the use case, following the Customer types switch.
  - Reason: Pricing settings say a switched-off rule is hidden while its stored data is kept.
- With no debtors, the three age groups are present and are 0.
  - Reason: an empty Business must read as "nothing owed", not as missing data.

## Risks

- Debtors who share an Owing since change visible order on Customers and Home. Any test that relied on name order must be migrated in the same diff (D-69509906).
- The fixed 7-day and 30-day boundaries stay an Assume-nothing assumption until #330.

## Screens

none

## Slices

### debtors-age-counts

#### Acceptance criteria

- `GET /api/payments/debtors` returns `customer_count`, `debtor_count` and `buckets`. Each debtor returns `age_days`, `bucket` and `customer_type_id`, with every HTTP test in the PRD that is still in scope passing.
- The age groups add up to Total owed.
- The debtor order and the Customer-type masking are defined only in `debtors()`.
- Business isolation holds for every new figure and count.
- `docs/product/payments.md` is updated, and only the OpenAPI snapshot fixture is regenerated.

#### Risks

- tied-debtor-order-specs
