# Product language

El único idioma en que escribe el producto: inglés. Abarca cada palabra que el producto mismo escribe para que la lea una persona: pantallas, estados, nombres accesibles, mensajes de la API dirigidos a una persona, las líneas que imprimen los scripts del **Operator**, las palabras propias del informe de la **Spreadsheet import** y las líneas fijas del **Catalog** de Telegram. Todo texto del front vive en un solo módulo con claves, el **Copy module**. No cambia ningún comportamiento de ninguna capacidad: pantallas, flujos, rutas, reglas y formatos quedan como los definen sus dueños. Reemplaza la regla de español rioplatense que antes establecían BRIEF.md y la sección de idioma y formatos de accounts.md. Los docs de capacidades y los archivos de diseño nombran cada pantalla, grupo, control y mensaje con ese mismo inglés, así que cada cosa tiene un solo nombre.

El Product language no es el idioma de la documentación. La documentación funcional y técnica (`docs/product/` y las definiciones de `CONTEXT.md` incluidas) se escribe en español rioplatense, con identificadores, nombres de clases y nombres UML en inglés: es la **Documentation language**. Que los docs estén en español no cambia ninguna palabra que muestre la app.

## Jobs

**Cuando** manejo mi negocio desde la app (en el celular entre pedidos, leyendo lo que me dice un rechazo o una confirmación, o revisando el Catalog que mi bot fija para los clientes), **quiero** que cada palabra que leemos yo o mis clientes esté en inglés, **para** trabajar en el único idioma del producto y no cruzarme nunca con una oración en otro.

**Cuando** decido reformular un texto o, más adelante, agregar un idioma, **quiero** que cada texto que lee una persona viva en un solo lugar con claves, **para** que el cambio se haga una vez y nunca haya que buscarlo pantalla por pantalla.

**Cuando** leo un doc de capacidad o abro un archivo de diseño para construir, probar o revisar una pantalla, **quiero** que cada pantalla, grupo, control y mensaje se nombre con el inglés exacto que muestra la app (la palabra `_In the app_` del glosario o el string del Copy module), **para** encontrarlo por lo que veo en pantalla y no tener que traducirlo ni decidir cuál de dos nombres gana.

**Cuando** el PM, un agente del sistema de desarrollo o yo abrimos un archivo de capacidad o el glosario para leerlo o cambiarlo, **quiero** todo `docs/product/` y las definiciones de `CONTEXT.md` en un solo idioma, español rioplatense, con cada identificador, ruta, nombre de campo, valor de enum, clave de copy, término del glosario, palabra de pantalla y link tal como está, **para** que el texto en español escrito desde agentic-system #399 caiga en archivos que ya están en español y no se rompa nada de lo que lee el tooling.

**Cuando** yo (el dueño, o el PM o un agente que trabaja para mí) necesito comprobar lo que el producto decide sobre ventas, pagos, clientes o el **Sale bill**, **quiero** leer `sales.md`, `payments.md`, `customers.md` y `sale-bill.md` en español rioplatense, con los términos del glosario, los identificadores y las palabras de pantalla exactamente como están, **para** decidir o verificar una regla sin traducir mentalmente y sin una traducción que cambie lo que la regla dice. (Afina el cuarto job para los archivos donde se definen las ventas, las deudas y los pagos, GH-463 parte 2; no es un trabajo nuevo).

- La protagonista del primer job es la vendedora o el vendedor, en los mismos momentos que en cualquier otra capacidad. El protagonista del segundo es el dueño y mantenedor (Zeta).
- Los lectores principales del tercero son el mantenedor o el agente que construye y prueba una pantalla a partir de su doc de capacidad, incluido el agente que escribe tests (un test que busca un nombre en español falla contra la app en inglés). Le sigue quien revisa y compara un archivo de diseño con la app construida, sobre todo mediante la **Design capture**. Quienes venden no leen los docs.
- Los lectores del cuarto son el PM y los agentes que leen y escriben los docs; el dueño también los lee. Cambia solo el idioma de la documentación: el Product language sigue en inglés.
- El lector principal del quinto es el dueño, que decide a partir de esos archivos; le sigue el sistema agéntico, que depende de que los términos en inglés y las citas queden exactos porque el código, los tests y los ADRs apuntan a ellos. Antes, esos cuatro archivos eran justo donde el dueño se cruzaba con docs en dos idiomas, o con términos del glosario puestos en español, en el núcleo del problema de la planilla.
- Antes de este cambio, todo el producto hablaba español rioplatense con voseo. Ningún vendedor lo esquivaba; el paso al inglés es una decisión de producto, así que el alcance es una versión fiel en inglés de cada texto existente, sin reformular.
- No promete nada, ni a favor ni en contra, sobre una vuelta del español en la app; solo garantiza que agregar un idioma más adelante sea un cambio en un solo lugar.

Criterios de éxito:

1. **Nada de español en la app.** Una persona no encuentra ninguna palabra ni ninguna ruta en español en ninguno de estos lugares:
   - cada pantalla y estado (vacío, cargando, error, rechazo, confirmación, toast, aviso), en celular y en computadora;
   - cada nombre accesible;
   - cada mensaje de la API dirigido a una persona;
   - cada línea fija de los mensajes del bot;
   - cada línea que imprimen los scripts del Operator.
2. **Formatos sin cambios.** `$ 11.000` y `−$ 4.500` en la app; `$11.000` y `2,5 g` en el Catalog; `dd/mm`; `3,5 g`. Solo cambian las palabras.
3. **Mismo comportamiento, mismo significado.**
   - Pantallas, flujos, acciones, rutas, presupuestos de toques y reglas no cambian.
   - Cada texto es una versión fiel en inglés de su original, con los mismos datos.
   - Los textos de seguridad (el mensaje del **Login brake**, los textos de link muerto, el aviso de registro que ya no existe) no revelan nada nuevo.
   - Ningún estado se comunica solo por color, y los límites de largo del **Icon and text rule** se cumplen.
4. **Un solo lugar para las palabras.** Cada texto que muestra el front, nombres accesibles incluidos, vive en el Copy module, y ninguna pantalla tiene un texto propio. No hay biblioteca de traducción ni selector de idioma.
5. **Los datos de quien vende no se tocan.** Nada de lo que tipeó quien vende ni de lo que guardó el **Business** se reescribe.
6. **Docs y archivos de diseño nombran las cosas como la app.**
   - Una búsqueda de revisión en los docs de capacidades no encuentra ningún nombre en español para una pantalla, grupo, control o mensaje.
   - Ningún archivo de diseño muestra una etiqueta de producto en español.
   - Ningún doc tiene una nota de precedencia que diga cuál de dos nombres gana.
   - Cada nombre en inglés que usa un doc remite a un término del glosario o a una clave de copy.
7. **Documentación en español.** Cada archivo de `docs/product/` (salvo los archivos de tokens de `docs/product/design-system/` y el código) y cada definición de `CONTEXT.md` se leen en español. Los identificadores, rutas, campos, valores de enum, claves de copy, nombres de clases, nombres UML, términos del glosario, palabras de pantalla y citas de ADR siguen en inglés, sin que cambie el significado de ninguna regla, cifra, límite, ejemplo ni decisión.

## Comportamiento

### Qué cambia

- **Texto que escribe el producto**:
  - textos del front y nombres accesibles (por ejemplo, "Cobrar a <name>" pasa a ser "Collect from <name>", y sigue nombrando al **Customer**);
  - los mensajes de la API dirigidos a una persona;
  - las líneas que imprimen los scripts del Operator y las palabras propias del informe de la Spreadsheet import;
  - las líneas fijas del Catalog (etiquetas de línea, la línea de Catalog vacío);
  - los motivos de "Test it" (**Test send**) y de "Find my chat" (**Own chat lookup**).
- **Fiel, sin reformular.** Ningún mensaje gana ni pierde información. El inglés no tiene voseo, así que el registro es un inglés llano en segunda persona.
- **Idioma del documento HTML.** `<html lang="en">`, y el `lang` del manifest es `"en"`. El `id` y el `scope` del manifest no cambian nunca (accounts.md).

### Qué no cambia nunca

- **Datos de quien vende**: los nombres de cada **Variety**, Customer y **Expense category**, la **Note**, el **Aroma**, el emoji y el **Catalog header and footer** que guardó un Business.
  - Cada Business existente conserva todo lo guardado, incluidos los valores por defecto en español que recibió.
  - No se migra nada.
- **Datos de ejemplo y de fixtures** (los nombres y cifras del Business de ejemplo): son datos de quien vende y quedan como están.
- **Formatos**: todos los formatos numéricos y de fecha, en la app y en el Catalog.
- **Redirecciones heredadas**: cada redirección heredada en español (ADR-0024, ADR-0033, `app/legacy_front_paths.json`) funciona exactamente como hoy, sin agregar ni quitar ninguna fila.

### Valores por defecto de un Business abierto después de este cambio

- **Expense category**: "Growing supplies", "Packaging", "Shipping and transport", "Other".
- **Catalog header and footer**: "🌿 **CATALOG** 🌿" al principio y "📩 Questions and orders by private message." al final.
- El emoji y los marcadores `**` se conservan como antes.

### Telegram

- El bot no tiene comandos ni reconoce palabras clave, así que nada necesita un alias.
- Cuando nada califica, el **Pinned catalog** muestra su Catalog header and footer con "Nothing to offer for now." en el medio.
- **Nada de lo ya publicado se reescribe en lote.** Un Pinned catalog ya publicado toma las líneas fijas en inglés en su próximo disparo de **Upkeep**, a más tardar en el control del siguiente día de Argentina. Es la edición en el lugar de siempre, nunca un mensaje nuevo (pinned-catalog.md).
- Un Catalog header and footer guardado en español puede quedar junto a las líneas fijas en inglés hasta que quien vende lo edite. Es intencional.

### Spreadsheet import

- Reconoce la planilla en español exactamente como hoy: nombres de pestañas, títulos de columna y valores de celda como "Compra", "Efectivo", "Pendiente", "Amigo", "Regalo" y "Sí"/"No" de la planilla, y los textos de **Unfinished row**.
- Solo las palabras propias del informe están en inglés. Los textos de la planilla que cita quedan como los escribió la planilla.
- Cada Expense category coincide por nombre como hoy, así que las categorías en español de una planilla se crean como Expense category junto a los valores por defecto en inglés de un Business nuevo. Esos valores por defecto se pueden quitar mientras no tengan ningún **Expense**.

### Palabras y formatos juntos

- Las palabras pasan al inglés: "Today 03/10", "Yesterday", los nombres de días y meses, "since dd/mm".
- Todos los formatos numéricos y de fecha se mantienen. Los rangos conservan su forma ("28/09 – 04/10").
- Palabras en inglés con formatos argentinos es lo buscado, no un defecto.

### Rutas

- Las rutas que la app muestra, enlaza o a las que navega están en inglés, `scripts/design/screens.json` incluido.
- "Ninguna ruta en español" nunca se aplica a las redirecciones heredadas.

### Vocabulario

- La línea `_In the app_` de cada término del glosario es la palabra en inglés que se ve en pantalla, a partir del término en inglés del glosario.
- Donde ese término se lee como código, se usa en su lugar una palabra llana en inglés. Las elecciones quedan listadas para que Zeta las reformule más adelante en un solo lugar.
- Las líneas `_Avoid_` siguen siendo una guía para el código y los docs.

### Encaje, largo y seguridad

- **Los textos de seguridad** dicen lo que decían: sin cantidad de intentos, causa, id, nombre ni fecha.
- **Los límites de largo** (icon-and-text-rule.md) se cumplen con el copy en inglés.
- **Encaje:**
  - las etiquetas en inglés entran en sus objetivos táctiles de 44 px;
  - la barra entra en 320 px con el texto al 130 %;
  - ninguna pantalla se desplaza en horizontal en anchos de celular;
  - las listas de excepciones del **Mobile check** solo pueden achicarse.

### Docs

- BRIEF.md dice: "Interface in English; code in English; functional and technical documentation in Spanish (identifiers, class names and UML names in English)."
- La convención `_In the app_` de CONTEXT.md nombra la palabra en inglés que se ve en pantalla. Las definiciones de CONTEXT.md están en español; los términos, `_In the app_`, `_Avoid_` y sus valores, en inglés.
- La regla de idioma de accounts.md remite a este archivo.
- El README del design-system dice que el inglés es el idioma de la app. Los dibujos de `pantallas/` llevan el texto de producto en inglés de la app; solo las anotaciones que describen un dibujo pueden quedar en español.
- Un string citado en un doc de capacidad sigue al Copy module, en el mismo diff que su código.

### Cómo nombran las cosas los docs y los archivos de diseño

- **El nombre es lo que muestra la app.** Un doc de capacidad nombra cada pantalla, grupo, control y mensaje con la palabra `_In the app_` del glosario o con el string exacto de `web/src/copy/`, carácter por carácter, entre comillas, dentro de la prosa en español.
- **Glosario y copy difieren.** El doc usa el string de copy de la pantalla que describe, sin nota. Los dos pueden ser correctos en pantallas distintas ("Owes you", "Account / Owes").
- **Sin notas de precedencia.** Ningún doc dice cuál de dos nombres gana; hay uno solo.
- **Nada que la app no muestre.** Si un nombre no tiene palabra del glosario ni clave de copy, la app no lo muestra. El doc describe la cosa en español llano, con los términos del glosario, y no cita ninguna etiqueta. Una etiqueta de ese tipo en un archivo de diseño es una anotación, no texto de producto.
- **Términos del glosario en la prosa.** Toda oración que establece una regla, cifra, límite o decisión sobre un concepto del glosario usa el término en inglés tal como está escrito, en **negrita** en su primera mención en cada archivo y sin formato después. En la narración (jobs, ejemplos, la descripción de quien vende) solo se admiten los sustantivos negocio (Business), cliente (Customer), venta (Sale), pago (Payment), variedad (Variety) y stock (Stock), cada uno para su único término, y "precio" como palabra corriente, nunca por un término de precio en particular. No se usa ninguna otra versión en español de un término ni ninguna palabra de una lista `_Avoid_`. Las palabras corrientes que no nombran un concepto del glosario tal como está definido (pantalla, planilla, ruta, idioma en el sentido de una lengua) se traducen con normalidad.
- **Archivos que ya estaban en español.** Un doc de capacidad escrito en español antes de que existiera la regla de términos del glosario se pone en regla sin cambiar su significado: cada versión en español de un concepto del glosario pasa a su término en inglés, y ningún encabezado lleva inglés entre paréntesis (un encabezado puede ser el término del glosario solo).
- **Texto de producto en los archivos de diseño.** Una etiqueta de un archivo de diseño es texto de producto cuando la app construida la muestra, y es el inglés de la app. Las anotaciones que describen un dibujo, la prosa del README de diseño y `dominio.ts` pueden quedar en español.
- **Ids del registro.** La prosa nombra una pantalla en inglés ("el grupo Prices de Settings"). Un id del registro (`ConfiguracionPrecios`, `NegocioNuevo`, `Invitacion`…) aparece en formato de código solo donde la oración apunta a un archivo de diseño o a una fila del registro. Los ids no cambian nunca.
- **Nombres de la planilla.** Los nombres propios de la planilla (Ajustes, Catálogo, Ventas, Entradas, Gastos, Revisar…) quedan como los escribe la planilla en `import.md`. Cada uno se marca siempre como de la planilla ("la pestaña Ventas de la planilla"), y ninguno se glosa con una palabra de la app: Ajustes tenía los precios y no es la **Settings** de la app.
- **Lo que queda en inglés en los docs.** Los encabezados `## Jobs`; los encabezados que cita un ADR; los términos del glosario, `_In the app_`, `_Avoid_` y sus valores; las palabras de pantalla y los strings de copy citados; identificadores, rutas, campos, valores de enum, claves de copy, nombres de clases y nombres UML; cada cita de ADR (`ADR-NNNN`, rutas `docs/adr/NNNN…`), copiada byte por byte; y las oraciones que no se pudieron traducir sin cambiar lo que deciden, listadas en el PR que las dejó.
- **Citas de encabezados.** Cuando un encabezado traducido se cita por su nombre en el código, los tests, los scripts u otro doc, cada cita pasa al texto nuevo exacto en el mismo diff. Una cita cuyo texto ya no existe se deja como está y se lista en el PR; nunca se recrea un encabezado para que coincida.

## Métricas

No hay telemetría. Se leen de los tests y de la revisión.

- **Nada de español en la app (criterio 1).**
  - Un guard falla ante un literal visible para el usuario fuera del Copy module y ante cualquier string en español conocido.
  - Un barrido de los rechazos de la API y de la salida de los scripts del Operator no encuentra español.
  - Las líneas fijas del bot se verifican en inglés con el adaptador falso.
  - Un recorrido de cada pantalla del registro, en celular y computadora y en los dos temas, no encuentra español.
  - Objetivo: 0 textos en español y 0 rutas en español.
- **Formatos (criterio 2).** Los tests de formato existentes pasan sin cambios.
- **Mismo comportamiento (criterio 3).**
  - Las suites pasan, con cambios limitados a textos y búsquedas por texto.
  - No se quita ni se afloja ninguna aserción de comportamiento.
  - Los presupuestos de toques y la tabla de redirecciones no cambian.
  - Los textos de seguridad se revisan por lo que revelan.
  - Las listas de excepciones solo se achican.
- **Un solo lugar (criterio 4).** El guard, más un test de que cada texto y cada nombre accesible se resuelve por clave.
- **Datos de quien vende (criterio 5).**
  - Los nombres, cada Note, el Catalog header and footer y cada Expense category guardados de un Business existente son idénticos antes y después.
  - Un Business nuevo recibe los valores por defecto en inglés.
  - Los fixtures de la Spreadsheet import con la planilla en español cargan como antes.
- **Docs y archivos de diseño (criterio 6).** Un paso de revisión, no un control del **Gate**.
  - Una búsqueda de revisión en `docs/product/*.md` y en los docs del design-system (salvo la prosa del README), con las palabras _Avoid_ del glosario y las palabras de pantalla en español conocidas, solo deja las clases permitidas. Objetivo: 0 nombres en español de una pantalla, grupo, control o mensaje.
  - Una búsqueda en `pantallas/*.dc.html` encuentra 0 etiquetas de producto en español.
  - Una búsqueda en los docs encuentra 0 notas de precedencia.
  - Cada nombre en inglés tiene un término del glosario o una clave de copy en la columna de origen del inventario del renombre. Los nombres sin origen se listan como hallazgos y nunca se inventan.
  - Los controles de diseño siguen en verde: `assertScreens`, la captura estricta completa del registro, `pytest tests/design` y vitest `src/design`.
- **Documentation language (criterio 7).** Un paso de revisión, más los tests existentes.
  - Oraciones de prosa en inglés en `docs/product/*.md` y en las definiciones de `CONTEXT.md` fuera de las clases que quedan en inglés. Objetivo: 0, salvo las listadas en el PR.
  - Spans en formato de código, rutas, valores de `_In the app_` y citas de ADR cambiados por la traducción. Objetivo: 0.
  - `tests/test_adr_numbers.py`, que lee cada `docs/**/*.md`, sigue en verde sin editarlo.
  - `## Jobs` presente y literal en cada archivo de capacidad: 24 de 24.
  - `lychee --offline`: 0 links rotos.
  - Oraciones que establecen una regla, cifra, límite o decisión y nombran un concepto del glosario con una palabra en español. Objetivo: 0.
  - Diferencias de significado halladas al comparar cada archivo con su versión anterior: 0.
  - Por cada archivo traducido o puesto en regla, el PR pega la comparación con su versión anterior: spans idénticos (backticks, destinos de links, `## Jobs`, términos en negrita y palabras de pantalla citadas; en un archivo que ya estaba en español, solo cambian los términos en negrita que pasan de una versión en español a su término en inglés, listados), el multiconjunto de dígitos, los conteos de estructura y cada coincidencia de la lista de palabras prohibidas con su resolución. Objetivo: 0 diferencias sin explicar.
  - Citas de encabezados traducidos que no apuntan al texto nuevo exacto después del cambio, según `rg`. Objetivo: 0; las citas viejas se listan en el PR.
- **Pinned catalog.** Un Business publicado cuyo texto cambia solo en sus líneas fijas recibe una edición en el lugar y ningún mensaje nuevo.
- **Medida de negocio.** Textos en español a los que llega una persona en la app: meta 0. Textos en español hallados después del merge: meta 0. Nombres de pantalla en español con los que se cruza quien lee un doc de capacidad: meta 0. Archivos de `docs/product/` con prosa mezclada entre inglés y español: meta 0.

## Fuera de alcance

- Traducciones de la app; un selector de idioma; una biblioteca de traducción.
- Reformular más allá de una versión fiel en inglés.
- Migrar los valores por defecto guardados, el Catalog header and footer guardado o los mensajes ya publicados.
- Cambiar lo que la Spreadsheet import reconoce en la planilla.
- Agregar o quitar redirecciones heredadas.
- Cambiar cualquier formato, ruta, regla o comportamiento de una capacidad.
- Un control del Gate para texto en español en la app desde los docs o los archivos de diseño, o para el idioma de los docs.
- Renombrar ids del registro.
- Traducir los ADRs existentes, que quedan como fueron escritos.
- Recrear un encabezado para que coincida con una cita vieja de un ADR.
