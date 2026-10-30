# Varieties

Las Varieties que vende un **Business** y el historial de precios de cada una, que ve solo ese Business (ADR-0004). Toda otra capacidad lee los precios de acá: una **Sale** toma el **Current price** de su día, y el **Catalog** muestra el de hoy.

Varieties es la única pantalla de una **Variety**. Su lista y la página de cada Variety reúnen:
- los precios de la Variety (acá);
- su **Stock**, sus **Stock entry**, sus **Stock withdrawal** y su **Low-stock threshold** (`stock.md`);
- sus **Catalog attributes** (`catalog.md`).

Qué campos de precio muestra y guarda una **Price entry** sigue los **Pricing settings** del Business (pricing-settings.md). Varieties es una pestaña (navigation.md). Reemplazó a la antigua pestaña Stock, a la vieja pantalla Catalog y a las viejas pantallas de Varieties; sus rutas redirigen (navigation.md). También cubre el final de la vida de una Variety: una Variety sin **Variety history** se puede eliminar, y una con historial se puede archivar y restaurar más adelante, sin que se mueva ninguna cifra pasada.

## Jobs

**Cuando** empiezo a vender una variedad nueva o cambio lo que cobro, **quiero** registrar la variedad una sola vez y cada precio con la fecha desde la que rige, **para** cobrar el precio correcto cualquier día sin acordarme de cuándo cambió.

**Cuando** un precio cambia en mitad del día y estoy con el celular entre pedidos o en medio de un chat con un cliente, **quiero** registrar el precio nuevo y el día desde el que rige en un formulario corto que se lea en pesos y arranque en hoy, sin salir de la variedad que estaba mirando, **para** volver con el cliente seguro de que rige el precio correcto, sin dudar del monto ni de la fecha.

Este afina el job de arriba para el celular y la computadora (en la computadora, la página de la Variety queda detrás del formulario); no es un job nuevo. Su situación secundaria es el paso 1 del **Onboarding**, que comparte los campos de precio (onboarding.md). Antes, la computadora abría el formulario de precio como una página propia, los montos no llevaban "$" y la fecha era un campo de fecha nativo.

**Cuando** cambio un mensaje o el marco de una pantalla, **quiero** que cada mensaje compartido viva en un solo lugar y que la regla del marco se pruebe con un test de lo que muestra la pantalla, **para** no arreglar nunca un mensaje en una pantalla y dejarlo viejo en otra, y no publicar nunca sin notarlo una tarjeta que muestre "+ New sale".

Su protagonista es quien mantiene la app, o quien revisa en su nombre, al estilo del job del mantenedor de accounts.md; quien vende se ve afectado solo de forma indirecta. Lo sirven acá la única fuente de "Check the grams entered" y "Price saved", y el test del marco que pide la métrica del marco de navigation.md. No cambia ningún comportamiento de la app.

**Cuando** configuro cómo pone precios mi negocio, registro el precio de una variedad o entrego un pedido, **quiero** que la app use solo las Pricing rules que tiene mi negocio (un Bulk price si vendo por cantidad, y un VIP price que fijo por variedad si tengo VIP customers), **para** cobrarle a cada cliente exactamente lo que quiero sin tipear un Special price a mano, sin ver campos que no me corresponden y sin que el precio de nadie cambie por sorpresa. (Lo sirven acá el VIP price de la Price entry y los campos de precio que siguen los interruptores; se define en pricing-settings.md.)

**Cuando** manejo mi negocio desde el celular, **quiero** mantener mis precios al día desde el celular, **para** dejar de llevarlos en la planilla y tener datos reales cuando lleguen las ventas.

**Cuando** compro, cosecho o cuento flor, **quiero** registrarlo desde el celular en pocos toques, **para** saber qué tengo de cada variedad, ver que una se está acabando antes de que un cliente la pida y saber cuánto me costaron los gramos que vendo o regalo. (Lo sirven acá el estado de la lista, la página de la Variety, su aviso de Stock bajo y "+ Stock entry"; se define en `stock.md`.)

**Cuando** saco gramos de mi propio stock sin venderlos (para compartirlos en una fiesta y que la gente conozca el negocio, o para consumo propio), **quiero** registrarlos desde el celular en pocos toques (fecha, variedades y gramos, el motivo), **para** mantener el stock correcto y ver en Profit cuánto me costó promocionar el negocio y mi propio consumo, sin registrar una venta que nadie hizo ni un Adjustment que se lea como flor perdida. (Lo sirven acá "Take from stock" en la lista y en la página de una Variety, y los Stock withdrawals de su "Stock y entradas"; se define en `stock.md`.)

**Cuando** manejo mi negocio desde el celular entre pedidos o en medio de un chat con un cliente, varias veces al día, **quiero** la app organizada según lo que de verdad hago y cada cuánto, con todo lo de una variedad en un solo lugar, **para** volver con el cliente en vez de buscar entre menús, y no preguntarme nunca cuál de varias pantallas tiene lo que necesito. (El job de navegación, navigation.md.)

**Cuando** estoy atendiendo a un cliente con el celular en la mano, **quiero** que la app se comporte como una app de celular (un formulario que llena la pantalla con su acción principal bajo el pulgar, y nada que necesite escondido detrás del teclado), **para** registrar un precio o editar una variedad sin pelearme con la pantalla ni perder lo que tipeé. (El job del diseño en el celular, navigation.md, GH-319: lo sirven acá el formulario de precio, New variety y los formularios de renombre, de aviso de Stock bajo y de Catalog attributes de una Variety, dibujados en el celular por el único `Sheet` compartido.)

**Cuando** un cliente me pregunta qué tengo o cuánto cuesta algo, o entra flor, se acaba o cambia de precio, **quiero** abrir una variedad y encontrar todo sobre ella en su propia página (su stock y sus Stock entries, sus precios, su aviso de Stock bajo y cómo se muestra en el Catalog), que la lista me diga de un vistazo qué tengo, qué se está acabando y qué no puedo vender, y tener el Catalog de hoy a un toque de esa lista, listo para compartir desde el celular, **para** contestarle al cliente, registrar lo que entró y mandar un Catalog al día sin moverme entre pantallas, y que mis clientes nunca reciban un precio viejo ni una variedad que no puedo vender.

Este es el job de navegación aplicado a las variedades, el stock y el Catalog, no un
job nuevo; su situación principal es en medio de un chat, entre pedidos. Los jobs de stock y de Catalog siguen
en `stock.md` y `catalog.md`; la computadora es el mismo job en dos paneles.

**Cuando** una variedad que cargué por error, o una con la que ya no trabajo, sigue apareciendo en mis
listas y selectores, **quiero** sacarla desde el celular en pocos toques, eliminándola si
nunca se movió y archivándola si tiene historial, **para** que mis listas muestren solo lo que todavía
vendo, que no cambie ninguna cifra pasada de ventas, stock, costo ni Profit, y poder traerla de vuelta exactamente
como estaba si vuelvo a venderla.

Este es el job de variedades y de navegación aplicado al final de la vida de una variedad,
no un job nuevo. Antes, quien vendía solo podía ocultar esa variedad del Catalog y
convivir con ella en las listas, renombrarla a algo como "NO USAR" o dejarla agotada.

**Cuando** abro una variedad que archivé, desde Archived, para ver qué era o para traerla
de vuelta, **quiero** que su página se lea de un vistazo como archivada y de solo lectura, con todo lo que
tenía (resumen, marca de oculta, precios, stock y movimientos, aviso de Stock bajo, Catalog
attributes) todavía a la vista y Restore como su única acción segura, **para** decidir si
la traigo de vuelta e irme sabiendo que no cambié nada por accidente. Y cuando elimino una
variedad que nunca se movió, la eliminación se ve como lo que es: permanente.

Este afina el job del final de la vida de arriba para la página archivada y la eliminación de la página activa;
no es un job nuevo. Su público secundario es quien revisa en nombre del mantenedor
(design-capture.md), que aprueba la página archivada y Archived a partir de dibujos y
capturas de antes y después, no leyendo código. Antes, la página archivada dejaba afuera "Hidden",
el aviso de Stock bajo y los Catalog attributes, mostraba "Archived" con el mismo estilo que "Hidden" junto a
una marca de estado activa, se convertía en la Variety activa en el lugar al tocar Restore, y no tenía dibujo,
fila del registro ni Variety sembrada con la cual compararla.

Criterios de éxito:

1. Preguntar el precio de una Variety en un día responde la Price entry vigente ese día: la última
   con fecha de vigencia en ese día o antes. Un día anterior a la primera Price entry no tiene precio.
2. Un cambio de precio nunca reescribe el pasado: es una Price entry nueva desde su propia fecha. Un error de tipeo
   se corrige eliminando la Price entry equivocada, y vuelve a regir la anterior (ADR-0003).
3. Dos Varieties de un Business nunca comparten nombre, sin importar mayúsculas, minúsculas ni espacios; dos
   Businesses pueden tener cada uno una Variety con el mismo nombre. Una **Archived variety** conserva su
   nombre.
4. Todo lo de acá, incluido eliminar una Price entry equivocada, se hace desde el celular sin ninguna llamada a la API
   a mano.
5. Varieties dice por sí sola, por forma y palabra y nunca solo por color, cuándo una Variety
   está agotada o por debajo de su umbral (`stock.md`, criterio 4). La línea de resumen
   nunca queda en blanco.
6. **Una variedad, una página**: el Stock de una Variety y sus movimientos (Stock entries y
   Stock withdrawals), precios, aviso de Stock bajo y
   Catalog attributes se ven y se editan desde su página, y desde ninguna otra pantalla. Toda
   edición ahí termina en un guardado explícito, así quien vende siempre sabe que un cambio quedó guardado.
7. **Dos toques como máximo**: desde cualquier **Tab root**, la pantalla del Catalog ("Send catalog") y
   el formulario de Stock entry ("+ Stock entry") se abren en 2 toques como máximo; una computadora nunca
   necesita más que el celular. Una Stock entry iniciada desde la página de una Variety tiene esa Variety
   elegida, con "Initial stock" preseleccionado solo cuando no tiene Stock entries.
8. **Nada perdido, nada inventado**: todo lo que quien vendía podía hacer en las antiguas pantallas Stock,
   Catalog y Varieties sigue al alcance; cada ruta vieja redirige
   de forma permanente; ningún link apunta a una pantalla que no existe.
9. **Fuera del camino en pocos toques**: desde la propia página de una Variety, en celular y computadora, quien
   vende la saca de toda lista y selector. La app ofrece Delete solo cuando la
   Variety no tiene historial, y Archive en el resto de los casos. Nunca ofrece una eliminación que va a ser
   rechazada.
10. **Los libros no se mueven**: después de archivar, cada Sale pasada y sus **Sale line**, cada cifra de Stock,
    **Cost of goods sold**, **Stock shortfall**, **Profit**, **Cash**, cifra de Analysis y **Balance** de
    Customer se lee exactamente igual que antes, al peso y al centésimo de gramo.
11. **Vuelve entera**: restaurar trae la Variety de vuelta con sus precios, Stock,
    Stock entries, Low-stock threshold, Catalog attributes y marca de **Hidden variety** intactos, y de vuelta en
    cada lista y selector en que califica.
12. **Decide el dominio**: la eliminación de una Variety con historial la rechaza el propio
    dominio, no solo la oculta la UI.
13. **Las Archived varieties se siguen encontrando**: quien vende siempre puede ver lo que archivó y
    restaurarlo.
14. **Nada nuevo en las reglas que ya rigen**: los Businesses siguen aislados (ADR-0004);
    cada estado se dice con palabra y forma, nunca solo con color, en los dos temas; los toasts
    no llevan datos.
15. **Solo se ven mis reglas, y cambiar de interruptor no pierde nada** (pricing-settings.md):
    - Con Bulk price desactivado, no se muestra ningún Bulk price ni **Bulk minimum** en el formulario de precio ni en la página de la Variety.
    - Con Customers VIP desactivado, no se muestra ningún VIP price.
    - Al volver a activarlos, se muestra otra vez cada Bulk price y VIP price guardado.
16. **El formulario de precio se ve como se diseñó**: coincide con `docs/product/design-system/pantallas/` en el celular y la computadora, en los dos temas:
    - en la computadora, un modal sobre la página de la Variety, nunca una página propia;
    - un "$" antes de cada monto en pesos (**List price**, Bulk price y VIP price; nunca el Bulk minimum);
    - la fecha de vigencia se muestra por defecto como un chip "Today".
17. **Un precio desde hoy en la menor cantidad de toques**: registrar un precio vigente desde hoy nunca exige abrir un selector de fecha. Elegir otra fecha sigue siendo posible.
18. **Un mensaje, una fuente**: cada mensaje que se muestra en más de una pantalla ("Check the grams entered" en los formularios de precio, de Stock entry y de Stock withdrawal) tiene una sola fuente, y también la tiene el toast "Price saved". Lo que lee quien vende no cambia en ningún lado.
19. **Se lee como archivada, nada oculto**: la página de una Archived variety dice "Archived" en
    palabras, y "Hidden" cuando la Variety está oculta. Muestra su resumen, precios, Stock y
    movimientos, aviso de Stock bajo y Catalog attributes, todo de solo lectura, sin ninguna acción salvo
    Restore. Ningún estado se dice solo por color, en ninguno de los dos temas. Restaurar sigue cumpliendo
    los criterios 10 y 11.
20. **El peso justo en cada acción**: "Delete variety" (una Variety activa sin
    historial) se dibuja como una acción destructiva; Restore se dibuja como una acción segura, sin
    confirmación.
21. **Aprobado con evidencia**: la página archivada y Archived tienen dibujos en
    `pantallas/` en celular y computadora, claro y oscuro; la app de ejemplo siembra una Archived
    variety; `scripts/design/screens.json` lista las dos páginas; las capturas de antes y después
    (ADR-0042) se adjuntan al PR con cada diferencia listada.

## Comportamiento

- **Variety**: un nombre, sin espacios al principio ni al final, con los espacios internos colapsados, de hasta 60 caracteres. Renombrarla conserva sus precios. Las Varieties se listan por nombre.
- **Price entry**: una fecha de vigencia y un List price por gramo en pesos enteros. Opcionalmente, también tiene:
  - un Bulk price por gramo con su Bulk minimum en gramos (hasta dos decimales). Los dos van juntos o ninguno, y el Bulk price es menor que el List price;
  - un **VIP price** por gramo, en pesos enteros, menor que el List price. Es independiente del Bulk price y del Bulk minimum (una Price entry puede tener cualquiera de los dos solo) y nunca se compara con el Bulk price.

  Todo monto es mayor que cero.
- **Un VIP price igual o mayor que el List price** se rechaza con su propio mensaje fijo y su propio código de rechazo (ADR-0008), que nunca repite el monto (ADR-0005).
- **Reglas desactivadas** (pricing-settings.md):
  - Una Price entry registrada mientras Bulk price está desactivado no guarda ningún Bulk price ni Bulk minimum, y una registrada mientras VIP customers está desactivado no guarda ningún VIP price, mande lo que mande el pedido. No se copia nada de una Price entry anterior.
  - Las Price entries anteriores conservan lo que guardaron.
  - Cuando se vuelve a activar una regla, el Current price no muestra línea de Bulk ni de VIP si su Price entry no la tiene; quien vende registra una Price entry nueva si quiere una.
- Una Price entry por Variety por fecha de vigencia; una segunda en la misma fecha se rechaza.
- **Sin ediciones**: una Price entry nunca se edita, su VIP price incluido. Una Price entry nueva la reemplaza desde su propia fecha (ADR-0003).
- **Eliminar una Price entry** (`DELETE /varieties/{id}/prices/{entry_id}`, ADR-0003): cualquier Price entry se puede eliminar, incluida la que rige hoy. Vuelve a regir la anterior.
- La representación propia de una Variety lleva su Current price de **hoy**, `null` cuando no tiene. Hoy es el día del negocio en hora de Argentina. Las respuestas llevan lo guardado, junto con los interruptores del Business; las pantallas ocultan lo desactivado.
- El historial de precios lista primero la Price entry más nueva.
- **Low-stock threshold**: gramos opcionales, mayores que cero, de hasta dos decimales, que se fijan o se desactivan por Variety. Desactivado significa que la Variety no tiene ninguno; no se conserva ningún monto anterior. Sus reglas y el **Stock status** están en `stock.md`.

### Eliminar y archivar una Variety

- **Historial**: la Variety history es cualquier Sale line de la Variety (los **Gift** y los **Special price**
  incluidos) o cualquier Stock entry de ella (de cualquier origen: **Purchase**, **Harvest**, **Opening stock** o un **Adjustment** de
  cualquiera de los dos signos), o cualquier línea de Stock withdrawal de ella (**Promotion** u **Own use**). Se calcula
  en el momento y nunca se guarda.
- **Qué no es historial**: las Price entries, el Low-stock threshold y los Catalog attributes. Una
  Variety eliminada se los lleva con ella.
- **El historial decide qué acción se ofrece**, calculado cuando se lee la página: Delete
  sin historial, Archive con historial. Solo Delete está protegido por el dominio.
- **Delete**: solo para una Variety sin historial. La Variety desaparece para siempre.
  - Una vez que quien vende elimina la última Sale o la última Stock entry de la Variety, Delete se vuelve a
    ofrecer.
  - Una eliminación con historial la rechaza el dominio con su propio rechazo con código en
    `contract.json` (ADR-0008), sin repetir ningún nombre ni monto (ADR-0005).
  - El control y la eliminación son una sola escritura protegida: una Sale o una Stock entry que un socio registra en
    el mismo momento o bien bloquea la eliminación o bien se rechaza como "That is gone". Nunca queda nada
    huérfano.
  - Una Variety que ya no existe responde 404 y sigue accounts.md: "That is gone. The list is up to date."
- **Archive**: se ofrece para una Variety con historial. Sale de toda lista y selector pero
  sigue en los libros.
  - Archive nunca se rechaza por tener o no tener historial. Si la última Sale o
    Stock entry de la Variety se eliminó después de que cargó la página, tocar "Archive variety" igual la archiva;
    se puede eliminar más adelante restaurándola primero. Una Archived variety también puede perder
    todo su historial mientras está archivada (si se elimina su última Stock entry o Sale); se aplica el mismo camino.
  - Archivar una Variety ya archivada no cambia nada; una que ya no existe responde "That is gone. The list is up to date."
  - Se permite con Stock mayor, igual o menor que cero, siempre después de una confirmación.
  - Archivar y restaurar nunca crean una Stock entry y nunca cambian el Stock, los **Lot**, el Cost
    of goods sold, el **Pending cost**, los precios ni ninguna otra cifra.
  - Archivar y ocultar son independientes: archivar conserva la marca de Hidden variety, y restaurar
    la devuelve como estaba.
  - Archivar y restaurar son disparadores del **Upkeep** del **Pinned catalog**
    (pinned-catalog.md).
- **Una Archived variety queda afuera de**:
  - la lista de Varieties y su línea de resumen;
  - What you have left de Home, y la regla "Start with your varieties" (results.md);
  - el selector de Variety de New sale (`sales.md`);
  - el selector de Variety del formulario de Stock entry (`stock.md`);
  - el formulario de Price entry;
  - el texto del Catalog y la lista "what does not go out" de la pantalla del Catalog (`catalog.md`);
  - el Pinned catalog.
- **Los registros pasados la conservan, por su nombre a secas, sin etiqueta "Archived" y sin ninguna cifra
  cambiada**: Sales y el detalle de una Sale, la cuenta del Customer, All entries,
  las filas de Variety de Analysis y cada cifra de semana, mes y desde el inicio, el
  Profit y el Cash de Results, y el **Business export** (que guarda la marca de archivada como un hecho
  guardado).
- **Los registros existentes siguen siendo manejables** (ADR-0009): una Stock entry de una Archived variety se puede
  editar o eliminar desde All entries; una Sale que contenga una se puede eliminar,
  Undo incluido; Assign customer sigue funcionando. Una edición de Stock entry puede conservar la Archived
  variety que ya tiene, pero nunca puede pasar la Stock entry a otra Archived variety distinta.
- **No se registra nada nuevo contra una Archived variety**: ninguna Sale line, Stock entry ni
  Price entry; esa referencia responde como inexistente. Un formulario que quedó abierto mientras un socio
  archiva la Variety se rechaza al guardar con la regla "That is gone" de accounts.md y
  conserva el resto de lo tipeado donde la pantalla lo permite. En New sale la línea muestra
  el mensaje genérico de inexistente y el formulario sigue abierto (la regla de sales.md para una Variety que no se
  encuentra).
- **Nombres**: una Archived variety mantiene su nombre reservado bajo la regla de unicidad (sin importar
  mayúsculas, minúsculas ni espacios).
  - Agregar o renombrar una Variety con ese nombre se rechaza en línea con su propio rechazo
    fijo: el nombre pertenece a una Archived variety, que se busque en Archived. No repite
    nada de lo tipeado.
  - Una Archived variety solo se puede renombrar después de restaurarla, así que restaurar nunca
    choca: Restore no tiene rechazo por choque de nombre ni estado de error propio. Su único
    otro resultado es el "That is gone." de accounts.md para una Variety que ya no existe.
  - El nombre de una Variety eliminada queda libre de inmediato.

### Rutas

- Las rutas son las de `scripts/design/screens.json`: `/varieties`,
  `/varieties/{low}`, `/varieties/catalog`, `/varieties/entries`,
  `/varieties/entries/new`, `/varieties/entries/{id}` (editar una Stock entry),
  `/varieties/{low}/entries` (el "See all" de Stock entries y Stock withdrawals de una Variety),
  `/varieties/{low}/prices`, `/varieties/{low}/prices/new`, `/varieties/new` y
  `/varieties/archived` (la tarjeta Archived). La página de una Archived variety es la misma
  `/varieties/{low}`, de solo lectura.
- Recargar cualquiera de ellas abre la pantalla, nunca la respuesta de la API (ADR-0024 y
  ADR-0033 rigen las rutas compartidas con la API).
- Las rutas viejas (`/variedades`, `/mi-stock`, `/mi-stock/nueva-entrada`,
  `/mi-stock/entradas/{id}`, `/catalogo` y toda otra ruta de las antiguas Stock, Varieties o
  Catalog) redirigen de forma permanente (navigation.md).

### En pantalla: la lista de Varieties (`Varieties`)

- **Un Tab root** (navigation.md). En una computadora son dos paneles: la lista a la izquierda y la
  página de la Variety seleccionada a la derecha.
  - **En una computadora**, abrir Varieties sin nada seleccionado selecciona automáticamente la primera
    Variety sin archivar por nombre, así siempre hay una cifra a la vista; esto no cuenta
    como toque, y elegir otra Variety la reemplaza. Sin Varieties, el panel derecho
    no tiene nada que pueda leerse como dato.
  - Archivar o eliminar la Variety seleccionada selecciona la siguiente por nombre, si no la
    anterior, si no el estado vacío.
  - **En el celular**, la lista es la pantalla; nunca abre una Variety por su cuenta.
  - Una Variety seleccionada que ya no existe sigue la regla "That is gone." de accounts.md.
- **Toda Variety sin archivar**, las ocultas incluidas, ordenadas por nombre, en un orden estable.
- **Cada fila**:
  - el nombre;
  - la marca de Stock status (`MarcaEstado`: cuadrado = agotada como el chip invertido, círculo
    lleno = bajo, círculo vacío = ok) y su palabra, con "no entries" cuando no tiene ninguna Stock entry,
    y su línea de detalle (`stock.md`);
  - "Hidden" junto al estado cuando la Variety está oculta del Catalog. Nunca
    reemplaza al Stock status: una Hidden variety se puede seguir vendiendo, regalando, retirando y
    reponiendo;
  - gramos y **Days left**;
  - el List price por gramo de hoy, o "No price: cannot be sold" cuando no tiene.
- **La línea de resumen**, arriba de la lista, que cuenta solo Varieties sin archivar:
  - sin ninguna Variety: no hay línea de resumen, y un estado vacío fijo invita a quien vende
    a agregar la primera Variety;
  - con todas las Varieties en ok: "N varieties · all ok";
  - si no: cada estado que no es ok, contado por palabra, en el orden de Stock status (p. ej. "1 no entries · 1 sold out · 1 low"). Nunca queda en blanco.
  - La redacción exacta es de diseño, siempre que cada estado se diga con palabra.
- **"Send catalog"** arriba, que abre la pantalla del Catalog (`catalog.md`). Está
  deshabilitado, con su motivo en palabras, solo mientras se muestra la **First-run checklist** y nada
  califica (navigation.md).
- **"+ Stock entry"**, un botón secundario arriba de la lista (no un botón flotante),
  que abre el formulario de Stock entry con la Variety por elegir (`stock.md`).
- **"Take from stock"**, un botón secundario junto a "+ Stock entry", en celular y
  computadora, que abre el formulario de Stock withdrawal sin ninguna Variety elegida (`stock.md`).
- **"New variety"**: agrega una Variety (un formulario; en el celular, una **Sheet** dibujada por el único `Sheet` compartido, sobre Varieties, según el Phone layout de navigation.md).
- **"All entries"** abajo de todo (`stock.md`), en `/varieties/entries`. Lista solo Stock entries.
- **"Archived (N)"** abajo de todo, junto a "All entries", que abre la tarjeta
  Archived. No se muestra cuando no hay ninguna.

### En pantalla: Archived

- **Una tarjeta** (navigation.md) en `/varieties/archived`: la barra o la barra lateral y
  "‹ Varieties", sin "+ New sale".
- Lista cada Archived variety por nombre. Cada fila marca "Archived" como un badge
  neutro (una palabra, sin que ningún color lleve el estado, en los dos temas) y "Hidden", en su
  propio estilo de texto al lado, cuando la Variety está oculta, así quien vende sabe qué va a traer
  de vuelta Restore. Cada fila lleva "Restore", ícono + texto, en un tamaño de acción de fila
  secundaria, con el mismo ícono y la misma palabra que el Restore de la página archivada.
- En una computadora usa los mismos dos paneles; abierta sin nada seleccionado, selecciona la
  primera Archived variety por nombre.
- **Restore** en una fila es un toque sin confirmación, muestra el toast "Variety restored", y la Variety vuelve a la lista de Varieties exactamente como estaba: marca de Hidden variety,
  precios, Stock, Stock entries, umbral y Catalog attributes.

### En pantalla: la página de una Variety (`VariedadDetalle`)

- **Un detalle** (navigation.md): la barra o la barra lateral y "‹ Varieties", sin
  "+ New sale".
- **La línea de resumen** arriba: gramos, estado, Days left y el List price de hoy (p. ej.
  "64 g · ok · 21 days · $ 11.000 x g"), con "Hidden" cuando está oculta.
- **Tres acciones**: "+ Entry" (el formulario de Stock entry con esta Variety elegida, y
  "Initial stock" preseleccionado solo cuando no tiene Stock entries, `stock.md`), "New price"
  (el formulario de Price entry) y "Take from stock" (el formulario de Stock withdrawal con esta
  Variety elegida, `stock.md`).
- **Secciones**:
  - **Stock and entries**: los últimos 3 movimientos de la Variety (sus Stock entries y los
    Stock withdrawals que la tocan, primero la fecha más nueva, después lo registrado más recientemente) y
    "See all", que abre `/varieties/{low}/entries`: la misma lista que "All
    entries", filtrada a esta Variety, con sus Stock withdrawals, donde cada Stock entry se puede
    editar o eliminar (`stock.md`). Una fila de Stock withdrawal muestra su fecha, "Promotion" u
    "Own use" y los gramos de esta Variety con signo menos, y abre el
    detalle del Stock withdrawal;
  - **Prices**: las últimas 3 Price entries con "Effective from", primero la más nueva, cada fila con
    su acción de eliminar, y "See all" (`/varieties/{low}/prices`) para el historial completo.
    - Cada fila muestra el List price.
    - Muestra el Bulk price y el Bulk minimum solo mientras Bulk price está activado, y el VIP price ("VIP price") solo mientras VIP customers está activado, cada uno solo cuando la Price entry lo tiene;
  - **Low stock warning**: el aviso actual, de solo lectura, con un interruptor de encendido y apagado y un
    link "Edit", y nada más (sin "See all"):
    - dice "Warn me below 15 g", "Warning: 18,5 g left" o "Warning off";
    - "Edit" abre un formulario chico: "Warn when below" en gramos, "Save the warning" y "Close". Un monto rechazado se muestra bajo el campo y conserva lo tipeado;
    - activar el interruptor abre ese mismo formulario (un aviso desactivado no conserva ningún monto); cerrarlo sin guardar deja el aviso desactivado;
    - desactivar el interruptor guarda de inmediato;
    - cada guardado, incluido el de desactivar, muestra el toast "Warning saved";
  - **In the catalog**: los Catalog attributes de la Variety, de solo lectura (mostrada u oculta, emoji, % indica, aroma/sabor), con un link "Edit", y nada más (sin "See all"). Es el único lugar donde se editan (`catalog.md`):
    - "Edit" abre un solo formulario con "Show in the catalog", Emoji, % indica y Aroma/flavor, que termina en "Save the catalog";
    - cada rechazo (por ejemplo un **Aroma** de más de 200 caracteres) se muestra bajo su propio campo y conserva todo lo tipeado;
    - salir con algo tipeado y sin guardar pregunta antes de descartar;
    - un guardado muestra el toast "Catalog saved".
- **Una sola acción de quitar**, calculada a partir del historial cuando se lee la página:
  - sin historial: "Delete variety", a través de un ConfirmDialog destructivo, después el
    toast "Variety deleted" y de vuelta a Varieties.
    - El disparador en la página se dibuja como una acción visiblemente crítica: ícono + texto con el
      ícono `tacho`, su nombre accesible sin cambios, y nunca un botón relleno fuera de una
      confirmación. El botón crítico relleno es solo la respuesta de confirmar del ConfirmDialog.
    - Su tratamiento exacto es de diseño, dentro de los tokens existentes y del **Icon and text
      rule**; un estilo que le falta al design system se dibuja a partir de tokens antes de construirse.
  - con historial: "Archive variety", a través de una confirmación que nombra los gramos en existencia
    cuando el Stock no es cero (p. ej. "You have 12 g left. If you archive it, they stop showing on Home and in the lists, but the stock is kept.") y simplemente pregunta con Stock en cero (la
    redacción exacta es de diseño), después el toast "Variety archived". Su disparador conserva un
    aspecto no destructivo, claramente distinto de "Delete variety": archivar no pierde
    nada y se puede deshacer.
  - **Página vieja, eliminar**: si apareció historial después de que cargó la página, la eliminación se
    rechaza con su rechazo con código y la página se actualiza para mostrar "Archive variety". La
    UI nunca ofrece una eliminación que sabe que va a ser rechazada.
  - **Página vieja, archivar**: si el historial desapareció después de que cargó la página, "Archive
    variety" igual la archiva, sin rechazo.
- **La página de una Archived variety** es la misma página, de solo lectura, con la flecha de regreso
  "‹ Archived" (sin historial de navegación, volver lleva a Archived):
  - **Su línea de resumen**: sus gramos, como cifra aunque sean negativos; el List price de hoy,
    o "No price"; "Archived" como un badge neutro (una palabra, sin que ningún color lleve
    el estado, en los dos temas); y "Hidden", en su propio estilo de texto al lado, cuando la
    Variety está oculta. No muestra marca de Stock status ni Days left: esos avisan sobre
    vender y reponer, y una Archived variety está afuera de toda lista, selector y de
    Home.
  - **"Restore"** es su única acción: una acción primaria de ícono + texto, en el lugar de las tres
    acciones de la página activa, justo debajo de la línea de resumen y sus marcas, así en el celular
    se alcanza sin desplazarse más allá de ninguna sección. No hay nada al lado. Su ícono
    es un nombre de `NombreIcono`; si ninguno encaja, diseño dibuja uno bajo la regla de íconos.
  - **Sus secciones, todas de solo lectura**:
    - **Stock and entries**: los últimos 3 movimientos, con "See all";
    - **Prices**: las últimas 3 Price entries, con "See all", siguiendo la misma regla de
      interruptores que la sección Prices activa (sin VIP price mientras Customers VIP está desactivado);
    - **Low stock warning**: solo la configuración guardada, "Warn me below N g" o "Warning
      off"; nunca el "Warning: N g left" en vivo; sin interruptor y sin "Edit";
    - **In the catalog**: los cuatro atributos guardados (mostrada u oculta en palabras, emoji,
      % indica, aroma/sabor), dejando afuera un atributo que nunca se fijó; sin "Edit" y sin nota
      sobre el Catalog público.
  - **"See all" desde ahí** abre listas de solo lectura: la lista de precios no tiene eliminación de precio;
    en la lista de movimientos, las filas de Stock entry no tienen edición ni eliminación y no abren nada, mientras que
    las filas de Stock withdrawal siguen abriendo el detalle propio del Stock withdrawal (su regreso sigue el historial de navegación hasta
    esta lista, y sin historial va a Varieties). La flecha de regreso de cada lista nombra la
    Variety y vuelve a su página archivada. Las Stock entries siguen pudiendo editarse y eliminarse desde
    "All entries", y los Stock withdrawals desde su propio detalle, así no se pierde nada.
  - sin "+ Entry", "Take from stock", "New price", eliminación de precio, interruptor de umbral,
    renombre, formularios Edit ni acción de quitar;
  - **Restore desde la página** muestra el toast "Variety restored" y vuelve a
    Archived en un solo movimiento; la página nunca se convierte en la Variety activa en el lugar, y no se
    duplica ningún paso del historial de navegación. En una computadora, el panel derecho de Archived selecciona entonces la
    siguiente Archived variety por nombre, si no la anterior, reemplazando el paso actual del historial
    de navegación. Sin ninguna Archived variety restante, va a Varieties, así nunca se muestra un Archived vacío. La Variety vuelve exactamente como estaba;
  - para eliminar una Archived variety sin historial, quien vende primero la restaura y después
    la elimina. No hay un segundo camino.
- **Las listas "See all"** son tarjetas (navigation.md): la barra o la barra lateral y "‹ <variety>",
  sin "+ New sale"; volver sin historial de navegación lleva a la página de la Variety. El historial completo
  de precios sigue la misma regla de interruptores que la sección Prices.
- **Renombrar** la Variety se hace acá.
- **Los formularios** que se abren desde acá (New price, + Entry, Take from stock, renombrar, el aviso de Stock bajo, los
  Catalog attributes) tienen "Close" y una confirmación al salir con algo tipeado;
  uno sin tocar se cierra de inmediato.
  - En el celular cada uno es una Sheet a pantalla completa dibujada por el único `Sheet` compartido (ADR-0062,
    el Phone layout de navigation.md), con su acción principal fija abajo del formulario.
  - El renombre, el aviso de Stock bajo y los Catalog attributes se abren como Sheets sobre esta
    página, que queda detrás, y comparten el único registro de cambios sin guardar de la página.
    Volver cierra primero la Sheet y nunca salta por encima de la página.
- **Eliminar una Price entry**: se confirma con "Before deleting" ("Delete…? / No, keep it /
  Yes, delete it"), y el texto dice qué toma el lugar de la Price entry:
  - con una Price entry anterior, el precio que vuelve a regir y su fecha, p. ej. "Back to
    $ 9.000 x g from 12/09";
  - para la primera Price entry, que no hay precio antes de la fecha de la siguiente;
  - para la única Price entry, que la Variety queda "No price: cannot be sold".

  El texto nunca menciona las Sales.
- **Después de eliminar**, los precios de hoy se actualizan de inmediato en la página y en la lista. Home puede
  volver a mostrar "Start with your varieties".
- **Toasts**: "Variety saved", "Price saved", "Price deleted", "Variety deleted", "Variety archived" y "Variety restored", sin nombres ni montos
  (más "Warning saved", "Catalog saved" y el "Entry saved" del formulario de Stock entry).
- **Rechazos**, como un nombre duplicado, un nombre que tiene una Archived variety, una
  fecha duplicada o un VIP price igual o mayor que el List price, se muestran en línea y conservan lo
  tipeado.
- **Una Variety que ya no existe**, o la Variety de otro Business (archivada o no) abierta por
  id, sigue la regla "That is gone." de accounts.md, con "Back to Varieties".
- Sin red se muestra "No connection"; un error del servidor muestra el reintento genérico (accounts.md).
- Todo funciona en celular y computadora, claro y oscuro; ningún estado se dice solo por
  color.

### En pantalla: el formulario de Price entry ("New price")

- **Tipo**: un formulario (navigation.md) en los dos dispositivos: sin barra y sin "+ New sale"; "Close"; salir con algo tipeado pregunta antes de descartar, y un formulario sin tocar se cierra de inmediato. Volver sin historial de navegación lleva a la página de la Variety. Solo difiere cómo se dibuja en la computadora.
- **Campos**:
  - la fecha de vigencia y el List price;
  - el Bulk price y el Bulk minimum solo mientras Bulk price está activado, y "VIP price" solo mientras VIP customers está activado, cada uno opcional;
  - no dice nada sobre una regla desactivada.
- **Montos en pesos**: el List price, el Bulk price y el VIP price muestran cada uno "$" antes del monto. El Bulk minimum, en gramos, nunca. El "$" es texto bajo la regla de contraste del README de diseño (ADR-0029), dibujado solo con tokens existentes. Estos campos son los campos de precio compartidos, así que el "$" también se muestra en el paso 1 del Onboarding (onboarding.md).
- **"Effective from", un chip de fecha**:
  - por defecto dice "Today dd/mm", como la fecha de New sale (sales.md);
  - tocarlo abre la elección de fecha; cómo se ve esa elección es de diseño, siempre que se llegue desde el chip;
  - un día elegido que no es hoy dice "dd/mm", sin "Today";
  - volver a hoy se hace desde el mismo chip, donde se encuentra "Today"; no hay un control aparte, y nunca lleva más que el chip y su elección;
  - registrar un precio vigente desde hoy nunca exige abrir un selector de fecha;
  - las reglas de fecha no cambian: se permite cualquier fecha, una Price entry por Variety por fecha, y una fecha rechazada se rechaza como antes;
  - la fecha elegida se conserva cuando el guardado se rechaza por cualquier campo.
- **En el celular**: una Sheet a pantalla completa dibujada por el único `Sheet` compartido (ADR-0062, el Phone layout de navigation.md), con "Close" arriba y "Save the price" fijo abajo del formulario, por encima del teclado; los rechazos van arriba de él. No tiene afuera: "Close" y el gesto de volver del celular son sus salidas. Abierta por un link directo, se muestra sobre la página de esa Variety, que queda inerte detrás. Cambiar el tamaño cruzando 900 px o rotar el celular conserva lo tipeado.
- **En una computadora**: un modal sobre la página de la Variety, sin cambios por el diseño en el celular (ADR-0044).
  - "Close" vuelve a esa página; un guardado exitoso también vuelve ahí, muestra el toast "Price saved", y la sección Prices muestra la Price entry nueva.
  - Un rechazo deja el modal abierto con todo lo tipeado, en línea en su campo.
  - Abierto por un link directo (`/varieties/{low}/prices/new`), muestra el modal sobre la página de esa Variety.
  - Mientras el modal está abierto, no se puede usar la lista de Varieties de atrás.
- **Una Variety archivada o que ya no existe** mientras el formulario está abierto sigue la regla "That is gone" de accounts.md, como antes.

### Evidencia de diseño de las páginas archivadas

- **Dibujos**: `docs/product/design-system/pantallas/` dibuja la página de la Archived variety
  y Archived, en celular y computadora, en claro y oscuro; en una computadora, Archived son
  dos paneles con la primera Archived variety por nombre seleccionada. Cubren la línea de resumen,
  el badge "Archived" y "Hidden", las secciones de solo lectura y Restore. También se dibuja el
  disparador crítico "Delete variety" de la página activa.
- **Registro** (`scripts/design/screens.json`): las filas existentes `VariedadArchivada` y
  `VariedadArchivadaOscuro` apuntan al dibujo nuevo y a la Archived variety sembrada,
  nunca duplicadas; se agregan los gemelos de computadora y las filas de Archived (celular y computadora,
  claro y oscuro). Cada fila llega a su pantalla como lo hace quien vende y
  captura su sección entera (design-capture.md).
- **App de ejemplo** (`scripts/design/sample_app.py`): siembra exactamente una Archived variety,
  oculta, cuyo único historial es una Stock entry de Opening stock registrada sin costo, con fecha en o
  después del **First record** del Business de ejemplo (ninguna Sale, ningún Stock withdrawal), con un Low-stock
  threshold, Catalog attributes (emoji, % indica, Aroma) y una Price entry vigente. Cada
  cifra de período en Home, Sales y Analysis queda como la tiene `muestra.md`; `muestra.md`
  gana solo las filas propias de esa Variety, recapturadas por el script (ADR-0035).
- **Guard de muestra**: controla los gramos propios de la Archived variety, "Archived" y "Hidden"
  en sus pantallas, no solo literales de una lista de prohibidos.

### Restricciones

- Cada ruta, incluidas las de eliminar, archivar y restaurar, entra en el barrido de aislamiento
  y en el test de rutas protegidas (ADR-0004).
- Códigos de rechazo en `contract.json` (ADR-0008): una eliminación con historial; un nombre que tiene una
  Archived variety; una Archived variety referenciada para un registro nuevo (inexistente). Archive no tiene
  rechazo propio. Ninguno repite un nombre ni un monto (ADR-0005).
- **Una fuente por mensaje compartido**: en el front, "Check the grams entered" (que muestran los formularios de precio, de Stock entry y de Stock withdrawal) y el toast "Price saved" se definen cada uno una sola vez y se leen de ahí; ninguna pantalla repite ninguno de los dos como literal propio.
- **Diseño en el celular (GH-319)**: la rama de celular del formulario de precio, New variety y las tres ediciones en línea los dibuja el único `Sheet` compartido; la rama de diálogo `PriceFrame` de ADR-0044 no se edita, y se conservan las claves del registro `VariedadRenombrar`, `VariedadUmbral` y `CatalogoAtributos`.

## Métricas

- **Precio vigente (criterio 1)**: tests sobre el historial responden la última Price entry en un día o
  antes, y ninguna antes de la primera. 100% en verde.
- **Pasado intacto (criterio 2)**: eliminar una Price entry vuelve a hacer vigente la anterior,
  cubierto por tests a través de la API y del front.
- **Nombres únicos (criterio 3)**: los duplicados dentro de un Business, sin importar mayúsculas, minúsculas ni
  espacios, son 0, incluidas las Archived varieties.
- **Validación del VIP price**: 100% en verde.
  - Igual o mayor que el List price se rechaza con su propio código, que está en `contract.json` y lo controla `tests/test_refusal_codes.py`.
  - Se aceptan un VIP price sin Bulk price y un Bulk price sin VIP price.
  - Ningún rechazo contiene el monto.
- **Las reglas desactivadas no guardan nada (criterio 15)**: una Price entry enviada con valores de Bulk o de VIP mientras esa regla está desactivada no guarda ninguno; los valores de las Price entries anteriores no cambian.
- **Interruptores en pantalla (criterio 15)**: tests del front muestran el formulario de precio, la sección Prices y el historial completo sin campos de Bulk mientras Bulk price está desactivado y sin VIP price mientras VIP customers está desactivado, y cada valor guardado de vuelta una vez activados.
- **Sin curl (criterio 4)**: la corrida de punta a punta del front agrega una Variety, agrega un precio desde su
  página (con un VIP price cuando VIP customers está activado), renombra la Variety, elimina una Price
  entry, fija un Low-stock threshold con "Edit", lo desactiva y lo vuelve a activar con el
  interruptor, y edita los Catalog attributes de la Variety con "Edit" y "Save the
  catalog", todo desde su página, y registra un Stock withdrawal desde su página. También elimina una
  Variety nueva, archiva una con una Sale, la encuentra en Archived, abre su página de solo lectura
  y la restaura.
- **Estado a la vista (criterio 5)**: la lista y la página muestran la marca y la palabra de
  cada estado, "Hidden" junto al (nunca en lugar del) estado de una Hidden variety, y la
  línea de resumen sin Varieties, todo ok y una mezcla; nunca solo por color; cubierto por los
  tests del front y revisado a ojo en los dos temas.
- **Una página (criterio 6)**: ninguna otra pantalla ofrece editar los precios de una Variety,
  la vista por Variety de sus Stock entries, el umbral ni los Catalog attributes; revisado contra los docs
  y el diseño. Los tests del front muestran que solo Stock and entries y Prices llevan sus últimas 3
  filas y "See all". Las filas de Stock withdrawal en la página se distinguen de las Stock entries por palabra y
  signo, cubierto por tests del front.
- **Guardado, nunca adivinado (criterio 6)**: tests del front muestran:
  - Low stock warning e In the catalog de solo lectura hasta "Edit";
  - activar el aviso abre el formulario del umbral, y "Close" lo deja desactivado;
  - desactivarlo guarda de inmediato con "Warning saved";
  - un Aroma demasiado largo rechazado bajo su campo, con todo lo tipeado conservado;
  - salir del formulario del Catalog con texto sin guardar pregunta primero, y un formulario sin tocar se cierra de
    inmediato.
- **Dos toques (criterio 7)**: la corrida de punta a punta, en viewports de celular y computadora, cuenta los
  toques desde cada Tab root hasta la pantalla del Catalog y hasta el formulario de Stock entry: 100% dentro de
  2, una computadora nunca más que el celular; una Stock entry desde la página de una Variety tiene la Variety
  elegida y "Initial stock" preseleccionado solo sin Stock entries.
- **Dos paneles**: en un viewport de computadora, sin nada seleccionado se muestra la primera Variety sin archivar
  por nombre; sin Varieties el panel derecho queda sin ninguna cifra; archivar o
  eliminar la Variety seleccionada selecciona la siguiente, si no la anterior, si no el estado
  vacío; en el celular la lista nunca abre una Variety.
- **Nada perdido (criterio 8)**: cada ruta vieja de Stock, Varieties y Catalog responde una
  redirección permanente, probada una por una, `/mi-stock/entradas/{id}` incluida; cada acción
  vieja tiene un lugar en las pantallas nuevas; ningún link apunta a una pantalla que falta; recargar
  `/varieties/{low}/entries`, `/varieties/entries/{id}` y `/varieties/archived`
  abre la pantalla.
- **Acción ofrecida (criterios 9, 12)**: una matriz, 100% en verde. La página ofrece "Delete
  variety" exactamente cuando la Variety no tiene historial y "Archive variety" en el resto de los casos,
  con historial de cada fuente sola (una Sale line a List price, un Gift, un Special price, una Stock entry de
  cada origen, Adjustments de los dos signos). Las Price entries, un umbral y los Catalog attributes
  solos dejan ofrecido Delete. Eliminar la última Sale o Stock entry vuelve a ofrecer Delete. El
  dominio rechaza una eliminación con historial con su código a través de la API, muestre lo que muestre la UI.
  Archivar una Variety cuyo historial se eliminó después de que cargó la página funciona;
  después de restaurarla, su página ofrece Delete.
- **Sin huérfanos (criterio 12)**: un test de repositorio sobre SQLite real hace competir una eliminación con una
  Sale line y con una Stock entry: o bien se rechaza la eliminación o bien el registro se rechaza
  como inexistente; 0 filas referencian una Variety que falta.
- **Libros sin cambios (criterio 10)**: sobre un historial sembrado, `GET /analysis` para cada
  semana, mes y la ventana de todo el período, las cifras de período de `GET /panel`, el
  detalle de cada Sale, el Balance y la cuenta de cada Customer, y el Stock, el Cost of goods sold y los gramos
  pendientes por Variety, capturados antes de archivar, después de archivar y después de restaurar: 0
  diferencias.
- **Afuera de toda lista y selector (criterio 9)**: tests del front y de la API muestran una Archived
  variety ausente de la lista y la línea de resumen de Varieties, de What you have left, de las opciones de New sale,
  del formulario de Stock entry y del formulario de precio, del texto del Catalog, de su lista "what does
  not go out" y del texto del Pinned catalog; el Upkeep edita el Pinned catalog al archivar y
  restaurar exactamente cuando cambia el texto. 100% en verde.
- **Vuelve entera (criterio 11)**: después de restaurar, los precios, el Stock, las Stock entries, el
  umbral, los Catalog attributes y la marca de Hidden variety (probada oculta y mostrada) son iguales a lo que
  eran antes de archivar. 100% en verde.
- **Nombres**: el nombre de una Archived variety, con cualquier combinación de mayúsculas, minúsculas o espacios, se rechaza al agregar y al
  renombrar con su propio código; el nombre de una Variety eliminada se acepta de inmediato.
- **Nada nuevo**: una Sale line, Stock entry o Price entry nueva contra una Archived variety
  se rechaza como inexistente; una edición de Stock entry conserva su propia Archived variety y se rechaza si la pasa
  a otra Archived variety; editar y eliminar esa Stock entry, eliminar una Sale que la contiene
  (Undo incluido) y Assign customer siguen funcionando.
- **Se encuentra (criterio 13)**: "Archived (N)" muestra el conteo correcto y no aparece cuando no hay
  ninguna; restaurar lleva 1 toque desde la tarjeta y desde la página archivada; la página archivada
  no ofrece ninguna acción salvo "Restore".
- **Toques (criterio 9)**: a través del front en un viewport de celular, archivar o eliminar
  lleva la acción más su confirmación desde la página de la Variety; una computadora no lleva
  más.
- **Aislamiento (criterio 14)**: la Variety o la Stock entry de otro Business, archivada o no,
  abierta por id muestra "That is gone."; cada ruta, incluidas eliminar, archivar y restaurar,
  está en el barrido y en el test de rutas protegidas; después de una corrida completa del front, la consola
  y el almacenamiento del navegador no tienen nombres ni montos, y ningún rechazo ni toast lleva un nombre o
  un monto.
- **Se lee como archivada (criterio 19)**: tests del front sobre la página de una Archived variety, oculta
  y mostrada, muestran "Archived", más "Hidden" cuando está oculta; gramos y precio sin marca de estado
  y sin Days left; las cuatro secciones de solo lectura, el umbral como una frase guardada
  y nunca "Warning"; y ninguna acción salvo "Restore". Las filas de Archived muestran "Archived"
  y, cuando está oculta, "Hidden". Ningún estado se dice solo por color, en los dos temas. El
  guard de muestra controla los gramos, "Archived" y "Hidden" de la Archived variety sembrada.
- **Peso justo (criterio 20)**: tests del front muestran el disparador "Delete variety" como
  ícono + texto con `tacho`, nunca un botón relleno, y el botón crítico relleno solo en
  su ConfirmDialog; "Archive variety" no dibujado como destructivo; Restore con ícono + texto,
  primario en la página y secundario en una fila de Archived, sin confirmación.
- **Destino de Restore**: tests del front muestran que Restore desde la página archivada muestra "Variety
  restored" y llega a Archived en un solo movimiento; en una computadora, seleccionada la siguiente Archived
  variety por nombre, si no la anterior; Varieties cuando no queda ninguna; ningún paso del historial de navegación
  duplicado; la página nunca convertida en la Variety activa en el lugar; el restore de la fila de
  Archived sin cambios.
- **Listas de solo lectura**: tests del front muestran las listas "See all" de la página archivada sin eliminación
  de precio y sin editar, eliminar ni abrir Stock entries; las filas de Stock withdrawal siguen abriendo su detalle;
  la flecha de regreso de cada lista vuelve a la página archivada.
- **Sin regresiones (criterios 19–21)**: las suites existentes de Varieties pasan sin ninguna
  aserción editada, incluidas las métricas de los criterios 10 y 11, salvo las que fijaban la vieja eliminación solo
  con ícono, las viejas omisiones de la página archivada o el viejo destino de restaurar en el lugar (que
  el criterio 1 de la restauración revierte); el PR lista cada una.
- **Aprobado con evidencia (criterio 21)**: los cuatro dibujos existen para la página
  archivada y para Archived; `screens.json` los lista junto con sus gemelos sin ninguna clave duplicada
  (`assertScreens`); la app de ejemplo siembra una Archived variety y `muestra.md` cambia
  solo en sus filas; las capturas de antes y después de un mismo script y una misma instalación, en el mismo
  día de Argentina, con la versión de fontsource registrada (ADR-0042), se adjuntan al PR
  con cada diferencia listada. El disparador de eliminar se juzga por su test del front y el
  dibujo, y por una captura solo donde una fila del registro ya llega a una Variety sin
  historial.
- **Diseño**: `scripts/design/compare.sh` corre antes y después para la lista, la página,
  Archived y la página archivada, en celular y computadora, en los dos temas, adjunto al PR y
  juzgado a ojo. El PR lista las dos diferencias acordadas con el dibujo (los
  formularios "Edit" de Low stock warning y de In the catalog).
- **El formulario de precio se ve como se diseñó (criterio 16)**:
  - `scripts/design/compare.sh` corre antes y después para el formulario de precio, en celular y computadora, en los dos temas, y para el paso 1 del Onboarding, adjunto al PR y juzgado a ojo; cada diferencia entre diseño y docs se lista en el PR;
  - `scripts/design/screens.json` tiene los gemelos oscuros del formulario de precio (celular y computadora), según la convención de gemelos oscuros, y el paso de precio del Onboarding, y `compare.sh` los mide.
- **Alcance del "$" (criterio 16)**: tests del front muestran el "$" en el List price, el Bulk price y el VIP price, nunca en el Bulk minimum, y lo mismo en el paso 1 del Onboarding, que no muestra chip de fecha.
- **Chip de fecha (criterio 17)**: tests del front muestran "Today dd/mm" por defecto y "dd/mm" para otro día, volver a hoy desde el chip, la fecha elegida conservada después de un guardado rechazado, y ningún input de fecha nativo abierto para registrar un precio desde hoy.
- **Modal (criterio 16)**: tests del front a través de las rutas reales muestran el modal en un viewport de computadora y una Sheet a pantalla completa en el celular, un link directo que dibuja el modal sobre su Variety, la lista de atrás inerte, y los flujos de cerrar, guardar ("Price saved", la Price entry nueva en Prices) y descartar. Un test de cambio de viewport (de celular a computadora y de vuelta) conserva lo tipeado (GH-319).
- **Sheets en una Variety (GH-319)**: tests del front muestran el foco en el primer campo y exactamente un "Close" en New variety y en las Sheets de renombre, de aviso de Stock bajo y de Catalog attributes; una dirección directa a New variety la muestra sobre Varieties; una corrida e2e muestra la acción de la Sheet de renombre dentro de `--inset-abajo` del borde inferior de la Sheet.
- **Una fuente (criterio 18)**: un test muestra "Check the grams entered" y "Price saved" definidos una sola vez cada uno, y el texto que se dibuja en cada pantalla que los muestra sin cambios.
- **Marco probado por comportamiento** (navigation.md, criterio 5): un test del Shell muestra "+ New sale" en un Tab root y ausente bajo el marco de tarjeta.
- **Sin regresiones (criterios 16–18)**: las suites existentes pasan; los únicos tests editados son los que encontraban el input de fecha nativo o la disposición de la página, cada uno listado en el PR; el guard de contraste (ADR-0029) pasa sin cambiar ningún token.
- **Velocidad**: Varieties responde en menos de 300 ms con unas pocas docenas de Varieties.

## Fuera de alcance

- Las reglas de los Catalog attributes: la capacidad del Catalog (se editan acá).
- Las reglas de los Stock withdrawals: la capacidad del Stock (se inician y se ven acá).
- Eliminar una Variety con historial, por cualquier camino.
- Eliminar una Archived variety sin restaurarla primero.
- Rechazar un archivado porque la Variety no tiene historial.
- Fusionar Varieties, o tomar el nombre de una Archived variety.
- Eliminar, archivar o restaurar varias Varieties a la vez; archivar o eliminar desde
  la propia lista.
- Una etiqueta "Archived" en los registros pasados.
- Pasar una Stock entry a una Archived variety.
- Actualizaciones en vivo entre socios mientras una pantalla está abierta.
- **Settings** y sus grupos, incluidos los interruptores de precio (pricing-settings.md).
- Editar los Catalog attributes o el umbral en el lugar, sin un formulario y un guardado.
- Editar una Price entry, su VIP price incluido (ADR-0003).
- Copiar los precios de una regla oculta a una Price entry nueva.
- Otras reglas VIP (un porcentaje sobre el List price); precios promocionales por fecha.
- Documentar la diferencia del formulario de precio con el diseño en lugar de alinearlo.
- Una elección de fecha en el paso 1 del Onboarding; cualquier cambio en las reglas de fecha de una Price entry.
- Un token nuevo o un cambio en el valor de cualquier token para el formulario de precio.
- Rehacer la flecha de regreso de la página archivada (navigation.md, ADR-0045).
- Un Stock status en vivo, Days left o un aviso "Warning" en una Archived variety.
- Editar cualquier cosa desde la página de una Archived variety o sus listas "See all".
- Un rechazo por choque de nombre o un estado de error para Restore.
- Métricas de uso de las páginas archivadas.

## Planned in GH-318

Todavía no está construido. Hasta que salga la parte nombrada, las secciones de arriba son lo que hace la app.

El epic permite que un Business describa lo que vende con sus propias palabras. Cada pasaje nombra el ADR que lo decide, la parte que lo va a entregar y la oración actual que va a reemplazar. La parte que entrega un pasaje lo quita de acá y edita Comportamiento y Fuera de alcance en el mismo diff.

### La Product word

Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md y docs/adr/0061-columns-keep-variety-id-until-75-while-code-and-the-api-say-product.md; lo entrega la parte product word, con el Product rename on the wire para la ruta de la API.

- Quien vende va a elegir la palabra para lo que vende, en singular y en plural. El valor por defecto va a ser "Product" / "Products". Se va a mostrar tal como se tipeó y nunca se va a traducir, porque es un dato propio de quien vende.
- El código, los tests y los docs van a decir Product, y la ruta de la API va a pasar a ser `/api/products`. Las columnas que referencian el id de una Variety van a seguir siendo `variety_id` hasta #75 (ADR-0061). Las rutas del front bajo `/varieties/*` no se van a mover.
- Va a reemplazar: "**Variety**: un nombre, sin espacios al principio ni al final, con los espacios internos colapsados, de hasta 60 caracteres. Renombrarla conserva sus precios. Las Varieties se listan por nombre." y el título de la capacidad, "Las Varieties que vende un **Business** y el historial de precios de cada una".

### Categorías, subcategorías y atributos

Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; lo entrega la parte categories.

- Los Products se van a agrupar en categorías y subcategorías, de dos niveles, y cada Product va a pertenecer a exactamente una subcategoría. La lista, los selectores y los filtros van a agrupar por categoría y subcategoría.
- Una subcategoría se va a poder archivar solo cuando no tenga ningún Product sin archivar; una categoría, solo cuando ninguna de sus subcategorías esté sin archivar; la última subcategoría sin archivar del Business, nunca. Restaurar un Product cuya subcategoría está archivada se va a rechazar hasta que se restaure esa subcategoría.
- Los atributos se van a definir por subcategoría (nombre, tipo, obligatorio o no, se muestra en el Catalog o no). Un atributo para el que ningún Product tenga valor se va a poder eliminar; uno con algún valor solo se va a poder archivar, y se va a conservar cada valor.
- Pasar un Product a otra subcategoría va a conservar los valores de los atributos que comparten las dos subcategorías y le va a decir a quien vende, antes de confirmar, qué valores pierde el Product. La marca de Hidden variety va a quedar en el Product, nunca como atributo.
- Va a reemplazar: "sus **Catalog attributes** (`catalog.md`)." en la lista de lo que reúne la página, y los atributos fijos de "### Catalog attributes, per variety" de catalog.md (citados en la propia sección Planned de `catalog.md`).

### Units y cantidades

Decidido en docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md; lo entrega la parte units.

- Cada Product va a tener una Unit con un nombre, una etiqueta corta y de 0 a 2 decimales, que se usa para su Stock, su precio, la cantidad vendida, el Bulk minimum y el Low-stock threshold. Un Business va a poder mezclar Units. La Unit se va a bloquear una vez que el Product tenga historial.
- Una cantidad se va a guardar como un número entero de centésimos, cualquiera sea la Unit; los decimales de la Unit solo van a validar lo ingresado y decidir cómo se muestra (ADR-0056). Las cantidades de Units distintas nunca se van a sumar: una cifra que totaliza cantidades va a mostrar un monto por Unit.
- Va a reemplazar: "un List price por gramo en pesos enteros", "un Bulk price por gramo con su Bulk minimum en gramos (hasta dos decimales)" y "**Low-stock threshold**: gramos opcionales, mayores que cero, de hasta dos decimales".

### Dinero

Decidido en docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md; lo entrega la parte money.

- Los precios van a viajar en unidades de moneda, interpretados como Decimal, y se van a guardar en la escala propia del Business, 0 o 2. El Business va a tener su propio símbolo de moneda y sus decimales de dinero (de 0 a 2).
- Va a reemplazar "pesos enteros" en todos los lugares donde este archivo lo dice, y "Todo monto es mayor que cero." sigue rigiendo.

### Los Customer types

Decidido en docs/adr/0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md; lo entrega la parte customer-type prices.

- Los Customer types van a reemplazar la marca VIP única: cada tipo va a tener su propio precio por Product, guardado como filas con fecha de vigencia. Las columnas de la marca `vip` y de `vip_price` van a quedar congeladas en su lugar.
- Va a reemplazar: "un **VIP price** por gramo, en pesos enteros, menor que el List price. Es independiente del Bulk price y del Bulk minimum (una Price entry puede tener cualquiera de los dos solo) y nunca se compara con el Bulk price." y el rechazo "**Un VIP price igual o mayor que el List price**".
- Fuera de alcance: la línea "Otras reglas VIP (un porcentaje sobre el List price); precios promocionales por fecha." se va a dividir. "precios promocionales por fecha" lo va a revertir la parte promotions (docs/adr/0060-the-applied-promotion-snapshot-is-typed-sale-promotion-rows-recorded-as-the-sale-stood-when-saved-and-never-recomputed.md; ver `sales.md`); "Otras reglas VIP (un porcentaje sobre el List price)" va a quedar afuera.

### El día del negocio

Decidido en docs/adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md; lo entrega la parte time-zone.

- Cada Business va a tener una zona horaria, y "hoy" se va a calcular por Business. Las fechas registradas nunca se van a reescribir.
- Va a reemplazar: "Hoy es el día del negocio en hora de Argentina."

### Negocios existentes

Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; lo entregan las partes que construyen cada configuración, cada una sembrando en los Businesses existentes su propio valor por defecto.

- Cada Business existente se va a migrar, sin reescribir ninguna fila guardada, a una categoría y una subcategoría que tengan emoji, **Indica share** y Aroma como atributos; la Unit "grams" / "g" con 2 decimales; "Variety" / "Varieties" como su palabra; "$" con pesos enteros; y VIP como Customer type. La marca de Hidden variety va a quedar en cada Product. Va a poder agregar categorías y subcategorías; no se le va a imponer nada más.
