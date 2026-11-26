---
status: draft
---
## Goal

Deliver one rule for a name's initials, written in TypeScript (`web/src/format/initials.ts`) and Python (`app/accounts/domain/recorder.py`). One shared fixture, `web/src/format/initials.cases.json`, keeps the two equal.

The rule gives the recorder's mark (`recorder_initials`, with a `?` fallback) for later parts of GH-1057. That mark lets Users of a Business with several Users tell at a glance who recorded each item. The mark is never empty and never runaway, whatever the name or email looks like.

The only visible effect in this part: a cluster over 16 code points on the front's existing initials shows its first 16.

## Acceptance criteria

- `initials.ts` turns each grapheme into `Array.from(segment.toUpperCase()).slice(0, 16).join('')`, and every existing `test.each` row passes unchanged, `ßa → SSA` included.
- `initials.cases.json` is an array of `{name, initials}` with a two-space indent and a trailing newline. Invisible and combining code points are written as `\uXXXX` escapes, and there are no lone surrogates.
- The fixture contains every row the request lists: `zeta`→`ZE`, `a`→`A`, `la huerta`→`LH`; a flag plus `ana`; a combining mark; a skin-tone emoji; a ZWJ family; `a` plus 16 and plus 40 combining marks, each cut to 16 code points; two such words; `ßeta`→`SSE`; `ß`→`SS`; U+FEFF+`zeta`→`ZE`; U+FEFF→`''`; two words split by U+0085; a keycap; a ZWNJ inside a word; Hangul L+V+T; Devanagari consonant plus an Mc sign; U+200B→U+200B; blanks→`''`.
- In vitest, the JSON is typed as `readonly InitialsCase[]` with no `any`. For every row, the test asserts no lone surrogate (by regex), at most 32 code points, and `initialsOf(name)` equal to the row's initials.
- `recorder.py` uses only the standard library. `_WHITESPACE` is exactly JS `\s`, and it is used without `str.split()`. Clusters follow the stated joining rules, and each cluster is upper-cased, then cut to 16 code points.
- `initials_of` follows the front word rule: two or more words give the first cluster of each of the first two; one word gives its first two clusters; no word gives `''`.
- `name_of(email)` returns the local part, and `FALLBACK_INITIALS == "?"`.
- `recorder_initials(email)` returns `initials_of(name_of(email))`, or `?` when that is `''`.
- `tests/accounts/test_initials_cases.py` reads the fixture through the module constant `Path(__file__).resolve().parents[2] / 'web/src/format/initials.cases.json'`. For every row, it checks that the name encodes to UTF-8, that the initials have at most 32 code points, and that `initials_of` matches.
- `tests/accounts/test_recorder.py` covers:
  - `name_of`.
  - U+FEFF and U+FEFF twice giving `?`.
  - The awkward emails (`.@x.co`, a lone combining mark, a 60-character emoji local part, `a` plus 40 marks), each giving a non-empty result of at most 32 code points equal to the fallback or to `initials_of` of the local part.
  - The longest fixture rows.
- No API response, screen or copy text changes.

## Out of scope

- Which screens and records show the recorder's mark, and exposing it through the API.
- Handling Prepend characters and Indic conjuncts.
- Any other visible change, and any copy change.

## Decisions

- The existing `ßa → SSA` front row already agrees with the rule. Should a fixture row ever conflict with the rule, the rule wins.
  - Reason: The request states that the rule wins over a row, and success criterion 3 requires every existing front row to stay unchanged.
- No glossary term is added for initials or the recorder.
  - Reason: Settled in the interview: they stay implementation words, and the product language does not change.
- Prepend characters and Indic conjuncts are accepted as known gaps, not findings against Assume nothing.
  - Reason: They give a less exact cluster split but never a blank or overlong mark, and the interview accepted that.

## Risks

- The two cluster implementations can drift for inputs outside the fixture. The fixture only guarantees equality on its own rows.
- Prepend characters and Indic conjuncts split differently from `Intl.Segmenter` on the front, so front and back may differ on such names. Both stay non-empty and within 32 code points.
- If the pytest fixture path is not written exactly as stated, CI will not select pytest when the fixture changes.

## Screens

none

## Slices

### shared-initials-rule

#### Acceptance criteria

- Front cut to 16 code points per cluster, with existing `test.each` rows unchanged.
- `web/src/format/initials.cases.json` with every required row, checked by vitest.
- `app/accounts/domain/recorder.py` with `initials_of`, `name_of`, `FALLBACK_INITIALS` and `recorder_initials`, checked by `tests/accounts/test_initials_cases.py` and `tests/accounts/test_recorder.py`.
- `recorder_initials` is never empty and never over 32 code points for any email `Email` accepts.

#### Risks

- implementation-drift-outside-fixture
- known-cluster-gaps
- ci-suite-selection-path
