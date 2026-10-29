## Jobs

- Cuando abro la app en el teléfono a cualquier hora, quiero que se vea como la app de mi negocio (el verde Yerba) y que coincida con el modo claro u oscuro de mi teléfono sin que yo toque nada, pudiendo igual forzar Light o Dark, para leer de un vistazo quién me debe, qué se está acabando y cómo me va, sin tener que distinguir nunca un estado por su color.

# Elección de tema y paleta

Cómo se ve la app en claro y en oscuro, y quién decide cuál se muestra en cada dispositivo. Rige igual para todo usuario de todo negocio: no hay colores por negocio ni presets (Assume nothing). Se diseña primero para el teléfono; en la computadora vale el mismo comportamiento, sin pulido propio (Phone first).

## Elección de tema

- La elección es Automatic, Light o Dark y se hace solo en Settings → Appearance, en el control **Theme**, con las opciones Automatic, Light y Dark en ese orden. Es un grupo de radios; elegir aplica en el acto, sin botón de guardar, toast ni aviso de cambios sin guardar.
- La opción activa muestra la marca `hecho` delante de la palabra, además del relleno y el texto en semibold: el estado nunca se cuenta solo por color. La marca es `aria-hidden` y la opción conserva `aria-checked`; su nombre accesible es su palabra. Cada opción tiene al menos 44 px de alto.
- Debajo va la línea de ayuda fija "Automatic follows your phone." (en el módulo de copy). El control no muestra si el teléfono está ahora en claro u oscuro.
- Automatic se muestra siempre, también en un dispositivo que no puede informar su tema.
- Appearance nunca tiene cambios sin guardar: "Close" cierra siempre en el acto, sin pregunta. Los textos de "descartar el tema" ya no existen.
- En los anchos más angostos (320 y 246 px) la marca puede quedar debajo de la palabra dentro de la opción; no se corta nada y no hay scroll horizontal.

## Regla del tema

- Sin nada guardado, la app sigue al teléfono en vivo: abre en el tema del teléfono y cambia cuando el teléfono cambia, sea por horario o a mano. También se corrige al volver a la app si el teléfono cambió mientras estaba en segundo plano (`visibilitychange` a visible y `pageshow`).
- Una elección guardada (Light o Dark) es solo de ese dispositivo, sobrevive a una recarga y al cierre de sesión, y gana sobre el teléfono. Un Dark elegido con la opción anterior sigue abriendo oscuro.
- Un Light elegido con la opción anterior no quedó guardado (la app anterior lo trataba como "sin elección"), así que ese dispositivo pasa a Automatic y en un teléfono oscuro se ve oscuro. Es un efecto aceptado: eligiendo Light en Settings → Appearance queda guardado y gana sobre el teléfono.
- Con la app abierta en dos pestañas o ventanas del mismo dispositivo, cambiar el tema en una no cambia la otra en vivo: la otra sigue como estaba (en Automatic, siguiendo al teléfono; en Light o Dark, en ese tema) y toma la elección guardada la próxima vez que carga.
- Guardado: la clave `tema` en `localStorage`; `claro` es Light y `oscuro` es Dark. Sin clave, con cualquier otro valor o ante un error de almacenamiento, es Automatic. Si el almacenamiento falla, lo elegido aplica solo en esa visita y no se avisa nada.
- Elegir Automatic dos veces deja una sola suscripción al sistema.
- El atributo `data-tema` de `<html>` lleva el tema resuelto: sin atributo es claro, `oscuro` es oscuro. `theme-color` sigue a `--papel` del tema resuelto en cada cambio del atributo, también en los cambios del sistema en vivo.
- Un dispositivo sin consulta de tema del sistema lee claro; ahí igual se puede elegir Light o Dark.
- El tema se arma antes de esperar cualquier carga, sin script en línea ni meta `color-scheme`. Costo aceptado: un cuadro claro al abrir en un teléfono oscuro sin nada guardado.
- Solo `web/src/theme.ts` lee o escribe el tema en `localStorage` y escribe `data-tema`; solo `web/src/theme/systemTheme.ts` consulta `prefers-color-scheme`, y `theme.ts` recibe esa lectura inyectada.
- Esta regla viene de la decisión de la dueña del 2026-10-29, que gana sobre ADR-0026; queda un hallazgo `outside` para enmendar el ADR.

## Paleta Yerba

- Los valores de la dueña, en claro y en oscuro, viven en `docs/product/design-system/tokens.css`, `tokens.ts` y `web/src/styles/tokens.css`, que coinciden entre sí. Claro: `--papel` #f6f7f5, `--superficie` #ffffff, `--tinta` #15201a, `--acento` #1e6b47. Oscuro: `--papel` #0e1411, `--superficie` #18211c, `--tinta` #e7eee9, `--acento` #5cc594.
- Incluyen los tokens nuevos `--positivo`, `--negativo`, `--acento-oscuro`, `--acento-calido` (sobre él, solo texto en tinta) y cinco series de gráfico (`--serie1` a `--serie5`). En claro, las series son las de la dueña: #1e6b47, #e3a23b, #4c7fd0, #b8457a y #b9c2bc. En oscuro son variantes más brillantes de los mismos tonos, elegidas en GH-493 parte 1 y registradas en el README de diseño: #5cc594, #f0b95a, #7fa8e8, #e07aa8 y #7f8c85.
- `--tenue`, `--deuda-fondo`, `--deuda2`, `--deuda-linea`, `--critico` y `--critico-texto` son derivados (tintes o sombras de los tonos de la dueña) y su fila lo dice.
- El botón principal es #1e6b47 con texto blanco en claro y #5cc594 con texto #0e1411 en oscuro: en oscuro el texto del botón nunca es blanco.
- Fuera de los dos archivos de tokens no hay hex literal en `web/src`. `theme-color` de `web/index.html` y `theme_color`/`background_color` del manifest son #f6f7f5; el manifest queda claro y su `id` no cambia.
- La fuente y el logo no forman parte de esta capacidad todavía (GH-493 parte 2).

## Contraste

- Todo par de texto y todo ícono con significado llega a 4.5:1 en ambos temas, sobre los fondos donde realmente aparece (barra inferior, "New sale" flotante, sheets y toasts incluidos). Los bordes decorativos (`--linea`, `--deuda-linea`) están exentos.
- La tabla de contraste del README de diseño (ADR-0029) tiene una fila por token y tema. Si un par falla, se mueve solo ese token, entero, al valor más cercano que pase, y el movimiento queda escrito junto a los ratios como desvío del pedido de la dueña.
- Desvío vigente, el único: `--deuda` en claro pasó de #a85a06 a #a35706, porque sobre `--acento-suave` medía 4,35.
- "Undo" en la barra usa opacidad 0,8 en lugar del 0,75 del dibujo: con 0,75 el texto blanco sobre el `--boton` Yerba quedaba en 4,42:1, y con 0,8 llega a 4,79:1.
- Las series de gráfico son marcas, no texto: apuntan a 3:1 sobre `--superficie` y van siempre rotuladas directamente. En claro, `--serie2` y `--serie5` quedan bajo 3:1 porque son los valores de la dueña; el rótulo directo es lo que cuenta la serie.

## Nunca solo por color

- Ningún estado se cuenta solo con color: toda ganancia, pérdida, deuda, crédito o estado (sold out y low incluidos) lleva un signo, flecha, palabra o forma, y las series de gráfico van rotuladas directamente.
- Un censo de vitest sobre `web/src/styles/app.css` lista cada regla que usa `--deuda*`, `--positivo`, `--negativo`, `--critico*`, `--acento-calido` o una serie de gráfico, con el componente que estiliza, la palabra, signo o forma que lleva ("Owed to you", "Owes you", "since dd/mm", "sold out", "low", "Out of date", el signo menos, rótulos directos) y el test que lo afirma. Una regla que no marca ningún estado se lista como decorativa, con su motivo; una de `--positivo` o `--negativo` nunca puede serlo. Falla ante una regla no listada, ante un selector listado que ya no existe y ante un test que no existe. La lista de `--positivo` y `--negativo` arranca vacía: hoy ninguna pantalla muestra una ganancia.
- El test de cada componente listado afirma su palabra o signo.
- Una cifra de ganancia futura toma signo y dirección del valor de la API y el texto del módulo de formato, en una unidad sin cortes, con la flecha `aria-hidden` y "up"/"down" en su nombre accesible.
- Los lugares que necesiten más que agregar un signo, flecha o palabra faltante van a un issue de seguimiento, como brecha conocida. Al cerrar GH-493 parte 1 el censo no encontró ninguno.

## Fuera de alcance

- Mostrar en el control el tema resuelto.
- Un mensaje cuando falla el almacenamiento.
- Sincronizar el tema en vivo entre pestañas o ventanas del mismo dispositivo.
- Un control de tema antes de iniciar sesión.
- Colores o presets por negocio.
- Aviso de novedades dentro de la app.
- Pulido dedicado para la computadora.

## Métricas

- Criterio 1 (sigue al teléfono): `web/e2e/theme.spec.ts` (oscuro emulado sin nada guardado abre oscuro con `theme-color` igual al `--papel` oscuro; un cambio con `emulateMedia` a claro quita el atributo y vuelve el meta a #f6f7f5) y `web/src/theme.test.ts` (un cambio con la app oculta se corrige al volver visible y en `pageshow`).
- Criterio 2 (la elección guardada se mantiene): `theme.spec.ts` (`tema=claro` en teléfono oscuro sigue claro tras recargar; `tema=oscuro` abre oscuro; elegir en Settings persiste tras recargar) y `theme.test.ts` (`claro`, `oscuro` y valores desconocidos se leen como Light, Dark y Automatic).
- Criterio 3 (legible sin color): `tests/test_design_contrast.py` en verde con todas las filas en ambos temas; el censo de color en verde, stock crítico y acento cálido incluidos; cantidad de lugares abiertos en el issue de seguimiento, que debe quedar en cero.
- Criterio 4 (toda pantalla, todo ancho): e2e `mobile` en verde a 320, 375, 430 y 246 px; las entradas de offenders solo bajan; conteos de `scripts/design/compare.sh` adjuntos al PR. Las comparaciones en oscuro de `compare.sh` solo cuentan como evidencia cuando el script guarda `tema=oscuro` o emula un sistema oscuro, porque `data-tema` solo ya no alcanza.
- Criterio 5 (nada más se mueve): todas las suites fuera de los tests de tema pasan sin editar, salvo el literal del fondo claro en `tests/test_design_tokens.py`, que pasa a `#f6f7f5`.
