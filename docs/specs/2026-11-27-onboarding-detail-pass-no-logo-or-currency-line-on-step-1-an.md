---
status: draft
---
## Goal

A detail pass on the built Onboarding steps against their drawings, for a seller setting up a new Business on the phone. Step 1 shows only what it asks for: no brand lockup, no currency line, and no empty gap before "Name". Before a bot token is saved, the shared bot form (the Onboarding bot step and Settings → Integrations) tells the seller how the token is kept: "Saved encrypted and never shown again."

## Acceptance criteria

- No Onboarding step, step 1 included, renders the brand lockup (`BrandMark`). Sign in, both Invitation acceptance screens and the computer sidebar still render it, and their tests are not edited.
- Step 1 renders no currency line. `ONBOARDING_TEXT.currencyLine`, its baseline args and its `en.baseline.json` entry no longer exist.
- On step 1, the header row holds only "Close", right-aligned, with no Back. "Step 1 of 6" and the title block sit right above "Name", with no empty gap, on phone and computer. At 320 px the order is the same and nothing is pushed off the screen.
- Steps 2 to 6 keep "Back" to the previous step.
- The price fields of step 1 still show the Business's own currency symbol as their prefix, and Settings → Business → Currency and decimals still changes the symbol and decimals.
- With no token saved, the shared bot form shows "Saved encrypted and never shown again." under "Bot token" as the field's help line, linked with `aria-describedby`, in the Onboarding bot step and in Settings → Integrations.
- With a token saved, only "Saved on … · not shown again" shows under "Bot token". The help line is not shown.
- When Test it is refused with no token saved, the help line stays and the refusal shows below it, with its wording and position unchanged. The field is described by both texts.
- "Enter the token first" on the disabled "Find my chat" is unchanged.
- The vitest cases that asserted the lockup or the currency line (`OnboardingStep.test.tsx`, and any in `CurrencyAndDecimals.test.tsx`) are migrated. A re-render check of the currency format stays, on a screen outside the Onboarding. The walk states in `web/src/mobile-standard/statesRecords.ts` are migrated.
- Every e2e use of the removed elements is migrated in the same task. Neither element comes back, visible or hidden, to satisfy a locator.
- No offender list, tolerance or check is widened, and the Gate passes.
- `docs/product/brand.md`, `docs/product/money.md`, `docs/product/onboarding.md`, `docs/product/pinned-catalog.md` and the Wordmark entry in `CONTEXT.md` match the delivered behaviour.
- The PR attaches light and dark Design captures of OnboardingVariedad, OnboardingVariedadCompu, OnboardingBot, OnboardingBotCompu and ConfiguracionIntegraciones, with each difference listed.

## Out of scope

- The Onboarding steps not built yet (Onboarding.dc.html, #418, #329).
- Any change to the Money format, to Settings → Business → Currency and decimals, or to where the brand mark appears outside the Onboarding.
- Any change to the wording or position of Test it refusals, or to "Enter the token first", which is pending the owner.
- Splitting the shared bot form so only the Onboarding shows the help line.
- Adding a Back to step 1.

## Decisions

- Step 1 shows Close alone, with no Back, which departs from the drawing's "‹ Back / Close".
  - Reason: The owner accepted it (Decision 1). Nothing comes before step 1 except an Invitation that works only once, so a Back would lead nowhere.
- Settings → Integrations shows the same token help line in its no-token state, which ConfiguracionIntegraciones does not draw.
  - Reason: The form is shared, the line is true, and a seller pasting a token in Settings has the same doubt as in Onboarding.
- When Test it is refused, the token help line stays, with the refusal below it.
  - Reason: The line is a standing fact about how the token is kept, not feedback on one attempt, and the seller needs it again on the next try.
- The step 1 docs and success criteria name the Business's own currency symbol, not "$".
  - Reason: Assume nothing. The price fields already use the Business's Money format.
- "Enter the token first" stays as it is.
  - Reason: It is the only reason the disabled Find my chat gives, and the owner has not decided on that drawing departure yet.

## Risks

Removing the lockup or the currency line can break e2e locators or mobile walk states that use them. They are migrated in the same task (D-69509906), never patched by putting the element back.
Removing the spacing that caused the gap could shift the layout of other steps that share the step frame. The captures of the touched screens show any such shift.
The brand tokens `--marca-*` may lose their last narrow-size user. Whatever ends up unused is removed in the same diff, and Sign in, Invitation and the sidebar stay as they are.

## Screens

The touched screens (OnboardingVariedad, OnboardingVariedadCompu, OnboardingBot, OnboardingBotCompu, ConfiguracionIntegraciones) come from the design stage.

## Slices

### onboarding-step1-and-token-help

#### Acceptance criteria

- No Onboarding step renders the brand lockup or a currency line. Step 1 has only "Close" in its header and its title block right above "Name", with no gap, on phone, at 320 px and on computer.
- `ONBOARDING_TEXT.currencyLine`, its baseline args and its `en.baseline.json` entry are removed. The price fields keep the Business's symbol prefix.
- The shared bot form shows "Saved encrypted and never shown again." under "Bot token", linked with `aria-describedby`, while no token is saved, in Onboarding and in Settings → Integrations. With a token saved it shows only "Saved on … · not shown again". After a refused Test it, it keeps the help line with the refusal below it.
- The vitest cases, the walk states and the e2e uses are migrated. A re-render check of the currency format stays on another screen. No offender list, tolerance or check is widened.
- `brand.md`, `money.md`, `onboarding.md`, `pinned-catalog.md` and the Wordmark entry in `CONTEXT.md` are updated in the same diff.
- Light and dark captures of the five touched screens are attached to the PR, with every difference listed.

#### Risks

- e2e-landmark-migration
- shared-step-frame-layout-shift
- unused-brand-tokens