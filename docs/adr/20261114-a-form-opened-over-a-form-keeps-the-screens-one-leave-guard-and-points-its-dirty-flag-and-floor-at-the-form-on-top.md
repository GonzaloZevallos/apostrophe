---
status: accepted
date: 2026-11-14
summary: "A form opened in place over another form keeps the screen's one leave guard: its dirty flag and its sheet floor (read from a ref) point at the form on top, and its one confirmation asks about what would be lost on top."
---

# Un formulario abierto en el lugar sobre otro formulario conserva el único guardia de salida de la pantalla y apunta su bandera de sucio y su piso de hoja al formulario de encima

Extiende ADR-0078 (no la enmienda).

## Contexto

En el teléfono, New sale abre el formulario de gasto en el lugar, como una hoja sobre una venta que sigue montada (`expenses.md`, "Desde New sale"). Hay dos formularios con algo escrito a la vez, y la pantalla tiene un solo `useLeaveGuard` (ADR-0078, `useBlocker` solo vive ahí): un segundo guardia haría dos preguntas para un mismo movimiento.

## Decisión

1. **Un solo guardia.** La pantalla conserva el guardia de su formulario de abajo. No se monta un segundo `useLeaveGuard` en la hoja de encima ni se le pasa un `blocker`: la hoja no dibuja confirmación propia.
2. **Bandera y piso apuntan al de encima.** Mientras la hoja de encima está abierta, la bandera de sucio del guardia es la suya (más la de la venta) y su `sheetFloor` es la profundidad de la entrada de esa hoja, leído de una ref en el momento de la llamada. Cerrar la hoja sucia es salir del formulario de encima, no de la pantalla.
3. **Una sola pregunta, sobre lo que se pierde arriba.** La confirmación única pregunta por lo de encima cuando el cambio queda dentro de la pantalla, y por la venta cuando se sale de la pantalla con la venta tocada.
4. **El guardia se construye aparte.** Este cambio entrega la hoja, su espejo en el historial y sus salidas (`sheet.close()`); el guardia con bandera y piso apuntados es de #769. Hasta entonces, cerrar la hoja con algo escrito no pregunta.
5. **El formulario de encima vive solo en el teléfono.** En la computadora no existe: al cruzar los 900 px se quita la entrada (`switching`) y se pierde lo escrito en el gasto, no la venta.
6. **Guardar cierra con `sheet.close()`.** Nunca `disarm()`: la pantalla de abajo sigue protegida. El toast ("Expense recorded") conserva la vida corta de siempre y se acorta si se abre otra hoja.

## Consecuencias

- Una pantalla con un formulario abierto sobre otro sigue teniendo un único `LeaveConfirm`.
- Hasta que se construya el guardia (#769), un gasto sucio se cierra sin preguntar: la función no está completa.
