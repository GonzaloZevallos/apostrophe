## Jobs

**Cuando** entrego un pedido o recibo un pago, **quiero** encontrar al cliente por parte de su nombre o de su número, o registrarlo en el momento si es nuevo, **para que** cada venta y cada deuda caiga en una persona real y yo sepa siempre quién me debe.

**Cuando** registro a un cliente (desde Customers, en medio de una venta o con la **Spreadsheet import** única) y no tengo su Phone number, **quiero** guardarlo igual con su nombre y agregar el número más adelante si algún día lo consigo, **para poder** registrar cada venta y cada deuda a nombre de la persona que de verdad debe, sin inventar un número ni dejar a esa persona fuera de la app.

**Cuando** agrego o edito el Phone number de un cliente, **quiero** tipearlo como lo diría en mi propio país y que la app lo guarde en forma internacional, **para que** la misma persona nunca quede registrada dos veces y yo nunca tipee a mano un código de país, sea cual sea el país de mi negocio. (GH-409, parte de GH-318. Desde la parte 2 de GH-682 no lo sirve una configuración del Business sino el **Phone country** que se elige por número en el formulario, con el **Detected country** por defecto.)

**Cuando** registro o edito un Customer desde el celular con su número adelante, **quiero** que el número se lea con el país correcto para ese número, por defecto el del lugar donde estoy, **para poder** guardarlo en pocos toques sin ir a Settings y confiar en que la misma persona nunca se convierte en dos Customers. (Parte 2 de GH-682: lo sirven el Selector "Phone country" del formulario del Customer, el Detected country y el bloqueo por el `+`.)

**Cuando** abro un Customer o recorro mi lista de Customers en el celular, **quiero** ver cada número agrupado como lo escribe la gente del país de ese mismo número, **para poder** leerlo, chequearlo y copiarlo sin contar mal los dígitos. (Parte 1 de GH-682: lo sirve el número agrupado de la fila de Customers, la ficha, la tarjeta de atrás y los dos selectores de Customer de New sale.)

**Cuando** tengo clientes habituales a los que trato distinto, **quiero** agruparlos en tipos a los que les pongo nombre yo y elegir el tipo de cada uno desde su ficha, **para poder** distinguirlos de un vistazo, y más adelante cobrarles según su tipo, sin depender de la memoria ni de notas. (GH-405, parte de GH-318: lo sirven los Customer types de Settings → Prices y el campo "Customer type" del formulario.)

**Cuando** registro una venta para un cliente que pertenece a uno de mis grupos de clientes, **quiero** que cada línea se cotice al precio que fijé para ese grupo y ese producto, **para** cobrarle a cada grupo su propio precio sin tipearlo ni sacarlo de memoria. (Parte customer-type prices de GH-318: lo sirve acá la pertenencia a un Customer type; los precios están en pricing-settings.md y la cotización de la línea en sales.md.)

**Cuando** configuro cómo fija sus precios mi negocio, registro el precio de un producto o entrego un pedido, **quiero** que la app use solo las **Pricing rules** que tiene mi negocio (un **Bulk price** si vendo por cantidad, y un VIP price que fijo por producto para mis VIP customers), **para poder** cobrarle a cada cliente exactamente lo que quiero sin escribir un **Special price** a mano, sin ver campos que no me aplican y sin que el precio de nadie cambie de sorpresa. (Lo sirve acá la pertenencia al VIP type, que sigue al interruptor Customer types; definido en pricing-settings.md.)

**Cuando** manejo mi negocio desde el celular, **quiero** mantener al día mis clientes desde el celular, **para poder** dejar de tenerlos en la planilla y tener datos reales cuando lleguen las ventas.

**Cuando** un cliente me paga parte o todo lo que debe, en efectivo o por transferencia, el mismo día o semanas después, **quiero** registrarlo desde el celular en pocos toques y ver que su Balance y su "owing since" bajan en el acto, **para** saber siempre quién me debe qué y desde cuándo, y que nada de lo que pagó o todavía debe se pierda ni caiga en la persona equivocada. (Lo sirve acá la sección "Owed to you" de Customers y su "Collect", y el Balance, la cuenta y Record payment de la ficha; definido en `payments.md`.)

**Cuando** manejo mi negocio desde el celular entre pedidos o en medio del chat con un cliente, varias veces por día, **quiero** que la app esté armada según lo que hago de verdad y con qué frecuencia, **para poder** volver con el cliente en lugar de buscar entre menús. (El job de **Navigation**, navigation.md: lo sirve acá Customers, que se abre en quién debe, con "Collect" en cada fila de deudor.)

**Cuando** un cliente me paga parte o todo lo que debe, o entre pedidos quiero saber quién todavía me debe y desde cuándo, **quiero** que Customers se abra en quién me debe (el total, y cada deudor con la deuda más vieja primero, con su Balance y desde cuándo) y cobrarle a cualquiera en un toque, **para poder** mantener cada Balance al día y perseguir primero las deudas más viejas, sin abrir fichas una por una, hacer cuentas ni completar campos que nunca uso.

**Cuando** registro una Expense o guardo un Customer desde el celular, **quiero** elegir su Expense category o su Customer type igual que elijo un Product o un Withdrawal reason (un campo con etiqueta que abre su propia lista, con búsqueda cuando la lista es larga), **para** terminar el formulario en pocos toques y que volver nunca tire lo que ya tipeé. (Parte 6 de GH-581, compartido con expenses.md y selector.md: acá lo sirve el campo "Customer type" del formulario del Customer.)

# Clientes

Las personas a quienes un **Business** le vende, cada una identificada dentro de ese Business por su propio registro, y vistas solo por ese Business (ADR-0004). El nombre es la forma en que un **User** reconoce a un **Customer**; el **Phone number** es un dato de contacto opcional.

Las **Sales** y los **Payments** se apoyan en esta capacidad: toda Sale y toda deuda pertenece a un Customer de acá. Cada Customer puede estar en un **Customer type** que define el vendedor, o en ninguno. Un **VIP customer** es un Customer del **VIP type**: paga el **VIP price** de un **Product** (el **Customer-type price** del VIP type) cuando hay uno vigente y es menor o igual que lo que da cualquier otra regla. Esto vale solo en un Business con el interruptor Customer types activado (pricing-settings.md, sales.md).

El **Balance**, el **Owing since** y la cuenta de un Customer se definen en `payments.md` y se muestran en su ficha y en la sección "Owed to you" de Customers.

Corregir los datos de un cliente sirve a los mismos jobs. En un negocio con el interruptor Customer types activado, a un cliente del VIP type se le cobra su VIP price en cada venta en la que es el más bajo, así que el vendedor nunca tiene que acordarse de quién es amigo.

La sección "Owed to you" afina el job de pagos y el job de Navigation de arriba para Customers (GH-46); no es un job nuevo. Su protagonista es el vendedor, en el celular; la computadora, con dos paneles, es el mismo job en una pantalla más grande. Tiene dos momentos: cobrar (el principal: un cliente entrega plata, en medio del chat o al entregar) y revisar (entre pedidos o al final del día). Antes, quién debía vivía en una pantalla Owed to you aparte, cobrar una deuda llevaba cuatro toques desde Customers, y el formulario del cliente pedía un canal (Telegram o WhatsApp) que nada del producto usaba.

El job de los Customer types tiene dos momentos: una configuración puntual (el vendedor decide que algunos habituales forman un grupo propio y lo nombra en Settings → Prices → Customer types) y el uso diario (al dar de alta o editar un Customer, dice en qué grupo está). Antes, la única forma de agrupar era la marca VIP de sí o no, y cualquier otro grupo ("mayorista", "amigo") vivía en la cabeza del vendedor o en la Note de una Sale.

El job del **Phone country** nació en GH-409 (ADR-0082) como una configuración del Business en Settings → Business. Desde la parte 2 de GH-682 (ADR-20261111-phone-country-per-number, que reemplaza a ADR-0082) ya no tiene configuración: el país es de cada número, se elige en el formulario y su valor por defecto sale del lugar donde se usa la app. La regla es del dueño, del 2026-11-11. La situación principal es tipear un número local en el celular mientras se registra un Customer, desde New customer o desde "Pick a customer" en New sale, muchas veces hablando con el comprador. Pegar un número con `+` de Telegram o WhatsApp y editar un Customer son secundarios. Antes, un Business existente estaba fijo en Argentina y solo podía atender a un cliente de afuera tipeando "+código"; uno nuevo arrancaba sin país y su primer número local se rechazaba; y cambiar la configuración para un cliente leía mal todos los otros números locales desde entonces. El caso que más pesa es el de un vendedor que trabaja fuera de Argentina; el cliente ocasional de otro país es el segundo. No se optimiza para vendedores con clientes repartidos en muchos países: les alcanza el Selector con su búsqueda.

El job del número agrupado (parte 1 de GH-682) no tiene configuración: es solo lectura. Las situaciones principales son copiar o marcar el número para escribirle a un Customer por Telegram o WhatsApp, y chequear que el número guardado es el correcto, por ejemplo cuando dos Customers se parecen; leérselo en voz alta al cliente es secundario y lo cubre la misma presentación. Antes, solo los números argentinos se mostraban agrupados, con una regla argentina fija en el front, y cualquier otro número se veía como una sola tira (`+59899123456`): un Business con Customers fuera de Argentina veía peor sus números que uno con Customers argentinos, en contra de **Assume nothing**. Se supone que ningún vendedor tiene hoy un atajo para esto; si lo tuviera, la definición sería la misma.

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
14. **Nada de lo cobrado ni de lo debido cambia.** Las Sales registradas, las **Price entries**, los Balances y los **Settlements** quedan exactamente como estaban. Una Sale nueva para un VIP customer de antes se cotiza igual que antes de la actualización, también después de que los VIP prices pasaron a ser Customer-type prices del VIP type.
15. **Los tipos no se mezclan.** Un Business nunca ve ni se entera de que existen los tipos de otro Business, ni sus precios.
16. **El tipo se elige con el Selector** (parte 6 de GH-581). Con 12 o más Customer types, el vendedor encuentra uno buscando y lo elige; el formulario no tiene ningún otro tipo de selector para ese campo (ni select nativo, ni chips, ni radios, ni botones presionados).
17. **Volver nunca tira el formulario.** En el celular, volver con la lista de tipos abierta cierra solo la lista; volver con el formulario sin tocar vuelve a la pantalla madre; volver con cambios sin guardar pide la confirmación de descarte. Vale al dar de alta y al editar un Customer. En la computadora, Escape cierra solo el desplegable.
18. **Nada se pierde y nada engaña mientras carga.** El tipo se sigue pudiendo quitar ("No type"), el aviso "Add a customer type" sigue igual cuando no hay tipos, el rechazo por un tipo que ya no existe sigue igual, y mientras los tipos se cargan (o después de una carga fallida) no se muestra ni "No type" ni el aviso; una carga fallida se informa con la línea de falla existente de la app.
19. **Número local, guardado internacional.** Al dar de alta o editar un Customer en el celular, el vendedor tipea solo el número local, sin código de país, y se guarda en forma internacional según el Phone country que muestra el formulario; después se muestra agrupado según el país de su propio código (criterio 23).
20. **Una sola persona, se tipee como se tipee.** Un número que ya pertenece a otro Customer del Business se detecta como el mismo número, se haya tipeado en forma local o internacional y con el país que sea, y nunca crea un segundo Customer.
21. **Ningún número guardado cambia.** Quitar el Phone country de Settings no reescribe ningún número guardado, y la Spreadsheet import sigue leyendo los números de la planilla como argentinos.
22. **Cada país con su regla, elegido por número.** El país se elige en el formulario de cada Customer, nunca en Settings, y un número de un país de la lista recibe la regla de ese país, no la argentina.
23. **Cada número, agrupado según su país** (parte 1 de GH-682). Todo número guardado de un país de la lista (Argentina, Uruguay, Chile, Paraguay, Brazil, Mexico, Spain, United States) se muestra agrupado con la regla de ese país, igual en los cinco lugares donde se lee un número: la fila de Customers, la ficha, la tarjeta de atrás, el selector de Customer de New sale y el paso de Customer de New sale. El campo del teléfono del formulario no es uno de ellos.
24. **Lo que no se puede agrupar se muestra tal cual.** Un número de un código de país fuera de la lista, o de un largo sin plantilla, se muestra exactamente como está guardado: nunca se oculta, se corta ni se cambia.
25. **Agrupar solo agrega espacios y guiones.** Los dígitos y el valor guardado nunca cambian; guardar, validar y la regla de que dos Customers nunca comparten un número no se tocan.
26. **El agrupado no le pide nada al vendedor.** Mostrar un número agrupado no agrega ninguna opción, elección ni texto: sale solo del número guardado, sea cual sea el país con que se tipeó. Un Customer sin número no muestra ninguno.
27. **Local, sin tocar el país** (parte 2 de GH-682). Un vendedor en un país de la lista que no es Argentina (Uruguay, por ejemplo) guarda un número en forma local sin tocar el control de país.
28. **Otro país, una elección o ninguna.** Un cliente de otro país de la lista lleva una sola elección deliberada en el formulario, sin ir a Settings, o ninguna cuando el número se tipea con `+`.
29. **Nunca un país que no se vio.** Ningún número se guarda con un país que el vendedor no vio en pantalla: el formulario siempre muestra el país que se va a usar, y lo muestra bloqueado cuando lo decide el `+`.
30. **El país no agrega toques.** Registrar una Sale con un Customer nuevo, número local incluido, se sigue haciendo desde el celular en menos de un minuto: un número local del Detected country agrega 0 toques, y otro país agrega solo los 2 toques del Selector.
31. **El número sigue opcional.** En la operación normal, ni el número ni el país son un paso que el vendedor tenga que pasar para guardar un Customer o seguir con la Sale. Una carga fallida de la lista de países es un estado de error, no un requisito: el formulario muestra la línea de falla de la app y se recupera cerrándolo y volviéndolo a abrir; en "Pick a customer", un Customer existente o "No customer" siguen dejando avanzar la Sale.

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
  - **Precios**: un tipo puede tener Customer-type prices, filas con fecha por Product que se guardan y se leen en pricing-settings.md ("Los precios por Customer type", ADR-0059). En esta parte solo el VIP type los recibe, con el campo "VIP price" de una Price entry; los tipos que crea el vendedor no tienen precio hasta la parte de la pantalla de precios por tipo, y a sus Customers se los cotiza como a cualquiera.
  - **Un Business nuevo** arranca sin ningún tipo (ADR-0059).
  - **Eliminar**: un tipo se puede eliminar solo mientras no tiene ningún Customer. El rechazo (`customer_type.in_use`, 409) lleva cuántos Customers tiene, y el tipo conserva sus Customer-type prices. Ningún Customer queda sin tipo en silencio.
    - Eliminar un tipo vacío se lleva también sus Customer-type prices, en la misma transacción y antes que el tipo.
    - Las Sale lines ya cotizadas por ese tipo conservan su precio, su regla y su copia del nombre del tipo (sales.md).
  - Los Customer types son un Growable set: nunca se declaran en `fixedSets.ts` ni se eligen con chips (selector.md).
- **Pertenencia**: un Customer está en un tipo o en ninguno (`customer.customer_type_id`, nulo cuando no tiene).
  - Se elige en el formulario del Customer y se puede cambiar o quitar (con "No type") en cualquier momento.
  - Un tipo de otro Business, o uno que ya no existe, responde 404 (`customer_type.not_found`), igual que cualquier otra referencia.
  - Una Sale toma el tipo que tiene el Customer al guardarla; cambiarle el tipo después nunca vuelve a cotizar una Sale registrada (sales.md).
  - **Mientras Customer types está apagado**:
    - toda pertenencia sigue guardada, y la API la sigue devolviendo;
    - guardar un Customer nunca la cambia, sin importar lo que mande el pedido;
    - un Customer creado entonces no tiene tipo.
- **VIP type**: el tipo "VIP" que la actualización creó en cada Business existente, con el ícono `star` (ADR-0059), o que la Spreadsheet import crea (abajo). Es la única fila marcada `is_vip` de su Business (ADR-0070).
  - Es el único tipo cuya pertenencia da un precio en las Sales nuevas: su Customer-type price vigente para el Product (el VIP price de la Price entry que es el Current price), cuando es menor que lo que da cualquier otra regla o empata con el Bulk price, y solo mientras Customer types está activado (sales.md, pricing-settings.md).
  - Una línea nueva cotizada así guarda la regla del Customer type, con el tipo y una copia de su nombre, y muestra ese nombre en su insignia. Las líneas guardadas antes con la regla `vip` la conservan y siguen mostrando "VIP".
  - Lo identifica esa marca, puesta solo por la actualización o la Spreadsheet import, nunca su nombre: renombrarlo o cambiarle el ícono no cambia ningún precio, y un tipo que el vendedor llama "VIP" no da ningún VIP price.
  - En la lista de tipos se ve como cualquier otro, sin ninguna marca propia.
  - Un Customer que entra al VIP type recibe el VIP price desde su próxima Sale; uno que sale deja de recibirlo. Las Sales ya registradas conservan su precio y su Pricing rule (ADR-0003).
  - Sigue las mismas reglas que cualquier tipo: una vez sin Customers se puede eliminar, y se lleva sus Customer-type prices. Desde entonces nadie recibe el VIP price, y el campo "VIP price" del formulario de precio deja de mostrarse (pricing-settings.md).
  - El campo `vip` de un Customer en la API es la pertenencia al VIP type, sea cual sea el interruptor; las pantallas lo ocultan mientras está apagado.
  - En la lista de Sales, la insignia VIP de una Sale muestra si el Customer está hoy en el VIP type, no cómo se fijó el precio de esa Sale (sales.md).
- **La marca VIP congelada** (`customer.is_vip`): se conserva con el valor que tenía, ya no se lee y nunca se vuelve a escribir para ningún Customer después de la actualización, por ningún camino (la API, la Spreadsheet import, la apertura de un Business). Un pedido que todavía manda `vip` se completa bien y el campo se ignora. Un test de arquitectura impide que el código fuera de las migraciones y de la definición de la tabla la nombre.
- **Phone country** (parte 2 de GH-682, ADR-20261111-phone-country-per-number, que reemplaza a ADR-0082): el país con el que se lee un número tipeado sin `+` ni código de país, elegido por número en el formulario del Customer. **No se guarda**: la forma internacional del número ya lo lleva. No es una configuración del Business y no está en Settings. Las reglas de cada país viven en una sola tabla compartida, `app/shared/phone_country.py`.
  - **La lista** de esta versión, decidida por el dueño el 2026-11-07, en este orden: Argentina (AR), Uruguay (UY), Chile (CL), Paraguay (PY), Brazil (BR), Mexico (MX), Spain (ES) y United States (US). Cada país tiene su propia regla con sus propios tests: código de país, largo o largos válidos del número nacional, cómo se tipea un número local (su prefijo de larga distancia y, para Argentina, el `15`), una plantilla de agrupado por largo nacional y un ejemplo de cómo lo tipea un vendedor. La lista crece de a un país sin cambiar ningún número guardado ni tocar el formulario ni el Copy module, y crecerla es trabajo aparte (#330/#318). Ningún código de país de la lista es prefijo de otro. El orden lo da un solo lugar de la tabla (`listed_countries()`), que lee `GET /phone-countries`.

    | País | Código | Largo nacional | Prefijo de larga distancia | Particularidad | Agrupado por largo |
    |---|---|---|---|---|---|
    | AR | 54 | 10 | 0 | siempre celular: agrega el `9` y descarta el `15` | 10: `## ####-####`, después de `+54 9 ` |
    | UY | 598 | 8 | 0 | | 8: `## ### ###` |
    | CL | 56 | 9 | ninguno | | 9: `# #### ####` |
    | PY | 595 | 8 o 9 | 0 | | 9: `### ######`; 8: `## ######` |
    | BR | 55 | 10 u 11 | 0 | admite un código de operadora de 2 dígitos después del 0 | 11: `## #####-####`; 10: `## ####-####` |
    | MX | 52 | 10 | ninguno | descarta el `1` de celular viejo entre el 52 y los 10 dígitos | 10: `## #### ####` |
    | ES | 34 | 9 | ninguno | | 9: `### ### ###` |
    | US | 1 | 10 | 1 | | 10: `### ###-####` |

    Solo se controlan los largos, nunca los primeros dígitos del número nacional.
  - **La tabla se valida al cargar** (`PhoneCountryRule.__post_init__`): rechaza un largo sin plantilla, una plantilla para un largo que el país no tiene, una plantilla cuya cantidad de `#` no es su largo, cualquier separador que no sea espacio o guion, y un país sin ejemplo. Los mensajes nombran la regla rota, nunca un dato. Es el único lugar que declara códigos de país, largos, reglas de prefijo, plantillas y ejemplos; ningún otro módulo, archivo del front ni texto del Copy module repite ninguno.
  - **`GET /phone-countries`** (parte 1 de GH-682), ruta protegida del hexágono de customers: responde `[{code, calling_code, national_lengths, example}]`, con los largos de menor a mayor y en el orden de la lista. No lee nada propio del Business y responde lo mismo a todo Business, pero exige una Session. Es la única fuente de la lista para el front.
  - **Lo que queda de la configuración vieja**: la columna `business.default_phone_country` sigue en la base de datos hasta la parte 3 de GH-682, pero ningún código la lee ni la escribe, y no se usa para sembrar nada: ni el Detected country ni ningún formulario parten de ella. `GET /business` ya no lleva `phone_country` ni `phone_countries`, y `PUT /business/phone-country` ya no existe.
  - **El Phone country nunca decide cómo se muestra un número guardado**: eso lo decide el código de país del propio número (abajo).
- **Detected country** (parte 2 de GH-682): el Phone country que propone el formulario por defecto, calculado solo en el dispositivo por `detectCountry(languages, timeZone, listed)` en `web/src/phone/`. Solo `web/src/phone/device.ts` lee el idioma y la zona horaria del dispositivo. No hace ninguna llamada de red, no escribe nada en el almacenamiento del navegador ni en el servidor, y nunca se envía como tal: el pedido lleva solo el país que muestra el formulario.
  - **Orden**, fijado por el pedido de la regla del dueño:
    1. la primera entrada de `navigator.languages` cuya región está en la lista (las entradas sin región se saltean);
    2. si no hay, el país de la zona horaria del dispositivo según `zoneCountries.json`, cuando está en la lista;
    3. si no, Other.
  - **`zoneCountries.json`** lo genera `scripts/phone/zone_countries.py` a partir del `zone1970.tab` de `tzdata` (o `zone.tab` si falta): cada zona va al primer país de la lista de su línea. El script lleva una lista fija de alias: `America/Buenos_Aires`, `America/Cordoba`, `America/Catamarca`, `America/Jujuy`, `America/Mendoza`, `America/Rosario`, `US/*`, `Brazil/*`, `Mexico/*`, `Chile/Continental`, `Chile/EasterIsland`, `America/Fort_Wayne`, `America/Indianapolis`, `America/Louisville` y `Navajo`.
  - **Caso conocido**: un vendedor argentino con el teléfono en `en-US` recibe United States por defecto. Lo ve en el formulario antes de guardar (criterio 29) y lo cambia con una elección (criterio 28). Se supone que los vendedores con el idioma del teléfono en una región distinta de donde venden son minoría.
  - **El formulario nunca recuerda una elección**: cada formulario nuevo parte del Detected country.
- **El país que muestra el formulario** (`shownCountry(text, picked, listed)`):
  - un texto que empieza con `+` se compara con los códigos de país servidos: un código de la lista da ese país, bloqueado; un código fuera de la lista o incompleto da Other, bloqueado;
  - si no, es el país elegido (`picked`), sin bloquear.
  - El servidor lee el `+` con la misma regla (`PhoneNumber.plus_digits`), y un archivo de casos compartido (`web/src/phone/plusCases.json`) comprueba que el front y el servidor coinciden.
- **API de escritura** (`app/customers`): `CustomerIn` y `CustomerPatchIn` llevan `phone_country: str | None`, un string simple. `register_customer` y `edit_customer` reciben el código pedido; el puerto `PhoneCountryReader` ya no existe. Las reglas, en orden:
  1. **Sin tocar** (solo al editar): un número sin cambios, o igual al guardado, se conserva y su país nunca se lee.
  2. **En blanco**: no hay número, y el país se ignora.
  3. **Con `+`**: sigue su propio código, y el país enviado se ignora aunque no exista.
  4. **Sin `+`**: con un país `null` (Other) se rechaza con `customer.phone_needs_country_code`; con un string fuera de la lista, 422 `customer.phone_country_unknown` (antes `business.phone_country_unknown`); con un país de la lista, se lee con la regla de ese país.
  - Un PATCH que manda solo `phone_country` no cambia nada.
- **Phone number**: opcional, único dentro del Business entre los Customers que tienen uno, guardado en una sola forma internacional. Se normaliza al dar de alta o editar un Customer, según estas reglas:
  - **Ninguno**: un valor faltante, `null`, o uno en blanco tras recortar significa que el Customer no tiene número. Se guarda como sin número, nunca como string vacío.
  - **Con `+` y el código de un país de la lista**: se normaliza con la regla de ese país, sea cual sea el país enviado, así coincide con el mismo número tipeado en forma local. Se rechaza si no encaja en esa regla. Por eso un `+1` no es "cualquier otro código": sigue la regla de United States (`+1` y exactamente 10 dígitos).
  - **Con `+` y cualquier otro código**: un número de un país fuera de la lista. Se acepta tal como se escribió: se guarda como `+` y sus dígitos, que deben ser de 8 a 15 y no empezar con 0 (p. ej. `+44345678` y `+443456789012345`).
  - **Sin `+`, con un país de la lista**: se quitan los separadores; los dígitos cuentan como internacionales cuando empiezan con el código de ese país y tienen uno de sus largos internacionales completos; si no, se leen como un número local de ese país: se descarta su prefijo de larga distancia (y, en Brazil, un código de operadora de 2 dígitos), y lo que queda debe tener un largo nacional válido. Se guarda como `+`, el código y el número nacional.
  - **Sin `+`, con Other**: se rechaza; solo se acepta la forma con `+`.
  - **La regla de Argentina**, exactamente la de antes:
    - `+54`, o un `54` a secas, seguido de 10 dígitos, o de un `9` y 10 dígitos, es un número argentino con su código de país, y se guarda como `+549` y los 10 dígitos;
    - cualquier otra cosa sin `+` es un número argentino local: se descartan un `0` inicial y el `15`, y deben quedar exactamente 10 dígitos, código de área incluido; se guarda como `+549` y esos 10 dígitos;
    - los teléfonos fijos no se rechazan: todo número argentino se trata como celular. Solo Argentina hace esto; los demás países aceptan cualquier número nacional de largo válido, fijos incluidos;
    - `11 2345-6789`, `011 15 2345-6789`, `+54 9 11 2345 6789`, `5491123456789` y `541123456789` pasan todos a ser `+5491123456789`.
  - **El resultado es el mismo se tipee como se tipee**, así que una grafía local y una internacional de un mismo número coinciden y la unicidad las detecta. La forma guardada, vuelta a normalizar con cualquier país o con Other, queda igual.
  - **Un número sin tocar se conserva**: si al editar un Customer el pedido manda exactamente el número que ya tiene guardado, se conserva tal cual, sin volver a normalizarlo, sin chequear la unicidad y sin rechazarlo, sea cual sea el país enviado, aunque no exista. Un número guardado que hoy ninguna regla produciría (p. ej. un `+521…` o un `+1` de otro largo) sigue cargando y se conserva así. Una grafía distinta del mismo número se vuelve a normalizar, y eso se acepta. Una escritura así nunca lee, interpreta ni valida la tabla de países ni `phone_country`. Además, el formulario de edición no manda ni `phone` ni `phone_country` cuando el texto del teléfono no cambió.
  - **Rechazado**: un valor no en blanco que no encaja en ninguna regla (demasiado corto, demasiado largo, sin código de área, o sin `+` con Other). Cada rechazo tiene su `code` en `contract.json` y nunca repite lo que se escribió ni el nombre:
    - `customer.phone_needs_country_code`: solo para un número sin `+` con Other; dice "Start the number with + and the country code.";
    - `customer.phone_country_unknown`: un país enviado fuera de la lista para un número sin `+`; el formulario no puede llegar a él, y en pantalla es el error genérico;
    - `customer.phone_invalid`: cualquier otro número que no encaja. En pantalla, con un país de la lista, el formulario dice "That doesn't look like {adjective} number. It needs {lengths} digits after the country code." (el adjetivo lleva su artículo, p. ej. "an Argentine", "a Uruguayan"); con Other dice "Enter the number with its area code, or start with + and the country code.".
- **Número agrupado para leer** (parte 1 de GH-682, `PhoneNumber.display`): cómo se muestra un número guardado, calculado del valor guardado cada vez que se lee, nunca guardado, nunca calculado en una escritura y sin migración.
  - **Lo decide el código de país del propio número**, nunca el país con que se tipeó: un número uruguayo se ve agrupado a la uruguaya en cualquier Business.
  - Se busca el país por su código, se quita el código (y, en Argentina, el `9` de celular) y se aplica la plantilla del largo nacional que queda, con `+`, el código y un espacio adelante (`+54 9 ` en Argentina).
  - **Solo agrega espacios y guiones**: sin ellos, el número mostrado es exactamente el guardado.
  - **Lo que no encaja se muestra tal cual**: un código fuera de la lista, un número argentino sin el `9` de celular, o un largo sin plantilla, devuelve el valor guardado sin cambios, nunca oculto, cortado ni alterado.

    | Guardado | Se muestra |
    |---|---|
    | `+5491123456789` | `+54 9 11 2345-6789` |
    | `+59899123456` | `+598 99 123 456` |
    | `+56912345678` | `+56 9 1234 5678` |
    | `+595981123456` | `+595 981 123456` |
    | `+59521123456` | `+595 21 123456` |
    | `+5511912345678` | `+55 11 91234-5678` |
    | `+551112345678` | `+55 11 1234-5678` |
    | `+525512345678` | `+52 55 1234 5678` |
    | `+34612345678` | `+34 612 345 678` |
    | `+12125551234` | `+1 212 555-1234` |
    | `+59312345678` (código fuera de la lista) | `+59312345678` |
    | `+5212345` (largo sin plantilla) | `+5212345` |

  - **API**: cada Customer de la lista y del detalle (y de las respuestas de alta y edición, que pasan por el mismo armado) lleva `phone_display` (el número agrupado, o `null` sin número). `docs/api/openapi.json` y `tests/fixtures/openapi_snapshot.json` se regeneran en el mismo cambio que cualquier cambio de ruta o esquema.
  - El front nunca agrupa un número por su cuenta: muestra `phone_display` tal como llega, y no tiene formateador propio.
- **Unicidad**: un número ya usado por otro Customer del mismo Business se rechaza (`customer.phone_taken`, "That phone number already belongs to another customer."), tanto al registrar como al editar, se haya tipeado en forma local o internacional y con el país que sea. El rechazo nunca repite el número ni el nombre. Cualquier cantidad de Customers puede no tener número. Los números de otros Businesses nunca chocan y nunca se revelan.
- **Edición**: nombre, Phone number y Customer type (el tipo solo mientras Customer types está activado).
  - El Phone number pasa por la misma normalización, el mismo chequeo de unicidad y el mismo rechazo que al registrar, salvo el número guardado mandado sin tocar, que se conserva (arriba).
  - Se puede borrar, y el Customer queda sin número.
  - El país de un número guardado se corrige editando el número; no hay un control para cambiar solo el país.
  - Las Sales, los Payments y el Balance pertenecen al Customer, no al número, así que siguen asociados cuando este cambia o se quita.
- **Lista y búsqueda**: una sola consulta. El país no la cambia: la búsqueda compara con los dígitos guardados, así que una grafía local tipeada en la búsqueda no se normaliza.
  - El nombre coincide con la consulta en cualquier parte, sin importar mayúsculas ni acentos.
  - El número coincide con los dígitos de la consulta, sin un 0 inicial, en cualquier parte de los dígitos del número guardado. Un Customer sin número nunca coincide por número, y una consulta sin dígitos no coincide con ningún número.
  - Un Customer coincide si coincide el nombre o el número; un Customer sin número se encuentra por nombre.
  - Una consulta vacía devuelve todos los Customers.
  - Los resultados se ordenan por nombre.
  - No hay paginación, ni largo mínimo de consulta, ni filtro VIP ni por tipo, ni filtro para los Customers sin número.
- **Almacenamiento**: la columna del teléfono admite nulos; la unicidad dentro de un Business se aplica solo a los números guardados. Los Customers que existían antes de que el número fuera opcional conservaron sus números. La columna del canal se elimina con una migración en la cadena única de Alembic; todas las demás columnas y el nombre, el número, el VIP, las Sales, los Payments y el Balance de cada Customer quedan exactamente como estaban.
- **Migración del Phone country** (revisión `0029`, con `down_revision` `0028`, GH-409): agregó la columna nula `business.default_phone_country` (dos letras, sin valor por defecto) y la completó con `AR` para cada Business existente, sin cambiar el valor de ninguna columna que ya existía. Desde la parte 2 de GH-682 nadie la lee; la quita la parte 3.
- **Migración de los Customer types** (revisión `0020`, ADR-0059): agrega la tabla `customer_type` y la columna nula `customer.customer_type_id`, y nunca cambia el valor de una columna que ya existía.
  - Cada Business existente recibe un tipo "VIP" con el ícono `star`: su VIP type. Lo recibe incluso sin ningún VIP customer, así puede seguir dando el VIP price.
  - Solo los Customers con la marca VIP reciben ese tipo; ningún otro Customer recibe tipo.
  - La marca VIP queda guardada tal cual. El comparador M3 compartido de `tests/migrations/` lo prueba.
- **Spreadsheet import** (import.md): sigue leyendo los números de la planilla como argentinos (`register_imported_customer` pasa Argentina de forma explícita), y nunca lee ni fija ningún país del Business. Un VIP de la planilla entra al VIP type de ese Business; nunca escribe la marca congelada.
  - Si el Business ya tiene su VIP type, lo usa, se llame como se llame hoy.
  - Si la planilla tiene al menos un VIP y el Business no tiene VIP type, la Spreadsheet import lo crea con el nombre "VIP", antes de escribir las Price entries, así sus VIP prices se guardan como Customer-type prices de ese tipo.
  - **Si en ese caso el Business ya tiene un tipo propio del vendedor llamado "VIP"** (sin importar mayúsculas ni espacios), la Spreadsheet import se detiene antes de escribir nada y le dice al Operator, con un texto fijo del Copy module en su terminal, que ese tipo existe y hay que renombrarlo o eliminarlo antes de volver a correrla. Nunca toma el tipo del vendedor como VIP type ni crea el VIP type con otro nombre. No es una **Unfinished row**: es un chequeo sobre el Business, previo a toda escritura, y no nombra ningún Customer ni monto.
- **Business export** (accounts.md, ADR-0015): las tablas de Customers y de Customer types siguen el esquema por reflexión, así que los Business exports nuevos y el registro de tablas y columnas de la **Business removal** llevan los Customer types, sus Customer-type prices y la pertenencia, y no llevan canal. El encabezado del Business (`{id, name, language, default_phone_country}`, más `last_sale_number` cuando el Business lo lleva) se lista a mano y sigue llevando `default_phone_country` mientras la columna exista (hasta la parte 3 de GH-682); un test que refleja la tabla `business` exige que el encabezado lleve cada una de sus columnas. Los Business exports escritos antes del cambio conservan lo que tenían; nada importa un Business export de vuelta. Las cantidades exportadas siguen siendo iguales a las eliminadas. El número agrupado no se exporta: es una cifra calculada.
- **Aislamiento (ADR-0004)**:
  - El Business sale de la **Session**; el país de un número sale del pedido y nunca de otro Business.
  - El Customer de otro Business responde 404 tanto al leer como al editar; el Customer type de otro Business responde 404 al leer, renombrar, cambiar el ícono, eliminar y asignar.
  - Las listas y búsquedas no muestran ninguno de los Customers ni de los Customer types de otro Business, y un Customer-type price de otro Business nunca cotiza una línea.
  - Las rutas de Customer, de Customer type (`/api/customer-types`) y `GET /phone-countries` están en `tests/test_business_isolation.py` y en el test de rutas protegidas.
- **Sin eco**: ningún error, línea de log ni mensaje en pantalla repite un número.

### En pantalla: Customers

- **Customers** es una Tab root (navigation.md). En una computadora son dos paneles: la lista a la izquierda, la ficha del Customer seleccionado a la derecha. Customers no selecciona nada por su cuenta.
- **La pantalla se abre con dos secciones**, sin ninguna cifra de deuda tocable en su cabecera:
  1. **"Owed to you"**, arriba: el Total owed, la línea de cantidad ("1 sale owing" o "N sales owing"), y todo Customer cuyo Balance es mayor que $0, con el Owing since más viejo primero, los empates por nombre, cada fila con "Collect" (`payments.md`). Si nadie debe, dice un "Nobody owes you" fijo, sin nada para tocar, arriba de la lista completa de la A a la Z.
  2. **Everyone, A–Z**, abajo, ordenados por nombre.
- Toda cifra de Owed to you sale de la API y es igual al bloque "Owed to you" de Home; el navegador no calcula nada.
- **Toda fila de quien debe**, en cualquiera de las secciones y en los resultados de búsqueda, muestra el monto en ámbar con "owes you since dd/mm" debajo, nunca como chip, y un botón "Collect" (nombre accesible "Collect from <name>") que abre Record payment con ese Customer ya elegido, como un paso más en el historial de la app; volver o "Close" lo deja en un solo movimiento. Tocar el resto de la fila abre la ficha del Customer.
- **Quien tiene Credit** nunca aparece en Owed to you y no cuenta en ninguna cifra. En todos de la A a la Z muestra "Credit $ X" con el tratamiento neutro/azul, nunca verde ni ámbar.
- **Quien tiene un Balance de $0** no muestra nada sobre dinero.
- **El número en la fila** (`ClienteFila`, en Customers y en la lista de la tarjeta de atrás) es el número agrupado (`phone_display`), o el guardado tal cual cuando no encaja en ninguna plantilla. Las filas de "Owed to you" siguen sin número, como antes.
- **Quien no tiene número** no muestra nada en el lugar del número: ni guion, ni etiqueta vacía, ni "No phone".
- **La marca VIP** se muestra en las filas de la lista y en Pick a customer solo mientras Customer types está activado, y dice si el Customer está en el VIP type; nunca muestra el nombre ni el ícono de un tipo. Mientras está apagado, no se muestra nada en su lugar. Las filas no muestran el Customer type.
- **Búsqueda** por parte del nombre o del Phone number: mientras se escribe una consulta, las dos secciones se colapsan en una sola lista plana ordenada por nombre, con las coincidencias como arriba; un Customer que debe conserva su Balance, "owes you since dd/mm" y "Collect". Borrar la consulta trae de vuelta las dos secciones.
- **La ficha de un Customer** (`ClienteFicha`), una tarjeta con "‹ Customers":
  - teléfono, agrupado según el país de su propio código (p. ej. `+54 9 11 2345-6789`, `+598 99 123 456`), o tal como está guardado cuando su código no está en la lista o su largo no tiene plantilla; solo cuando hay uno (sin ninguno, la línea se omite por completo);
  - debajo, en su propia línea, su Customer type: primero el ícono y después el nombre (solo mientras Customer types está activado y el Customer tiene uno; sin tipo, la línea se omite). El tipo reemplaza el antiguo bloque "VIP / No";
  - "Owes you $ X since dd/mm" o "Credit $ X" (ninguno para un Balance de $0), la cuenta, "Record payment" solo cuando el Balance es mayor que $0, y "Delete payment" en los Payments posteriores (`payments.md`);
  - **"New sale to <name>"**, que abre New sale con ese Customer ya elegido (sales.md). La ficha no muestra "+ New sale".
  - Agregar un número más adelante es la edición ordinaria de la ficha; no hay ningún aviso para completarlo.
- **La tarjeta de atrás** (`CustomerCardBehind`) muestra el mismo número agrupado que la ficha, en el mismo campo con etiqueta.
- **Los selectores de Customer de New sale** (el selector de `NuevaVenta` y el paso de Customer de `NuevaVentaCliente`) muestran junto a cada nombre el mismo número agrupado. Nada más cambia en ellos: ni su búsqueda, ni su orden, ni lo que se elige.
- **El número nunca se corta**: en los cinco lugares se muestra en una sola línea, sin puntos suspensivos, con la tipografía, el tamaño, la posición y el color que ya tenía la línea del número. Es texto seleccionable, no un control.
- **El número se copia tal como se ve**, con sus espacios y guiones; no hay botón para copiar, ni link para llamar o escribir, ni copia de solo dígitos.
- **Record payment** (`Payment`) sigue payments.md sin cambios y su diseño, `Cobro.dc.html`, abierto con el Customer elegido desde una fila de deudor o desde la ficha.
- **Alta y edición** (`ClienteForm`, el formulario "New customer" dibujado en `NuevaVentaCliente` y `ClienteNuevo`): el mismo formulario al dar de alta desde Customers y al editar desde la ficha. Los campos de nombre, país y teléfono son los de `CustomerFields`, compartidos con el creador de "Pick a customer".
  - Sus campos son "Name" (el único marcado como obligatorio), "Phone country", el teléfono (opcional, y se puede borrar al editar) y "Customer type". El antiguo interruptor VIP ya no está. No hay campo de canal.
  - **"Phone country"** (parte 2 de GH-682) es un Selector obligatorio (selector.md), con búsqueda, sobre la lista que sirve `GET /phone-countries`; no es una lista incorporada y no tiene fila para borrar.
    - Sus opciones son los ocho países servidos, en su orden, como "Name (+code)", con el "(+code)" en un span de cifras sin corte de línea, y después "Other (type + and the code)". Los nombres de los países son texto del producto en el Copy module, con la clave de su código ISO; los códigos salen de la lista servida.
    - En el celular (menos de 900 px) va arriba del teléfono, a todo el ancho; en la computadora va al lado del teléfono, con un ancho fijo de 240 px, y el teléfono toma el resto de la fila.
    - **Al dar de alta**, la detección corre una sola vez cuando la lista resuelve, y solo si no se eligió nada y el teléfono no tiene `+`: el campo muestra el Detected country. El formulario nunca recuerda una elección.
    - **Al editar** un Customer con número, el país sale del código del número guardado y el campo se abre bloqueado (Other para un código fuera de la lista). Al editar uno sin número, se comporta como un alta: la detección corre una vez.
    - **Con un `+` en el teléfono**, el campo está bloqueado (ver el estado "Bloqueado" de selector.md) con la línea de motivo visible "The + and the code set the country": un código de la lista muestra ese país, uno fuera de la lista o incompleto muestra Other. Borrar el `+` lo desbloquea y conserva el último país mostrado.
    - Lo tipeado en el teléfono nunca se reescribe.
    - **Mientras `GET /phone-countries` está pendiente o falló**, el campo está en `loading` (con su esqueleto, nunca un país supuesto) y "Save" está deshabilitado. Sin la lista, el formulario no puede mostrar el país que va a usar. Si la carga falla, debajo de los campos se muestra la línea de falla que ya tiene la app: "No connection" sin red, o el error genérico ante un error del servidor, con el Attention icon y sin ningún texto nuevo. No hay un botón para reintentar: la lista se vuelve a pedir al cerrar el formulario y volver a abrirlo. En "Pick a customer", elegir un Customer existente o "No customer" sigue dejando avanzar la Sale.
    - El pedido manda el código del país mostrado, o `null` con Other.
  - **El teléfono** acepta el número tal como lo dice el vendedor en el país mostrado; después de guardar se muestra agrupado según el país de su propio código.
  - **El ejemplo del teléfono** (su placeholder) es el `example` servido del país mostrado; con Other, "+ and country code, then the number" (el único que vive en el Copy module). Ningún texto del Copy module dice un largo, un código de país ni un ejemplo; las claves `phoneHint<XX>` ya no existen. Mientras la lista no cargó, o si falla, el campo no muestra ningún ejemplo, nunca uno equivocado.
  - Al editar, el teléfono muestra el número internacional guardado tal cual, sin agrupar (p. ej. `+5491155550101`), y si no se toca, el pedido no lo manda.
  - Un número local con Other se rechaza al guardar; hasta entonces lo guía el ejemplo. No hay aviso en línea previo.
  - El creador de "Pick a customer" dentro de New sale (`NuevaVentaCliente`) usa los mismos campos de nombre, país y teléfono, sin "Customer type"; el Customer creado ahí no tiene tipo, y ese Customer se usa para la Sale. La lista de Phone countries se abre ahí por encima del creador, y la Sale y el creador de abajo quedan inertes mientras está abierta.
  - **"Customer type"** se muestra solo mientras Customer types está activado. Desde la parte 6 de GH-581 es un Selector opcional (selector.md) sobre los tipos del Business:
    - cada opción muestra el nombre del tipo con su glifo (`glyphOf(type.icon)`) delante;
    - sin tipo elegido, el campo dice "No type" y la lista no tiene fila para borrar ni una fila "No type" repetida;
    - con un tipo elegido, la primera fila de la lista es la fila para borrar, "No type", que deja al Customer sin tipo;
    - con más de 8 tipos, la lista tiene búsqueda;
    - en el celular, la lista se abre en una Sheet como su propia entrada del historial sobre el formulario (dentro de un `SheetStackProvider` montado en la raíz de `ClienteForm`); volver o "Close" con la lista abierta cierra solo la lista, nunca el formulario. En la computadora es un desplegable con teclado, y Escape cierra solo el desplegable.
  - **Mientras los tipos se están cargando**, o después de una carga fallida, el campo está presente y cargando (deshabilitado, con su esqueleto), sin "No type" ni el aviso, porque todavía no se sabe si hay tipos. Guardar igual funciona (salvo que lo frene la lista de países, arriba) y conserva el tipo que tiene el formulario, sin borrarlo por la carga fallida.
  - **Si la carga de los tipos falla**, debajo del campo se muestra la línea de falla que ya tiene la app: "No connection" sin red, o el reintento genérico ante un error del servidor (accounts.md), con el Attention icon y asociada al campo como su descripción, sin ningún texto nuevo. Los tipos no se vuelven a pedir solos (ni al recuperar la conexión ni al volver a la ventana) y la línea no ofrece reintentar con un toque: se vuelven a pedir al salir del formulario y volver a abrirlo. Cuando los tipos llegan, la línea desaparece y el campo pasa a ser el Selector, o el aviso si no hay ninguno.
  - **Sin ningún tipo en el Business** (una vez que la carga respondió con éxito), el campo muestra, en lugar del Selector, el **Tappable notice** "Add a customer type", que lleva a Settings → Prices → Customer types; el Customer queda sin tipo. Desaparece en cuanto existe al menos un tipo. Los tipos se crean solo en Settings; el vendedor vuelve al formulario por el camino de vuelta habitual, sin el tipo nuevo preelegido.
  - Ir a Settings desde el aviso sale del formulario: con cambios sin guardar, se pide la confirmación habitual de descartar, y lo que se escribió se pierde.
  - Si al guardar el tipo elegido ya no existe, un error en línea bajo el campo, asociado al campo como su descripción, dice "That type no longer exists. Pick another one.", la elección vuelve a "No type" (sin la marca "no longer available") y el vendedor elige de nuevo. El campo se asocia a un solo mensaje por vez: este rechazo o, si no lo hay, la línea de carga fallida.
  - Es un formulario: "Close", y una confirmación al salir con cambios sin guardar. Un formulario sin tocar se cierra de inmediato y vuelve a la pantalla madre.
- **Si sale bien**, el toast "Customer saved". Nunca lleva un nombre ni un número.
- **Los rechazos** se muestran en línea sobre el campo, con el string fijo del dominio, y conservan lo que se escribió. Nunca repiten el número ni el nombre. Un número rechazado (`customer.phone_invalid`, `customer.phone_needs_country_code`, `customer.phone_country_unknown` o `customer.phone_taken`) muestra su mensaje bajo el teléfono, tanto en el formulario de Customers como en el "New customer" de una Sale, con el error de campo de siempre (`campo__error`, anunciado con `role="alert"`). El de `customer.phone_invalid` con un país de la lista dice "That doesn't look like {adjective} number. It needs {lengths} digits after the country code.": el adjetivo del país, con su artículo, vive en el Copy module con la clave de su código ISO, y `{lengths}` sale del `national_lengths` servido, unido con comas y "or" antes del último; con Other, el texto genérico de siempre.
- **Cómo se dibuja el ícono de un tipo**: en la lista de Customer types y en el selector de íconos, con los glifos del componente `Icono`; en la lista del Selector del formulario y en la ficha, con un símbolo de texto por clave (`glyphOf`). Para algunas claves (Bell, Tag) los dos dibujos no coinciden; unificarlos queda para una tarea posterior.
- **Diseño**: Customers, `ClienteFicha`, `Payment` y `NuevaVentaCliente` coinciden con `docs/product/design-system/pantallas/` en celular y computadora, en los dos temas. Donde el dibujo muestra el número en forma nacional (`11 2345-6789`), gana la definición escrita: el número agrupado con su código. El campo "Customer type" se muestra cerrado como Selector, diciendo "No type", en el bloque "Nuevo cliente" de `ClienteNuevo`, que dibuja ClienteNuevo, ClienteNuevoCompu, ClienteEditar y ClienteEditarCompu. El dibujo no tiene el Selector "Phone country": las filas `NuevaVentaCliente*` y las del formulario se juzgan a ojo contra esta definición (Drawing as guide). Una diferencia de texto respecto de los docs se lista en el PR. Ningún estado se dice solo con color.
- **Respuesta de la app**: sin red muestra "No connection", un error del servidor el reintento genérico, y un Customer o un Customer type que ya no existe sigue la regla "That is gone." de accounts.md.

![Customers en el teléfono](../assets/screens/Clientes.webp)

![Ficha de un Customer en el teléfono](../assets/screens/ClienteFicha.webp)

![Pick a customer de New sale en el teléfono](../assets/screens/NuevaVentaCliente.webp)

![Alta de un Customer en el teléfono](../assets/screens/ClienteNuevo.webp)

![Edición de un Customer en el teléfono](../assets/screens/ClienteEditar.webp)

### En pantalla: Settings → Business, sin Phone country

- Desde la parte 2 de GH-682, el grupo Business de Settings (`/settings/business`) ya no tiene el campo "Phone country" ni su línea de ayuda; sus textos (la etiqueta, la línea de ayuda, "No country", la confirmación y los errores) salen del Copy module y de `en-XA`. El resto del grupo queda como lo define accounts.md.

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
- **Eliminar**: un toque en el tacho. Un tipo vacío, el VIP type incluido, se elimina sin confirmación, junto con sus Customer-type prices. Un tipo con Customers no se elimina y nada cambia: un aviso ámbar con el ícono de atención dice "1 customer is in this type. Move that customer to another type first." o "N customers are in this type. Move them to another type first.". No hay movimiento en bloque: se cambia un Customer a la vez desde su formulario.
- Las rutas de `/api/customer-types` responden igual con el interruptor encendido o apagado; es la pantalla la que se oculta.
- Todo texto vive en el **Copy module**, los nombres accesibles de los íconos incluidos, y ningún valor por defecto nuevo lleva una palabra de flor.

## Métricas

- **Números duplicados**: Customers que comparten un número guardado dentro de un Business, 0. Una restricción de la base de datos lo impone y un test lo cubre. (Criterio 2)
- **Sin choque sin número**: dos o más Customers sin número coexisten en un Business, probado. (Criterios 2, 5)
- **Matriz de normalización**: toda forma equivalente se resuelve en un solo número, toda forma inválida no en blanco se rechaza, y un valor en blanco se guarda como sin número. 100% aprobada. (Criterios 2, 6)
- **Matriz por país (criterios 19, 22)**: para cada uno de los ocho países, en tests de dominio, las formas local con y sin prefijo de larga distancia, con espacios o guiones, con el código sin `+` y con `+` se resuelven en un solo número guardado, y toda forma inválida no en blanco se rechaza; la forma guardada, vuelta a normalizar con cada país y con Other, queda igual; y un test de propiedades por país muestra que una cadena sin `+` que se lee a la vez como internacional y como local da el mismo resultado. 100% aprobada.
- **La tabla de países**: un test muestra que cada código de país aparece una sola vez, que ninguno es prefijo de otro, que todo país tiene al menos un largo y que ninguno es prefijo de `44`. Tests de dominio cubren cada rechazo de `__post_init__` (un largo sin plantilla, una plantilla para un largo que no existe, una plantilla con otra cantidad de `#`, otro separador, un país sin ejemplo), que las plantillas de una regla no se pueden modificar, y que `PhoneNumber.of(example, country)` acepta el ejemplo de cada país.
- **El `+1` y los otros códigos**: los casos de "cualquier otro código" usan `+44345678` y `+443456789012345`, aceptados tal cual; `+12345678` y `+123456789012345` se rechazan, `+1` con 10 dígitos se acepta y da lo mismo que su forma local.
- **Sin duplicado entre grafías (criterio 20)**: para cada país, tests con TestClient registran un número en forma local con su país y después en forma internacional (y al revés, también al editar), y el segundo se rechaza como ya usado: 0 Customers que comparten número.
- **Las reglas de escritura del país (criterios 19, 22, 29)**: `tests/customers/test_customers_phone_country_api.py`, con TestClient, al registrar y al editar, cubre la forma local de cada país con su código; el `+` que manda sobre el país enviado; un número sin tocar con un país inexistente, que se guarda sin cambios; un número en blanco; `null` (Other) con un número local, que responde 422 `customer.phone_needs_country_code`; un país fuera de la lista, que responde 422 `customer.phone_country_unknown`; la unicidad entre grafías; y la búsqueda por dígitos. Un PATCH con solo `phone_country` no cambia nada: 100%.
- **El `+` igual en el front y en el servidor**: `tests/customers/test_phone_plus_parity.py` y su par de vitest leen los mismos casos de `web/src/phone/plusCases.json`, y `PhoneNumber.plus_digits` y `shownCountry` coinciden en todos.
- **Ningún número guardado cambia (criterio 21)**: quitar `PUT /business/phone-country` y el campo de `GET /business` no toca ninguna fila de Customer; la matriz argentina existente pasa sin aflojar ninguna aserción.
- **El Detected country (criterio 27)**: tests unitarios de `detectCountry` cubren la región de idioma primero, la entrada sin región salteada, la zona horaria como alternativa, una zona alias y Other; espían `fetch` y el almacenamiento del navegador y no encuentran ninguna llamada ni escritura. Un barrido del código falla si un archivo de `web/src` fuera de `web/src/phone/` lee el idioma o la zona horaria del dispositivo. `tests/customers/test_zone_countries.py` falla si a `zoneCountries.json` le falta una zona de `tzdata` de alguno de los ocho países o si un valor no es un `PhoneCountry`: 0 faltantes.
- **El país mostrado y el bloqueo (criterios 28, 29)**: tests unitarios de `shownCountry` cubren un código de la lista (bloqueado), uno fuera de la lista y uno incompleto (Other, bloqueado), y un texto sin `+` (el elegido, sin bloquear). Tests de Testing Library muestran:
  - que tipear "+598…" deja Uruguay bloqueado y manda UY;
  - que borrar el `+` conserva Uruguay, y que elegir Argentina manda AR;
  - que editar sobre "+598…" abre bloqueado y que un Save sin tocar no manda ni el número ni el país;
  - que editar muestra cada uno de los ocho países;
  - que editar un Customer sin número corre la detección;
  - que "Save" está deshabilitado mientras carga la lista, y que una carga fallida muestra la línea de falla;
  - que el ejemplo sigue al Selector;
  - que el rechazo nombra el país y los largos, y con Other muestra el texto genérico.

  100% aprobada.
- **Desde el celular (criterios 27, 28, 29)**: `web/e2e/phoneCountry.spec.ts` corre en su propio proyecto de Playwright (`phone-country-uy`) con `es-UY` y `America/Montevideo` en 390×844:
  - da de alta un Customer uruguayo tipeando `099 123 456` sin tocar el Selector y lo ve en su ficha como `+598 99 123 456`;
  - da de alta uno argentino eligiendo Argentina y tipeando la forma local;
  - tipea un número con `+` y ve el Selector bloqueado;
  - edita cada uno y ve su propio país;
  - abre Settings → Business y no encuentra Phone country.
- **El país no agrega toques (criterio 30)**: en `web/e2e/tapBudget.spec.ts`, el presupuesto de toques para dar de alta un Customer y para una Sale con un Customer nuevo desde "Pick a customer" no crece con un número local del Detected country (0 toques más), y otro país agrega exactamente los 2 toques del Selector; su duración no la mide ningún test.
- **El número sigue opcional (criterio 31)**: tests del front y de la API registran un Customer sin número con la lista de países cargada, sin tocar el Selector; la corrida end-to-end existente del ciclo sin número pasa sin cambios.
- **El Mobile check del formulario**: el chequeo `mobile` recorre `customer/country-selector-open`, `customer/country-selector-loading` (con la API retenida), `customer/country-selector-locked` ("+598 99 123 456") y `sale/customer-country-selector-open` (la lista abierta dentro de "Pick a customer") sin infractores nuevos y sin entradas nuevas en las listas de infractores.
- **La tabla de agrupado, exacta (criterio 23)**: tests de dominio comparan carácter por carácter las 10 filas de la tabla de agrupado: 10/10.
- **Lo que no encaja, tal cual (criterio 24)**: `+59312345678`, `+5212345` y un número generado de cada país con un largo sin plantilla vuelven exactamente como están guardados: 100%.
- **Solo separadores (criterio 25)**: un test parametrizado comprueba que quitar " " y "-" del número mostrado da el valor guardado, para cada fila de la tabla, cada caso que no encaja y un número generado por país y largo: 100%. Las suites de escritura de Customers pasan sin aflojar ninguna aserción.
- **Igual en los cinco lugares (criterio 23)**: tests del front muestran `phone_display` en la fila de Customers, la ficha, la tarjeta de atrás, el selector de New sale y el paso de Customer de New sale: 5/5. Ningún archivo del front agrupa un número por su cuenta.
- **El país con que se tipeó nunca decide el agrupado (criterio 23)**: un test con TestClient devuelve el mismo `phone_display` para un número uruguayo registrado con `+` y registrado en forma local con UY.
- **El agrupado no pide nada (criterio 26)**: un Customer sin número tiene `phone_display: null`, y los tests del front no muestran línea de número para él.
- **El contrato**: tests con TestClient cubren `phone_display` en la lista y el detalle, la forma y el orden de `GET /phone-countries`, igual para dos Businesses, y que `GET /business` ya no lleva `phone_country` ni `phone_countries`; `PUT /business/phone-country` responde como una ruta inexistente. `docs/api/openapi.json` y `tests/fixtures/openapi_snapshot.json` están regenerados, y el PR lleva su línea `Breaking-API:` (ADR-0066).
- **Una sola fuente de las reglas de cada país**: ningún archivo del front ni texto del Copy module dice un largo, un código de país ni un ejemplo; un barrido del Copy module falla ante dígitos de un código o un largo en las claves del teléfono, y otro exige un nombre y un adjetivo no vacíos para cada país servido, en inglés y en `en-XA`. Las claves `phoneHint<XX>` y `web/src/api/phoneCountry.ts` ya no existen.
- **Sin eco**: ningún cuerpo de rechazo, línea de log ni toast contiene el número enviado, ninguna de sus secuencias de dígitos, el nombre de un Customer ni el nombre de un Customer type. Después de una corrida completa del front, la consola y el almacenamiento del navegador no tienen ningún nombre, número, monto ni país detectado. (Criterios 2, 6, 17)
- **Rechazos del número**: tests cubren `customer.phone_invalid` (por país y con Other), `customer.phone_needs_country_code` y `customer.phone_country_unknown`, en el formulario de Customers y en el "New customer" de una Sale, cada uno con su `code` en `contract.json` y `refusalKeys.json`, verificado por `tests/test_refusal_codes.py`.
- **Cobertura de aislamiento**: toda ruta de Customer, de Customer type y `GET /phone-countries` está en el barrido de aislamiento y en el test de rutas con acceso restringido; las de Customer y de Customer type responden 404 o vacío desde otro Business, y `GET /phone-countries` responde lo mismo a todo Business, sin ningún dato propio; asignar un tipo de otro Business responde 404; el barrido siembra Customer-type prices del otro Business. (Criterios 3, 15)
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
- **El Business export y la columna vieja**: el encabezado del Business lleva `default_phone_country` mientras la columna exista, y un test que refleja la tabla `business` exige que lleve cada una de sus columnas.
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
  - para cada VIP customer de antes, el precio por gramo, el total y la insignia mostrada de una Sale nueva son iguales antes y después de la actualización y de la migración de los Customer-type prices, por el mismo Product, día y gramos: 0 diferencias;
  - un Customer que entra al VIP type recibe el VIP price en su próxima Sale y uno que sale deja de recibirlo; un tipo creado por el vendedor llamado "VIP" no da nada; un VIP type renombrado sigue dando el VIP price;
  - las Sales, las Price entries, los Balances y los Settlements registrados quedan sin cambios: 0 diferencias.
- **Reglas de los tipos**: tests de la API cubren crear, renombrar y cambiar el ícono; el rechazo de un nombre en blanco, de más de 40 caracteres y repetido sin importar mayúsculas ni espacios (también al renombrar); el rechazo de un ícono desconocido; que un `is_vip` enviado se ignora; el rechazo de eliminar un tipo con Customers, que lleva la cantidad y conserva sus Customer-type prices; y eliminar un tipo vacío, el VIP type incluido, que deja 0 Customer-type prices suyos mientras las líneas registradas conservan su copia del nombre. Cada rechazo tiene su `code` en `contract.json`, verificado por `tests/test_refusal_codes.py`.
- **Formulario del tipo**: los tests del front muestran que el tipo se elige, se cambia y se quita con la fila "No type"; que el interruptor VIP ya no está; que "Add a customer type" aparece solo sin tipos y lleva a Settings → Prices → Customer types.
- **El tipo con el Selector (criterios 16, 17, 18)**, en los tests del front:
  - con 12 o más tipos sembrados, el Selector está presente y no hay ningún `<select>`, grupo de radios ni botón `aria-pressed` para el campo; tipear parte de un nombre en la búsqueda encuentra el tipo y tocarlo lo elige;
  - sin tipo elegido, la lista no tiene fila para borrar; con un tipo elegido, la fila para borrar deja "No type";
  - sin tipos, se muestra el aviso; mientras los tipos se cargan y después de una carga fallida, no se muestra "No type", ni el aviso, ni ningún texto de conjunto vacío;
  - con la carga fallida, la línea de falla existente aparece bajo el campo, asociada como su descripción, guardar conserva el tipo que tenía el formulario, y al volver a abrir el formulario con la carga exitosa la línea desaparece y queda el Selector, o el aviso si no hay tipos;
  - el rechazo por un tipo que ya no existe vuelve la elección a "No type" y muestra su línea;
  - al dar de alta y al editar: formulario sin tocar, volver va a la pantalla madre; con cambios sin guardar, volver pide la confirmación de descarte; con la lista abierta, volver cierra solo la lista; en la computadora, Escape cierra solo el desplegable.

  El chequeo `mobile` recorre el estado `customer/type-selector-open` sin infractores nuevos. 100% de aprobación.
- **La marca congelada**: después de la actualización, ningún camino de escritura (API, Spreadsheet import, apertura de un Business) cambia `customer.is_vip`, probado con un registro de sentencias que no encuentra ningún INSERT ni UPDATE que la nombre; el test de arquitectura de columnas congeladas no encuentra ningún módulo fuera de las migraciones y de la definición de la tabla que la nombre.
- **Spreadsheet import y el VIP type**: tests del import cubren que los VIP de la planilla entran al VIP type existente aunque esté renombrado; que sin VIP type se crea uno; y que sin VIP type y con un tipo del vendedor llamado "VIP" (también " vip ") el import se detiene con su texto fijo y deja 0 filas nuevas en todas las tablas.
- **Spreadsheet import y el país**: tests del import muestran que lee `011 15 …` como `+549…` en cualquier Business, y que no lee ni escribe `business.default_phone_country`.
- **Textos**: todo texto nuevo está en el Copy module, `en-XA` está regenerado, las claves de Settings → Business → Phone country ya no existen, y ningún valor por defecto nuevo lleva una palabra de flor.
- **Sin regresiones**: las suites existentes de customers, payments y navigation pasan sin aflojar ninguna aserción.
- **Sin curl**: la corrida end-to-end del front agrega, encuentra y edita un Customer, agrega uno sin número, le asigna un tipo, abre Record payment desde "Collect" con el Customer elegido, y abre "New sale to <name>" con ese Customer elegido. (Criterio 4)
- **Diseño**: `scripts/design/compare.sh` se corre antes y después para Customers, `ClienteFicha`, `Payment`, `NuevaVentaCliente`, `ClienteNuevo`, Settings → Prices y Settings → Business, celular y computadora, claro y oscuro donde el registro tiene los dos, adjunto al PR y juzgado a ojo, con cada diferencia respecto del diseño listada. El lado construido de la captura usa `es-AR` y `America/Argentina/Buenos_Aires`, para que el Detected country sea siempre el mismo. La lista y el formulario de Customer types y el Selector "Phone country" no tienen dibujo y se juzgan contra el diseño escrito; la tarjeta de atrás tampoco tiene dibujo. Las Screen images `ClienteNuevo` y `ClienteEditar` se vuelven a generar.
- El Balance, la cuenta y las métricas de cifras de Owed to you viven en `payments.md`.

## Fuera de alcance

- Eliminar un Customer: va a tener Sales y Payments.
- Unificar duplicados; importar desde la planilla (import.md).
- Una nueva clave única para los Customers.
- Un filtro VIP o por tipo, o agrupar por tipo; un filtro, lista, insignia, orden o aviso para los Customers sin número.
- Mostrar el nombre o el ícono del Customer type en las filas de Customers, en Pick a customer o en Sales.
- Crear un Customer type desde el formulario del Customer, o volver al formulario con el tipo nuevo preelegido o con lo escrito conservado.
- Un campo "Customer type" en el creador de "Pick a customer" de New sale.
- Un texto nuevo, o un reintento con un toque, para la carga fallida de los tipos en el formulario del Customer.
- Un reintento con un toque para la carga fallida de la lista de Phone countries: se recupera cerrando y volviendo a abrir el formulario. Es pulido que el dueño puede programar más adelante.
- Mover en bloque los Customers de un tipo a otro.
- Una pantalla para fijar o gestionar los precios de los Customer types que no son el VIP type, o mostrarlos en la lista de tipos (la parte de la pantalla de precios por tipo); cómo se guardan y se aplican los Customer-type prices está en pricing-settings.md y sales.md.
- Que la Spreadsheet import resuelva sola un choque con un tipo del vendedor llamado "VIP" (adoptarlo, renombrarlo o crear el VIP type con otro nombre).
- Un canal de Customer, o cualquier reemplazo para él; guardar una copia de los valores viejos del canal en cualquier lado.
- Una pantalla Owed to you aparte; una cifra de deuda tocable en la cabecera de Customers; cualquier filtro u orden de Customers más allá de lo definido acá.
- Importar de vuelta un Business export viejo.
- Otras reglas VIP (un porcentaje de descuento sobre el **List price**); activar o desactivar Customer types (pricing-settings.md).
- Hacer obligatorio el Phone number.
- Cambiar la búsqueda por número, o buscar por número de otra forma (si un número tipeado con separadores coincide en la búsqueda sigue sin decidirse).
- Reescribir un número ya guardado.
- Elegir el país en el Onboarding o guardarlo en el Business.
- Hacer crecer la lista de ocho países (trabajo aparte, #330/#318): fuera de la lista se sigue tipeando con `+` y su código, con Other, y se muestra tal como está guardado.
- Cambiar el orden de la detección (región de idioma, después zona horaria, después Other).
- Dejar guardar mientras la lista de países no está disponible.
- Un aviso en línea antes de guardar para un número local con Other.
- Un control para cambiar solo el país de un número guardado.
- Recordar una elección de país entre formularios.
- Que la Spreadsheet import use o fije un país del Business.
- Quitar la columna `business.default_phone_country` (parte 3 de GH-682).
- Mostrar el número agrupado dentro del campo del teléfono del formulario.
- Un botón para copiar, un link para llamar o escribir, o una copia de solo dígitos del número.
