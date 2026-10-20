# Onboarding

The step-by-step setup a brand-new business is walked through after its new-business invitation is accepted. It takes the first-run checklist's place for that business. It asks for what a first sale needs (a variety priced today and its opening stock) and offers the business-wide settings a new seller would otherwise hunt for (catalog header and footer, the Telegram bot, a partner, expense categories). Each step saves exactly what its owner saves: varieties.md, stock.md, catalog.md, pinned-catalog.md, accounts.md and expenses.md. The Onboarding holds no setting of its own; it only remembers which optional steps were passed. Seen only by its business (ADR-0004). Where it sits is navigation.md; its Inicio notice sits in results.md's order.

## Jobs

**When** I have just opened my business and it is still empty, **I want** to be walked through what it needs, one short step at a time, with defaults already filled in, **so I can** record my first sale the same day without hunting through Configuración, Variedades and the catalog screen.

Before it, the seller landed on an empty Inicio and opened Variedades, the catalog screen and Configuración one by one. Before the app, they did all of it in the spreadsheet's Ajustes sheet.

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often, **so I can** get back to the customer instead of hunting through menus. (The navigation job, navigation.md: served here by the Onboarding as the one first-run element of a new business.)

**When** a price changes mid-day and I'm on my phone between orders or mid-chat with a customer, **I want** to record the new price and the day it applies from in a short form that reads as pesos and starts on today, without leaving the variety I was looking at, **so I can** get back to the customer sure the right price is in force, without second-guessing the amount or the date. (Defined in varieties.md; served here as its secondary situation: step 1 shares the price fields, so its amounts read as pesos with "$". Step 1 always saves a price effective today and shows no date.)

**When** I review an Onboarding change against its design before approving it, **I want** every difference between the built steps (opening stock's "Stock inicial" chip included) and the drawing to be either fixed or recorded as a decision in this doc, and the before and after captures to cover every screen the change touches, **so I can** approve from the PR's evidence alone, without hand-checking screens or carrying an open finding into the next task.

This refines criterion 5 and its design metric; it is not a new product job. Its protagonist is the reviewer acting for the maintainer, and in the end Zeta, as in design-capture.md and pinned-catalog.md criterion 11. The seller is affected only indirectly. It came from GH-144's follow-up, where the "Origen" label on step 2's chip was undecided and the comparison evidence had no before-run, no dark steps and no Inicio notice.

Success criteria:

1. **Fast, from the phone**: from accepting the invitation to a business ready for its first sale (a variety priced today, with opening stock) in under 5 minutes, from the phone alone.
2. **Only the sale is required**: nothing is mandatory beyond a priced variety and its opening stock. Every other step can be skipped in one tap and says where it can be done later.
3. **Nothing lost**: leaving halfway loses nothing already saved. Resuming picks up at the first step that is neither done nor passed.
4. **One fact, one place**: every step saves the same setting, under the same rules and refusals, that Configuración or the variety's page saves. A value set in a step is the value seen afterwards in its usual place, and the reverse.
5. **Simple and attractive, inventing nothing**: built from design-system elements and judged by eye on phone and computer. No placeholder data, no fake figures, and no step for a setting that does not exist yet.
6. **A change is approved from its evidence alone**:
   - every difference between a built step and its drawing is either fixed or decided here, and the built screen, its tests and this doc agree;
   - the before (task base) and after (head) captures cover every screen the change touches, with no cell missing;
   - every difference the captures show is listed in the PR;
   - the comparison is never a gate step (ADR-0042, gate.md).

## Behaviour

### Who gets it, and when

- Only a business just opened by a new-business invitation, from the moment the invitation is accepted.
- **Never offered to**:
  - an imported business. Once the spreadsheet import loads a business, the Onboarding is over for it: its notice never shows and "All set" is never shown. Its remembered passes are not records for the import's eligibility check (import.md);
  - a business a user joined by a join invitation;
  - a business that existed before the Onboarding shipped.
- **No "run it again"**: once it is over, nothing in the app points back to it.
- **One state per business**: a partner who joins midway sees the same notice and can carry on. No roles.

### Relation to the first-run checklist and the after-import notice

- For a brand-new business the Onboarding fully replaces the checklist; the two never both apply.
- While it is not over, neither the checklist nor "Start with varieties" shows. "Start with varieties" takes over once it is over.
- **No side rules of its own**: "+ New sale" and "Send catalog" behave while the Onboarding runs as they do for any business. What is missing is told by the Inicio notice ("Missing: …"), by Nueva venta's own "<variety> no tiene precio para esa fecha" before saving, and by the catalog screen's own empty state. The checklist's side rules (navigation.md) belong to the checklist.
- **The Onboarding itself builds neither the checklist nor the after-import notice**: Inicio's "To get started" checklist and the "Connect the bot…" notice are built by the first-run capability (navigation.md, results.md), which reads `/first-run`. A business that existed before the Onboarding and an imported business see the element that capability decides, not an Onboarding notice.

### Entry and the Inicio notice

- **Entry**: accepting a new-business invitation lands in the Onboarding, not on an empty Inicio. A join invitation still lands on Inicio. This is the only time the Onboarding opens by itself.
- **The notice**: while the Onboarding is not over, Inicio shows "Keep going with setup" at the top, in position 1 of results.md's order, on the phone and on `InicioCompu`.
  - It shows progress in words ("2 of 6 steps"), counting steps done or passed, and the resume step by its short name (e.g. "Missing: starting stock").
  - When every step is done or passed but "All set" has not been reached yet (say, the only price was deleted while the optional steps were passed, and later added again from the variety's page), it reads "6 of 6 steps" with no "Missing" line, and opens "All set".
  - Adding more varieties never moves the count past steps 1–2.
  - Otherwise it opens the Onboarding at the resume step.
  - It cannot be dismissed. It goes for good when the Onboarding is over.
  - Partners see it too.
- A seller who wants it gone sooner finishes the two required steps and taps "Skip the rest".

### The screens

- **Kind**: a full screen of the form-or-sheet kind (navigation.md): no bar or sidebar, no "+ New sale". One centred, phone-width column on every viewport, with no computer layout of its own.
- **Every step shows**:
  - one short title and one sentence on why it matters;
  - its fields and one primary action;
  - progress in words as well as shape ("Step 2 of 6"), never by colour alone;
  - "Back", to the step before, on every step but step 1. Step 1 has no step before it: it shows no "Back", and "Close" is its way out;
  - "Skip", on optional steps only;
  - "Skip the rest", on optional steps only, only once both required steps are done, and never on the last step (step 6), where it would pass nothing "Skip" does not;
  - "Close", which lands on Inicio and keeps everything saved and the resume point.
- **The skip controls**: "Skip" and, when it shows, "Skip the rest" sit together on one line as text links, as the design draws them; neither is a button.
- **The step frame follows the drawn design** (`docs/product/design-system/pantallas/Onboarding*.dc.html`); where this file and the drawing disagree on what a step shows, this file wins and the difference is a defect in the design.
- **Unsaved changes**: leaving a step with something typed and not saved, by "Close", "Back" or "Skip", asks before discarding. An untouched step leaves at once.
- **Inside the steps**, the owners' own behaviour applies unchanged: field rules, refusals inline keeping what was typed, toasts, Probarlo's and Buscar mi chat's reasons, "No connection: check your internet and try again.", the generic retry and "That's gone.".

### The six steps, in order

| # | Step | Required | Saves |
|---|---|---|---|
| 1 | A variety with today's price | Yes | A variety and a price entry effective today (list price, optionally a bulk price and its minimum), under Variedades' rules and refusals (varieties.md) |
| 2 | Its opening stock | Yes | A stock entry with origin Stock inicial, grams, today's date and an optional total cost (stock.md) |
| 3 | Catalog header and footer | No | The business's header and footer, shown with their defaults (catalog.md) |
| 4 | Telegram bot | No | Token, channel chat, own chat (with Buscar mi chat) and Probarlo, exactly as Integraciones (pinned-catalog.md) |
| 5 | A partner | No | One join link per tap, to copy or share (accounts.md) |
| 6 | Expense categories | No | Add, rename and remove, as Categorías de gastos (expenses.md) |

- **Step 2** says plainly that with no cost the lot costs $0.
- **Step 2's origin** shows as the fixed text-only chip "Stock inicial", with no "Origen" label above it: the step's title already says it is the opening stock, and the origin cannot change there. The "Origen" label in `Onboarding*.dc.html` is a known defect of the drawing, corrected by design in its own work. This applies only where the origin is the fixed chip: the full stock entry form keeps its origin choice, and whatever label it draws over it, as stock.md defines it.
- **More varieties**: after a variety and its opening stock, the seller sees "Add another variety" (another name, price and opening stock) or "Continue".
  - There is no cap, and each variety is saved the moment its step is saved.
  - One variety is enough to continue.
  - Progress stays on steps 1–2 while varieties are being added.
  - "Add another variety" is the only way the Onboarding adds a further variety.
- **Step 4** ends at the saved bot and says: "Whenever you want, publish it from Varieties → Send catalog". Publicar and the pin's status stay on the catalog screen.
- **Step 5** reads "Send the link to your partner" and never waits for the partner to join.
- **A skipped step** says where it can be done later: Configuración → Integraciones, Usuarios, Mensaje del catálogo or Categorías de gastos. Skipping step 3 or 6 keeps the defaults.

### Step 1

- **One form, one primary action**: the variety's name, its list price and the price form's optional fields as Variedades shows them under the pricing switches (pricing-settings.md), saved by one primary action. There is no separate save for the name and for the price.
- **Amounts in pesos**: the price fields are the ones the price entry form shares (varieties.md), so the list price, the bulk price and the VIP price each show "$" before the amount, and the bulk minimum, in grams, never does.
- **No date**: step 1 always saves a price effective today. It shows no date field and no date chip; the price form's "Rige desde" chip (varieties.md) is not part of it.
- **Two writes through the owners**: that one action may save the variety and then its price entry effective today, each through its owner's route and refusals (varieties.md). Nothing is restated here.
  - A refused name saves nothing and keeps everything typed.
  - A refused price leaves the variety saved, keeps everything typed and shows the refusal on its field. The retry sends only the price and never adds a second variety.
- **What step 1 shows on a return**, the first that fits:
  1. **A variety saved with no price entry** (a refused price, then left; on the first variety or on one added through "Add another variety"): step 1 shows that variety's name kept and only the price to fill in, whether or not another variety already has a price today. With several, it shows the first by name, and each saved price moves on to the next. Saving the price carries on exactly as any save of step 1 does, and sends only the price.
  2. **Otherwise, a done step 1** (a variety has a price today): the step shows the saved variety, its name and today's list price, marked "Done", never an empty form. With several, it shows the first by name that has a price today. Its primary action moves on to step 2 and saves nothing.
  3. **Otherwise** (no variety yet): the empty form.
- In every case step 1 counts as done from the data alone (a variety with a price today): showing an unpriced variety's price form never moves the progress count or the resume point, and "Close" leaves at once with everything kept.
- A further variety is added only through "Add another variety".

### Done and passed

- **Required steps are worked out from the data**: step 1 is done when a variety has a price today, step 2 when a stock entry exists.
- **Optional steps are passed by one explicit tap**, and the pass is remembered for the business. This stored state belongs to the Onboarding alone; the checklist's derive-only rule is unchanged.

| Step | Passed by |
|---|---|
| 3. Header and footer | "Save" (edited) or "Leave as is" (defaults kept) |
| 4. Bot | A successful Probarlo (the only way it is saved) shows "Done". "Skip" passes the step without a bot. A failed Probarlo shows its reason and saves nothing |
| 5. Partner | "Continue" once a link has been created, or "Skip" |
| 6. Categories | "Continue" only. Adding, renaming or removing a category saves at once but never passes the step |

- **Data that already exists** shows "Done" and counts as passed: a bot saved earlier, a second user already in the business. A done required step shows "Done" the same way (step 1 as above).
- **Resume** lands on the first step that is neither done nor passed, or on "All set" when there is none.
- **Leaving** ("Close", closing the app, a dropped connection) keeps everything saved and the resume point.
- **"Skip the rest"** passes every remaining optional step at once.
- **No early end**: the Onboarding never ends before both required steps are met, and nothing outside it (a price added on the variety's page, say) ends it.

### "All set"

- Once both required steps are done and every optional step is passed, the next screen the Onboarding shows is "All set", and **reaching "All set" ends the Onboarding**. Usually that is on the tap that passes the last optional step (its own action, or "Skip the rest"); when every step became done or passed outside it, it is on tapping the Inicio notice.
- From then on it is over for good: leaving "All set" by any means, or closing the app on it, never brings the Onboarding back, and the Inicio notice goes. No tap on "All set" itself is needed.
- **One line per step**:
  - "Done" for a step whose data exists or that was saved;
  - "For later — in Settings → <group>" or "in Varieties" for a skipped step;
  - the required steps' lines count the records made, e.g. "Done · 2 varieties": a count, never a figure or an amount.
- **Actions**: the primary "Record my first sale", which opens Nueva venta, and the secondary "Go to Home". No celebration and no extra content.
- **Nueva venta opened from "All set"** goes back to Inicio, whether closed with "Close" or saved. It never goes back to "All set" or the Onboarding.

### Empty states and errors

- Step 1 starts with empty fields while the business has no variety. No step shows a figure, a placeholder or sample data.
- Refusals and failures belong to each setting's owner: inline, keeping what was typed, carrying no data. No network shows "No connection: check your internet and try again.", a server error the generic retry.
- A record that is gone follows accounts.md's "That's gone." rule.
- Data a partner created shows "Done" on the next open. No live updates.

### Design

- Design-system elements only: tokens, components and both themes. No illustrations, animation, marketing copy, new colours or new components.
- If nothing existing fits the progress indicator or the step layout, design draws it from tokens only, inside the design system, before it is built; it is never invented in code.
- Rioplatense Spanish with vos. Nothing clipped at 320–430 px or at 130 % text; controls at least 44 px tall and inputs at least 16 px.
- Every step and "All set" go into `scripts/design/screens.json`; `scripts/design/compare.sh` runs before and after, phone and computer, judged by eye.

### Reviewing a change against the design (criterion 6)

- **The evidence matrix**: every cell is captured on the task base (before) and on the head (after) with `scripts/design/comparisons.mjs --strict`. One script from one install takes both sides, on the same Argentina day, with fonts pinned (ADR-0042). The PR records the installed `@fontsource/plus-jakarta-sans` version. The cells are:
  - every Onboarding step and "All set", light and dark, phone and computer;
  - the "Keep going with setup" notice on Inicio, InicioOscuro and InicioCompu;
  - when the change touches step 2's chip, the stock entry form opened from a variety with no entries ("Stock inicial" preselected), light and dark, phone and computer.

  Screens the change does not touch are left out.
- **Registry rows**: a cell with no row in `scripts/design/screens.json` gets one under design-capture.md's rules:
  - the row reaches its screen the way a seller does;
  - it captures the named section whole;
  - the two registry tests are declared as seams;
  - every guard of those tests is kept.
- **Every difference is listed** in the PR as intended, as a known design defect (such as the drawing's "Origen" label on step 2), or as a defect.
  - A difference the change introduced compared with the task base is a regression, and it is fixed in the same task, unless it is the change's own decided intent.
  - A difference already present on the task base is filed as a new follow-up issue, which the PR links, and is not fixed there.
  - No difference is left unexplained.
- **A missing capture**: a cell that cannot be captured, on either side, means the change is not done. There is no exception (design-capture.md).
- **Review evidence only**: the captures are judged by eye and are never a gate step (ADR-0042, gate.md).

### Constraints

- The Onboarding's state carries `business_id`, taken from the session. Its routes join the isolation sweep and the gated-route test; another business's state does not exist (404 or absent).
- Business removal exports and deletes it through ADR-0015's schema reflection, and the dry run counts it.
- Every step calls its owner's own use cases and refusal codes (`contract.json`, ADR-0008); there is no copy of any rule.
- Nothing about it goes to logs, the console or browser storage (ADR-0005, ADR-0026). Nothing is stored or logged about time taken or where a seller left.

## Metrics

There is no telemetry.

- **Under 5 minutes (criterion 1)**: an end-to-end front run from a phone viewport accepts a new-business invitation, prices a variety, loads its opening stock, passes the optional steps and opens Nueva venta from "All set" (`web/e2e/onboarding.spec.ts`); its duration is not measured by any test.
- **Nothing lost (criterion 3)**:
  - a second end-to-end run leaves halfway, resumes from Inicio's notice and lands on the first step neither done nor passed;
  - a resume matrix, 100 % passing, covers:
    - required steps worked out from the data;
    - optional passes remembered;
    - "Done" for data that already exists;
    - no end before both required steps are met, and none from a change made outside the Onboarding;
    - every step done or passed outside it: the notice reads "6 of 6 steps" with no "Missing" line, opens "All set", and reaching "All set" ends it;
    - the end on reaching "All set".
- **One fact, one place (criterion 4)**: a value saved in each step reads the same in Configuración or on the variety's page, and the reverse.
- **Only the sale is required (criterion 2)**: front tests show:
  - every optional step skipped in one tap;
  - "Skip the rest" only once both required steps are done, and never on step 6;
  - "Skip" and "Skip the rest" as text links on one line;
  - "All set" naming where each skipped step lives.
- **The step frame**: front tests show no "Back" on step 1 and "Back" opening the step before on steps 2–6.
- **Step 1**: front tests show:
  - one primary action, saving the variety and its price;
  - a refused price keeping everything typed, with the retry sending only the price and no second variety created;
  - returning to step 1 after a variety is priced today showing that variety marked "Done", and moving on to step 2 adding no variety;
  - with one variety priced today and a second saved with no price, returning to step 1 showing the second's name kept and only its price to fill in, saving only the price, with the progress count unchanged;
  - the "$" before the list, bulk and VIP price and never before the bulk minimum, and no date field or date chip.
- **Step 2's chip**: front tests (`web/src/screens/StockEntryForm.test.tsx`) show:
  - no "Origen" label over the fixed "Stock inicial" chip on step 2. The assertion that it was present changes to absent in the same diff as this doc, and the PR lists it (icon-and-text-rule.md criterion 5);
  - the full stock entry form's origin choice unchanged, with every assertion about it unedited.

  0 open findings on the label.
- **Who gets it**:
  - a brand-new business gets it;
  - an imported business (including one that landed in the Onboarding before the import) never sees it again;
  - a joined user's business and a pre-existing business never see it;
  - the remembered passes never make the import refuse.
- **Inicio and chrome**, front tests on phone and computer:
  - the notice sits at the top with its words, cannot be dismissed, and keeps its count on steps 1–2 while varieties are added;
  - "Start with varieties" never shows with it;
  - "+ New sale" and "Send catalog" behave as for any business while it runs;
  - the Onboarding has no bar and no "+ New sale";
  - Nueva venta opened from "All set" returns to Inicio.
- **Isolation**: the routes are in the isolation sweep and the gated-route test; business removal leaves 0 rows of the state and exported count = deleted count.
- **Design (criterion 5)**: every screen in `screens.json`, `compare.sh` before and after, and a by-eye pass on phone and computer in both themes; the step frame and step 1 match `OnboardingVariedad` and `OnboardingCategorias`. Step 1's price step is registered in `screens.json` and captured before and after the "$" reaches it (varieties.md).
- **Approval from the evidence (criterion 6)**, read from the PR:
  - before and after captures are attached for every cell of the matrix: 0 cells missing;
  - every difference is listed as intended, a known design defect or a defect: 0 unlisted;
  - 0 regressions left on the head that merges, and every pre-existing difference is linked to a follow-up issue;
  - every suite passes, and the only edited tests are the registry tests within their declared seams and any assertion changed in the same diff as the doc that decides it;
  - no capture or comparison step is added to `.agentic/stack.yaml`, CI or the gate.
- **Business metrics**, read by the operator from existing records only (no tool, no dashboard, never shown in the app):
  - the share of brand-new businesses with a priced variety and a stock entry;
  - the share whose first sale falls on the day they were opened.

## Out of scope

- A business-name step: the name is taken at the invitation.
- Per-variety catalog attributes and the low-stock threshold in the Onboarding.
- An Apariencia step.
- A step for #85's pricing switches: that issue decides it once they exist.
- Running it again, or any entry pointing back to it once it is over.
- "Terminar por ahora" as a second exit.
- Offering it to imported, joined or pre-existing businesses.
- Building the first-run checklist, its side rules ("+ New sale" saying what is missing, "Send catalog" disabled) or the after-import notice: their own task (navigation.md).
- Ending the Onboarding from outside it, without reaching "All set".
- Publishing the catalog from the Onboarding.
- Waiting for a partner to join.
- Editing or renaming a saved variety from step 1: that is the variety's page.
- A date field or date chip in step 1: it always saves a price effective today.
- An "Origen" label over step 2's chip; any change to the full stock entry form's origin choice or its label.
- Correcting `Onboarding*.dc.html` as part of a change's review: design corrects its own drawings.
- Fixing, in the change under review, a design difference already present on its task base: it goes to a follow-up.
- Making the design comparison a gate step, or any automated check of a capture.
- Usage tracking, a dashboard or an operator script for its metrics.
- Illustrations, animation, marketing copy, new colours or new components.
- Live updates between partners while it is open.
