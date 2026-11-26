---
status: draft
---
## Goal

En la computadora (900 px o más, según `useViewport`), el aviso global de sin conexión deja de flotar en `.aviso-flotante` sobre el título de la pantalla. Pasa a ser la primera fila, en el flujo, de la columna de contenido del Shell, o la primera fila de la página en las pantallas sin Shell. Así quien vende sabe que está sin conexión sin perder de vista dónde está ni la barra lateral con su "+ New sale". El teléfono, los toasts, el texto del aviso y el momento en que se muestra no cambian.

## Acceptance criteria

- En la computadora con Shell, sin conexión, `.aviso-sin-conexion` es el primer hijo de `.columna-principal` (en sus dos variantes), antes de la flecha de regreso, en el flujo normal y sin `position: fixed`.
- En la computadora sin Shell (Sign in, Invitation, reseteo de contraseña, Onboarding, y el `me` pendiente o fallido de `GatedLayout`), el aviso es una fila en el flujo arriba de la página, fuera de `.aviso-flotante`.
- En el teléfono el aviso sigue en `.aviso-flotante`, también sobre una Sheet abierta, y los toasts siguen en `.aviso-flotante` sin cambios.
- Con Vitest (Root y Shell bajo un memory router, `useViewport` simulado, sin conexión) hay exactamente un `.aviso-sin-conexion` en el teléfono, en la computadora con Shell y en la computadora sin Shell.
- Un cambio de tamaño que cruza los 900 deja exactamente un aviso, StrictMode conserva el lugar tomado, y si el Shell se desmonta por un 401 queda el aviso de Root.
- El aviso es el mismo nodo del DOM en dos rutas del Shell.
- Si el `me` de `GatedLayout` falla con `NetworkError`, se ven el aviso y el aviso en línea.
- `web/e2e/offlineBanner.spec.ts` comprueba tres cosas en `/sales` a 900x800 y a 1280x900, sin conexión. El borde inferior del aviso queda a la altura del borde superior del `.cabecera-fila` que contiene el título "Sales", o por encima. El aviso queda dentro de `.columna-principal` en sentido horizontal. Un clic real en el "+ New sale" de la barra lateral llega a New sale.
- `web/e2e/insets.spec.ts` conserva la prueba de sin conexión en los viewports de teléfono y en la computadora comprueba que el aviso está en `.columna-principal` y no es `position: fixed`. Lee el margen del toast del flash de Save de Registrar cobro una sola vez, en el último viewport, y pasa dos veces seguidas.
- No hay ningún literal de breakpoint nuevo, `format/breakpoints.ts`, `GatedLayout` y los toasts no cambian, el CSS nuevo usa solo tokens, y no crece ninguna lista de infractores, tolerancia ni control.
- Se adjunta la Design capture en claro y oscuro de `EstadosSinConexionCompu`, con la nota de que el aviso a lo ancho de la columna es la forma del dibujo.

## Out of scope

- El texto del aviso y el momento en que aparece y desaparece.
- Cualquier cambio en el teléfono o en los toasts.
- `GatedLayout`, `format/breakpoints.ts` y cualquier breakpoint nuevo.
- Pulido dedicado de la computadora más allá de la forma del dibujo.
- ADRs nuevos.

## Decisions

- La definición vive en una capacidad nueva, `offline-notice`, con el término de glosario Offline notice.
  - Reason: ninguna definición escrita describía dónde se muestra el aviso, y `navigation.md` no lo nombra; el texto del aviso sigue siendo de accounts.md.
- El aviso nunca se vuelve a poner en `.aviso-flotante` en la computadora para satisfacer un localizador, y cada uso del aviso como referencia en el e2e se migra en esta tarea.
  - Reason: lo manda la regla del dueño D-69509906.
- No se enlaza ninguna Screen image.
  - Reason: las Screen images son del teléfono y esta tarea no cambia el teléfono; la evidencia de la computadora es la Design capture.

## Risks

Bajo StrictMode, el lugar tomado podría soltarse de más o duplicarse si el cleanup del `useLayoutEffect` no funciona bien con un efecto doble, y eso dejaría cero avisos o dos.
Cada spec del e2e que use `.aviso-flotante` o el aviso como referencia necesita migrarse; si alguna se pasa por alto, el Gate queda en rojo.
Leer el margen del toast desde el Save de Registrar cobro podría volver inestable a `insets.spec.ts` si el Save corre más de una vez.

## Screens

Las pantallas salen de la etapa de diseño.

## Slices

### offline-notice-in-content-column

#### Acceptance criteria

- En la computadora, el aviso de sin conexión es la primera fila, en el flujo, de `.columna-principal` en las pantallas con Shell y de la página en las pantallas sin Shell. El título y el "+ New sale" de la barra lateral nunca quedan tapados.
- El teléfono y los toasts no cambian, y nunca hay más de un aviso, tampoco al cruzar los 900 px, bajo StrictMode, cuando el Shell se desmonta o entre dos rutas del Shell.
- Los casos de Vitest, `offlineBanner.spec.ts` y el `insets.spec.ts` migrado pasan (este último dos veces seguidas), y se adjunta la Design capture en claro y oscuro de `EstadosSinConexionCompu`.

#### Risks

- strictmode-slot-claim
- e2e-landmark-migration
- insets-spec-flakiness
