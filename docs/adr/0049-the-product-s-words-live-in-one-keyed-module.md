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

## What the guards do not see

The guards are a ratchet, not a proof (GH-53, landing 1).

- **Front** (`copyOnly.test.ts`): JSX text and string `aria-label`, `title` and
  `placeholder` attributes under `screens/`, `shell/` and `components/`. Not seen: a
  text built by a helper in another module, a text in a prop other than those three, a
  literal union typed on copy values.
- **Back** (`tests/architecture/test_no_spanish.py`): Python string literals under `app/`
  by AST, judged one at a time against Spanish characters and the frozen denylist
  `tests/fixtures/spanish_copy.json` (its `shared_words` are valid English and are
  left out). Not seen: a Spanish text with no accent and no denylisted word, one split
  over several literals, a docstring (documentation, and English ones name the
  glossary's Spanish words), a text outside Python files.
- **Closed allowlist**: the migrations, `app/legacy_front_paths.json`, and the import's
  `layout.py` and `cells.py`, one reason each. `PENDING_SPANISH` is shrink-only: a listed
  file with no hit, a file with a hit that is not listed, or a count above the one written
  fails.

## Amendment (GH-53, landing 2, T0): the translation base

- `common.ts` is the first file marked `'en'`, with English key names; `es.snapshot.json` was
  re-keyed to match (its Spanish values untouched). Keys whose text now derives from a translated
  file were dropped from the snapshot; their group re-adds the words.
- A file marked `'en'` is judged by `architecture/copyLanguage.test.ts`: a snapshot key must differ
  from its Spanish value unless it is in `copy/shared_words.json` (shrink-only, one reason each; a
  stale entry fails), and every text, snapshot key or not, has no Spanish shape (letters, the back's
  denylist, a vos imperative with its pronoun).
- `design/screens.test.ts` holds the registry step rule: every `click`, `press`, `wait` and
  `fill.label` of `screens.json` is a copy value or a sample name. `section` is not judged by it: it
  crops a block of the Spanish drawing in `pantallas/`, which stays as drawn, so `assertScreens`
  judges it against that file.
- `copy/refusals` has one key per code of `api/contract.json` (`REFUSAL_BY_CODE`), checked from
  `tests/test_refusal_codes.py`.

## Amendment (GH-53, integration): the end state

- Every copy file is `'en'`. `copyLanguage.test.ts` asserts it for every file of `web/src/copy/`
  and keeps the no-Spanish-shape rule (letters, the back's denylist, a vos imperative with its
  pronoun) over every text.
- `es.snapshot.json` and `shared_words.json` are deleted, with `copyModules.test.ts`, which read
  them: they judged the move and the translation in progress, and with every file `'en'` there is
  no Spanish original left to compare. Invariant 3's "shared_words only shrinks" ends at zero.
- `PENDING_SPANISH` in `tests/architecture/test_no_spanish.py` is empty and a test keeps it so. The
  two import ports that read the sheet's own values (`Sí`, `Compra`, `Cosecha`, `Stock inicial`,
  `Ajuste`) are in the closed `ALLOWLIST`, as `layout.py`, `cells.py` and `plan.py` are
  (the import recognises the Spanish sheet).
- `copy/emptyStates.ts` only references the wordings written in each area's copy file (plus the
  sales line), so each value has one home.

## Amendment (GH-297, part 2): the locale ban

- **A locale stays only as a literal argument.** Number and collation locales (`es-AR`, `es`)
  are written in the call (`money.ts`, `varietiesByName.ts`); nothing reads the device's.
- **The ban and its scope.** `web/src/architecture/localeBan.ts` bans, in every non-test
  `web/src/**/*.ts(x)` file, five forms: any `toLocale*` call; `Intl.DateTimeFormat`;
  `Intl.RelativeTimeFormat`; `Intl.NumberFormat`, with or without `new`, whose first argument is
  not a string literal; and `localeCompare` whose second argument, or `Intl.Collator` whose first,
  is missing or not a string literal. `web/e2e/` (whose specs use `toLocaleString('es-AR')` on
  purpose) and `scripts/` are outside it. `localeBan.test.ts` checks the fixtures and scans the
  real tree.
- **What each form protects.**
  - Forms 1-3 (`toLocale*`, the date and relative-time formatters): dates and words that would
    follow the device's language.
  - Form 4 (the number formatter): the thousands and decimal marks. `$ 11.000` would become
    `$ 11,000` on a device set to English.
  - Form 5 (`localeCompare`, `Intl.Collator`): the order a seller sees, which would follow the
    device instead of staying Argentine.
- **Not a Spanish-text guard.** The checks on the product's words are `copyLanguage.test.ts`,
  `tests/architecture/test_no_spanish.py` and `test_no_spanish_output.py`.
- **Known gaps.**
  - A name assembled at runtime (`x['to' + 'LocaleString']()`) is not seen.
  - The other `Intl` members (plural rules and the like) are not banned.
  - JSX text is not modelled: the scan reads it as code. A misread that leaves a string, a
    template or a comment open shows through `endsInCode`, which the real-tree test asserts
    for every file, so it fails closed.
