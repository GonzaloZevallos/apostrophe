---
status: draft
---
## Goal

This lays the groundwork that lets later parts of GH-1057 keep who recorded each Payment, for Businesses where several Users collect money from the same Customers. It delivers:
- the `Recorder` value object;
- the `CurrentRecorder` dependency;
- the `name_of`, `FALLBACK_INITIALS` and `recorder_initials` helpers;
- their tests;
- the Spanish ADR that decides how a Payment keeps its recorder's initials.

Nobody sees anything new yet.

## Acceptance criteria

- `app/shared/recorder.py` defines `Recorder` as a frozen dataclass of `app_user_id: int` and `initials: str`.
- `Recorder.__post_init__` raises `InvalidRecorder`, a `ValueError`, unless the id is positive and the initials are non-empty and at most 32 code points. The message names the rule only.
- `app/accounts/domain/recorder.py` defines `name_of(email: Email)` (the local part), `FALLBACK_INITIALS = "?"` and `recorder_initials(email)`.
- `recorder_initials(email)` returns `initials_of(name_of(email))`, or `?` only when that is `''`.
- A local part of U+200B gives U+200B, not `?`.
- `app/accounts/adapters/deps.py` defines `current_recorder(session: CurrentSession) -> Recorder`. It asserts `user.id is not None` and returns `Recorder(user.id, recorder_initials(user.email))`.
- `app/accounts/adapters/deps.py` defines `CurrentRecorder = Annotated[Recorder, Depends(current_recorder)]`.
- No router uses `CurrentRecorder`.
- `tests/shared/test_recorder.py` covers: a valid Recorder; id 0 and negative rejected; empty initials rejected; 33 code points rejected; 32 accepted.
- `tests/accounts/test_current_recorder.py` calls `current_recorder` directly with a `SignedIn` built from domain values. For U+FEFF (gives `?`), `.@x.co`, a lone combining mark and a 60-character emoji local part, it returns a valid Recorder without raising.
- `tests/accounts/test_recorder.py` covers:
  - `name_of`;
  - U+FEFF once and twice give `?`;
  - U+200B gives U+200B;
  - the awkward valid emails (`.@x.co`, a lone combining mark, a 60-character emoji local part, `a` plus 40 marks) give non-empty results of at most 32 code points, each equal to the fallback or to `initials_of` of the local part;
  - the longest fixture rows.
- `docs/adr/20261125-un-payment-guarda-las-iniciales-de-quien-lo-registro-copiadas-al-registrarlo.md` exists, in Spanish, with `summary:`. It replaces no ADR and cites ADR 20261120.
- The ADR decides:
  - the initials are copied at recording, each cluster upper-cased and then cut to 16 code points;
  - the cut also applies to the avatar;
  - `?` only for a local part made only of U+FEFF, and invisible non-whitespace names keep their invisible initials;
  - the UAX #29 gap for Prepend characters and Indic conjuncts;
  - the foreign key is SET NULL and the initials stay;
  - the name is read live, filtered on the Business, and is null once the User is gone;
  - the initials decide whether `recorded_by` and `recorded_at` are answered;
  - `recorded_at` stays the single clock;
  - the export carries the initials and the recorder email, null for existing Payments;
  - the cross-business guard is the write path plus the filtered read, and the export refuses before deleting;
  - a future User removal keeps the initials.
- `docs/architecture/decisiones.md` is not edited.
- The Gate is green (`ci-ok`).

## Out of scope

- Any column, migration or foreign key on `payment`.
- Any router, endpoint or API field that uses or returns the recorder.
- Any screen or text change.
- Changes to the Business export or Business removal code.
- Any change to `initials_of` or `initialsOf`.
- User removal itself.

## Decisions

- `recorder_initials` falls back to `?` only when `initials_of` gives `''`. It applies no invisible-character check, overriding the earlier wording in `docs/product/initials.md`.
  - Reason: decided in round 2 of the interview and stated by the request and its ADR. The initials are a stored fact and must not be rewritten by a guess about what is visible. Never empty is the guarantee that matters.
- The ADR records the storage, export and cross-business decisions as decided for later parts of GH-1057, not as delivered here.
  - Reason: this part is groundwork, and no router uses `CurrentRecorder` yet.
- The initials stay permanently on a Payment, even after its User is removed.
  - Reason: the job fails exactly when a partner leaves if the record does not outlive the User. The initials never leave the installation and are only a short fragment of the email.
- A cross-business recorder row makes that Business's export refuse, rather than be left out silently.
  - Reason: it applies the Business removal rule that nothing is deleted unless the export is complete, and the BRIEF rule that Businesses never mix.

## Risks

- `docs/product/initials.md` described an invisible-only fallback before this task. If any code or test from #1111 carries that check, it must be removed here, or the ADR and the code will disagree.
- Some listed awkward emails may be rejected by `Email`. Such a test must use the closest accepted local part, not weaken the guarantee.
- The avatar drawing was not checked against names with a cluster over 16 code points or with only invisible characters. No drawn name is affected, and the cut was already delivered by #1111.

## Screens

none

## Slices

### recorder-value-object-dependency-and-adr

#### Acceptance criteria

- `Recorder` and `InvalidRecorder` in `app/shared/recorder.py` enforce a positive id and non-empty initials of at most 32 code points, with a message that names the rule only.
- `name_of`, `FALLBACK_INITIALS` and `recorder_initials` in `app/accounts/domain/recorder.py` give `?` only when `initials_of` gives `''`, never an empty value and never over 32 code points.
- `current_recorder` and `CurrentRecorder` in `app/accounts/adapters/deps.py` return a valid `Recorder` for every listed awkward email, and no router uses them.
- `tests/shared/test_recorder.py`, `tests/accounts/test_current_recorder.py` and `tests/accounts/test_recorder.py` cover the listed cases, including U+200B giving U+200B.
- The Spanish ADR `20261125-un-payment-guarda-las-iniciales-de-quien-lo-registro-copiadas-al-registrarlo.md` exists with `summary:`, cites ADR 20261120, replaces none and records every listed decision.
- `docs/architecture/decisiones.md` is untouched and the Gate is green.

#### Risks

- stale-invisible-fallback
- email-fixture-rejected
