---
status: accepted
date: 2026-11-23
summary: "la búsqueda de Settings del teléfono no es un Sheet sino una marca `settingsSearch` en el estado de una entrada del historial, una segunda convención junto a ADR-0027: abrirla empuja siempre una entrada, Cancelar y atrás la sacan, un resultado se abre con replace, solo se buscan etiquetas de fila y solo un forward con Settings montado la reabre"
---

# La búsqueda de Settings es una marca en el historial, no un Sheet

GH-844 (búsqueda de Settings), parte 1 de 3. Es solo la función de búsqueda y el hook de la entrada del historial: ninguna pantalla los usa todavía, así que no cambia nada visible.

## Contexto

La búsqueda de Settings del teléfono ocupa la pantalla y el botón atrás del sistema debe cerrarla, igual que a un Sheet (ADR-0027). Pero no se comporta como un Sheet: no tiene profundidad, no bloquea el scroll, no deja el fondo inerte y no tiene botón Cerrar; tiene un campo de texto y Cancelar. Forzarla dentro de `useSheetStack` le heredaría esas reglas.

## Decisión

- **No es un Sheet.** No tiene profundidad, ni bloqueo de scroll, ni fondo inerte, ni Cerrar, y no usa `useSheetStack` ni escribe la clave `sheet`.
- **Una segunda convención de historial, junto a ADR-0027.** Su estado es la marca `state.settingsSearch === true` de una entrada. `useSettingsSearchEntry` es el único que la lee y la escribe; decide si ya está abierta leyendo la ubicación actual del router en el momento de la llamada, sin ref.
- **Abrir empuja siempre una entrada** con el mismo `pathname`, `search` y `hash` y el estado actual más la marca (`inApp` y `enteredFrom` se conservan). Así una entrada con la marca siempre tiene la app detrás. **Cancelar y atrás la sacan** (`navigate(-1)`, solo mientras la marca está puesta). Abrir con la marca ya puesta no hace nada.
- **Un resultado se abre con `replace`**, de modo que atrás desde su página cae en los grupos y no en la búsqueda.
- **Solo se buscan las etiquetas de fila**, nunca el encabezado de un grupo ni la descripción. El texto se pliega con `foldForSearch` (minúsculas, sin acentos); un texto vacío, solo espacios o que se pliega a nada no encuentra filas. Solo se recorren las filas que devuelve `shownRowsByGroup`, así que una fila oculta o pendiente nunca aparece.
- **Un forward con Settings montado reabre la búsqueda; un remontaje la cierra.** Al montar, una entrada con la marca se reemplaza por la misma sin ella (volver desde otra pantalla, recargar). Mientras la pantalla sigue montada no se limpia nada, así que adelante hacia la entrada marcada la reabre.
- **`useRouterHandle`** es la única exportación nueva de `useSheetStack.ts`; el contexto sigue privado.

## Consecuencias

- Las pruebas de la pantalla de Settings de la parte 3 deben renderizarse bajo `SheetRouterProvider`: el hook lanza `useRouterHandle needs a SheetRouterProvider` sin él.
- La parte 3 saca de `web/scripts/docs/front-exclude.json` las dos entradas de estas piezas (D-62e6dc23) cuando una pantalla las use.
- No se agrega ninguna dirección, redirección, clave de copy ni UI.
