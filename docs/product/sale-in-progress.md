## Jobs

**Cuando** entrego un pedido y lo registro en el teléfono, **quiero** armar la venta con los clientes, productos y el medio de pago que suelo elegir, ajustando solo cantidades y con cada total calculado por la app, **para** guardar la venta en menos de un minuto y nunca cotizar de memoria ni volver a tipear lo que elegí hace un momento. (Parte 3 de GH-496: la sirven el estado de la venta en curso, `useSaleDraft`, y el cliente del front de las **New sale suggestions**. Afina la primera historia de sales.md; no es un trabajo nuevo).

**Cuando** termino de armar una venta en New sale, **quiero** ver lo que estoy por cobrar y decir cómo me pagaron, o que me lo deben, **para** guardar la venta de un toque con el pago correcto y la deuda correcta. (Parte 2 de GH-867: la sirve la **Collect Sheet**. Es el paso de cierre del trabajo de BRIEF "una venta se registra desde el teléfono en menos de un minuto"; no es un trabajo nuevo).

**Cuando** le entrego un pedido a un cliente que conozco y se lo lleva sin pagar ahora, **quiero** guardar la venta como adeudada con los mismos pocos toques que una venta pagada, **para** que su Balance y su Owing since la muestren y pueda cobrarla después sin perder la fecha. (#944: la sirve la opción "Owes it" de la **Collect Sheet**. Son los dos primeros trabajos de BRIEF, registrar una venta en pocos toques y saber quién debe qué y desde cuándo, aplicados a New sale; no es un trabajo nuevo).

**Cuando** un cliente me paga su pedido en el momento y me da más que el total, **quiero** tipear lo que me dio y ver el vuelto al instante, **para** devolver el monto justo sin hacer la cuenta de cabeza mientras espera. (Parte 3 de GH-867: la sirven el **Received** y el **Change** de la Collect Sheet y su fila Total. Son solo una ayuda: nunca deciden ni cambian lo que se registra).

**Cuando** estoy cerrando una venta en el teléfono y algo falla (no cargan los medios de pago o el guardado no pasa), **quiero** ver en palabras simples qué pasó y terminar con un toque más, con mis líneas y el medio que elegí todavía ahí, **para** que la venta quede registrada y nunca la vuelva a tipear, la pierda o crea que se guardó cuando no se guardó. (#930: la sirven los caminos de fallo de la **Collect Sheet**. Es la versión de fallo de la misma primera historia de sales.md; no es un trabajo nuevo).

**Cuando** un cliente me manda su pedido y armo la venta en el teléfono, **quiero** encontrar cada Product que pidió y fijar cuánto con un toque o dos, viendo lo que ya está en la venta, **para** que cada línea salga con los precios de ese día y nunca tipee un precio ni cotice de memoria. (Parte 2 de GH-863: la sirve la lista de Products de New sale. Afina la misma primera historia de sales.md, acotada a elegir Products y cantidades; cliente, pago y guardado son de otras partes).

**Cuando** abro New sale en el teléfono, o cambio la fecha o el Customer, y los precios todavía se están cargando o no se pudieron leer, **quiero** ver claramente que la lista está cargando o falló, y nunca ver un precio equivocado, viejo o vacío, **para** nunca cotizar de memoria ni registrar una venta a una cifra que la app no calculó. (#941, recorte de #924: la sirven los estados de carga y de falla de la lista de Products de New sale. Afina la misma primera historia de sales.md).

**Cuando** registro una venta en el teléfono y el Product que pidió el cliente no está entre los que ya están en la venta ni entre los más vendidos, **quiero** tipear parte de su nombre y ver solo los Products que coinciden, **para** agregarlo en un toque o dos sin scrollear ni acordarme de dónde queda en la lista. (#940: la sirve la búsqueda de la lista de Products de New sale. Afina la misma primera historia de sales.md, "una venta se registra desde el teléfono en menos de un minuto"; la búsqueda es el atajo cuando las sugerencias no alcanzan).

**Cuando** entrego un pedido en el teléfono, **quiero** ver de un vistazo para quién es la venta, qué precios le corresponden y el total hasta ahora, con una sola forma clara de ir a cobrar, **para** cobrar el monto justo y nunca cotizar de memoria. (Parte 2 de GH-864: la sirve la **Sheet de New sale**, el marco con la fila de Customer y la barra de la venta alrededor de la lista de Products. Afina la misma primera historia de sales.md; elegir Products y cobrar siguen en sus propias partes).

**Cuando** estoy armando una venta en el teléfono y la cierro, aprieto Escape o vuelvo atrás por error, **quiero** que la app me pregunte antes de tirar las líneas que agregué, **para** no tener que armar la venta de nuevo. (Parte 2 de GH-869: la sirve el **Anfitrión de New sale** con su única guarda de salida. Afina la misma primera historia de sales.md, "una venta se registra desde el teléfono en menos de un minuto": perder las líneas sin una pregunta rompe ese minuto. No es un trabajo nuevo).

## Qué es

La **Sale in progress** es la venta que se está armando en New sale antes de guardarla: cliente, líneas, fecha, **Shipping charged**, **Note** y cómo se paga. Es solo del front (`web/src/sales/useSaleDraft.ts`) y vive en memoria durante una apertura de New sale: nunca se guarda en el dispositivo y una recarga la pierde (igual que lo que dice sales.md, criterio 43). Lo que se guarda es la **Sale**, con las reglas de sales.md.

Hasta la parte de GH-496 que la monta en pantalla (el flip), ninguna pantalla la usa: no hay ruta, constante de build, parámetro de consulta, bandera de ventana ni hook `data-*` para llegar a ella ni al Anfitrión de New sale, la Sheet de New sale, la lista de Products o la Collect Sheet, y se prueban solo con tests unitarios, de componente y del cliente a nivel de fetch.

Nota: el criterio 34 de sales.md ("el medio nunca viene puesto") sigue vigente hasta la parte del flip de GH-496, porque la New sale en vivo todavía arranca sin medio. La propuesta de medio de esta capacidad no llega a la vendedora hasta entonces.

Antes de esta parte, la vendedora vuelve a elegir en cada venta los mismos clientes, productos y medio de pago, y tipea las cantidades a mano, de a un Product por vez y sin ver de una sola vez lo que ya está en la venta ni lo que suele vender. El costo principal son las elecciones repetidas, y el segundo es tipear cantidades. Cuando el Product pedido no está en la venta ni en "Most sold", hoy se recorre la lista entera a ojo; la búsqueda (#940) reemplaza ese recorrido. Hoy dice cómo le pagaron en el mismo formulario de New sale; la Collect Sheet pasa esa elección a un paso de cierre sin cambiar qué significan Payment, On-the-spot payment, Balance, Settlement ni Owing since. Un pago parcial sigue siendo un Payment posterior registrado con Record payment. El vuelto hoy se calcula de cabeza o con la calculadora del teléfono en medio de la entrega; la planilla nunca registró lo que el cliente entregó, así que no guardarlo no pierde nada. Qué precios le tocan a un Customer hoy se revisa a mano cuando no está claro; la fila de Customer de la Sheet de New sale lo dice antes de agregar nada. Hoy la guarda de `NuevaVenta.tsx` protege la pantalla en vivo de una salida por error; el Anfitrión de New sale le da la misma protección a la Sheet antes de que el flip reemplace esa pantalla.

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

- `isDirty` es `lines.length > 0`: la venta cuenta como sin guardar solo con al menos una línea. Un cliente, un Shipping charged o una Note sin líneas no es trabajo sin guardar.
- Es la única regla de "sin guardar": la usan el `touched` de la Sheet de New sale y la guarda de salida del Anfitrión de New sale, y ninguno de los dos tiene otra fuente.

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

- Ni la Sale in progress, ni el cliente de sugerencias, ni el Anfitrión de New sale, ni la Sheet de New sale, ni la lista de Products, ni la Collect Sheet calculan dinero. Toda cifra de la venta (precio de la fila, total de la línea, total de la barra, total de Collect, fila Total, aviso de recotización) sale de `priceSale`/`rowPrices`/`priceLine` en `web/src/sales/pricing.ts` (en la Sheet de New sale, mediante `pricedSaleOf`), calculada por la pantalla anfitriona. El Received se lee y el Change se calcula solo con `changeFor` del mismo módulo, mediante `parseMoneyInput`, como enteros a los decimales del Money format. El Shipping charged y la Note se guardan tal como se ingresaron.

## Anfitrión de New sale

El contenedor `web/src/screens/ventas/NewSaleSheetHost.tsx` (parte 2 de GH-869) monta la Sheet de New sale, sin ruta, y tiene la única guarda de salida de New sale en la Sheet. Hasta el flip de GH-496 ninguna ruta ni entrada de navegación lo monta: figura en `web/scripts/docs/front-exclude.json` (D-62e6dc23) y el flip saca esa entrada. La guarda vieja de `NuevaVenta.tsx` no cambia y sigue sirviendo a la pantalla en vivo. No tiene entrada en WalkState ni en `scripts/design/screens.json`, así que no tiene Design capture ni Screen image. Para la vendedora no cambia nada en pantalla hasta el flip.

### Lo que tiene

- `useSaleDraft`, con `const dirty = isDirty(draft.state)` de `web/src/sales/saleDraft.ts`. No agrega ningún campo a `SaleDraftApi`; la Sheet de New sale sigue calculando su propio `touched={isDirty(state)}`, así que la guarda y `touched` siguen una sola regla (ver Sin guardar).
- La única `useLeaveGuard(dirty, {sheetFloor: <la profundidad propia de la Sheet>, sheetDirty: dirty})`.
- La confirmación existente "Discard the sale?" con "No, keep entering" y "Yes, discard it", con las palabras de `leaveQuestion` y sin la franja de Expense. No agrega ninguna clave al Copy module ni cambia ningún texto, disposición o dibujo; cualquier cambio de cómo se ve o se lee la pregunta va al dueño como desviación.
- El montaje de la Sheet de New sale y de las Sheets que apila y que ya existen (búsqueda de cliente, Create customer, Collect y, cuando exista, el detalle de línea), con las props que piden `NuevaVentaSheet` y `CollectSheet`. Una Sheet apilada que todavía no existe no se construye acá.
- La Sheet de New sale no recibe ningún diálogo propio: su Close sigue llamando a `onClose` sin confirmación.

### Salidas

- `close()` es el `onClose` de la Sheet y su Escape: hace un solo recorrido del historial hacia atrás, por debajo del piso (`navigate(-n)`), que juzga el bloqueador. El gesto de volver del teléfono lo juzga el mismo bloqueador.
- `leave()` llama a `disarm()` y después hace el mismo recorrido único.
- Sin una entrada anterior de la app (una dirección directa), las dos usan `navigate(<path padre>, {replace:true})`. El padre es el que la Navigation (navigation.md) le da a New sale, la misma pantalla sobre la que se dibuja la Sheet en una dirección directa; el anfitrión no elige uno propio.
- Sin líneas, Close, Escape y el volver del teléfono cierran sin preguntar. Con al menos una línea, los tres preguntan "Discard the sale?": "No, keep entering" se queda en la Sheet con la Sale in progress sin cambios, y "Yes, discard it" sale como `leave()`.
- Cerrar una Sheet apilada (Collect, búsqueda de cliente, Create customer, detalle de línea cuando exista) vuelve un nivel, a la Sheet de New sale: nunca pregunta, nunca sale de New sale y nunca cambia la Sale in progress.
- El anfitrión expone `onSaved(saleId, name)`, que se llama cuando el guardado de Collect sale bien. Por defecto llama a `leave()`, así que un guardado nunca pregunta y hace exactamente un cambio de lugar; una parte posterior inserta el toast antes de `leave()`.
- No hay ruta, bandera, parámetro ni hook `data-*` solo para tests.

### Huecos conocidos

- Mientras Collect guarda, el anfitrión todavía no ignora el volver del sistema ni Escape; lo hace el flip (ver Fuera de esta capacidad).
- El anfitrión no tiene ruta, así que la guarda no se recorrió en la app en marcha; queda sin verificar, no fallada, hasta el flip.

## Sheet de New sale

El contenedor `web/src/screens/ventas/NuevaVentaSheet.tsx` (parte 2 de GH-864), dibujado dentro de la Sheet compartida (`web/src/components/Sheet.tsx`), igual que la Collect Sheet. Es el marco de New sale: la fila de Customer arriba, la lista de Products en el medio y la barra de la venta abajo. Elegir Products es de la lista y cobrar es de la Collect Sheet. La pantalla anfitriona (desde la parte 2 de GH-869, el Anfitrión de New sale) se encarga de Escape, del volver del sistema, del Customer (un `CustomerView`), de elegir otro después de Change y de lo que pasa después de Collect. Hasta el flip de GH-496 ninguna ruta ni entrada de navegación lo monta: figura en `web/scripts/docs/front-exclude.json` (D-62e6dc23) y el flip saca esa entrada. No tiene entrada en WalkState ni en `scripts/design/screens.json`, ni hook de test, así que no tiene Design capture lado a lado ni Screen image. Para la vendedora no cambia nada en pantalla hasta el flip.

### Props

- `draft` (`SaleDraftApi`), `customer` (`CustomerView`), `onClose()`, `onChangeCustomer()` y `onCollect(sale: CompleteSale)`.
- `computer`, `computerClass` y `computerDialog` pasan tal cual a la Sheet compartida, igual que en la Collect Sheet.
- `CustomerView` tiene cinco formas: sin cliente (`none`), conocido (`known`, con su nombre y, si tiene, su Customer type), nombre pendiente (`namePending`), tipo pendiente (`typePending`, con el nombre) y lectura fallida (`failed`, con el nombre si llegó o `null`).

### Lecturas y cifras

- Lee con `useNewSaleReads({ date: draft.state.date, openedOn: draft.state.openedOn })`, las mismas lecturas que la lista de Products (ver "Lista de Products de New sale").
- Corre `pricedSaleOf` una sola vez por render, en un `useMemo`, con el Money format de `useMoney`. Toda cifra que muestra sale de ahí; el componente no hace ninguna operación de dinero ni llama a `priceSale`.
- El estado de la barra lo decide solo `saleBarState`, y la línea de precios de la fila solo `customerPriceLineOf`, las dos funciones puras de `web/src/sales/newSaleView.ts`.
- La Sheet cuenta como tocada (`touched`) exactamente cuando `isDirty(draft.state)`, es decir con al menos una línea, y por ningún otro motivo.

### Encabezado

- Título "New sale" (`t('common:newSale')`, el mismo texto que `COMMON_TEXT.newSale`), ligado a la Sheet por su `titleId`.
- El Close propio de la Sheet (un botón redondo de ícono) llama a `onClose` sin confirmación y sin ningún diálogo, aunque la Sheet esté tocada. La pregunta antes de tirar las líneas es del Anfitrión de New sale, nunca de la Sheet.

### Fila de Customer

- La primera línea muestra el nombre del Customer, o "No customer" (`SALES_TEXT.noCustomer`) cuando la Sale in progress no tiene cliente. Mientras el nombre está pendiente, o tras una lectura fallida que no trajo nombre, la marca compacta de carga (`Loading compacto`) ocupa su lugar.
- Debajo va una sola línea de precios, que decide `customerPriceLineOf`, en este orden:
  1. nada cuando la lectura del Customer falló o la lectura de la lista falló (`status` en `failed`);
  2. la marca compacta de carga mientras los Pricing settings todavía no llegaron;
  3. si no, `priceLineOf` con el interruptor Customer types: "List prices" para un Customer sin Customer type o sin cliente, y siempre que el interruptor está apagado, aunque el Customer tenga un tipo (una regla desactivada queda oculta, pricing-settings.md); "Prices for {type}", con el nombre del Customer type, para un Customer con tipo; la marca compacta de carga mientras el nombre o el tipo están pendientes.
- La línea de precios es una línea de estado, nunca un control, y nombra la fila, nunca la regla de precio de una línea.
- **Lectura del Customer fallida:** la fila muestra lo que ya tiene para el nombre (el nombre si llegó; si no, la marca de carga se queda). Nunca muestra "List prices", "Prices for {type}" ni una cifra de dinero. Para la lista cuenta como pendiente (`customerTypeIdOf` da `'pending'`): sus marcas de precio siguen cargando y no se muestra ninguna cifra. No hay reintento ni aviso de falla en esta parte; Change sigue disponible, y cerrar y volver a abrir la Sheet hace una lectura nueva.
- **Change** (`t('common:change')`, el mismo texto que `COMMON_TEXT.change`) es el botón de texto secundario del producto y llama a `onChangeCustomer`. Dice "Change" en todo estado, "No customer" incluido: una sola etiqueta con un solo sentido, elegir para quién es la venta. Es la única parte de la fila que se puede tocar, es `flex: none`, mide al menos 44x44 px, no se parte y conserva su etiqueta.
- **Disposición:** la columna de texto tiene `min-width: 0`; el nombre va en peso 600 en tinta y la línea de precios más chica en el gris apagado; cada línea queda en una sola línea con puntos suspensivos y el texto visible es el nombre completo, recortado solo por CSS, así que un nombre de 60 caracteres conserva entero su nombre accesible.
- Si una Sale without a customer se puede guardar lo decide Collect (solo pagada por completo en el momento), nunca esta fila.

### Lista

- La lista de Products de New sale (ver abajo), con las lecturas, el borrador, `customerTypeId = customerTypeIdOf(customer)` y el precio calculado por la Sheet.

### Barra de la venta

- Es el último hijo de `SheetActions`: queda fija abajo en el teléfono mediante el envoltorio `.sheet__actions`, sin una regla fija propia, y en una computadora es una fila estática al final del formulario.
- Es una sola fila: a la izquierda una región `role="status"` (que se estira, con `min-width: 0`) y a la derecha Collect, cuando se muestra, como hermano de la región y nunca dentro de ella.
- La región muestra uno de cuatro estados, el primero que corresponda:
  - **vacío** (sin líneas): "Add a product to collect", sin ningún botón Collect;
  - **contando** (con líneas, y la lista carga o recarga, o el nombre o el tipo del Customer está pendiente): `itemsCount(n)`, "1 item" o "{n} items", más la marca compacta de carga;
  - **conteo** (con líneas, y la lectura de la lista o la del Customer falló, o alguna línea no tiene precio): `itemsCount(n)` sin marca de carga, para no dar a entender que algo todavía está llegando;
  - **total** (si no): `itemsTotal(n, money(total))`, "1 item · {total}" o "{n} items · {total}", con la cifra en un elemento `cifra-m` que nunca se parte (en Tabular figures y peso 600); el texto de la región es exactamente el texto del Copy module.
- n cuenta líneas, no unidades.
- **Collect** (`SALES_TEXT.collectShort`, el botón principal relleno) se dibuja solo en el estado total y llama a `onCollect` con la `CompleteSale` del precio calculado. En cualquier otro estado no hay ningún botón Collect, de ningún tipo, ni nada en su lugar: nunca se muestra `disabled` ni `aria-disabled`.
- El total es `totals.total` del precio calculado, con el Shipping charged incluido cuando es mayor que 0.
- No hay texto de promoción ni de ahorro (desviación 1, decidida en GH-864).

### Textos

- En `web/src/copy/sales.ts`, `NEW_SALE_TEXT` (`SALES_TEXT.newSale`), en inglés y sin palabras de Unit, moneda ni tipo de producto: `listPrices` "List prices"; `pricesFor(type)` "Prices for {type}" (BASELINE_ARGS `[['Regulars']]`); `itemsCount(n)` "1 item" / "{n} items" (BASELINE_ARGS counted); `itemsTotal(n, total)` "1 item · {total}" / "{n} items · {total}" (BASELINE_ARGS counted con el monto); `addProductToCollect` "Add a product to collect" (LIMITED_COPY, ayuda). "Product" es el término del glosario, así que pasa el chequeo productWord; "Regulars" es solo un argumento de muestra.
- Se reutilizan "New sale" (`common:newSale`), "No customer", "Change" (`common:change`) y `collectShort`.
- Las entradas nuevas se insertan en su lugar ordenado en `en.baseline.json` con el texto que emite el script (no hay entrada en el JSON del idioma, porque `locales/en` no tiene el grupo de ventas), y después corre `npm --prefix web run i18n:baseline -- --update`; el chequeo, copyLimits y productWord pasan.

### Diseño

- Solo tokens (colores, tipografía, espacios y `--alto-tocable`), así que el tema oscuro sigue a los tokens oscuros. Los dibujos que muestran la fila de Customer y la barra son NuevaVentaProductos, NuevaVentaCliente y NuevaVentaCobrar; NuevaVenta y NuevaVentaOscuro son una Sheet anterior sin fila de Customer.
- Diferencias con el dibujo planteadas al dueño en el PR, que decide el dueño y nunca el PR ni un rol: el título "New sale", el singular "1 item" y el sustantivo "item(s)" donde el dibujo dice "artículos"; la barra vacía como texto de estado donde el dibujo tiene un botón deshabilitado; el resumen de la barra como región de estado simple donde el dibujo tiene un "Ver la venta" tocable con chevron; y solo Change tocable en la fila de Customer donde el dibujo hace de toda la fila un botón.
- Diferencias que se leen igual y quedan como observaciones: la fila sin tarjeta con borde ni avatar redondo de 32 px; Change con el botón de texto del producto en lugar del de 14 px en el color principal; el total en una sola línea a un solo tamaño (`cifra-m`) en lugar de un conteo chico sobre un total grande; Collect con el botón principal por defecto en lugar de 56 px y radio 16; sin sombra suave en la barra.
- Mientras la Sheet no tenga ruta, la captura lado a lado no es posible y queda "not compared"; la comparación con la pantalla dibujada, en ambos temas, queda para el flip.

### Huecos conocidos

- Con la lectura del Customer fallida y sin nombre, la marca de carga de la fila no termina nunca y nada le señala a la vendedora Change o Close. No es un callejón sin salida; el flip debería agregar un aviso o un reintento con el Attention icon y un Tappable notice.
- Con la lectura de la lista fallida, Close es la única salida. Desde la parte 2 de GH-869, con al menos una línea el Anfitrión de New sale pregunta antes de tirarlas; el reintento sigue quedando para el flip.
- En un teléfono angosto con un total largo, "{n} items ·" puede pasar a una segunda línea en lugar de recortarse antes de la cifra (la cifra nunca se parte). Las reglas del teléfono de la barra (`figure-split`, `h-scroll`, toque, `chrome-shift`) quedan sin verificar hasta que el flip agregue la entrada de WalkState y corra el Mobile check.

## Collect Sheet

El paso de cierre de New sale, `web/src/screens/ventas/CollectSheet.tsx`, dibujado dentro de la Sheet compartida (`web/src/components/Sheet.tsx`) a partir del dibujo NuevaVentaCobrar y su gemelo oscuro (salida aceptada 3), con la misma división que Cobro/CobroRoute. Sirve igual para entregar en la puerta que para registrar una venta después: la fecha viene de la Sale in progress. No tiene ruta hasta el flip de GH-496, así que no tiene Design capture ni Screen image. Los estados de fallo y el estado "Owes it" sin cliente no tienen dibujo aprobado: sus textos y marcas salen de componentes compartidos (Selector y su marca "no longer available", `FieldRefusal` con el Attention icon, el pie de la Sheet), sin componente, color ni tamaño nuevos, y si aparece un dibujo que muestre otra cosa, la diferencia la decide el dueño. Donde el dibujo difiere, ganan las decisiones escritas: el dibujo ofrece "Queda debiendo" sin cliente (acá solo con cliente), usa un select nativo (acá el Selector) y su fila de Customer se puede tocar (acá es de solo lectura, desde #918).

### Props

- `draft` (`SaleDraftApi`), `priced` (`PricedSale`, la única fuente de precios de la pantalla anfitriona, que nunca se vuelve a calcular: ninguna llamada a `priceSale` ni `priceLine` ni consulta de precios), `customerName` (`string | null`), `onClose()`, `onSaved(sale)` y `onSavingChange(saving)`, más las props de marco de la Sheet para la computadora, que pasan tal cual.
- La pantalla anfitriona maneja Escape y el volver del sistema; la Sheet no agrega ningún listener de Escape ni de popstate. Desde la parte 2 de GH-869, cerrar la Collect Sheet vuelve a la Sheet de New sale sin preguntar y sin perder las líneas, y su guardado exitoso llega al `onSaved(saleId, name)` del Anfitrión de New sale.
- La pantalla anfitriona no abre la Collect Sheet mientras alguna línea no tenga precio para la fecha de la venta (sin Current price, y que no sea Gift ni Special price); lo señala en la propia línea. Esa regla es del flip de GH-496.

### Lo que ve la vendedora

- Título "The sale · 1 item" para una línea y "The sale · {n} items" para cualquier otro n, con n = `priced.lines.length` (cuenta líneas, no unidades).
- Una fila de Customer de solo lectura, sin "Cambiar" ni chevron: "No customer" cuando la Sale in progress no tiene cliente; si no, `customerName`, o un marcador de carga compacto y sin texto mientras el nombre todavía no llegó. Para cambiar el cliente, la vendedora cierra la Sheet, lo cambia en New sale y la vuelve a abrir.
- Una fila "Total" arriba de "How they pay", siempre, en cualquier ancho y en cualquier estado (queda fuera del bloque `inert`, así que también se ve mientras guarda), con `priced.totals.total` en el Money format del Business y en Tabular figures (Decisión 1 del humano en GH-867; sigue el dibujo NuevaVentaCobrar, así que no es una desviación). Así el total queda a la vista aunque la etiqueta de Collect se acorte. La cifra se dibuja al tamaño del texto, igual que su etiqueta, y no en la letra grande del dibujo; se lee igual y queda como observación para el dueño.
- Un **Selector** "How they pay", con los Payment methods ofrecidos por `usePaymentMethodOptions` (que también da `offeredIds`, los ids de la lista leída, o `null` mientras no hay lista). Lo que muestra lo decide un solo lugar, la función pura `howTheyPayView` de `web/src/sales/paymentMethods.ts`: las opciones (los medios sin los que esta Sheet tuvo rechazados y, con cliente, "Owes it" al final), el valor y la entrada marcada como "no longer available". El valor sale de `selectorValueOf`: el medio elegido (paid(id)), "Owes it" (owing, con el valor `OWING_VALUE`, que nunca es un id de Payment method), o la propuesta (`proposedMethodId`) con unset solo si está ofrecida y no fue rechazada; si no, el campo queda vacío ("Choose a method"). Elegir un medio guarda paid(id) mediante `choiceOfValue`.
- La opción "Owes it" (#944) se ofrece solo cuando la Sale in progress tiene cliente (`draft.state.customerId`), siempre última, después de los Payment methods del Business en el orden de su propia lista, con el mismo estilo que los medios, sin ícono, marca ni descripción propios, y sin importar el total. Elegirla llama a `draft.setChoice({kind:'owing'})`. No es un Payment method: es la ausencia de un Payment, nunca está en la lista de Payment methods del Business y Settings no la renombra, archiva ni reordena. Record payment nunca la ofrece.
- Salir de "Owes it" eligiendo un medio, desde cualquier estado, guarda paid(id) de ese medio. Pasar a unset deja que el campo muestre la propuesta o quede vacío, nunca el medio elegido antes; pero ningún toque de la Sheet llega a unset desde "Owes it", porque el Selector compartido es obligatorio y no tiene fila para vaciarlo (ver Huecos conocidos). Solo se alcanza desde la Sale in progress.
- Con owing y sin cliente (el cliente se sacó en New sale), el campo sigue mostrando "Owes it" con la marca existente "no longer available" ("Owes it" queda como valor pero no como opción), la lista muestra solo los medios, y nunca se pone otro medio en su lugar. Volver a poner un cliente la deja válida otra vez sin ningún paso más; elegir un medio también borra la marca.
- Debajo de "How they pay", la ayuda de vuelto (ver "Received y Change").
- Un botón fijo abajo "Collect {total}" con `priced.totals.total` en el **Money format** del Business, en Tabular figures, con la misma etiqueta para cualquier elección, "Owes it" incluida: no hay línea extra ni otra palabra de acción para una venta adeudada. Cuando no entra en una línea, se acorta a "Collect": nunca se achica ni se parte en dos líneas, y vuelve a "Collect {total}" cuando vuelve a entrar. Lo decide un layout effect con un ResizeObserver que compara el `scrollWidth` de la etiqueta con su `clientWidth`, y el nombre accesible conserva siempre el "Collect {total}" completo. No hay ningún hook de producción para forzarlo.
- En el momento de la venta no se dice nada sobre un Credit del cliente ni hay vista previa del Balance; la cuenta del Customer y el Sale bill muestran el resultado.
- Las líneas debajo del campo tienen cada una su id, y el `describedBy` del Selector apunta exactamente a las que se ven, calculado con la misma expresión que decide cuáles se dibujan.

### Received y Change

- **Received**: un campo de dinero con la etiqueta "Received", con el formato de `useMoney()` y sin un símbolo fijo, justo debajo de "How they pay", con la línea de ayuda "Type what they hand over to see the change. It isn't saved." ligada por `aria-describedby`. Es opcional, vive en el estado local de la Sheet, arranca vacío, nunca viene precargado y no ofrece autocompletar.
- **Change**: una línea con la etiqueta "Change" justo después de Received, con la cifra que da `changeFor(received, priced.totals.total, format)`, en Tabular figures y a los decimales del Money format. Se muestra solo cuando `changeFor` devuelve un valor: con Received igual al total muestra 0, y con uno mayor, la diferencia. Va en la tinta apagada, sin acento, signo ni flecha: es secundaria al total de Collect y no parece algo que se cobra.
- En una venta de $0 la ayuda también se muestra: con Received 0 (o 0,00 a los decimales del Money format) `changeFor` da 0 y Change muestra 0; cualquier monto positivo es todo vuelto (Received 5 → Change 5). Por encima de $0, un Received de 0 no muestra nada.
- Change vive en una región `role="status"` siempre presente mientras la ayuda se muestra; está vacía cuando `changeFor` no da nada y no ocupa lugar.
- Un Received vacío, menor que el total o ilegible no muestra nada: ni Change, ni aviso, ni error, ni una línea de "todavía se debe". Nunca frena Collect.
- Se muestra con cualquier Payment method elegido y se oculta entero (campo, ayuda y Change) solo mientras la elección efectiva es owing, leída mediante `effectiveChoice`; nunca se ata al nombre de un medio ni a una marca de efectivo.
- Lo tipeado se conserva al cambiar de medio, al pasar a owing y volver, y tras un guardado fallido.
- Received y Change nunca se guardan ni se mandan: no aparecen en el cuerpo de `POST /api/sales`, que sigue armando solo `saleBodyOf`. Payments, Balance, Cash y Money in son iguales con ellos o sin ellos, y una venta que ignora Received se registra exactamente igual que antes.
- Que Received y Change vayan uno al lado del otro (como en el dibujo) o apilados es un detalle de disposición; en un teléfono angosto se apilan.
- Mientras se guarda, Received se ve igual: queda bloqueado con el resto del campo (`inert`), y "Saving…" sigue siendo la única señal.

### Estados de la lista de medios

- Pendiente: el Selector muestra que carga. Collect queda deshabilitado, con su etiqueta, solo mientras la lista se está leyendo, el teléfono tiene conexión y el total es mayor que $0; una venta de $0 nunca queda bloqueada por la lista. La fila Total y Received se pueden usar. Mientras carga no se muestra ningún texto de lista vacía ni de fallo propio de la Sheet.
- Llegada: Collect queda habilitado.
- Fallida (una lectura fallida de `GET /api/payment-methods`, por un error del servidor o un pedido que no llega): sin cliente, el Selector muestra su propia línea de fallo, que es comportamiento compartido de todo Selector (selector.md), y la Sheet no agrega ningún texto propio. Con cliente, "Owes it" llena la lista y el Selector ya no muestra su línea de fallo, así que la Sheet muestra ese mismo texto (`emptySetMessage` del Selector) en un `FieldRefusal` debajo del campo; "Owes it" sigue ofrecida y una venta con "Owes it" se guarda. En los dos casos la Sheet envuelve el campo para que un toque vuelva a leer la lista (`reload`, igual que SelectorPago y Cobro), y no hay aviso de sin conexión. Collect queda habilitado: una venta de $0 sin medio se guarda con `payment: null`, y por encima de $0 sin medio se aplica el rechazo sin medio de abajo, sin mandar nada. Cuando la lista vuelve a llegar y la vendedora elige un medio, el rechazo se borra.
- Vacía (la lista del servidor llegó sin ningún medio): sin cliente, el Selector muestra su propio texto de lista vacía. Con cliente, "Owes it" llena la lista, así que la Sheet muestra ese texto (`selectorNoPaymentMethods`) como texto de ayuda debajo del campo, nunca como rechazo. Se mira la lista del servidor antes de quitar los medios rechazados: cuando todos los medios fueron rechazados por esta Sheet, no se muestra ese texto, solo la línea "no longer available" que corresponda.
- Sin conexión antes de la primera carga: si el teléfono ya avisó que no tiene conexión y la lista nunca llegó, el cargador compartido no falla sino que espera, y el Selector conserva su aspecto de carga en lugar de su línea de fallo. Para la Sheet cuenta igual como lista fallida: Collect queda habilitado, una venta de $0 sin medio se guarda con `payment: null` y por encima de $0 se aplica el rechazo sin medio, sin mandar nada. Al volver la conexión la lista llega sola. El cargador compartido no cambia en esta parte, porque afectaría a New sale y a Record payment.

### Collect

- Al tocar, llama a `validateSale({...payStateOfEffective(efectivo), total: priced.totals.total, hasCustomer, lines: lineValidationsOf(priced)})`, donde `efectivo` es `collectableChoice(effectiveChoice(...))`; es el único lugar que rechaza el pago. `payStateOfEffective` lee "ningún medio" como pagar sin medio conocido, que `validateSale` rechaza por encima de $0 y deja pasar en $0. Desde #944, `collectableChoice` devuelve la elección tal cual, owing incluido: una venta con "Owes it" va por `validateSale`/`payStateOf` y `saleBodyOf` igual que las demás, el cuerpo no lleva ningún pago, y un borrador que ya trae owing con cliente se muestra como "Owes it" y se guarda. `lineValidationsOf` solo lee lo que `priced` ya dice de cada línea.
- Con owing y sin cliente no se manda nada (0 pedidos): se muestra, en el `FieldRefusal` debajo del Selector y con el **Attention icon**, `SALES_TEXT.owingNeedsCustomer` ("Owing needs a customer. Pick one, or choose how they pay."), y se enfoca el campo, igual que el rechazo sin medio. Volver a poner un cliente o elegir un medio borra el rechazo, y una vez borrado no vuelve solo: si después se saca otra vez el cliente, no aparece hasta el próximo toque en Collect.
- Cada rechazo se muestra solo mientras sigue su causa: el de owing sin cliente solo con owing y sin cliente, y el de sin medio solo con una elección que no es owing. Cualquier cambio de cliente o de tipo de elección los borra, sin efectos (se resuelve al dibujar).
- Una venta de $0 guardada con "Owes it" queda pagada, como dice **Payment state**; la opción no se esconde ni se rechaza por el total.
- Una venta adeudada no crea ningún Payment: suma al Balance de su Customer, fija su Owing since cuando es su venta sin pagar más antigua, cuenta en Sales y Profit en su propia fecha y no mueve el Cash ni el Money in.
- Un medio que el servidor rechazó como no disponible cuenta como ningún medio durante toda la vida de la Sheet, igual que en `NuevaVenta`, se haya vuelto a leer la lista o no.
- Orden de un toque: primero una línea sin precio (no hace nada), después el error de medio o de owing sin cliente, después guardar.
- Si `priced` trae una línea sin precio para la fecha de la venta, el toque no manda nada (0 pedidos), no muestra "Saving…" ni ningún texto nuevo y no llama a `onSavingChange`. Es solo una guarda: se lee lo que `priced` ya dice de la línea, nunca se calcula un precio, y la vendedora no llega a ese estado porque la pantalla anfitriona no abre la Sheet.
- Sin medio por encima de $0 no se manda nada: se muestra "Choose how they pay to collect." en el `FieldRefusal` debajo del Selector, con el **Attention icon** y ligado por `describedBy`, y se enfoca el campo. Si el campo todavía está cargando (y por eso deshabilitado), el foco va al grupo que lo envuelve, el mismo destino que usa el Selector al pasar a carga. Elegir un medio borra el rechazo.
- Una venta de $0 sin medio se guarda con `payment: null`; una de $0 con un medio elegido lo manda.
- Si no, el botón muestra "Saving…" de inmediato, los toques siguientes no mandan nada (una guarda que se activa antes del pedido, así que dos toques seguidos hacen un solo pedido), llama a `onSavingChange(true)` y hace `POST /api/sales` con el cuerpo armado solo por `saleBodyOf`: líneas desde la Sale in progress con `bodyLinesOf` (que usa `quantityOfHundredths`, sin Gift ni Special price); fecha y Note desde la Sale in progress (una Note en blanco va como null) y el Shipping charged desde `priced.totals.shippingCharged`, para que la etiqueta y el cuerpo no puedan discrepar. Ni Received ni Change van en el cuerpo.
- El guardado nunca queda en pausa sin conexión (`networkMode: 'always'`): sin red el pedido falla y el guardado termina, en lugar de dejar la Sheet bloqueada.
- Mientras guarda, el Close propio de la Sheet no hace nada y nada más lo señala: "Saving…" es la única señal. El campo queda bloqueado (`inert`) y Collect no toma toques. Un 401 llega al límite de sesión compartido.

### Resultado

- Éxito: `onSavingChange(false)` y después `onSaved` con la respuesta del servidor sin tocar, aunque su total difiera de `priced`. La Sheet no muestra ninguna cifra propia después.
- Cualquier fallo del guardado llama a `onSavingChange(false)` al terminar, termine como termine.
- 401: lo maneja el límite de sesión compartido (el `MutationCache.onError` global), como en el resto de la app; la Sheet no muestra nada propio.
- Rechazo del medio (el 404 `payment_method.unavailable`): lo reconoce un único predicado, `isMethodUnavailable` en `web/src/sales/saleRefusal.ts`, que también usa `NuevaVenta` (ya no está entre sus `submitOverrides`), así que el mismo rechazo significa lo mismo en los dos lugares. El Selector conserva el medio elegido con su nombre y la marca "no longer available" de inmediato, aunque la lista no se vuelva a leer o esa lectura falle, y debajo se muestra `common:paymentMethodUnavailable` en un `FieldRefusal` con el Attention icon y rol alert, así que se anuncia. Se invalida `keys.paymentMethods()` para volver a leer la lista. El medio rechazado no se vuelve a ofrecer ni a mandar mientras la Sheet esté abierta. Elegir otro medio (o "Owes it") borra la marca y lo manda; un nuevo toque en Collect sin elegir otro, por encima de $0, muestra el rechazo sin medio, no manda nada y enfoca el Selector, y en $0 guarda con `payment: null`. El mismo rechazo nunca se repite, y no se muestra el texto "not saved".
- Cualquier otra causa (otro rechazo de la API, red caída, respuesta mal formada): arriba de Collect, al final del cuerpo y justo encima del pie fijo de la Sheet (la convención de errores de las Sheets), se muestra "The sale was not saved. Your lines are kept, so try again." en un `FieldRefusal` con el Attention icon, anunciado a los lectores de pantalla (rol alert). Es el único texto para esas causas: el `detail` de la API nunca se muestra, y no hay diagnósticos, toast, vibración ni una señal solo de color.
- Después de cualquier fallo, las líneas, el medio (o "Owes it") y lo tipeado en Received se conservan, Collect se puede volver a tocar (un toque es exactamente un pedido más) y Close vuelve a funcionar. El foco queda en Collect o vuelve a él al terminar el guardado, también tras el rechazo del medio; es el toque siguiente el que lo lleva al Selector.
- El texto "not saved" se borra al empezar un reintento, al elegir cualquier medio o con un guardado exitoso; nunca con un temporizador. Mientras corre un reintento solo se ve "Saving…".
- Un guardado fallido que el front ve nunca deja una venta registrada ni se ve como un éxito, y "the sale was not saved" siempre se distingue de "no longer available" por sus palabras.

### Textos

- Viven en `SALES_TEXT`, el módulo de ventas de `web/src/copy/`, en inglés y sin palabra de unidad, moneda ni tipo de producto: `collectTitle(n)`, `howTheyPay` ("How they pay"), `owesIt` ("Owes it", desde #944), `chooseMethod` ("Choose a method"), `noMethodToCollect` ("Choose how they pay to collect."), `collect(total)` ("Collect {total}"), `collectShort` ("Collect", el texto de la etiqueta acortada), `saving` ("Saving…") y, desde #930, `saleNotSaved` ("The sale was not saved. Your lines are kept, so try again."), registrada en LIMITED_COPY como las otras claves de ventas. Los de la parte 3 de GH-867 son `totalLabel` ("Total"), `receivedLabel` ("Received"), `receivedHelp` ("Type what they hand over to see the change. It isn't saved.", registrada en LIMITED_COPY) y `changeLabel` ("Change"); el baseline recibe sus filas del script, nunca a mano. "No customer" ya existía. El baseline se regenera, nunca se edita a mano.
- El rechazo de owing sin cliente tiene su propia clave, `owingNeedsCustomer` ("Owing needs a customer. Pick one, or choose how they pay."), registrada en LIMITED_COPY: dice el problema primero y las dos salidas después (la fila de Customer de la Sheet es de solo lectura, así que "choose how they pay" es la que la vendedora puede hacer en la Sheet). No reutiliza `OWING_HINT`, que es la ayuda de New sale. El mapeo del servidor `sale.owing_without_customer` → `refusals:generic` no cambia, y la Sheet nunca llega a él porque rechaza antes de mandar.
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

El componente `web/src/screens/ventas/NuevaVentaProductos.tsx`, con sus lecturas en `web/src/sales/useNewSaleReads.ts`, sigue los dibujos NuevaVentaProductos y NuevaVentaProductosOscuro (claro y oscuro). Desde la parte 2 de GH-864 la monta la Sheet de New sale, que tampoco tiene ruta: hasta el flip de GH-496 ninguna ruta, entrada de navegación ni pantalla las alcanza; solo las alcanzan sus tests de componente, y los módulos figuran en `web/scripts/docs/front-exclude.json` hasta que el flip los conecte (D-62e6dc23). Rigen las diez invariantes de #924; la 4 y la 6 son las de los estados de carga y de falla (#941).

Diferencias con los dibujos aceptadas por el dueño:

- Desviación 2 del pedido: sin código de barras ni categoría.
- Desviaciones de dibujo #1 y #2 de #940 (Decisión 1 del humano): ni el botón de escanear código de barras junto al campo de búsqueda ni el select de categoría junto a "Results · N". Los Products no tienen código ni categoría, y por la regla del dueño del 2026-11-19 lo que un dibujo muestra de una función que no existe se oculta, nunca queda como marcador ni como control deshabilitado. El placeholder es "Search by name" (inglés hasta #317), no el "Buscar producto o código" del dibujo.

La desviación de dibujo #1 de GH-924 (sin búsqueda) quedó retirada con #940 y la #2 (sin estados de carga ni de falla) quedó cerrada con #941. Las dos tienen que estar entregadas antes de que el flip de GH-496 monte la lista.

Diferencias con el dibujo del estado de búsqueda que #940 le planteó al dueño en el PR y que ningún rol decidió (siguen abiertas hasta que el dueño las resuelva):

- El resaltado va en peso 600, con el color del acento y sin subrayado; el dibujo lo pone en peso 700, en tinta, con un subrayado de 2 px en el acento.
- Los resultados van en orden por nombre; el dibujo pone primero los Products que ya están en la venta.
- El campo no tiene lupa (`.campo` no tiene lugar para un ícono); el dibujo la muestra al principio del campo.

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
- **Lectura de nuevo tras una falla** (decisión 1 (b) del humano; ADR [20261121](../adr/20261121-new-sale-s-product-list-re-reads-after-a-failure-on-reconnect-or-focus-the-only-exception-to-no-background-retry.md)): solo los observadores de esta lista sobre las dos lecturas de fecha vuelven a pedir cuando el teléfono se reconecta o la app recupera el foco, y solo mientras la lectura está en error. No cambia ninguna opción por defecto de la app ni de la consulta (`networkMode`, `gcTime`, `retry`, `staleTime`), no hay bucle de reintentos y una lista cargada nunca se vuelve a pedir en segundo plano. Es la única excepción a "Sin red" de accounts.md. Al montarse la lista en el flip, una lectura de nuevo que ella dispare también refresca al observador de `NuevaVenta.tsx`, porque comparten la entrada de la caché; está aceptado en el ADR.
- La búsqueda no agrega ninguna lectura: filtra en el front los Products que la lista ya recibió.

### Estados de la lista

La lista dibuja solo a partir de `status`, y `priceSale` y `rowPrices` corren solo con `status` en `ready` y el Customer conocido. El estado de ocupado pasa solo por `LoadingWhile`, que marca el `ContentArea` de la pantalla que la monta; la lista nunca dibuja un `ContentArea` propio.

- **Primera carga (`loading`):** `MOST_SOLD_ROWS` filas esqueleto, ocultas para la accesibilidad, hechas con las barras `cargando__barra` y con la altura mínima de una fila cargada, y `aria-busy` verdadero. No hay encabezado, ningún dígito, ningún símbolo del Money format del Business, ninguna pista ni texto de lista vacía. El esqueleto se queda hasta que se resuelven todas las lecturas, la de sugerencias y la de Stock incluidas, salgan bien o mal, así que las filas no se reacomodan cuando llegan las sugerencias.
- **Recarga con la lista cargada (`refreshing`, o `ready` con el Customer en `'pending'`):**
  - los nombres, el texto de Stock y los pasos de las líneas se quedan, y los pasos siguen funcionando: un "+" durante un cambio de fecha sube la cantidad, y al llegar se muestra el precio de la fecha nueva;
  - cada celda de precio muestra la marca compacta de carga (`Loading compacto`) en lugar de su cifra, así que nunca destella un precio viejo;
  - las filas de "Most sold" esconden su "+" hasta que llegan las cifras;
  - la pista no se muestra;
  - la lista queda `aria-busy`.
  `'pending'` significa una lectura del Customer en curso. Qué significa una lectura del Customer fallida lo decide quien monta la lista, nunca la lista; la Sheet de New sale (parte 2 de GH-864) la trata como `'pending'`: las marcas de precio siguen cargando, no se muestra ninguna cifra y no hay Collect.
- **Cargada (`ready`):** la lista de los dibujos, sin `aria-busy`.
- **Falla (`failed`):** un `NetworkError` muestra SinConexion y cualquier otro error muestra ErrorGenerico, los dos tal como ya existen y sin botón. Cualquiera de los dos reemplaza la lista entera, sin `aria-busy`, esqueleto, marca ni pista, y no queda a la vista nada de la lista anterior, porque sus precios eran de una fecha o un Customer que ya no rigen. Un teléfono sin conexión al abrir cuenta como falla: muestra SinConexion y no pide nada hasta que vuelve la conexión.
- **Nueva lectura después de una falla:** como no queda una lista cargada, vuelve el esqueleto con las reglas de la primera carga, nunca la marca compacta.
- **Recuperación:** cuando una lectura posterior sale bien (al reconectar, al recuperar el foco o por un cambio de fecha), la lista reemplaza el aviso, con las líneas, sus cantidades y los precios nuevos. Una lectura que vuelve a fallar deja el aviso hasta el próximo evento.
- **Sale in progress:** ningún estado de carga o de falla la borra ni la cambia; las líneas viven en el borrador, fuera de las lecturas.
- **Total y Collect:** la barra de la Sheet de New sale no muestra el total ni Collect salvo que `status` sea `ready`, el Customer no esté en `'pending'` ni su lectura haya fallado y toda línea tenga precio (ver "Barra de la venta"). Alrededor del aviso de falla, la Sheet de New sale conserva su Close y su fila de Customer.
- **Búsqueda (#940):** el campo queda fuera de `status`: se muestra siempre (esqueleto, recarga, falla y cargada) y conserva su texto. Con texto y la lista mostrando sus nombres (`refreshing` o `ready`), "Results · N" y las coincidencias reemplazan la pista y las secciones, con la marca compacta de carga y las reglas del "+" de las secciones; en `loading` y en una falla no hay resultados ni conteo. Una línea cuyo Product ya no vuelve nunca coincide y no se muestra mientras se busca.

### Filas

- Cada fila muestra el nombre del Product en tinta, debajo, en su propia línea y en gris, "{stock} in stock"; a la derecha, el precio (o "No price") en cifras tabulares y los pasos.
- El Stock se muestra tal cual, 0 y negativos incluidos ("0", "-3,5", "1,5 in stock"), y una línea con más cantidad que el Stock no cambia ese texto: la lista no calcula ningún Stock restante. Un Product con Stock en cero o negativo se puede agregar igual: el Stock solo informa. Lo único que impide agregar es no tener precio.
- La lectura de Stock cuenta en la primera carga; si falla, la lista se muestra igual, sin texto de Stock y sin error.
- Una fila que no está en la venta muestra el precio por unidad que pagaría este Customer al agregarla, de `rowPrices`, sin totales.
- Una línea muestra su propio precio por unidad, de `priceSale` sobre las líneas de la venta (vía `saleLineInputsOf`, envío 0). Puede diferir del de la fila, por ejemplo por un Bulk price o un precio de Customer type.
- El precio pasa por el formateador de dinero del Business (su símbolo y sus decimales) y no lleva etiqueta de Unit, para que sirva a cualquier Business.
- "No price" se muestra exactamente cuando la fila no tiene precio; el componente nunca lee `current_price` por su cuenta (solo `nothingSellable`, para el aviso).
- Las filas de las secciones y las de los resultados de búsqueda se dibujan con las mismas dos formas (línea con pasos, fila con "+"), y ambas usan el id del Product como clave.

### Pasos

- Una fila fuera de la venta y con precio tiene "+" (nombre accesible "Add {name}"), que agrega el Product. Mientras la lista recarga, ese "+" no se muestra.
- Una línea tiene, en un grupo nombrado por el Product: "−" ("Remove one {name}"), la cantidad de solo lectura y "+" ("Add one {name}"). Siguen funcionando mientras la lista recarga.
- La lista no fija ningún paso ni hace cuentas de cantidad: lo decide la Sale in progress (ver Líneas), y "−" desde 1 o menos saca la línea. Un Product que sale de la venta vuelve a "Most sold" si está entre las sugerencias.
- Una línea sin precio muestra "No price", "−" y la cantidad, sin "+"; el lugar del "+" queda vacío para que "−" no se mueva. Una línea que pierde su precio por un cambio de fecha se queda en la venta hasta que la vendedora la saca con "−"; ninguna acción de la lista pierde una línea.
- Una línea cuyo Product la lectura de Products ya no devuelve (archivado o eliminado en otro lado después de agregarlo) también se queda: muestra, en lugar del nombre, el texto compartido "no longer available" (el mismo que usa el Selector para una elección que ya no se ofrece), "No price", su cantidad y "−", que la saca como a cualquier línea. Nunca muestra un id interno ni un nombre adivinado. Su grupo y su "−" usan ese mismo texto como nombre, sin clave de copy nueva. Queda en "In the sale" en el orden en que se agregó y cuenta en su número, nunca aparece en "Most sold" ni en los resultados de una búsqueda, y no tiene "+". Qué pasa al guardar con una línea así es de la parte del guardado.
- Los botones miden al menos 44x44 px, no seleccionan texto, responden al toque sin demora y sus glifos están ocultos para la accesibilidad. Cada botón es su propia pastilla en el tono suave del acento (el dibujo los agrupa en una sola pastilla; el dueño lee y hace lo mismo).
- Todavía no hay forma de tipear una cantidad en la lista: 10 unidades son 10 toques. Dónde vive la cantidad tipeada lo decide el flip.

### Búsqueda

(#940.) Sirve para encontrar por nombre un Product que no está en la venta ni en "Most sold". Solo acota lo que se muestra: nunca cambia la Sale in progress, sus líneas ni sus cantidades.

- **Campo**: arriba de todo, construido como la búsqueda de Customers (`label.campo` + `input.campo__input`, a 17 px y con la altura `--alto-boton`), sin lupa. Etiqueta visualmente oculta "Search products" y placeholder "Search by name"; `type="search"`, `inputMode="search"`, `autoComplete="off"`, `enterKeyHint="search"`, con letra de al menos 16 px para que el teléfono no haga zoom. Se muestra siempre y conserva su texto, también mientras la lista no muestra nada. El texto es estado local del componente.
- **Qué coincide**: el texto tipeado, recortado, coincide en cualquier parte del nombre del Product tal como lo escribió la vendedora, sin importar mayúsculas ni acentos (la misma regla que la búsqueda de Customers y el Selector: `matchesQuery`, `foldForSearch` y `matchRange` de `web/src/components/selectorSearch.ts`, sin un segundo normalizador). No supone marca, tipo de producto ni Unit.
- **Texto solo de espacios** cuenta como búsqueda vacía: se ve la lista normal, con el aviso, "In the sale" y "Most sold".
- **Qué cubre**: solo los Products que la lista ya recibe (nunca Archived products ni nada de otro Business). Una línea "no longer available" no tiene nombre, así que nunca coincide; no se muestra mientras se busca y vuelve al borrar la búsqueda, sin perderse nunca de la venta.
- **Resultados**: con texto, "Results · {n}" (un encabezado de sección con su nombre accesible, como los demás) y debajo las coincidencias, sin agrupar por si están en la venta, ordenadas por nombre sin importar mayúsculas ni acentos (empates por el nombre tal cual y después por id); n es la cantidad de filas mostradas. Sin coincidencias, solo "Results · 0", nada más. Mientras se busca no se muestran el aviso, "In the sale" ni "Most sold".
- **Filas de resultados**: cada una es la misma fila que en la lista sin búsqueda. Un Product que ya está en la venta aparece con su línea (pasos, cantidad y su propio precio); uno con precio fuera de la venta, con su precio y "+"; uno sin precio, con "No price" y sin "+".
- **Resaltado**: el nombre lleva un elemento `mark` (`nv-productos__marca`) sobre la primera coincidencia, en peso 600, con el token del acento y fondo transparente; como también cambia el peso, no depende solo del color. El `mark` cubre los caracteres del nombre tal como está escrito, aunque la coincidencia haya sido ignorando un acento o una mayúscula ("arb" sobre "Árbol" marca "Árb"); el nombre mostrado nunca cambia.
- **Después de tocar un resultado**: el texto de búsqueda queda; solo la vendedora lo borra. La fila conserva su lugar y pasa del "+" a sus pasos sin salto, y el foco va al "+" de los pasos ("Add one {name}"). Así puede agregar varios Products que coinciden con las mismas letras sin volver a tipear, y la venta sigue con a lo sumo una línea por Product.
- **Limpiar**: el dibujo del estado de búsqueda no muestra ningún control para limpiar, así que no hay ninguno: ni uno propio ni el nativo del campo `search`, que se oculta (`.nv-productos__buscar::-webkit-search-cancel-button`). Borrar el texto devuelve la lista exactamente como estaba: las mismas secciones, filas y orden.
- **Sin filtros**: solo por nombre; nada de filtros por Stock, precio, Hidden product ni Catalog attributes.

### Secciones

- Con la búsqueda vacía: arriba va el aviso, cuando corresponde; después, "In the sale · {n}" con las líneas en el orden en que se agregaron, solo si hay líneas.
- Debajo, "Most sold" se muestra solo si tiene filas: conserva el orden de las sugerencias, deja afuera los Products que ya están en la venta y los ids que la lectura de Products no devolvió, y aplica el tope (`MOST_SOLD_ROWS`) después de filtrar. Sale solo del propio Business, sin Gifts ni Archived products, y nunca fija un precio, un monto ni una cantidad.
- Con texto en la búsqueda, las secciones no se muestran: solo los resultados (ver Búsqueda).
- Los encabezados de sección y el de resultados son chicos, en negrita media y en gris, como en el dibujo.
- Sin Sales todavía (y sin líneas), el cuerpo con la búsqueda vacía queda vacío: ninguna fila, encabezado ni aviso. Un Product que no está en la venta ni en "Most sold" se alcanza con la búsqueda.

### Aviso

- Cuando no hay nada para vender, debajo del campo de búsqueda y arriba de las secciones se muestra, con el Attention icon y sin poder tocarse, el aviso de que no hay Products (`selectorNoVarieties`) o el de que ninguno tiene precio para esa fecha (`NO_PRICE_HINT`), según `nothingSellable`.
- Sigue a la fecha de la venta y se muestra solo con la lista en `ready` y el Customer conocido: se oculta mientras carga o recarga y en una falla. Su altura no se reserva, así que puede correr la lista al aparecer; se juzga en el recorrido del flip. Se oculta mientras se busca.

### Fallos

- Un fallo de la lectura de Products o de Pricing settings, o un teléfono sin conexión, reemplaza la lista por SinConexion o ErrorGenerico, y la lista vuelve a leer al reconectar o al recuperar el foco (ver "Lecturas" y "Estados de la lista"). La venta conserva sus líneas.
- Un fallo de las sugerencias no muestra ningún error y solo deja sin "Most sold": ni marca ni encabezado vacío. Las sugerencias tampoco tienen marca de carga.
- Un fallo del Stock no muestra ningún error y solo deja las filas sin texto de Stock.

### Textos

En el Copy module (`web/src/copy/sales.ts`, grupo `newSale` de `SALES_TEXT`), en inglés y sin palabras de Unit ni de tipo de producto: `productsInSale` "In the sale · {n}", `productsMostSold` "Most sold", `productStock` "{stock} in stock", `productNoPrice` "No price", `productAdd` "Add {name}", `productIncrease` "Add one {name}", `productDecrease` "Remove one {name}", y desde #940 `productsResults(n)` "Results · {n}", `productSearchLabel` "Search products" y `productSearchPlaceholder` "Search by name". Están registrados en LIMITED_COPY y BASELINE_ARGS. El texto "no longer available" se reutiliza del existente, no se agrega. Los estados de carga y de falla no agregan ninguna clave: reutilizan SinConexion, ErrorGenerico, `LoadingWhile` y `Loading compacto`. El baseline (`en.baseline.json`) se regenera con su paso cuando el paso puede; como `i18n:baseline --update` nunca agrega una entrada, la de una clave nueva se inserta en su lugar ordenado con el texto que emite el propio script.

### Diseño

- Colores, tipografía y espacios salen solo de los tokens; el modo oscuro es el mismo marcado con los tokens oscuros. La fila esqueleto tiene su única regla propia, `.nv-productos__fila--esqueleto`, que le da la altura mínima de la fila real con tokens.
- Las diferencias aprobadas con los dibujos son las de arriba (desviación 2 y desviaciones de dibujo #1 y #2 de #940); las tres del estado de búsqueda (resaltado, orden, lupa) siguen planteadas al dueño. Diferencias de peso y tono que se leen igual (precio y nombre más livianos que en el dibujo, pasos en pastillas separadas, fila esqueleto de dos barras sin forma de paso) quedan como observaciones. Ningún dibujo muestra la marca compacta en estas celdas ni el "+" oculto de "Most sold" al recargar. Cualquier otra diferencia que el dueño leería o haría distinto en el teléfono se le plantea al dueño en el PR; nadie la acepta como supuesto.
- El dibujo compartido de sin conexión en `Estados.dc.html` promete volver a intentar sola cuando vuelve la conexión; para esta lista eso es cierto desde #941.
- No hay captura lado a lado mientras la pantalla no tenga ruta (`route: null` en `scripts/design/screens.json`). El corrimiento de contenido y el blanco durante la carga se juzgan en el recorrido del flip.
- El resaltado va en peso 600 y en el color del acento (el acento del resaltado sigue a `NuevaVentaProductosOscuro`), sin depender solo del color. El campo oculta el botón nativo de borrar porque el dibujo no muestra un control de borrado.
- El estado de búsqueda se compara a ojo con NuevaVentaProductos y NuevaVentaProductosOscuro, claro y oscuro, con la Design capture adjunta al PR. Mientras la lista no tenga ruta, la captura lado a lado no es posible y queda "not compared"; confirmarla a ojo queda para el recorrido del flip.

## Fuera de esta capacidad (por ahora)

- Cualquier ruta, entrada de navegación o pantalla que monte el Anfitrión de New sale, la Sheet de New sale, la Sale in progress o la lista de Products, y el flip que las monta; también la entrada de WalkState y de `screens.json` de la Sheet de New sale.
- Cualquier cambio a la guarda de `NuevaVenta.tsx`, que sigue sirviendo a la pantalla en vivo hasta el flip.
- Cualquier cambio de texto, disposición o dibujo de la pregunta "Discard the sale?"; va al dueño como desviación.
- El toast después de un guardado exitoso, que una parte posterior inserta antes de `leave()`.
- Un botón de reintento o un aviso de falla en la fila de Customer de la Sheet de New sale, un botón de reintento en los avisos de falla de la lista, o cualquier reintento más allá de la lectura de nuevo al reconectar o al recuperar el foco; cambios a SinConexion o a ErrorGenerico.
- Cualquier texto de promoción o de ahorro en la barra de la venta (desviación 1 de GH-864).
- Pulido de la Sheet de New sale en la computadora (Phone first).
- La cantidad tipeada en la lista (flip). Un control para limpiar la búsqueda, que el dibujo no muestra.
- Si el texto de búsqueda se recuerda al salir de la lista y volver (lo decide el flip; hoy es estado local y no se lleva a ningún lado).
- Filtros de la lista por Stock, precio, Hidden product o Catalog attributes.
- El guardado de New sale fuera de la Collect Sheet, incluido qué pasa al guardar una línea cuyo Product ya no está disponible.
- Código de barras, categoría y elementos de promoción en la lista de Products.
- Ya en el flip: la regla de no abrir la Collect Sheet con una línea sin precio; que el anfitrión ignore el volver del sistema y Escape mientras `onSavingChange(true)`; un test que monte la barra de la venta y la Sheet juntas y muestre el total guardado igual al de la barra y a `SaleOut.total`; y que tras `onSaved` la pantalla muestre las cifras de la respuesta con el aviso de recotización (`linesRepriced`) cuando el total cambió.
- Reescribir el criterio 34 de sales.md ("el medio nunca viene puesto"), que le corresponde al flip, cuando la preselección llegue a la vendedora.
- Un pago parcial en el momento de la venta: las opciones son pagada por completo con un medio o "Owes it" sin nada pagado ahora; un pago parcial es un Payment posterior por Record payment y el Settlement.
- Guardar, mandar o mostrar Received o Change en cualquier otro lugar que la Collect Sheet.
- Un aviso de Credit o una vista previa del Balance en la Collect Sheet, y una línea extra u otra palabra de acción para una venta adeudada.
- Cualquier cambio a los Payment methods o a Settings por "Owes it".
- Un gesto para volver a unset desde "Owes it" que exija cambiar el Selector compartido.
- Una comprobación en un navegador real, en ambos temas, de que la etiqueta de Collect se acorta a "Collect" y vuelve a "Collect {total}" a 320 px y a 246 px, y de que la Sheet entera entra en el teléfono con la fila Total y la ayuda de vuelto (hasta entonces solo la prueba el stub de `scrollWidth`).
- Textos propios de la Collect Sheet para rechazos que no son el del medio ni el de owing sin cliente, y devolverlos a la pantalla anfitriona (lo decide el flip).
- Cualquier cambio al Selector, a `usePaymentMethodOptions` o al cargador compartido de la lista de medios, al Attention icon o a la Icon and text rule por los caminos de fallo de la Collect Sheet o por "Owes it", incluida la línea de fallo sin conexión antes de la primera carga.
- Un texto propio de la Collect Sheet para una línea sin precio.
- Gift, Special price y la Sheet del detalle de línea.
- Conservar la venta en curso tras una recarga.
- Cualquier cambio en el servidor, incluida la protección contra el doble registro.

## Métricas

- Cada regla de Líneas, Sin guardar, Cómo se paga, Cliente y owing, y Apertura tiene su test unitario de la Sale in progress, y pasa; incluye que sacar el cliente conserva owing y paid(id), que cambiar el cliente conserva la elección y que unset después de owing queda unset (#944).
- Cliente de sugerencias, a nivel de fetch: exactamente 1 pedido por apertura, con `on` igual a la fecha de apertura; 0 pedidos nuevos después de editar la fecha o volver a dibujar; 1 pedido nuevo en una apertura de otro día; una lectura fallida da ninguna sugerencia y 0 errores lanzados.
- Lista de Products, en tests de componente a nivel de fetch: cada caso de la lista (pasos, cantidades tipeadas, una línea por Product, "No price", línea que pierde su precio, línea cuyo Product ya no vuelve, sugerencias filtradas y con tope, Stock, bulk a 10, recotización por Customer y por fecha, aviso, símbolo y decimales del Money format) tiene su test y pasa; 0 pedidos nuevos de sugerencias tras cambiar la fecha; 0 cambios en los totales de la venta al mostrar más filas.
- Búsqueda, en `NuevaVentaProductos.test.tsx` con el arnés de #924: mayúsculas, acentos, coincidencia en cualquier parte, orden por nombre (con orden fijo entre nombres que solo difieren por acento o mayúscula), "Results · 0" sin nada más, resaltado de la primera coincidencia sobre los caracteres originales, texto solo de espacios como vacío, aviso y secciones ocultos mientras se busca, Product de la venta con su línea en los resultados, Product con precio fuera de "Most sold" con su "+", Product sin precio con "No price" y sin "+", el texto que queda y el foco en los pasos tras tocar "+" en un resultado, y el campo a la vista sin conteo ni resultados mientras las lecturas no llegaron; cada caso tiene su test y pasa.
- Al borrar la búsqueda, diferencias en secciones, filas u orden respecto de antes de buscar: 0. Cambios en la Sale in progress (líneas, cantidades, orden) causados por tipear o borrar en la búsqueda: 0. Pedidos de red nuevos causados por la búsqueda: 0.
- Estados de carga y de falla, en `NuevaVentaProductos.test.tsx` sobre el arnés de #924, cada uno con su test que pasa en el Gate (vitest):
  1. **Primera carga sin cifras:** mientras falta alguna lectura (sugerencias y Stock incluidas), la lista está `aria-busy` y muestra 0 dígitos, 0 símbolos del Money format, 0 textos de lista vacía y 0 encabezados.
  2. **Recarga sin precio viejo:** un cambio de Customer o de fecha conserva las líneas y sus cantidades, pone la marca compacta en las celdas de precio sin destellar la cifra anterior, oculta la pista y deja la lista `aria-busy`; un "+" durante un cambio de fecha sube la cantidad.
  3. **Falla distinguible:** un 500 en Products muestra ErrorGenerico; una falla de red y un teléfono sin conexión al abrir muestran SinConexion.
  4. **Lecturas secundarias que nunca bloquean:** un 500 en sugerencias o en Stock no muestra error y la lista funciona.
  5. **Busy solo al cargar:** 0 estados de falla con `aria-busy`.
  6. **Recuperación:** una lectura después de una falla muestra el esqueleto; una reconexión o una vuelta del foco tras una falla vuelve a pedir y devuelve la lista con las cantidades cargadas y los precios nuevos; una lista cargada hace 0 pedidos nuevos al recuperar el foco o al reconectar; otro observador de la misma consulta conserva sus propias opciones.
- Líneas perdidas por una acción de la lista, una recarga de Products o una falla: 0. Ids internos mostrados en pantalla: 0.
- Cifras mostradas antes de que lleguen todas las lecturas, mientras el Customer está pendiente o durante una falla (dígitos, símbolo de moneda, "No price", aviso, encabezados): 0.
- Operaciones de dinero en `useSaleDraft`, en el cliente de sugerencias, en el Anfitrión de New sale, en la Sheet de New sale y en la lista de Products: 0 (todo pasa por `pricing.ts`).
- Rutas, constantes, parámetros, banderas, props, exports o hooks `data-*` solo para tests: 0.
- Claves del Copy module de la lista de Products: 10 (7 de #924 y 3 de #940), en inglés y sin palabras de Unit ni de tipo de producto; agregadas por los estados de carga y de falla: 0. Pedidos de red nuevos causados por la búsqueda: 0.
- Gate (pytest, vitest, e2e) pasa, y tsc strict y oxlint pasan sin nada silenciado.
- Vara del trabajo, que se juzga cuando el flip la monte: una venta se registra desde el teléfono en menos de un minuto (sales.md, criterio 1), y un Product habitual se encuentra, se agrega y se ajusta sin salir de la lista (1 toque para un Product habitual a 1 unidad desde "Most sold"), y uno que no está en "Most sold" se agrega en 2 toques (el campo y el "+" de su resultado) tipeando parte de su nombre. No hay medición de uso en la app hasta el flip de GH-496.
- `customerPriceLineOf`, con test unitario en `newSaleView.test.ts`: Pricing settings pendientes con un Customer con tipo da la marca de carga; lectura de la lista fallida con un Customer con tipo da nada; lectura del Customer fallida con los Pricing settings pendientes da nada; un Customer con tipo da "Prices for {type}" con el interruptor encendido y "List prices" con el interruptor apagado.
- Sheet de New sale (parte 2 de GH-864), con Testing Library y fetch stubbeado (los stubs de `NuevaVentaProductos.test.tsx` y `stubFetchWithSettings.ts`, en `NuevaVentaSheet.row.test.tsx` y `NuevaVentaSheet.bar.test.tsx` con un solo helper de render), cada caso con su test que pasa en el Gate (vitest):
  - **Fila:** sin cliente ("No customer"); Customer sin tipo ("List prices"); Customer con tipo ("Prices for {type}"); interruptor Customer types apagado ("List prices"); nombre pendiente y tipo pendiente (marca compacta); lectura fallida, con nombre y sin nombre, sin línea de precio; un nombre de 60 caracteres conserva su nombre accesible completo; Change llama a `onChangeCustomer`.
  - **Barra:** el conteo para una línea ("1 item") y para varias; el total es igual a `totals.total` de `priceSale` en el Money format con envío mayor que 0; la barra vacía no tiene ningún botón Collect; Collect llama a `onCollect` con la venta; carga, recarga, Customer pendiente, lista fallida, lectura del Customer fallida (las marcas de la lista siguen cargando y no se ve ninguna cifra) y una línea sin precio: cada uno sin Collect y sin total; el texto de la región de estado en cada uno de los cuatro estados.
  - **Close:** llama a `onClose` y no muestra ningún diálogo, también con la Sheet tocada.
- Sheet de New sale: Collect fuera del estado total: 0, y Collect `disabled` o `aria-disabled`: 0. "List prices", "Prices for {type}" o cifras de dinero con la lectura del Customer fallida: 0. Fuentes de `touched` distintas de `isDirty(draft.state)`: 0. Cifras que no salen de `pricedSaleOf`: 0. Textos fuera de `web/src/copy/`: 0.
- Claves del Copy module agregadas por la parte 2 de GH-864: 5 (`listPrices`, `pricesFor`, `itemsCount`, `itemsTotal`, `addProductToCollect`), en inglés y sin palabras de Unit, moneda ni tipo de producto; el baseline, copyLimits y productWord pasan.
- Vara de la Sheet de New sale, que se juzga cuando el flip la monte: la vendedora ve qué precios le tocan al Customer antes de agregar nada, y nunca ve un total ni un Collect que no estén calculados por completo; la Sheet suma un solo toque al trabajo (Collect), y leer el Customer, los precios y el total no lleva ninguno; suma a la vara de menos de un minuto de sales.md, criterio 1.
- Anfitrión de New sale (parte 2 de GH-869), con Testing Library sobre `createMemoryRouter` y fetch falso (los falsos de `renderNuevaVentaSheet` se pueden reutilizar), un grupo de tests por caso, que pasa en el Gate (vitest):
  - **Sin líneas:** Close, Escape y el volver del sistema cierran sin preguntar; un cliente, un Shipping charged o una Note solos no preguntan.
  - **Con una línea:** los tres muestran "Discard the sale?"; "No, keep entering" conserva las líneas y "Yes, discard it" sale.
  - **Sheets apiladas:** con una línea, cerrar una Collect o una búsqueda de cliente apiladas nunca pregunta y conserva las líneas.
  - **Guardado:** un guardado con líneas nunca pregunta y hace exactamente un cambio de lugar.
  - **Dirección directa:** Close cae en el padre de la Navigation y pregunta solo con líneas.
  - **Una sola fuente:** la guarda y el `touched` de la Sheet siguen el agregado de una línea y se limpian los dos después de `stepDown`.
- Anfitrión de New sale: preguntas mostradas sin líneas: 0. Líneas perdidas tras "No, keep entering" o al cerrar una Sheet apilada: 0. Cambios de lugar por guardado exitoso: exactamente 1. Fuentes de "sin guardar" distintas de `isDirty(draft.state)`: 0. Campos agregados a `SaleDraftApi`: 0. Diálogos en la Sheet de New sale: 0. Claves del Copy module agregadas: 0. Guardas de salida en el anfitrión: exactamente 1.
- Vara del Anfitrión de New sale, que se juzga cuando el flip lo monte: ninguna línea agregada se pierde por una salida por error, y una venta sin líneas se cierra sin ningún toque extra; suma a la vara de menos de un minuto de sales.md, criterio 1.
- Collect Sheet, con Testing Library a nivel de fetch: sin medio por encima de $0, 0 pedidos y el campo enfocado; con una línea sin precio en `priced`, 0 pedidos, ningún texto nuevo y ninguna llamada a `onSavingChange`; mientras guarda, toques extra y Close dan 0 pedidos adicionales; tras un pedido rechazado, `onSavingChange` termina en false y Close vuelve a funcionar; la etiqueta de Collect es igual a `priced.totals.total` formateado y `onSaved` recibe la respuesta sin tocar.
- Received y Change, en un segundo archivo de tests de la Collect Sheet con Testing Library a nivel de fetch: con Received vacío, menor o inválido, 0 líneas de Change y 0 avisos o errores; con Received igual al total, Change 0; con uno mayor, la diferencia exacta, a 0 y a 2 decimales del Money format; en una venta de $0 con Received 0, Change 0; 0 apariciones de Received o Change en el cuerpo de `POST /api/sales`; Received conservado tras cambiar de medio, pasar a owing y volver, y tras un guardado fallido; ayuda oculta con owing; al ancho angosto donde el botón dice "Collect", la fila Total muestra el total; etiqueta acortada a "Collect" con `scrollWidth` > `clientWidth` (definido con `Object.defineProperty`), nombre accesible con el "Collect {total}" completo, y la etiqueta completa de vuelta cuando vuelve a entrar.
- "Owes it" (#944), con Testing Library a nivel de fetch y en el mismo host que los tests de #918:
  - Se ofrece solo con cliente, última después de los Payment methods, y elegirla guarda `{kind:'owing'}`; Collect hace exactamente 1 pedido, armado por `saleBodyOf`, sin ningún Payment. Sin cliente no está en la lista.
  - Elegir el medio B, después "Owes it" y después unset desde la Sale in progress: el campo muestra la propuesta y Collect manda la propuesta, nunca B.
  - "Owes it" y después el medio C manda C.
  - Un borrador que ya trae owing con cliente se muestra como "Owes it" y se guarda en 1 pedido.
  - Con owing y el cliente sacado por el host: "Owes it" con la marca "no longer available", 0 pedidos al tocar Collect, `owingNeedsCustomer` visible y el Selector enfocado; volver a poner el cliente borra el rechazo y lo guarda en 1 pedido; sacarlo otra vez no muestra el rechazo hasta el próximo toque.
  - Dos rechazos seguidos (sin medio, después owing sin cliente): cada uno se muestra solo mientras sigue su causa, y `aria-describedby` apunta siempre a la línea visible.
  - Lista de medios fallida con cliente: "Owes it" ofrecida, la línea de fallo de la Sheet visible y una venta con "Owes it" se guarda. Lista retenida: ningún texto de lista vacía; respondida con `[]`: `selectorNoPaymentMethods` como texto de ayuda, no como rechazo. Todos los medios rechazados: ningún texto de lista vacía, tampoco al elegir "Owes it".
  - `howTheyPayView`, con test unitario: con cliente y owing, con cliente y paid, sin cliente y owing, sin cliente y unset con la propuesta, propuesta rechazada y medio no disponible.
  - Record payment nunca ofrece "Owes it".
  - La etiqueta de Collect con "Owes it" es la misma que con un medio.
- Ventas guardadas como adeudadas sin Customer: 0. Payments creados por una venta con "Owes it": 0. Medios puestos en lugar de "Owes it" sin que la vendedora los elija: 0.
- Claves del Copy module agregadas por #944: 2 (`owesIt` y `owingNeedsCustomer`), en inglés y sin palabras de Unit, moneda ni tipo de producto.
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
- Vara de #930, que se juzga cuando el flip monte la Sheet: después de cualquier fallo, la venta se termina de registrar con un toque más en Collect, sin volver a tipear ninguna línea.
- Llamadas a `priceSale`/`priceLine` desde la Collect Sheet: 0, y operaciones de dinero propias en ella: 0 (todo pasa por `pricing.ts`, el Change incluido mediante `changeFor`).
- Textos de la Collect Sheet fuera de `web/src/copy/`: 0.
- Con el medio propuesto ya elegido, la Collect Sheet guarda con a lo sumo una elección y un toque en Collect (la vara del flip, arriba, se juzga cuando la monte).
- Toques o pasos extra para registrar una venta que ignora Received: 0. Diferencias en Payments, Balance, Cash y Money in con o sin Received: 0.
- Vara del vuelto, que se juzga cuando el flip la monte: con Received tipeado, el Change aparece sin ningún toque extra.
