---
status: draft
---
## Goal

La Sale in progress de New sale guarda en cada línea un Gift o un Special price. El reducer rechaza una fecha de venta imposible o posterior al día del Business, y el cuerpo de la venta manda `gift` y `special_price` por línea. Así, cuando la New sale nueva reemplace al formulario actual, la vendedora puede registrar una línea gratis o a precio acordado tal como pasó, sin corregir nada después. Es solo de front y no tiene ruta (GH-496 parte 9a, parte 1 de 4 de GH-868): la vendedora no ve nada nuevo hasta una parte posterior.

## Acceptance criteria

- `DraftLine` tiene `gift: boolean` y `specialPrice: number | null`, y `productAdded` sobre un Product nuevo crea la línea con `gift` false y `specialPrice` null.
- `productAdded` sobre una línea existente, `stepUp`, `stepDown` y `quantityTyped` conservan `gift` y `specialPrice`, y `stepDown` desde un paso o menos sigue sacando la línea.
- `lineEdited {productId, quantityHundredths, gift, specialPrice}` cambia la línea, y deja el estado igual cuando vienen gift y un Special price a la vez, cuando el Special price es 0 o menos, cuando la cantidad rompe la regla de `typedQuantity` o cuando el Product no está en la venta.
- `lineRemoved {productId}` saca la línea y no hace nada para un Product ausente. Sacar la última línea deja `isDirty` en false con cliente, fecha, Shipping charged, Note y `choice` sin cambios.
- `lineEditOf(buffer {quantityText, gift, specialText}, format)`, pura y en `saleDraft.ts`, valida solo con `typedQuantity` y `parseMoneyInput`.
  - Devuelve la edición o uno de `quantity`, `giftWithSpecial` o `specialZero`, revisados en ese orden.
  - Un texto de Special price vacío da `null`.
  - Gift con cualquier texto de Special price no vacío da `giftWithSpecial`.
  - Un texto ilegible, 0 o negativo da `specialZero`.
- `dateSet {date, today}` acepta solo un día real YYYY-MM-DD (`isIsoDate` nuevo en `web/src/format/dates.ts`) que no sea posterior a `maxSaleDate(today)`, sin límite inferior. Rechaza en silencio y conserva la última fecha válida.
- `useSaleDraft` expone `editLine` y `removeLine`, y `setDate` pasa el día de hoy del Business desde la misma fuente que `initialDraft`.
- `saleLineInputsOf` y `bodyLinesOf` leen `line.gift` y `line.specialPrice`, y `saleBodyOf` manda `gift` y `special_price` por línea, iguales a los de la Sale in progress.
- Tests unitarios sin dibujar cubren:
  - las acciones del reducer: exclusión, Special price 0, cantidad inválida, sacar la última línea, y pasos y cantidad tipeada que conservan Gift y Special price;
  - `dateSet` con fecha vacía, mal formada, 2026-02-30, mañana, hoy y un día anterior;
  - los rechazos de `lineEditOf` y su orden;
  - un borrador que pasa por `pricedSaleOf` y `saleBodyOf`.
- En `docs/product/sale-in-progress.md` se corrigen solo cuatro párrafos: la definición de línea, la frase de `bodyLinesOf` en Collect, la regla de la fecha y la viñeta de Gift y Special price en "Fuera de esta capacidad".
- No se agrega ningún texto en pantalla ni ninguna clave del Copy module, y `en.baseline.json` no cambia.

## Out of scope

- La Sheet del detalle de línea, el control de fecha y los textos de los rechazos de línea y de fecha.
- Cualquier ruta o pantalla que muestre la Sale in progress.
- Un tipo de rechazo para la fecha, o un límite inferior para ella.
- Cambios a la regla de Collect para owing sin cliente o a `collectStateOf`.
- Cualquier cambio en el servidor o en POST /api/sales.

## Decisions

- Cambiar la cantidad (`quantityTyped` incluido, no solo los pasos) nunca cambia ni borra el Gift ni el Special price; solo `lineEdited` los cambia.
  - Reason: un Special price es el total acordado de la línea, y cambiarlo sin que la vendedora lo vea dejaría los libros mal.
- `lineEditOf` revisa `quantity`, después `giftWithSpecial`, después `specialZero`. Un texto vacío es `null`, y uno ilegible, 0 o negativo es `specialZero`.
  - Reason: quedan solo los tres tipos pedidos, y la regla que la vendedora tiene que aprender va primero: una línea gratis es un Gift.
- La fecha de la venta no tiene límite inferior.
  - Reason: una Sale cuenta en su propia fecha, y registrar tarde la venta de ayer es normal.
- El reducer rechaza en silencio una fecha inválida y conserva la última válida, sin tipo de rechazo.
  - Reason: es igual que `quantityTyped`, y el mensaje, si hace falta, es de la parte que dibuja el control de fecha.
- `lineEdited` y `lineRemoved` no hacen nada para un Product que no está en la venta, y sacar la última línea no toca `choice`, owing sin cliente incluido.
  - Reason: editar nunca crea una línea, y la regla de owing sin cliente ya la aplica Collect.

## Risks

- La validación de cantidad de `lineEdited` (que recibe centésimos) puede quedar escrita distinta de la de `typedQuantity` (que recibe texto) y divergir.
- Si `setDate` calcula "hoy" por otro camino que `initialDraft`, cerca de la medianoche el reducer podría rechazar la fecha de hoy.

## Screens

none

## Slices

### draft-lines-gift-special-price-date-guard

#### Acceptance criteria

- `DraftLine` guarda `gift` y `specialPrice`. Las acciones de cantidad los conservan, y `lineEdited` y `lineRemoved` cumplen sus rechazos y la regla de la última línea.
- `lineEditOf` devuelve la edición o `quantity`, `giftWithSpecial` o `specialZero`, en ese orden, con un texto vacío como `null`.
- `dateSet {date, today}` rechaza en silencio una fecha vacía, mal formada, imposible o posterior a `maxSaleDate(today)` y acepta cualquier día real anterior.
- `useSaleDraft` expone `editLine` y `removeLine`, y `setDate` usa el día del Business de la misma fuente que `initialDraft`.
- `saleBodyOf` manda `gift` y `special_price` por línea, iguales a los de la Sale in progress, leídos de los mismos campos que `saleLineInputsOf`.
- Los tests unitarios listados pasan en vitest. `sale-in-progress.md` corrige solo los cuatro párrafos falsos, y no hay claves de copy nuevas.

#### Risks

- quantity-rule-divergence
- business-today-source
