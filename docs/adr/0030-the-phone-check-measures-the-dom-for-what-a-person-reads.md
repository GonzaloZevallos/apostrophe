---
status: accepted
date: 2026-10-17
---

# The phone check measures the DOM for what a person reads; the README table stays the token guard

ADR-0029 left a known gap: colours set inline in components are invisible to its rule
check. The phone check (`web/e2e/mobile.spec.ts`, GH-80) reads the page itself.

## Decision

- **The DOM check is the authority for what a person reads.** The README table and
  `tests/test_design_contrast.py` stay as the token guard, unchanged. This ADR supersedes
  only ADR-0029's "Known gap": an inline colour is now caught where it is drawn.
- **Compositing rule.** For each text the page reports its colour and the layers behind
  it, root to element: each `background-color` with the product of the opacity of its
  element and of its ancestors folded into its alpha, over `--papel` as the base. The
  text colour is composited the same way. The arithmetic is `contrast.ts`'s, on the Node
  side; the page only reads. The threshold is 4.5:1, with no large-text relaxation.
- **What is measured**: visible text nodes, a field's value, `::placeholder`, and
  `::before`/`::after` with non-empty string content. **Exempt**: a disabled
  (`:disabled`, `aria-disabled`) control's own label, as the PRD says (a reason shown in
  words beside it is measured), svg, options, and icon-only marks.
- **`contrast-unprovable`.** A `background-image` anywhere in the chain, or a colour the
  arithmetic cannot read, is reported under its own rule: the ratio is neither passed nor
  failed.
- **Loading.** With the screen's GETs held (the session's own `/auth/me` passes: held, the
  gated layout renders nothing and no screen's loading state could be read), a screen that
  asked for data is read for `blank-while-loading`, `aria-busy`, `false-empty` (the one
  list, `screens/emptyStates.ts`) and `data-while-loading`. After the release,
  `chrome-shift` and `content-shift` come from a `layout-shift` observer installed before
  the app's scripts, counting only what moved from the release on: what moved before it
  (a font swapping in) is the page's own timing, and measured from navigation the content
  rule flipped between identical runs. A node inserted or removed is not a shift; a node
  that moved several times counts by its largest. The browser names at most five sources
  per shift, so the content area is one finding per screen (`main:content`), not one per node.
- **`CONTENT_SHIFT_PX` = 48**: a 44 px target plus half the 8 px gap between neighbours.
  Chrome (the bar, the header, "+ Nueva venta", anything fixed) is allowed 0 px. The spec
  and both documents refer to it by name.
- **`pending-state`.** A tap on Nueva venta's save, Registrar cobro's save and Entrar's
  "Entrá", its write held then aborted, must show the button disabled or `aria-busy` and
  a word the idle button did not say (a state told by colour alone is not one).
- **The offender list**: one file per rule, `offenders/<rule>.json`, each entry
  `{screen, rule, target, issue, sizes?, themes?}`. `target` is the element's
  `data-testid`, or else `role:accessible name` with digit runs as `#`, cut to 60
  characters; a repeated target takes `@identity` (its nearest identified ancestor), then
  a positional `[n]`. Every entry carries an issue from the fixed area map.
- **Valid only against the pinned fixture and date** (2026-09-16, the stretch fixture): a
  change to either is a change to the lists, in the same diff.
- **Budget**: the `mobile` project takes 6 minutes or less on the dev machine, run at
  `--workers=4` (the walk is read-only).
