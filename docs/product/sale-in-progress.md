## Jobs

**Cuando** entrego un pedido y lo registro en el teléfono, **quiero** armar la venta con los clientes, productos y el medio de pago que suelo elegir, ajustando solo cantidades y con cada total calculado por la app, **para** guardar la venta en menos de un minuto y nunca cotizar de memoria ni volver a tipear lo que elegí hace un momento. (Parte 3 de GH-496: la sirven el estado de la venta en curso, `useSaleDraft`, y el cliente del front de las **New sale suggestions**. Afina la primera historia de sales.md; no es un trabajo nuevo).

**Cuando** un cliente me manda su pedido y armo la venta en el teléfono, **quiero** encontrar cada Product que pidió y fijar cuánto con un toque o dos, viendo lo que ya está en la venta, **para** que cada línea salga con los precios de ese día y nunca tipee un precio ni cotice de memoria. (Parte 2 de GH-863: la sirve la lista de Products de New sale. Afina la misma primera historia de sales.md, acotada a elegir Products y cantidades; cliente, pago y guardado son de otras partes).

**Cuando** abro New sale en el teléfono, o cambio la fecha o el Customer, y los precios todavía se están cargando o no se pudieron leer, **quiero** ver claramente que la lista está cargando o falló, y nunca ver un precio equivocado, viejo o vacío, **para** nunca cotizar de memoria ni registrar una venta a una cifra que la app no calculó. (#941, recorte de #924: la sirven los estados de carga y de falla de la lista de Products de New sale. Afina la misma primera historia de sales.md).

## Qué es

La **Sale in progress** es la venta que se está armando en New sale antes de guardarla: cliente, líneas, fecha, **Shipping charged**, **Note** y cómo se paga. Es solo del front (`web/src/sales/useSaleDraft.ts`) y vive en memoria durante una apertura de New sale: nunca se guarda en el dispositivo y una recarga la pierde (igual que lo que dice sales.md, criterio 43). Lo que se guarda es la **Sale**, con las reglas de sales.md.

Hasta la parte de GH-496 que la monta en pantalla (el flip), ninguna pantalla la usa: no hay ruta, constante de build, parámetro de consulta, bandera de ventana ni hook `data-*` para llegar a ella, y se prueba solo con tests unitarios, tests de componente y un test del cliente a nivel de fetch.

Antes de esta parte, la vendedora vuelve a elegir en cada venta los mismos clientes, productos y medio de pago, y tipea las cantidades a mano, de a un Product por vez y sin ver de una sola vez lo que ya está en la venta ni lo que suele vender. El costo principal son las elecciones repetidas, y el segundo es tipear cantidades.

## Reglas

### Líneas

- Una línea es un **Product** y una cantidad, nada más. El **Gift** y el **Special price** llegan con la parte del detalle de línea.
- A lo sumo una línea por Product: agregar un Product que ya está en la venta le suma una unidad entera a su línea y nunca crea otra. La API sigue aceptando el mismo Product en varias líneas (sales.md, "Línea"); esta regla es solo de New sale.
- + y − suben o bajan una unidad entera.
- − desde 1 o menos saca la línea. Se mira la cantidad actual, no el resultado: 1,5 − 1 da 0,5, que queda, y un − posterior desde 0,5 saca la línea.
- Una cantidad tipeada se acepta solo si es mayor que 0 y tiene a lo sumo dos decimales (ADR-0056). Cualquier otra cosa (0, vacío, algo que no es un número, más de dos decimales) se rechaza, nunca se redondea, y la línea conserva su última cantidad válida. Tipear nunca saca una línea.
- Una cantidad no puede superar 13 dígitos enteros (más los dos decimales): el front rechaza lo tipeado que la pase y + o agregar un Product no la sobrepasan. El límite se mira sobre los dígitos tipeados, sin ceros a la izquierda.
- La cantidad es neutra: nunca dice gramos ni asume una Unit.

### Sin guardar

- `isDirty` es `lines.length > 0`: la venta cuenta como sin guardar solo con al menos una línea.

### Cómo se paga

- La Sale in progress tiene `proposedMethodId` (solo lectura, viene de las New sale suggestions) y `choice`: unset, paid(id) u owing.
- El medio efectivo es el id de paid(id), ninguno para owing y `proposedMethodId` para unset.
- Una sugerencia que llega tarde solo completa `proposedMethodId`: nunca pisa un paid(id) ni un owing que eligió la vendedora. Con unset, el medio efectivo pasa a ser el propuesto.
- Sin sugerencia (sin historial o con el último medio archivado) o con la lectura fallida, `proposedMethodId` queda vacío y unset no tiene medio efectivo. Una lectura fallida no muestra ningún error.
- La propuesta es siempre el id de un **Payment method**, nunca un nombre ni una marca de efectivo.
- La propuesta cuenta solo si está entre los Payment methods ofrecidos; si no lo está, o la lista ofrecida todavía no llegó, unset no tiene medio efectivo. paid(id) y owing se devuelven como los eligió la vendedora.

### Cliente y owing

- Sacar el cliente con `choice` en owing lo vuelve a unset, porque una venta sin cliente no puede quedar debiendo. Es el único cambio automático.
- Cambiar a otro cliente conserva owing.
- Sacar el cliente conserva paid(id), porque una **Sale without a customer** se permite pagada por completo.
- Elegir owing sin cliente se conserva tal cual; rechazar el guardado es de la API y de la pantalla.

### Apertura

- Cada apertura de New sale empieza sin líneas, con `choice` en unset, sin Shipping charged ni Note y con la fecha de hoy en el día del Business.
- El cliente arranca vacío, salvo que la apertura traiga uno (New sale desde la ficha de un cliente).

### Dinero

- Ni la Sale in progress, ni el cliente de sugerencias, ni la lista de Products calculan dinero. Toda cifra de la venta (precio de la fila, total de la línea, total de la barra, total de Collect, aviso de recotización) sale de `priceSale`/`rowPrices`/`priceLine` en `web/src/sales/pricing.ts`. El Shipping charged y la Note se guardan tal como se ingresaron.

## Cliente de las New sale suggestions

- Vive en `web/src/api/` y lee `GET /api/sales/suggestions` con `on` obligatorio. La lectura del servidor está definida en sales.md ("New sale suggestions").
- `openedOn` (el día de la apertura) se fija una sola vez al abrir New sale y ninguna acción lo cambia; es la única fecha que lee el cliente de sugerencias, nunca la fecha editable de la venta. Editar la fecha o que cambie el día después no vuelve a pedirlas.
- Una sesión perdida (401) en la lectura manda a la vendedora a iniciar sesión, como cualquier otra lectura; cualquier otro fallo (otro estado, red caída, cuerpo mal formado) da ninguna sugerencia, en silencio y sin escribir en la consola.
- La respuesta replica la del servidor: `recent_customer_ids` y `most_sold_product_ids` (listas de ids) y `last_payment_method_id` (un id o null).
- Se pide una sola vez por apertura de New sale, con la fecha de apertura como clave. Volver a dibujar o editar la fecha de la venta nunca la vuelve a pedir ni la cambia; una apertura nueva otro día es una clave nueva.
- Las sugerencias solo acortan elecciones: nunca fijan un precio, un monto ni una cantidad.

## Lista de Products de New sale

El componente `web/src/screens/ventas/NuevaVentaProductos.tsx`, con sus lecturas en `web/src/sales/useNewSaleReads.ts`, sigue los dibujos NuevaVentaProductos y NuevaVentaProductosOscuro (claro y oscuro). Hasta el flip de GH-496 ninguna ruta, entrada de navegación ni pantalla lo monta; solo lo alcanzan sus tests de componente, y los dos módulos figuran en `web/scripts/docs/front-exclude.json` hasta que el flip los conecte (D-62e6dc23). Rigen las diez invariantes de #924; la 4 y la 6 son las de los estados de carga y de falla (#941).

Diferencias con los dibujos aceptadas por el dueño:

- Desviación 2 del pedido: sin código de barras ni categoría.
- Desviación de dibujo #1 (GH-924, Decisión 3), solo para esta parte: todavía no hay búsqueda; llega en #940.

La desviación de dibujo #2 (sin estados de carga ni de falla) quedó cerrada con #941. #940 tiene que estar entregada antes de que el flip de GH-496 monte la lista.

### Lecturas

- `useNewSaleReads({ date, openedOn })` lee los Products de la fecha de la venta (`GET /api/products?on=<date>`) y los Pricing settings, con las mismas claves y opciones que New sale: las dos definiciones viven en `web/src/sales/saleFormQueries.ts` (`saleFormProductsQuery`, `saleFormPricingSettingsQuery` y `pricingSettingsOf`), y `NuevaVenta.tsx` usa las mismas sin cambiar su comportamiento. Las sugerencias llegan solo por el cliente de New sale suggestions con `openedOn`, así que cambiar la fecha de la venta nunca las vuelve a pedir.
- También lee el Stock (`GET` de Stock, clave `keys.stock()`, con las opciones por defecto de la app), que antes leía el componente.
- Devuelve:
  - `status`, lo único de lo que la lista decide su estado (ver "Estados de la lista");
  - los Products (null mientras no llegó ninguna respuesta; durante un cambio de fecha, la lista de la fecha anterior, que solo `status` en `ready` confirma como la de la fecha actual);
  - los Pricing settings de esa fecha (null hasta que llegan, y también mientras solo están los de la fecha anterior);
  - los ids de "Most sold" (null mientras se piden);
  - las filas de Stock (null mientras se piden o si la lectura falló);
  - `failed`, el motivo de la falla: un `NetworkError` para la red caída o un teléfono sin conexión, o el error de Products o de Pricing settings. Un fallo de las sugerencias o del Stock nunca es una falla.
- `status` se calcula con estas reglas, en orden:
  1. **failed:** la lectura de Products o la de Pricing settings está en error y no se está volviendo a pedir, o alguna de las dos está en pausa porque el teléfono no tiene conexión (eso es un `NetworkError`).
  2. **loading:** no se cargó ninguna lista desde la última falla y alguna lectura (Products, Pricing settings, sugerencias o Stock) sigue pendiente. Una lectura de sugerencias o de Stock fallida cuenta como resuelta.
  3. **refreshing:** ya se cargó una lista y los Products o los Pricing settings de la fecha de la venta todavía son los de la fecha anterior.
  4. **ready:** todo llegó.
- "Ya se cargó una lista" se enciende al llegar a `ready` y se apaga en cada falla, en el mismo render, sin efecto: así una lista de otra fecha que la caché devuelve después de una falla nunca se toma por cargada.
- **Lectura de nuevo tras una falla** (decisión 1 (b) del humano; ADR 20261121, `docs/adr/20261121-new-sale-s-product-list-re-reads-after-a-failure-on-reconnect-or-focus-the-only-exception-to-no-background-retry.md`): solo los observadores de esta lista sobre las dos lecturas de fecha vuelven a pedir cuando el teléfono se reconecta o la app recupera el foco, y solo mientras la lectura está en error. No cambia ninguna opción por defecto de la app ni de la consulta (`networkMode`, `gcTime`, `retry`, `staleTime`), no hay bucle de reintentos y una lista cargada nunca se vuelve a pedir en segundo plano. Es la única excepción a "Sin red" de accounts.md. Al montarse la lista en el flip, una lectura de nuevo que ella dispare también refresca al observador de `NuevaVenta.tsx`, porque comparten la entrada de la caché; está aceptado en el ADR.

### Estados de la lista

La lista dibuja solo a partir de `status`, y `priceSale` y `rowPrices` corren solo con `status` en `ready` y el Customer conocido. El estado de ocupado pasa solo por `LoadingWhile`, que marca el `ContentArea` de la pantalla que la monta; la lista nunca dibuja un `ContentArea` propio.

- **Primera carga (`loading`):** `MOST_SOLD_ROWS` filas esqueleto, ocultas para la accesibilidad, hechas con las barras `cargando__barra` y con la altura mínima de una fila cargada, y `aria-busy` verdadero. No hay encabezado, ningún dígito, ningún símbolo del Money format del Business, ninguna pista ni texto de lista vacía. El esqueleto se queda hasta que se resuelven todas las lecturas, la de sugerencias y la de Stock incluidas, salgan bien o mal, así que las filas no se reacomodan cuando llegan las sugerencias.
- **Recarga con la lista cargada (`refreshing`, o `ready` con el Customer en `'pending'`):**
  - los nombres, el texto de Stock y los pasos de las líneas se quedan, y los pasos siguen funcionando: un "+" durante un cambio de fecha sube la cantidad, y al llegar se muestra el precio de la fecha nueva;
  - cada celda de precio muestra la marca compacta de carga (`Loading compacto`) en lugar de su cifra, así que nunca destella un precio viejo;
  - las filas de "Most sold" esconden su "+" hasta que llegan las cifras;
  - la pista no se muestra;
  - la lista queda `aria-busy`.
  `'pending'` significa solo una lectura del Customer en curso; qué significa una lectura del Customer fallida lo decide quien monta la lista, nunca la lista.
- **Cargada (`ready`):** la lista de los dibujos, sin `aria-busy`.
- **Falla (`failed`):** un `NetworkError` muestra SinConexion y cualquier otro error muestra ErrorGenerico, los dos tal como ya existen y sin botón. Cualquiera de los dos reemplaza la lista entera, sin `aria-busy`, esqueleto, marca ni pista, y no queda a la vista nada de la lista anterior, porque sus precios eran de una fecha o un Customer que ya no rigen. Un teléfono sin conexión al abrir cuenta como falla: muestra SinConexion y no pide nada hasta que vuelve la conexión.
- **Nueva lectura después de una falla:** como no queda una lista cargada, vuelve el esqueleto con las reglas de la primera carga, nunca la marca compacta.
- **Recuperación:** cuando una lectura posterior sale bien (al reconectar, al recuperar el foco o por un cambio de fecha), la lista reemplaza el aviso, con las líneas, sus cantidades y los precios nuevos. Una lectura que vuelve a fallar deja el aviso hasta el próximo evento.
- **Sale in progress:** ningún estado de carga o de falla la borra ni la cambia; las líneas viven en el borrador, fuera de las lecturas.
- **Para la parte del flip:** Guardar y el total no están disponibles salvo que `status` sea `ready` y el Customer no esté en `'pending'`. Qué rodea al aviso de falla (Cerrar, Cliente, búsqueda) lo decide la Sheet que monte la lista.

### Filas

- Cada fila muestra el nombre del Product en tinta, debajo, en su propia línea y en gris, "{stock} in stock"; a la derecha, el precio (o "No price") en cifras tabulares y los pasos.
- El Stock se muestra tal cual, 0 y negativos incluidos ("0", "-3,5", "1,5 in stock"), y una línea con más cantidad que el Stock no cambia ese texto: la lista no calcula ningún Stock restante. Un Product con Stock en cero o negativo se puede agregar igual: el Stock solo informa. Lo único que impide agregar es no tener precio.
- La lectura de Stock cuenta en la primera carga; si falla, la lista se muestra igual, sin texto de Stock y sin error.
- Una fila que no está en la venta muestra el precio por unidad que pagaría este Customer al agregarla, de `rowPrices`, sin totales.
- Una línea muestra su propio precio por unidad, de `priceSale` sobre las líneas de la venta (vía `saleLineInputsOf`, envío 0). Puede diferir del de la fila, por ejemplo por un Bulk price o un precio de Customer type.
- El precio pasa por el formateador de dinero del Business (su símbolo y sus decimales) y no lleva etiqueta de Unit, para que sirva a cualquier Business.
- "No price" se muestra exactamente cuando la fila no tiene precio; el componente nunca lee `current_price` por su cuenta (solo `nothingSellable`, para el aviso).

### Pasos

- Una fila fuera de la venta y con precio tiene "+" (nombre accesible "Add {name}"), que agrega el Product. Mientras la lista recarga, ese "+" no se muestra.
- Una línea tiene, en un grupo nombrado por el Product: "−" ("Remove one {name}"), la cantidad de solo lectura y "+" ("Add one {name}"). Siguen funcionando mientras la lista recarga.
- La lista no fija ningún paso ni hace cuentas de cantidad: lo decide la Sale in progress (ver Líneas), y "−" desde 1 o menos saca la línea. Un Product que sale de la venta vuelve a "Most sold" si está entre las sugerencias.
- Una línea sin precio muestra "No price", "−" y la cantidad, sin "+"; el lugar del "+" queda vacío para que "−" no se mueva. Una línea que pierde su precio por un cambio de fecha se queda en la venta hasta que la vendedora la saca con "−"; ninguna acción de la lista pierde una línea.
- Una línea cuyo Product la lectura de Products ya no devuelve (archivado o eliminado en otro lado después de agregarlo) también se queda: muestra, en lugar del nombre, el texto compartido "no longer available" (el mismo que usa el Selector para una elección que ya no se ofrece), "No price", su cantidad y "−", que la saca como a cualquier línea. Nunca muestra un id interno ni un nombre adivinado. Su grupo y su "−" usan ese mismo texto como nombre, sin clave de copy nueva. Queda en "In the sale" en el orden en que se agregó y cuenta en su número, nunca aparece en "Most sold" y no tiene "+". Qué pasa al guardar con una línea así es de la parte del guardado.
- Los botones miden al menos 44x44 px, no seleccionan texto, responden al toque sin demora y sus glifos están ocultos para la accesibilidad. Cada botón es su propia pastilla en el tono suave del acento (el dibujo los agrupa en una sola pastilla; el dueño lee y hace lo mismo).
- Todavía no hay forma de tipear una cantidad en la lista: 10 unidades son 10 toques. Dónde vive la cantidad tipeada lo decide el flip.

### Secciones

- Arriba va el aviso, cuando corresponde; después, "In the sale · {n}" con las líneas en el orden en que se agregaron, solo si hay líneas.
- Debajo, "Most sold" se muestra solo si tiene filas: conserva el orden de las sugerencias, deja afuera los Products que ya están en la venta y los ids que la lectura de Products no devolvió, y aplica el tope (`MOST_SOLD_ROWS`) después de filtrar. Sale solo del propio Business, sin Gifts ni Archived products, y nunca fija un precio, un monto ni una cantidad.
- Los encabezados de sección son chicos, en negrita media y en gris, como en el dibujo.
- Sin Sales todavía (y sin líneas), el cuerpo queda vacío: ninguna fila, encabezado ni aviso.
- Hasta que llegue #940, un Product que no está en la venta ni en "Most sold" no se alcanza desde esta lista; es aceptable solo porque nada la monta todavía.

### Aviso

- Cuando no hay nada para vender, arriba de las secciones se muestra, con el Attention icon y sin poder tocarse, el aviso de que no hay Products (`selectorNoVarieties`) o el de que ninguno tiene precio para esa fecha (`NO_PRICE_HINT`), según `nothingSellable`.
- Sigue a la fecha de la venta y se muestra solo con la lista en `ready` y el Customer conocido: se oculta mientras carga o recarga y en una falla. Su altura no se reserva, así que puede correr la lista al aparecer; se juzga en el recorrido del flip. Cuando llegue la búsqueda (#940) irá debajo de ella y se ocultará mientras se busca.

### Fallos

- Un fallo de la lectura de Products o de Pricing settings, o un teléfono sin conexión, reemplaza la lista por SinConexion o ErrorGenerico, y la lista vuelve a leer al reconectar o al recuperar el foco (ver "Lecturas" y "Estados de la lista"). La venta conserva sus líneas.
- Un fallo de las sugerencias no muestra ningún error y solo deja sin "Most sold": ni marca ni encabezado vacío. Las sugerencias tampoco tienen marca de carga.
- Un fallo del Stock no muestra ningún error y solo deja las filas sin texto de Stock.

### Textos

En el Copy module (`web/src/copy/sales.ts`, grupo `newSale` de `SALES_TEXT`), en inglés y sin palabras de Unit ni de tipo de producto: `productsInSale` "In the sale · {n}", `productsMostSold` "Most sold", `productStock` "{stock} in stock", `productNoPrice` "No price", `productAdd` "Add {name}", `productIncrease` "Add one {name}", `productDecrease` "Remove one {name}". Están registrados en LIMITED_COPY y BASELINE_ARGS. El texto "no longer available" se reutiliza del existente, no se agrega. Los estados de carga y de falla no agregan ninguna clave: reutilizan SinConexion, ErrorGenerico, `LoadingWhile` y `Loading compacto`. Las claves de la búsqueda (`productsResults`, `productSearchLabel`, `productSearchPlaceholder`) llegan con #940. El baseline se regenera, nunca se edita a mano.

### Diseño

- Colores, tipografía y espacios salen solo de los tokens; el modo oscuro es el mismo marcado con los tokens oscuros. La fila esqueleto tiene su única regla propia, `.nv-productos__fila--esqueleto`, que le da la altura mínima de la fila real con tokens.
- Las diferencias aprobadas con los dibujos son las de arriba (desviación 2 y desviación de dibujo #1). Diferencias de peso y tono que se leen igual (precio y nombre más livianos que en el dibujo, pasos en pastillas separadas, fila esqueleto de dos barras sin forma de paso) quedan como observaciones. Ningún dibujo muestra la marca compacta en estas celdas ni el "+" oculto de "Most sold" al recargar. Cualquier otra diferencia que el dueño leería o haría distinto en el teléfono se le plantea al dueño en el PR; nadie la acepta como supuesto.
- El dibujo compartido de sin conexión en `Estados.dc.html` promete volver a intentar sola cuando vuelve la conexión; para esta lista eso es cierto desde #941.
- No hay captura lado a lado mientras la pantalla no tenga ruta (`route: null` en `scripts/design/screens.json`). El corrimiento de contenido y el blanco durante la carga se juzgan en el recorrido del flip.

## Fuera de esta capacidad (por ahora)

- Cualquier ruta, entrada de navegación, pantalla o Sheet que monte la Sale in progress o la lista de Products, y el flip que las monta.
- La búsqueda de la lista de Products: campo, "Results · {n}", resaltado de coincidencias, "Results · 0" y sus textos (#940).
- Un botón de reintento en los avisos de falla, o cualquier reintento más allá de la lectura de nuevo al reconectar o al recuperar el foco; cambios a SinConexion o a ErrorGenerico.
- Qué muestran el total y Cobrar mientras la lista carga o falló, y qué rodea al aviso de falla (flip).
- Qué significa para la lista una lectura del Customer fallida (lo decide y prueba el flip).
- La cantidad tipeada en la lista y un botón propio para limpiar la búsqueda (flip).
- Los pasos de cliente, pago y guardado de New sale, incluido qué pasa al guardar una línea cuyo Product ya no está disponible.
- Código de barras, categoría y elementos de promoción en la lista de Products.
- Reescribir el criterio 34 de sales.md ("el medio nunca viene puesto"), que le corresponde a la parte que preselecciona el medio en pantalla.
- Gift, Special price y la Sheet del detalle de línea.
- Conservar la venta en curso tras una recarga.
- Cualquier cambio en el servidor.

## Métricas

- Cada regla de Líneas, Sin guardar, Cómo se paga, Cliente y owing, y Apertura tiene su test unitario de la Sale in progress, y pasa.
- Cliente de sugerencias, a nivel de fetch: exactamente 1 pedido por apertura, con `on` igual a la fecha de apertura; 0 pedidos nuevos después de editar la fecha o volver a dibujar; 1 pedido nuevo en una apertura de otro día; una lectura fallida da ninguna sugerencia y 0 errores lanzados.
- Lista de Products, en tests de componente a nivel de fetch: cada caso de la lista (pasos, cantidades tipeadas, una línea por Product, "No price", línea que pierde su precio, línea cuyo Product ya no vuelve, sugerencias filtradas y con tope, Stock, bulk a 10, recotización por Customer y por fecha, aviso, símbolo y decimales del Money format) tiene su test y pasa; 0 pedidos nuevos de sugerencias tras cambiar la fecha; 0 cambios en los totales de la venta al mostrar más filas.
- Estados de carga y de falla, en `NuevaVentaProductos.test.tsx` sobre el arnés de #924, cada uno con su test que pasa en el Gate (vitest):
  1. **Primera carga sin cifras:** mientras falta alguna lectura (sugerencias y Stock incluidas), la lista está `aria-busy` y muestra 0 dígitos, 0 símbolos del Money format, 0 textos de lista vacía y 0 encabezados.
  2. **Recarga sin precio viejo:** un cambio de Customer o de fecha conserva las líneas y sus cantidades, pone la marca compacta en las celdas de precio sin destellar la cifra anterior, oculta la pista y deja la lista `aria-busy`; un "+" durante un cambio de fecha sube la cantidad.
  3. **Falla distinguible:** un 500 en Products muestra ErrorGenerico; una falla de red y un teléfono sin conexión al abrir muestran SinConexion.
  4. **Lecturas secundarias que nunca bloquean:** un 500 en sugerencias o en Stock no muestra error y la lista funciona.
  5. **Busy solo al cargar:** 0 estados de falla con `aria-busy`.
  6. **Recuperación:** una lectura después de una falla muestra el esqueleto; una reconexión o una vuelta del foco tras una falla vuelve a pedir y devuelve la lista con las cantidades cargadas y los precios nuevos; una lista cargada hace 0 pedidos nuevos al recuperar el foco o al reconectar; otro observador de la misma consulta conserva sus propias opciones.
- Líneas perdidas por una acción de la lista, una recarga de Products o una falla: 0. Ids internos mostrados en pantalla: 0.
- Cifras mostradas antes de que lleguen todas las lecturas, mientras el Customer está pendiente o durante una falla (dígitos, símbolo de moneda, "No price", aviso, encabezados): 0.
- Operaciones de dinero en `useSaleDraft`, en el cliente de sugerencias y en la lista de Products: 0 (todo pasa por `pricing.ts`).
- Rutas, constantes, parámetros, banderas, props, exports o hooks `data-*` solo para tests: 0.
- Claves del Copy module agregadas por la lista de Products: 7, en inglés y sin palabras de Unit ni de tipo de producto; agregadas por los estados de carga y de falla: 0.
- Gate (pytest, vitest, e2e) pasa, y tsc strict y oxlint pasan sin nada silenciado.
- Vara del trabajo, que se juzga cuando el flip la monte: una venta se registra desde el teléfono en menos de un minuto (sales.md, criterio 1), y un Product habitual se encuentra, se agrega y se ajusta sin salir de la lista (1 toque para un Product habitual a 1 unidad desde "Most sold"). No hay medición de uso en la app hasta el flip de GH-496.
