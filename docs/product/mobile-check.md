# Mobile check

## Jobs

- When a rule written for a change turns out to be impossible for screens the checks always walk, I want the rule and its tests to say what truly holds, with the reason next to it, so the change can be approved, and later changes can be reviewed, without arguing the same contradiction again. (Maintainer job, GH-305, a follow-up of GH-274.)

## What it is

The mobile check is part of the Gate. It walks the phone rows of the screens registry and fails on any mobile-standard offence that is not listed in the offenders list. The touch-action list is `web/src/mobile-standard/offenders/touch-action.json`. Every listed offender carries its reason next to it. Sellers never see the check or the list.

## Invariants that hold

1. **The offenders list only grows with a reason.** An entry is added only for an offence on a row the check actually walks, and each entry carries its reason.
   - The phone rows InicioChecklist and InicioImportado are always walked, so their offenders are listed under `web/src/`, each with its reason.
   - GH-305 added no other entry and removed none.
2. **Registry assertions are unchanged apart from two deliberate rewrites.** In `web/src/design/screens.test.ts`, every assertion stays as it was before GH-274 except these two, each marked deliberate with its reason:
   - the `InicioHoyCompuOscuro` section is `HOY_PHONE`, no longer undefined
   - the real-map `assertSelectedAccounts` call runs over the extended all map

   Each of the two still fails if the screen or map it guards regresses.
3. **Nothing is hidden or weakened to make a written rule hold.** A green Gate must mean no regression, and a red one must mean a product regression.
4. **Corrected rules live next to the code they govern.** They sit in the offender entries and the tests. A past plan stays a closed record and is not amended.

## Out of scope

- Any seller-visible screen, copy or behaviour.
- Running design captures. A design capture is review evidence and never a step of the Gate.

## Metrics

- **Gate:** green on the change, with no offender hidden.
- **Offenders list growth:** compared with GH-274's base, the list grows by exactly the entries for InicioChecklist and InicioImportado, each with a reason. Removals: 0.
- **Rewritten registry assertions:** exactly 2, both marked deliberate with a reason, and each shown to fail on a regressed input.
- **Open findings:** 0 open `important` findings on GH-274 about these two invariants.
- **Seller-visible changes:** 0 (screens, copy, behaviour).
