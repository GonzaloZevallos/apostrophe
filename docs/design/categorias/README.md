# Categorías: approved drawings (2026-11-04)

The owner chose these drawings on 2026-11-04, from 5 proposals validated by an independent UX Lead and UI Lead.
The approved design is "Nivel por nivel". It is the contract for the Settings screen of #393, the category tree.

## Owner decisions these drawings encode

- **One level at a time:** each level is a calm list. A breadcrumb ("Categorías › Bazar › Cocina") goes up, with no
  back-arrow row. Each row shows an icon, a product count, "›" when it has children, and "⋯" with its actions.
- **Tree:** up to 3 levels, and products sit in leaves (#393). "+ Nueva" on the phone is the approved
  `docs/design/nuevo-producto/fuente/telefono/CategoriaNueva.dc.html`, with Nombre and an optional "Dentro de".
- **Icons:** a grid of stroke icons in a sheet, each with its name; no emoji.
- **Reorder:** by drag, or with ↑/↓ buttons of 44 px.
- **Archive:** refused with its reason while the subtree holds products ("Tiene 12 productos: muévelos o
  archívalos primero"). Archived categories are listed apart, with "Restaurar".
- **Desktop:** Miller columns with the selected category's detail, and "+ Nueva" in the 480 px panel.
- **Owner's term (2026-11-05):** a leaf's extra fields are "Campos personalizados" on screen.
- **Copy is neutral Spanish:** tú in messages, the infinitive on buttons (#317, #328).

## Files

- `fuente/telefono/`: Categorias, CategoriasNivel, CategoriaIcono, CategoriasOrdenar, CategoriaArchivar, each with an
  `Oscuro` twin.
- `fuente/compu/`: CategoriasCompu and CategoriaNuevaCompu, each with a `CompuOscuro` twin.
