# Sale in progress

## Jobs

**Cuando** entrego un pedido y lo registro en el teléfono, **quiero** armar la venta con los clientes, productos y el medio de pago que suelo elegir, ajustando solo cantidades y con cada total calculado por la app, **para** guardar la venta en menos de un minuto y nunca cotizar de memoria ni volver a tipear lo que elegí hace un momento. (Parte 3 de GH-496: la sirven el estado de la venta en curso, `useSaleDraft`, y el cliente del front de las **New sale suggestions**. Afina la primera historia de sales.md; no es un trabajo nuevo).

**Cuando** termino de armar una venta en New sale, **quiero** ver lo que estoy por cobrar y decir cómo me pagaron, o que me lo deben, **para** guardar la venta de un toque con el pago correcto y la deuda correcta. (Parte 2 de GH-867: la sirve la **Collect Sheet**. Es el paso de cierre del trabajo de BRIEF "una venta se registra desde el teléfono en menos de un minuto"; no es un trabajo nuevo).

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
- La propuesta cuenta solo si está entre los Payment methods ofrecidos; si no lo está, o la lista ofrecida todavía no llegó, unset no tiene medio efectivo. paid(id) y owing se devuelven como los eligió la vendedora, salvo lo que diga la Collect Sheet sobre un medio marcado "no longer available" (ver abajo), que se resuelve dentro de `effectiveChoice`.

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

El paso de cierre de New sale, `web/src/screens/ventas/CollectSheet.tsx`, dibujado dentro de la Sheet compartida (`web/src/components/Sheet.tsx`) a partir del dibujo NuevaVentaCobrar y su gemelo oscuro (salida aceptada 3), con la misma división que Cobro/CobroRoute. Sirve igual para entregar en la puerta que para registrar una venta después: la fecha viene de la Sale in progress. No tiene ruta hasta el flip de GH-496.

### Props

- `draft` (`SaleDraftApi`), `priced` (`PricedSale`, la única fuente de precios de la pantalla anfitriona, que nunca se vuelve a calcular: ninguna llamada a `priceSale` ni `priceLine` ni consulta de precios), `customerName` (`string | null`), `onClose()`, `onSaved(sale)` y `onSavingChange(saving)`.
- La pantalla anfitriona maneja Escape y el volver del sistema; la Sheet no agrega ningún listener de Escape ni de popstate.

### Lo que ve la vendedora

- Título "The sale · {n} items", con n = `priced.lines.length` (forma singular para una línea si el Copy module tiene plurales).
- Una fila de Customer de solo lectura con `customerName`, o el "No customer" existente.
- Un **Selector** "How they pay" alimentado por `usePaymentMethodOptions`, cuyo valor es `effectiveChoice(choice, proposedMethodId, ids ofrecidos, o null mientras la lista está pendiente)`. Una propuesta no ofrecida da el campo vacío ("Choose a method").
- "Owes it" es una opción solo cuando la venta tiene Customer; elegirla pone owing. Elegir un medio pone paid(id). Volver de "Owes it" a pagar pone unset, que muestra la propuesta o el campo vacío: la venta no recuerda una elección anterior.
- Un botón "Collect {total}" con `priced.totals.total` en el **Money format** del Business, con la misma etiqueta para cualquier elección, "Owes it" incluido (el campo de arriba ya dice que se debe).

### Estados de la lista de medios

- Pendiente: el Selector muestra que carga y Collect queda deshabilitado, con su etiqueta.
- Fallida: el Selector muestra su propio fallo y recarga al tocarlo; Collect queda habilitado.
- Llegada: Collect queda habilitado.

### Collect

- Al tocar, llama a `validateSale({...payStateOf(efectivo), total: priced.totals.total, hasCustomer, lines: []})`; es el único lugar que rechaza el pago.
- Sin medio por encima de $0, o con un medio marcado "no longer available" (que cuenta como ningún medio, resuelto dentro de `effectiveChoice` con los ids realmente ofrecidos), no se manda nada: se muestra "Choose how they pay to collect." con el **Attention icon** y se enfoca el campo.
- Una venta de $0 sin medio se guarda con `payment: null`; una de $0 con un medio elegido lo manda.
- Si no, el botón muestra "Saving…" de inmediato, los toques siguientes no mandan nada, llama a `onSavingChange(true)` y hace `POST /api/sales` con el cuerpo armado solo por `saleBodyOf`: líneas desde la Sale in progress con `quantityOfHundredths`, emparejadas con `priced.lines` por id; fecha, envío y nota desde la Sale in progress.
- Mientras guarda, el Close propio de la Sheet no hace nada y nada más lo señala: "Saving…" es la única señal. El campo y Collect no toman cambios.

### Resultado

- Éxito: `onSavingChange(false)` y después `onSaved` con la respuesta del servidor sin tocar. La Sheet no muestra ninguna cifra propia después.
- Fallo: `onSavingChange(false)`. Un 401 queda para el límite de sesión. El rechazo que corresponde al campo del medio muestra la marca "no longer available" del Selector e invalida `keys.paymentMethods()`. Cualquier otra causa muestra "The sale was not saved. Your lines are kept, so try again." con el Attention icon arriba de Collect. El medio y las líneas se conservan, Collect se puede volver a tocar y Close vuelve a funcionar.

### Textos

- Viven en el módulo de ventas de `web/src/copy/`, en inglés y sin palabra de unidad, moneda ni tipo de producto: el título, "How they pay", "Choose a method", "Owes it", el error sin medio, "Collect {total}", "Saving…" y el texto de guardado fallido.

### Hueco conocido

- Una venta cuya respuesta se perdió después de que el servidor la guardó puede registrarse dos veces al reintentar, e inflar Sales, Profit y, si se debe, el Balance del Customer. No hay protección en el repo; requiere trabajo en el servidor y va como pieza propia. Quien programe el flip de GH-496 decide si sale antes.

## Cliente de las New sale suggestions

- Vive en `web/src/api/` y lee `GET /api/sales/suggestions` con `on` obligatorio. La lectura del servidor está definida en sales.md ("New sale suggestions").
- `openedOn` (el día de la apertura) se fija una sola vez al abrir New sale y ninguna acción lo cambia; es la única fecha que lee el cliente de sugerencias, nunca la fecha editable de la venta. Editar la fecha o que cambie el día después no vuelve a pedirlas.
- Una sesión perdida (401) en la lectura manda a la vendedora a iniciar sesión, como cualquier otra lectura; cualquier otro fallo (otro estado, red caída, cuerpo mal formado) da ninguna sugerencia, en silencio y sin escribir en la consola.
- La respuesta replica la del servidor: `recent_customer_ids` y `most_sold_product_ids` (listas de ids) y `last_payment_method_id` (un id o null).
- Se pide una sola vez por apertura de New sale, con la fecha de apertura como clave. Volver a dibujar o editar la fecha de la venta nunca la vuelve a pedir ni la cambia; una apertura nueva otro día es una clave nueva.
- Las sugerencias solo acortan elecciones: nunca fijan un precio, un monto ni una cantidad.

## Fuera de esta capacidad (por ahora)

- La pantalla anfitriona de New sale que monta la Collect Sheet, y el flip que la monta.
- Reescribir el criterio 34 de sales.md ("el medio nunca viene puesto"), que le corresponde al flip, cuando la preselección llegue a la vendedora.
- Received y Change en la Collect Sheet.
- Gift, Special price y la Sheet del detalle de línea.
- Conservar la venta en curso tras una recarga.
- Cualquier cambio en el servidor, incluida la protección contra el doble registro.

## Métricas

- Cada regla de Líneas, Sin guardar, Cómo se paga, Cliente y owing, y Apertura tiene su test unitario de la Sale in progress, y pasa.
- Cliente de sugerencias, a nivel de fetch: exactamente 1 pedido por apertura, con `on` igual a la fecha de apertura; 0 pedidos nuevos después de editar la fecha o volver a dibujar; 1 pedido nuevo en una apertura de otro día; una lectura fallida da ninguna sugerencia y 0 errores lanzados.
- Collect Sheet, con Testing Library a nivel de fetch: sin medio por encima de $0, o con un medio marcado "no longer available", 0 pedidos y el campo enfocado; mientras guarda, toques extra y Close dan 0 pedidos adicionales; tras un fallo, un reintento da exactamente 1 pedido más y conserva medio y líneas; una venta sin Customer nunca se manda como owing; la etiqueta de Collect es igual a `priced.totals.total` formateado y `onSaved` recibe la respuesta sin tocar.
- Operaciones de dinero en `useSaleDraft`, el cliente de sugerencias y la Collect Sheet: 0 (todo pasa por `pricing.ts`), y llamadas a `priceSale`/`priceLine` desde la Collect Sheet: 0.
- Rutas, constantes, parámetros, banderas o hooks `data-*` solo para tests: 0.
- Textos de la Collect Sheet fuera de `web/src/copy/`: 0.
- Gate (vitest para esta parte; pytest, vitest y e2e en general): pasa.
- Vara del trabajo, que se juzga cuando el flip la monte: una venta se registra desde el teléfono en menos de un minuto (sales.md, criterio 1), y con el medio propuesto ya elegido se guarda con a lo sumo una elección y un toque en Collect.
