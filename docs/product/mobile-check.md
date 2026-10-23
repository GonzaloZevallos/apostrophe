# Mobile check

## Jobs

- When a rule written for a change turns out to be impossible for screens the checks always walk, I want the rule and its tests to say what truly holds, with the reason next to it, so the change can be approved, and later changes can be reviewed, without arguing the same contradiction again. (Maintainer job, GH-305, a follow-up of GH-274.)

## What it is

The mobile check is part of the Gate. It walks the phone rows of the screens registry and fails on any mobile-standard offence not listed in the offender lists under `web/src/mobile-standard/offenders/`. Sellers never see it. How the offender lists may change is written in one place only, `docs/product/gate.md` ("Mobile standard offender lists"), and this file does not repeat that rule.

## Invariants that hold

1. **Offender lists.** They grow only as gate.md allows. The InicioChecklist and InicioImportado entries in `touch-action.json` are a new-registry-row growth from GH-274, each carrying its reason. GH-305 added no other entry and removed none.
2. **Registry assertions.** In `web/src/design/screens.test.ts`, every assertion stays as it was before GH-274 except these two, each marked deliberate with its reason:
   - the `InicioHoyCompuOscuro` section is `HOY_PHONE`, no longer undefined;
   - the real-map `assertSelectedAccounts` call runs over the extended all map.

   Each of the two still fails if the screen or map it guards regresses.
3. **Nothing hidden or weakened.** Nothing is hidden or weakened to make a written rule hold. A green Gate means no regression, and a red one means a product regression.
4. **Where corrected rules live.** They sit next to the code they govern, in the offender entries, the tests and gate.md. A past plan stays a closed record and is not amended.

## Out of scope

- Any seller-visible screen, copy or behaviour.
- Design captures. They are review evidence and never a step of the Gate.

## Metrics

- **Gate:** green on the change, with no offender hidden.
- **Offender-list growth:** compared with GH-274's base, the lists grow by exactly the entries for InicioChecklist and InicioImportado, each with a reason. Removals: 0.
- **Rewritten registry assertions:** exactly 2. Both are marked deliberate with a reason, and each is shown to fail on a regressed input.
- **Open findings:** 0 open `important` findings on GH-274 about these two invariants.
- **Seller-visible changes:** 0 (screens, copy, behaviour).
