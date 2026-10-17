---
status: accepted
date: 2026-10-17
---

# The first-run facts live in their own table, and a read stamps them in a second, guarded phase

GH-45. Inicio shows one first-run element above its figures: the Onboarding notice, the
checklist of a business that existed before the Onboarding, or "Arrancá por las variedades".
Besides, an imported business sees one dismissable notice about the bot. Three facts of the
business cannot be worked out from the data afterwards, so they are stored; everything else
(every checklist step, which element shows) is derived on every read.

## Decision

1. **A table of its own, `first_run`, owned by the `onboarding` hexagon** (migration 0017,
   `down_revision` "0016"). One row per business (`business_id` not null, unique, a foreign key
   to `business`), created when its first stamp is written, with three nullable instants:
   `checklist_gone_at`, `imported_at` and `import_notice_over_at`. It is in
   `LABEL_AS_BUSINESS`, so business removal exports, deletes and counts it (ADR-0015).
2. **Why not extend `onboarding`.** A row in `onboarding` means "this business is offered the
   Onboarding" (ADR-0036); the businesses that get the checklist are exactly the ones with no
   such row, and the imported ones may or may not have one. Putting these facts there would
   change what a row means, and `/onboarding-progress` answers by that meaning. The `onboarding`
   table, its migration 0015 and its API are unchanged.
3. **The three stamps.** `checklist_gone_at`: the checklist went for good (steps 1 and 2 were
   met at a read). `imported_at`: the spreadsheet import loaded the business, from the import's
   own instant. `import_notice_over_at`: the after-import notice was dismissed or the pinned
   catalog was first published. Each is written only while null and never cleared or moved. No
   checklist step is stored, ever.
4. **One decision, in the domain.** `first_run_element` (`app/onboarding/domain/first_run.py`)
   is a pure function of the stored row, the onboarding's state and four data facts. It returns
   the slot-1 kind, the checklist's steps (for `checklist` only), whether the import notice
   shows, and which stamps are due. Nothing else decides them.
5. **Stamping on read, in a second guarded phase.** `GET /first-run` builds its answer first,
   with no write (phase 1). Only when a stamp is due does `settle_first_run` write it, after the
   answer exists, in one commit (phase 2): `INSERT … ON CONFLICT (business_id) DO NOTHING`, then
   `UPDATE … SET col = :at WHERE business_id = :b AND col IS NULL`, so two reads that meet both
   leave the first instant. The router catches only `sqlalchemy.exc.OperationalError` around
   phase 2, rolls back, logs one fixed line naming the exception class and returns the answer
   already built: a failed stamp never changes the response. This is the only read route that
   writes.
6. **The import writes `imported_at`, and only it.** `OnboardingEnding.imported(at, …)` keeps
   ending an open Onboarding and also stamps `imported_at` with the import's `import_instant`,
   creating the row if it is absent, inside the import's single commit (ADR-0018). It reads no
   clock. Nothing else writes that column; `settle_first_run` refuses a set that holds it.
7. **The import's eligibility is unaffected.** `plan_import.py` (lines 41-46) and
   `write_import.py` (line 83) look at records of the business and nothing else; `first_run`
   is not a record for that check, so neither a stamped nor an empty row changes who may import.
8. **No backfill.** A business imported before this shipped has no `imported_at`, so it never
   sees the after-import notice; a business that already finished its setup has no
   `checklist_gone_at` until a read finds steps 1 and 2 met and stamps it.

## Consequences

- A request that reads can write, once per business per stamp; the cost is one insert and one
  update, only when due, and nothing grows with data.
- A stamp lost to a locked database is stamped again by the next read: the facts it comes from
  do not go away.
- The checklist never returns after a price is deleted: `checklist_gone_at` stays.
