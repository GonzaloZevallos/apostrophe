---
status: accepted
date: 2026-11-26
summary: "en el teléfono toda confirmación se dibuja en una sola capa (ConfirmLayer, z-index 40) sobre la barra, el +, las hojas y su aviso; ConfirmLayer es el único dueño del inert/aria-hidden de la app y de html--confirmando; Escape y el foco los suma GH-1158"
---

# On the phone every confirmation is drawn in one layer above the bar and sheets

GH-1065, parte 1. Una confirmación en una tarjeta o un detalle quedaba bajo la barra
inferior (`.bar-inferior`, z-index 5): sus respuestas se cortaban. Se arregla una vez, en
el componente compartido.

## Decisión

1. **Escala de z-index del teléfono**: barra 5, hoja (`.sheet`) 20, aviso de la hoja 30,
   capa de confirmación 40. Ninguna otra regla del teléfono pone un z-index de 40 o más.
2. **`ConfirmLayer` es el único dueño** de `inert` y `aria-hidden` sobre la app y de la
   clase `html--confirmando` en `<html>`. Envuelve la app en un `div` con `display:
   contents` y dibuja, al lado, `div.confirm-layer`, que nunca es inert y sigue el visual
   viewport (`--vv-top`, `--vv-alto`).
3. **`register(id, root)` y `release(id)` escriben el DOM de forma síncrona**, nunca en un
   render: mientras la pila no está vacía en el teléfono, `inert` y `aria-hidden` en el
   envoltorio, `html--confirmando` y `data-open` en la capa; toda confirmación registrada
   salvo la de arriba queda inert. `release` que vacía la pila lo suelta todo. Al cruzar
   900 px la capa reaplica la pila.
4. **`ConfirmDialog` mantiene sus props.** En el teléfono, con un `ConfirmLayer`, se
   dibuja con `createPortal` en la capa y se registra en un `useLayoutEffect`; el cleanup
   libera, así que todo desmontaje libera. En la computadora, o sin proveedor, se dibuja
   en su lugar como antes.
5. **Solo el texto se desplaza** (`.confirmacion__texto`); las dos respuestas quedan
   dentro del viewport visible.
6. **Sin piso nuevo en iOS**: la app ya depende de `inert`.
7. **El scrim no es un control**: un `pointerdown` nativo sobre él se cancela y el foco
   no se mueve.

## Pendiente, a construir en GH-1158

Escape (lo contesta la confirmación de arriba), foco en "No" y su devolución, y el
retiro del envoltorio `.nueva-venta__aviso`. Hasta entonces no se mueve el foco a la
confirmación y el aviso de Nueva venta se ve con un fondo más oscuro.
