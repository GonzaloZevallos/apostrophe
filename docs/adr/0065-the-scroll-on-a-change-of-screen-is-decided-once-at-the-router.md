---
status: accepted
date: 2026-10-30
---

# El scroll al cambiar de pantalla se decide una sola vez, en el router

GH-480. Antes, nada en `web/src` movía el scroll del documento al cambiar de ruta: una pantalla nueva
abría en el desplazamiento de la que se dejaba. El comportamiento está definido en
`docs/product/navigation.md` (criterio 21, «Scroll on arrival and return»); este ADR registra cómo se
decide y se aplica.

## Decisión

1. **Un solo sitio de decisión.** `watchScroll(router)` (`shell/scrollPlaces.ts`) se suscribe con
   `router.subscribe`. En cada `location.key` nuevo, antes de dibujar la pantalla, llama una vez a
   `scrollOnArrival` y guarda la decisión por clave. `shell/ScrollSync.tsx`, montado en `Root`, solo la
   aplica en un efecto de layout. Ninguna pantalla ni componente mueve el scroll del documento por un
   cambio de ruta.
2. **Tabla de decisión** (`shell/scrollOnArrival.ts`, pura, sin DOM ni router):
   - POP al mismo pathname con distinta profundidad de hoja (`state.sheet`, ADR-0027): `keep`;
   - cualquier otro POP: `restore`;
   - PUSH o REPLACE al mismo pathname (búsqueda, filtros, mes, Hoy · Semana · Mes): `keep`;
   - teléfono, destino un formulario con `FORM_DRAWING = 'over'`: `keep`;
   - computadora, destino con `modalOnComputer`: `keep`; mismo `TWO_PANE_LAYOUT`: `keep`;
   - el resto (pestaña, enlace, fila a su detalle, redirección, atrás sin historial, formulario
     `'flow'`, Onboarding): `top`.
3. **`FORM_DRAWING` y `TWO_PANE_LAYOUT`** son registros tipados derivados de `SCREENS`: `tsc` falla ante un
   formulario o pantalla de panel sin clasificar. `routes.ts` no gana ningún campo.
4. **Memoria por clave.** Los desplazamientos viven solo en memoria del módulo, por `location.key`, con
   tope de 100 claves (Chromium guarda a lo sumo 50 entradas): nunca en `localStorage`,
   `sessionStorage`, estado del historial ni URL, y no contienen datos del negocio (§9). Recargar los vacía.
5. **`held` por llegada.** Con la página fijada (`html:has(.sheet)` o `html.html--formulario-fijo`) la
   lectura viva de `scrollY` no es el lugar del vendedor: lo que se guarda al salir es el `held` de la
   misma llegada, nunca la lectura viva ni el de otra pantalla. `held` tiene un solo escritor,
   `watchScroll` a través de `nextPlaces`.
6. **Sin dato guardado, arriba.** Un `restore` sin desplazamiento guardado va a 0.
7. **El seguimiento.** `startFollow` lleva la página a `min(objetivo, máximo)` en cada cuadro, hasta
   llegar, `FOLLOW_CAP_MS` = 3000 ms, o una entrada propia del vendedor (`wheel`, `touchstart`,
   `pointerdown`, `keydown`) o `cancel()`; `ScrollSync` cancela al comenzar cada cambio.
8. **`history.scrollRestoration`** pasa a `'manual'` un cuadro después de `load` y vuelve a `'auto'` en
   `pagehide`, de modo que una recarga conserva el comportamiento del navegador.
9. **Registrar cobro.** Al salir de `customer-payment` con `peekPaymentReturn() !== null`, `ScrollSync` no
   llama `scrollTo` ni inicia seguimiento (y cancela el que hubiera): `useReturnToPlace` es dueño de ese
   regreso, y no cambia. Un traspaso viejo dejado desde otra pantalla no suprime la decisión.
10. **Guarda.** `architecture/forbiddenApis.ts` permite `window.scrollTo`/`scroll`/`scrollBy`, `scrollTop`
    del documento y `history.scrollRestoration` solo en `shell/ScrollSync.tsx`, `shell/scrollPlaces.ts`,
    `shell/scrollFollow.ts`, `components/useReturnToPlace.ts` y `test-setup.ts`. `scrollIntoView` sigue
    permitido.

## Consecuencias

- Contenido que llega después de 3 s: la página termina donde alcance («lo más cerca que permita su
  contenido»).
- Una pantalla de formulario o de panel futura no compila hasta clasificarse; una pantalla común es `top`.
