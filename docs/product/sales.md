## Jobs

**Cuando** entrego un pedido (una o varias variedades, quizás con envío, pagado en el momento o dejado debiendo), **quiero** registrarlo en pocos toques (variedades, gramos, quién se lo llevó, cómo pagó) con cada línea cotizada con los **Current price**s de ese día y el precio guardado en la línea, **para** no cotizar nunca de memoria, que un cambio de precio posterior nunca reescriba lo que cobré, y que nada de lo que quedó debiendo se pierda ni caiga en la persona equivocada.

**Cuando** un cliente pide por Telegram o WhatsApp y se lo estoy entregando, **quiero** cargar el pedido en el teléfono en pocos toques (variedades, gramos, quién se lo lleva, cómo pagó) y ver cómo se actualizan mientras escribo el precio, la regla y el total de cada línea, y el total de la venta, **para** confirmarle el total al cliente en el chat, no cotizar nunca de memoria y no tener que rehacer nunca una venta después de guardarla.

**Cuando** estoy entregando un pedido con el teléfono, en medio del chat con el cliente por Telegram o WhatsApp y muchas veces con una sola mano libre, **quiero** completar y guardar la venta con el pulgar, con cada campo entero y legible, el total y "Save sale" siempre a mano, y el teclado sin tapar nunca lo que estoy escribiendo, **para** confirmar el total en el chat y volver con el cliente en menos de un minuto, sin hacer zoom, sin tocar mal, sin perder el pedido y sin rehacer la venta. (Afina las dos historias anteriores para el teléfono; no es un trabajo nuevo).

**Cuando** configuro cómo cotiza mi negocio, registro el precio de una variedad o entrego un pedido, **quiero** que la app use solo las **Pricing rule**s que tiene mi negocio (un **Bulk price** si vendo por volumen, y un **VIP price** que fijo por variedad si tengo clientes VIP), **para** cobrarle a cada cliente exactamente lo que quiero cobrarle sin tipear un **Special price** a mano, sin ver campos que no me aplican y sin que a nadie le cambie el precio por sorpresa. (Afina la primera historia; no es un trabajo nuevo. Definido en pricing-settings.md).

**Cuando** quiero revisar lo que vendí hoy, esta semana o este mes, **quiero** ver las ventas de ese período con su total y su cantidad, **para** saber cómo viene la cosa entre pedido y pedido y encontrar una venta puntual para corregirla.

**Cuando** reviso entre pedidos lo que vendí hoy, esta semana o este mes, **quiero** cambiar de período y abrir una venta en el teléfono sin tocar mal y sin una pantalla en blanco mientras carga, **para** encontrar la venta a corregir y asignarle su cliente o borrarla en pocos toques. (Afina la historia anterior y el criterio 11 para el teléfono; corregir una venta sigue siendo exactamente esas dos cosas).

**Cuando** registré una venta, o un cliente me pregunta después qué se llevó o cuánto me debe, **quiero** mandarle en un toque el **Sale bill** de esa venta en texto plano y corto (sus líneas, el envío, el total, cómo pagó, lo que todavía debe de esa venta y su **Balance** de ahora), **para** contestarle en nuestro chat sin volver a tipear ni sacar cuentas, y que el cliente vea los mismos números que veo yo. (La historia dice "el chat" y no nombra ningún canal, por **Assume nothing**).

**Cuando** un cliente me paga parte o todo lo que me debe, en efectivo o por transferencia, el mismo día o semanas después, **quiero** registrarlo desde el teléfono en pocos toques y ver que su Balance y su "owing since" bajan en el acto, **para** saber siempre quién me debe qué y desde cuándo, y que nada de lo que pagó o todavía debe se pierda ni caiga en la persona equivocada. (Acá lo sirve la marca "owes you" en Sales; definido en `payments.md`).

**Cuando** doy de alta un cliente (desde Customers, en medio de una venta o con la **Spreadsheet import** única) y no tengo su **Phone number**, **quiero** guardarlo igual con su nombre y agregar el número más adelante si algún día lo consigo, **para** registrar cada venta y cada deuda a nombre de la persona que de verdad debe, sin inventar un número ni dejar a esa persona fuera de la app. (Acá lo sirve "New customer" de Pick a customer; definido en `customers.md`).

**Cuando** manejo mi negocio desde el teléfono entre pedido y pedido o en medio del chat con un cliente, varias veces por día, **quiero** que la app esté ordenada según lo que hago de verdad y con qué frecuencia, **para** volver con el cliente en lugar de buscar entre menús. (La historia de navegación, navigation.md: acá la sirve "+ New sale", a un toque desde cada **Tab root**).

# Ventas

Lo que un cliente se lleva de una vez, con cada línea cotizada con los precios del día y las **Pricing settings** del negocio, y ese precio guardado en la línea (ADR-0003). Las ventas las ve solo su negocio (ADR-0004). Esta capacidad lee:
- los Current prices, de las variedades;
- los clientes, con su estado VIP, de clientes;
- qué Pricing rules usa el negocio, de las Pricing settings (pricing-settings.md).

Los pagos (`payments.md`) saldan lo que una venta deja debiendo y dicen si cada venta sigue debiendo. El stock (`stock.md`) saca los gramos de cada línea de los **Lot**s de su variedad y le da a la línea su **Cost of goods sold**, que sigue a los Lots y nunca queda congelado (ADR-0009). Esta capacidad cubre también las pantallas de ventas: New sale, Sales y el detalle de una venta, en el teléfono y en la computadora, y el Sale bill que se comparte desde el detalle de una venta. Dónde se ubican es navigation.md.

La protagonista de las historias del teléfono es la vendedora. Los diseños de computadora (`NuevaVentaCompu`, `VentasCompu`) son las mismas historias en una pantalla más grande. Antes del rediseño para teléfono, la vendedora registraba ventas en el teléfono con fricción (bajar para encontrar el botón de guardar, hacer zoom para acertar controles chicos, a veces registrar después de memoria), sin ninguna alternativa fuera de la app.

El Sale bill sirve en dos momentos: justo después de guardar, con el cliente todavía esperando en el chat (el principal), y más tarde, cuando el cliente pregunta y la vendedora abre el detalle de esa venta. Supuesto sobre hoy: la vendedora vuelve a tipear el pedido y el total, o manda una captura, y saca el Balance a mano.

Criterios de éxito, registro (API):

1. **Velocidad**: desde el teléfono, una venta se registra en menos de 60 s, desde que se abre el formulario hasta que queda guardada.
   - Vale con un cliente existente, uno nuevo (con o sin Phone number) o ninguno, y la venta sin cliente es la más rápida.
   - Es un minuto compartido con el presupuesto de buscar o dar de alta de customers.md, no un segundo minuto aparte.
2. **Un pedido es una venta**: un pedido es una sola venta por más variedades que tenga, con el **Shipping charged** una vez. Su total es la suma de sus líneas más el envío. Cantidades y promedios cuentan ventas, no líneas.
3. **Precio correcto y guardado**:
   - Cada línea se cotiza con las reglas de abajo, a partir del Current price de la variedad en la fecha de la venta y de las Pricing settings del negocio al momento de guardar. Guarda su precio por gramo y su Pricing rule.
   - Los cambios posteriores nunca alteran lo que cobró una venta existente: cualquier **Price entry**, las Pricing settings, un cambio en el estado VIP de un cliente, un cliente asignado después, cualquier **Stock entry** o cualquier pago.
   - Se rechaza una línea cuya variedad no tiene precio ese día, salvo que tenga Special price.
4. **Sin limbo, sin deuda perdida**:
   - Una venta con datos faltantes o inválidos se rechaza entera.
   - Una venta que queda debiendo siempre tiene cliente. Solo puede no tenerlo una venta en la que no queda nada debiendo.
   - Se le puede agregar un cliente después, una sola vez, y nunca cambiarlo por otro.
5. **Los negocios nunca se mezclan** (ADR-0004): una venta referencia solo clientes y variedades de su propio negocio. La venta de otro negocio responde 404 y las listas no muestran nada de ella. La nota nunca aparece en respuestas de error ni en logs (ADR-0005).

Criterios de éxito, Pricing rules (pricing-settings.md):

17. **Solo aplican las reglas del negocio.** Con una regla apagada, la venta se cotiza como si la regla no existiera, y New sale no muestra nada de ella. Con las dos apagadas, toda línea que no es regalo ni Special price toma el **List price**.
18. **Un VIP nunca paga más que un cliente común.** A un cliente VIP se le cobra el menor de los precios de las reglas que aplican a la línea. Una variedad sin VIP price le cobra a un VIP como a cualquiera.
19. **A nadie le cambia el precio por sorpresa.** Después de la migración, a cada cliente VIP existente se le cobra exactamente lo mismo que antes, para la misma variedad, día y gramos.

Criterios de éxito, en pantalla:

6. **Lo que ves es lo que queda**: si los precios y las Pricing settings no cambian entre la vista previa y el guardado, el precio por gramo, la regla y el total de cada línea, y el total de la venta, coinciden con lo que guarda la API, con 0 diferencias. Después de guardar, la pantalla muestra lo que respondió la API, no la vista previa.
7. **Sin sorpresas al guardar**:
   - Owing queda deshabilitado con "To leave it owing, pick a customer", y una línea sin precio ese día muestra "<variety> has no price for that date", las dos cosas antes de guardar.
   - Cualquier otro rechazo vuelve con su código, se muestra sobre su campo y todo lo tipeado se conserva.
   - Una venta rechazada nunca pierde el pedido.
8. **Un pedido es una venta en pantalla**: un formulario, un total y el Shipping charged una vez.
9. **Deshacer en un toque**: una venta guardada por error se deshace en un toque desde el aviso "Sale saved", y no queda nada de ella: ni líneas, ni **On-the-spot payment**, y no aparece en ninguna lista.
10. **Un vistazo entre pedidos**: pasar entre Today, Week (de lunes a domingo) y Month, o elegir Dates, responde lo bastante rápido como para mirarlo en medio de un chat.
11. **Encontrar y corregir**: cualquier venta del período se puede encontrar y abrir. En su detalle, a una venta sin cliente se le puede dar uno (una vez, nunca cambiarlo), y una venta equivocada se puede borrar. Corregir una venta es exactamente esas dos cosas.

Criterios de éxito, en el teléfono:

12. **Nada recortado, guardar a mano**: a 320, 375 y 430 px de ancho y con el texto al 130 %, nada de New sale, Sales o el detalle de una venta desborda ni queda recortado. En New sale, el total y "Save sale" se ven sin desplazar, por encima del teclado y del indicador de inicio, y el último campo se puede llevar entero a la vista.
13. **Del tamaño del pulgar, sin zoom**: todo control de estas pantallas, botones de diálogo incluidos, mide al menos 44 px de alto; todo campo tiene al menos 16 px, la fecha incluida, para que iOS nunca haga zoom al enfocar. Los gramos abren un teclado decimal y los pesos uno numérico, con `enterkeyhint` para avanzar por una línea.
14. **Nunca en blanco**: nada de estas pantallas que espera al servidor muestra una pantalla en blanco; la venta se sigue registrando en menos de 60 s (criterio 1).
15. **El pedido nunca se pierde por accidente**: el gesto de volver del sistema pregunta "Discard the sale?" exactamente con la misma condición que "Close".
16. **Nada más cambia**: la cotización, la vista previa, el flujo, los textos y los diseños de computadora se comportan como se define acá; los tests existentes de ventas y de navegación pasan sin editarlos para acomodarlos al diseño del teléfono.

Criterios de éxito, Sale bill:

20. **Un toque, sin tipear.** En el detalle de la venta, un toque en el teléfono abre la hoja de compartir del teléfono con el Sale bill listo o lo deja en el portapapeles; elegir el chat y enviar son pasos del propio teléfono. Si compartir o copiar falla, la vendedora igual obtiene el texto sin tipear.
21. **Las cifras coinciden con la app.** El total, el estado de pago, lo que todavía se debe y el Balance del Sale bill coinciden siempre con el detalle de la venta, porque salen de la misma pasada de **Settlement** en la misma respuesta. Evidencia: el juego de referencia escrito a mano, 0 diferencias.
22. **No se filtra nada privado.** Ni la nota, ni el nombre del cliente, ni las palabras VIP, special o list, ni ids ni links; una línea VIP o con Special price se lee como una línea de lista. El Sale bill no agrega formato propio, y los nombres que tipeó la vendedora (el del negocio y los de sus variedades) salen exactamente como se tipearon. Evidencia: el test de filtraciones.
23. **Se cumple Assume nothing.** Cada palabra fija y la unidad salen del **Copy module**; la unidad es una sola entrada, "g" por defecto, hasta #318. Evidencia: con la unidad puesta en "u", el texto dice "3,5 u" y "/u".

## Comportamiento

- **Venta**:
  - Tiene una fecha, a lo sumo un cliente, el Shipping charged, una nota opcional, cómo se pagó y una o más líneas.
  - Una venta sin líneas se rechaza.
- **Fecha**:
  - Por defecto es hoy, el día del negocio en hora de Argentina.
  - No puede ser posterior a hoy. Se permiten fechas anteriores.
- **Línea**:
  - Tiene una variedad del mismo negocio y gramos por encima de cero, con a lo sumo dos decimales, sea cual sea su regla.
  - Una línea puede marcarse opcionalmente como regalo o llevar un Special price.
  - La misma variedad puede aparecer en varias líneas de una venta, cada una cotizada por su lado, sin unirlas ni avisar.
- **Stock**: registrar una venta o un regalo nunca se rechaza por stock (ADR-0009). Sus gramos salen del stock de su variedad, que puede quedar negativo.
- **Cotización**: se calcula cuando se registra la venta y se guarda en la línea con su Pricing rule (ADR-0003). Usa el Current price de la variedad en la fecha de la venta y las Pricing settings del negocio al momento de guardar. Gana el primer paso que aplica:
  1. **Gift**: $0.
  2. **Special price**: el total tipeado para la línea, en pesos enteros y por encima de $0.
  3. **Si no, el menor precio por gramo** entre las reglas que aplican a la línea:
     - **List price**: aplica siempre.
     - **Bulk price**: Bulk price está encendido, el Current price tiene Bulk price y los gramos de la línea están en el **Bulk minimum** o por encima. El mínimo se mide por línea, nunca entre líneas.
     - **VIP**: VIP customers está encendido, el cliente es VIP al momento de registrar y el Current price tiene VIP price.
  - **Cómo se nombra la regla**:
    - Si VIP y bulk empatan, la línea se guarda como VIP.
    - Si no, nombra la línea la regla estrictamente menor.
    - Un Bulk price y un VIP price siempre están por debajo de lista, así que lista aplica solo cuando no aplica ninguna de las otras.
  - **A un cliente VIP se lo cotiza como a cualquiera** cuando el precio de ese día no tiene VIP price. Un VIP price por encima del Bulk price, en una línea en el Bulk minimum o por encima, da el Bulk price, guardado como "bulk".
  - **Con las dos llaves apagadas**, toda línea que no es regalo ni Special price toma el List price.
  - **Se rechaza**:
    - una línea marcada como regalo y con Special price a la vez;
    - una línea sin Special price cuya variedad no tiene Current price ese día.
  - **Llaves cambiadas con un formulario abierto**: una venta se cotiza con las llaves vigentes al guardarla, igual que con los Current prices. El guardado pasa sin rechazo y sin aviso.
- **Total de la línea**:
  - Para líneas de lista, Bulk price y VIP: gramos × el precio por gramo guardado, redondeado al peso entero más cercano, con la mitad exacta hacia arriba. Por ejemplo, 1,55 g × $10 001 = $15 501,55 → $15 502, y $7 502,50 → $7 503.
  - Una línea de regalo es $0. Una línea con Special price es su total tipeado, así que no necesita redondeo.
  - El total de una línea nunca cambia una vez registrada la venta.
- **Costo de mercadería de la línea**:
  - Toda línea, regalos incluidos, tiene un Cost of goods sold sacado de los Lots de donde salieron sus gramos, los más viejos primero, que calcula stock según cómo están los Lots ahora (ADR-0009).
  - Una parte o todo puede ser **Pending cost**.
  - No queda congelado como el precio, y un cambio en él nunca mueve el precio ni el total de la línea.
- **Total**: la suma de los totales redondeados de las líneas más el Shipping charged. Las líneas se redondean de a una, nunca como suma.
- **Shipping charged**: pesos enteros, cero o más, $0 por defecto. Un valor negativo se rechaza.
- **Cómo se pagó**:
  - **Pagada entera en el momento, en efectivo o por transferencia.** Registra un On-the-spot payment por el total, en la fecha de la venta, con su medio (ADR-0007). Salda solo esta venta (`payments.md`).
  - **Queda debiendo**: sin medio, y la venta necesita cliente. Los pagos posteriores la saldan empezando por la deuda más vieja (`payments.md`).
  - **Total de $0**: queda saldada sin medio y sin nada debido. Un medio enviado con ella se ignora y no se guarda.
  - Un total por encima de $0 necesita un medio o "queda debiendo".
  - No existe el pago parcial en el momento.
- **Cliente**:
  - Opcional solo cuando no queda nada debiendo.
  - Tiene que ser del mismo negocio; el cliente de otro negocio no se encuentra.
  - Un cliente con o sin Phone number se elige igual (customers.md).
- **Venta sin cliente**: cuenta en todos los totales y en la historia de ningún cliente.
- **Asignar un cliente después**:
  - Solo a una venta que no tiene, y solo un cliente del mismo negocio.
  - Una venta que ya tiene cliente se rechaza.
  - Las líneas guardadas nunca se vuelven a cotizar.
- **Nota**:
  - Opcional. Se recorta y admite hasta 200 caracteres; vacía después de recortar significa que no hay.
  - No es única y nunca se busca, se loguea ni se repite en errores.
- **List price**:
  - Filtra por rango de fechas. Los dos extremos son opcionales e inclusivos; un extremo que falta no tiene límite.
  - Un rango invertido da vacío.
  - Orden: la fecha más nueva primero, después la registrada más recientemente primero.
  - Cada venta dice si sigue debiendo, calculado en vivo por pagos.
- **Ver una**: fecha, cliente o ninguno, envío, nota, cómo se pagó, total, y de cada línea la variedad, los gramos, el precio por gramo guardado, la Pricing rule, el total de la línea y el Cost of goods sold (monto costeado y gramos pendientes). Trae también el Sale bill (abajo), o ninguno.
- **Sale bill** (los hechos detrás del texto compartido):
  - El nombre del negocio, la fecha, de cada línea la variedad, la cantidad, el monto y la regla (bulk, gift o ninguna: lista, VIP y Special price se leen todas como ninguna), con el precio unitario en las líneas con Bulk price; el Shipping charged; el total; el estado de pago (cash, transfer, paid, owed, none) con lo que todavía se debe de esta venta; y el Balance del cliente, o ninguno cuando la venta no tiene cliente.
  - El nombre del negocio y los nombres de las variedades son datos de la vendedora, y viajan exactamente como están guardados: nunca se escapan, se recortan ni se reescriben.
  - El estado de pago, lo que todavía se debe y el Balance salen de la única pasada de Settlement detrás del "still owing" del detalle, en la misma respuesta; nada vuelve a calcular el Settlement en otro lado.
  - El Balance es la cuenta entera del cliente al momento de leer el detalle, no en la fecha de la venta.
  - Es cerrado: no tiene campo para la nota, el nombre o el id del cliente, ningún id de venta o de línea, la marca VIP, una Pricing rule que no sea bulk o gift, costo, margen ni link. El negocio sale solo de la sesión.
  - Cuando no se puede calcular, el detalle responde sin Sale bill y el resto del detalle no se ve afectado; el error nombra la regla incumplida y ninguna venta, cliente ni monto.
  - No se guarda ni se loguea nada de él.
- **Borrar**:
  - Un borrado definitivo, líneas y On-the-spot payment incluidos; no queda nada para listar ni restaurar.
  - Sus gramos vuelven al stock y caen de nuevo en los Lots por fecha (ADR-0009). La respuesta dice los gramos devueltos por variedad.
  - Los pagos posteriores que la habían saldado pasan a la siguiente deuda más vieja del cliente, o quedan como **Credit** (`payments.md`).
- **Rechazos** (ADR-0005, ADR-0008):
  - Son mensajes fijos que nunca repiten lo ingresado, la nota, montos ni nombres.
  - Cada uno lleva su propio `code` con espacio de nombres, listado en `web/src/api/contract.json` y verificado por `tests/test_refusal_codes.py`. Las reglas con código:
    - faltan líneas;
    - gramos inválidos;
    - regalo con Special price;
    - Special price en $0 o menos;
    - sin precio ese día;
    - envío negativo;
    - fecha futura;
    - un total por encima de $0 sin medio y sin quedar debiendo;
    - queda debiendo sin cliente;
    - nota demasiado larga;
    - asignar a una venta que ya tiene cliente;
    - venta, cliente o variedad de otro negocio (no existe).
- **Aislamiento (ADR-0004)**:
  - El negocio sale de la sesión.
  - Toda tabla de ventas lleva `business_id`.
  - La venta de otro negocio responde 404 al leer, asignar y borrar.
  - Las listas no muestran ninguna venta de otro negocio.
  - Las rutas están en `tests/test_business_isolation.py`.

### En pantalla: New sale (`NuevaVenta`, `NuevaVentaCompu`)

- **Cómo se abre el formulario**:
  - desde el botón fijo "+ New sale", en cada Tab root (navigation.md);
  - o desde "New sale to <name>" en la ficha de un cliente, con ese cliente ya elegido.
  - Sin ninguna variedad con precio hoy, "+ New sale" sigue visible y dice con palabras qué falta (navigation.md).
- **Un formulario** (navigation.md): sin barra y sin "+ New sale"; se cierra con "Close".
- **Campos**:
  - la fecha: hoy por defecto, mostrada como "Today 02/10", nunca un día posterior;
  - el cliente;
  - una o más líneas. Cada línea tiene variedad, gramos, "Gift" y "Special price" (el total de la línea);
  - el Shipping charged;
  - la nota;
  - cómo se pagó: Cash · Transfer · Owing.
- **El total de la venta** se muestra con los gramos vendidos y los gramos regalados.
- **Vista previa en vivo**:
  - Cada línea muestra su precio por gramo, su insignia de regla (lista, Bulk price, VIP, regalo, especial) y su total. El total de la venta se actualiza mientras la vendedora escribe.
  - Aplica exactamente las reglas de cotización, redondeo y total de arriba, con las Pricing settings del negocio.
  - Muestra solo reglas que pueden aplicar ahora: con una regla apagada, su insignia nunca aparece.
  - Los precios y las Pricing settings se cargan al abrir el formulario y otra vez al cambiar la fecha; un cambio de fecha vuelve a cotizar cada línea con los Current prices de ese día.
  - Los precios nunca se vuelven a consultar en vivo mientras la vendedora escribe.
- **Esperando precios**: mientras el formulario espera los precios al abrirse, muestra el estado de carga compartido (accounts.md, `Estados`). Al cambiar la fecha, el formulario queda en pantalla con todo lo tipeado; el precio, la regla y el total de cada línea muestran el estado de carga, nunca una cifra de relleno, hasta que llegan los precios de ese día, y entonces se vuelve a cotizar cada línea.
- **Gift y Special price se excluyen**:
  - Elegir uno limpia y deshabilita el otro, y apagarlo libera el otro.
  - Special price no acepta $0.
  - El rechazo de regalo con Special price del dominio queda como respaldo inalcanzable.
- **Sin precio ese día**: una línea cuya variedad no tiene Current price en la fecha de la venta muestra "<variety> has no price for that date". El nombre sale de la propia línea en pantalla.
- **Cliente y pago van de la mano**, cambie el que cambie último:
  - Owing está disponible exactamente cuando hay un cliente elegido. Si no, queda deshabilitado y muestra "To leave it owing, pick a customer".
  - Sacar el cliente o elegir "No customer" con Owing seleccionado deja cómo se pagó sin seleccionar. Nunca vuelve solo a Cash.
  - Una venta de $0 no necesita medio.
- **Guardar**:
  - Si sale bien, la app abre el detalle de la venta tal como lo respondió la API, con el aviso "Sale saved".
  - Un rechazo se muestra sobre su campo y conserva todo lo tipeado.
  - Un precio que borró una socia antes de guardar: el guardado se rechaza y la línea muestra el mensaje de sin precio.
  - Un precio o las Pricing settings cambiados antes de guardar: el guardado pasa y el detalle muestra lo que se guardó.
  - Un cliente o una variedad que no se encuentran al guardar muestran la línea genérica y conservan el formulario.
- **Salir**:
  - "Close", o el gesto de volver del sistema, después de haber cargado una línea, un cliente, envío o una nota, pregunta "Discard the sale?", con "No, keep entering" y "Yes, discard it".
  - "No, keep entering" deja a la usuaria en el formulario con todo intacto; el siguiente gesto de volver vuelve a preguntar.
  - Un formulario sin tocar se cierra en el acto.
  - Con una hoja abierta sobre el formulario (Pick a customer, o New customer adentro), volver hace exactamente lo que hace el "Close" propio de esa hoja: cierra solo la hoja de arriba y el formulario conserva todo lo tipeado. Nunca pregunta "Discard the sale?".
  - No hay borradores ni guardado automático.
- **Pick a customer** (`NuevaVentaCliente`):
  - Una hoja sobre la venta.
  - Ofrece buscar por teléfono o por parte del nombre, "No customer" y "New customer", que crea el cliente y lo usa. "New customer" es el mismo formulario que en Customers: solo el nombre es obligatorio; el teléfono es opcional; VIP solo mientras VIP customers está encendido (customers.md); sin canal.
  - Muestra la marca VIP de un cliente solo mientras VIP customers está encendido.
  - Sus resultados muestran el estado de carga compartido antes de su primera respuesta.
  - Cerrar la hoja solo vuelve al formulario.
- **"Sale saved"** (`Estados`):
  - Lleva **Undo** y ningún monto ni nombre. Se anuncia como un toast y dura unos pocos segundos fijos.
  - Undo borra la venta sin confirmación, después muestra "Sale deleted · the grams go back to stock" y vuelve a Sales.
  - Si la venta ya no existe, Undo muestra "That is gone. The list is up to date."
  - Una vez que el aviso se fue, la forma de deshacer es "Delete sale".
  - Nunca contiene el botón Share/Copy; ese vive en el detalle de la venta.

#### New sale en el teléfono

Solo el diseño del teléfono; `NuevaVentaCompu` mantiene el suyo.

- **Pantalla completa, tres zonas**: un encabezado fijo, un cuerpo que se desplaza y un pie fijo.
- **Encabezado**: fijo, nunca se va al desplazar; "Close" y la fecha. El campo de fecha tiene al menos 16 px y al menos 44 px de alto.
- **Cuerpo**: se desplaza entre encabezado y pie, en este orden: el cliente, las líneas, el Shipping charged, la nota y, al final, cómo se pagó. Se desplaza de modo que cómo se pagó, y la línea "To leave it owing, pick a customer" debajo, quedan enteros a la vista por encima del pie; esa línea tiene el margen lateral normal de la pantalla.
- **Pie**: fijo al alcance del pulgar, por encima del teclado y del indicador de inicio. Contiene el total de la venta, los gramos vendidos y regalados en una línea compacta, y "Save sale". Con el teclado abierto se achica al total y el botón y sigue visible. Su aspecto exacto lo decide diseño.
- **Una línea**: un único diseño fijo en todo ancho de teléfono de 320 a 430 px y con el texto al 130 %, nunca elegido midiendo la pantalla. Primera fila: la variedad y los gramos. Debajo: "Gift", una fila con interruptor de al menos 44 px de alto, y "Special price". Debajo de eso: el precio por gramo, la insignia de regla y el total de la línea.
- **Ningún campo desborda ni queda recortado** a 320 px ni con el texto al 130 %.
- **Objetivos táctiles**: las opciones de pago, "Add another variety" y los botones de diálogo miden al menos 44 px de alto; todo campo tiene al menos 16 px.
- **Teclados**: gramos `inputmode="decimal"`; pesos (envío, Special price) `inputmode="numeric"`; los campos de una línea llevan `enterkeyhint` para que la tecla de acción del teclado avance entre ellos.

### En pantalla: Sales (`Sales`, `VentasCompu`)

- **Una Tab root** (navigation.md): la barra o la barra lateral y "+ New sale".
- **Períodos**: Today · Week · Month · Dates, en hora de Argentina.
  - Week es la semana de lunes a domingo que contiene hoy.
  - Month es el mes calendario actual.
  - Dates abre en el primer y el último día del mes actual. El inicio no puede quedar después del fin.
- **El total y la cantidad del período**:
  - el total es la suma de los totales de las ventas mostradas, pagadas o no, envío incluido;
  - la cantidad es de ventas, no de líneas;
  - el total nunca se presenta como **Profit** ni como caja.
- **Cada venta** muestra:
  - su fecha;
  - su cliente, o "No customer" en gris;
  - una insignia VIP, solo mientras VIP customers está encendido;
  - sus variedades y gramos;
  - su total. Una venta que sigue debiendo, las pagadas en parte incluidas, muestra su total en ámbar con "owes you" debajo, tal como lo responde la API.
- **La insignia VIP muestra el estado VIP actual del cliente**, no cómo se cotizó la venta.
  - La insignia de regla de cada línea en el detalle es el registro de cómo se cotizó.
  - Un cliente que deja de ser VIP pierde la insignia en ventas pasadas, mientras sus líneas siguen diciendo "VIP". Eso no es volver a cotizar (ADR-0003).
  - Mientras VIP customers está apagado, ninguna fila muestra la insignia, y las marcas de los clientes quedan guardadas (customers.md).
- **Carga**: antes de su primera respuesta, la lista muestra el estado de carga compartido, nunca una pantalla en blanco.
- **En el teléfono** (`VentasCompu` sin cambios):
  - cada pestaña de período mide al menos 44 px de alto;
  - con el texto normal, las cuatro pestañas comparten una fila en partes iguales; cuando no entran (por ejemplo a 320 px o con el texto al 130 %) pasan a celdas de igual ancho, de a dos, cada una de al menos 44 px de alto; nunca desplazamiento horizontal, nunca una etiqueta acortada;
  - la pestaña elegida se marca con algo más que el color;
  - los dos campos de fecha de Dates tienen al menos 16 px y al menos 44 px de alto y nunca desbordan a 320 px ni con el texto al 130 %.

### En pantalla: Sale of <date> (`VentaDetalle`, el detalle de la venta)

- **Un detalle** (navigation.md): la barra o la barra lateral y "‹ Sales", sin "+ New sale".
- **Carga**: mientras carga la venta, muestra el estado de carga compartido (accounts.md, `Estados`), nunca una página en blanco.
- **Muestra**:
  - el total;
  - de cada línea la variedad, los gramos, el precio por gramo, la insignia de regla y el total de la línea;
  - el envío, la nota, cómo se pagó, y el cliente o "No customer".
- **Las insignias de regla registradas** ("VIP", "bulk") muestran siempre lo que se registró, diga lo que diga hoy las Pricing settings. Son historia (ADR-0003).
- **Compartir el Sale bill** (Share / Copy): ver "Sale bill" abajo.
- **Assign customer**:
  - Se muestra solo cuando la venta no tiene cliente, y abre Pick a customer sin "No customer".
  - El gesto de volver del sistema con su hoja abierta hace lo que hace el "Close" propio de la hoja: cierra solo la hoja y no pregunta nada.
  - Si sale bien, el aviso "Customer assigned".
  - Si alguien asignó uno antes, "This sale already has a customer." y el detalle se actualiza.
  - Después de asignar, el detalle se vuelve a leer del servidor, para que el Sale bill traiga el Balance del cliente recién asignado; nada arma el detalle a mano en el front.
- **Delete sale**:
  - En el teléfono, el control y los botones de su confirmación miden al menos 44 px de alto.
  - Se confirma con `Before deleting`, que nombra la fecha, el monto y el total de gramos de sus líneas que vuelven al stock, regalos incluidos. Por ejemplo: "Delete the $ 11.000 sale from 02/10? 4 g go back to stock." Los botones son "No, keep it / Yes, delete it".
  - Después, el aviso "Sale deleted" y de vuelta a Sales.
  - El texto nunca menciona deuda ni Credit; la cuenta del cliente muestra el efecto después (`payments.md`).
- **Una venta que ya no existe** sigue accounts.md:
  - abrirla muestra "That is gone." con "Back to Sales";
  - asignar, borrar o deshacer muestra "That is gone. The list is up to date."
- No van nombres, notas ni montos a la consola ni al almacenamiento del navegador, y ningún id de negocio aparece en una URL.

### Sale bill (en el detalle de la venta)

Un Sale bill corto en texto plano de una venta, que la vendedora le manda al cliente en un toque. Solo hechos, nunca una factura.

**El texto**, en orden (las palabras fijas son las de la app, en inglés):
1. El nombre del negocio, y en una línea nueva la fecha como dd/mm, sin año. Una línea en blanco.
2. Una línea por cada línea de la venta:
   - lista, VIP o Special price: `{product} {quantity} {unit} · {amount}`;
   - Bulk price: `{product} {quantity} {unit} · bulk price {unitPrice}/{unit} · {amount}`;
   - regalo: `{product} {quantity} {unit} · Gift · $ 0`.
3. `Shipping · {amount}`, solo cuando el Shipping charged está por encima de $0.
4. Una línea en blanco, después `Total · {amount}`.
5. La línea de pago: "Paid in cash" o "Paid by transfer" para un On-the-spot payment; "Paid" cuando se pagó entera después; `Still owed on this sale: {amount}` cuando todavía se debe algo de ella, en parte o entera; ninguna cuando el estado de pago es none.
6. La línea de Balance: `Your balance: {amount}` cuando el Balance está por encima de $0; `In your favor: {amount}` para un Credit, como su valor absoluto.

**Líneas que pueden faltar**: el envío cuando es $0; la línea de pago cuando el estado es none; la línea de Balance cuando la venta no tiene cliente o el Balance es exactamente $0.

El Balance es la cuenta entera del cliente al momento de compartir, no en la fecha de la venta; para una venta compartida más tarde los dos pueden diferir, y es a propósito.

**Formatos**:
- Las cantidades se formatean a partir de centésimos enteros, nunca de un float: separadores argentinos, sin ceros finales (0,01 · 0,1 · 1,05 · 3,5 · 1.000). La forma en que la app ya muestra los gramos se lee exactamente igual que antes.
- La plata se lee `$ 11.000`, nunca con el formato del **Catalog**.

**La entrada de unidad**: la unidad es una sola entrada con clave del Copy module, "g", hasta que #318 la haga configurable. Cada palabra fija del Sale bill vive en el Copy module (grupo `saleBill`); ningún módulo del Sale bill tiene un literal "g" ni llama al formateador de gramos.

**Nunca en el Sale bill**: la nota, el nombre del cliente, las palabras VIP, special o list, ids ni links.

**Sin formato propio**: ninguna palabra fija, separador ni formato del Sale bill lleva `*`, `_` ni comilla invertida. El texto que tipeó la vendedora (el nombre del negocio y los de las variedades) sale exactamente como se tipeó, esos caracteres incluidos: nunca se escapa, se recorta ni se reemplaza, para que el cliente lea el mismo nombre que ve la vendedora. Cómo lo muestra una app de chat es asunto del chat; escapar para una app fijaría un canal (Assume nothing).

**El botón** (en el detalle, nunca dentro del aviso "Sale saved"):
- **Dónde**: el primer elemento de la fila de acciones del detalle, antes de Assign customer y de borrar la venta, como parte del contenido de la pantalla.
- **Etiqueta**: Share donde el teléfono puede compartir; si no, Copy. Lleva su ícono decorativo (compartir o copiar) y la palabra sola como nombre accesible.
- **Share**: si sale bien no muestra nada (que se cierre la hoja es la confirmación); si se cancela no muestra nada; si falla muestra "Couldn't share. Tap Copy and paste it into the chat." con el ícono de atención debajo del botón, y la etiqueta pasa a Copy.
- **Copy**: si sale bien muestra el aviso "Bill copied", en el mismo lugar de avisos de la pantalla que usa "Customer assigned"; si falla muestra "Couldn't copy. Select the text below and copy it by hand." con el ícono de atención debajo del botón, y justo debajo el Sale bill en un bloque seleccionable, con nombre accesible "Sale bill".
- **Sin vista previa**: el texto aparece en pantalla solo cuando falla la copia.
- **Sin Sale bill**: el botón se oculta cuando el detalle responde sin Sale bill. Una venta sin cliente lo conserva, sin línea de Balance.
- **Cargando**: el botón conserva su etiqueta, queda deshabilitado y ocupado (`aria-busy`), y no muestra dígitos ni `$`. Después de Assign customer sigue ocupado hasta que el detalle leído de nuevo muestra el cliente.
- **No encontrada**: una venta que falta sigue el camino de no encontrada que ya existe.
- **Texto fresco**: se arma con el último detalle que tiene la pantalla; el detalle mantiene sus actualizaciones de siempre.
- **Toques repetidos**: un segundo toque mientras el primero sigue pendiente no hace nada; cuando la página vuelve a estar visible, el botón se libera aunque la hoja de compartir nunca haya respondido.
- **Teléfono**: al menos 44 px, solo tokens, funciona por http plano en la red de casa porque la llamada de compartir o copiar corre de forma sincrónica dentro del toque (ADR-0002); pasa el **Mobile check** sin ningún infractor nuevo.
- **Silencioso**: nada del Sale bill va a la consola ni al almacenamiento, y no existe un estado de "ya compartido".

### Estado de carga compartido

- En estas pantallas aplica al detalle de la venta, a la lista de Sales antes de su primera respuesta, a New sale mientras espera precios (al abrirse y al cambiar la fecha), a los resultados de Pick a customer antes de su primera respuesta, y al botón del Sale bill mientras carga el detalle.
- No lleva ningún dígito, símbolo de moneda ni cifra de relleno (accounts.md, criterio 7).

## Métricas

- **Matriz de cotización**: 100 % pasando. (Criterios 3, 17, 18) Cubre:
  - las dos llaves apagadas, solo Bulk price encendida, solo VIP encendida y las dos encendidas;
  - regalo y Special price primero, y el orden de los pasos;
  - la regla del menor precio por debajo, en y por encima del Bulk minimum;
  - el empate VIP–bulk guardado como "VIP";
  - un VIP price por encima del Bulk price, guardado como "bulk" en el mínimo;
  - una variedad sin VIP price, para un VIP;
  - Bulk price medido por línea;
  - sin precio ese día, con y sin Special price;
  - regalo más Special price rechazado;
  - redondeo por debajo de ,50, exactamente ,50 y por encima de ,50;
  - una venta de varias líneas cuyo total es la suma de las líneas redondeadas.
- **Precio guardado inmutable**: 100 % pasando. (Criterio 3) El precio, la regla y el total de las líneas existentes no cambian después de:
  - agregar o borrar una Price entry, un VIP price incluido;
  - cambiar cualquiera de las llaves de precio;
  - prender o apagar VIP;
  - asignar un cliente;
  - agregar, editar o borrar una Stock entry;
  - registrar o borrar un pago.
- **Sin sorpresa para los VIP existentes (criterio 19)**: después de la migración, para cada cliente VIP existente, el precio, la regla y el total de una venta son iguales a los de antes, para la misma variedad, día y gramos. 0 diferencias.
- **Una venta por pedido**: una venta de varias variedades es una venta, con total = líneas redondeadas + envío una vez, por la API y por el formulario. (Criterios 2, 8)
- **Todo o nada**: una venta rechazada deja 0 filas nuevas en ventas, líneas y pagos. (Criterio 4)
- **Debiendo sin cliente**: 0 guardadas; el dominio lo rechaza y un test lo cubre. (Criterio 4)
- **Borrar devuelve gramos**: después de borrar una venta, el stock de sus variedades sube exactamente los gramos de sus líneas, y la respuesta los nombra. La confirmación de Delete sale nombra los gramos, y el aviso de Undo dice que vuelven.
- **Cobertura de aislamiento**: cada ruta de ventas está en el barrido y responde 404 o vacío desde otro negocio, incluidas referencias a un cliente o una variedad de otro negocio. En pantalla, la venta de otro negocio abierta por id muestra "That is gone." (Criterio 5)
- **Sin eco**: (Criterio 5)
  - ningún cuerpo de rechazo ni línea de log contiene la nota, el nombre de un cliente ni un monto enviado;
  - después de una corrida completa del front, la consola y el almacenamiento del navegador no tienen ninguno.
- **Tiempo de registro**: la corrida del front registra una venta desde un viewport de teléfono con un cliente existente, uno nuevo (con o sin Phone number) o ninguno (`web/e2e/sales.spec.ts`, `web/e2e/ventasTelefono.spec.ts`), y el presupuesto de toques se cumple (`web/e2e/tapBudget.spec.ts`); ningún test mide su duración. Registrar responde en menos de 300 ms con unas pocas docenas de variedades y clientes. (Criterios 1, 14)
- **Vista previa = guardado**: (Criterio 6)
  - la vista previa del front pasa la misma matriz de cotización que el dominio, para cada combinación de llaves;
  - la corrida de punta a punta compara la vista previa con el detalle guardado: 0 diferencias.
- **Llaves en pantalla (criterio 17)**: tests del front muestran, para cada llave apagada, ninguna insignia ni campo de esa regla en New sale, ninguna insignia VIP en Sales y ninguna marca VIP en Pick a customer, mientras el detalle de una venta conserva sus insignias registradas.
- **Detectado antes de guardar**: (Criterio 7)
  - Owing deshabilitado sin cliente, y sacar el cliente reinicia el medio;
  - una línea sin precio muestra su mensaje antes de guardar;
  - un rechazo forzado de la API conserva cada campo tipeado;
  - cada rechazo de ventas tiene un código en `contract.json`, verificado por `tests/test_refusal_codes.py`.
- **Undo no deja nada**: después de Undo quedan 0 filas de esa venta en ventas, líneas y pagos, y no está en ninguna lista. (Criterio 9)
- **Sales**: (Criterios 10, 11)
  - el total y la cantidad de cada período son iguales a la suma y al número de las ventas mostradas;
  - la semana va de lunes a domingo;
  - la marca "owes you" coincide con el Settlement de la API;
  - la lista responde en menos de 300 ms con unos pocos cientos de ventas: lo verifica `tests/sales/test_list_cost.py` con el plan de consulta de las sentencias de la lista (se buscan los índices, no se recorre ninguna tabla) y la cantidad de sentencias con 30 y 300 ventas, nunca por tiempo (docs/adr/0038).
- **Corregir**: la corrida de punta a punta asigna un cliente a una venta que no tenía (Assign customer desaparece) y borra una venta con su confirmación. (Criterio 11)
- **Sin desbordes en el teléfono (criterio 12)**: tests del front a 320, 375 y 430 px y con el texto al 130 %, para New sale, Sales y el detalle de la venta, muestran que nada queda recortado ni desborda en horizontal, "Special price", el envío y los campos de Dates incluidos; las pestañas de Sales cubiertas en una fila y de a dos.
- **Guardar a mano (criterio 12)**: en esos anchos, el total del pie y "Save sale" se ven al cargar; el encabezado se queda mientras el cuerpo se desplaza; con un teclado simulado el pie sigue visible; las opciones de pago y la ayuda de Owing (con margen lateral) se desplazan enteras por encima del pie.
- **Objetivos y campos (criterio 13)**: todo elemento interactivo de las tres pantallas, botones de diálogo incluidos, mide al menos 44 px de alto; todo campo tiene un tamaño de letra calculado de al menos 16 px; los gramos llevan `inputmode="decimal"`, los pesos `"numeric"`, y los campos de una línea `enterkeyhint`.
- **Nunca en blanco (criterio 14)**: tests del front muestran el estado de carga compartido en el detalle, la lista de Sales, la espera de precios de New sale (al abrir y al cambiar la fecha) y los resultados de Pick a customer, sin ningún dígito, símbolo de moneda ni cifra de relleno.
- **Cambio de fecha**: un test del front muestra que todo lo tipeado se conserva, las líneas muestran carga, y después cada línea se vuelve a cotizar.
- **Guarda del volver (criterio 15)**: tests del front usan el gesto de volver del sistema: pregunta "Discard the sale?" con la condición de Close; "No, keep entering" conserva el formulario y el siguiente volver vuelve a preguntar; un formulario sin tocar se cierra en el acto; con Pick a customer, New customer o Assign customer abiertos, volver cierra solo la hoja de arriba como su propio "Close", la venta o el detalle de abajo quedan intactos y "Discard the sale?" nunca aparece.
- **Sin regresiones (criterio 16)**: los tests existentes de ventas y de navegación pasan sin editarlos; la matriz de cotización y "vista previa = guardado" siguen en 0 diferencias; `NuevaVentaCompu` y `VentasCompu` no cambian.
- **Juego de referencia del Sale bill (criterio 21)**: `saleBill.cases.json`, con los textos esperados escritos a mano contra esta definición, nunca generados; 0 diferencias. Casos: con y sin línea con Bulk price; una línea VIP y una con Special price que se leen como líneas de lista; un regalo; una venta de $0 solo de regalos con Balance distinto de cero; efectivo, transferencia, pagada después, debiendo en parte, debiendo entera; un Balance, un Credit y un Balance de exactamente $0; sin cliente; con y sin envío; una línea y varias líneas; cantidades 0,01, 0,1, 1,05 y 1000; una variedad cuyo nombre tiene `*`, `_` y una comilla invertida, mostrado sin cambios.
- **Formato de cantidades (criterio 21)**: `formatQuantity` da 1 → "0,01", 10 → "0,1", 105 → "1,05", 350 → "3,5", 100000 → "1.000" a partir de centésimos enteros; los tests existentes de `formatGrams` pasan sin editarlos.
- **Test de filtraciones del Sale bill (criterio 22)**: con nombres de negocio y de variedades sin `*`, `_` ni comillas invertidas, ningún texto de los casos contiene la nota, el nombre del cliente, "VIP", "special", "list", un id, "http", `*`, `_` ni una comilla invertida; el esquema del Sale bill en la API es cerrado y no tiene ningún campo así.
- **Contrato cumplido**: un vitest lee los esquemas `SaleBillOut` de `tests/fixtures/openapi_snapshot.json` y verifica que sus nombres de propiedad y sus enums son iguales a las listas de claves del front; el front y la API nunca se separan.
- **Unidad y palabras del Copy module (criterio 23)**: con la entrada de unidad puesta en "u", el texto dice "3,5 u" y "/u"; una guarda no encuentra ningún literal "g" ni llamada a `formatGrams` en ningún fuente `saleBill*`; `en-XA` está regenerado y los tests de vigencia de textos pasan.
- **Un toque (criterio 20)**: tests del front (fetch simulado) muestran que Share llama a compartir con el texto del Sale bill; con `isSecureContext=false`, `execCommand('copy')` se llama de forma sincrónica justo después del clic y aparece el aviso "Bill copied"; cancelar no muestra nada; si compartir falla aparece su línea con el ícono de atención y la etiqueta pasa a Copy; si copiar falla aparece su línea y el bloque seleccionable; `bill` nulo oculta el botón; cargando conserva la etiqueta, deshabilitado y ocupado, sin dígitos ni `$`. El proyecto móvil recorre el detalle de la venta por su fila del registro, cargado y retenido, y pasa sin ningún infractor nuevo. No se agrega ningún `WalkState` para los estados de copia fallida ni de carga: un estado nuevo en la ruta de la venta trae los infractores que esa ruta ya tiene bajo un nombre de pantalla nuevo, y las listas de infractores no pueden aceptarlo (`gate.md`). Los dos estados los cubren los tests del front de arriba.
- **El Sale bill no deja rastro**: después de los tests del front, la consola y el almacenamiento del navegador no tienen nada del Sale bill.

## Fuera de alcance

- Pagos posteriores y parciales, Balances, **Owing since** y Credit: `payments.md`.
- Rechazar una venta por falta de stock: nunca (ADR-0009).
- Editar una venta: se borra y se registra de nuevo.
- Pasar una venta de un cliente a otro o sacarle el cliente.
- Borradores o guardado automático de una venta.
- Profit y caja en Sales: la capacidad de resultados.
- Actualizaciones en vivo entre socias mientras hay un formulario o una lista abiertos.
- Importar ventas desde la planilla.
- Un cambio de diseño de línea en el teléfono decidido por medición; desplazamiento horizontal o etiquetas acortadas en las pestañas de período de Sales.
- Cambios en los diseños de computadora como parte del rediseño para teléfono; textos de pantalla en inglés (#53); la regla de barra y volver (#59).
- Construir la confirmación de cambios sin guardar de New customer (customers.md): su propio issue, con sus propios textos, para Customers y Pick a customer por igual.
- Otras reglas VIP (un porcentaje sobre lista); promociones de precio por fecha.
- Rechazar o avisar en una venta porque las Pricing settings cambiaron en medio de la venta.
- Para el Sale bill: un año en la fecha; un paso de vista previa; un estado de "ya compartido"; un recibo de pago; elegir un canal o enviar desde la app; una factura; escapar o reescribir los nombres que tipeó la vendedora para el formato de alguna app de chat; hacer configurable la unidad (#318); cualquier otro idioma (#317).

## Planeado en GH-318

Todavía no está construido. Hasta que salga la parte nombrada, lo que hace la app son las secciones de arriba.

Cada pasaje nombra el ADR que lo decide, la parte que lo va a entregar y la frase actual que va a reemplazar. La parte que entrega un pasaje lo saca de acá y edita Comportamiento y Fuera de alcance en el mismo diff.

### Unit

Decidido en docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md; lo entrega la parte units.

- La cantidad de una línea va a estar en la unidad de su producto, guardada como un número entero de centésimos sea cual sea la unidad; los 0 a 2 decimales de la unidad solo van a validar lo tipeado y decidir cómo se muestra. El pie y el total de la venta van a mostrar la cantidad vendida y la cantidad regalada como un monto por unidad, cada uno con su etiqueta, nunca sumados entre unidades.
- Va a reemplazar: "Tiene una variedad del mismo negocio y gramos por encima de cero, con a lo sumo dos decimales, sea cual sea su regla." y "**El total de la venta** se muestra con los gramos vendidos y los gramos regalados."

### Customer type y Pricing rule

Decidido en docs/adr/0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md; lo entrega la parte customer-type prices.

- Los Customer types van a reemplazar la marca VIP única. Las reglas de una línea van a ser lista, Bulk price o el precio del Customer type, a partir de filas con fecha de vigencia; Bulk price y los precios por Customer type van a seguir pudiéndose prender y apagar por negocio. Las columnas `vip` y `vip_price` van a quedar congeladas en su lugar, así una venta conserva el precio que cobró.
- Va a reemplazar: "**VIP**: VIP customers está encendido, el cliente es VIP al momento de registrar y el Current price tiene VIP price." y la regla de nombre "Si VIP y bulk empatan, la línea se guarda como VIP."

### Money scale

Decidido en docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md; lo entrega la parte money.

- Los montos van a viajar en unidades de moneda como Decimal y se van a guardar en la escala del negocio (0 o 2). El redondeo con la mitad hacia arriba de una línea va a pasar por un único helper, `round_half_up`, que la parte de plata crea en `app/shared/money.py`; subir los decimales de un negocio no va a cambiar el valor de ningún monto registrado.
- Va a reemplazar: "**Special price**: el total tipeado para la línea, en pesos enteros y por encima de $0.", "gramos × el precio por gramo guardado, redondeado al peso entero más cercano, con la mitad exacta hacia arriba" y "**Shipping charged**: pesos enteros, cero o más, $0 por defecto."

### Payment method

Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; lo entrega la parte payment methods.

- Los Payment methods van a ser la lista propia del negocio; un negocio nuevo va a empezar con "Cash" y "Transfer", y uno existente va a conservar los dos.
- Va a reemplazar: "cómo se pagó: Cash · Transfer · Owing." y "**Pagada entera en el momento, en efectivo o por transferencia.**" ("Owing" sigue siendo un estado, no un medio).

### Business time zone

Decidido en docs/adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md; lo entrega la parte time-zone.

- Va a reemplazar: "Por defecto es hoy, el día del negocio en hora de Argentina." y "**Períodos**: Today · Week · Month · Dates, en hora de Argentina."; las dos van a leer la zona horaria propia del negocio.

### Applied promotion

Decidido en docs/adr/0060-the-applied-promotion-snapshot-is-typed-sale-promotion-rows-recorded-as-the-sale-stood-when-saved-and-never-recomputed.md; lo entrega la parte promotions-at-sale-time.

- La vendedora va a definir las promociones propias del negocio (un descuento, un precio fijo por unidad, llevá N pagá M, un combo, un regalo, un umbral), cada una con a qué aplica y cuándo. Las que califican se van a aplicar solas al vender; la vendedora va a ver cada Applied promotion y va a poder sacar cualquiera antes de guardar.
- Una línea va a conservar su Pricing rule y el descuento se va a registrar encima. Una línea con Special price, y una línea de regalo, no van a recibir promoción. El ítem gratis de una promoción se va a registrar como línea de regalo.
- La venta va a registrar qué promociones aplicaron y cuánto descontó cada una, tal como estaban al guardarla, como filas tipadas `sale_promotion`, que crea la parte promotions-at-sale-time (ADR-0060). Editar, pausar o archivar una promoción nunca va a tocar ventas pasadas; borrar una venta le va a devolver su uso.
- Va a reemplazar, en Fuera de alcance: "Otras reglas VIP (un porcentaje sobre lista); promociones de precio por fecha." (la mitad de "promociones de precio por fecha").
- El motivo de retiro "Promotion" se va a renombrar "Marketing" antes de que salga cualquier código de Applied promotions (`stock.md`), para que las dos palabras nunca se crucen en una misma pantalla.
