---
status: accepted
date: 2026-10-24
---

# The product speaks through keyed catalogs, and a test locale is forced, never requested

GH-316 lays the foundation for more than one product language. It ships no second language
(#317 does), and English stays the only selectable one. This ADR records the decision and
amends ADR-0049, which assumed one language for good.

## Decision

- **The front uses i18next with react-i18next. The back uses Babel/gettext.**
- **Texts are keyed by id. English is the source copy.** A language lacking a key falls back
  to English.
- **Two disjoint key trees.** The front's JSON and the back's `.po` share no key name.
- **Refusals stay codes.** The API's contract is the code. `detail` is an untranslated
  English diagnostic and is never rendered; refusal text comes only from the copy module,
  keyed by code.
- **The test locale `en-XA` is generated from English** (each value wrapped in `⟦…⟧`,
  accented and about 35 % longer, placeholders kept). It is selected only by
  `APOSTROPHE_FORCED_LANGUAGE`, never by a request, and is judged on layout only, never by
  character limits.
- **ADR-0049's "no translation library and no language switch" and its `SuccessToast`
  exemption are struck** (see its amendment).

## What was built

- **The copy loader** (`app/shared/copy/`): the only place Babel is imported. It takes its
  locales directory as an argument and reads `locales/<tag>/LC_MESSAGES/apostrophe.po`, with
  compiled `.mo` files committed. Nothing under `domain/` imports `app.shared.copy` or
  `babel`, and `app.shared.language` imports the standard library only.
- **Completeness.** A language is complete when every English message has a non-empty
  translation. A `fuzzy` entry (even with text) and an empty plural form count as missing.
  Validation reads `.po` files with Babel and never touches anything else. Missing keys of
  real languages are reported by a script and never fail the Gate.
- **Staleness tests.** A `.mo` stale against its `.po`, and a committed `en-XA` file that
  differs from the generator's output, fail the Gate. They compare parsed messages, never
  bytes, and run over the non-empty fixture locales as well as the real ones, so no check
  passes only because the catalog is empty.
- **Settings.** `selectable_languages` (default English) and `operator_language` (default
  English) are never read from the environment. `forced_language` comes from
  `APOSTROPHE_FORCED_LANGUAGE` and accepts only `en-XA`. A selectable or operator language
  that is `en-XA` or incomplete is refused at startup, naming the tag and the first missing
  key ids, never a value.
- **`BusinessLanguage.parse`** refuses `en-XA` and any language not selectable, with code
  `business.language_not_selectable`. No route registers it yet.
- **The pre-sign-in language** is `pre_sign_in_language(accept_language, forced,
  selectable)`, pure and never raising, built on Babel's `negotiate_locale`. Its signature
  cannot take a business, user, invitation or link. The forced language wins. A header that
  is absent, empty, over 1024 characters, holds a non-printable character, or has any
  malformed entry (a bad tag, a `q` outside `0..1` with three decimals, any other
  parameter) is void and gives English. `*` and `q=0` give no candidate; the rest are
  ordered by `q`. `en-XA` is never selectable, so `Accept-Language: en-XA` gives `en`.
- **`ShellPage`** (`app/static_spa.py`) is the only author of `index.html`, for `/`,
  `/index.html`, the client-route fallback and the shared front paths. It rewrites the root
  element's `lang` (the file must hold exactly one `<html>` start tag with exactly one
  `lang="…"` and end with `</html>`), and answers `Cache-Control: no-cache` and
  `Vary: Accept-Language` in every mode, with no `ETag` and no `Last-Modified`. It reads no
  cookie, path, query or token, so the page is byte-identical for one `Accept-Language`
  across every invitation and reset-link state. It re-reads the file when its size or mtime
  changes; a failed re-read keeps the last good bytes and logs nothing. A malformed file
  stops startup (`MalformedBuiltFront`).
- **The shell-script guard** (`tests/architecture/test_no_shell_output.py`): no
  `scripts/*.sh` (not `scripts/design/`) prints literal text with `echo`, `printf` or
  `cat <<`. Operator output comes from the Python commands.

## Consequences

- A new language ships by adding a complete catalog and letting the operator choose it
  (#317), not by reworking the server.
- **Debt: `SuccessToast`.** ADR-0049 let toast unions keep their literals in
  `components/AvisoExito.tsx`. That permission is withdrawn here; the literals are still
  there and a later GH-316 front part removes them.
- English output, formats (`$ 11.000`, `$11.000`, dd/mm, `3,5 g`), routes, API field names,
  error codes and database names do not change.
