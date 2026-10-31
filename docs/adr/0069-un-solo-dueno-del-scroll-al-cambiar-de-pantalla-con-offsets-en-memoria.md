---
status: accepted
date: 2026-10-30
---

# Un solo dueño del scroll al cambiar de pantalla, con los offsets solo en memoria

GH-480. Al cambiar de página el sitio conservaba el scroll de la pantalla anterior, y al volver atrás
caía donde el navegador quisiera. `docs/product/navigation.md` ("Scroll al cambiar de pantalla",
criterios 21 a 23) define la regla; aquí se decide cómo se cumple. El número 0065 se salta: no se reutiliza.

## Decision

- **Un único `ScrollSync` en `Root`.** `web/src/shell/ScrollSync.tsx` se monta una vez en `Root.tsx`, por
  encima del árbol público y del gated. Es el único código no de prueba de `web/src` que llama a
  `scrollTo`, `scrollBy` o `.scroll(`, asigna `scrollTop` o toca `history.scrollRestoration`;
  `web/src/architecture/navigationScroll.test.ts` lo hace cumplir y su única excepción es ese archivo.
  `ScrollRestoration` de react-router no se usa.
- **Los offsets viven solo en memoria**, en un `Map` por `location.key` limitado a 100 claves (sale la más
  vieja). Nada va a `localStorage`, a `sessionStorage` ni al estado del historial (ADR-0026: lo único que el
  navegador guarda es el tema). `history.scrollRestoration` queda en `'manual'`; una recarga empieza arriba.
- **La decisión es una función pura**, `decideScroll` en `web/src/shell/scrollPlan.ts`, que lee la tabla de
  pantallas (`pane`, `parent`) y el estado de la ubicación, nunca una lista de rutas:
  - mismo `pathname` (profundidad de una hoja, cambio solo de estado): nada;
  - PUSH o REPLACE a otro `pathname`: arriba;
  - POP: restaura el offset guardado de esa entrada (arriba si no hay);
  - entrar a una ruta cuyo estado trae `underneath` (Record payment): en el teléfono nada, porque la hoja
    es de pantalla completa y no tiene afuera (ADR-0062); en una computadora se mantiene el lugar;
  - en una computadora, el paso entre una lista de dos paneles y su detalle (o entre dos detalles): nada.
- **Restaurar espera a que la pantalla esté lista.** Lista es: ningún marcador de `Loading` en la página
  (`LOADING_MARKER`, exportado de `Loading.tsx`) y la altura del documento sin cambios durante dos cuadros;
  recién entonces aplica `min(offset, scroll máximo)`, una sola vez. Un toque, una rueda, una tecla o una
  navegación nueva cancelan la espera. El tope de 5 s es solo una red: nunca la salida normal.
- **Regla de captura:** mientras una restauración o un mantenimiento esperan a una entrada, los eventos de
  scroll no escriben bajo esa entrada (los recortes de una página aún corta pisarían el offset que se
  espera), y el offset del destino se lee antes de cambiar la entrada actual.

## Consequences

- Una pantalla nueva empieza arriba; volver atrás, "‹" por historial y "Cerrar" de un formulario abierto
  desde la app dejan la pantalla anterior donde estaba, una vez cargada.
- Cualquier código que quiera mover el scroll de la página tiene que pasar por `ScrollSync`. El scroll que
  una pantalla hacía por su cuenta al volver de Record payment (`useReturnToPlace`) pasó a ser de
  `ScrollSync`; el hook conserva solo el foco.
- Una segunda etapa de contenido sin marcador de `Loading` que llegue más de dos cuadros tarde se asienta
  contra la primera: límite aceptado.
