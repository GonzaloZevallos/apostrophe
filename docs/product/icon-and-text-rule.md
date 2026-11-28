## Jobs

**Cuando** estoy en el celular entre pedidos o en medio de un chat con un cliente y necesito encontrar una opción, una acción o qué me dice un aviso, **quiero** reconocerlo de un vistazo por su ícono y una etiqueta corta, y leer cualquier ayuda o aviso como una sola línea corta, **para poder** llegar sin leer bloques de texto y volver con el cliente.

**Cuando** estoy en el celular en Customers y empezó a comprarme alguien nuevo, **quiero** empezar a registrarlo con un toque obvio, **para** agregarlo sin que la fila de arriba de la pantalla se envuelva, se apriete o tenga scroll horizontal. (Parte 1 de GH-1071: lo sirve el `+` redondo neutro de la fila de título de Customers en el celular, que aplica D-8ecb8c1d.)

Esto afina el job de navegación (docs/product/navigation.md) y el job "feels like a phone app" (docs/product/accounts.md); no es un job nuevo y no agrega ninguna capacidad. Su protagonista es el vendedor, en un uso del celular ocupado y con una sola mano; las pantallas de configuración (Settings, Integrations, el Catalog) siguen la misma regla y no se diseñan aparte. La computadora es el mismo job en una pantalla más grande. Antes de esto, la app tenía 13 íconos y las pantallas se leían como paredes de palabras: encontrar una opción o una acción llevaba leer en vez de mirar.

**Cuando** estoy en Products en el celular y necesito agregar algo nuevo que vendo, **quiero** ver la acción de agregar de inmediato y no confundirla nunca con mi avatar de Settings, **para** abrir New product de un toque sin abrir Settings por error.

Este es el job del bloque de título de Products del celular (varieties.md, GH-1182), no un job nuevo; acá lo sirven la forma de la única excepción con nombre de la fila de título y la regla del verde en los encabezados del celular. Antes, el botón redondo verde de agregar quedaba junto al avatar verde y los dos se leían como dos círculos iguales.

El job del `+` de Customers (parte 1 de GH-1071) es una entrada secundaria: los Customers se crean sobre todo donde pasa el trabajo, eligiendo o creando uno dentro de New sale o desde el flujo de un deudor. Por eso el `+` de la fila de título tiene que encontrarse y no apretar la fila, pero no compite por la atención: el tono neutro que decidió el dueño (Q34) lo marca como disponible sin hacerlo la llamada a la acción principal. Antes, el "+ New customer" con palabra no entraba en esa fila a 320 px. No se mide ni se promueve el uso de esta entrada.

**Cuando** un cambio agrega o edita un enlace y el Gate lo revisa, **quiero** que el guardia deje pasar solo los enlaces que esta regla permite que lleven un chevron, y que marque todo otro enlace que lleve un ícono, **para poder** confiar en un Gate en verde y no dejar nunca que una acción llegue al vendedor con pinta de enlace.

- Su protagonista es el mantenedor, o el revisor que actúa por él, como en los jobs de mantenedor de docs/product/gate.md y docs/product/design-capture.md. El vendedor se ve afectado solo de forma indirecta.
- Lo sirve el guardia de cierre (`findActionLinks`, la enmienda "action links" de ADR-0037). Ese guardia deja que un enlace lleve solo el chevron final de una fila de registro. Nunca juzga si un enlace "does" o "opens".
- Ninguna regla de este archivo cambia por esto.
- Antes de esto (GH-227, seguimiento de GH-165), el guardia eximía un chevron en cualquier parte de un enlace. Un enlace que no era una fila de registro, con una palabra y un chevron (p. ej. "Siguiente ›"), pasaba el Gate, y solo lo detectaba un revisor que leyera el diff.

# Icon and text rule

Cómo cada pantalla rotula sus opciones, acciones y avisos: qué controles son solo ícono, cuáles son solo texto y cuáles son ícono + texto; cuánto puede medir una línea siempre visible; y qué puede pasar detrás de More info. Decide cómo se rotula cada cosa, nunca qué hace. No cambia ninguna acción, ruta, orden de opciones, confirmación, texto de toast ni presupuesto de toques, y no debilita ninguna regla sobre lo que una pantalla revela (docs/product/accounts.md). El README del sistema de diseño enuncia la misma regla, de la misma manera. Dónde está cada pantalla lo dice docs/product/navigation.md; el copy propio de cada pantalla queda en su propio archivo de capacidad.

Criterios de éxito:

1. **Se encuentra de un vistazo**: cada opción de More, de la lista de grupos de Settings y de las filas de acción, y cada acción, muestra un ícono junto a su texto, salvo las dos listas cerradas de abajo. La navegación y los menús siempre muestran ícono + texto; "no tab is an icon alone" sigue valiendo.
2. **Una regla, escrita una vez**: este archivo y el README del sistema de diseño enuncian las mismas dos listas cerradas, los mismos límites de largo y qué puede y qué nunca puede ir detrás de More info. La próxima pantalla la sigue sin preguntar.
3. **Corto por defecto, sin perder nada**: las líneas de ayuda, los avisos y los estados vacíos siempre visibles cumplen los límites, y el texto que dice lo mismo dos veces se recorta. Una explicación más larga que haga falta queda a un toque, detrás de More info, y nunca se borra en silencio.
4. **Una sola familia de íconos, ningún estado solo por ícono o color**: cada ícono es de trazo 1.6 a 22 px, está nombrado en `NombreIcono`, en ambos temas. Ningún emoji como ícono de la interfaz. La palabra o la forma que lleva un estado sigue llevándolo.
5. **Nada más cambia**: las acciones, las rutas, el orden de las opciones, las confirmaciones, el texto de los toasts, los presupuestos de toques, cada regla sobre lo que una pantalla revela y cada nombre accesible se mantienen. Los tests existentes pasan sin cambios, con dos excepciones con nombre, cada una listada en el PR con su pantalla y su control:
   - copy acortado a propósito: el doc dueño y el test cambian en el mismo diff;
   - una palabra que pasa a ser un control solo ícono bajo la lista cerrada (p. ej. "Close", "Edit"): un test que la encontraba por su texto visible ahora la encuentra por rol y por su nombre accesible sin cambios, y nada más en ese test cambia; no se descarta ni se afloja ninguna aserción.

   Cualquier otra edición de un test significa que la implementación está mal, no el test.
6. **Se ve como fue diseñado**: `scripts/design/compare.sh` corre antes y después para cada pantalla, en celular y en computadora, en ambos temas, y se juzga a ojo.
7. **El Gate deja que un enlace lleve solo el chevron final de una fila de registro.**
   - Se marca un enlace que no es una fila de registro y que lleva una palabra y un chevron (p. ej. "Siguiente ›"). También se marca un enlace cuyo chevron está en cualquier lugar que no sea la marca final de una fila de registro.
   - El árbol real sigue en verde, sin falsas alarmas. Las filas de registro con su chevron final, la navegación de `shell/` con `aria-current`, `mas__item` y `ajustes__item` siguen sin marcarse.
   - `ACTION_LINKS_LEFT` sigue siendo exactamente el "Add expense" de Expenses, y `ENTRY_CLASSES` no crece.
   - Un infractor real que se encuentre en el árbol se arregla, nunca se exime.
   - Nada de lo que ve el vendedor cambia.
8. **Dos círculos nunca iguales** (GH-1182): en el bloque de título de Products del celular, la acción de agregar es el botón redondo neutro (la píldora con palabra no entra: 49,8 px de menos a 246 px y 20,8 px a 320 px con el texto al 130 %); ningún botón redondo verde queda junto al avatar verde de Settings, en ninguno de los dos temas, y el nombre accesible sigue siendo "New product".
9. **La fila de título de Customers entra en el celular** (parte 1 de GH-1071): a 320, 375 y 246 px, la fila de la lista de Customers (el título "Customers", el `+` y el avatar de Settings) entra en una línea sin scroll horizontal; lo mismo vale para la fila dibujada detrás del formulario de un Customer nuevo, que no lleva avatar.
10. **Agregar sigue siendo un toque y el mismo link**: el `+` se anuncia como "New customer", abre el mismo formulario New customer de hoy y sigue siendo un solo link con ese nombre, así que todo locator del e2e lo encuentra y ningún spec se mueve. En la computadora nada cambia: queda el "+ New customer" con palabra.

## Comportamiento

### Qué forma toma cada control

Las dos listas son cerradas. Agregar a cualquiera de las dos cambia este archivo y el README, nunca una sola pantalla.

- **Solo ícono**: borrar ("Delete…"), buscar ("Search"), cerrar ("Close"), editar ("Edit") y compartir ("Share") solo donde no es la acción principal de la pantalla (p. ej. el Share debajo de un enlace de invitación recién creado en Users, cuya acción principal es "Invite a partner").
  - El nombre accesible es la palabra exacta actual; "Close", nunca "Back", sigue valiendo a través de él.
  - El objetivo mide al menos 44 px.
  - Estar en la lista permite el solo ícono; nunca lo exige. La acción principal de una pantalla siempre lleva su texto (el Share de la pantalla del Catalog conserva su palabra), con la única excepción con nombre de las filas de título del celular de abajo.
  - **Close es una sola forma en todas partes**: todo formulario y toda hoja se cierra con el mismo control solo ícono, de nombre accesible "Close". Ningún formulario muestra la palabra mientras otro muestra el ícono.
  - Back no está en la lista: es navegación y queda como "‹ <parent>" (docs/product/navigation.md).
    - El padre es el fijo que docs/product/navigation.md nombra para esa pantalla (su "‹ <parent>" y su tabla de volver sin historial), desde cualquier pantalla desde la que se haya llegado. Back sigue el historial.
    - Una pantalla muestra exactamente un back, el que le da su marco (el del shell); una pantalla nunca dibuja un segundo por su cuenta.
    - Back nunca es "‹" solo ni una palabra genérica como "Back": su texto visible y su nombre accesible nombran los dos al padre.
  - La "i" de More info es el único control solo ícono fuera de esta lista, definido por su propio término más abajo.
- **La única excepción con nombre: agregar ("New product") en la fila de título de Products del celular** (GH-903 y GH-1182; D-8ecb8c1d y las decisiones del dueño del 2026-11-24 y del 2026-11-26, Q34).
  - Regla del dueño del 2026-11-24: la acción se muestra con su palabra, como la píldora dibujada en Productos.dc.html / ProductosOscuro.dc.html (el ícono `agregar` y la palabra "Product", verde, con el nombre accesible "New product"), solo cuando entra en la fila con "Products" y el avatar de Settings a 320 y 246 px, en claro y oscuro, con objetivos de 44 px y separaciones de 8 px, sin envolver ni desplazarse de costado. Si no entra, es un botón redondo solo con el ícono `agregar`.
  - Lo que salió (GH-1182): la píldora no entra (a 246 px necesita 247,8 px y hay 198; a 320 px con el texto al 130 % necesita 292,8 px y hay 272), así que la acción es el botón redondo neutro dibujado en Clientes.dc.html, en todo ancho de celular y en los dos temas: `.boton-icono` con el modificador `.boton-icono--contorno` (borde de 1 px en `--linea`, fondo `--superficie`, ícono en `--tinta`), nunca verde, con un objetivo de 44×44 px y el nombre accesible "New product" (la clave existente `common:newVariety`). En el código es `action="add"` de `IconOnlyAction`.
  - La medición se hace una sola vez y la forma que da sale igual en todo ancho de celular; nunca cambia en vivo según el ancho. El PR de GH-1182 registra las medidas. La medición de GH-903 (con la palabra "New product" la fila necesitaba unos 317 px y había 272 y 198) había llevado a un botón redondo verde (`.boton-icono--lleno`), que GH-1182 retiró: esa clase ya no existe.
  - Regla del dueño, general (D-8ecb8c1d): cuando una acción con palabra no cabe en una fila de título del celular, pasa a ser un botón redondo solo ícono con nombre accesible; nunca se achica el título, se acorta la palabra ni se envuelve la fila.
  - Regla del dueño del 2026-11-26 (Q34), general: en un encabezado del celular, el verde es solo del avatar de Settings y de la píldora con palabra "+ <cosa>"; un botón redondo solo ícono junto al avatar es el neutro, así dos botones redondos nunca se ven iguales. Rige para todo encabezado nuevo; un encabezado existente con el mismo choque se corrige en su propio issue.
  - **Customers** ("New customer", parte 1 de GH-1071): la palabra no cabe a 320 px. En el celular (menos de 900 px, el único corte de `useViewport`, así que 600 a 899 px también) la fila de título de la lista de Customers (con sus dos vistas, "All" y "Owed to you") es el título "Customers", después un botón redondo solo con el ícono `agregar` y después el avatar de Settings. La misma fila se dibuja detrás del formulario de un Customer nuevo, sin avatar, porque ese panel de fondo no dibuja marco; las dos salen de un solo componente, `CustomersTitleRow` (con su prop obligatoria `avatar`). Su nombre accesible es "New customer" (`COMMON_TEXT.newCustomer`, sin clave nueva) y abre el mismo formulario New customer (`CUSTOMER_NEW`). Tiene el mismo tamaño redondo y el mismo objetivo de 44×44 px que el de Products, en tono **neutro** (decisión Q34 del dueño): fondo de superficie, borde de 1 px en `--linea` e ícono en `--tinta`, con `user-select: none` y `touch-action: manipulation` (`.boton-icono--contorno`, solo tokens). Nunca es verde. Cada layout tiene exactamente un link para agregar, nunca una copia oculta con CSS; con el formulario abierto sigue habiendo un solo link "New customer" alcanzable. Customers vacío no agrega ninguna llamada a la acción: el `+` es el único control para agregar en el celular.
  - **Fila apretada**: el botón redondo y el avatar nunca se achican, se envuelven ni salen de la fila (en el celular, `.clientes__encabezado` no envuelve). Solo como último recurso (246 px o el texto más largo de `en-XA`), el título se corta con puntos suspensivos y conserva su texto completo como encabezado; nunca se achica de tamaño. En inglés a 320 y 375 px el título se ve entero.
  - **En el código**: `action="add"` de `IconOnlyAction`. Las props solo ícono de `Boton` y `BotonLink` son una unión discriminada: `{ variant: 'icon'; action: 'add'; tone?: 'neutral' }` o `{ variant: 'icon'; action: Exclude<IconOnlyAction, 'add'>; tone?: never }`. Hay un solo tono, el neutro: `botonVisual.tsx` da a `add` la clase `OUTLINED_ICON_ONLY_CLASS` (`boton-icono boton-icono--contorno`), sin ninguna rama propia, y `FILLED_ICON_ONLY_CLASS` y `.boton-icono--lleno` ya no existen. Usan `action="add"` la fila de título de Products, la de Customers y la tabla de resultados de New sale en la computadora (`ProductResultsTable.tsx`), que dejó de ser verde con GH-1182.
  - Fuera de esas filas (la computadora incluida), "New product" y "New customer" conservan su palabra; en la computadora Customers sigue mostrando "+ New customer" (ícono + texto).
- **Solo texto**:
  - enlaces (`enlace`), como "Edit header and footer" y "See all";
  - el par de respuestas dentro de una confirmación, con sus palabras exactas actuales ("No, keep it / Yes, delete it", "No, keep entering / Yes, discard it" y el resto);
  - el envío de un formulario o una hoja ("Save sale", "Save the warning", "Save the catalog", "Record payment", "Save and sign in", "Sign in" y el resto);
  - las elecciones entre opciones, que no son acciones: las pestañas de período (Today · Week · Month · Dates), Cash · Transfer · Owing, Promotion · Own use, el origen de un Stock entry, Light · Dark, "All: $ X";
  - Undo dentro de "Sale saved".
- **Ícono + texto**: todo lo demás, p. ej. el "+ New sale" de la barra lateral, "+ Stock entry", "Take from stock", "Send catalog", Collect (el nombre accesible sigue siendo "Collect from <name>"), Publish, Test it, Find my chat, Archive, Restore, "Invite a partner", "Change password", "Sign out", Copy y el Share principal. Una acción nueva que no encaja en ninguna de las dos listas es ícono + texto. El ícono junto a una palabra es decorativo y se oculta para la tecnología asistiva, así que el nombre accesible sigue siendo la palabra.
  - **El "+" de los docs es el ícono**: en el "+ New sale" de la barra lateral, "+ Add expense", "+ Stock entry", "+ Entry", "+ New customer", la píldora "+ <cosa>" de un encabezado del celular y cualquier otra etiqueta escrita con un "+" al principio, el "+" representa al ícono `agregar`. En pantalla lo dibuja el ícono y el texto visible es solo la palabra, nunca un "+" literal junto al ícono. El nombre accesible no cambia.
- **Una acción nunca parece un enlace**: solo un enlace (`enlace`) se dibuja como tal (subrayado, con el estilo de enlace). Una acción, en cualquier forma, incluida una que abre otra pantalla como "New sale" o "New sale to <name>", se dibuja como la acción que es.
- **Tappable notice**: un aviso que el vendedor toca para abrir aquello a lo que apunta. No es una fila de acción ni un control de ninguna de las dos listas cerradas, y no las cambia.
  - Conserva su tarjeta exactamente como fue diseñada: su superficie, sus esquinas redondeadas y su propio padding, sin espaciado de fila ni divisor de fila.
  - Su oración lleva el significado, y su nombre accesible es su texto visible.
  - Su chevron es la marca decorativa de que abre algo; no lleva ningún otro ícono, y el Attention icon solo cuando Avisos, más abajo, lo lista.
- Ninguna acción se quita ni se renombra al ganar un ícono.

### Navegación, menús y filas

- La barra, la barra lateral, More y la lista de grupos de Settings siempre muestran ícono + texto.
- Las filas de opción (More, los grupos de Settings) y las filas de acción llevan un ícono al principio.
- Las filas de registro conservan su diseño y sus marcas de estado: Customers, Sales, Products, Stock entries, Stock withdrawals, Expenses, Price entries y las filas de la cuenta, con `MarcaEstado`, "owes you" en ámbar y "Credit". Las acciones en las filas de registro siguen las listas de arriba.
- Dentro de un mismo menú (More, los grupos de Settings, la barra, la barra lateral), dos opciones no comparten ícono.

### Íconos

- Una sola familia: trazo 1.6, 22 px, sin emoji.
- **Cada ícono se especifica por su nombre en `NombreIcono`**: nada es "an icon" sin uno.
- `componentes.ts` e `Icono.tsx` nombran el mismo conjunto. Un nombre ya dibujado se reutiliza antes de agregar uno nuevo; dos nombres no dibujan el mismo significado.
- Una metáfora específica antes que una neutra (p. ej. un enchufe o un bot para Integrations); nunca un marcador genérico.
- El mismo significado lleva el mismo ícono en todas partes.
- Un nombre entra a `NombreIcono` solo cuando una pantalla lo usa; los nombres existentes se mantienen.
- Cada ícono nuevo se juzga a ojo en el chequeo de diseño.

### Largo del texto siempre visible

- Una línea de ayuda o un aviso: una oración, de 80 caracteres como máximo.
- Un estado vacío: un título de 40 caracteres como máximo, más una línea de 80 como máximo, más su acción si la tiene.
- Los rechazos en línea y los motivos de Test it y Find my chat apuntan a 80, se quedan en pantalla y conservan lo que el vendedor tiene que arreglar, incluso pasados los 80. Nunca pasan detrás de More info.
- Las consecuencias que el vendedor no esperaría de otro modo quedan visibles en forma corta: lo que ya estaba fijado en el chat sigue como está, los gramos disponibles en la confirmación de archivar, los gramos que vuelven al stock al borrar.
- Una pregunta de confirmación puede acortarse, pero conserva cada dato que nombra hoy: fecha, monto, gramos, motivo.
- Los textos de seguridad fijos (el mensaje del freno, la pista de inicio de sesión, los textos de enlace muerto) conservan su significado; acortar nunca agrega información, como una cantidad de intentos o por qué un enlace está muerto.
- Los caracteres se cuentan sobre el copy tal como se muestra, como code points tras NFC. Un placeholder se mide con `SAMPLES` (`web/src/copy/limits.ts`: fecha `28/09`, monto `$ 999.999` y `−$ 999.999`, gramos `999,99 g`, un nombre de 24 caracteres, cantidad `99`), los peores casos, nunca con datos de fixture ni de la API. Cada archivo de copy (`web/src/copy/`) registra sus strings siempre visibles en `LIMITED_COPY` y los rechazos que mantiene por encima de 80 en `LONG_REFUSALS`; `web/src/copy/copyLimits.test.ts` falla si un módulo no tiene ninguno de los dos, si un elemento pasa su límite o si un rechazo largo no está listado.

### More info

- Una "i" de la familia, en un objetivo de 44 px, al final de la línea que explica.
- Un toque expande el texto más largo en el lugar, debajo de la línea; un segundo toque lo colapsa. Nunca un modal ni una hoja.
- Siempre se abre cerrada, y nunca se recuerda si se abrió: el navegador guarda solo la elección de tema.
- Nombre accesible "More info", con `aria-expanded`.
- Abrirla nunca es un cambio sin guardar y nunca dispara la confirmación de salir.
- Guarda solo el cómo o el porqué: nunca una consecuencia, la solución de un rechazo ni un estado.
- Una línea cuya explicación cabe en 80 caracteres no la tiene.

### Avisos

- Un único Attention icon, el mismo en todas partes y decorativo, va junto a la oración de todo aviso o estado que le pide al vendedor que actúe o dice que algo falló:
  - el "Your Telegram catalog is out of date" de Home;
  - "Out of date" con su motivo;
  - "No connection";
  - el reintento genérico por error del servidor.
- La oración lleva el estado; el ícono nunca la reemplaza ni aparece sin ella. El color y la redacción no cambian.
- Sin ícono en: "Up to date"; "That is gone." y su forma de lista; los toasts; las líneas de ayuda; los estados vacíos.
- Un aviso que el vendedor toca para abrir algo es un Tappable notice (ver arriba): conserva su tarjeta diseñada, nunca el marco de una fila.

### Acciones que cambian su palabra según el estado

- Hoy no existe ninguna. Archive y Restore son dos acciones en dos pantallas, cada una con su propio ícono. El interruptor de encendido/apagado del aviso de stock bajo es un interruptor, no un botón, y no lleva ícono.
- Para una futura: la palabra lleva el estado; un segundo ícono se permite solo donde una pantalla lo usa.

### Dónde está escrita

- Este archivo y `docs/product/design-system/README.md`, enunciadas de la misma manera. `componentes.ts` guarda los nombres de `NombreIcono` y el tipo de componente de More info.
- El copy acortado bajo esta regla cambia en su archivo de capacidad dueño, en el mismo diff que su test.
- La fila de título de Customers se describe también en docs/product/customers.md ("En pantalla: Customers").

## Métricas

Sin telemetría; sale de los tests y del chequeo de diseño.

- **Se encuentra de un vistazo (criterio 1)**: un test de front sobre cada pantalla de `scripts/design/screens.json`: cada fila de opción, fila de acción y acción fuera de las listas cerradas tiene un ícono y su texto; cada control solo ícono tiene su nombre accesible actual exacto y un objetivo de 44 px; el ícono junto a una palabra está oculto para la tecnología asistiva; ningún menú repite un ícono; todo formulario y toda hoja se cierra con el mismo "Close" solo ícono. 0 excepciones.
- **Ícono y palabra sin duplicar**: ninguna etiqueta visible lleva un "+" literal junto a un ícono `agregar`, y cada control así conserva su nombre accesible. 0 excepciones.
- **Un solo back por pantalla**: cada tarjeta y cada detalle de `scripts/design/screens.json` muestra exactamente un control de back, que dice "‹ <parent>" con el padre fijo que nombra docs/product/navigation.md, y su nombre accesible nombra a ese padre; ninguno dice "‹" solo ni "Back". 0 excepciones.
- **La excepción de la fila de título (criterio 8)**: los tests del front de Products a ancho de celular encuentran "New product" por rol y nombre accesible en el bloque de título, con un objetivo de al menos 44×44 px; el botón redondo neutro se fija por estilo calculado (borde de 1 px en `--linea`, fondo `--superficie`, tinta `--tinta`, fondo distinto de `--boton`) en `web/e2e/productsHeader.spec.ts`, en seis celdas (320, 246 y 320 con el texto al 130 %, en claro y oscuro), no por clase. La medición de GH-903 a 320 y 246 px, claro y oscuro, está en docs/evidence/GH-548-design-capture.md; la de GH-1182, con la forma elegida y las Design captures claras y oscuras a 320, 375 y 430 px, en su PR. 
  - los tests de `Boton` y `BotonLink` fijan la clase exacta de cada acción solo ícono (`add`, con o sin tono, da `boton-icono boton-icono--contorno`; las demás dan `boton-icono`).
- **La excepción de la fila de título, Customers (criterios 9 y 10, parte 1 de GH-1071)**:
  - `Boton.types.test.tsx`, con su patrón `Rejected`/`RejectedLink` y sin ningún comentario que silencie nada, rechaza `tone` en una acción que no es `add` (p. ej. `delete`) y `tone: 'green'`, y acepta `tone: 'neutral'` en `add`;
  - `Clientes.test.tsx` divide el caso de "New customer" en uno con `stubViewport('computer')`, que conserva cada línea de hoy, y uno de celular, que lo encuentra por el mismo rol y nombre, sin palabra visible y con el svg `aria-hidden`; nada más cambia en esos tests. Con el formulario de un Customer nuevo abierto desde una dirección directa hay un solo link "New customer" alcanzable;
  - `web/e2e/customersTitleRow.spec.ts` comprueba a 246, 320, 375 y 899 px que el `+` y el avatar comparten línea, que el `+` mide 44 px y que nada de la fila pasa el viewport ni hay scroll horizontal; a 320 y 375 px, que el título no se corta;
  - ningún spec de e2e existente se mueve: sigue siendo un link llamado "New customer" (D-69509906 no se activa);
  - el Mobile check pasa sin que crezca ninguna lista de infractores;
  - el PR adjunta la medición a 320 px de que la fila con palabra no entra y las Design captures claro y oscuro de Clientes y ClientesCompu (celular a 320 y 375 px, y computadora); toda diferencia con el dibujo que el vendedor notaría la decide el dueño.
- **Las acciones no son enlaces**: ninguna acción se dibuja con el estilo de enlace; se comprueba a ojo en el chequeo de diseño.
- **Una regla (criterio 2)**: este archivo y el README enuncian las mismas listas y límites, el Tappable notice y la regla del verde en los encabezados del celular incluidos; `componentes.ts` e `Icono.tsx` nombran el mismo conjunto; cada nombre de `NombreIcono` agregado por esta regla lo usa una pantalla. 0 nombres nuevos sin usar, 0 discrepancias.
- **Corto por defecto (criterio 3)**:
  - las líneas de ayuda y los avisos ≤ 80 caracteres, los títulos de estado vacío ≤ 40 con una línea ≤ 80, afirmado sobre el copy fijo; los rechazos de más de 80 se listan para revisión;
  - More info se abre cerrada, alterna `aria-expanded`, nunca dispara la confirmación de salir y no guarda ninguna consecuencia ni solución;
  - una lista en el PR muestra cada texto acortado o movido y adónde fue su forma larga. 0 borrados en silencio.
- **Familia de íconos y estados (criterio 4)**: un guardia para trazo 1.6, 22 px y sin emoji; los tests de front muestran que cada estado conserva su palabra o su forma en ambos temas; el Attention icon está en los cuatro avisos listados y en ninguno de los informativos.
- **Tappable notice**: cada Tappable notice se dibuja como una tarjeta tocable, sin espaciado ni divisor de fila y con su texto visible como nombre accesible; `compare.sh` lo muestra sin cambios, en celular y en computadora, en ambos temas.
- **Nada más cambia (criterio 5)**: las suites existentes pasan; los únicos tests editados son el copy acortado y las búsquedas de texto a rol y nombre de controles que pasaron a ser solo ícono, cada uno listado en el PR; los presupuestos de toques y la tabla de redirecciones no cambian; los textos de seguridad no agregan información.
- **Se ve como fue diseñado (criterio 6)**: `compare.sh` antes y después para cada pantalla, en celular y en computadora, en ambos temas, juzgado a ojo; a 320 px con el texto al 130 %, ningún ícono ni etiqueta se recorta y la barra todavía entra.
- **Solo el chevron final de una fila de registro (criterio 7)**, según los tests propios del guardia de cierre y el Gate:
  - brecha cerrada: un enlace que no es una fila de registro y lleva una palabra y un chevron ("Siguiente ›") falla el guardia, y también un enlace cuyo chevron no es la marca final de una fila de registro;
  - sin falsas alarmas: el guardia pasa sobre el árbol real, y los tests mantienen sin marcar las filas de registro con su chevron final, la navegación de `shell/` con `aria-current`, `mas__item` y `ajustes__item`;
  - `ACTION_LINKS_LEFT` es exactamente el "Add expense" de Expenses, y `ENTRY_CLASSES` son los mismos dos elementos;
  - el cambio no toca ninguna pantalla, copy ni ruta; los únicos tests editados son los del propio guardia, y conservan cada caso que cubrían;
  - cada infractor real que se encuentre se lista en el PR y se muestra arreglado. Esperado: 0.

## Fuera de alcance

- Una interfaz solo de íconos; back como solo ícono; la acción principal de una pantalla como solo ícono, salvo la única excepción con nombre de la fila de título de Products del celular (ver arriba) y lo que la regla del dueño sobre las filas de título del celular decida en adelante.
- Achicar el título, acortar la palabra, bajar las separaciones o el objetivo, o envolver una fila de título del celular para que entre una acción con palabra.
- Cambiar en vivo, según el ancho del celular, entre la píldora y el botón redondo de la fila de título.
- Revisar o cambiar ahora otros encabezados del celular con el mismo choque de círculos verdes: cada uno va en su propio issue.
- Una llamada a la acción con palabra en el estado vacío de Customers, o cambiar su texto; un segundo corte de ancho solo para el `+` de Customers.
- La diferencia entre la fila de la computadora y `ClientesCompu.dc.html` (un "+ Cliente" verde relleno junto a una búsqueda global): es anterior y queda para el dueño.
- Agregar, quitar, renombrar o reordenar cualquier acción u opción; cambiar una ruta, una confirmación o el texto de un toast.
- Íconos en las filas de registro.
- Un ícono opcional en los avisos; íconos que ninguna pantalla usa.
- Dibujar un Tappable notice como una fila de lista, o darle a un Tappable notice el espaciado o el divisor de una fila.
- Mover una consecuencia, la solución de un rechazo o un estado detrás de More info.
- Recordar si More info se abrió.
- Una etiqueta de back que dependa de cómo se llegó a una pantalla (docs/product/navigation.md).
- Un dashboard o cualquier métrica de negocio.
- Cerrar las otras brechas conocidas del guardia de cierre: un ícono dibujado por un componente auxiliar, un enlace reexportado con otro nombre, un enlace de acción sin ícono.
- Juzgar la intención de un enlace ("does" frente a "opens") en el guardia.
