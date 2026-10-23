# Brief

## Problem and who has it

Small sellers, friends to start with, each run a business selling flower by the
gram to a few dozen regular customers who order over Telegram or WhatsApp. Today the books
are a spreadsheet of sales, stock entries, expenses and prices, with formulas for totals,
debts and stock. It breaks in ways that cost money: settling a debt overwrites it, so there
is no payment date and no partial payment; a customer is free text, so one person becomes
two debtors; an order of two varieties is two rows; and profit drops the week flower is
bought. This product replaces the spreadsheet with an app each seller uses, one installation
keeping every business apart.

The person it is built for is the owner of a small business, working from the phone with
little time. The computer is supported but secondary: it keeps every capability and gets no
dedicated polish, and the designs that already exist for it stay as they are (ADR-0044's
price-form modal included).

Priority: the flow working on the phone ships before polish, and the computer never wins a
trade against the phone (DESIGN_STANDARDS.md).

## Jobs

- When I hand over an order, I want to record it in a few taps (varieties, grams, customer,
  how they paid) with the total computed from that day's prices, so I never price from
  memory. Judged by: a sale is recorded from the phone in under a minute.
- When a customer pays part or all of what they owe, I want to record it and see their
  balance drop, so I know who owes me what and since when.
- When I buy, harvest or count flower, I want stock per variety to stay right, so I know
  what I can offer and when a variety is about to run out.
- When I look at a day, a week or a month, I want sales, profit and cash side by side, so I
  can tell whether I make money and how much I actually have.
- When a price changes or a variety sells out, I want the catalog pinned in my Telegram
  chat to update itself, after seeing a test copy, so customers never see a stale price.

## Constraints

- Several businesses share one installation and never mix: no user, link or error reveals
  another business's data or that it exists. Security and privacy hold across the product.
- Users log in with email and password, each on one business; a business may have
  several. The only way in is an invitation link.
- Runs locally for now, reached over the home network; publishing it on the internet is a
  later piece of work.
- Personal data: customer names, phone numbers and balances. Nothing leaves the
  installation except each business's catalog, sent through its own Telegram bot.
- A customer is identified by their phone number within their business.
- Whole Argentine pesos; grams to the hundredth; days in Argentina time.
- Interface in English; code and docs in English (docs/product/product-language.md).
- Maintained by an agentic development system: every capability needs fast,
  self-contained tests.

## Out of scope

- Roles or permissions within a business.
- Taking orders through a bot: it only publishes the catalog.
- Card payments or any payment provider.
- Invoices, taxes and accounting exports.
- Cultivation planning.
