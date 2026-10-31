# Apostrophe

El back office de los negocios chicos que venden flor por gramo: qué vende cada uno y a qué precio, qué entra y qué sale del Stock, quién debe qué, en qué gasta y si gana plata. Una instalación guarda varios Businesses, y nunca se mezclan. Reemplaza la planilla `Control_de_ventas_y_gastos`.

Cada término lleva `_In the app_`: la palabra en inglés que una persona ve en pantalla (la app está en inglés, `docs/product/product-language.md`); donde el término del glosario se leería como código, la palabra de pantalla es una más simple en inglés. El código, los tests y los docs usan el término del glosario. Las definiciones están escritas en español; los términos, `_In the app_` y `_Avoid_` siguen en inglés.

## Businesses y Users

**Business**:
La operación de un vendedor y todo lo que se registra para ella: Varieties, precios, Customers, Sales, Stock, Expenses y Catalog. Nada de lo registrado para un Business se ve nunca desde otro.
_In the app_: Business
_Avoid_: tenant, account, store, shop, organization

**User**:
Una persona que inicia sesión en la app y trabaja en exactamente un Business.
_In the app_: User
_Avoid_: operator, admin, member, seller, customer (customers never log in)

**Invitation**:
Un link que deja entrar a una persona, una sola vez, en un plazo de siete días: o bien para abrir un Business propio nuevo, o bien para sumarse al Business que lo emitió.
_In the app_: Invitation
_Avoid_: signup link, referral, code

## Catalog y precios

**Variety**:
Una cepa que un Business vende por gramo, identificada por su nombre dentro de ese Business. Su Stock, sus Stock entries, sus precios, su aviso de Stock bajo y sus Catalog attributes están todos en su propia página, en la pestaña Varieties. Una Variety sin historial se puede eliminar; una con historial se puede archivar y restaurar. _In the app_: Variety; la pestaña es Varieties.
_Avoid_: product, strain, item, SKU
_In the app_: Variety

**Product**:
El nombre de lo que vende un Business, en el código y en la API (`/api/products`, `product_id`), cualquiera sea la palabra que el Business use en pantalla. Variety sigue siendo la palabra de pantalla de los Businesses existentes, y los paths del front `/varieties/*` no cambian. Las columnas que referencian a la Variety siguen siendo `variety_id` hasta #75. El dominio y los puertos de los hexágonos que no son el de Products conservan nombres con variety hasta sus propias partes (ADR-0061). Decidido en docs/adr/0061-columns-keep-variety-id-until-75-while-code-and-the-api-say-product.md. Ver Variety.
_Avoid_: item, SKU, article

**Price entry**:
El List price de una Variety, y opcionalmente un Bulk price con su Bulk minimum, y opcionalmente un VIP price, que rige desde una fecha en adelante. Nunca se edita una vez que se registra: una Price entry posterior la reemplaza desde su propia fecha. Una Price entry equivocada se elimina, nunca se reescribe; una Sale no se ve afectada porque cada Sale line registra el precio al que se vendió. Una regla desactivada al momento de registrar no guarda nada para esa regla. Planned in GH-318 (not yet in the code): lo que cambia junto a esta Price entry se cuenta en el bloque de cierre de abajo. _In the app_: Price (price history).
_Avoid_: price change, price update, tariff
_In the app_: Price (price history)

**Current price**:
Para una Variety en una fecha dada, la Price entry con la fecha de vigencia más reciente en esa fecha o antes. Una Variety sin una Price entry así no tiene precio ese día.
_In the app_: Current price
_Avoid_: today's price, active price

**List price**:
El precio por gramo de una Variety cuando no se aplica ninguna otra regla.
_In the app_: Price per gram
_Avoid_: base price, regular price

**Bulk price**:
Un precio por gramo más bajo que se aplica desde el Bulk minimum en adelante. Opcional: una Price entry tiene tanto Bulk price como Bulk minimum, o ninguno de los dos. Solo en un Business con la opción Bulk price activada. _In the app_: Bulk price.
_Avoid_: discount, wholesale price
_In the app_: Bulk price

**Bulk minimum**:
Los gramos desde los cuales se aplica el Bulk price.
_In the app_: Minimum in grams
_Avoid_: threshold, minimum order

## Customers y lo que se debe

**Customer**:
Una persona a quien un Business le vende, identificada dentro de ese Business por su propio registro. El nombre es la forma en que un User la reconoce; el Phone number, cuando hay uno, es un dato de contacto opcional y nunca se exige para registrar a alguien ni para seguir vendiéndole. La misma persona que le compra a dos Businesses es un Customer distinto en cada uno.
_Avoid_: client, buyer, contact, user
_In the app_: Customer

**Phone number**:
Dato de contacto opcional de un Customer, en formato internacional: un número argentino siempre como celular (+54 9 y 10 dígitos con código de área), uno extranjero como + y su código de país y dígitos. Un valor en blanco significa que no hay ninguno. Dos Customers de un Business nunca comparten uno cuando ambos tienen uno; cualquier cantidad de Customers puede no tener ninguno.
_Avoid_: contact, handle, username, identifier
_In the app_: Phone

**VIP customer**:
Un Customer que paga el VIP price de una Variety cuando lo tiene y es menor que lo que da cualquier otra regla. Solo en un Business con la opción VIP customers activada; mientras está desactivada, la marca sigue guardada pero ni se muestra ni se aplica. _In the app_: VIP customer.
_Avoid_: friend, Amigo, preferred customer
_In the app_: VIP customer

**Sale**:
Todo lo que un Customer se lleva de una vez: una fecha, como máximo un Customer, el Shipping charged, una Note opcional y una o más Sale lines. Una Sale cuenta en su propia fecha, esté paga o no. Su Customer puede omitirse solo cuando no queda nada adeudado.
_In the app_: Sale
_Avoid_: order, transaction, purchase (that is flower coming in)

**Sale without a customer**:
Una Sale pagada por completo en el acto a alguien que no está registrado como Customer, muchas veces una persona que quizá nunca vuelva a comprar. Cuenta en todos los totales y en el historial de ningún Customer. Se le puede asignar un Customer más adelante, una sola vez; nunca pasa de un Customer a otro.
_In the app_: No customer
_Avoid_: anonymous sale, walk-in, guest, consumidor final

**Sale line**:
Una Variety y sus gramos dentro de una Sale, con el precio por gramo al que se vendió. El Bulk minimum se mide por Sale line, nunca en el conjunto de la Sale.
_In the app_: Line
_Avoid_: item, row, product

**Gift**:
Gramos entregados gratis dentro de una Sale: se cobra $0 y igual se descuentan del Stock. Los gramos que se reparten para promocionar el Business son una Promotion, nunca un Gift. _In the app_: Gift.
_Avoid_: sample, freebie
_In the app_: Gift

**Special price**:
Un total en pesos enteros mayor que $0, tipeado a mano para una Sale line, que reemplaza al calculado. Una Sale line gratis es un Gift, nunca un Special price de $0.
_In the app_: Special price
_Avoid_: override, custom price, discount

**Pricing rule**:
Qué regla fijó el precio de una Sale line: list, bulk, VIP, gift o Special price. Exactamente una por Sale line, guardada con su precio cuando se registra la Sale y nunca se vuelve a calcular. VIP significa que se cobró el VIP price, incluso cuando era igual al Bulk price. _In the app_: list, bulk, VIP, gift, special.
_Avoid_: type, price type, Amigo
_In the app_: list, bulk, VIP, gift, special

**Shipping charged**:
Lo que el Customer paga por el envío, sumado a lo que compró.
_In the app_: Shipping charged
_Avoid_: delivery fee, shipping cost (that is an expense)

**Note**:
Texto libre en una Sale para recordar lo que el resto no dice, como quién compró cuando no hay Customer.
_In the app_: Note
_Avoid_: comment, description, memo

**Payment**:
El dinero que un Customer entrega en una fecha, en efectivo o por transferencia, sin Note. Puede ser un On-the-spot payment registrado con su Sale, o un Payment posterior registrado mediante Record payment, que se abre con "Collect" en una fila de deudor de Customers o Home o desde la ficha del Customer. Su fecha, monto y método nunca cambian; se elimina y se vuelve a registrar, nunca se edita. _In the app_: Payment.
_Avoid_: collection, settlement, receipt, abono
_In the app_: Payment

**Balance**:
Lo que debe un Customer: lo que compró y no pagó, menos sus Payments; se calcula en el momento. Un Payment posterior siempre salda primero la deuda más antigua. Menor que cero es un Credit. _In the app_: Owes you.
_Avoid_: debt account, tab, cuenta corriente
_In the app_: Account / Owes

**Owing since**:
La fecha de la Sale más antigua de un Customer que no está pagada por completo.
_In the app_: Since
_Avoid_: overdue date, due date

## Stock

**Stock entry**:
Gramos de una Variety que entran en una fecha, con un único origen: Purchase, Harvest, Opening stock o Adjustment. Una Purchase lleva su costo total; un Adjustment puede ser negativo. A diferencia de una Price entry, cualquier Stock entry se puede editar o eliminar en cualquier momento, sin importar lo que ya haya alimentado: su fecha, gramos, costo u origen (ADR-0009).
_In the app_: Entry
_Avoid_: restock, delivery, intake

**Purchase**:
Una Stock entry que el Business pagó. Su costo es dinero que sale en su fecha.
_In the app_: Purchase
_Avoid_: order, buy

**Lot**:
Los gramos de una Stock entry junto con su costo por gramo. Los gramos vendidos, regalados o retirados salen primero del Lot más antiguo de su Variety, el más antiguo por fecha; una Stock entry o un Stock withdrawal registrados tarde o corregidos ocupan su lugar por fecha, y los Lots posteriores se vuelven a calcular (ADR-0009). _In the app_: Lot.
_Avoid_: batch
_In the app_: Lot

**Stock**:
Los gramos en existencia de una Variety: todo lo que entró menos todo lo que se vendió, regaló o retiró. Puede quedar negativo, y la cifra igual se muestra, nunca se oculta. _In the app_: Stock, que se muestra en Varieties y en la página de una Variety.
_Avoid_: inventory, balance
_In the app_: Stock

**Pending cost**:
Lo que cuestan los gramos vendidos, regalados o retirados más allá de todo lo registrado como ingresado: todavía no se conoce, y nunca se muestra como $0. Una Stock entry posterior de esa Variety, caiga donde caiga su fecha en el Lot order, lo salda (ADR-0009). _In the app_: Pending cost.
_Avoid_: unknown cost, zero cost
_In the app_: Pending cost

**Draw**:
Gramos que salen de una Variety, tomándolos de sus Lots primero el más antiguo: una Sale line (los Gifts incluidos), un Adjustment negativo o una línea de un Stock withdrawal. Tiene una parte con costo y, más allá de todo Lot, gramos pendientes. En la app no tiene palabra propia.
_Avoid_: outflow, consumption, movement, out
_In the app_: no word of its own; on screen it is the line's "Cost of goods sold".

**Lot order**:
El orden único en que se toman los Lots y los Draws de una Variety: por fecha, y después por orden de registro.
_In the app_: no word of its own.
_Avoid_: chain, chain position, FIFO order

**Low-stock threshold**:
Gramos opcionales por debajo de los cuales el Stock de una Variety cuenta como bajo.
_In the app_: Warn below
_Avoid_: reorder point, alert level

## Resultados

**Cost of goods sold**:
Lo que costaron los gramos vendidos o regalados en un período, tomados de los Lots de los que salieron tal como están hoy, primero el más antiguo; se vuelve a calcular cada vez que cambia una Stock entry anterior, por lejos que quede en el pasado (ADR-0009). Una parte puede ser Pending cost.
_In the app_: Cost of goods sold
_Avoid_: COGS, average cost, cost per gram

**Expense**:
Dinero que sale por algo que no es flor, archivado bajo una Expense category. La flor que se compra es una Purchase, nunca una Expense.
_In the app_: Expense
_Avoid_: cost, outflow, bill

**Expense category**:
El rubro propio de un Business para sus Expenses, con un nombre único dentro de ese Business sin importar mayúsculas, minúsculas ni espacios. Un Business nuevo arranca con cuatro valores por defecto en su Stored language al abrirse (en inglés "Growing supplies", "Packaging", "Shipping and transport" y "Other"), que un cambio de idioma nunca renombra; los Businesses anteriores conservan los valores que recibieron, los de español incluidos. Una Expense category no se puede eliminar mientras tenga Expenses.
_Avoid_: type, tag, label, account, cost center
_In the app_: Category

**Profit**:
Las Sales (con el envío incluido, estén pagas o no) menos el Cost of goods sold, el Stock shortfall, el costo de Promotion, el costo de Own use y las Expenses, en un período, cada uno contado en su propia fecha; las Purchases nunca entran. Cuando algún costo está pendiente, se calcula sobre la parte con costo y se marca con "and N g without cost", donde N suma los gramos pendientes vendidos, regalados, sacados por Adjustments negativos y retirados en el período. Puede ser negativo y entonces se muestra con signo menos; en la app: Profit.
_Avoid_: margin, earnings, net
_In the app_: Profit

**Cash**:
Los Payments recibidos menos las Expenses menos las Purchases, en un período: el dinero que realmente se movió.
_In the app_: Cash
_Avoid_: cash flow, balance, profit

## Telegram

**Catalog**:
El texto que ofrece cada Variety sin archivar y visible, con Stock mayor que cero y un Current price hoy: su emoji, nombre, Indica share, Aroma y precios, entre las dos partes del Catalog header and footer del Business. Conserva sus marcadores **bold** y su propio formato de dinero ($11.000). _In the app_: Catalog.
_Avoid_: menu, price list, flyer
_In the app_: Catalog

**Pinned catalog**:
El mensaje del Catalog fijado en el chat del canal de Telegram del Business por su propio bot, editado en el lugar cada vez que cambia el texto del Catalog y nunca enviado de nuevo en ese chat. Cuando nada califica, muestra la línea vacía ("Nothing to offer for now." en inglés) entre las dos partes del Catalog header and footer; sus líneas fijas siguen el Shown language del Business.
_Avoid_: post, broadcast
_In the app_: Pinned message

**Test send**:
El Catalog enviado solo al chat de Telegram propio del User, con los Bot settings tipeados en la pantalla. Se guardan solo si el envío tiene éxito. Hace falta un Test send exitoso desde el último cambio de los Bot settings antes de Publish. _In the app_: Test it.
_Avoid_: preview, draft
_In the app_: Test it

**Upkeep**:
La edición automática del Pinned catalog después de un cambio que puede afectar su texto (un cambio de Business time zone incluido), o al comenzar un nuevo día en la Business time zone del Business. Solo edita: nunca envía ni fija. _In the app_: no tiene palabra propia.
_Avoid_: sync, auto-publish, refresh
_In the app_: no word of its own

**Last published text**:
El texto fuente (marcadores incluidos) enviado por última vez al Pinned catalog del bot y del chat del canal actuales. _In the app_: no tiene palabra propia.
_Avoid_: cache, last snapshot
_In the app_: no word of its own

## Lenguaje

**Stock status**:
Cómo está una Variety en cuanto a Stock, el primero que corresponda: sin movimientos (no se movió nada: ninguna Stock entry, ninguna Sale ni Gift, ningún Stock withdrawal), agotado (Stock en cero o menos), bajo (mayor que cero y por debajo de su Low-stock threshold), ok. Se distingue por forma y palabra, nunca solo por color. _In the app_: no entries, sold out, low, ok.
_Avoid_: stock level, alert, availability

**Days left**:
El Stock de una Variety dividido por el promedio diario de gramos vendidos, regalados o retirados en los últimos 30 días, redondeado hacia abajo a días enteros. No se muestra cuando el Stock está en cero o menos o cuando no salió nada en esos 30 días. _In the app_: At the pace of the last 30 days.
_Avoid_: runway, coverage, forecast

**Opening stock**:
Una Stock entry que registra los gramos que ya había cuando un Business empieza a llevar Stock. Es un origen común, sin límite por Variety, y su Lot cuesta $0 salvo que se registre un costo. _In the app_: Initial stock.
_Avoid_: initial balance, baseline, starting inventory

**Harvest**:
Una Stock entry de gramos que el Business cultivó. Su Lot cuesta $0 salvo que se registre un costo; los insumos de cultivo son Expenses y nunca se reparten entre las Harvests. _In the app_: Harvest.
_Avoid_: crop, yield, production

**Adjustment**:
Una Stock entry que registra la diferencia entre un conteo físico y el Stock que muestra la app, en más o en menos. Un Adjustment negativo no tiene costo y saca sus gramos de los Lots más antiguos, igual que los gramos que salen. _In the app_: Adjustment.
_Avoid_: correction, recount, shrinkage, write-off

**Catalog attributes**:
Lo que una Variety muestra en el Catalog: si se muestra, su emoji, su Indica share y su Aroma. Nunca afectan los precios, el Stock ni las Sales, y se editan solo en la página propia de la Variety. _In the app_: In the catalog.
_Avoid_: catalog settings, metadata, tags

**Hidden variety**:
Una Variety que el vendedor eligió dejar fuera del Catalog, sin importar su precio o su Stock. Oculta significa solo eso: una Hidden variety sigue figurando en Varieties y en todos los selectores. Una Variety que queda afuera por falta de precio o de Stock no está oculta, y una Archived variety es otra cosa que conserva su marca de Hidden variety. _In the app_: Hidden.
_Avoid_: inactive, disabled, archived (that is an archived variety)

**Indica share**:
El porcentaje de indica de una Variety, un número entero de 0 a 100; el resto es sativa. Opcional; si no se conoce, el Catalog deja afuera su línea. _In the app_: % indica.
_Avoid_: genetics, ratio, type

**Aroma**:
Una línea de texto libre que describe el aroma y el sabor de una Variety para el Catalog, de hasta 200 caracteres. _In the app_: Aroma/flavor.
_Avoid_: description, notes, flavor profile

**Catalog header and footer**:
El texto propio de un Business que abre y cierra el Catalog, de varias líneas y de hasta 500 caracteres cada uno; uno en blanco se deja afuera. Un Business nuevo arranca con los valores por defecto en su Stored language al abrirse (en inglés "🌿 **CATALOG** 🌿" y "📩 Questions and orders by private message."); desde entonces son datos propios, que se editan solo en Settings, y un cambio de idioma nunca los reescribe. Los Businesses anteriores conservan lo que guardaron.
_Avoid_: title, signature, intro, outro

**On-the-spot payment**:
El Payment registrado junto con una Sale pagada por completo en efectivo o por transferencia. Salda solo esa Sale, nunca una deuda más antigua, y se elimina solo junto con su Sale. _In the app_: Paid in cash / Paid by transfer.
_Avoid_: cash sale, immediate payment

**Settlement**:
Qué Sales cubre un Payment posterior: primero la deuda más antigua del Customer (las Sales por fecha y después por orden de registro; los Payments por fecha y después por orden de registro), sin importar la fecha del propio Payment. Se calcula en el momento a partir de las Sales y los Payments tal como están ahora, y nunca se guarda. _In the app_: On account of the sale of dd/mm.
_Avoid_: allocation, application, imputación

**Credit**:
Un Balance menor que cero, que queda solo cuando se elimina una Sale que unos Payments habían saldado; registrar nunca crea uno. Se aplica automáticamente a las próximas Sales del Customer que queden con deuda y no cuenta en ninguna cifra de deuda. _In the app_: In your favor.
_Avoid_: refund, saldo a favor, overpayment

**Sales still owing**:
Toda Sale de un Business que no está pagada por completo una vez que se aplica el Settlement, las pagadas en parte incluidas, cada una contada una sola vez. _In the app_: owes you (en Sales) y la línea del conteo de la sección "Owed to you" de Customers y del bloque "Owed to you" de Home.
_Avoid_: unpaid orders, pending sales, open invoices

**Total owed**:
La suma del Balance de cada Customer mayor que $0 en un Business; los Credits nunca la restan. _In the app_: el título de la sección "Owed to you" de Customers y del bloque "Owed to you" de Home.
_Avoid_: receivables, outstanding

**Margin**:
Las Sales de gramos con costo de una Variety en un período menos lo que costaron esos gramos, en pesos; los Gifts suman su costo y $0 de Sales, así que puede ser negativo. Las Sales de gramos con costo son, por línea, el total de la línea × gramos con costo ÷ gramos de la línea, redondeando la mitad hacia arriba; los gramos pendientes se dejan afuera y se marcan con "and N g without cost". _In the app_: Margin.
_Avoid_: profit, earnings, markup, ganancia

**Margin percentage**:
El Margin de una Variety sobre sus Sales de gramos con costo en el período. No hay ninguno cuando esas Sales son $0, como en una Variety solo regalada o con todos los gramos pendientes. _In the app_: Margin %.
_Avoid_: markup, rentabilidad, return

**Average margin**:
El Margin total de un mes en todas sus Varieties sobre las Sales de gramos con costo del mes, marcado cuando alguna Variety tiene gramos pendientes. _In the app_: Average margin.
_Avoid_: average profit, mean margin

**First record**:
El registro más antiguo de un Business en la app: una Sale, una Stock entry, un Stock withdrawal, un Payment o una Expense. El historial de Analysis y sus totales desde el inicio empiezan ahí, así que el costo de ningún Stock withdrawal queda afuera de ellos. _In the app_: Since the first record.
_Avoid_: start date, opening date, inception

**Best week**:
De las últimas 8 semanas de lunes a domingo, la que tiene el total de Sales más alto, con el envío incluido; en un empate gana la más reciente, y no se marca ninguna cuando todas son $0. _In the app_: Best week.
_Avoid_: top week, record week

**Best weekday**:
Desde el First record, el día de la semana con el total de Sales más alto; en un empate gana el día que viene antes de lunes a domingo, y no se marca ninguno cuando todos son $0. _In the app_: Best day.
_Avoid_: peak day, top day

**Stock shortfall**:
Lo que costaron los gramos sacados por Adjustments negativos en un período, en la fecha del Adjustment, tomados de sus Lots tal como están hoy, primero el más antiguo; una parte más allá de todo Lot queda pendiente, nunca en $0. Baja el Profit. _In the app_: Stock shortfall.
_Avoid_: shrinkage, write-off, loss, merma

**Stock withdrawal**:
Un registro con fecha de gramos de una o más Varieties sacados del Stock por un solo motivo, Promotion u Own use, con una nota opcional. No se mueve dinero y el Cash no se toca. Sus gramos se costean en su fecha a partir de los Lots, primero el más antiguo, y una parte más allá de todo Lot es Pending cost, nunca $0. El costo se muestra como una línea propia por motivo y baja el Profit; nunca entra en el Margin de una Variety ni en el Cost of goods sold. Se puede editar o eliminar en cualquier momento. _In the app_: Withdrawal, registrado con la acción "Take from stock"; los motivos se leen Promotion y Own use.
_Avoid_: gift (a gift is a sale line at $0 price), shrinkage, write-off

**Publish**:
Enviar y fijar el Catalog en el chat del canal del Business, o editar ahí el Pinned catalog que ya existe. Siempre envía, incluso cuando el texto no cambió. _In the app_: Publish.
_Avoid_: broadcast, push, sync

**Bot settings**:
El único token de bot de Telegram de un Business, guardado cifrado y que nunca se vuelve a mostrar una vez que se guarda, más el chat de su canal y el chat propio del User. Cambiar cualquiera de ellos exige un nuevo Test send antes de publicar. _In the app_: Integrations, en Settings.
_Avoid_: integration, connection, config

**Out of date**:
El estado del Pinned catalog cuando los Customers no están viendo el Catalog de hoy: la última actualización automática falló (Telegram caído, el bot no puede enviar, mensaje eliminado, texto demasiado largo), o se probó un token o un canal nuevo pero todavía no se envió. Muestra un solo motivo fijo y, cuando ya se envió algo al chat actual, la fecha del último envío. Su único otro estado es el de actualizado. _In the app_: Out of date / Up to date.
_Avoid_: stale, pending, out of sync, error

**Panel**:
La vista de una sola pantalla de Home sobre un Business, en su Business time zone. Today muestra lo que se vendió hoy, lo que se debe y el Stock por Variety. Week y Month suman Cost of goods sold, Stock shortfall, el costo de Promotion y de Own use, Expenses, gramos regalados, Purchases, Profit y Cash; solo lectura, cada cifra viene del servidor. _In the app_: Home (pestañas Today · Week · Month).
_Avoid_: dashboard, overview, home, summary, Analysis

**Average sale**:
El total de Sales de un período, con el envío incluido, dividido por su cantidad de Sales (no de líneas), redondeando la mitad hacia arriba al peso entero. No se muestra cuando el período no tiene Sales.
_Avoid_: average ticket, mean order, ticket promedio

**Operator**:
La persona que maneja la instalación desde afuera de la app. Ejecuta scripts/invite-business.sh, scripts/reset-password.sh y la Business removal, hace el deploy, mantiene los backups y ejecuta el Restore drill. No es un User de ningún Business; nada de lo que hace sucede desde una Session iniciada, y nunca ve ni elige la contraseña de un User.
_Avoid_: admin, administrator, superuser, owner, PM

**Business export**:
Un archivo JSON con cada dato registrado de un Business tal como está guardado, cada registro con el nombre de aquello a lo que se refiere, sin ninguna cifra calculada, hash de contraseña, secreto ni Invitation. Se escribe solo como primer paso de la Business removal.
_Avoid_: backup, dump, archive

**Business removal**:
El comando del Operator que hace el Business export de un Business y después borra cada fila de él, los Users y las Invitations incluidos, junto con el historial de intentos de login de sus Users, en una sola transacción. No se borra nada a menos que el Business export se haya escrito, releído y sus conteos coincidan con lo que se borra.
_Avoid_: offboarding, account deletion, purge, wipe


**Login brake**:
Lo que frena el adivinado de contraseñas al iniciar sesión y en un Password change. Un email se bloquea tras 5 fallos seguidos, y una dirección de origen tras 20 logins fallidos en un plazo de 15 minutos, cada uno por 15 minutos. Cada intento rechazado cuenta para ambos, una contraseña actual incorrecta en un Password change incluida. Un login, un Password change o un reseteo exitosos reinician solo el conteo del email, y ambos bloqueos responden igual. _In the app_: el mensaje del freno bajo Sign in y en Change password.
_Avoid_: rate limit, throttle, ban, captcha

**Restore drill**:
Un script que el Operator ejecuta a mano para restaurar el backup en un destino de prueba, nunca en la app en marcha. Informa el chequeo de integridad, los conteos de filas y la hora del último cambio de la copia restaurada.
_Avoid_: backup test, recovery check, DR test

**Spreadsheet import**:
La carga única del historial de un Business desde la planilla `Control_de_ventas_y_gastos` en ese Business. La corre el Operator de la instalación el día del traspaso, y solo en un Business sin registros todavía. Nunca aparece en la app; en pantalla, los datos cargados desde la planilla son iguales a los cargados a mano.
_Avoid_: migration, sync, upload, restore

**Unfinished row**:
Una fila de Ventas, Entradas o Gastos de la planilla que el Spreadsheet import deja afuera porque la propia planilla la marca como no lista: las de Ventas por tener texto en lugar de un número en su fórmula Total, las de Entradas y Gastos por tener un Revisar que no está en blanco. Se lista en el reporte del Spreadsheet import con el texto de la propia planilla, no crea ningún Customer, ningún VIP ni ninguna grafía conservada, y nunca frena el Spreadsheet import.
_Avoid_: incomplete row, invalid row, skipped row
_In the app_: (operator terminal only; never shown on screen)

**Session**:
Un dispositivo con sesión iniciada de un User, que dura 30 días como una cookie y un token. Un Password change de ese User cierra todas sus Sessions, salvo el dispositivo que lo hizo con Change, que recibe una nueva. _In the app_: Session (Sign out).
_Avoid_: login, device, token, connection

**Password change**:
Un User que define una contraseña nueva con la actual, desde Settings → Your account. La única regla es como mínimo 10 caracteres, y se acepta la misma contraseña. Cierra todas las demás Sessions de ese User y retira sus Reset links sin usar, mientras que el dispositivo que hizo el cambio sigue con la sesión iniciada. _In the app_: Change password.
_Avoid_: password update, rotation, edit password

**Reset link**:
Un link que el Operator imprime con scripts/reset-password.sh y que permite a un User elegir por sí mismo una contraseña nueva, una sola vez, en un plazo de 24 horas, sin la actual. Un User tiene como máximo un link activo: un link más nuevo o cualquier Password change lo retira. Un link retirado, usado, vencido o desconocido responde el mismo 404. _In the app_: link ("This link no longer works").
_Avoid_: recovery code, reset token, magic link, forgot-password email

**Navigation**:
La estructura fija de la app para un Business: las pestañas, More, Settings, y la única regla que le da a cada pantalla su marco y su camino de vuelta. Decide desde dónde se llega a cada capacidad, nunca qué hace. En la app: no tiene palabra propia.
_Avoid_: menu, sitemap, routing, shell

**Tab root**:
Una pantalla a la que se llega directo desde la barra o la barra lateral (Home, Sales, Customers, Varieties, Expenses, Analysis, More); muestra la barra y "+ New sale". Cualquier otra pantalla es una tarjeta o un detalle (con una flecha de regreso a su pantalla madre) o un formulario o una Sheet (con "Close").
_Avoid_: home, main screen, section

**Settings**:
El único lugar que reúne cada configuración de todo el Business, en grupos: Business, Users, Prices, Integrations, Catalog message, Expense categories, Appearance y Your account. La configuración de una sola Variety vive en la Variety, nunca acá, y nada del Operator está acá. _In the app_: Settings.
_Avoid_: Ajustes (in the spreadsheet that held prices), preferences, admin, Negocio (that is one group)

**First-run checklist**:
Cuatro pasos en Home para un Business que existía antes de que saliera el Onboarding y todavía no hizo las dos cosas: ponerle precio a una Variety para hoy y registrar una Stock entry. Esos dos pasos, más publicar el Pinned catalog y sumar un segundo User, que son opcionales. Cada paso se calcula a partir de los datos del Business y dice "Done" cuando se cumple; la First-run checklist desaparece para siempre la primera vez que se cumplen los dos pasos obligatorios y nunca vuelve. Un Business recién creado recibe el Onboarding en su lugar.
_Avoid_: tour, wizard, setup guide, welcome, Onboarding (that is a brand-new business's first run)

**Onboarding**:
La configuración paso a paso por la que se guía a un Business recién creado una vez que se acepta su Invitation de Business nuevo, en lugar de la First-run checklist. Tiene dos pasos obligatorios (una Variety con precio para hoy, su Opening stock) y otros opcionales (Catalog header and footer, bot de Telegram, un socio, Expense categories), y cada uno guarda lo que guardan Settings o la página de la Variety. Retoma donde quedó, termina para siempre una vez que se llega a su pantalla de cierre "Done" o un Spreadsheet import carga el Business, y nunca se ofrece en el Business de un User que se sumó ni en uno que existía antes de que saliera.
_Avoid_: tour, wizard, welcome screen, setup guide

**Theme choice**:
La elección de Automatic, Light o Dark de un dispositivo. Se hace solo en Settings → Appearance, se aplica de inmediato y se conserva solo en ese dispositivo. No está atada a un User ni a un Business, sobrevive al cierre de sesión y no guarda nada más. Sin ninguna guardada, la app sigue al teléfono en vivo; una elección guardada es solo de ese dispositivo y gana sobre el teléfono. _In the app_: Theme (Automatic · Light · Dark).
_Avoid_: preference, dark mode setting, skin, user setting, system theme

**Own chat lookup**:
Buscar el número del chat propio del vendedor entre los chats privados que le escribieron al bot del Business, con el token que usaría Test it. Completa el campo del chat propio solo cuando escribió exactamente una persona en privado, muestra solo el número y no guarda nada; los Bot settings se siguen guardando solo con un Test send exitoso. _In the app_: Find my chat.
_Avoid_: auto-detect, discovery, getUpdates, chat search, sync

**VIP price**:
Un precio por gramo opcional en una Price entry, para los VIP customers: un peso entero mayor que $0 y menor que el List price de esa Price entry, independiente del Bulk price. Nunca se muestra en el Catalog. Planned in GH-318 (not yet in the code): lo que cambia junto a esta Price entry se cuenta en el bloque de cierre de abajo. _In the app_: VIP price.
_Avoid_: friend price, discount, Amigo price

**Pricing settings**:
Cuáles de Bulk price y VIP customers usa un Business: dos interruptores independientes. Una regla desactivada queda oculta y deja de aplicarse a las Sales nuevas, mientras que todo lo guardado para ella se conserva. _In the app_: Prices, en Settings.
_Avoid_: price config, pricing mode, plan, tariff settings

**Archived variety**:
Una Variety que el vendedor sacó de toda lista y selector (Varieties, What you have left, New sale, los formularios de Stock entry y de Price entry, el Catalog y el Pinned catalog), mientras que todo registro pasado conserva su nombre y sus cifras tal cual. Archive es la acción que se ofrece para una Variety con historial, pero una Archived variety puede no tener ninguno. Conserva reservado su nombre y su marca de Hidden variety, se ve y se restaura solo desde Archived, tiene una página de solo lectura y al restaurarla vuelve exactamente como estaba. En la app: Archived.
_Avoid_: deleted, hidden, inactive, disabled

**Variety history**:
Cualquier Sale line de una Variety (los Gifts y los Special prices incluidos) o cualquier Stock entry de ella (de cualquier origen, un Adjustment de cualquiera de los dos signos incluido), o cualquier línea de Stock withdrawal de ella; se calcula en el momento y nunca se guarda. Una Variety con historial solo se puede archivar. Una Variety sin historial se puede eliminar para siempre, y sus Price entries, su Low-stock threshold y sus Catalog attributes se van con ella.
_Avoid_: usage, activity, movements, references

**Promotion**:
Una Stock withdrawal para dar a conocer el Business, p. ej. gramos compartidos en una fiesta para que los prueben varias personas. Su costo es lo que costaron los gramos sacados de sus Lots tal como están hoy, y se muestra como una línea propia que baja el Profit. _In the app_: Promotion.
_Avoid_: gift (a gift is a sale line, to someone, inside a sale), sample, freebie, promo

**Own use**:
Una Stock withdrawal que el vendedor consume él mismo. Su costo es lo que costaron los gramos sacados de sus Lots tal como están hoy, y se muestra como una línea propia que baja el Profit. _In the app_: Own use.
_Avoid_: personal, shrinkage

**More info**:
El porqué o el cómo más largo detrás de una línea acortada, a un toque en una "i" al final de esa línea, que se expande en el lugar y se colapsa con un segundo toque; siempre se abre cerrada y nunca se recuerda. Nunca es una consecuencia, la solución de un rechazo ni un estado. _In the app_: More info (su nombre accesible, con aria-expanded).
_Avoid_: tooltip, popover, help modal, info sheet, details

**Icon and text rule**:
La única regla escrita sobre cómo cada pantalla rotula sus opciones, acciones y avisos. Decide cómo se rotula cada cosa, nunca qué hace. Su texto completo vive en `docs/product/icon-and-text-rule.md`. En la app: no tiene palabra propia.
_Avoid_: style guide, UI guidelines, icon policy

**Attention icon**:
El único ícono, el mismo en todas partes, puesto junto a la oración de un aviso o estado que le pide al vendedor que actúe o dice que algo falló. Su regla completa vive en `docs/product/icon-and-text-rule.md`. En la app: no tiene palabra propia.
_Avoid_: warning icon, alert icon, badge, error icon

**Gate**:
Los controles que todo cambio debe pasar antes de integrarse: pytest, vitest y e2e, corridos como jobs del CI de GitHub; `agentic merge` rechaza un head salvo que cada job listado en `ci:` esté en verde, e2e incluido. En un pull request cada suite corre solo cuando el cambio la afecta, y una suite omitida por no afectada cuenta como pasada; todo push a master las corre todas. Un Gate en rojo debe significar una regresión del producto, nunca que el calendario pasó un vencimiento o un límite de día; un flake es un defecto del Gate con su propio issue, nunca ruido. En la app: no tiene palabra propia.
_Avoid_: pipeline, build, test run

**Tappable notice**:
Un aviso que el vendedor toca para abrir aquello a lo que apunta, como el "Go on to the setup" de Home. Su oración lleva el significado y es su nombre accesible. Su regla completa vive en `docs/product/icon-and-text-rule.md`.
_Avoid_: banner, card button, row, callout, alert

**Design capture**:
La captura lado a lado del archivo de diseño de una pantalla y la app construida, adjunta a un PR como evidencia de revisión y juzgada a ojo contra el Drawing as guide. Nunca es un paso del Gate. Su regla completa vive en `docs/product/design-capture.md`.
_Avoid_: screenshot test, visual regression test, snapshot, gate step

**Product language**:
El idioma en que el producto escribe lo que una persona lee. El inglés es el texto fuente y, hasta que salga un segundo idioma (#317), el único Selectable language. Abarca pantallas, nombres accesibles, mensajes de la API, la salida de los scripts del Operator y las líneas fijas del Catalog, nunca los datos propios del vendedor. El `detail` de un rechazo de la API es un diagnóstico en inglés, nunca se muestra. Los formatos numéricos y de fecha siguen siendo argentinos.
_Avoid_: locale, i18n, translation, Rioplatense

**Language**:
Un idioma para el que el Copy module tiene textos, identificado por su etiqueta. En la app: no tiene palabra propia.
_Avoid_: locale, translation

**Selectable language**:
Un idioma al que se puede configurar un Business: todo idioma con textos completos (cada mensaje en inglés tiene una traducción no vacía) salvo el Test locale. Solo inglés hasta #317. En la app: no tiene palabra propia.
_Avoid_: supported language, available locale

**Shown language**:
El idioma en que se muestran los textos de un Business: su Stored language, salvo que la Forced language lo reemplace. Hasta #317 todo Business está en inglés. En la app: no tiene palabra propia.
_Avoid_: display locale, UI language

**Test locale**:
`en-XA`, generado a partir del inglés y usado solo para juzgar la disposición de los elementos en pantalla, nunca los límites de caracteres. Nunca es seleccionable ni lo elige un pedido. En la app: no tiene palabra propia.
_Avoid_: pseudo-language, fake language

**Forced language**:
El Test locale, activado para toda la instalación por el Operator mediante `APOSTROPHE_FORCED_LANGUAGE`. Reemplaza al Shown language y al Pre-sign-in language, nunca a la salida del Operator ni a un Stored language. En la app: no tiene palabra propia.
_Avoid_: override mode, debug language

**Pre-sign-in language**:
El idioma de la página antes de iniciar sesión, calculado a partir del `Accept-Language` del teléfono y de los Selectable languages solamente, inglés cuando nada coincide. Ningún Business, User, Invitation ni link puede influir en él, así que la página no revela nada sobre ninguno de ellos. En la app: no tiene palabra propia.
_Avoid_: browser language, default language

**Copy module**:
El único lugar con claves que guarda cada texto que muestra la interfaz, nombres accesibles incluidos. Ninguna pantalla guarda un texto propio, así que un cambio de redacción o un idioma agregado es un cambio solo ahí.
_Avoid_: messages file, strings, translations, dictionary

**Mobile check**:
El control del Gate que recorre las filas de teléfono del registro de pantallas y falla ante cualquier infracción del estándar móvil que las listas de infractores no nombren. El estándar móvil vive en CODING_STANDARDS.md §10 "Phone", y DESIGN_STANDARDS.md remite a él. El control, sus listas y las condiciones para que crezcan están en docs/product/mobile-check.md y docs/product/gate.md.
_Avoid_: mobile test, phone audit, lint, allowlist

**Drawing as guide**:
Una diferencia con el dibujo es un hallazgo solo cuando el dueño, en el teléfono, leería o haría algo distinto. La definición escrita del producto y los ADRs ganan sobre el dibujo. En la app: no tiene palabra propia; la regla vive en DESIGN_STANDARDS.md.
_Avoid_: exact spec, pixel-perfect, design fidelity, mockup diff

**Phone first**:
Cuando hay que elegir, sale primero el flujo que funciona en el teléfono. El pulido es una tarea posterior que el dueño o PM elige programar. La computadora conserva todas las capacidades pero no recibe pulido dedicado. En la app: no tiene palabra propia; la regla vive en DESIGN_STANDARDS.md.
_Avoid_: mobile-only, responsive, mobile first, polish pass

**Stored language**:
El único idioma registrado en un Business. Un Business nuevo lo toma del teléfono que acepta cuando se acepta su Invitation, un Business existente tiene inglés, y después solo lo cambia la elección de un User en Settings → Business. Es lo que muestra y edita el control de idioma, y es el Shown language salvo que la Forced language del Operator lo reemplace. En la app: no tiene palabra propia.
_Avoid_: locale, display language, preferred language, business locale

**Sheet**:
Con un ancho menor que 900 px, cómo se dibuja un formulario: a pantalla completa, un diálogo modal con "Close" arriba y su acción principal fija abajo, dibujado por un solo componente compartido sobre la pantalla desde la que se abrió (o sobre su pantalla padre en una dirección directa). Sus únicas salidas son "Close" y el gesto de volver del teléfono, que son la misma acción; no tiene afuera, así que nada a su alrededor (ni siquiera la franja de área segura junto a la barra de estado) la cierra. En una computadora el mismo formulario conserva su propio marco. En la app: no tiene palabra propia.
_Avoid_: modal, overlay, drawer, bottom sheet, popup, capa

**Assume nothing**:
El cuarto criterio del dueño: la app nunca fija en el código la forma de trabajar de un Business (tipo de producto, Units, moneda, Payment methods, Pricing rules, canales, etcétera), y cada Business la hace funcionar a su manera mediante configuraciones con valores por defecto neutros. No hay configuraciones prearmadas por tipo de Business. Su prueba es "would this still be right for a business that sells something else, in other units, other ways?" Si no, es un hallazgo, incluso un valor por defecto que le sirve a un solo Business; se aplica al trabajo nuevo, mientras que los supuestos existentes se barren en #330 y se vuelven personalizables en #318. En la app: no tiene palabra propia; la regla vive en DESIGN_STANDARDS.md.
_Avoid_: business-neutral, white label, vertical, preset, template, multi-tenant

**Sale bill**:
Los datos de una Sale registrada que un vendedor puede compartir con el Customer de esa Sale: nombre del Business, fecha, líneas, Shipping charged, total, estado de Payment y el Balance actual del Customer. Se calculan en el momento a partir del Settlement cuando se lee el detalle de la Sale y nunca se guardan, y el Balance es la cuenta completa del Customer en el momento de compartir. En pantalla se comparte como texto plano con Share o Copy en el detalle de la Sale; En la app: Sale bill (el nombre accesible de su bloque seleccionable), la acción dice Share / Copy.
_Avoid_: invoice, receipt, statement, ticket

**Documentation language**:
El idioma en que se escribe la documentación funcional y técnica del producto, `docs/product/` y las definiciones de `CONTEXT.md` incluidas: español rioplatense, con identificadores, nombres de clases, nombres UML, términos del glosario y palabras de pantalla en inglés. No es el Product language, que sigue en inglés, y no cambia nada de lo que muestra la app. En la app: no tiene palabra propia.
_Avoid_: Product language, locale, idioma de la app, traducción

## Planned in GH-318 (not yet in the code)

Estos términos no forman parte del glosario actual. El código, los tests y las pantallas conservan los términos actuales hasta que se entregue la parte nombrada en cada línea; solo esa parte pasa su término al glosario propiamente dicho y corrige la definición que reemplaza. Cada línea da el término, el ADR que lo decide y la parte a cargo, nombrada por capacidad.

**Unit**:
Cómo mide un Business un Product: una etiqueta y de 0 a 2 decimales que solo validan lo que se ingresa y deciden cómo se muestra. Decidido en docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md; a cargo de la parte units.
_Avoid_: measure, UoM

**Quantity, in hundredths of a unit**:
Una cantidad guardada de cualquier Unit, siempre un número entero de centésimos. Decidido en docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md; a cargo de la parte units.
_Avoid_: amount, grams

**Business time zone**:
La zona IANA de un Business que decide cuándo empieza y termina su día: "today", las fechas por defecto, el Current price, Days left, Best week, Best weekday, el Panel, la Upkeep diaria y el Spreadsheet import la siguen. Todo Business existente y todo Business nuevo arranca con la de Argentina, y cualquier User la cambia en Settings → Business → Time zone sin que se vuelva a fechar nada registrado. _In the app_: Time zone.
_Avoid_: locale, region, offset, timezone setting

**Money scale**:
Si un Business guarda su dinero en unidades enteras de moneda (0) o en centésimos (2); los Businesses existentes quedan en 0 y los nuevos empiezan en 2. Decidido en docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md; a cargo de la parte money.
_Avoid_: precision, cents mode

**Money format**:
El símbolo de la moneda y los decimales con que un Business muestra su dinero. Decidido en docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md; a cargo de la parte money.
_Avoid_: currency settings

**Customer type**:
Un tipo de Customer definido por el vendedor, como máximo uno por Customer, que puede tener su propio precio. Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; a cargo de la parte customer types.
_Avoid_: tier, segment, group

**Customer-type price**:
El precio que paga un Customer type por un Product, una fila que rige desde una fecha. Reemplaza al VIP price en las escrituras nuevas; la Price entry conserva su VIP price tal como está, y los VIP prices guardados y las marcas VIP se quedan en su lugar, congelados con los valores que tienen. Decidido en docs/adr/0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md; a cargo de la parte customer-type prices.
_Avoid_: tier price, discount

**Payment method**:
Una forma de pagar de un Customer, definida por el vendedor. Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; a cargo de la parte payment methods.
_Avoid_: payment type, channel

**Applied promotion**:
Una Promotion tal como estaba una Sale cuando se guardó, registrada como filas tipadas que nunca se vuelven a calcular. Decidido en docs/adr/0060-the-applied-promotion-snapshot-is-typed-sale-promotion-rows-recorded-as-the-sale-stood-when-saved-and-never-recomputed.md; a cargo de la parte promotions-at-sale-time, que también define en qué se diferencia de una Promotion.
_Avoid_: discount line, coupon

**Product word**:
Cómo llama un Business a sus Products en pantalla. Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; a cargo de la parte product word.
_Avoid_: label, noun setting

## Language
