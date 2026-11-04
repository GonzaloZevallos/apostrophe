# Nuevo producto: approved drawings (2026-11-04)

The owner approved these drawings on 2026-11-04, after 3 rounds of proposals validated by an independent UX Lead and UI
Lead. They are the contract for the product form of the customizable-business work: #390 units, #393 category tree,
#394/#395 fields per leaf category, #579 description.

## Owner decisions these drawings encode

- **Steps:** creating a product takes three short steps: Qué es, Cómo se vende, Detalles. "Crear producto" is available from step 2.
- **Category tree:** up to 3 levels, and a product always sits in a leaf. The picker is search-first, with recents and
  cascading selects ("Bazar ▾ › Cocina ▾"). A chosen leaf sets its whole path. A parent that is itself a leaf is
  chosen through its "Elegir <name>" row. A search with no results suggests nothing.
- **"+ Nueva":** Nombre and an optional "Dentro de", with no type to pick. Splitting a leaf that holds products shows where
  they go, and can be undone.
- **Selectors, never chip rows:** the unit, list-type fields and categories are all selectors (#581).
- **Unit:** a selector over the fixed list of 7. When the product has history it is shown read-only, with a lock and its
  reason.
- **Copy:** the drawings still use Rioplatense voseo. The owner decided on 2026-11-04 that Spanish is **neutral**:
  tú in messages and the infinitive on buttons (#317, #328). Build the texts in neutral Spanish. The wording in the
  drawings is not the contract; their layout and states are.

## Files

- `fuente/telefono/`: 12 phone screens, each with an `Oscuro` twin.
- `fuente/compu/`: 2 desktop screens, each with a `CompuOscuro` twin.

| Screen | Shows |
|---|---|
| ProductoNuevo | Step 1, just opened |
| ProductoNuevoCategoria | Picker with cascading selects |
| ProductoNuevoCategoriaHoja | Choosing a level-2 leaf (Decoración) |
| ProductoNuevoBuscar / …SinResultados | Search with results, and with none |
| ProductoNuevoPaso1Listo | Step 1 with Bazar › Cocina › Tazas and its required field |
| ProductoNuevoPaso2 / ProductoNuevoUnidad | Step 2, and the unit selector open |
| ProductoNuevoDetalles | Step 3 |
| ProductoEditar | Editing after sales: the unit locked |
| CategoriaNueva / CategoriaDividir | "+ Nueva", and splitting a leaf |
| ProductoNuevoCompu / ProductoNuevoCategoriaCompu | Desktop panel, and its picker |
