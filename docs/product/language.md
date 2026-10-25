# Language

How the product chooses which language its texts are shown in, and what keeps copy complete and in step with English. English is the source copy and, until a second language ships (#317), the only selectable language. The English rules themselves are in docs/product/product-language.md. Decision: ADR-0050, which amends ADR-0049.

## Jobs

- **Maintainers and the agentic system:** When we add a language to the product, we want the copy runtime, the language settings, the test locale and the checks that catch stale or incomplete copy already in place, so a new language ships by adding copy and choosing it, not by reworking the server.
- **Seller (protected, not served):** When I open the app before signing in, or follow an invitation or reset link, I want the page's language to depend only on my phone's language, so the page never tells me or anyone else whether a link, user or business exists.

## Decision (ADR-0050)

- The front uses i18next with react-i18next. The back uses Babel/gettext.
- Texts are keyed by id, and English is the source copy.
- The front key tree (JSON) and the back key tree (`.po`) are disjoint. No key name exists in both.
- The API's refusal contract stays codes. `detail` is an untranslated English diagnostic and is never rendered. Refusal text on screen comes only from the copy module, keyed by code.
- The test locale `en-XA` is generated from English, selected only by `APOSTROPHE_FORCED_LANGUAGE`, and judged on layout only, never by character limits.
- ADR-0049's "no translation library and no language switch" and its `SuccessToast` exemption are struck.

## Language of the page before sign-in

- The pre-sign-in language comes from `Accept-Language` matched against the selectable languages, by language. A regional tag such as `en-GB` or `de-AT` matches its base language when that language is selectable, and the header's q-order applies.
- A header that is absent, empty, `*`, malformed, very long or unmatched gives `en`. A bad header never produces an error page and gives exactly the page with no header.
- No header value can produce `en-XA`, a language outside the selectable list, or one without complete copy. Until #317, every real phone gets `lang="en"`.
- The result depends on the header (and the forced language) alone. No cookie, path, token, invitation or reset link is read. For one `Accept-Language`, the served page is byte-identical across unknown, used and expired invitation paths and every reset-link state.
- The served `index.html` carries the language in its root element's `lang`, keeps `Cache-Control: no-cache` and sends `Vary: Accept-Language`.

## Forced language

- `APOSTROPHE_FORCED_LANGUAGE` accepts only `en-XA`. Any other value stops startup.
- When set, it overrides the pre-sign-in language and the shown language of everything a signed-in user reads. It never changes a stored language. It is applied only in the business-language resolver.
- Operator script output and the import report stay on the operator language. They are rendered from `operator_translator(settings)`, never from a business's stored language.
- It is a whole-installation switch the operator sets to judge layout. It is not meant for production, and no request input can turn it on.

## Settings and startup

- Selectable languages default to English only, and the operator language defaults to English. Neither is read from the environment; #317 decides how the operator chooses.
- A language is complete only when every English message has a non-empty translation. An entry marked as needing review counts as missing.
- A selectable or operator language that is `en-XA` or incomplete is refused at startup. The refusal is an English diagnostic for the operator, naming the language and the first missing keys, and never reaches a seller's screen.

## Business language

- No business language is stored yet: no column, backfill, route, Settings control or screen. Until #317 every business's shown language is English, plus the forced override.
- Setting a business to a language that is not selectable, or to `en-XA`, is refused with code `business.language_not_selectable`.
- Code that decides which texts to show reads the shown language. Code that edits or displays the stored language reads the stored one. Never one for the other.
- A hexagon other than accounts reads a business's language only through a port in its own application layer, implemented by its own adapter.

## Copy checks

- Back copy lives at `locales/<lang>/LC_MESSAGES/apostrophe.po`, with English as the gettext fallback. Compiled `.mo` files are committed, and a stale one fails the Gate.
- The test-locale copy is generated from English. Each value is wrapped in `⟦…⟧`, accented and about 35 % longer, with placeholders kept. A committed file that differs from the generator's output fails the Gate.
- A missing-key report for real languages lists untranslated keys and never fails the Gate.
- Operator shell scripts (`scripts/*.sh`, excluding `scripts/design/`) may not `echo` or `printf` literal text.
- The domain imports no translation library. Texts reach it as plain values through ports declared in the application layer.
- No module under `web/src/` calls `t()` or reads a resource value at module top level. Constants and unions hold keys, never words.
- A front part adds keys only to its own areas' locale files.
- Every moved English text equals its `en.baseline.json` value, except entries in the reasoned, shrink-only exceptions file.
- The mobile-check offender lists never grow. The test locale is judged on layout rules only, never by copy limits.

## Unchanged

Formats (`$ 11.000`, `$11.000`, dd/mm, `3,5 g`), routes, API field names, error codes and database names. The seller's own data is never translated.

## Metrics

1. English unchanged everywhere (screens, API messages, operator output, catalog lines), with the Gate green.
2. For one `Accept-Language`, the served page is byte-identical across unknown, used and expired invitation paths and every reset-link state.
3. With `APOSTROPHE_FORCED_LANGUAGE=en-XA`, the test locale shows. With it unset, `Accept-Language: en-XA` gives `lang="en"`. No request input selects `en-XA`.
4. Startup is refused on a selectable or operator language that is `en-XA` or incomplete, and on any forced value other than `en-XA`.
5. Copy drift fails the Gate: a stale `.mo`, or an `en-XA` file different from the generator's output. The missing-key report never fails.
