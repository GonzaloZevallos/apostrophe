# Sale in progress

## Jobs

**Cuando** entrego un pedido y lo registro en el teléfono, **quiero** armar la venta con los clientes, productos y el medio de pago que suelo elegir, ajustando solo cantidades y con cada total calculado por la app, **para** guardar la venta en menos de un minuto y nunca cotizar de memoria ni volver a tipear lo que elegí hace un momento. (Parte 3 de GH-496: la sirven el estado de la venta en curso, `useSaleDraft`, y el cliente del front de las **New sale suggestions**. Afina la primera historia de sales.md; no es un trabajo nuevo).

**Cuando** termino de armar una venta en New sale, **quiero** ver lo que estoy por cobrar y decir cómo me pagaron, o que me lo deben, **para** guardar la venta de un toque con el pago correcto y la deuda correcta. (Parte 2 de GH-867: la sirve la **Collect Sheet**. Es el paso de cierre del trabajo de BRIEF "una venta se registra desde el teléfono en menos de un minuto"; no es un trabajo nuevo. "Que me lo deben" llega con #944).

## Qué es

La **Sale in progress** es la venta que se está armando en New sale antes de guardarla: cliente, líneas, fecha, **Shipping charged**, **Note** y cómo se paga. Es solo del front (`web/src/sales/useSaleDraft.ts`) y vive en memoria durante una apertura de New sale: nunca se guarda en el dispositivo y una recarga la pierde (igual que lo que dice sales.md, criterio 43). Lo que se guarda es la **Sale**, con las reglas de sales.md.

Hasta la parte de GH-496 que la monta en pantalla (el flip), ninguna pantalla la usa: no hay ruta, constante de build, parámetro de consulta, bandera de ventana ni hook `data-*` para llegar a ella ni a la Collect Sheet, y se prueban solo con tests unitarios, de componente y del cliente a nivel de fetch.

Antes de esta parte, la vendedora vuelve a elegir en cada venta los mismos clientes, productos y medio de pago, y tipea las cantidades a mano. El costo principal son las elecciones repetidas, y el segundo es tipear cantidades. Hoy dice cómo le pagaron en el mismo formulario de New sale; la Collect Sheet pasa esa elección a un paso de cierre sin cambiar qué significan Payment, On-the-spot payment, Balance, Settlement ni Owing since. Un pago parcial sigue siendo un Payment posterior registrado con Record payment.

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

- Ni la Sale in progress, ni el cliente de sugerencias, ni la Collect Sheet calculan dinero. Toda cifra de la venta (precio de la fila, total de la línea, total de la barra, total de Collect, aviso de recotización) sale de `priceSale`/`priceLine` en `web/src/sales/pricing.ts`, calculada por la pantalla anfitriona. El Shipping charged y la Note se guardan tal como se ingresaron.

## Collect Sheet

El paso de cierre de New sale, `web/src/screens/ventas/CollectSheet.tsx`, dibujado dentro de la Sheet compartida (`web/src/components/Sheet.tsx`) a partir del dibujo NuevaVentaCobrar y su gemelo oscuro (salida aceptada 3), con la misma división que Cobro/CobroRoute. Sirve igual para entregar en la puerta que para registrar una venta después: la fecha viene de la Sale in progress. No tiene ruta hasta el flip de GH-496, así que no tiene Design capture ni Screen image.

### Props

- `draft` (`SaleDraftApi`), `priced` (`PricedSale`, la única fuente de precios de la pantalla anfitriona, que nunca se vuelve a calcular: ninguna llamada a `priceSale` ni `priceLine` ni consulta de precios), `customerName` (`string | null`), `onClose()`, `onSaved(sale)` y `onSavingChange(saving)`, más las props de marco de la Sheet para la computadora, que pasan tal cual.
- La pantalla anfitriona maneja Escape y el volver del sistema; la Sheet no agrega ningún listener de Escape ni de popstate.
- La pantalla anfitriona no abre la Collect Sheet mientras alguna línea no tenga precio para la fecha de la venta (sin Current price, y que no sea Gift ni Special price); lo señala en la propia línea. Esa regla es del flip de GH-496.

### Lo que ve la vendedora

- Título "The sale · 1 item" para una línea y "The sale · {n} items" para cualquier otro n, con n = `priced.lines.length` (cuenta líneas, no unidades).
- Una fila de Customer de solo lectura, sin "Cambiar" ni chevron: "No customer" cuando la Sale in progress no tiene cliente; si no, `customerName`, o un marcador de carga compacto y sin texto mientras el nombre todavía no llegó. Para cambiar el cliente, la vendedora cierra la Sheet, lo cambia en New sale y la vuelve a abrir.
- Un **Selector** "How they pay", con los Payment methods ofrecidos por `usePaymentMethodOptions` (que también da `offeredIds`, los ids de la lista leída, o `null` mientras no hay lista). Su valor sale de `selectorValueOf`: el medio elegido (paid(id)), o la propuesta (`proposedMethodId`) con unset solo si está ofrecida; si no, el campo queda vacío ("Choose a method"). Elegir un medio guarda paid(id) mediante `choiceOfValue`. Una elección owing que ya traiga el borrador se muestra como campo vacío y se rechaza como "sin medio". La opción "Owes it" no está en esta parte (llega con #944).
- Un botón fijo abajo "Collect {total}" con `priced.totals.total` en el **Money format** del Business, en Tabular figures, con la misma etiqueta para cualquier elección.

### Estados de la lista de medios

- Pendiente: el Selector muestra que carga y Collect queda deshabilitado, con su etiqueta.
- Llegada: Collect queda habilitado.
- El estado fallido (el Selector muestra su fallo y Collect sigue habilitado) llega con #930.

### Collect

- Al tocar, llama a `validateSale({...payStateOfEffective(efectivo), total: priced.totals.total, hasCustomer, lines: lineValidationsOf(priced)})`, donde `efectivo` es `collectableChoice(effectiveChoice(...))`; es el único lugar que rechaza el pago. `payStateOfEffective` lee "ningún medio" como pagar sin medio conocido, que `validateSale` rechaza por encima de $0 y deja pasar en $0. `collectableChoice` trata owing como ninguna elección hasta #944. `lineValidationsOf` solo lee lo que `priced` ya dice de cada línea.
- Orden de un toque: primero una línea sin precio (no hace nada), después el error de medio, después guardar.
- Si `priced` trae una línea sin precio para la fecha de la venta, el toque no manda nada (0 pedidos), no muestra "Saving…" ni ningún texto nuevo y no llama a `onSavingChange`. Es solo una guarda: se lee lo que `priced` ya dice de la línea, nunca se calcula un precio, y la vendedora no llega a ese estado porque la pantalla anfitriona no abre la Sheet.
- Sin medio por encima de $0 no se manda nada: se muestra "Choose how they pay to collect." en el `FieldRefusal` debajo del Selector, con el **Attention icon** y ligado por `describedBy`, y se enfoca el campo. Elegir un medio borra el rechazo.
- Una venta de $0 sin medio se guarda con `payment: null`; una de $0 con un medio elegido lo manda.
- Si no, el botón muestra "Saving…" de inmediato, los toques siguientes no mandan nada (una guarda que se activa antes del pedido, así que dos toques seguidos hacen un solo pedido), llama a `onSavingChange(true)` y hace `POST /api/sales` con el cuerpo armado solo por `saleBodyOf`: líneas desde la Sale in progress con `bodyLinesOf` (que usa `quantityOfHundredths`, sin Gift ni Special price); fecha y Note desde la Sale in progress (una Note en blanco va como null) y el Shipping charged desde `priced.totals.shippingCharged`, para que la etiqueta y el cuerpo no puedan discrepar.
- Mientras guarda, el Close propio de la Sheet no hace nada y nada más lo señala: "Saving…" es la única señal. El campo queda bloqueado (`inert`) y Collect no toma toques. Un 401 llega al límite de sesión compartido.

### Resultado

- Éxito: `onSavingChange(false)` y después `onSaved` con la respuesta del servidor sin tocar, aunque su total difiera de `priced`. La Sheet no muestra ninguna cifra propia después.
- Rechazo del pedido: `onSavingChange(false)`, sin ningún texto; las líneas y el medio se conservan, Collect se puede volver a tocar y Close vuelve a funcionar. Los textos de fallo, el estado fallido de la lista, la marca "no longer available" y el reintento llegan con #930. Hasta entonces un guardado fallido no dice nada, por eso el flip de GH-496 no sale antes de #930 y #944.

### Textos

- Viven en `SALES_TEXT`, el módulo de ventas de `web/src/copy/`, en inglés y sin palabra de unidad, moneda ni tipo de producto: `collectTitle(n)`, `howTheyPay` ("How they pay"), `chooseMethod` ("Choose a method"), `noMethodToCollect` ("Choose how they pay to collect."), `collect(total)` ("Collect {total}") y `saving` ("Saving…"). "No customer" ya existía. "Owes it" llega con #944 y el texto de guardado fallido con #930.

### Hueco conocido

- Una venta cuya respuesta se perdió después de que el servidor la guardó puede registrarse dos veces al reintentar, e inflar Sales, Profit y, si se debe, el Balance del Customer. No hay protección en el repo; requiere trabajo en el servidor y va como pieza propia. Se tiene que resolver antes del flip de GH-496.

## Cliente de las New sale suggestions

- Vive en `web/src/api/` y lee `GET /api/sales/suggestions` con `on` obligatorio. La lectura del servidor está definida en sales.md ("New sale suggestions").
- `openedOn` (el día de la apertura) se fija una sola vez al abrir New sale y ninguna acción lo cambia; es la única fecha que lee el cliente de sugerencias, nunca la fecha editable de la venta. Editar la fecha o que cambie el día después no vuelve a pedirlas.
- Una sesión perdida (401) en la lectura manda a la vendedora a iniciar sesión, como cualquier otra lectura; cualquier otro fallo (otro estado, red caída, cuerpo mal formado) da ninguna sugerencia, en silencio y sin escribir en la consola.
- La respuesta replica la del servidor: `recent_customer_ids` y `most_sold_product_ids` (listas de ids) y `last_payment_method_id` (un id o null).
- Se pide una sola vez por apertura de New sale, con la fecha de apertura como clave. Volver a dibujar o editar la fecha de la venta nunca la vuelve a pedir ni la cambia; una apertura nueva otro día es una clave nueva.
- Las sugerencias solo acortan elecciones: nunca fijan un precio, un monto ni una cantidad.

## Fuera de esta capacidad (por ahora)

- La pantalla anfitriona de New sale que monta la Collect Sheet, el flip que la monta y su regla de no abrirla con una línea sin precio.
- Reescribir el criterio 34 de sales.md ("el medio nunca viene puesto"), que le corresponde al flip, cuando la preselección llegue a la vendedora.
- Received y Change en la Collect Sheet.
- La opción "Owes it" (#944) y todo camino de fallo del guardado: estado fallido de la lista de medios, medio archivado con su marca "no longer available", texto de guardado fallido y reintento (#930).
- Un texto propio de la Collect Sheet para una línea sin precio.
- Gift, Special price y la Sheet del detalle de línea.
- Conservar la venta en curso tras una recarga.
- Cualquier cambio en el servidor, incluida la protección contra el doble registro.

## Métricas

- Cada regla de Líneas, Sin guardar, Cómo se paga, Cliente y owing, y Apertura tiene su test unitario de la Sale in progress, y pasa.
- Cliente de sugerencias, a nivel de fetch: exactamente 1 pedido por apertura, con `on` igual a la fecha de apertura; 0 pedidos nuevos después de editar la fecha o volver a dibujar; 1 pedido nuevo en una apertura de otro día; una lectura fallida da ninguna sugerencia y 0 errores lanzados.
- Collect Sheet, con Testing Library a nivel de fetch: sin medio por encima de $0, 0 pedidos y el campo enfocado; con una línea sin precio en `priced`, 0 pedidos, ningún texto nuevo y ninguna llamada a `onSavingChange`; mientras guarda, toques extra y Close dan 0 pedidos adicionales; tras un pedido rechazado, `onSavingChange` termina en false y Close vuelve a funcionar; un borrador que ya trae owing no se manda; la etiqueta de Collect es igual a `priced.totals.total` formateado y `onSaved` recibe la respuesta sin tocar.
- Operaciones de dinero en `useSaleDraft`, el cliente de sugerencias y la Collect Sheet: 0 (todo pasa por `pricing.ts`), y llamadas a `priceSale`/`priceLine` desde la Collect Sheet: 0.
- Rutas, constantes, parámetros, banderas o hooks `data-*` solo para tests: 0.
- Textos de la Collect Sheet fuera de `web/src/copy/`: 0.
- Gate (vitest para esta parte; pytest, vitest y e2e en general): pasa.
- Vara del trabajo, que se juzga cuando el flip la monte: una venta se registra desde el teléfono en menos de un minuto (sales.md, criterio 1), y con el medio propuesto ya elegido se guarda con a lo sumo una elección y un toque en Collect.
