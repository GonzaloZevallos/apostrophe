# Varieties

The varieties a business sells and the price history of each, seen only by that
business (ADR-0004). Every other capability
reads prices from here: a sale takes the current price of its day, the catalog shows
today's.

## Jobs

**When** I start selling a new variety or change what I charge, **I want** to record the
variety once and each price with the date it starts to apply, **so I can** charge the
right price on any day without remembering when it changed.

Success criteria:

1. Asking for a variety's price on a day answers the entry in force that day: the latest
   entry effective on or before it. A day before the first entry has no price.
2. A price change never rewrites the past: it is a new entry from its own date. A typo is
   fixed by deleting the wrong entry, and the one before it applies again (ADR-0003).
3. Two varieties of a business never share a name, whatever the case or spacing; two
   businesses may each have a variety of the same name.

## Behaviour

- **Variety**: a name, trimmed, inner spaces collapsed, up to 60 characters. Renaming
  keeps its prices. Varieties are listed by name.
- **Price entry**: an effective date, a list price per gram in whole pesos, and optionally
  a bulk price per gram with its bulk minimum in grams (up to two decimals). The bulk price
  and the bulk minimum come together or not at all; the bulk price is lower than the list
  price; every amount is above zero.
- One entry per variety per effective date; a second one on the same date is refused.
- A variety's own representation carries its current price **today**, `null` when it has
  none. Today is the business day in Argentina time.
- The price history lists the newest entry first.

## Out of scope

- Catalog attributes (shown or hidden, emoji, indica share, aroma): the catalog capability.
- The low-stock threshold: the stock capability.
- Deleting a variety.
