# Stored language

## Jobs

- Cuando mi negocio trabaja en un idioma que no es el inglés, quiero configurar ese idioma una sola vez para todo el negocio, para que cada pantalla y las líneas fijas del **Pinned catalog** lo sigan. Así llevo el negocio sin traducir mentalmente, y los clientes nunca ven un **Catalog** que mezcla idiomas.
- Cuando mi negocio trabaja en un idioma que no es el inglés, quiero que el Catalog de mis clientes hable ese idioma de principio a fin, incluidas las líneas fijas y no solo el **Catalog header and footer** que tipeé. También quiero que un negocio abierto en ese idioma arranque con su Catalog header and footer y sus **Expense categories** ya en ese idioma. Así lo que leen los clientes es coherente y no tengo nada que traducir ni volver a tipear. Mientras mi negocio está en inglés, no cambia absolutamente nada de lo que vemos yo o mis clientes.

## Qué es

Todo **Business** tiene exactamente un **Stored language**, una etiqueta de **Language**. Las palabras en otros idiomas llegan con #317. Hasta entonces el inglés es el único **Selectable language**, el control de idioma no se muestra y no cambia nada visible para nadie.

El Stored language cubre solo los textos propios de la app (**Product language**): las pantallas, y las líneas fijas del Catalog que leen los clientes. Nunca toca los datos propios de quien vende: los nombres de los Products, el Aroma, las notas, las Expense categories y el Catalog header and footer quedan exactamente como se guardaron. Los formatos de números y fechas siguen siendo argentinos, y los formatos de dinero y gramos del Catalog (`$11.000`, `2,5 g`) son los mismos en todos los idiomas.

## Stored language y Shown language

- Un Business que existía antes de esta capacidad tiene inglés, guardado de forma explícita.
- Solo la elección de un **User** cambia el Stored language. Nada más lo hace, ni siquiera un cambio en la lista de Selectable languages.
- **Shown language:** una pantalla se muestra en el **Forced language** del **Operator** cuando hay uno puesto, y en el Stored language si no. El front dibuja según el Shown language.
- El control de idioma lee y muestra el Stored language, nunca el forzado.
- Un Business cuyo Stored language salió de la lista de Selectable languages lo conserva, y sus pantallas siguen la regla de arriba. El Operator mantiene la lista coherente con los textos que existen, así que ninguna regla reemplaza ni cambia nunca un Stored language.
- **Los textos faltantes se muestran en inglés.** Cualquier texto que falte en el Shown language, hasta el archivo de textos completo de ese idioma, muestra su texto en inglés (el respaldo de gettext, language.md). Esto nunca cambia el Stored language ni hace fallar una salida.

## Cambiar el Stored language

- Cualquier User del Business puede cambiarlo; no hay roles.
- El control está en **Settings** → Business, y solo cuando hay más de un Selectable language.
- Cada idioma se nombra en su propio idioma ("English", "Deutsch"), igual sea cual sea el Shown language.
- El control marca el Stored language como actual, incluso cuando está fuera de la lista de Selectable languages, y ofrece para cambiar solo Selectable languages.
- Los idiomas del control son un Fixed set declarado en `fixedSets.ts` a partir de la lista de idiomas de la propia app, acotado por lo que el servidor dice que es seleccionable (selector.md, "La guarda"). Su motivo dice que agregar un idioma es un cambio de código en el Copy module.
  - Un Stored language que ya no es seleccionable pero que la app sabe nombrar aparece en su lugar dentro del orden de la lista, marcado como actual y sin poder tocarse. No hace falta que vaya primero.
  - Un Stored language que la app no sabe nombrar nunca desaparece: se muestra su etiqueta tal cual, marcada como actual, como texto plano fuera del grupo de chips (sin rol, sin `aria-pressed` y sin clase de chip), con su redacción tomada del Copy module. Nunca se puede tocar ni se ofrece como opción. El control nunca queda sin un actual mientras el Business tiene un Stored language.
- Una elección se guarda al instante, sin paso de guardar. El siguiente dibujado sigue al idioma nuevo.
- Después de cambiar desde un idioma que ya no es seleccionable, el User no puede volver a él hasta que vuelva a ser seleccionable.

## Rechazo

- Un valor que no es seleccionable se rechaza con `business.language_not_selectable`.
- El **Test locale** `en-XA` nunca es seleccionable, y ninguna solicitud puede seleccionarlo. Solo lo muestra el Forced language del Operator, y eso reemplaza lo que se muestra, nunca lo que está guardado.
- El rechazo solo puede venir de una pantalla desactualizada.
- El User ve una oración simple del **Copy module**, elegida por el código y nunca tomada del detalle de la respuesta: "That language isn't available for your business." Nunca nombra el Test locale ni da un motivo.
- El Stored language queda como estaba. El control vuelve a marcarlo como actual y ofrece solo los idiomas seleccionables en ese momento.

## Catalog y Pinned catalog

- **Las líneas fijas siguen al Shown language.** Las líneas fijas del Catalog son la línea de compartir, "Aroma/flavor", "Price per gram", la línea "From … each" del Bulk price y la línea vacía "Nothing to offer for now." (catalog.md). Salen en el Shown language del Business, calculado en el momento en que corre cada salida: la pantalla del Catalog, Test it, Publish y el Upkeep (incluida la corrida del comienzo del día). En inglés son idénticas byte a byte a la base `en.baseline.json`.
- **El Catalog lee el idioma a través de su propio puerto.** El adaptador propio del Catalog sobre accounts es el único lugar donde lee el idioma de un Business, y el único lugar donde se le aplica el reemplazo forzado. El Upkeep lee el idioma en su propia sesión, después del commit que lo dispara.
- **Un idioma sin textos nunca frena el Catalog.** Si el Shown language no tiene ningún texto (se quitó su archivo de textos), la pantalla del Catalog, Test it, Publish y el Upkeep arman todos el Catalog completo con las líneas fijas en inglés. El Stored language queda como está, ningún error llega a quien vende y no se agrega ningún motivo nuevo de Out of date. El Upkeep sigue su regla habitual y edita solo cuando el texto difiere. Una vez que vuelven los textos, el próximo Upkeep, a más tardar la corrida del comienzo del día, restaura las líneas de ese idioma. Los clientes nunca quedan con precios viejos por falta de textos.
- Un cambio de idioma dispara el **Upkeep**. El Upkeep edita el Pinned catalog en el lugar solo cuando el texto del Catalog difiere del **Last published text** del bot y del chat del canal actuales, y nunca envía ni fija.
- Se envía como máximo una edición por cambio.
- No se envía nada cuando el idioma elegido es el que ya está guardado, cuando el texto sale idéntico o cuando el Business no tiene Pinned catalog.
- Una edición fallida muestra **Out of date** con el motivo que corresponda de la lista fija existente (ningún motivo nuevo), y el cambio de idioma sigue en pie.
- Un cambio de idioma no es un cambio de los **Bot settings**, así que no exige un nuevo **Test send**. Un Test send hecho antes de un cambio y un Publish después pueden diferir en el idioma; cada uno muestra el Catalog tal como está en su momento.
- **Forced language:** mientras el Operator lo tiene activado, la pantalla del Catalog, Test it, Publish y el Upkeep usan todos `en-XA`. Activarlo o desactivarlo no agrega ningún disparador propio: el próximo Upkeep lo toma, a más tardar la corrida del comienzo del día.

## Business nuevo

- Un Business abierto con una **Invitation** de Business nuevo arranca en el idioma del teléfono que la acepta (`Accept-Language`), entre los Selectable languages, o en inglés cuando ninguno coincide.
- Esta es la única vez que se lee el idioma del teléfono. Después solo cuenta el Stored language.
- Un Business al que alguien se suma con una Invitation conserva su propio idioma.
- **Valores por defecto en el Stored language:** el Business nuevo se abre con el Catalog header and footer por defecto y las cuatro Expense categories por defecto en su Stored language, tomados a través del puerto `BusinessDefaults` (catalog.md, expenses.md).
  - Se guardan como datos propios del Business. Un cambio de idioma posterior nunca los reescribe, y quien vende los edita en Settings como antes.
  - Siguen al Stored language, nunca al Shown language, así que nunca se escriben en `en-XA`, ni siquiera mientras el Forced language está activado.
  - Cualquier valor por defecto que falte en ese idioma se escribe en inglés. La apertura nunca falla por falta de textos.
  - En inglés son idénticos byte a byte a la base.
  - Los Businesses que existían antes de que los valores por defecto siguieran al idioma conservan lo que guardaron, sin carga retroactiva.

## Aislamiento y export

- El Business siempre sale de la **Session**. Ninguna solicitud nombra un Business, y ninguna respuesta revela el idioma de otro Business ni que existe.
- La ruta que cambia el idioma está protegida por la Session y forma parte de los controles de aislamiento entre Businesses.
- El Stored language forma parte del **Business export**.

## Métricas

La instalación corre localmente sin telemetría. Cada métrica es una cifra que afirman los tests.

- **Inglés conservado:** Businesses existentes con `en` guardado de forma explícita después de la migración: 100%. Filas sin Stored language: 0.
- **Cambio en una acción:** acciones del User desde elegir un idioma en Settings → Business hasta que el cambio queda guardado: 1, sin paso de guardar.
- **Catalog en silencio:** envíos o fijaciones nuevos causados por un cambio de idioma: 0. Ediciones en el lugar por cambio de idioma: como máximo 1. Ediciones ante una elección sin cambios o un texto idéntico: 0. Cambios de idioma deshechos por una edición fallida: 0.
- **Teléfono leído una vez:** Businesses nuevos cuyo Stored language coincide con la mejor coincidencia seleccionable del teléfono que acepta, o inglés sin coincidencia: 100%. Lecturas del idioma del teléfono fuera de la aceptación de una Invitation de Business nuevo: 0.
- **Test locale inalcanzable:** solicitudes aceptadas que guardan `en-XA`: 0.
- **El Catalog sigue al idioma:** con un `de` de prueba (`selectable_languages=("en","de")`), un Business guardado como `de` recibe las líneas fijas de `de` desde `GET /catalog`, Test it, Publish y la corrida del comienzo del día; un Business `en` en la misma corrida es idéntico byte a byte a la base. Un cambio de `en` a `de` en un Business con Pinned catalog da exactamente 1 edición con las líneas de `de`. 100% pasando.
- **Los textos faltantes caen al inglés:** un Business cuyo Stored language no tiene archivo de textos recibe el Catalog completo con las líneas fijas en inglés desde `GET /catalog`, Test it, Publish y el Upkeep, y un Business nuevo abierto en él recibe los valores por defecto en inglés. Salidas fallidas, cambios de estado a Out of date o Stored languages cambiados por los textos faltantes: 0.
- **Los valores por defecto siguen al Stored language:** un Business abierto en `de` guarda el Catalog header and footer y las cuatro categorías de `de`; después de un cambio de idioma quedan sin cambios; Businesses abiertos bajo el `en-XA` forzado con valores por defecto en `en-XA`: 0; filas cambiadas en Businesses existentes: 0.
- **Ningún inglés sobrante:** bajo el `en-XA` forzado, el texto del Catalog, el texto vacío del Pinned catalog y los valores por defecto armados desde su fuente dejan 0 letras después de quitar los segmentos `⟦…⟧`, los datos guardados y los tokens de dinero y gramos; un literal plantado hace fallar el control.
- **El actual nunca desaparece:** con `de` de prueba guardado y quitado de los seleccionables, el control lo marca como actual, sin poder tocarlo, y ofrece solo los seleccionables; con una etiqueta que la app no sabe nombrar, el control muestra esa etiqueta como actual en texto plano, sin rol ni `aria-pressed`, y nunca la ofrece. Controles sin actual mientras hay un Stored language: 0.
