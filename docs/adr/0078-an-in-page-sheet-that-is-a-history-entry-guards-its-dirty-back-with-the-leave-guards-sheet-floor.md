---
status: accepted
date: 2026-11-09
---

# ADR-0078: Una hoja en la página que es una entrada del historial protege su atrás sucio con el piso de hoja del guardia de salida

Extiende ADR-0027 y ADR-0062 (no las enmienda).

## Contexto

La edición de un gasto dentro de Gastos es una hoja en la página (ADR-0062). En el teléfono, el atrás del sistema y "Cerrar" deben ser el mismo movimiento (ADR-0027), pero `useLeaveGuard` nunca bloquea una navegación que solo cambia la profundidad de la hoja: abrir o cerrar una hoja no es salir del formulario. Para una hoja que es el formulario mismo, cerrarla sí es salir, y perder lo escrito.

## Decisión

1. **Piso de hoja.** `useLeaveGuard(dirty, { sheetFloor })` es una opción opt-in: con ella, una navegación que cambia solo la profundidad y cuya profundidad siguiente queda por debajo del piso se bloquea mientras el formulario esté sucio y el guardia no esté desarmado. Sin la opción, el comportamiento es idéntico al anterior. `useLeaveGuard` sigue siendo el único módulo que llama a `useBlocker`.
2. **No se vuelve a empujar la entrada.** Una alternativa era dejar pasar el atrás y empujar de nuevo la entrada si el formulario estaba sucio. Se descarta: deja el historial con una entrada que el navegador ya había quitado y parpadea la hoja; bloquear antes de que ocurra la navegación no tiene ese efecto.
3. **Una sola fuente de verdad.** `editTarget !== null` decide si la edición está abierta, en ambos diseños. La entrada de `useSheet(1)` es un espejo solo del teléfono: cuando la entrada propia de esta edición se quita, se limpia `editTarget`. La búsqueda de la URL (`?month=`) nunca se toca, así el atrás cae en el mismo mes.
4. **Cambio de tamaño.** El formulario sigue montado al cruzar los 900 px y conserva lo escrito. Teléfono → computadora: se quita la entrada con el espejo suprimido (`switching`), y `editTarget` queda. Computadora → teléfono con la edición abierta: se vuelve a empujar la entrada. Un diálogo abierto se reinicia antes.
5. **Una sola salida que desarma.** `closeEdit` (guardar, gone, borrar) es la única salida: en el teléfono llama a `disarm()` antes de quitar la entrada, así esa navegación no se pregunta. Como `disarm()` es de una vía, el guardia se remonta en cada apertura: `ExpenseEditSheet` se monta por edición.
6. **Un diálogo por diseño.** En el teléfono, solo el bloqueador abre `LeaveConfirm`; Cerrar y atrás son ambos `sheet.close()`. En la computadora el guardia nunca bloquea y sigue el diálogo `confirmingDiscard` de siempre.

## Consecuencias

- Quien pase `sheetFloor` debe salir siempre por una única salida que desarme antes de quitar la entrada.
- La opción es compartida por navegación: `useLeaveGuard.test.tsx` cubre los casos con y sin ella.
