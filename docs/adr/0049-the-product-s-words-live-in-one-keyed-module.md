---
status: accepted
date: 2026-10-20
---

# The product's words live in one keyed module

GH-53 puts the whole app in English. Before any word changes, every text a person reads
moves to one place, so the translation is a change there and master's own work stops
conflicting with it (the `*Messages.ts` files master kept editing were deleted by the branch).

## Decision

- **One folder, `web/src/copy/`**, one file per area (`common`, `auth`, `shell`, `sales`,
  `customers`, `payments`, `varieties`, `stock`, `catalog`, `pinnedCatalog`, `expenses`,
  `settings`, `inicio`, `analysis`, `onboarding`, `refusals`, `emptyStates`, `dates`). A
  screen, the shell or a component holds no text of its own: it reads a named message
  (`SIN_CONEXION_MENSAJE`) or a key of its area's object (`SALES_TEXT.hoy`). A text with
  a hole is a function of its parts, so a plural or a word order is a key, not a branch in
  a screen.
- **Each file exports `LANGUAGE: 'es' | 'en'`.** The move marks every file `'es'`: not one
  rendered word changed. A file marked `'en'` is a file whose words were translated.
- **A value has one home.** A value two areas share lives in `common`.
- **`es.snapshot.json`** is the frozen `{key: Spanish value}` of the move. Only tests read
  it; it is deleted when every file is `'en'`.
- **No translation library and no language switch.** `LANGUAGE` is a label on a file, not
  a runtime choice. Number and collation locales (`es-AR`, `es`) are not words and stay.
- **The limits registrations travel with their strings:** `LIMITED_COPY` and
  `LONG_REFUSALS` are exported by each copy file and checked by `copy/copyLimits.test.ts`.
  `api/refusals.ts` keeps the dispatch and its `Record<RefusalCode, …>` types and reads
  its texts from `copy/refusals`.

## Consequences

- Rewording or adding a language is a change under `web/src/copy/` only.
- A literal text in a screen is a defect the guards (GH-53, landing 1) catch.
- Toast and notice unions typed on literal strings (`SuccessToast`) keep their literals
  in `components/AvisoExito.tsx` for now; they are the one place a word is spelled twice.
