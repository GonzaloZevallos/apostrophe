---
status: accepted
date: 2026-10-25
---

# On the phone a form is drawn by one Sheet

GH-319 (part 1). Below 900 px every form this part touches is drawn by `web/src/components/Sheet.tsx`.
The computer frames are untouched: ADR-0044's `PriceFrame` modal and `CobroFrame`'s computer branch keep
their DOM, CSS and backdrop behaviour.

## Decision

1. **One frame.** `Sheet` renders `main > div.cuerpo > children`, then `aside`, on both viewports.
   `computer` changes only the class, the dialog attributes and the computer backdrop listener, so a
   resize across 900 px never remounts the form. `CobroFrame` and `PriceFrame` are thin wrappers.
2. **A phone sheet has no outside.** It fills the screen and listens for no tap outside. The form's own
   Close, pinned to the top, and the system back are its exits. A form never gains a confirmation.
3. **A pinned action.** The main action stays inside its `<form>`, in `.sheet__actions` (the form's last
   child, `margin-top: auto; position: sticky; bottom: 0`). Errors and destructive actions sit above it;
   nothing renders below it. On a computer the container is `display: contents`.
4. **Focus** goes to `initialFocus`, or to the first enabled, visible control of the form in DOM order
   (a choice group's first radio included). Collect's focus moves from its title to its first field on a
   phone; its computer modal still focuses the title. Collect drops its handle and peek.
5. **Scroll lock** is one rule, `html:has(.sheet)` under 900 px. `.sheet__body` sets
   `overscroll-behavior: contain`.
6. **Known exceptions.** `CambiarContrasena`, `ExpenseCategoriesEditor` and `NuevaVentaCliente` keep `.capa`.
7. **Legacy names that stay**, read by unedited tests: `--vv-top`, `--vv-alto`, `data-teclado="abierto"`,
   `html--formulario-fijo`, `nueva-venta__falta`, `.capa`, `.cobro-modal`.

## Consequences

- The computer backdrop of the two existing modals still asks through the host's leave guard when
  something was typed (the existing unsaved-changes tests), so their frames report `touched={false}` to
  `Sheet`. `Sheet`'s `touched` gate is for a backdrop that must stay quiet on a touched form.
- `Sheet` sets no `--vv-*` itself yet: the keyboard step wires it to `useVisualViewport`.
