## Jobs

**Cuando** se corta la conexión mientras trabajo en la computadora, **quiero** que me avisen que estoy sin conexión sin perder de vista dónde estoy ni qué puedo hacer después, **para poder** conservar mi lugar, saber que lo que veo puede estar desactualizado y decidir si espero o vuelvo a intentar.

- Sostiene los jobs del BRIEF (registrar una venta o un Payment, leer quién debe qué) y no agrega un job nuevo: un aviso que tapa la página no puede frenar ninguno de ellos. Cambia dónde se muestra el aviso, no cuándo (parte 2 de GH-1073).
- Rige solo en la computadora. El teléfono no cambia, así que no entra en conflicto con **Phone first**.
- Antes: en la computadora el aviso flotaba en `.aviso-flotante` sobre la parte de arriba de la página y tapaba el título de la pantalla (por ejemplo "Sales"). Quien vendía solo podía esperar a que se fuera o recargar. El hallazgo salió de revisar contra el dibujo `EstadosSinConexionCompu`, no de un uso real. El dibujo muestra el aviso a lo ancho de la columna de contenido, arriba del título, y bajo **Drawing as guide** cuenta como hallazgo porque el dueño leería la pantalla distinto.
- Es un solo job en todas las pantallas: el **Offline notice** nunca tapa de qué trata la página.

# Offline notice

El **Offline notice** es el único aviso global que dice que el dispositivo no tiene conexión. Su texto y el momento en que aparece y desaparece son de accounts.md ("No connection") y no cambian acá. Este archivo dice solo dónde se muestra, según el ancho y según si la pantalla tiene el marco de la app (el Shell). Los toasts no son el Offline notice y no los gobierna este archivo.

Criterios de éxito:

1. **Nada queda tapado en la computadora.** Sin conexión, a 900 px o más, el título de la pantalla y la barra lateral con su "+ New sale" nunca quedan tapados por el aviso y se pueden seguir tocando.
2. **Se nota, en los mismos momentos.** En la computadora el aviso se ve con facilidad arriba de la columna de contenido. Aparece y desaparece exactamente en los mismos momentos que antes de este cambio.
3. **El teléfono no cambia.** Por debajo de 900 px el aviso sigue en `.aviso-flotante`, también sobre una **Sheet** abierta. Los toasts no cambian, ni en el teléfono ni en la computadora.
4. **Uno solo, siempre.** Nunca hay más de un aviso de sin conexión en pantalla, tampoco al cambiar el tamaño de la ventana cruzando los 900 px.

## Comportamiento

Lo que cuenta como teléfono o computadora lo decide solo `useViewport` (`web/src/shell/useViewport.ts`). No hay ningún literal de breakpoint propio, y `format/breakpoints.ts` no cambia.

- **El aviso en sí.** Es el `SinConexion` de siempre, con su mismo panel, su mismo texto y su mismo ícono, dentro de `div.aviso-sin-conexion`. No es un control ni un **Tappable notice**.
- **Computadora, pantallas con el Shell.** El aviso es el primer hijo de `.columna-principal`, en sus dos variantes, arriba de la flecha de regreso y de la fila del título. Está en el flujo normal: empuja la pantalla hacia abajo y se va con el scroll, así que en una columna larga sale de la vista. Ocupa el ancho de la columna, como lo dibuja `EstadosSinConexionCompu`. Su envoltorio lleva el padding `var(--espacio-lg) var(--margen-pantalla) 0`, solo con tokens y sin insets propios, porque `.disposicion` ya los aplica. La barra lateral y su "+ New sale" siguen visibles y se pueden tocar. Un modal de computadora (`.capa`) se dibuja encima del aviso, igual que antes.
- **Computadora, pantallas sin el Shell.** Son Sign in, la aceptación de una **Invitation**, el reseteo de contraseña (`/reset/{token}`), el **Onboarding** y el estado pendiente o fallido de `me` en `GatedLayout`. El aviso es una fila simple en el flujo, arriba de la página y fuera de `.aviso-flotante`, con el modificador `aviso-sin-conexion--pagina`. Ese modificador suma al padding los insets `--inset-arriba`, `--inset-derecha` y `--inset-izquierda`. La página baja debajo de la fila. Si `me` falla con un `NetworkError`, se ven el aviso y el aviso en línea de `GatedLayout`.
- **Teléfono.** El aviso sigue en `.aviso-flotante`, sobre una Sheet abierta, exactamente como antes. Ahí `.aviso-flotante .aviso-sin-conexion` no lleva padding propio, así que se ve igual que antes. El Shell no dibuja ningún aviso en el teléfono.
- **Toasts.** Siguen en `.aviso-flotante`, sin ningún cambio.
- **Cambio de tamaño.** Cruzar los 900 px mueve el aviso de un lugar al otro en un solo commit. Nunca hay cero avisos ni dos.
- **El Shell se desmonta.** Si el Shell se desmonta (por ejemplo, con un 401), el aviso sigue en pantalla: lo muestra Root en su lugar arriba de la página.
- **Primera carga y rutas del Shell.** En una primera carga, Root le pasa el aviso al Shell una sola vez, antes de la primera pintura. Desde el primer commit del Shell, el aviso es el mismo nodo del DOM en todas sus rutas, así que no parpadea ni se vuelve a montar.

### Cómo se decide quién lo dibuja

- `web/src/shell/useOfflineBannerSlot.ts` tiene el lugar del aviso. Es un store leído con `useSyncExternalStore` que guarda un Set de tokens de `useId`, y lo usan dos hooks:
  - `useClaimOfflineBannerSlot()`: el Shell toma el lugar en un `useLayoutEffect` mientras está montado y en cualquier ancho, y lo suelta en el cleanup de ese efecto, así que sigue bien bajo StrictMode;
  - `useOfflineBannerSlotClaimed()`: Root lee si algún Shell tomó el lugar.
- `web/src/shell/offlineBannerSlot.tsx` tiene dos piezas:
  - `OfflineBannerSlotProvider`: Root crea el store una sola vez, y el valor del contexto nunca cambia, así que tomar o soltar el lugar vuelve a dibujar solo a quien lo lee;
  - el único `OfflineBanner` compartido: lee `useOnline()` y dibuja `SinConexion` dentro de `div.aviso-sin-conexion`, con las variantes `flotante` (teléfono), `pagina` (computadora sin Shell) y sin variante (columna del Shell).
- `web/src/Root.tsx` dibuja el aviso cuando `useViewport()==='phone'` o cuando nadie tomó el lugar: en el teléfono, en `.aviso-flotante`; en la computadora sin Shell, como fila en el flujo arriba de la página.
- `web/src/shell/Shell.tsx` dibuja el aviso cuando `useViewport()==='computer'`.
- Root y el Shell leen el mismo store de `useViewport`, así que un cambio de tamaño los da vuelta en el mismo commit.

## Restricciones

- No cambian el texto del aviso ni el momento en que se muestra (accounts.md), y no hay cambios en el **Copy module**.
- No se tocan `GatedLayout`, `format/breakpoints.ts` ni los toasts.
- La computadora no recibe pulido dedicado más allá de la forma del dibujo (**Phone first**).
- En el CSS, solo tokens. No crece ninguna lista de infractores, ni se agranda ninguna tolerancia ni ningún control.
- El aviso nunca se vuelve a poner en `.aviso-flotante` en la computadora, ni visible ni oculto, para satisfacer un localizador del e2e. Cada uso del aviso como referencia en el e2e se migra en la misma tarea que lo mueve (D-69509906).
- La **Design capture** de `EstadosSinConexionCompu` y `EstadosSinConexionCompuOscuro` (`/sales` a 1280×920) es evidencia para la revisión y nunca un paso del **Gate**. No hay dibujo de computadora sin conexión para las pantallas sin Shell, y el ancho de su fila junto a formularios angostos se confirma a ojo.

## Métricas

- **Un solo aviso (criterio 4)**: `web/src/shell/offlineBannerSlot.test.tsx` corre con Vitest, con Root y Shell bajo un memory router, el viewport fijado con `web/src/test-viewport.ts` y la app sin conexión. Hay exactamente un `.aviso-sin-conexion` en cada caso:
  - en el teléfono, dentro de `.aviso-flotante`;
  - en la computadora con Shell, primero en `.columna-principal` y antes de la flecha de regreso;
  - en la computadora sin Shell, fuera de `.aviso-flotante` y con el modificador `--pagina`;
  - después de un cambio de tamaño que cruza los 900;
  - bajo StrictMode.

  Además, el mismo test comprueba que:
  - si el Shell se desmonta por un 401, queda el aviso de Root;
  - es el mismo nodo del DOM en dos rutas del Shell;
  - tomar y soltar el lugar no vuelve a dibujar la pantalla hoja.

  100 % en verde.
- **Nada tapado (criterio 1)**: `web/e2e/offlineBanner.spec.ts`, en `/sales` a 900x800 y a 1280x900 y sin conexión, cumple tres cosas en los dos viewports:
  - el borde inferior del aviso queda a la altura del borde superior del `.cabecera-fila` que contiene el título "Sales", o por encima;
  - el aviso queda dentro de `.columna-principal` en sentido horizontal;
  - un clic real en el "+ New sale" de la barra lateral llega a New sale.

  En `/login` a 1280x900 hay un solo aviso, fuera de `.aviso-flotante` y arriba de la columna de Sign in.
- **En la columna, no flotando (criterio 2)**: en la computadora, `web/e2e/insets.spec.ts` comprueba que el aviso está en `.columna-principal` y no tiene `position: fixed`. Si `me` de `GatedLayout` falla con `NetworkError`, se ven el aviso y el aviso en línea (Vitest).
- **El teléfono y los toasts no cambian (criterio 3)**: los viewports de teléfono de `insets.spec.ts` conservan la prueba de sin conexión. El margen del toast se lee del flash de Save de Registrar cobro, en el formulario que el spec ya abrió, una sola vez, en el último viewport (computadora). El spec pasa dos veces seguidas.
- **Como el dibujo**: Design capture en claro y en oscuro de `EstadosSinConexionCompu`, juzgada a ojo, con una nota de que el aviso a lo ancho de la columna es la forma del bloque "Sin conexión" del dibujo leído en la computadora.
