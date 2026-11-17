# Owner's decisions for Campos (2026-11-04), after the research

The research behind these is in `$Q/research-campos.md`; read its "Implicaciones" section.

1. **No inheritance.** Fields live only on leaf categories. Add two shortcuts:
   - **"Copiar campos de otra categoría":** pick a leaf through the approved category selector; its fields are
     copied in, and existing names are skipped and said so.
   - **"Aplicar a las hermanas":** copy one field to the sibling leaves of the same parent, with a confirmation that
     lists them.
   Both are reachable from the Campos list, and "Copiar campos…" is also prominent when a leaf has no fields yet.
2. **A Número field's unit** is a selector over the same fixed list of 7 product units (Unidad u, Gramo g, Kilo kg,
   Litro l, Mililitro ml, Metro m, Centímetro cm), plus "Sin unidad". No free text.
3. **A list value already in use** (for example "Vidrio", used by 4 products) is **archived**, never deleted: it is no
   longer offered for new products and is kept on the products that have it. Show "4 productos". Renaming a value
   updates every product that has it; say so ("Se actualiza en 4 productos"). An unused value can be deleted.
4. **Making an existing field required** warns how many products lack it ("9 productos no tienen Capacidad") and does
   **not** block sales. The value is asked the next time each product is edited. Show this warning when the switch is
   turned on.

Also from the research:
- Use "Archivar" (not "Eliminar") on a field with values, and "Eliminar" only at 0 values.
- Show "Usado en N productos" on each field.
- Common-field suggestions, where shown, are opt-in and never auto-added.
