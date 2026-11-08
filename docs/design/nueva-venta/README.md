# Nueva venta: approved drawings (2026-11-05)

The owner discarded the earlier New sale (customer chips on top do not scale; product tiles) and five promo-on-sale
proposals, asked for competitor research (Square, Shopify POS, Loyverse, Odoo, Lightspeed, Clover, Zettle, SumUp,
Tiendanube, Mercado Pago) and chose **"Buscar primero + barra de venta"** from 3 proposals validated by an
independent UX Lead and UI Lead. These drawings replace `NuevaVenta*` and update `VentaDetalle` in `pantallas/`,
and are the contract for New sale, the customer search and promotions at sale time (#412, #416).

- **Customer:** a row "Sin cliente · Precios de lista · Cambiar" opens a search by name, phone or code
  (accent-insensitive, match highlighted), recent customers, "+ Crear cliente «query»" and "Seguir sin cliente".
  Choosing a customer re-prices the sale and re-evaluates promotions ("Precios de Mayorista"). Desktop: typeahead.
- **Products:** search-first with a barcode button and a category selector; compact rows (name, category · stock,
  price for the customer type, "+" that becomes "− n +"). With an empty search: "En la venta · N", then "Más vendidos".
  No tiles, no chips.
- **Sale bar:** fixed at the foot: "N artículos · $total · Ahorra $X", the possible saving of a payment-method
  promotion, and "Cobrar".
- **Promotions:** apply on their own; a strip under each discounted line (sticker, discount, ›) opens why it applied
  (the one that saves most wins) and "Quitar de esta venta". A removed promotion stays out of this sale
  ("Quitada · Volver a aplicar") and the sale is recomputed with the rest.
- **Cobrar:** payment method in a selector; a method promotion applies only once the method is chosen; Recibido and
  Vuelto for cash. A sale left owing never gets a method promotion.
- **Detail:** each applied promotion with its amount, "Ahorró $X", keeping the approved detail's shell.
- **Desktop:** split register: search and a keyboard-driven results table on the left, the sale on the right.
- **Files:** `fuente/telefono/` 7 screens + `Oscuro` twins; `fuente/compu/` 2 screens + `CompuOscuro` twins.
- Examples (Bazar de Ana) are correct to the peso: Sale A $21.900 → $17.700 → $15.930 in cash (Ahorra $5.970);
  Sale B 3 medianas: 3x2 $9.000, without it Segunda al 50 % $11.250.
