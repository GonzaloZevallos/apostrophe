## Jobs

- Cuando abro la app en el teléfono a cualquier hora, quiero que se vea como la app de mi negocio (el verde Yerba) y que coincida con el modo claro u oscuro de mi teléfono sin que yo toque nada, pudiendo igual forzar Light o Dark, para leer de un vistazo quién me debe, qué se está acabando y cómo me va, sin tener que distinguir nunca un estado por su color.

# Elección de tema y paleta

Cómo se ve la app en claro y en oscuro, y quién decide cuál se muestra en cada dispositivo. Rige igual para todo usuario de todo negocio: no hay colores por negocio ni presets (Assume nothing). Se diseña primero para el teléfono; en la computadora vale el mismo comportamiento, sin pulido propio (Phone first).

## Elección de tema

- La elección es Automatic, Light o Dark y se hace solo en Settings → Appearance, en el control **Theme**, con las opciones Automatic, Light y Dark en ese orden. Elegir aplica en el acto.
- La opción activa muestra una marca más la palabra; la marca es `aria-hidden` y la opción conserva `aria-checked`.
- Debajo va la línea de ayuda fija "Automatic follows your phone." (en el módulo de copy). El control no muestra si el teléfono está ahora en claro u oscuro.
- Automatic se muestra siempre, también en un dispositivo que no puede informar su tema.

## Regla del tema

- Sin nada guardado, la app sigue al teléfono en vivo: abre en el tema del teléfono y cambia cuando el teléfono cambia, sea por horario o a mano. También se corrige al volver a la app si el teléfono cambió mientras estaba en segundo plano (`visibilitychange` a visible y `pageshow`).
- Una elección guardada (Light o Dark) es solo de ese dispositivo, sobrevive a una recarga y al cierre de sesión, y gana sobre el teléfono. Un Dark elegido con la opción anterior sigue abriendo oscuro.
- Guardado: la clave `tema` en `localStorage`; `claro` es Light y `oscuro` es Dark. Sin clave, con cualquier otro valor o ante un error de almacenamiento, es Automatic. Si el almacenamiento falla, lo elegido aplica solo en esa visita.
- El atributo `data-tema` de `<html>` lleva el tema resuelto: sin atributo es claro, `oscuro` es oscuro. `theme-color` sigue a `--papel` en cada cambio del atributo.
- Un dispositivo sin consulta de tema del sistema lee claro; ahí igual se puede elegir Light o Dark.
- Costo aceptado: un cuadro claro al abrir en un teléfono oscuro sin nada guardado.
- Solo `web/src/theme.ts` lee o escribe el tema en `localStorage` y escribe `data-tema`; solo `web/src/theme/systemTheme.ts` consulta `prefers-color-scheme`, y `theme.ts` recibe esa lectura inyectada.
- Esta regla viene de la decisión del dueño del 2026-10-29, que gana sobre ADR-0026; queda un hallazgo `outside` para enmendar el ADR.

## Paleta Yerba

- Los valores del dueño, en claro y en oscuro, viven en `docs/product/design-system/tokens.css`, `tokens.ts` y `web/src/styles/tokens.css`, que coinciden entre sí. Incluyen los tokens nuevos `--positivo`, `--negativo`, `--acento-oscuro`, `--acento-calido` (sobre él, solo texto en tinta) y cinco series de gráfico; en oscuro, las series son variantes más brillantes de los mismos tonos, registradas con su hex.
- `--tenue`, `--deuda-fondo`, `--deuda2`, `--deuda-linea`, `--critico` y `--critico-texto` son derivados (tintes o sombras de los tonos del dueño) y su fila lo dice.
- En oscuro el texto del botón principal nunca es blanco.
- Fuera de los dos archivos de tokens no hay hex literal en `web/src`. `theme-color` de `web/index.html` y `theme_color`/`background_color` del manifest son #F6F7F5; el manifest queda claro y su `id` no cambia.
- La fuente y el logo no forman parte de esta capacidad todavía (GH-493 parte 2).

## Contraste

- Todo par de texto y todo ícono con significado llega a 4.5:1 en ambos temas, sobre los fondos donde realmente aparece (barra inferior, "New sale" flotante, sheets y toasts incluidos). Los bordes decorativos están exentos.
- La tabla de contraste del README de diseño (ADR-0029) tiene una fila por token y tema. Si un par falla, se mueve solo ese token al valor más cercano que pase, y el movimiento queda escrito junto a los ratios como desvío del pedido del dueño.

## Nunca solo por color

- Ningún estado se cuenta solo con color: toda ganancia, pérdida, deuda, crédito o estado lleva un signo, flecha o palabra, y las series de gráfico van etiquetadas directamente.
- Un censo de vitest sobre `web/src/styles/app.css` lista cada regla que usa `--deuda*`, `--positivo`, `--negativo` o una serie de gráfico, con el componente que estiliza y la palabra o signo que lleva ("Owes you", "Since", "In your favor", el signo menos, etiquetas directas). Falla ante una regla no listada. La lista de `--positivo` y `--negativo` arranca vacía: hoy ninguna pantalla muestra una ganancia.
- El test de cada componente listado afirma su palabra o signo.
- Una cifra de ganancia futura toma signo y dirección del valor de la API y el texto del módulo de formato, en una unidad sin cortes, con la flecha `aria-hidden` y "up"/"down" en su nombre accesible.
- Los lugares que necesitan más que agregar un signo, flecha o palabra faltante quedan en un issue de seguimiento, como brecha conocida.

## Fuera de alcance

- Mostrar en el control el tema resuelto.
- Colores o presets por negocio.
- Aviso de novedades dentro de la app.
- Pulido dedicado para la computadora.

## Métricas

- Criterio 1 (sigue al teléfono): `web/e2e/theme.spec.ts` (oscuro emulado sin nada guardado abre oscuro; un cambio con `emulateMedia` cambia en vivo) y `web/src/theme.test.ts` (un cambio con la app oculta se corrige al volver visible).
- Criterio 2 (la elección guardada se mantiene): `theme.spec.ts` (`tema=claro` en teléfono oscuro sigue claro tras recargar; `tema=oscuro` abre oscuro) y `theme.test.ts` (`claro`, `oscuro` y valores desconocidos se leen como Light, Dark y Automatic).
- Criterio 3 (legible sin color): `tests/test_design_contrast.py` en verde con todas las filas en ambos temas; el censo de color en verde; cantidad de lugares abiertos en el issue de seguimiento, que debe llegar a cero.
- Criterio 4 (toda pantalla, todo ancho): e2e `mobile` en verde a 320, 375, 430 y 246 px; las entradas de offenders solo bajan; conteos de `scripts/design/compare.sh`.
- Criterio 5 (nada más se mueve): todas las suites fuera de los tests de tema pasan sin editar.
