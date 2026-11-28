---
status: accepted
date: 2026-11-25
summary: "una card puede dibujar el back del shell en su propia fila de título si su entrada del registro dice `backInTitleRow`; `BackArrow.tsx` sigue siendo el único que dibuja un back, y el fondo inerte de un Sheet puede dibujar esa misma fila"
---

# Una card puede dibujar el back del shell en su propia fila de título

GH-1053, parte 5. No enmienda ningún ADR: añade una excepción a la regla de que el shell dibuja el
back de toda card ([ADR-0045](0045-the-shell-draws-the-chrome-and-a-parent-varies-only-by-its-record.md)).

## Contexto

En el teléfono, Expenses muestra el back, el título y "+ Add expense" en una sola fila (decisión del
dueño, 2026-11-25, D-8ecb8c1d). Si el shell dibujara además su "‹ Analysis" en una línea propia,
habría dos backs en pantalla.

## Decisión

- **La regla de la card.** Una card puede dibujar el back del shell en su propia fila de título. Es
  opt-in y explícito: la entrada del registro (`routes.ts`) dice `backInTitleRow: true` y `chromeOf`
  deja entonces `backArrow` en falso. Solo `expenses` lo dice. La card lo dibuja con
  `<BackArrow look="round" />`; `shell/BackArrow.tsx` sigue siendo el único lugar que dibuja un back,
  con el mismo destino, la misma palabra y el mismo nombre accesible. En el paso angosto de la fila el
  texto se oculta con clip y nunca se quita del DOM.
- **La regla del fondo.** El fondo de teléfono detrás de un Sheet en una dirección directa
  ([ADR-0062](0062-on-the-phone-a-form-is-drawn-by-one-sheet.md)) puede dibujar esa misma fila, porque
  el Sheet vuelve inerte su fondo (`components/Sheet.tsx`): su back y su acción no son alcanzables, y
  en `/expenses/new` no hay ningún back alcanzable.

## Consecuencias

- Ninguna otra card cambia: sin `backInTitleRow`, el shell dibuja su back como hasta ahora.
- La computadora no cambia: allí `expenses` es una raíz y no tiene back.
