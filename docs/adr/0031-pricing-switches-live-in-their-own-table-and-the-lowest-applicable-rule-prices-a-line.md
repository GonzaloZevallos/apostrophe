---
status: accepted
date: 2026-10-07
---

# Pricing switches live in their own table, and the lowest applicable rule prices a line

Two rules were built into the model for every business: the bulk price, and the VIP
customer, defined as "always pays the bulk price" (GH-85, decided in a grill with
Zeta). Not every business prices that way. Each business now has two independent
switches, Precio por cantidad and Clientes VIP, and a price entry may carry a VIP price
of its own.

## Decision

- **Where the switches live.** In their own table, `pricing_settings`: `id`,
  `business_id` (not null, unique, a foreign key to `business`), `is_bulk_pricing` and
  `is_vip_customers` (boolean, not null). One row per business, owned by
  `app/pricing_settings/`; only that hexagon writes it (its PUT use case, its
  `BusinessOpening` seed, migration 0012 and the import's `switch_on`, which never turns
  a switch off). The shared value `app.shared.pricing_settings.PricingSettings` is what
  every reader speaks; sales, varieties, customers, the catalog and the import each
  declare their own `current() -> PricingSettings` port (docs/adr/0006) and
  `app/main.py` wires them to `SqlPricingSettings(session, business_id)`. Removal, the
  export and the ownership test find the table by reflection (docs/adr/0015); the only
  hand-declared fact is its entry in `LABEL_AS_BUSINESS`.
- **No default, ever.** `SqlPricingSettings.current()` raises `PricingSettingsMissing`
  (a `LookupError` with a fixed message) when the business has no row. Every path that
  creates a business creates the row in the same commit: a `PricingSettingsOpening`
  inside `CompositeOpening`, in `accept_invitation`'s single commit.
- **The defaults.** Migration 0012 gives every business that already exists a row with
  both switches **on**, and copies `vip_price = bulk_price` onto every price entry that
  has a bulk price, so each existing VIP customer pays exactly what they paid before
  (a bulk price is already below list, so the copy meets its own rule). A business that
  opens afterwards starts with both **off**, until the onboarding issue decides
  otherwise. `price_entry.vip_price` is a plain nullable integer: no default, no check
  constraint, no table rebuild; "above 0 and below list" is the domain's rule
  (CODING_STANDARDS section 2).
- **Off stores nothing new and deletes nothing.** Switching a rule off stops it applying
  to new sales and hides it. Past sales keep their price and rule (docs/adr/0003); bulk
  prices, VIP prices and VIP marks stay stored and come back when it is switched on. A
  price entry recorded while a rule is off stores no value for that rule, whatever the
  request sends, and a customer saved while Clientes VIP is off never changes the stored
  `vip`.
- **The pricing rule.** One author, `price_line` (and `pricing.ts` mirroring it, both
  passing `web/src/sales/pricing-matrix.json`): gift first, then special price, then the
  **lowest** of
  - the list price;
  - the bulk price, when Precio por cantidad is on, the quote has one and the line
    reaches the bulk minimum;
  - the VIP price, when Clientes VIP is on, the customer is VIP and the quote has one.

  A tie between VIP and bulk is stored as VIP (so migrated VIP lines keep their label);
  otherwise the strictly lowest rule names the line. A VIP price is always below list,
  so it never ties with list, and it is never compared with the bulk price when it is
  stored.
- **Read once per save; the race is accepted.** `record_sale` reads the settings once
  per save and prices every line of that save with that one value. A switch changed
  between that read and the commit is accepted: the sale carries what was in force when
  it was read (ADR-0012's legacy mode: no stale-plan refusal, no notice).
- **No mixed-version deploy window.** The new code reads a row that only the new
  migration creates and writes a column only it adds, and the old code opens businesses
  without the row. Deploying is therefore done while no invitation is being accepted and
  nobody is recording a price (`deploy/README.md`).

## Consequences

- A new capability that reads the switches declares its own port; none imports
  `app.pricing_settings`.
- Reading the settings is one primary-key lookup per sale save, per catalog read and per
  price-form load: it does not grow with data.
- The catalog's bulk line follows Precio por cantidad and the VIP price never reaches
  the catalog's entry type, so a switch change is an upkeep trigger (docs/adr/0014).
