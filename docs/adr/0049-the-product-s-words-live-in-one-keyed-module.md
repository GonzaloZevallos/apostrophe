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
