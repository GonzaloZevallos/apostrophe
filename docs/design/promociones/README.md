# Promociones: approved drawings of the promotion sheet and the promotions list (2026-11-05)

The owner chose **"Bloques"** after two rounds: 5 proposals, then 4 more built on the chosen "Si / Entonces", each
validated by an independent UX Lead and UI Lead, and inspired by research on Shopify, Square, Odoo, Tiendanube,
commercetools and Talon.One. These drawings are the contract for #411, #412, #413, #415 and #416, and they replace
the earlier `PromocionNueva` drawings in `pantallas/`.

- **One sheet, two blocks.** "Si…" is a list of condition cards, all of which must hold; "+ Agregar condición" opens a
  selector of 5 kinds. A filled card folds to one line ("Cantidad · Al menos 3 u de Macetas") and opens in place to
  edit. "Entonces…" holds where the benefit goes, how many units, the benefit and its value, tiers and repetition.
  Dates, "Se suma a otras" and the name fold into "Más opciones". "Así queda en una venta" proves the rule to the peso.
- **The list ("Por estado"),** chosen from 5 validated proposals: calm sections Activas, Programadas, Pausadas and
  Terminadas, archived ones behind "Archivadas · N". Each row has the name, the rule in one line and a state line
  whose mark differs by shape, never by color alone. Actions (Editar, Pausar, Duplicar, Archivar) sit behind "⋯";
  archiving confirms in one line. No manual order: a note says the one that saves most wins. No usage figures.
  On desktop a promotion opens in the 480 px panel as `PromocionEditar`.
- **The model is in DECISIONS.md.**
- **Copy is neutral Spanish:** tú in messages, the infinitive on buttons. Growable options are selectors, never chips.
- **Files:**
  - `fuente/telefono/`: 13 screens (9 of the sheet, 4 of the list), each with an `Oscuro` twin;
  - `fuente/compu/`: 4 screens (2 of the sheet, 2 of the list), each with a `CompuOscuro` twin.
