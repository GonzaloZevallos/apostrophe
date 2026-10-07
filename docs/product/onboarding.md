# Onboarding

The step-by-step setup a brand-new business is walked through after its new-business invitation is accepted. It takes the first-run checklist's place for that business. It asks for what a first sale needs (a variety priced today and its opening stock) and offers the business-wide settings a new seller would otherwise hunt for (catalog header and footer, the Telegram bot, a partner, expense categories). Each step saves exactly what its owner saves: varieties.md, stock.md, catalog.md, pinned-catalog.md, accounts.md and expenses.md. The Onboarding holds no setting of its own; it only remembers which optional steps were passed. Seen only by its business (ADR-0004). Where it sits is navigation.md; its Inicio notice sits in results.md's order.

## Jobs

**When** I have just opened my business and it is still empty, **I want** to be walked through what it needs, one short step at a time, with defaults already filled in, **so I can** record my first sale the same day without hunting through Configuración, Variedades and the catalog screen.

Before it, the seller landed on an empty Inicio, read the first-run checklist, and opened Variedades, the catalog screen and Configuración one by one. Before the app, they did all of it in the spreadsheet's Ajustes sheet.

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often, **so I can** get back to the customer instead of hunting through menus. (The navigation job, navigation.md: served here by the Onboarding as the one first-run element of a new business.)

Success criteria:

1. **Fast, from the phone**: from accepting the invitation to a business ready for its first sale (a variety priced today, with opening stock) in under 5 minutes, from the phone alone.
2. **Only the sale is required**: nothing is mandatory beyond a priced variety and its opening stock. Every other step can be skipped in one tap and says where it can be done later.
3. **Nothing lost**: leaving halfway loses nothing already saved. Resuming picks up at the first step that is neither done nor passed.
4. **One fact, one place**: every step saves the same setting, under the same rules and refusals, that Configuración or the variety's page saves. A value set in a step is the value seen afterwards in its usual place, and the reverse.
5. **Simple and attractive, inventing nothing**: built from design-system elements and judged by eye on phone and computer. No placeholder data, no fake figures, and no step for a setting that does not exist yet.

## Behaviour

### Who gets it, and when

- Only a business just opened by a new-business invitation, from the moment the invitation is accepted.
- **Never offered to**:
  - an imported business. Once the spreadsheet import loads a business, the Onboarding is over for it: its notice never shows, "Listo" is never shown, and the after-import notice takes over (navigation.md). Its remembered passes are not records for the import's eligibility check (import.md);
  - a business a user joined by a join invitation;
  - a business that existed before the Onboarding shipped, which keeps the first-run checklist exactly as it is (navigation.md).
- **No "run it again"**: once it is over, nothing in the app points back to it.
- **One state per business**: a partner who joins midway sees the same notice and can carry on. No roles.

### Relation to the first-run checklist

- For a brand-new business the Onboarding fully replaces the checklist; the two never both apply.
- While it is not over, neither the checklist nor "Arrancá por las variedades" shows. "Arrancá por las variedades" takes over once it is over, as after the checklist.
- **The side rules stay, tied to the data**:
  - while no variety has a price today, "+ Nueva venta" says in words what is missing;
  - while nothing qualifies for the catalog and the two required steps are unmet, "Mandar catálogo" is disabled with its reason in words.

### Entry and the Inicio notice

- **Entry**: accepting a new-business invitation lands in the Onboarding, not on an empty Inicio. A join invitation still lands on Inicio. This is the only time the Onboarding opens by itself.
- **The notice**: while the Onboarding is not over, Inicio shows "Seguí con la configuración" at the top, in position 1 of results.md's order, on the phone and on `InicioCompu`.
  - It shows progress in words ("2 de 6 pasos"), counting steps done or passed, and the resume step by its short name (e.g. "Falta: stock inicial").
  - Adding more varieties never moves the count past steps 1–2.
  - It opens the Onboarding at the resume step.
  - It cannot be dismissed. It goes for good when the Onboarding is over.
  - Partners see it too.
- A seller who wants it gone sooner finishes the two required steps and taps "Saltar el resto".

### The screens

- **Kind**: a full screen of the form-or-sheet kind (navigation.md): no bar or sidebar, no "+ Nueva venta". One centred, phone-width column on every viewport, with no computer layout of its own.
- **Every step shows**:
  - one short title and one sentence on why it matters;
  - its fields and one primary action;
  - progress in words as well as shape ("Paso 2 de 6"), never by colour alone;
  - "Atrás";
  - "Saltar", on optional steps only;
  - "Saltar el resto", on optional steps only and only once both required steps are done;
  - "Cerrar", which lands on Inicio and keeps everything saved and the resume point.
- **Unsaved changes**: leaving a step with something typed and not saved, by "Cerrar", "Atrás" or "Saltar", asks before discarding. An untouched step leaves at once.
- **Inside the steps**, the owners' own behaviour applies unchanged: field rules, refusals inline keeping what was typed, toasts, Probarlo's and Buscar mi chat's reasons, "Sin conexión", the generic retry and "Eso ya no está.".

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
- **More varieties**: after a variety and its opening stock, the seller sees "Agregar otra variedad" (another name, price and opening stock) or "Seguir".
  - There is no cap, and each variety is saved the moment its step is saved.
  - One variety is enough to continue.
  - Progress stays on steps 1–2 while varieties are being added.
- **Step 4** ends at the saved bot and says: "Cuando quieras, publicalo desde Variedades → Mandar catálogo". Publicar and the pin's status stay on the catalog screen.
- **Step 5** reads "Enviale el link a tu socio" and never waits for the partner to join.
- **A skipped step** says where it can be done later: Configuración → Integraciones, Usuarios, Mensaje del catálogo or Categorías de gastos. Skipping step 3 or 6 keeps the defaults.

### Done and passed

- **Required steps are worked out from the data**: step 1 is done when a variety has a price today, step 2 when a stock entry exists.
- **Optional steps are passed by one explicit tap**, and the pass is remembered for the business. This stored state belongs to the Onboarding alone; the checklist's derive-only rule is unchanged.

| Step | Passed by |
|---|---|
| 3. Header and footer | "Guardar" (edited) or "Dejar así" (defaults kept) |
| 4. Bot | A successful Probarlo (the only way it is saved) shows "Hecho". "Saltar" passes the step without a bot. A failed Probarlo shows its reason and saves nothing |
| 5. Partner | "Seguir" once a link has been created, or "Saltar" |
| 6. Categories | "Seguir" only. Adding, renaming or removing a category saves at once but never passes the step |

- **Data that already exists** shows "Hecho" and counts as passed: a bot saved earlier, a second user already in the business.
- **Resume** lands on the first step that is neither done nor passed.
- **Leaving** ("Cerrar", closing the app, a dropped connection) keeps everything saved and the resume point.
- **"Saltar el resto"** passes every remaining optional step at once.
- **No early end**: the Onboarding never ends before both required steps are met.

### "Listo"

- The tap that passes the last optional step (the step's own action, or "Saltar el resto") ends the Onboarding and shows "Listo". From then on it is over for good: closing "Listo" by any means, or closing the app on it, never brings the Onboarding back, and the Inicio notice goes.
- **One line per step**:
  - "Hecho" for a step whose data exists or that was saved;
  - "Para después — en Configuración → <grupo>" or "en Variedades" for a skipped step;
  - the required steps' lines count the records made, e.g. "Hecho · 2 variedades": a count, never a figure or an amount.
- **Actions**: the primary "Cargar mi primera venta", which opens Nueva venta, and the secondary "Ir a Inicio". No celebration and no extra content.
- **Nueva venta opened from "Listo"** goes back to Inicio, whether closed with "Cerrar" or saved. It never goes back to "Listo" or the Onboarding.

### Empty states and errors

- Step 1 starts with empty fields. No step shows a figure, a placeholder or sample data.
- Refusals and failures belong to each setting's owner: inline, keeping what was typed, carrying no data. No network shows "Sin conexión", a server error the generic retry.
- A record that is gone follows accounts.md's "Eso ya no está." rule.
- Data a partner created shows "Hecho" on the next open. No live updates.

### Design

- Design-system elements only: tokens, components and both themes. No illustrations, animation, marketing copy, new colours or new components.
- If nothing existing fits the progress indicator or the step layout, design draws it from tokens only, inside the design system, before it is built; it is never invented in code.
- Rioplatense Spanish with vos. Nothing clipped at 320–430 px or at 130 % text; controls at least 44 px tall and inputs at least 16 px.
- Every step and "Listo" go into `scripts/design/screens.json`; `scripts/design/compare.sh` runs before and after, phone and computer, judged by eye.

### Constraints

- The Onboarding's state carries `business_id`, taken from the session. Its routes join the isolation sweep and the gated-route test; another business's state does not exist (404 or absent).
- Business removal exports and deletes it through ADR-0015's schema reflection, and the dry run counts it.
- Every step calls its owner's own use cases and refusal codes (`contract.json`, ADR-0008); there is no copy of any rule.
- Nothing about it goes to logs, the console or browser storage (ADR-0005, ADR-0026). Nothing is stored or logged about time taken or where a seller left.

## Metrics

There is no telemetry.

- **Under 5 minutes (criterion 1)**: an end-to-end front run from a phone viewport accepts a new-business invitation, prices a variety, loads its opening stock, passes the optional steps and opens Nueva venta from "Listo", in under 5 minutes.
- **Nothing lost (criterion 3)**:
  - a second end-to-end run leaves halfway, resumes from Inicio's notice and lands on the first step neither done nor passed;
  - a resume matrix, 100 % passing, covers:
    - required steps worked out from the data;
    - optional passes remembered;
    - "Hecho" for data that already exists;
    - no end before both required steps are met;
    - the end at the tap that shows "Listo".
- **One fact, one place (criterion 4)**: a value saved in each step reads the same in Configuración or on the variety's page, and the reverse.
- **Only the sale is required (criterion 2)**: front tests show:
  - every optional step skipped in one tap;
  - "Saltar el resto" only once both required steps are done;
  - "Listo" naming where each skipped step lives.
- **Who gets it**:
  - a brand-new business gets it;
  - an imported business (including one that landed in the Onboarding before the import) never sees it again and sees the after-import notice;
  - a joined user's business and a pre-existing business never see it;
  - the checklist never shows alongside it;
  - the remembered passes never make the import refuse.
- **Inicio and chrome**, front tests on phone and computer:
  - the notice sits at the top with its words, cannot be dismissed, and keeps its count on steps 1–2 while varieties are added;
  - neither "Arrancá por las variedades" nor the checklist shows with it;
  - the Onboarding has no bar and no "+ Nueva venta";
  - Nueva venta opened from "Listo" returns to Inicio.
- **Isolation**: the routes are in the isolation sweep and the gated-route test; business removal leaves 0 rows of the state and exported count = deleted count.
- **Design (criterion 5)**: every screen in `screens.json`, `compare.sh` before and after, and a by-eye pass on phone and computer in both themes.
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
- Publishing the catalog from the Onboarding.
- Waiting for a partner to join.
- Usage tracking, a dashboard or an operator script for its metrics.
- Illustrations, animation, marketing copy, new colours or new components.
- Live updates between partners while it is open.
