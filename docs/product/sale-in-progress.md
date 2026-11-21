# Sale in progress

## Jobs

**Cuando** entrego un pedido y lo registro en el teléfono, **quiero** armar la venta con los clientes, productos y el medio de pago que suelo elegir, ajustando solo cantidades y con cada total calculado por la app, **para** guardar la venta en menos de un minuto y nunca cotizar de memoria ni volver a tipear lo que elegí hace un momento. (Parte 3 de GH-496: la sirven el estado de la venta en curso, `useSaleDraft`, y el cliente del front de las **New sale suggestions**. Afina la primera historia de sales.md; no es un trabajo nuevo).

**Cuando** un cliente me manda su pedido y armo la venta en el teléfono, **quiero** encontrar cada Product que pidió y fijar cuánto con un toque o dos, viendo lo que ya está en la venta, **para** que cada línea salga con los precios de ese día y nunca tipee un precio ni cotice de memoria. (Parte 2 de GH-863: la sirve la lista de Products de New sale. Afina la misma primera historia de sales.md, acotada a elegir Products y cantidades; cliente, pago y guardado son de otras partes).

**Cuando** registro una venta en el teléfono y el Product que pidió el cliente no está entre los que ya están en la venta ni entre los más vendidos, **quiero** tipear parte de su nombre y ver solo los Products que coinciden, **para** agregarlo en un toque o dos sin scrollear ni acordarme de dónde queda en la lista. (#940: la sirve la búsqueda de la lista de Products de New sale. Afina la misma primera historia de sales.md, "una venta se registra desde el teléfono en menos de un minuto"; la búsqueda es el atajo cuando las sugerencias no alcanzan).

## Qué es

La **Sale in progress** es la venta que se está armando en New sale antes de guardarla: cliente, líneas, fecha, **Shipping charged**, **Note** y cómo se paga. Es solo del front (`web/src/sales/useSaleDraft.ts`) y vive en memoria durante una apertura de New sale: nunca se guarda en el dispositivo y una recarga la pierde (igual que lo que dice sales.md, criterio 43). Lo que se guarda es la **Sale**, con las reglas de sales.md.

Hasta la parte de GH-496 que la monta en pantalla (el flip), ninguna pantalla la usa: no hay ruta, constante de build, parámetro de consulta, bandera de ventana ni hook `data-*` para llegar a ella, y se prueba solo con tests unitarios, tests de componente y un test del cliente a nivel de fetch.

Antes de esta parte, la vendedora vuelve a elegir en cada venta los mismos clientes, productos y medio de pago, y tipea las cantidades a mano, de a un Product por vez y sin ver de una sola vez lo que ya está en la venta ni lo que suele vender. El costo principal son las elecciones repetidas, y el segundo es tipear cantidades. Cuando el Product pedido no está en la venta ni en "Most sold", hoy se recorre la lista entera a ojo; la búsqueda (#940) reemplaza ese recorrido.

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

El componente `web/src/screens/ventas/NuevaVentaProductos.tsx`, con sus lecturas en `web/src/sales/useNewSaleReads.ts`, sigue los dibujos NuevaVentaProductos y NuevaVentaProductosOscuro (claro y oscuro). Hasta el flip de GH-496 ninguna ruta, entrada de navegación ni pantalla lo monta; solo lo alcanzan sus tests de componente, y los dos módulos figuran en `web/scripts/docs/front-exclude.json` hasta que el flip los conecte (D-62e6dc23).

Diferencias con los dibujos aceptadas por el dueño:

- Desviación 2 del pedido: sin código de barras ni categoría.
- Desviación de dibujo #2 (GH-924, Decisión 3), solo para esta parte: todavía no hay estados de carga ni de fallo; llegan en #941.

La desviación de dibujo #1 de GH-924 (sin búsqueda) quedó retirada con #940. #941 tiene que estar entregada antes de que el flip de GH-496 monte la lista.

### Lecturas

- `useNewSaleReads({ date, openedOn })` lee los Products de la fecha de la venta (`GET /api/products?on=<date>`) y los Pricing settings, con las mismas claves y opciones que New sale: las dos definiciones viven en `web/src/sales/saleFormQueries.ts` (`saleFormProductsQuery`, `saleFormPricingSettingsQuery` y `pricingSettingsOf`), y `NuevaVenta.tsx` usa las mismas sin cambiar su comportamiento. Las sugerencias llegan solo por el cliente de New sale suggestions con `openedOn`, así que cambiar la fecha de la venta nunca las vuelve a pedir.
- Devuelve los Products (null mientras no llegó ninguna respuesta; durante un cambio de fecha, la lista de la fecha anterior), si son los de la fecha actual (`productsForDate`), los Pricing settings de esa fecha (null hasta que llegan, y también mientras solo están los de la fecha anterior), los ids de "Most sold" (null mientras se piden) y el error de Products o de Pricing settings, si lo hay. Un fallo de las sugerencias nunca es un error.
- La cifra de Stock de cada fila sale de la lectura de Stock (`GET` de Stock, clave `keys.stock()`), aparte de las otras.
- La búsqueda no agrega ninguna lectura: filtra en el front los Products que la lista ya recibió.

### Cuándo se muestra la lista

- Una sola condición decide: mientras faltan los Products, los Pricing settings o los ids de "Most sold", los Products no son los de la fecha de la venta, falló la lectura de Products o de Pricing settings, o el Customer está pendiente (`customerTypeId` en `'pending'`), la lista no muestra nada: ninguna fila, sección, cifra, aviso ni "Results · N", y tampoco una interfaz de carga provisoria. La venta conserva todas sus líneas mientras tanto.
- El campo de búsqueda queda fuera de esa condición: se muestra siempre y conserva su texto.
- `'pending'` significa solo una lectura del Customer en curso; qué significa una lectura del Customer fallida lo decide quien monta la lista, nunca la lista.
- Así, ningún precio, "No price", cifra de Stock, "+" de una fila fuera de la venta, aviso, conteo de resultados ni encabezado de sección se muestra antes de tiempo, y nada se recotiza mientras el Customer está pendiente.
- Durante un cambio de fecha o de Customer la lista entera, líneas incluidas, desaparece hasta que llegan los datos y vuelve con las mismas líneas, en el mismo orden y con las mismas cantidades, cotizadas de nuevo. Conservar los nombres y los pasos con una marca de carga es de #941.
- La cifra de Stock no está dentro de esa condición: una fila puede aparecer antes que su línea de Stock, o quedarse sin ella si esa lectura falla. El corrimiento que eso produce se juzga en el recorrido del flip.

### Filas

- Cada fila muestra el nombre del Product en tinta, debajo, en su propia línea y en gris, "{stock} in stock"; a la derecha, el precio (o "No price") en cifras tabulares y los pasos.
- El Stock se muestra tal cual, 0 y negativos incluidos ("0", "-3,5", "1,5 in stock"), y una línea con más cantidad que el Stock no cambia ese texto: la lista no calcula ningún Stock restante. Un Product con Stock en cero o negativo se puede agregar igual: el Stock solo informa. Lo único que impide agregar es no tener precio.
- Una fila que no está en la venta muestra el precio por unidad que pagaría este Customer al agregarla, de `rowPrices`, sin totales.
- Una línea muestra su propio precio por unidad, de `priceSale` sobre las líneas de la venta (vía `saleLineInputsOf`, envío 0). Puede diferir del de la fila, por ejemplo por un Bulk price o un precio de Customer type.
- El precio pasa por el formateador de dinero del Business (su símbolo y sus decimales) y no lleva etiqueta de Unit, para que sirva a cualquier Business.
- "No price" se muestra exactamente cuando la fila no tiene precio; el componente nunca lee `current_price` por su cuenta (solo `nothingSellable`, para el aviso).

### Pasos

- Una fila fuera de la venta y con precio tiene "+" (nombre accesible "Add {name}"), que agrega el Product.
- Una línea tiene, en un grupo nombrado por el Product: "−" ("Remove one {name}"), la cantidad de solo lectura y "+" ("Add one {name}").
- La lista no fija ningún paso ni hace cuentas de cantidad: lo decide la Sale in progress (ver Líneas), y "−" desde 1 o menos saca la línea. Un Product que sale de la venta vuelve a "Most sold" si está entre las sugerencias.
- Una línea sin precio muestra "No price", "−" y la cantidad, sin "+"; el lugar del "+" queda vacío para que "−" no se mueva. Una línea que pierde su precio por un cambio de fecha se queda en la venta hasta que la vendedora la saca con "−"; ninguna acción de la lista pierde una línea.
- Una línea cuyo Product la lectura de Products ya no devuelve (archivado o eliminado en otro lado después de agregarlo) también se queda: muestra, en lugar del nombre, el texto compartido "no longer available" (el mismo que usa el Selector para una elección que ya no se ofrece), "No price", su cantidad y "−", que la saca como a cualquier línea. Nunca muestra un id interno ni un nombre adivinado. Su grupo y su "−" usan ese mismo texto como nombre, sin clave de copy nueva. Queda en "In the sale" en el orden en que se agregó y cuenta en su número, nunca aparece en "Most sold" ni en los resultados de una búsqueda, y no tiene "+". Qué pasa al guardar con una línea así es de la parte del guardado.
- Los botones miden al menos 44x44 px, no seleccionan texto, responden al toque sin demora y sus glifos están ocultos para la accesibilidad. Cada botón es su propia pastilla en el tono suave del acento (el dibujo los agrupa en una sola pastilla; el dueño lee y hace lo mismo).
- Todavía no hay forma de tipear una cantidad en la lista: 10 unidades son 10 toques. Dónde vive la cantidad tipeada lo decide el flip.

### Búsqueda

(#940.) Sirve para encontrar por nombre un Product que no está en la venta ni en "Most sold". Solo acota lo que se muestra: nunca cambia la Sale in progress, sus líneas ni sus cantidades.

- **Campo**: arriba de todo, construido como la búsqueda de Customers. Etiqueta visualmente oculta "Search products" y placeholder "Search by name"; `type="search"`, `inputMode="search"`, `autoComplete="off"`, `enterKeyHint="search"`, con letra de al menos 16 px para que el teléfono no haga zoom. Se muestra siempre y conserva su texto, también mientras la lista no muestra nada.
- **Qué coincide**: el texto tipeado, recortado, coincide en cualquier parte del nombre del Product tal como lo escribió la vendedora, sin importar mayúsculas ni acentos (la misma regla que la búsqueda de Customers). No supone marca, tipo de producto ni Unit.
- **Texto solo de espacios** cuenta como búsqueda vacía: se ve la lista normal, con el aviso, "In the sale" y "Most sold".
- **Qué cubre**: solo los Products que la lista ya recibe (nunca Archived products ni nada de otro Business). Una línea "no longer available" no tiene nombre, así que nunca coincide; no se muestra mientras se busca y vuelve al borrar la búsqueda, sin perderse nunca de la venta.
- **Resultados**: con texto, "Results · {n}" y debajo las coincidencias, ordenadas por nombre sin importar mayúsculas ni acentos; n es la cantidad de filas mostradas. Sin coincidencias, solo "Results · 0", nada más. Mientras se busca no se muestran el aviso, "In the sale" ni "Most sold".
- **Filas de resultados**: cada una es la misma fila que en la lista sin búsqueda. Un Product que ya está en la venta aparece con su línea (pasos, cantidad y su propio precio); uno sin precio, con "No price" y sin "+".
- **Resaltado**: el nombre lleva un elemento `mark` sobre la primera coincidencia, en peso 600 y con el token del acento. El `mark` cubre los caracteres del nombre tal como está escrito, aunque la coincidencia haya sido ignorando un acento o una mayúscula; el nombre mostrado nunca cambia.
- **Después de tocar un resultado**: el texto de búsqueda queda; solo la vendedora lo borra. Así puede agregar varios Products que coinciden con las mismas letras sin volver a tipear, y la venta sigue con a lo sumo una línea por Product.
- **Limpiar**: no hay un control propio para limpiar; el campo sigue al dibujo: si el estado de búsqueda de NuevaVentaProductos dibuja uno, se construye ese, y si no dibuja ninguno, no se agrega. Borrar el texto devuelve la lista exactamente como estaba: las mismas secciones, filas y orden.
- **Sin filtros**: solo por nombre; nada de filtros por Stock, precio, Hidden product ni Catalog attributes.

### Secciones

- Con la búsqueda vacía: arriba va el aviso, cuando corresponde; después, "In the sale · {n}" con las líneas en el orden en que se agregaron, solo si hay líneas.
- Debajo, "Most sold" se muestra solo si tiene filas: conserva el orden de las sugerencias, deja afuera los Products que ya están en la venta y los ids que la lectura de Products no devolvió, y aplica el tope (`MOST_SOLD_ROWS`) después de filtrar. Sale solo del propio Business, sin Gifts ni Archived products, y nunca fija un precio, un monto ni una cantidad.
- Con texto en la búsqueda, las secciones no se muestran: solo los resultados (ver Búsqueda).
- Los encabezados de sección y el de resultados son chicos, en negrita media y en gris, como en el dibujo.
- Sin Sales todavía (y sin líneas), el cuerpo con la búsqueda vacía queda vacío: ninguna fila, encabezado ni aviso. Un Product que no está en la venta ni en "Most sold" se alcanza con la búsqueda.

### Aviso

- Cuando no hay nada para vender, debajo de la búsqueda y arriba de las secciones se muestra, con el Attention icon y sin poder tocarse, el aviso de que no hay Products (`selectorNoVarieties`) o el de que ninguno tiene precio para esa fecha (`NO_PRICE_HINT`), según `nothingSellable`.
- Sigue a la fecha de la venta, se muestra solo cuando la lista se muestra (ver "Cuándo se muestra la lista") y se oculta mientras se busca.

### Fallos

- Hasta #941, un fallo de la lectura de Products o de Pricing settings deja el cuerpo vacío, igual que mientras se carga (el campo de búsqueda sigue a la vista, sin resultados ni conteo); la venta conserva sus líneas. Ningún test fija ese cuerpo vacío como el comportamiento buscado: lo define #941.
- Un fallo de las sugerencias no muestra ningún error y solo deja sin "Most sold".

### Textos

En el Copy module (`web/src/copy/sales.ts`, grupo `newSale` de `SALES_TEXT`), en inglés y sin palabras de Unit ni de tipo de producto: `productsInSale` "In the sale · {n}", `productsMostSold` "Most sold", `productStock` "{stock} in stock", `productNoPrice` "No price", `productAdd` "Add {name}", `productIncrease` "Add one {name}", `productDecrease` "Remove one {name}", y desde #940 `productsResults(n)` "Results · {n}", `productSearchLabel` "Search products" y `productSearchPlaceholder` "Search by name". Están registrados en LIMITED_COPY y BASELINE_ARGS. El texto "no longer available" se reutiliza del existente, no se agrega. El baseline (`en.baseline.json`) se regenera con su paso, nunca se edita a mano.

### Diseño

- Colores, tipografía y espacios salen solo de los tokens; el modo oscuro es el mismo marcado con los tokens oscuros.
- Las diferencias aprobadas con los dibujos son las de arriba (desviación 2 y desviación de dibujo #2). Diferencias de peso y tono que se leen igual (precio y nombre más livianos que en el dibujo, pasos en pastillas separadas) quedan como observaciones. Cualquier otra diferencia que el dueño leería o haría distinto en el teléfono se le plantea al dueño en el PR; nadie la acepta como supuesto.
- El estado de búsqueda se compara a ojo con NuevaVentaProductos y NuevaVentaProductosOscuro, claro y oscuro, con la Design capture adjunta al PR. Esa captura decide, como desviación para el dueño si difiere, cómo se ve un Product de la venta en los resultados, qué pasa con el texto después de un toque y si el dibujo muestra un control para limpiar.
- El corrimiento de contenido y el blanco durante la carga se juzgan en el recorrido del flip.

## Fuera de esta capacidad (por ahora)

- Cualquier ruta, entrada de navegación, pantalla o Sheet que monte la Sale in progress o la lista de Products, y el flip que las monta.
- Los estados de carga y de fallo de la lista: filas esqueleto ocupadas, marca compacta de carga al cambiar fecha o Customer conservando nombres y pasos, sin conexión y error genérico, y la recuperación tras un fallo (#941).
- Qué significa para la lista una lectura del Customer fallida (lo decide y prueba el flip).
- La cantidad tipeada en la lista (flip). Un control propio para limpiar la búsqueda que el dibujo no muestre.
- Filtros de la lista por Stock, precio, Hidden product o Catalog attributes.
- Los pasos de cliente, pago y guardado de New sale, incluido qué pasa al guardar una línea cuyo Product ya no está disponible.
- Código de barras, categoría y elementos de promoción en la lista de Products.
- Reescribir el criterio 34 de sales.md ("el medio nunca viene puesto"), que le corresponde a la parte que preselecciona el medio en pantalla.
- Gift, Special price y la Sheet del detalle de línea.
- Conservar la venta en curso tras una recarga.
- Cualquier cambio en el servidor.

## Métricas

- Cada regla de Líneas, Sin guardar, Cómo se paga, Cliente y owing, y Apertura tiene su test unitario de la Sale in progress, y pasa.
- Cliente de sugerencias, a nivel de fetch: exactamente 1 pedido por apertura, con `on` igual a la fecha de apertura; 0 pedidos nuevos después de editar la fecha o volver a dibujar; 1 pedido nuevo en una apertura de otro día; una lectura fallida da ninguna sugerencia y 0 errores lanzados.
- Lista de Products, en tests de componente a nivel de fetch: cada caso de la lista (pasos, cantidades tipeadas, una línea por Product, "No price", línea que pierde su precio, línea cuyo Product ya no vuelve, sugerencias filtradas y con tope, Stock, bulk a 10, recotización por Customer y por fecha, aviso, símbolo y decimales del Money format, nada antes de tiempo) tiene su test y pasa; 0 pedidos nuevos de sugerencias tras cambiar la fecha; 0 cambios en los totales de la venta al mostrar más filas.
- Búsqueda, en `NuevaVentaProductos.test.tsx` con el arnés de #924: mayúsculas, acentos, coincidencia en cualquier parte, orden por nombre, "Results · 0" sin nada más, resaltado de la primera coincidencia sobre los caracteres originales, texto solo de espacios como vacío, aviso y secciones ocultos mientras se busca, Product de la venta con su línea en los resultados; cada caso tiene su test y pasa.
- Al borrar la búsqueda, diferencias en secciones, filas u orden respecto de antes de buscar: 0. Cambios en la Sale in progress (líneas, cantidades, orden) causados por tipear o borrar en la búsqueda: 0. Pedidos de red nuevos causados por la búsqueda: 0.
- Líneas perdidas por una acción de la lista, una búsqueda o una recarga de Products: 0. Ids internos mostrados en pantalla: 0.
- Cifras mostradas antes de que lleguen todas las lecturas o mientras el Customer está pendiente (dígitos, símbolo de moneda, "No price", aviso, encabezados, "Results · N"): 0.
- Operaciones de dinero en `useSaleDraft`, en el cliente de sugerencias y en la lista de Products: 0 (todo pasa por `pricing.ts`).
- Rutas, constantes, parámetros, banderas, props, exports o hooks `data-*` solo para tests: 0.
- Claves del Copy module de la lista de Products: 10 (7 de #924 y 3 de #940), en inglés y sin palabras de Unit ni de tipo de producto; `en.baseline.json` regenerado con su paso, 0 ediciones a mano.
- Gate (pytest, vitest, e2e) pasa, y tsc strict y oxlint pasan sin nada silenciado.
- Vara del trabajo, que se juzga cuando el flip la monte: una venta se registra desde el teléfono en menos de un minuto (sales.md, criterio 1); un Product habitual se encuentra, se agrega y se ajusta sin salir de la lista (1 toque para un Product habitual a 1 unidad desde "Most sold"), y uno que no está en "Most sold" se agrega tipeando parte de su nombre y con un toque en su resultado.
