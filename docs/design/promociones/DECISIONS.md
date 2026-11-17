# Promotion model: the owner's decisions (2026-11-05)

A promotion is **Si** (conditions) → **Entonces** (one benefit on a target).

## Si: conditions

- A list; **all must hold**. There is no OR: for OR the seller makes two promotions.
- Kinds:
  - **Cantidad** of a product set: at least N, in one unit of the fixed list (u, g, kg, l, ml, m, cm). The set is
    products and/or categories at any level; a category includes its subtree; empty means the whole catalog.
    Products sold in another unit are left out, and the sheet says which ("El Mantel (m) no entra porque se vende
    por metro").
  - **Monto** of a product set or of the whole sale: at least $M.
  - **Tipo de cliente:** one or more types. Never applies to a sale without a customer, and the sheet says so.
  - **Medio de pago:** one or more methods, read as "or" ("se cumple si paga con cualquiera"). Checked when charging.
  - **Días de la semana.**
- **Cómo contar** for cantidad and monto: "Entre todos" (default) or "Por producto".
- No condition means the promotion always applies (e.g. a category sale).
- **Hours are out** for now; the model takes them later as another condition kind.
- **Dates** (desde, hasta; both optional, an open end lasts until paused) are an attribute of the promotion, not a
  condition. A future start makes the button "Programar promoción".

## Entonces: one benefit

- **Target:** "A lo que se contó" (the counted lines), "A otros productos" (another set: buy A, B gets it) or
  "Al total de la venta".
- **Units, for line targets:** "Todas" or "K unidades, las más baratas", per time the condition is met.
- **Benefit kinds:** % de descuento (100 % = gratis), monto de descuento, precio especial por unidad, **precio fijo del
  grupo** ("3 por $3.000").
  - "Lleva N paga M" is not its own kind: it is 100 % on N−M units, the cheapest.
  - A gift is 100 % on another set, only when that product is already in the sale. Adding it automatically is out.
- **Escalones** (optional): threshold → benefit value; the highest reached tier applies to all units of the target.
- **Repetición:** "Cada vez que se cumple" (default for quantity conditions: 2x1 with 4 units gives 2 free) or
  "Una vez por venta" (default for amount conditions). No usage caps.

## Combining

- A switch **"Se suma a otras"**, off by default.
- Among promotions that do not stack, **the one that saves the customer most wins**, automatically.
- There is **no manual order** of promotions.

## Other

- The name is generated from the rule and editable; it is not required.
- An active promotion can be paused or archived; archiving asks for confirmation, and past sales keep it.
