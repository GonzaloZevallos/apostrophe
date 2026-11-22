## Jobs

**Cuando** necesito cambiar cómo funciona mi negocio (una regla de precio, un **Payment method**, el bot de Telegram) y estoy en el celular con poco tiempo, **quiero** ver cada configuración que aplica a mi negocio, agrupada por lo que hace, con las más usadas a un toque arriba de todo, **para poder** llegar a la pantalla correcta sin buscar.

- Afina el job de Settings de navigation.md ("cada configuración de todo el negocio en un solo lugar"); no es un job nuevo de producto. Su protagonista es quien vende, en el celular, en un momento poco frecuente y deliberado.
- Lo sirve la lista de inicio de Settings del celular (GH-843). La lista ya está construida como componente sin conectar; la conecta #927 (parte 3 de GH-843), y hasta entonces quien vende sigue viendo la pantalla de Settings actual, sin cambios.

# Settings

**Settings** es el único lugar que reúne cada configuración de todo el Business, en grupos. Cómo se llega a Settings (el avatar "Settings" del encabezado del celular, el link de engranaje de la barra lateral), sus grupos como subpantallas y sus presupuestos de toques viven en navigation.md. Este archivo define la lista de inicio de Settings del celular: qué muestra, en qué orden y de dónde sale cada dato.

## Un solo registro

Las filas de Settings, sus tres shortcuts y la búsqueda futura salen de un único registro tipado, `web/src/screens/settings/settingsRows.ts` (ADR [20261119-settings-rows-live-in-one-registry-read-by-the-list-the-shortcuts-and-the-search](../adr/20261119-settings-rows-live-in-one-registry-read-by-the-list-the-shortcuts-and-the-search.md)):

- Las etiquetas, las segundas líneas, los íconos, las direcciones y las etiquetas de los shortcuts viven solo ahí; el texto, en el Copy module bajo `settings:*`, en inglés.
- Cada fila tiene su `key`, su `to` y su `isShown(ctx)`. La fila Customer types se muestra solo mientras el interruptor de Customer types está activado (nunca con el interruptor desactivado o sin conocer). La fila de idioma se muestra solo cuando hay dos o más idiomas, y abre la misma pantalla que la fila del nombre del Business (`SETTINGS_BUSINESS`).
- Los shortcuts son exactamente tres (`prices`, `paymentMethods`, `integrations`), cada uno referencia una fila por su clave y toma el destino con `shortcutTarget`, sin dirección propia. Su etiqueta es `settings:shortcuts.<fila>` y su nombre accesible es esa misma etiqueta visible. Los tres destinos también son filas, así que nada se alcanza solo desde la tira.
- Los grupos son cinco, en el orden de `SETTINGS_GROUPS`; el título de cada uno sale de `SETTINGS_GROUP_LABEL_KEYS` (`settings:groups.<grupo>`, cada clave escrita literal).
- `shownRowsByGroup(ctx, rows)` es la función pura que da los grupos en el orden de `SETTINGS_GROUPS`, cada uno con sus filas que `isShown(ctx)` deja pasar, en el orden del registro; un grupo sin ninguna fila a la vista queda afuera.
- No se agrega, mueve ni redirige ninguna dirección del front.

## La lista de inicio (celular)

El componente `SettingsHomeList` (`web/src/screens/settings/SettingsHomeList.tsx`) dibuja la lista a partir del registro, y de nada más, con el contexto (`ctx`) que recibe como prop obligatoria, sin valor por defecto. Todavía no lo usa ninguna pantalla: figura en `web/scripts/docs/front-exclude.json` (D-62e6dc23), junto con `settingsRows.ts`, hasta que #927 lo conecte a la pantalla de Settings del celular y saque las dos entradas en el mismo cambio.

**Shortcuts**
- Primero, antes de cualquier grupo: una tira de tres celdas iguales, sin título propio. La tira siempre lee el registro completo, sean cuales sean las filas que reciban los grupos.
- Cada celda es un solo `InAppLink` al destino de su fila, con el estado `{enteredFrom: 'settings'}`, así la pantalla que abre sabe volver a Settings.
- Cada celda muestra el ícono del registro en `--acento`, dentro de un recuadro de 36×36 en `--acento-suave`, arriba de su etiqueta centrada de 13 px en `--tinta`. Las tres usan el mismo tinte: ningún color por categoría.
- Las celdas van sobre `--superficie`, con las esquinas de panel y sin borde: el espacio contra `--papel` las separa.
- Cuando una etiqueta se parte en dos líneas a 320 px, las tres celdas conservan la misma altura (tres columnas iguales que se estiran). La etiqueta nunca se corta.
- Sin chevron.

**Grupos y filas**
- Después, los cinco grupos en el orden de `SETTINGS_GROUPS`, cada uno bajo su título: un `h2` real, un nivel debajo del título de la página que pone #927, de 14 px en `--tinta2` (estilo de título de sección, no de título de página).
- Un grupo sin ninguna fila a la vista no dibuja ni su título ni su tarjeta.
- Las filas de un grupo van en una sola tarjeta `--superficie` con esquinas de panel, con separadores finos `--linea` entre filas y ninguno después de la última.
- Cada fila es un solo `InAppLink` a su `to`, con el estado `{enteredFrom: 'settings'}`: el ícono del registro en `--tinta2`, sin recuadro; su etiqueta en `--tinta`; y una segunda línea de 13 px en `--tinta2`. La segunda línea nunca se parte: termina en puntos suspensivos y nunca agranda la fila (su bloque de texto tiene `min-width: 0; flex: 1`).
- Cada fila termina con un chevron decorativo (`aria-hidden`), fuera del nombre accesible, que queda en su lugar aunque la segunda línea sea larga. El nombre accesible de una fila es su etiqueta más su segunda línea.
- Las filas se identifican por su `key`, nunca por su dirección, porque la fila del nombre del Business y la de idioma comparten la misma.

**Toque y tema**
- Cada fila y cada shortcut mide al menos `--alto-tocable` (44 px) de alto. Al tocarlo responde a la vista (`:active`, con fondo `--papel`), y un toque nunca selecciona texto ni hace zoom (`user-select: none`, `touch-action: manipulation`). No hay nada que dependa solo del hover, y el foco visible es el de las filas de Settings existentes.
- Estilos bajo la raíz de clases `ajustes-inicio__*` en `styles/app.css`, solo con tokens de diseño, sin ningún valor hex ni `rgb()`, en claro y en oscuro.

**Precedencia.** Ningún dibujo aprobado cubre los shortcuts, los títulos de grupo ni las filas: las elecciones visuales de arriba aplican el diseño escrito de GH-843, y la estructura de un solo nivel del ADR del registro gana sobre los dos niveles de `Configuracion.dc.html`. Las cuatro decisiones de dibujo de #927 ganan sobre cualquiera de esas elecciones que contradigan, y #927 lo resuelve al conectar la lista. Quedan para que #927 las resuelva: el recuadro del ícono de cada fila, el borde de las celdas, el tamaño de la etiqueta de la fila y la altura dibujada de 60 px.

**Assume nothing.** La lista no fija nada de la forma de trabajar de un Business: cada etiqueta, ícono y dirección sale del registro, y lo que se muestra depende solo de `isShown(ctx)`.

## Criterios de éxito

1. **Los shortcuts primero, a un toque.** Los tres shortcuts del registro van antes que cualquier grupo; cada uno abre su pantalla con un toque y lleva `enteredFrom: 'settings'`. Sus nombres y destinos son los del registro.
2. **Cinco grupos, en orden.** Los cinco títulos aparecen en el orden de `SETTINGS_GROUPS`, y un grupo sin filas a la vista no muestra el suyo.
3. **Solo lo que aplica.** Con Customer types activado: 12 filas con un idioma y 13 con dos (aparece la fila de idioma). Con Customer types desactivado o sin conocer, su fila no está.
4. **Cada fila se lee en una línea y se toca con el pulgar.** Una segunda línea larga termina en puntos suspensivos, nunca se parte ni agranda la fila; filas y shortcuts miden al menos 44 px, responden al toque y se leen bien en claro y en oscuro.
5. **Una sola fuente.** Ningún texto, ícono ni dirección de la lista se declara fuera de `settingsRows.ts`; ningún valor hex en el componente ni en su CSS; ninguna dirección del front nueva o cambiada.
6. **Nada cambia todavía en pantalla.** Mientras no esté conectada, ninguna pantalla cambia; lo que quien vende ve se juzga en #927.

Métrica: la cumplen los tests de Testing Library de los criterios 1 a 3: orden de títulos y tira, conteos de filas por contexto, nombres y destinos de los shortcuts, `enteredFrom: 'settings'` en cada link y grupo vacío sin título. Los cubren `SettingsHomeList.test.tsx` y `settingsRows.test.ts`. La medida del job para quien vende (llegar a la pantalla correcta sin buscar) se toma cuando #927 conecta la lista.
