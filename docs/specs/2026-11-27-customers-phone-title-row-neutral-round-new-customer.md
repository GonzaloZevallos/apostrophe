---
status: draft
---
## Goal

On a phone, the Customers title row gets a round, icon-only, neutral-toned "+" in place of the worded "+ New customer". The worded button does not fit at 320 px. The seller can start registering a new customer with one obvious tap, and the row never wraps, gets squeezed or scrolls sideways. The computer keeps the worded button. This applies the owner's rule D-8ecb8c1d and the owner's decision Q34 on the tone.

## Acceptance criteria

- Below 900 px, the Customers title row shows the title "Customers", then a round icon-only "+", then the Settings avatar. This holds in both `Clientes.tsx` and `CustomersBehind.tsx`, both rendered through a new `CustomersTitleRow`.
- The phone "+" is a link with the accessible name "New customer" (`COMMON_TEXT.newCustomer`). It goes to `CUSTOMER_NEW` and has a 44×44 px target, the same size as the Products phone "+".
- The phone "+" uses the neutral tone: a surface background, a 1px `--linea` border and a `--tinta` icon, with `user-select: none` and `touch-action: manipulation`. It uses tokens only, and is never green and never `.boton-icono--lleno`.
- At 900 px and up, the worded `BotonLink variant="secondary" icon="agregar"` "New customer" renders exactly as today.
- Each layout renders exactly one "New customer" link. There is never a CSS-hidden twin.
- The "+" and the avatar never shrink or wrap. The title may truncate with an ellipsis only as a last resort and never shrinks its font size. There is no horizontal scroll at 320, 375 and 246 px.
- The icon-only props of `Boton` and `BotonLink` are a discriminated union in which `tone?: 'filled' | 'neutral'` exists only with `action: 'add'`.
- `botonVisual.tsx` picks the class from one `ADD_TONE_CLASS` record indexed by `tone ?? 'filled'`, with no new branch.
- The Products phone "+" and the `ProductResultsTable` "+" render byte-identical to before.
- `Boton.types.test.tsx` rejects `tone` on `delete` and rejects `tone: 'green'`, and it accepts `tone: 'neutral'` on `add`. It uses the `Rejected`/`RejectedLink` pattern with no suppression comment.
- `Clientes.test.tsx:795-800` is split into two cases:
  - a `stubViewport('computer')` case that keeps every line;
  - a phone case that finds the link by the same role and name, with no visible word and an `aria-hidden` svg.
  - Nothing else in those tests changes.
- No e2e spec changes. The Mobile check passes with no offender list growth.
- `docs/product/icon-and-text-rule.md` changes in four ways:
  - the add rule lists the Products and Customers phone title rows, with Customers neutral and Products filled;
  - it names `ProductResultsTable` as an existing filled use;
  - it no longer says that no other control uses `add`;
  - it records the two filled uses as outside findings.
- `docs/product/customers.md` describes the phone title row with the neutral round "+" and the computer worded button.
- The PR attaches the 320 px measurement showing the worded row does not fit. It also attaches light and dark Design captures of Clientes and ClientesCompu: phone at 320 and 375 px, and computer.

## Out of scope

- Changing the filled "+" of the Products phone title row or of the New sale computer results table. Both are logged as outside findings.
- Any change to the Customers empty-state text, or a second add control in it.
- A second width threshold between 600 and 899 px.
- Any change to the New customer form or how a customer is created.
- Any new or changed Copy module key.

## Decisions

- Widths from 600 to 899 px get the round "+".
  - Reason: the app has a single phone/computer switch at 900 px, and Phone first says the computer never wins a trade against the phone.
- When the row is still too tight, the title truncates with an ellipsis as a last resort, and the "+" and the avatar never shrink.
  - Reason: D-8ecb8c1d forbids shrinking or wrapping the row, and the pass condition is no horizontal scroll at 320, 375 and 246 px.
- The Customers "+" has the same round size and tap area as the Products phone "+", and sits where the worded button was.
  - Reason: the two tab roots read alike, and tone is the only difference.
- Empty Customers gets no extra worded call to action.
  - Reason: customers are mostly created inside New sale, and a second link would break "one link per layout".
- The consolidated behaviour lives in `icon-and-text-rule`, and `customers.md` gets one bullet in "En pantalla: Customers".
  - Reason: the title-row rule is owned by the icon and text rule, and `customers.md` has no existing line describing the phone worded button.

## Risks

The approved drawings of Clientes and ClientesCompu have not been compared with this change. A difference a seller would notice goes to the owner.
The type change to `Boton`/`BotonLink` could alter the filled "+" of Products or `ProductResultsTable`. Byte-identical rendering is required.
At 246 px or in `en-XA`, the title may truncate. This is accepted only as a last resort and is expected not to occur in English at 320 and 375 px.

## Screens

The screens come from the design stage.

## Slices

### customers-phone-title-add

#### Acceptance criteria

- Below 900 px, the Customers title row in `Clientes.tsx` and `CustomersBehind.tsx` shows "Customers", a neutral round icon-only "+" link named "New customer" going to `CUSTOMER_NEW`, and the Settings avatar, with no horizontal scroll at 320, 375 and 246 px.
- At 900 px and up, the worded "New customer" button is unchanged. Each layout has exactly one such link.
- `tone` is accepted only with `action: 'add'`, and `ADD_TONE_CLASS` picks the class. Products and `ProductResultsTable` render byte-identical.
- `Boton.types.test.tsx` and the split `Clientes.test.tsx` cases pass. No e2e spec changes, and the Mobile check offender lists do not grow.
- `icon-and-text-rule.md` and `customers.md` are updated. The PR carries the 320 px measurement and the light and dark Design captures.

#### Risks

- drawing-unverified
- filled-add-regression
- title-truncation-at-stress-width