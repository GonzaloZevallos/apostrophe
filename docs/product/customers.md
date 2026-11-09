## Jobs

**Cuando** entrego un pedido o recibo un pago, **quiero** encontrar al cliente por parte de su nombre o de su número, o registrarlo en el momento si es nuevo, **para que** cada venta y cada deuda caiga en una persona real y yo sepa siempre quién me debe.

**Cuando** registro a un cliente (desde Customers, en medio de una venta o con la **Spreadsheet import** única) y no tengo su Phone number, **quiero** guardarlo igual con su nombre y agregar el número más adelante si algún día lo consigo, **para poder** registrar cada venta y cada deuda a nombre de la persona que de verdad debe, sin inventar un número ni dejar a esa persona fuera de la app.

**Cuando** tengo clientes habituales a los que trato distinto, **quiero** agruparlos en tipos a los que les pongo nombre yo y elegir el tipo de cada uno desde su ficha, **para poder** distinguirlos de un vistazo, y más adelante cobrarles según su tipo, sin depender de la memoria ni de notas. (GH-405, parte de GH-318: lo sirven los Customer types de Settings → Prices y el campo "Customer type" del formulario.)

**Cuando** configuro cómo fija sus precios mi negocio, registro el precio de un producto o entrego un pedido, **quiero** que la app use solo las **Pricing rules** que tiene mi negocio (un **Bulk price** si vendo por cantidad, y un VIP price que fijo por producto para mis VIP customers), **para poder** cobrarle a cada cliente exactamente lo que quiero sin escribir un **Special price** a mano, sin ver campos que no me aplican y sin que el precio de nadie cambie de sorpresa. (Lo sirve acá la pertenencia al VIP type, que sigue al interruptor Customer types; definido en pricing-settings.md.)

**Cuando** manejo mi negocio desde el celular, **quiero** mantener al día mis clientes desde el celular, **para poder** dejar de tenerlos en la planilla y tener datos reales cuando lleguen las ventas.

**Cuando** un cliente me paga parte o todo lo que debe, en efectivo o por transferencia, el mismo día o semanas después, **quiero** registrarlo desde el celular en pocos toques y ver que su Balance y su "owing since" bajan en el acto, **para** saber siempre quién me debe qué y desde cuándo, y que nada de lo que pagó o todavía debe se pierda ni caiga en la persona equivocada. (Lo sirve acá la sección "Owed to you" de Customers y su "Collect", y el Balance, la cuenta y Record payment de la ficha; definido en `payments.md`.)

**Cuando** manejo mi negocio desde el celular entre pedidos o en medio del chat con un cliente, varias veces por día, **quiero** que la app esté armada según lo que hago de verdad y con qué frecuencia, **para poder** volver con el cliente en lugar de buscar entre menús. (El job de **Navigation**, navigation.md: lo sirve acá Customers, que se abre en quién debe, con "Collect" en cada fila de deudor.)

**Cuando** un cliente me paga parte o todo lo que debe, o entre pedidos quiero saber quién todavía me debe y desde cuándo, **quiero** que Customers se abra en quién me debe (el total, y cada deudor con la deuda más vieja primero, con su Balance y desde cuándo) y cobrarle a cualquiera en un toque, **para poder** mantener cada Balance al día y perseguir primero las deudas más viejas, sin abrir fichas una por una, hacer cuentas ni completar campos que nunca uso.

**Cuando** registro una Expense o guardo un Customer desde el celular, **quiero** elegir su Expense category o su Customer type igual que elijo un Product o un Withdrawal reason (un campo con etiqueta que abre su propia lista, con búsqueda cuando la lista es larga), **para** terminar el formulario en pocos toques y que volver nunca tire lo que ya tipeé. (Parte 6 de GH-581, compartido con expenses.md y selector.md: acá lo sirve el campo "Customer type" del formulario del Customer.)

# Clientes

Las personas a quienes un **Business** le vende, cada una identificada dentro de ese Business por su propio registro, y vistas solo por ese Business (ADR-0004). El nombre es la forma en que un **User** reconoce a un **Customer**; el **Phone number** es un dato de contacto opcional.

Las **Sales** y los **Payments** se apoyan en esta capacidad: toda Sale y toda deuda pertenece a un Customer de acá. Cada Customer puede estar en un **Customer type** que define el vendedor, o en ninguno. Un **VIP customer** es un Customer del **VIP type** y paga el **VIP price** de un **Product** cuando lo tiene y es menor que lo que da cualquier otra regla. Esto vale solo en un Business con el interruptor Customer types activado (pricing-settings.md, sales.md).

El **Balance**, el **Owing since** y la cuenta de un Customer se definen en `payments.md` y se muestran en su ficha y en la sección "Owed to you" de Customers.

Corregir los datos de un cliente sirve a los mismos jobs. En un negocio con el interruptor Customer types activado, a un cliente del VIP type se le cobra su VIP price en cada venta en la que es el más bajo, así que el vendedor nunca tiene que acordarse de quién es amigo.

La sección "Owed to you" afina el job de pagos y el job de Navigation de arriba para Customers (GH-46); no es un job nuevo. Su protagonista es el vendedor, en el celular; la computadora, con dos paneles, es el mismo job en una pantalla más grande. Tiene dos momentos: cobrar (el principal: un cliente entrega plata, en medio del chat o al entregar) y revisar (entre pedidos o al final del día). Antes, quién debía vivía en una pantalla Owed to you aparte, cobrar una deuda llevaba cuatro toques desde Customers, y el formulario del cliente pedía un canal (Telegram o WhatsApp) que nada del producto usaba.

El job de los Customer types tiene dos momentos: una configuración puntual (el vendedor decide que algunos habituales forman un grupo propio y lo nombra en Settings → Prices → Customer types) y el uso diario (al dar de alta o editar un Customer, dice en qué grupo está). Antes, la única forma de agrupar era la marca VIP de sí o no, y cualquier otro grupo ("mayorista", "amigo") vivía en la cabeza del vendedor o en la Note de una Sale.

El campo "Customer type" se elige con el Selector desde la parte 6 de GH-581 (selector.md), igual que cualquier otro Growable set. Antes era un select nativo que no se comportaba como el resto: sin búsqueda, sin fila para borrar y sin que volver en el celular actuara sobre la lista.

Criterios de éxito:

1. Desde el celular, un vendedor encuentra a un Customer existente por parte del nombre o parte del número, o registra uno nuevo con o sin número, con la rapidez suficiente para que una Sale con un Customer nuevo siga llevando menos de un minuto.
2. Un Phone number es como máximo de un Customer en un Business, sin importar cómo se escriba. Registrarlo de nuevo, o cambiar el número de un Customer por uno que ya está en uso, se rechaza. El rechazo dice que el número ya pertenece a un Customer y nunca repite el número ni el nombre. Dos Customers sin número nunca chocan.
3. Los Customers de un Business son visibles solo para ese Business. Por id desde otro Business responden 404. Las listas y búsquedas desde otro Business no muestran ninguno. El mismo número puede ser un Customer en dos Businesses sin que ninguno de los dos lo sepa.
4. Todo lo de acá se hace desde el celular, sin ninguna llamada a la API a mano.
5. **Un Customer sin número es un Customer normal, no uno degradado.**
   - Se lo puede registrar, editar, encontrar por nombre, elegir para una Sale, dejar debiendo, saldar y listar en la sección "Owed to you" de Customers como a cualquier otro.
   - La ficha y la lista no muestran ninguna etiqueta vacía, ningún guion ni ningún "No phone" donde iría un número.
6. **Nada retrocede para los Customers que tienen número.**
   - La normalización, el rechazo del número mal formado, la unicidad (al registrar y al editar), la búsqueda por número y los rechazos que nunca repiten el número ni el nombre siguen todos como están.
   - Se puede quitar el número de un Customer, y sus Sales, Payments y Balance se quedan con él.
7. **Sin canal.** Un Customer no tiene canal (Telegram o WhatsApp): ni en la API, ni en los formularios, ni en la ficha, ni en la lista, ni en el **Business export**, ni en la base de datos. Quitarlo no cambia nada más de ningún Customer.
8. **El tipo sigue al interruptor y nunca se pierde.**
   - Mientras Customer types está apagado, ningún tipo, campo de tipo ni marca VIP se muestra en ninguna pantalla de Customer.
   - Al encenderlo de nuevo, toda pertenencia guardada vuelve como estaba, incluso para los Customers editados mientras estuvo apagado.
9. **Cobrar rápido.** Record payment se abre con el Customer elegido en 2 toques como máximo desde cualquier **Tab root** ("Collect" en una fila de Customers o en una fila de Home). Un Payment se registra en menos de un minuto, y "All" salda todo el Balance en un toque. En una computadora no lleva más toques que en el celular.
10. **Quién debe, de un vistazo.** Customers se abre en "Owed to you": el **Total owed**, la línea de cantidad ("1 sale owing" o "N sales owing") y cada deudor con el Owing since más viejo primero, cada uno con Balance y "since dd/mm". Todos de la A a la Z quedan abajo. Toda cifra sale de la API y es igual al bloque "Owed to you" de Home y a un cálculo directo. Sin scrollear la lista de la A a la Z y sin sumas.
11. **La ficha cierra el circuito.** Desde la ficha de un Customer el vendedor ve su Balance y su cuenta, "Record payment" (cuando debe) y "New sale to <name>", con ese Customer ya elegido.
12. **Los VIP de antes llegan a su tipo.** Después de la actualización, todo Customer que tenía la marca VIP está en el VIP type de su propio Business, y ningún otro Customer tiene tipo.
13. **Tipos propios desde el celular.** En el celular, un vendedor crea un tipo con nombre e ícono y se lo asigna a un Customer desde el formulario en menos de un minuto.
14. **Nada de lo cobrado ni de lo debido cambia.** Las Sales registradas, las **Price entries**, los Balances y los **Settlements** quedan exactamente como estaban. Una Sale nueva para un VIP customer de antes se cotiza igual que antes de la actualización.
15. **Los tipos no se mezclan.** Un Business nunca ve ni se entera de que existen los tipos de otro Business.
16. **El tipo se elige con el Selector** (parte 6 de GH-581). Con 12 o más Customer types, el vendedor encuentra uno buscando y lo elige; el formulario no tiene ningún otro tipo de selector para ese campo (ni select nativo, ni chips, ni radios, ni botones presionados).
17. **Volver nunca tira el formulario.** En el celular, volver con la lista de tipos abierta cierra solo la lista; volver con el formulario sin tocar vuelve a la pantalla madre; volver con cambios sin guardar pide la confirmación de descarte. Vale al dar de alta y al editar un Customer. En la computadora, Escape cierra solo el desplegable.
18. **Nada se pierde y nada engaña mientras carga.** El tipo se sigue pudiendo quitar ("No type"), el aviso "Add a customer type" sigue igual cuando no hay tipos, el rechazo por un tipo que ya no existe sigue igual, y mientras los tipos se cargan (o después de una carga fallida) no se muestra ni "No type" ni el aviso.

## Comportamiento

- **Customer**: un nombre, un Phone number opcional y como máximo un Customer type. Un Customer se identifica por su propio registro (su id), nunca por su número. Su Balance y su Owing since se calculan a partir de sus Sales y Payments (`payments.md`) y nunca se guardan en el Customer.
- **Nombre**: obligatorio. Recortado, con los espacios internos colapsados, hasta 60 caracteres. No es único.
- **Sin canal**: el antiguo canal (Telegram o WhatsApp) se quitó del dominio, la API, los formularios, la ficha, la lista, el Business export y la base de datos.
  - Un pedido que todavía manda uno se completa bien: el canal se ignora, nunca se guarda, y ninguna respuesta lo lleva. El vendedor no ve diferencia, porque ningún formulario ofrece el campo.
  - **Los valores guardados se descartan para siempre.** La migración que elimina la columna no conserva copia en ningún lado; el producto no puede recuperarlos, y la eliminación no se puede deshacer desde adentro.
  - **Supuesto**: ningún vendedor va a necesitar los valores viejos del canal; quien los necesite igual puede encontrar al Customer por nombre o por número.
- **Customer type** (hexágono `customer_types`, ADR-0055):
  - Un tipo tiene un nombre obligatorio y un ícono obligatorio, y pertenece a un solo Business (`business_id` no nulo). La API lo devuelve como `{id, name, icon, is_vip}`; `is_vip` es de solo lectura y ningún pedido lo fija.
  - **Nombre**: de 1 a 40 caracteres después de recortar los espacios, texto libre, único dentro del Business sin importar mayúsculas, minúsculas ni espacios, tanto al crear como al renombrar. No hay límite de cantidad de tipos por Business.
  - **Ícono**: uno de un conjunto fijo de ocho claves neutras, guardadas tal cual: `circle` (el valor por defecto de un tipo nuevo), `star`, `heart`, `diamond`, `flag`, `tag`, `crown` y `bell`. Ninguno es de flor ni propio de un tipo de negocio. Una clave desconocida se rechaza (`customer_type.icon_unknown`). Siempre va junto al nombre del tipo, nunca solo (icon-and-text-rule.md); la única excepción es una celda del selector de íconos, que lleva su nombre accesible ("Circle", "Star", etcétera).
  - **Sin precio propio**: los tipos que crea el vendedor no llevan precio. Los precios por tipo los entrega la parte customer-type prices (ADR-0059).
  - **Un Business nuevo** arranca sin ningún tipo (ADR-0059).
  - **Eliminar**: un tipo se puede eliminar solo mientras no tiene ningún Customer. El rechazo (`customer_type.in_use`, 409) lleva cuántos Customers tiene. Ningún Customer queda sin tipo en silencio.
  - Los Customer types son un Growable set: nunca se declaran en `fixedSets.ts` ni se eligen con chips (selector.md).
- **Pertenencia**: un Customer está en un tipo o en ninguno (`customer.customer_type_id`, nulo cuando no tiene).
  - Se elige en el formulario del Customer y se puede cambiar o quitar (con "No type") en cualquier momento.
  - Un tipo de otro Business, o uno que ya no existe, responde 404 (`customer_type.not_found`), igual que cualquier otra referencia.
  - **Mientras Customer types está apagado**:
    - toda pertenencia sigue guardada, y la API la sigue devolviendo;
    - guardar un Customer nunca la cambia, sin importar lo que mande el pedido;
    - un Customer creado entonces no tiene tipo.
- **VIP type**: el tipo "VIP" que la actualización creó en cada Business existente, con el ícono `star` (ADR-0059), o que la Spreadsheet import crea (abajo). Es la única fila marcada `is_vip` de su Business (ADR-0070).
  - Es el único tipo cuya pertenencia da el VIP price en las Sales nuevas, con la regla de hoy: la Price entry tiene un VIP price y es menor que lo que da cualquier otra regla, y solo mientras Customer types está activado (sales.md, pricing-settings.md).
  - Lo identifica esa marca, puesta solo por la actualización o la Spreadsheet import, nunca su nombre: renombrarlo o cambiarle el ícono no cambia nada, y un tipo que el vendedor llama "VIP" no da ningún VIP price.
  - En la lista de tipos se ve como cualquier otro, sin ninguna marca propia.
  - Un Customer que entra al VIP type recibe el VIP price desde su próxima Sale; uno que sale deja de recibirlo. Las Sales ya registradas conservan su precio y su Pricing rule (ADR-0003).
  - Sigue las mismas reglas que cualquier tipo: una vez sin Customers se puede eliminar, y desde entonces nadie recibe el VIP price.
  - El campo `vip` de un Customer en la API es la pertenencia al VIP type, sea cual sea el interruptor; las pantallas lo ocultan mientras está apagado.
  - En la lista de Sales, la insignia VIP de una Sale muestra si el Customer está hoy en el VIP type, no cómo se fijó el precio de esa Sale (sales.md).
- **La marca VIP congelada** (`customer.vip`): se conserva con el valor que tenía, ya no se lee y nunca se vuelve a escribir para ningún Customer después de la actualización, por ningún camino (la API, la Spreadsheet import, la apertura de un Business). Un pedido que todavía manda `vip` se completa bien y el campo se ignora.
- **Phone number**: opcional, único dentro del Business entre los Customers que tienen uno, guardado en una sola forma internacional.
  - **Ninguno**: un valor faltante, `null`, o uno en blanco tras recortar significa que el Customer no tiene número. Se guarda como sin número, nunca como string vacío.
  - **Con `+` y un código de país distinto de 54**: un número extranjero. Se guarda como `+` y sus dígitos, y debe tener de 8 a 15 dígitos.
  - **Con `+54`, o un `54` a secas**: si lo siguen 10 dígitos, o un `9` y 10 dígitos, es un número argentino con su código de país. Se guarda como `+549` y los 10 dígitos.
  - **Cualquier otra cosa sin `+`**: un número argentino local. Se descartan un `0` inicial y el `15`, y deben quedar exactamente 10 dígitos, código de área incluido. Se guarda como `+549` y esos 10 dígitos.
  - **Los teléfonos fijos** no se rechazan: todo número argentino se trata como celular.
  - **Rechazado**: un valor no en blanco que no encaja en ninguna de estas reglas, como demasiado corto, demasiado largo o sin código de área. El rechazo dice algo como "that doesn't look like a phone number with its area code" y nunca repite lo que se escribió.
  - `11 2345-6789`, `011 15 2345-6789`, `+54 9 11 2345 6789`, `5491123456789` y `541123456789` pasan todos a ser `+5491123456789`.
- **Unicidad**: un número ya usado por otro Customer del mismo Business se rechaza, tanto al registrar como al editar. El rechazo nunca repite el número ni el nombre. Cualquier cantidad de Customers puede no tener número. Los números de otros Businesses nunca chocan y nunca se revelan.
- **Edición**: nombre, Phone number y Customer type (el tipo solo mientras Customer types está activado).
  - El Phone number pasa por la misma normalización, el mismo chequeo de unicidad y el mismo rechazo que al registrar.
  - Se puede borrar, y el Customer queda sin número.
  - Las Sales, los Payments y el Balance pertenecen al Customer, no al número, así que siguen asociados cuando este cambia o se quita.
- **Lista y búsqueda**: una sola consulta.
  - El nombre coincide con la consulta en cualquier parte, sin importar mayúsculas ni acentos.
  - El número coincide con los dígitos de la consulta, sin un 0 inicial, en cualquier parte de los dígitos del número guardado. Un Customer sin número nunca coincide por número, y una consulta sin dígitos no coincide con ningún número.
  - Un Customer coincide si coincide el nombre o el número; un Customer sin número se encuentra por nombre.
  - Una consulta vacía devuelve todos los Customers.
  - Los resultados se ordenan por nombre.
  - No hay paginación, ni largo mínimo de consulta, ni filtro VIP ni por tipo, ni filtro para los Customers sin número.
- **Almacenamiento**: la columna del teléfono admite nulos; la unicidad dentro de un Business se aplica solo a los números guardados. Los Customers que existían antes de que el número fuera opcional conservaron sus números. La columna del canal se elimina con una migración en la cadena única de Alembic; todas las demás columnas y el nombre, el número, el VIP, las Sales, los Payments y el Balance de cada Customer quedan exactamente como estaban.
- **Migración de los Customer types** (revisión `0020`, ADR-0059): agrega la tabla `customer_type` y la columna nula `customer.customer_type_id`, y nunca cambia el valor de una columna que ya existía.
  - Cada Business existente recibe un tipo "VIP" con el ícono `star`: su VIP type. Lo recibe incluso sin ningún VIP customer, así puede seguir dando el VIP price.
  - Solo los Customers con la marca VIP reciben ese tipo; ningún otro Customer recibe tipo.
  - La marca VIP queda guardada tal cual. El comparador M3 compartido de `tests/migrations/` lo prueba.
- **Spreadsheet import** (import.md): un VIP de la planilla entra al VIP type de ese Business; nunca escribe la marca congelada.
  - Si el Business ya tiene su VIP type, lo usa, se llame como se llame hoy.
  - Si la planilla tiene al menos un VIP y el Business no tiene VIP type, la Spreadsheet import lo crea con el nombre "VIP".
  - **Si en ese caso el Business ya tiene un tipo propio del vendedor llamado "VIP"** (sin importar mayúsculas ni espacios), la Spreadsheet import se detiene antes de escribir nada y le dice al Operator, con un texto fijo del Copy module en su terminal, que ese tipo existe y hay que renombrarlo o eliminarlo antes de volver a correrla. Nunca toma el tipo del vendedor como VIP type ni crea el VIP type con otro nombre. No es una **Unfinished row**: es un chequeo sobre el Business, previo a toda escritura, y no nombra ningún Customer ni monto.
- **Business export** (accounts.md, ADR-0015): sigue el esquema por reflexión, así que los Business exports nuevos y el registro de tablas y columnas de la **Business removal** llevan los Customer types y la pertenencia, y no llevan canal. Los Business exports escritos antes del cambio conservan lo que tenían; nada importa un Business export de vuelta. Las cantidades exportadas siguen siendo iguales a las eliminadas.
- **Aislamiento (ADR-0004)**:
  - El Business sale de la **Session**.
  - El Customer de otro Business responde 404 tanto al leer como al editar; el Customer type de otro Business responde 404 al leer, renombrar, cambiar el ícono, eliminar y asignar.
  - Las listas y búsquedas no muestran ninguno de los Customers ni de los Customer types de otro Business.
  - Las rutas de Customer y de Customer type (`/api/customer-types`) están en `tests/test_business_isolation.py` y en el test de rutas protegidas.

### En pantalla: Customers

- **Customers** es una Tab root (navigation.md). En una computadora son dos paneles: la lista a la izquierda, la ficha del Customer seleccionado a la derecha. Customers no selecciona nada por su cuenta.
- **La pantalla se abre con dos secciones**, sin ninguna cifra de deuda tocable en su cabecera:
  1. **"Owed to you"**, arriba: el Total owed, la línea de cantidad ("1 sale owing" o "N sales owing"), y todo Customer cuyo Balance es mayor que $0, con el Owing since más viejo primero, los empates por nombre, cada fila con "Collect" (`payments.md`). Si nadie debe, dice un "Nobody owes you" fijo, sin nada para tocar, arriba de la lista completa de la A a la Z.
  2. **Everyone, A–Z**, abajo, ordenados por nombre.
- Toda cifra de Owed to you sale de la API y es igual al bloque "Owed to you" de Home; el navegador no calcula nada.
- **Toda fila de quien debe**, en cualquiera de las secciones y en los resultados de búsqueda, muestra el monto en ámbar con "owes you since dd/mm" debajo, nunca como chip, y un botón "Collect" (nombre accesible "Collect from <name>") que abre Record payment con ese Customer ya elegido, como un paso más en el historial de la app; volver o "Close" lo deja en un solo movimiento. Tocar el resto de la fila abre la ficha del Customer.
- **Quien tiene Credit** nunca aparece en Owed to you y no cuenta en ninguna cifra. En todos de la A a la Z muestra "Credit $ X" con el tratamiento neutro/azul, nunca verde ni ámbar.
- **Quien tiene un Balance de $0** no muestra nada sobre dinero.
- **Quien no tiene número** no muestra nada en el lugar del número: ni guion, ni etiqueta vacía, ni "No phone".
- **La marca VIP** se muestra en las filas de la lista y en Pick a customer solo mientras Customer types está activado, y dice si el Customer está en el VIP type; nunca muestra el nombre ni el ícono de un tipo. Mientras está apagado, no se muestra nada en su lugar. Las filas no muestran el Customer type.
- **Búsqueda** por parte del nombre o del Phone number: mientras se escribe una consulta, las dos secciones se colapsan en una sola lista plana ordenada por nombre, con las coincidencias como arriba; un Customer que debe conserva su Balance, "owes you since dd/mm" y "Collect". Borrar la consulta trae de vuelta las dos secciones.
- **La ficha de un Customer** (`ClienteFicha`), una tarjeta con "‹ Customers":
  - teléfono (solo cuando hay uno; sin ninguno, la línea se omite por completo);
  - debajo, en su propia línea, su Customer type: primero el ícono y después el nombre (solo mientras Customer types está activado y el Customer tiene uno; sin tipo, la línea se omite). El tipo reemplaza el antiguo bloque "VIP / No";
  - "Owes you $ X since dd/mm" o "Credit $ X" (ninguno para un Balance de $0), la cuenta, "Record payment" solo cuando el Balance es mayor que $0, y "Delete payment" en los Payments posteriores (`payments.md`);
  - **"New sale to <name>"**, que abre New sale con ese Customer ya elegido (sales.md). La ficha no muestra "+ New sale".
  - Agregar un número más adelante es la edición ordinaria de la ficha; no hay ningún aviso para completarlo.
- **Record payment** (`Payment`) sigue payments.md sin cambios y su diseño, `Cobro.dc.html`, abierto con el Customer elegido desde una fila de deudor o desde la ficha.
- **Alta y edición** (`ClienteForm`, el formulario "New customer" dibujado en `NuevaVentaCliente` y `ClienteNuevo`): el mismo formulario al dar de alta desde Customers y al editar desde la ficha.
  - Sus campos son "Name" (el único marcado como obligatorio), el teléfono (opcional, y se puede borrar al editar) y "Customer type". El antiguo interruptor VIP ya no está. No hay campo de canal.
  - El creador de "Pick a customer" dentro de New sale (`NuevaVentaCliente`) usa los mismos campos de nombre y teléfono, sin "Customer type"; el Customer creado ahí no tiene tipo, y ese Customer se usa para la Sale.
  - **"Customer type"** se muestra solo mientras Customer types está activado. Desde la parte 6 de GH-581 es un Selector opcional (selector.md) sobre los tipos del Business:
    - cada opción muestra el nombre del tipo con su glifo (`glyphOf(type.icon)`) delante;
    - sin tipo elegido, el campo dice "No type" y la lista no tiene fila para borrar ni una fila "No type" repetida;
    - con un tipo elegido, la primera fila de la lista es la fila para borrar, "No type", que deja al Customer sin tipo;
    - con más de 8 tipos, la lista tiene búsqueda;
    - en el celular, la lista se abre en una Sheet como su propia entrada del historial sobre el formulario (dentro de un `SheetStackProvider` montado en la raíz de `ClienteForm`); volver o "Close" con la lista abierta cierra solo la lista, nunca el formulario. En la computadora es un desplegable con teclado, y Escape cierra solo el desplegable.
  - **Mientras los tipos se están cargando**, o después de una carga fallida, el campo está presente y cargando (deshabilitado, con su esqueleto), sin "No type" ni el aviso, porque todavía no se sabe si hay tipos. Guardar igual funciona y conserva el tipo que tiene el formulario; el manejo de fallas de la pantalla dice qué falló.
  - **Sin ningún tipo en el Business** (una vez que la carga respondió), el campo muestra, en lugar del Selector, el **Tappable notice** "Add a customer type", que lleva a Settings → Prices → Customer types; el Customer queda sin tipo. Desaparece en cuanto existe al menos un tipo. Los tipos se crean solo en Settings; el vendedor vuelve al formulario por el camino de vuelta habitual, sin el tipo nuevo preelegido.
  - Ir a Settings desde el aviso sale del formulario: con cambios sin guardar, se pide la confirmación habitual de descartar, y lo que se escribió se pierde.
  - Si al guardar el tipo elegido ya no existe, un error en línea bajo el campo, asociado al campo como su descripción, dice "That type no longer exists. Pick another one.", la elección vuelve a "No type" (sin la marca "no longer available") y el vendedor elige de nuevo.
  - Es un formulario: "Close", y una confirmación al salir con cambios sin guardar. Un formulario sin tocar se cierra de inmediato y vuelve a la pantalla madre.
- **Si sale bien**, el toast "Customer saved". Nunca lleva un nombre ni un número.
- **Los rechazos** se muestran en línea sobre el campo, con el string fijo del dominio, y conservan lo que se escribió. Nunca repiten el número ni el nombre.
- **Cómo se dibuja el ícono de un tipo**: en la lista de Customer types y en el selector de íconos, con los glifos del componente `Icono`; en la lista del Selector del formulario y en la ficha, con un símbolo de texto por clave (`glyphOf`). Para algunas claves (Bell, Tag) los dos dibujos no coinciden; unificarlos queda para una tarea posterior.
- **Diseño**: Customers, `ClienteFicha`, `Payment` y `NuevaVentaCliente` coinciden con `docs/product/design-system/pantallas/` en celular y computadora, en los dos temas. El campo "Customer type" se muestra cerrado como Selector en `ClienteNuevo`. Una diferencia de texto respecto de los docs se lista en el PR. Ningún estado se dice solo con color.
- **Respuesta de la app**: sin red muestra "No connection", un error del servidor el reintento genérico, y un Customer o un Customer type que ya no existe sigue la regla "That is gone." de accounts.md.

### En pantalla: Settings → Prices → Customer types

- **Lugar**: la ruta `/settings/prices/customer-types`, un formulario cuya pantalla madre es Settings → Prices (`scripts/design/screens.json`). Se llega desde la fila "Customer types" (rótulo y chevron) dentro del grupo Prices, que se muestra solo mientras el interruptor Customer types guardado está activado (pricing-settings.md), y desde el aviso "Add a customer type" del formulario del Customer. Queda a 3 toques de una Tab root (More → Settings → Prices → Customer types).
- **Lista** ("Customer types", con "Close"): cada tipo del Business en una fila con su ícono y su nombre, sin precio ni cantidad de Customers, y dos botones con nombre accesible, "Rename <name>" (lápiz) y "Delete <name>" (tacho). Abajo, "+ Customer type".
  - Sin ningún tipo: "No customer types yet" y el botón.
  - Si la carga falla: el ícono de atención y la oración tocable "Couldn't load the customer types. Tap to try again.".
- **Crear, renombrar, cambiar el ícono**: un solo formulario en una Sheet ("New customer type" o "Edit customer type"), con "Name" y "Icon", y "Save".
  - "Icon" es una grilla de las ocho opciones, cada celda de al menos 44×44 px con su nombre accesible; al crear, viene elegido el círculo; al editar, el ícono actual. No hay vista previa del ícono con el nombre.
  - Rechazos en línea, con el ícono de atención, conservando lo escrito, cada uno con su `code` en `web/src/api/contract.json`: "Give the type a name." (`customer_type.name_blank`), "Use 40 characters or fewer." (`customer_type.name_too_long`) y "You already have a type with that name." (`customer_type.name_taken`). Nunca repiten el nombre.
  - Si el tipo ya no existe: "This type no longer exists. Close this and check the list.".
  - "Close" o el gesto de volver con cambios sin guardar preguntan "Discard the changes?" ("Discard" / "Keep editing"); sin cambios, cierran de inmediato.
- **Eliminar**: un toque en el tacho. Un tipo vacío, el VIP type incluido, se elimina sin confirmación. Un tipo con Customers no se elimina y nada cambia: un aviso ámbar con el ícono de atención dice "1 customer is in this type. Move that customer to another type first." o "N customers are in this type. Move them to another type first.". No hay movimiento en bloque: se cambia un Customer a la vez desde su formulario.
- Las rutas de `/api/customer-types` responden igual con el interruptor encendido o apagado; es la pantalla la que se oculta.
- Todo texto vive en el **Copy module**, los nombres accesibles de los íconos incluidos, y ningún valor por defecto nuevo lleva una palabra de flor.

## Métricas

- **Números duplicados**: Customers que comparten un número guardado dentro de un Business, 0. Una restricción de la base de datos lo impone y un test lo cubre. (Criterio 2)
- **Sin choque sin número**: dos o más Customers sin número coexisten en un Business, probado. (Criterios 2, 5)
- **Matriz de normalización**: toda forma equivalente se resuelve en un solo número, toda forma inválida no en blanco se rechaza, y un valor en blanco se guarda como sin número. 100% aprobada. (Criterios 2, 6)
- **Sin eco**: ningún cuerpo de rechazo ni toast contiene el número enviado, ninguna de sus secuencias de dígitos, el nombre de un Customer ni el nombre de un Customer type. Después de una corrida completa del front, la consola y el almacenamiento del navegador no tienen ningún nombre, número ni monto. (Criterios 2, 6)
- **Cobertura de aislamiento**: toda ruta de Customer y de Customer type está en el barrido de aislamiento y en el test de rutas con acceso restringido, y responde 404 o vacío desde otro Business; asignar un tipo de otro Business responde 404. (Criterios 3, 15)
- **Tiempo de alta o búsqueda**:
  - registrar un Customer nuevo desde el celular se corre a través del front (`web/e2e/customers.spec.ts`) y el presupuesto de toques se cumple (`web/e2e/tapBudget.spec.ts`); su duración no la mide ningún test;
  - una búsqueda responde en menos de 300 ms con unas pocas docenas de Customers;
  - una Sale con un Customer nuevo, registrado desde "Pick a customer" con o sin número, se registra en la misma corrida del front (`web/e2e/customers.spec.ts`); su duración no la mide ningún test.

  (Criterio 1)
- **Ciclo de vida sin número**: a través de la API y de la corrida end-to-end del front, un Customer sin número se registra, se edita, se encuentra por nombre, se elige para una Sale que queda debiendo, se salda y se muestra en la sección "Owed to you" de Customers. 100% aprobada. (Criterio 5)
- **Sin relleno**: los tests del front no muestran línea de teléfono, ni guion, ni etiqueta vacía, ni "No phone" en la ficha y la lista de un Customer sin número. (Criterio 5)
- **Número quitado**: borrar el número de un Customer deja sin cambios sus Sales, Payments y Balance, probado. (Criterio 6)
- **Migración**: el número de cada Customer queda sin cambios después de la migración que lo hizo opcional, probado. (Criterio 6)
- **Sin canal (criterio 7)**:
  - después de la migración que lo elimina, ninguna respuesta, formulario, ficha, lista ni Business export de un Customer lleva un canal;
  - el nombre, el número, el VIP, las Sales, los Payments y el Balance de cada Customer quedan sin cambios antes y después: 0 diferencias, probado en la cadena única de Alembic;
  - un pedido que todavía manda un canal se completa bien y no guarda nada;
  - los campos de canal en pantalla y en la API pasan de 1 a 0 (la medida de negocio de "un campo menos");
  - la suite de Business removal pasa después de la migración: la cantidad exportada es igual a la eliminada para cada tipo, está presente todo campo guardado que lista accounts.md, y no hay ningún canal en el archivo.
- **El tipo sigue al interruptor (criterio 8)**:
  - los tests del front no muestran ningún tipo en la ficha, ningún campo "Customer type" en el formulario, ninguna fila Customer types en Prices ni ninguna marca VIP en la lista, mientras Customer types está apagado;
  - una edición o un pedido que manda un tipo mientras está apagado deja sin cambios la pertenencia guardada, y un Customer creado entonces no tiene tipo;
  - volver a encenderlo muestra toda pertenencia guardada como antes.
- **Cobrar rápido (criterio 9)**: la corrida end-to-end del front, en viewports de celular y de computadora, toca "Collect from <name>" desde una fila de Customers y desde una fila de Home; Record payment se abre con el Customer elegido en 2 toques como máximo desde cada Tab root, nunca más en la computadora; "All" completa todo el Balance en un toque; se registra un Payment desde un viewport de celular, y un movimiento de volver regresa a la pantalla de la que vino. Ningún test mide la duración.
- **Quién debe, de un vistazo (criterio 10)**:
  - los tests del front muestran Owed to you arriba de todos de la A a la Z, la línea de cantidad en sus dos formas, los deudores con el más viejo primero y los empates por nombre, y "Nobody owes you" arriba de una lista completa de la A a la Z cuando nadie debe;
  - el total, la cantidad y el Balance y la fecha de cada deudor son iguales al bloque de Home y a un cálculo directo sobre las Sales y los Payments: 0 diferencias;
  - los Customers con Credit no están en ninguna sección ni en ninguna cifra, y muestran "Credit" solo en la lista de la A a la Z.
- **El layout de Customers**: los tests del front muestran "Collect" con su nombre accesible en cada fila de deudor (las dos secciones y los resultados de búsqueda), la búsqueda colapsando todo en una sola lista ordenada por nombre y las secciones volviendo cuando se borra.
- **La ficha (criterio 11)**: los tests del front y la corrida end-to-end muestran "Record payment" solo con un Balance mayor que $0, y "New sale to <name>" abriendo New sale con ese Customer elegido; la ficha no muestra "+ New sale".
- **Los VIP de antes llegan a su tipo (criterio 12)**: después de la migración, cada Business existente tiene exactamente un VIP type; sus miembros son exactamente los Customers con `vip = 1`; ningún otro Customer tiene tipo; el comparador M3 compartido encuentra 0 valores cambiados en columnas existentes.
- **Tipos propios desde el celular (criterio 13)**: la corrida end-to-end del front (`web/e2e/customerTypes.spec.ts`), en un viewport de celular, crea un tipo con nombre e ícono en Settings → Prices → Customer types y se lo asigna a un Customer desde el formulario, dentro del presupuesto de toques (6 toques y 1 campo desde More para crear, 5 toques desde Customers para asignar, el abrir y elegir del Selector incluidos); ningún test mide la duración. Las celdas del selector cumplen el tamaño de toque de §10 y el Mobile check pasa sin infractores nuevos.
- **Nada de lo cobrado ni de lo debido cambia (criterio 14)**:
  - para cada VIP customer de antes, el precio, la regla y el total de una Sale nueva son iguales antes y después de la actualización, por el mismo Product, día y gramos: 0 diferencias;
  - un Customer que entra al VIP type recibe el VIP price en su próxima Sale y uno que sale deja de recibirlo; un tipo creado por el vendedor llamado "VIP" no da nada; un VIP type renombrado sigue dando el VIP price;
  - las Sales, las Price entries, los Balances y los Settlements registrados quedan sin cambios: 0 diferencias.
- **Reglas de los tipos**: tests de la API cubren crear, renombrar y cambiar el ícono; el rechazo de un nombre en blanco, de más de 40 caracteres y repetido sin importar mayúsculas ni espacios (también al renombrar); el rechazo de un ícono desconocido; que un `is_vip` enviado se ignora; el rechazo de eliminar un tipo con Customers, que lleva la cantidad; y eliminar un tipo vacío, el VIP type incluido. Cada rechazo tiene su `code` en `contract.json`, verificado por `tests/test_refusal_codes.py`.
- **Formulario del tipo**: los tests del front muestran que el tipo se elige, se cambia y se quita con la fila "No type"; que el interruptor VIP ya no está; que "Add a customer type" aparece solo sin tipos y lleva a Settings → Prices → Customer types.
- **El tipo con el Selector (criterios 16, 17, 18)**, en los tests del front:
  - con 12 o más tipos sembrados, el Selector está presente y no hay ningún `<select>`, grupo de radios ni botón `aria-pressed` para el campo; tipear parte de un nombre en la búsqueda encuentra el tipo y tocarlo lo elige;
  - sin tipo elegido, la lista no tiene fila para borrar; con un tipo elegido, la fila para borrar deja "No type";
  - sin tipos, se muestra el aviso; mientras los tipos se cargan y después de una carga fallida, no se muestra "No type", ni el aviso, ni ningún texto de conjunto vacío;
  - el rechazo por un tipo que ya no existe vuelve la elección a "No type" y muestra su línea;
  - al dar de alta y al editar: formulario sin tocar, volver va a la pantalla madre; con cambios sin guardar, volver pide la confirmación de descarte; con la lista abierta, volver cierra solo la lista; en la computadora, Escape cierra solo el desplegable.

  El chequeo `mobile` recorre el estado `customer/type-selector-open` sin infractores nuevos. 100% de aprobación.
- **La marca congelada**: después de la actualización, ningún camino de escritura (API, Spreadsheet import, apertura de un Business) cambia `customer.vip`, probado con un registro de sentencias que no encuentra ningún INSERT ni UPDATE que la nombre.
- **Spreadsheet import y el VIP type**: tests del import cubren que los VIP de la planilla entran al VIP type existente aunque esté renombrado; que sin VIP type se crea uno; y que sin VIP type y con un tipo del vendedor llamado "VIP" (también " vip ") el import se detiene con su texto fijo y deja 0 filas nuevas en todas las tablas.
- **Textos**: todo texto nuevo está en el Copy module, `en-XA` está regenerado, y ningún valor por defecto nuevo lleva una palabra de flor.
- **Sin regresiones**: las suites existentes de customers, payments y navigation pasan sin aflojar ninguna aserción.
- **Sin curl**: la corrida end-to-end del front agrega, encuentra y edita un Customer, agrega uno sin número, le asigna un tipo, abre Record payment desde "Collect" con el Customer elegido, y abre "New sale to <name>" con ese Customer elegido. (Criterio 4)
- **Diseño**: `scripts/design/compare.sh` se corre antes y después para Customers, `ClienteFicha`, `Payment`, `NuevaVentaCliente`, `ClienteNuevo` y Settings → Prices, celular y computadora, claro y oscuro donde el registro tiene los dos, adjunto al PR y juzgado a ojo, con cada diferencia respecto del diseño listada. La lista y el formulario de Customer types no tienen dibujo y se juzgan contra el diseño escrito.
- El Balance, la cuenta y las métricas de cifras de Owed to you viven en `payments.md`.

## Fuera de alcance

- Eliminar un Customer: va a tener Sales y Payments.
- Unificar duplicados; importar desde la planilla (import.md).
- Una nueva clave única para los Customers.
- Un filtro VIP o por tipo, o agrupar por tipo; un filtro, lista, insignia, orden o aviso para los Customers sin número.
- Mostrar el nombre o el ícono del Customer type en las filas de Customers, en Pick a customer o en Sales.
- Crear un Customer type desde el formulario del Customer, o volver al formulario con el tipo nuevo preelegido o con lo escrito conservado.
- Un campo "Customer type" en el creador de "Pick a customer" de New sale.
- Mover en bloque los Customers de un tipo a otro.
- Precios por Customer type (parte customer-type prices, ADR-0059).
- Que la Spreadsheet import resuelva sola un choque con un tipo del vendedor llamado "VIP" (adoptarlo, renombrarlo o crear el VIP type con otro nombre).
- Un canal de Customer, o cualquier reemplazo para él; guardar una copia de los valores viejos del canal en cualquier lado.
- Una pantalla Owed to you aparte; una cifra de deuda tocable en la cabecera de Customers; cualquier filtro u orden de Customers más allá de lo definido acá.
- Importar de vuelta un Business export viejo.
- Otras reglas VIP (un porcentaje de descuento sobre el **List price**); activar o desactivar Customer types (pricing-settings.md).
