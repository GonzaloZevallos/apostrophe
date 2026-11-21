# Sale in progress

## Jobs

**Cuando** entrego un pedido y lo registro en el teléfono, **quiero** armar la venta con los clientes, productos y el medio de pago que suelo elegir, ajustando solo cantidades y con cada total calculado por la app, **para** guardar la venta en menos de un minuto y nunca cotizar de memoria ni volver a tipear lo que elegí hace un momento. (Parte 3 de GH-496: la sirven el estado de la venta en curso, `useSaleDraft`, y el cliente del front de las **New sale suggestions**. Afina la primera historia de sales.md; no es un trabajo nuevo).

**Cuando** termino de armar una venta en New sale, **quiero** ver lo que estoy por cobrar y decir cómo me pagaron, o que me lo deben, **para** guardar la venta de un toque con el pago correcto y la deuda correcta. (Parte 2 de GH-867: la sirve la **Collect Sheet**. Es el paso de cierre del trabajo de BRIEF "una venta se registra desde el teléfono en menos de un minuto"; no es un trabajo nuevo).

**Cuando** le entrego un pedido a un cliente que conozco y se lo lleva sin pagar ahora, **quiero** guardar la venta como adeudada con los mismos pocos toques que una venta pagada, **para** que su Balance y su Owing since la muestren y pueda cobrarla después sin perder la fecha. (#944: la sirve la opción "Owes it" de la **Collect Sheet**. Son los dos primeros trabajos de BRIEF, registrar una venta en pocos toques y saber quién debe qué y desde cuándo, aplicados a New sale; no es un trabajo nuevo).

**Cuando** estoy cerrando una venta en el teléfono y algo falla (no cargan los medios de pago o el guardado no pasa), **quiero** ver en palabras simples qué pasó y terminar con un toque más, con mis líneas y el medio que elegí todavía ahí, **para** que la venta quede registrada y nunca la vuelva a tipear, la pierda o crea que se guardó cuando no se guardó. (#930: la sirven los caminos de fallo de la **Collect Sheet**. Es la versión de fallo de la misma primera historia de sales.md; no es un trabajo nuevo).

**Cuando** un cliente me manda su pedido y armo la venta en el teléfono, **quiero** encontrar cada Product que pidió y fijar cuánto con un toque o dos, viendo lo que ya está en la venta, **para** que cada línea salga con los precios de ese día y nunca tipee un precio ni cotice de memoria. (Parte 2 de GH-863: la sirve la lista de Products de New sale. Afina la misma primera historia de sales.md, acotada a elegir Products y cantidades; cliente, pago y guardado son de otras partes).

## Qué es

La **Sale in progress** es la venta que se está armando en New sale antes de guardarla: cliente, líneas, fecha, **Shipping charged**, **Note** y cómo se paga. Es solo del front (`web/src/sales/useSaleDraft.ts`) y vive en memoria durante una apertura de New sale: nunca se guarda en el dispositivo y una recarga la pierde (igual que lo que dice sales.md, criterio 43). Lo que se guarda es la **Sale**, con las reglas de sales.md.

Hasta la parte de GH-496 que la monta en pantalla (el flip), ninguna pantalla la usa: no hay ruta, constante de build, parámetro de consulta, bandera de ventana ni hook `data-*` para llegar a ella ni a la lista de Products ni a la Collect Sheet, y se prueban solo con tests unitarios, de componente y del cliente a nivel de fetch.

Antes de esta parte, la vendedora vuelve a elegir en cada venta los mismos clientes, productos y medio de pago, y tipea las cantidades a mano, de a un Product por vez y sin ver de una sola vez lo que ya está en la venta ni lo que suele vender. El costo principal son las elecciones repetidas, y el segundo es tipear cantidades. Hoy dice cómo le pagaron en el mismo formulario de New sale; la Collect Sheet pasa esa elección a un paso de cierre sin cambiar qué significan Payment, On-the-spot payment, Balance, Settlement ni Owing since. Un pago parcial sigue siendo un Payment posterior registrado con Record payment.

En la planilla, una venta sin pagar era una fila sin pago, y saldarla después pisaba la deuda (BRIEF, Problema). "Owes it" existe para que la vendedora nunca necesite inventar un Payment, ni uno de $0, para que los libros den bien: eso falsearía el Cash y el Money in y dejaría mal el Owing since. Es un supuesto decidido en la entrevista de #944, no verificado.

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
- La Sale in progress no recuerda una elección anterior: pasar de owing a unset deja unset, nunca el medio elegido antes.

### Cliente y owing

- Desde #944, sacar el cliente con `choice` en owing conserva owing: la Sale in progress no cambia la elección por su cuenta, para que una venta adeudada nunca pase en silencio a pagada con el medio propuesto (un Payment que nadie hizo). La Collect Sheet se encarga de no guardarla (ver Collect Sheet). Antes de #944 la volvía a unset; esa regla queda reemplazada.
- Cambiar a otro cliente conserva la elección, owing incluido.
- Sacar el cliente conserva paid(id), porque una **Sale without a customer** se permite pagada por completo.
- Elegir owing sin cliente se conserva tal cual; rechazar el guardado es de la API y de la pantalla.
- La Sale in progress no tiene ningún cambio automático de `choice`.

### Apertura

- Cada apertura de New sale empieza sin líneas, con `choice` en unset, sin Shipping charged ni Note y con la fecha de hoy en el día del Business.
- El cliente arranca vacío, salvo que la apertura traiga uno (New sale desde la ficha de un cliente).

### Dinero

- Ni la Sale in progress, ni el cliente de sugerencias, ni la lista de Products, ni la Collect Sheet calculan dinero. Toda cifra de la venta (precio de la fila, total de la línea, total de la barra, total de Collect, aviso de recotización) sale de `priceSale`/`rowPrices`/`priceLine` en `web/src/sales/pricing.ts`, calculada por la pantalla anfitriona. El Shipping charged y la Note se guardan tal como se ingresaron.

## Collect Sheet

El paso de cierre de New sale, `web/src/screens/ventas/CollectSheet.tsx`, dibujado dentro de la Sheet compartida (`web/src/components/Sheet.tsx`) a partir del dibujo NuevaVentaCobrar y su gemelo oscuro (salida aceptada 3), con la misma división que Cobro/CobroRoute. Sirve igual para entregar en la puerta que para registrar una venta después: la fecha viene de la Sale in progress. No tiene ruta hasta el flip de GH-496, así que no tiene Design capture ni Screen image. Los estados de fallo y el estado "Owes it" sin cliente no tienen dibujo aprobado: sus textos y marcas salen de componentes compartidos (Selector y su marca "no longer available", `FieldRefusal` con el Attention icon, el pie de la Sheet), sin componente, color ni tamaño nuevos, y si aparece un dibujo que muestre otra cosa, la diferencia la decide el dueño. Donde el dibujo difiere, ganan las decisiones escritas: el dibujo ofrece "Queda debiendo" sin cliente (acá solo con cliente), usa un select nativo (acá el Selector) y su fila de Customer se puede tocar (acá es de solo lectura, desde #918).

### Props

- `draft` (`SaleDraftApi`), `priced` (`PricedSale`, la única fuente de precios de la pantalla anfitriona, que nunca se vuelve a calcular: ninguna llamada a `priceSale` ni `priceLine` ni consulta de precios), `customerName` (`string | null`), `onClose()`, `onSaved(sale)` y `onSavingChange(saving)`, más las props de marco de la Sheet para la computadora, que pasan tal cual.
- La pantalla anfitriona maneja Escape y el volver del sistema; la Sheet no agrega ningún listener de Escape ni de popstate.
- La pantalla anfitriona no abre la Collect Sheet mientras alguna línea no tenga precio para la fecha de la venta (sin Current price, y que no sea Gift ni Special price); lo señala en la propia línea. Esa regla es del flip de GH-496.

### Lo que ve la vendedora

- Título "The sale · 1 item" para una línea y "The sale · {n} items" para cualquier otro n, con n = `priced.lines.length` (cuenta líneas, no unidades).
- Una fila de Customer de solo lectura, sin "Cambiar" ni chevron: "No customer" cuando la Sale in progress no tiene cliente; si no, `customerName`, o un marcador de carga compacto y sin texto mientras el nombre todavía no llegó. Para cambiar el cliente, la vendedora cierra la Sheet, lo cambia en New sale y la vuelve a abrir.
- Un **Selector** "How they pay", con los Payment methods ofrecidos por `usePaymentMethodOptions` (que también da `offeredIds`, los ids de la lista leída, o `null` mientras no hay lista). Lo que muestra lo decide un solo lugar, la función pura `howTheyPayView` de `web/src/sales/paymentMethods.ts`: las opciones (los medios sin los que esta Sheet tuvo rechazados y, con cliente, "Owes it" al final), el valor y la entrada marcada como "no longer available". El valor sale de `selectorValueOf`: el medio elegido (paid(id)), "Owes it" (owing, con el valor `OWING_VALUE`, que nunca es un id de Payment method), o la propuesta (`proposedMethodId`) con unset solo si está ofrecida y no fue rechazada; si no, el campo queda vacío ("Choose a method"). Elegir un medio guarda paid(id) mediante `choiceOfValue`.
- La opción "Owes it" (#944) se ofrece solo cuando la Sale in progress tiene cliente (`draft.state.customerId`), siempre última, después de los Payment methods del Business en el orden de su propia lista, con el mismo estilo que los medios, sin ícono, marca ni descripción propios, y sin importar el total. Elegirla llama a `draft.setChoice({kind:'owing'})`. No es un Payment method: es la ausencia de un Payment, nunca está en la lista de Payment methods del Business y Settings no la renombra, archiva ni reordena. Record payment nunca la ofrece.
- Salir de "Owes it" eligiendo un medio, desde cualquier estado, guarda paid(id) de ese medio. Pasar a unset deja que el campo muestre la propuesta o quede vacío, nunca el medio elegido antes; pero ningún toque de la Sheet llega a unset desde "Owes it", porque el Selector compartido es obligatorio y no tiene fila para vaciarlo (ver Huecos conocidos). Solo se alcanza desde la Sale in progress.
- Con owing y sin cliente (el cliente se sacó en New sale), el campo sigue mostrando "Owes it" con la marca existente "no longer available" ("Owes it" queda como valor pero no como opción), la lista muestra solo los medios, y nunca se pone otro medio en su lugar. Volver a poner un cliente la deja válida otra vez sin ningún paso más; elegir un medio también borra la marca.
- Un botón fijo abajo "Collect {total}" con `priced.totals.total` en el **Money format** del Business, en Tabular figures, con la misma etiqueta para cualquier elección, "Owes it" incluida: no hay línea extra ni otra palabra de acción para una venta adeudada.
- En el momento de la venta no se dice nada sobre un Credit del cliente ni hay vista previa del Balance; la cuenta del Customer y el Sale bill muestran el resultado.
- Las líneas debajo del campo tienen cada una su id, y el `describedBy` del Selector apunta exactamente a las que se ven, calculado con la misma expresión que decide cuáles se dibujan.

### Estados de la lista de medios

- Pendiente: el Selector muestra que carga. Collect queda deshabilitado, con su etiqueta, solo mientras la lista se está leyendo, el teléfono tiene conexión y el total es mayor que $0; una venta de $0 nunca queda bloqueada por la lista. Mientras carga no se muestra ningún texto de lista vacía ni de fallo propio de la Sheet.
- Llegada: Collect queda habilitado.
- Fallida (una lectura fallida de `GET /api/payment-methods`, por un error del servidor o un pedido que no llega): sin cliente, el Selector muestra su propia línea de fallo, que es comportamiento compartido de todo Selector (selector.md), y la Sheet no agrega ningún texto propio. Con cliente, "Owes it" llena la lista y el Selector ya no muestra su línea de fallo, así que la Sheet muestra ese mismo texto (`emptySetMessage` del Selector) en un `FieldRefusal` debajo del campo; "Owes it" sigue ofrecida y una venta con "Owes it" se guarda. En los dos casos la Sheet envuelve el campo para que un toque vuelva a leer la lista (`reload`, igual que SelectorPago y Cobro), y no hay aviso de sin conexión. Collect queda habilitado: una venta de $0 sin medio se guarda con `payment: null`, y por encima de $0 sin medio se aplica el rechazo sin medio de abajo, sin mandar nada. Cuando la lista vuelve a llegar y la vendedora elige un medio, el rechazo se borra.
- Vacía (la lista del servidor llegó sin ningún medio): sin cliente, el Selector muestra su propio texto de lista vacía. Con cliente, "Owes it" llena la lista, así que la Sheet muestra ese texto (`selectorNoPaymentMethods`) como texto de ayuda debajo del campo, nunca como rechazo. Se mira la lista del servidor antes de quitar los medios rechazados: cuando todos los medios fueron rechazados por esta Sheet, no se muestra ese texto, solo la línea "no longer available" que corresponda.
- Sin conexión antes de la primera carga: si el teléfono ya avisó que no tiene conexión y la lista nunca llegó, el cargador compartido no falla sino que espera, y el Selector conserva su aspecto de carga en lugar de su línea de fallo. Para la Sheet cuenta igual como lista fallida: Collect queda habilitado, una venta de $0 sin medio se guarda con `payment: null` y por encima de $0 se aplica el rechazo sin medio, sin mandar nada. Al volver la conexión la lista llega sola. El cargador compartido no cambia en esta parte, porque afectaría a New sale y a Record payment.

### Collect

- Al tocar, llama a `validateSale({...payStateOfEffective(efectivo), total: priced.totals.total, hasCustomer, lines: lineValidationsOf(priced)})`, donde `efectivo` es `collectableChoice(effectiveChoice(...))`; es el único lugar que rechaza el pago. `payStateOfEffective` lee "ningún medio" como pagar sin medio conocido, que `validateSale` rechaza por encima de $0 y deja pasar en $0. Desde #944, `collectableChoice` devuelve la elección tal cual, owing incluido: una venta con "Owes it" va por `validateSale`/`payStateOf` y `saleBodyOf` igual que las demás, el cuerpo no lleva ningún pago, y un borrador que ya trae owing con cliente se muestra como "Owes it" y se guarda. `lineValidationsOf` solo lee lo que `priced` ya dice de cada línea.
- Con owing y sin cliente no se manda nada (0 pedidos): se muestra, en el `FieldRefusal` debajo del Selector y con el **Attention icon**, el motivo que `validateSale` ya da para una venta adeudada sin cliente, `OWING_HINT` ("To leave it owing, pick a customer"), y se enfoca el campo, igual que el rechazo sin medio. Volver a poner un cliente o elegir un medio borra el rechazo, y una vez borrado no vuelve solo: si después se saca otra vez el cliente, no aparece hasta el próximo toque en Collect.
- Cada rechazo se muestra solo mientras sigue su causa: el de owing sin cliente solo con owing y sin cliente, y el de sin medio solo con una elección que no es owing. Cualquier cambio de cliente o de tipo de elección los borra, sin efectos (se resuelve al dibujar).
- Una venta de $0 guardada con "Owes it" queda pagada, como dice **Payment state**; la opción no se esconde ni se rechaza por el total.
- Una venta adeudada no crea ningún Payment: suma al Balance de su Customer, fija su Owing since cuando es su venta sin pagar más antigua, cuenta en Sales y Profit en su propia fecha y no mueve el Cash ni el Money in.
- Un medio que el servidor rechazó como no disponible cuenta como ningún medio durante toda la vida de la Sheet, igual que en `NuevaVenta`, se haya vuelto a leer la lista o no.
- Orden de un toque: primero una línea sin precio (no hace nada), después el error de medio o de owing sin cliente, después guardar.
- Si `priced` trae una línea sin precio para la fecha de la venta, el toque no manda nada (0 pedidos), no muestra "Saving…" ni ningún texto nuevo y no llama a `onSavingChange`. Es solo una guarda: se lee lo que `priced` ya dice de la línea, nunca se calcula un precio, y la vendedora no llega a ese estado porque la pantalla anfitriona no abre la Sheet.
- Sin medio por encima de $0 no se manda nada: se muestra "Choose how they pay to collect." en el `FieldRefusal` debajo del Selector, con el **Attention icon** y ligado por `describedBy`, y se enfoca el campo. Si el campo todavía está cargando (y por eso deshabilitado), el foco va al grupo que lo envuelve, el mismo destino que usa el Selector al pasar a carga. Elegir un medio borra el rechazo.
- Una venta de $0 sin medio se guarda con `payment: null`; una de $0 con un medio elegido lo manda.
- Si no, el botón muestra "Saving…" de inmediato, los toques siguientes no mandan nada (una guarda que se activa antes del pedido, así que dos toques seguidos hacen un solo pedido), llama a `onSavingChange(true)` y hace `POST /api/sales` con el cuerpo armado solo por `saleBodyOf`: líneas desde la Sale in progress con `bodyLinesOf` (que usa `quantityOfHundredths`, sin Gift ni Special price); fecha y Note desde la Sale in progress (una Note en blanco va como null) y el Shipping charged desde `priced.totals.shippingCharged`, para que la etiqueta y el cuerpo no puedan discrepar.
- El guardado nunca queda en pausa sin conexión (`networkMode: 'always'`): sin red el pedido falla y el guardado termina, en lugar de dejar la Sheet bloqueada.
- Mientras guarda, el Close propio de la Sheet no hace nada y nada más lo señala: "Saving…" es la única señal. El campo queda bloqueado (`inert`) y Collect no toma toques. Un 401 llega al límite de sesión compartido.

### Resultado

- Éxito: `onSavingChange(false)` y después `onSaved` con la respuesta del servidor sin tocar, aunque su total difiera de `priced`. La Sheet no muestra ninguna cifra propia después.
- Cualquier fallo del guardado llama a `onSavingChange(false)` al terminar, termine como termine.
- 401: lo maneja el límite de sesión compartido (el `MutationCache.onError` global), como en el resto de la app; la Sheet no muestra nada propio.
- Rechazo del medio (el 404 `payment_method.unavailable`): lo reconoce un único predicado, `isMethodUnavailable` en `web/src/sales/saleRefusal.ts`, que también usa `NuevaVenta` (ya no está entre sus `submitOverrides`), así que el mismo rechazo significa lo mismo en los dos lugares. El Selector conserva el medio elegido con su nombre y la marca "no longer available" de inmediato, aunque la lista no se vuelva a leer o esa lectura falle, y debajo se muestra `common:paymentMethodUnavailable` en un `FieldRefusal` con el Attention icon y rol alert, así que se anuncia. Se invalida `keys.paymentMethods()` para volver a leer la lista. El medio rechazado no se vuelve a ofrecer ni a mandar mientras la Sheet esté abierta. Elegir otro medio (o "Owes it") borra la marca y lo manda; un nuevo toque en Collect sin elegir otro, por encima de $0, muestra el rechazo sin medio, no manda nada y enfoca el Selector, y en $0 guarda con `payment: null`. El mismo rechazo nunca se repite, y no se muestra el texto "not saved".
- Cualquier otra causa (otro rechazo de la API, red caída, respuesta mal formada): arriba de Collect, al final del cuerpo y justo encima del pie fijo de la Sheet (la convención de errores de las Sheets), se muestra "The sale was not saved. Your lines are kept, so try again." en un `FieldRefusal` con el Attention icon, anunciado a los lectores de pantalla (rol alert). Es el único texto para esas causas: el `detail` de la API nunca se muestra, y no hay diagnósticos, toast, vibración ni una señal solo de color.
- Después de cualquier fallo, las líneas y el medio (o "Owes it") se conservan, Collect se puede volver a tocar (un toque es exactamente un pedido más) y Close vuelve a funcionar. El foco queda en Collect o vuelve a él al terminar el guardado, también tras el rechazo del medio; es el toque siguiente el que lo lleva al Selector.
- El texto "not saved" se borra al empezar un reintento, al elegir cualquier medio o con un guardado exitoso; nunca con un temporizador. Mientras corre un reintento solo se ve "Saving…".
- Un guardado fallido que el front ve nunca deja una venta registrada ni se ve como un éxito, y "the sale was not saved" siempre se distingue de "no longer available" por sus palabras.

### Textos

- Viven en `SALES_TEXT`, el módulo de ventas de `web/src/copy/`, en inglés y sin palabra de unidad, moneda ni tipo de producto: `collectTitle(n)`, `howTheyPay` ("How they pay"), `owesIt` ("Owes it", desde #944), `chooseMethod` ("Choose a method"), `noMethodToCollect` ("Choose how they pay to collect."), `collect(total)` ("Collect {total}"), `saving` ("Saving…") y, desde #930, `saleNotSaved` ("The sale was not saved. Your lines are kept, so try again."), registradas en LIMITED_COPY como las otras claves de ventas. "No customer" ya existía. El baseline se regenera, nunca se edita a mano.
- El rechazo de owing sin cliente reutiliza `OWING_HINT` ("To leave it owing, pick a customer"), el motivo que `validateSale` ya da en palabras; #944 no agrega una clave de rechazo. El mapeo del servidor `sale.owing_without_customer` → `refusals:generic` no cambia, y la Sheet nunca llega a él porque rechaza antes de mandar.
- La marca "no longer available", `common:paymentMethodUnavailable`, la línea de fallo del Selector (`selectorPaymentMethodsFailed`) y el texto de lista vacía (`selectorNoPaymentMethods`) se reutilizan, sin claves nuevas.

### Huecos conocidos

- Una venta cuya respuesta se perdió después de que el servidor la guardó puede registrarse dos veces al reintentar, e inflar Sales, Profit y, si se debe, el Balance del Customer. No hay protección en el repo; requiere trabajo en el servidor y va como pieza propia. Se tiene que resolver antes del flip de GH-496.
- Todo rechazo que no es el del medio muestra el mismo texto. Para uno que un reintento no arregla (por ejemplo una fecha futura), "try again" no ayuda, y la vendedora lo corrige desde la pantalla anfitriona después de Close. La pantalla anfitriona controla fecha, envío, Note y cliente antes de abrir la Sheet, así que deberían ser raros. El flip de GH-496 decide si alguno vuelve a la pantalla anfitriona.
- Sin conexión antes de que la lista de medios llegue por primera vez, el Selector de la Sheet muestra su aspecto de carga y no su línea de fallo, porque el cargador compartido espera la conexión en lugar de fallar. La venta no se pierde ni se bloquea (ver Estados de la lista de medios). El flip de GH-496 lo juzga en el teléfono junto con el resto del manejo sin conexión; si el dueño quiere la línea de fallo en ese caso, es una parte propia que cambia el cargador compartido para todas las pantallas.
- El texto "not saved" va al final del cuerpo que se desplaza, justo encima del pie fijo, y no dentro de él: en una venta larga puede quedar fuera de la vista mientras el pie sigue fijo. Lo juzga el flip en el teléfono.
- En $0, si después del rechazo del medio un reintento falla por otra causa, la línea "no longer available" y el texto "not saved" se ven a la vez. Las palabras los siguen distinguiendo y la venta se puede terminar; lo juzga el flip.
- Con la lista de medios fallida y un total mayor que $0, la recuperación suele llevar 4 toques, porque la línea de fallo del Selector solo se ve dentro de la lista abierta.
- Qué hacen el total y la etiqueta de Collect cuando el medio rechazado tenía una promoción atada queda sin definir; lo decide el flip.
- Si la palabra de la acción "Collect" resulta decir que se cobra plata cuando se eligió "Owes it", es una pregunta sobre el texto de #918, no de #944; lo juzga el flip.
- Ningún toque vuelve el campo a unset desde "Owes it": el Selector compartido es obligatorio y no tiene fila para vaciarlo, y #944 no lo cambia. La vendedora no lo necesita para terminar (elige un medio con nombre); el estado unset después de owing solo se alcanza desde la Sale in progress, y así lo prueban los tests.
- La Collect Sheet no tiene ruta, así que "Owes it" no se recorrió en la app en marcha ni se comparó con el dibujo; queda sin verificar, no fallado, hasta el flip.

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
- Desviación de dibujo #1 (GH-924, Decisión 3), solo para esta parte: todavía no hay búsqueda; llega en #940.
- Desviación de dibujo #2 (GH-924, Decisión 3), solo para esta parte: todavía no hay estados de carga ni de fallo; llegan en #941.

#940 y #941 tienen que estar entregadas antes de que el flip de GH-496 monte la lista.

### Lecturas

- `useNewSaleReads({ date, openedOn })` lee los Products de la fecha de la venta (`GET /api/products?on=<date>`) y los Pricing settings, con las mismas claves y opciones que New sale: las dos definiciones viven en `web/src/sales/saleFormQueries.ts` (`saleFormProductsQuery`, `saleFormPricingSettingsQuery` y `pricingSettingsOf`), y `NuevaVenta.tsx` usa las mismas sin cambiar su comportamiento. Las sugerencias llegan solo por el cliente de New sale suggestions con `openedOn`, así que cambiar la fecha de la venta nunca las vuelve a pedir.
- Devuelve los Products (null mientras no llegó ninguna respuesta; durante un cambio de fecha, la lista de la fecha anterior), si son los de la fecha actual (`productsForDate`), los Pricing settings de esa fecha (null hasta que llegan, y también mientras solo están los de la fecha anterior), los ids de "Most sold" (null mientras se piden) y el error de Products o de Pricing settings, si lo hay. Un fallo de las sugerencias nunca es un error.
- La cifra de Stock de cada fila sale de la lectura de Stock (`GET` de Stock, clave `keys.stock()`), aparte de las otras.

### Cuándo se muestra la lista

- Una sola condición decide: mientras faltan los Products, los Pricing settings o los ids de "Most sold", los Products no son los de la fecha de la venta, falló la lectura de Products o de Pricing settings, o el Customer está pendiente (`customerTypeId` en `'pending'`), la lista no muestra nada: ninguna fila, sección, cifra ni aviso, y tampoco una interfaz de carga provisoria. La venta conserva todas sus líneas mientras tanto.
- `'pending'` significa solo una lectura del Customer en curso; qué significa una lectura del Customer fallida lo decide quien monta la lista, nunca la lista.
- Así, ningún precio, "No price", cifra de Stock, "+" de una fila fuera de la venta, aviso ni encabezado de sección se muestra antes de tiempo, y nada se recotiza mientras el Customer está pendiente.
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
- Sigue a la fecha de la venta y se muestra solo cuando la lista se muestra (ver "Cuándo se muestra la lista"). Cuando llegue la búsqueda (#940) irá debajo de ella y se ocultará mientras se busca.

### Fallos

- Hasta #941, un fallo de la lectura de Products o de Pricing settings deja el cuerpo vacío, igual que mientras se carga; la venta conserva sus líneas. Ningún test fija ese cuerpo vacío como el comportamiento buscado: lo define #941.
- Un fallo de las sugerencias no muestra ningún error y solo deja sin "Most sold".

### Textos

En el Copy module (`web/src/copy/sales.ts`, grupo `newSale` de `SALES_TEXT`), en inglés y sin palabras de Unit ni de tipo de producto: `productsInSale` "In the sale · {n}", `productsMostSold` "Most sold", `productStock` "{stock} in stock", `productNoPrice` "No price", `productAdd` "Add {name}", `productIncrease` "Add one {name}", `productDecrease` "Remove one {name}". Están registrados en LIMITED_COPY y BASELINE_ARGS. El texto "no longer available" se reutiliza del existente, no se agrega. Las claves de la búsqueda (`productsResults`, `productSearchLabel`, `productSearchPlaceholder`) llegan con #940. El baseline se regenera, nunca se edita a mano.

### Diseño

- Colores, tipografía y espacios salen solo de los tokens; el modo oscuro es el mismo marcado con los tokens oscuros.
- Las diferencias aprobadas con los dibujos son las de arriba (desviación 2 y desviaciones de dibujo #1 y #2). Diferencias de peso y tono que se leen igual (precio y nombre más livianos que en el dibujo, pasos en pastillas separadas) quedan como observaciones. Cualquier otra diferencia que el dueño leería o haría distinto en el teléfono se le plantea al dueño en el PR; nadie la acepta como supuesto.
- El corrimiento de contenido y el blanco durante la carga se juzgan en el recorrido del flip.

## Fuera de esta capacidad (por ahora)

- Cualquier ruta, entrada de navegación, pantalla o Sheet que monte la Sale in progress o la lista de Products, y el flip que las monta.
- La búsqueda de la lista de Products: campo, "Results · {n}", resaltado de coincidencias, "Results · 0" y sus textos (#940).
- Los estados de carga y de fallo de la lista: filas esqueleto ocupadas, marca compacta de carga al cambiar fecha o Customer conservando nombres y pasos, sin conexión y error genérico, y la recuperación tras un fallo (#941).
- Qué significa para la lista una lectura del Customer fallida (lo decide y prueba el flip).
- La cantidad tipeada en la lista y un botón propio para limpiar la búsqueda (flip).
- Los pasos de cliente, pago y guardado de New sale, incluido qué pasa al guardar una línea cuyo Product ya no está disponible.
- Código de barras, categoría y elementos de promoción en la lista de Products.
- La pantalla anfitriona de New sale que monta la Collect Sheet, el flip que la monta y su regla de no abrirla con una línea sin precio.
- Reescribir el criterio 34 de sales.md ("el medio nunca viene puesto"), que le corresponde al flip, cuando la preselección llegue a la vendedora.
- Received y Change en la Collect Sheet.
- Un pago parcial en el momento de la venta: las opciones son pagada por completo con un medio o "Owes it" sin nada pagado ahora; un pago parcial es un Payment posterior por Record payment y el Settlement.
- Un aviso de Credit o una vista previa del Balance en la Collect Sheet, y una línea extra u otra palabra de acción para una venta adeudada.
- Cualquier cambio a los Payment methods o a Settings por "Owes it".
- Un gesto para volver a unset desde "Owes it" que exija cambiar el Selector compartido.
- Textos propios de la Collect Sheet para rechazos que no son el del medio, y devolverlos a la pantalla anfitriona (lo decide el flip).
- Cualquier cambio al Selector, a `usePaymentMethodOptions` o al cargador compartido de la lista de medios, al Attention icon o a la Icon and text rule por los caminos de fallo de la Collect Sheet o por "Owes it", incluida la línea de fallo sin conexión antes de la primera carga.
- Un texto propio de la Collect Sheet para una línea sin precio.
- Gift, Special price y la Sheet del detalle de línea.
- Conservar la venta en curso tras una recarga.
- Cualquier cambio en el servidor, incluida la protección contra el doble registro.

## Métricas

- Cada regla de Líneas, Sin guardar, Cómo se paga, Cliente y owing, y Apertura tiene su test unitario de la Sale in progress, y pasa; incluye que sacar el cliente conserva owing y paid(id), que cambiar el cliente conserva la elección y que unset después de owing queda unset (#944).
- Cliente de sugerencias, a nivel de fetch: exactamente 1 pedido por apertura, con `on` igual a la fecha de apertura; 0 pedidos nuevos después de editar la fecha o volver a dibujar; 1 pedido nuevo en una apertura de otro día; una lectura fallida da ninguna sugerencia y 0 errores lanzados.
- Lista de Products, en tests de componente a nivel de fetch: cada caso de la lista (pasos, cantidades tipeadas, una línea por Product, "No price", línea que pierde su precio, línea cuyo Product ya no vuelve, sugerencias filtradas y con tope, Stock, bulk a 10, recotización por Customer y por fecha, aviso, símbolo y decimales del Money format, nada antes de tiempo) tiene su test y pasa; 0 pedidos nuevos de sugerencias tras cambiar la fecha; 0 cambios en los totales de la venta al mostrar más filas.
- Líneas perdidas por una acción de la lista o una recarga de Products: 0. Ids internos mostrados en pantalla: 0.
- Cifras mostradas antes de que lleguen todas las lecturas o mientras el Customer está pendiente (dígitos, símbolo de moneda, "No price", aviso, encabezados): 0.
- Operaciones de dinero en `useSaleDraft`, en el cliente de sugerencias y en la lista de Products: 0 (todo pasa por `pricing.ts`).
- Rutas, constantes, parámetros, banderas, props, exports o hooks `data-*` solo para tests: 0.
- Claves del Copy module agregadas por la lista de Products: 7, en inglés y sin palabras de Unit ni de tipo de producto.
- Gate (pytest, vitest, e2e) pasa, y tsc strict y oxlint pasan sin nada silenciado.
- Vara del trabajo, que se juzga cuando el flip la monte: una venta se registra desde el teléfono en menos de un minuto (sales.md, criterio 1), y un Product habitual se encuentra, se agrega y se ajusta sin salir de la lista (1 toque para un Product habitual a 1 unidad desde "Most sold").
- Collect Sheet, con Testing Library a nivel de fetch: sin medio por encima de $0, 0 pedidos y el campo enfocado; con una línea sin precio en `priced`, 0 pedidos, ningún texto nuevo y ninguna llamada a `onSavingChange`; mientras guarda, toques extra y Close dan 0 pedidos adicionales; tras un pedido rechazado, `onSavingChange` termina en false y Close vuelve a funcionar; la etiqueta de Collect es igual a `priced.totals.total` formateado y `onSaved` recibe la respuesta sin tocar.
- "Owes it" (#944), con Testing Library a nivel de fetch y en el mismo host que los tests de #918:
  - Se ofrece solo con cliente, última después de los Payment methods, y elegirla guarda `{kind:'owing'}`; Collect hace exactamente 1 pedido, armado por `saleBodyOf`, sin ningún Payment. Sin cliente no está en la lista.
  - Elegir el medio B, después "Owes it" y después unset desde la Sale in progress: el campo muestra la propuesta y Collect manda la propuesta, nunca B.
  - "Owes it" y después el medio C manda C.
  - Un borrador que ya trae owing con cliente se muestra como "Owes it" y se guarda en 1 pedido.
  - Con owing y el cliente sacado por el host: "Owes it" con la marca "no longer available", 0 pedidos al tocar Collect, `OWING_HINT` visible y el Selector enfocado; volver a poner el cliente borra el rechazo y lo guarda en 1 pedido; sacarlo otra vez no muestra el rechazo hasta el próximo toque.
  - Dos rechazos seguidos (sin medio, después owing sin cliente): cada uno se muestra solo mientras sigue su causa, y `aria-describedby` apunta siempre a la línea visible.
  - Lista de medios fallida con cliente: "Owes it" ofrecida, la línea de fallo de la Sheet visible y una venta con "Owes it" se guarda. Lista retenida: ningún texto de lista vacía; respondida con `[]`: `selectorNoPaymentMethods` como texto de ayuda, no como rechazo. Todos los medios rechazados: ningún texto de lista vacía, tampoco al elegir "Owes it".
  - `howTheyPayView`, con test unitario: con cliente y owing, con cliente y paid, sin cliente y owing, sin cliente y unset con la propuesta, propuesta rechazada y medio no disponible.
  - Record payment nunca ofrece "Owes it".
  - La etiqueta de Collect con "Owes it" es la misma que con un medio.
- Ventas guardadas como adeudadas sin Customer: 0. Payments creados por una venta con "Owes it": 0. Medios puestos en lugar de "Owes it" sin que la vendedora los elija: 0.
- Claves del Copy module agregadas por #944: 1 (`owesIt`), en inglés y sin palabras de Unit, moneda ni tipo de producto; el rechazo reutiliza `OWING_HINT`.
- Vara de #944, que se juzga cuando el flip monte la Sheet: con cliente, una venta adeudada se guarda con los mismos toques que una pagada (una elección y un toque en Collect).
- Caminos de fallo de la Collect Sheet (#930), con Testing Library a nivel de fetch y en el mismo host que los tests de #918:
  - Lista de medios fallida por error del servidor o por un pedido rechazado: el Selector muestra su línea de fallo; una venta de $0 se guarda con `payment: null` en un solo pedido; por encima de $0 se muestra el texto sin medio con 0 pedidos y el foco en el Selector.
  - Sin conexión antes de la primera carga de la lista: Collect está habilitado, una venta de $0 se guarda con `payment: null` y por encima de $0 se muestra el texto sin medio con 0 pedidos y el foco en el grupo del campo. No se exige la línea de fallo del Selector.
  - Lista de medios que nunca responde con conexión y venta de $0: Collect habilitado y exactamente 1 pedido con `payment: null`.
  - Guardado fallido (error del servidor, rechazo que no es el del medio, red caída): las líneas y el medio se conservan, el texto "not saved" se muestra con rol alert, un reintento hace exactamente 1 pedido más y borra el texto mientras se ve "Saving…", y Close vuelve a funcionar.
  - Rechazo del medio archivado, aun con la nueva lectura de la lista fallida: se muestra la marca "no longer available" con el nombre del medio, el medio no está entre las opciones, se vuelve a leer la lista y el toque siguiente por encima de $0 da 0 pedidos; en $0 guarda con `payment: null`.
  - 401: ningún texto propio de la Sheet, `onSavingChange` termina en false y Close vuelve a funcionar.
  - Elegir otro medio borra el texto "not saved".
  - `isMethodUnavailable`: verdadero solo para un `ApiError` con código `payment_method.unavailable`; los tests del medio de New sale pasan sin cambios.
- Fallos del guardado mostrados como éxito, o con el `detail` de la API en pantalla: 0.
- Claves del Copy module agregadas por #930: 1, en inglés y sin palabras de Unit, moneda ni tipo de producto.
- Lugares que reconocen el rechazo `payment_method.unavailable` en el front: 1 (`isMethodUnavailable`).
- Llamadas a `priceSale`/`priceLine` desde la Collect Sheet: 0, y operaciones de dinero propias en ella: 0 (todo pasa por `pricing.ts`).
- Textos de la Collect Sheet fuera de `web/src/copy/`: 0.
- Con el medio propuesto ya elegido, la Collect Sheet guarda con a lo sumo una elección y un toque en Collect (la vara del flip, arriba, se juzga cuando la monte).
- Vara de #930, que se juzga cuando el flip monte la Sheet: después de cualquier fallo, la venta se termina de registrar con un toque más en Collect, sin volver a tipear ninguna línea.
