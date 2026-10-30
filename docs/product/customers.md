# Clientes

Las personas a quienes un **Business** le vende, cada una identificada dentro de ese Business por su propio registro, y vistas solo por ese Business (ADR-0004). El nombre es la forma en que un **User** reconoce a un **Customer**; el **Phone number** es un dato de contacto opcional.

Las **Sales** y los **Payments** se apoyan en esta capacidad: toda Sale y toda deuda pertenece a un Customer de acá. Un **VIP customer** paga el **VIP price** de una **Variety** cuando lo tiene y es menor que lo que da cualquier otra regla. Esto vale solo en un Business con la opción VIP customers activada (pricing-settings.md, sales.md).

El **Balance**, el **Owing since** y la cuenta de un Customer se definen en `payments.md` y se muestran en su ficha y en la sección "Owed to you" de Customers.

## Jobs

**Cuando** entrego un pedido o recibo un pago, **quiero** encontrar al cliente por parte de su nombre o de su número, o registrarlo en el momento si es nuevo, **para que** cada venta y cada deuda caiga en una persona real y yo sepa siempre quién me debe.

**Cuando** registro a un cliente (desde Customers, en medio de una venta o con la **Spreadsheet import** única) y no tengo su Phone number, **quiero** guardarlo igual con su nombre y agregar el número más adelante si algún día lo consigo, **para poder** registrar cada venta y cada deuda a nombre de la persona que de verdad debe, sin inventar un número ni dejar a esa persona fuera de la app.

VIP y corregir los datos de un cliente sirven a los mismos jobs. En un negocio con VIP customers, a un cliente marcado como VIP una sola vez se le cobra su VIP price en cada venta en la que es el más bajo, así que el vendedor nunca tiene que acordarse de quién es amigo.

**Cuando** configuro cómo fija sus precios mi negocio, registro el precio de una variedad o entrego un pedido, **quiero** que la app use solo las **Pricing rules** que tiene mi negocio (un **Bulk price** si vendo por cantidad, y un VIP price que fijo por variedad si tengo VIP customers), **para poder** cobrarle a cada cliente exactamente lo que quiero sin escribir un **Special price** a mano, sin ver campos que no me aplican y sin que el precio de nadie cambie de sorpresa. (Lo sirve acá la marca VIP que sigue a VIP customers; definido en pricing-settings.md.)

**Cuando** manejo mi negocio desde el celular, **quiero** mantener al día mis clientes desde el celular, **para poder** dejar de tenerlos en la planilla y tener datos reales cuando lleguen las ventas.

**Cuando** un cliente me paga parte o todo lo que debe, en efectivo o por transferencia, el mismo día o semanas después, **quiero** registrarlo desde el celular en pocos toques y ver que su Balance y su "owing since" bajan en el acto, **para** saber siempre quién me debe qué y desde cuándo, y que nada de lo que pagó o todavía debe se pierda ni caiga en la persona equivocada. (Lo sirve acá la sección "Owed to you" de Customers y su "Collect", y el Balance, la cuenta y Record payment de la ficha; definido en `payments.md`.)

**Cuando** manejo mi negocio desde el celular entre pedidos o en medio del chat con un cliente, varias veces por día, **quiero** que la app esté armada según lo que hago de verdad y con qué frecuencia, **para poder** volver con el cliente en lugar de buscar entre menús. (El job de **Navigation**, navigation.md: lo sirve acá Customers, que se abre en quién debe, con "Collect" en cada fila de deudor.)

**Cuando** un cliente me paga parte o todo lo que debe, o entre pedidos quiero saber quién todavía me debe y desde cuándo, **quiero** que Customers se abra en quién me debe (el total, y cada deudor con la deuda más vieja primero, con su Balance y desde cuándo) y cobrarle a cualquiera en un toque, **para poder** mantener cada Balance al día y perseguir primero las deudas más viejas, sin abrir fichas una por una, hacer cuentas ni completar campos que nunca uso.

Esto afina el job de pagos y el job de Navigation de arriba para Customers (GH-46); no es un job nuevo. Su protagonista es el vendedor, en el celular; la computadora, con dos paneles, es el mismo job en una pantalla más grande. Tiene dos momentos: cobrar (el principal: un cliente entrega plata, en medio del chat o al entregar) y revisar (entre pedidos o al final del día). Antes, quién debía vivía en una pantalla Owed to you aparte, cobrar una deuda llevaba cuatro toques desde Customers, y el formulario del cliente pedía un canal (Telegram o WhatsApp) que nada del producto usaba.

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
8. **VIP sigue al interruptor y nunca se pierde.**
   - Mientras VIP customers está apagado, ninguna marca ni campo VIP se muestra en ninguna pantalla de Customer.
   - Al encenderlo de nuevo, toda marca VIP guardada vuelve como estaba, incluso para los Customers editados mientras estuvo apagado.
9. **Cobrar rápido.** Record payment se abre con el Customer elegido en 2 toques como máximo desde cualquier **Tab root** ("Collect" en una fila de Customers o en una fila de Home). Un Payment se registra en menos de un minuto, y "All" salda todo el Balance en un toque. En una computadora no lleva más toques que en el celular.
10. **Quién debe, de un vistazo.** Customers se abre en "Owed to you": el **Total owed**, la línea de cantidad ("1 sale owing" o "N sales owing") y cada deudor con el Owing since más viejo primero, cada uno con Balance y "since dd/mm". Todos de la A a la Z quedan abajo. Toda cifra sale de la API y es igual al bloque "Owed to you" de Home y a un cálculo directo. Sin scrollear la lista de la A a la Z y sin sumas.
11. **La ficha cierra el circuito.** Desde la ficha de un Customer el vendedor ve su Balance y su cuenta, "Record payment" (cuando debe) y "New sale to <name>", con ese Customer ya elegido.

## Comportamiento

- **Customer**: un nombre, un Phone number opcional y VIP. Un Customer se identifica por su propio registro (su id), nunca por su número. Su Balance y su Owing since se calculan a partir de sus Sales y Payments (`payments.md`) y nunca se guardan en el Customer.
- **Nombre**: obligatorio. Recortado, con los espacios internos colapsados, hasta 60 caracteres. No es único.
- **Sin canal**: el antiguo canal (Telegram o WhatsApp) se quitó del dominio, la API, los formularios, la ficha, la lista, el Business export y la base de datos.
  - Un pedido que todavía manda uno se completa bien: el canal se ignora, nunca se guarda, y ninguna respuesta lo lleva. El vendedor no ve diferencia, porque ningún formulario ofrece el campo.
  - **Los valores guardados se descartan para siempre.** La migración que elimina la columna no conserva copia en ningún lado; el producto no puede recuperarlos, y la eliminación no se puede deshacer desde adentro.
  - **Supuesto**: ningún vendedor va a necesitar los valores viejos del canal; quien los necesite igual puede encontrar al Customer por nombre o por número.
- **VIP**: sí o no, `false` por defecto. Se puede editar.
  - Un cambio se aplica a las Sales registradas desde ese momento; las Sales ya registradas conservan sus precios guardados (ADR-0003).
  - En la lista de Sales, la insignia VIP de una Sale muestra el estado actual del Customer, no cómo se fijó el precio de esa Sale (sales.md).
  - Cuenta solo mientras VIP customers está activado (pricing-settings.md). Cómo se fija el precio de la **Sale line** de un VIP lo define sales.md.
  - **Mientras VIP customers está apagado**:
    - la marca sigue guardada;
    - guardar un Customer nunca la cambia, sin importar lo que mande el pedido;
    - un Customer creado entonces no es VIP.
- **Phone number**: opcional, único dentro del Business entre los Customers que tienen uno, guardado en una sola forma internacional.
  - **Ninguno**: un valor faltante, `null`, o uno en blanco tras recortar significa que el Customer no tiene número. Se guarda como sin número, nunca como string vacío.
  - **Con `+` y un código de país distinto de 54**: un número extranjero. Se guarda como `+` y sus dígitos, y debe tener de 8 a 15 dígitos.
  - **Con `+54`, o un `54` a secas**: si lo siguen 10 dígitos, o un `9` y 10 dígitos, es un número argentino con su código de país. Se guarda como `+549` y los 10 dígitos.
  - **Cualquier otra cosa sin `+`**: un número argentino local. Se descartan un `0` inicial y el `15`, y deben quedar exactamente 10 dígitos, código de área incluido. Se guarda como `+549` y esos 10 dígitos.
  - **Los teléfonos fijos** no se rechazan: todo número argentino se trata como celular.
  - **Rechazado**: un valor no en blanco que no encaja en ninguna de estas reglas, como demasiado corto, demasiado largo o sin código de área. El rechazo dice algo como "that doesn't look like a phone number with its area code" y nunca repite lo que se escribió.
  - `11 2345-6789`, `011 15 2345-6789`, `+54 9 11 2345 6789`, `5491123456789` y `541123456789` pasan todos a ser `+5491123456789`.
- **Unicidad**: un número ya usado por otro Customer del mismo Business se rechaza, tanto al registrar como al editar. El rechazo nunca repite el número ni el nombre. Cualquier cantidad de Customers puede no tener número. Los números de otros Businesses nunca chocan y nunca se revelan.
- **Edición**: nombre, Phone number y VIP (VIP solo mientras VIP customers está activado).
  - El Phone number pasa por la misma normalización, el mismo chequeo de unicidad y el mismo rechazo que al registrar.
  - Se puede borrar, y el Customer queda sin número.
  - Las Sales, los Payments y el Balance pertenecen al Customer, no al número, así que siguen asociados cuando este cambia o se quita.
- **Lista y búsqueda**: una sola consulta.
  - El nombre coincide con la consulta en cualquier parte, sin importar mayúsculas ni acentos.
  - El número coincide con los dígitos de la consulta, sin un 0 inicial, en cualquier parte de los dígitos del número guardado. Un Customer sin número nunca coincide por número, y una consulta sin dígitos no coincide con ningún número.
  - Un Customer coincide si coincide el nombre o el número; un Customer sin número se encuentra por nombre.
  - Una consulta vacía devuelve todos los Customers.
  - Los resultados se ordenan por nombre.
  - No hay paginación, ni largo mínimo de consulta, ni filtro VIP, ni filtro para los Customers sin número.
- **Almacenamiento**: la columna del teléfono admite nulos; la unicidad dentro de un Business se aplica solo a los números guardados. Los Customers que existían antes de que el número fuera opcional conservaron sus números. La columna del canal se elimina con una migración en la cadena única de Alembic; todas las demás columnas y el nombre, el número, el VIP, las Sales, los Payments y el Balance de cada Customer quedan exactamente como estaban.
- **Business export** (accounts.md, ADR-0015): sigue el esquema, así que los Business exports nuevos y el registro de tablas y columnas de la **Business removal** no llevan canal. Los Business exports escritos antes del cambio conservan lo que tenían; nada importa un Business export de vuelta. Las cantidades exportadas siguen siendo iguales a las eliminadas.
- **Aislamiento (ADR-0004)**:
  - El Business sale de la **Session**.
  - El Customer de otro Business responde 404 tanto al leer como al editar.
  - Las listas y búsquedas no muestran ninguno de los Customers de otro Business.
  - Las rutas de Customer están en `tests/test_business_isolation.py`.

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
- **La marca VIP** se muestra en la lista y en la ficha solo mientras VIP customers está activado. Mientras está apagado, no se muestra nada en su lugar.
- **Búsqueda** por parte del nombre o del Phone number: mientras se escribe una consulta, las dos secciones se colapsan en una sola lista plana ordenada por nombre, con las coincidencias como arriba; un Customer que debe conserva su Balance, "owes you since dd/mm" y "Collect". Borrar la consulta trae de vuelta las dos secciones.
- **La ficha de un Customer** (`ClienteFicha`), una tarjeta con "‹ Customers":
  - teléfono (solo cuando hay uno; sin ninguno, la línea se omite por completo) y VIP (solo mientras VIP customers está activado);
  - "Owes you $ X since dd/mm" o "Credit $ X" (ninguno para un Balance de $0), la cuenta, "Record payment" solo cuando el Balance es mayor que $0, y "Delete payment" en los Payments posteriores (`payments.md`);
  - **"New sale to <name>"**, que abre New sale con ese Customer ya elegido (sales.md). La ficha no muestra "+ New sale".
  - Agregar un número más adelante es la edición ordinaria de la ficha; no hay ningún aviso para completarlo.
- **Record payment** (`Payment`) sigue payments.md sin cambios y su diseño, `Cobro.dc.html`, abierto con el Customer elegido desde una fila de deudor o desde la ficha.
- **Alta y edición**: el único formulario "New customer" de `NuevaVentaCliente`, el mismo desde Customers y desde "Pick a customer" en New sale.
  - Sus campos son "Name" (el único marcado como obligatorio), el teléfono (opcional, y se puede borrar al editar) y VIP. VIP se muestra solo mientras VIP customers está activado. No hay campo de canal.
  - El mismo formulario registra a un Customer desde dentro de una Sale, a través de la **Sheet** "Pick a customer", y ese Customer se usa para la Sale.
  - Es un formulario: "Close", y una confirmación al salir con cambios sin guardar.
- **Si sale bien**, el toast "Customer saved". Nunca lleva un nombre ni un número.
- **Los rechazos** se muestran en línea sobre el campo, con el string fijo del dominio, y conservan lo que se escribió. Nunca repiten el número ni el nombre.
- **Diseño**: Customers, `ClienteFicha`, `Payment` y `NuevaVentaCliente` coinciden con `docs/product/design-system/pantallas/` en celular y computadora, en los dos temas. Una diferencia de texto respecto de los docs se lista en el PR. Ningún estado se dice solo con color.
- **Respuesta de la app**: sin red muestra "No connection", un error del servidor el reintento genérico, y un Customer que ya no existe sigue la regla "That is gone." de accounts.md.

## Métricas

- **Números duplicados**: Customers que comparten un número guardado dentro de un Business, 0. Una restricción de la base de datos lo impone y un test lo cubre. (Criterio 2)
- **Sin choque sin número**: dos o más Customers sin número coexisten en un Business, probado. (Criterios 2, 5)
- **Matriz de normalización**: toda forma equivalente se resuelve en un solo número, toda forma inválida no en blanco se rechaza, y un valor en blanco se guarda como sin número. 100% aprobada. (Criterios 2, 6)
- **Sin eco**: ningún cuerpo de rechazo ni toast contiene el número enviado, ninguna de sus secuencias de dígitos ni el nombre de un Customer. Después de una corrida completa del front, la consola y el almacenamiento del navegador no tienen ningún nombre, número ni monto. (Criterios 2, 6)
- **Cobertura de aislamiento**: toda ruta de Customer está en el barrido de aislamiento y en el test de rutas con acceso restringido, y responde 404 o vacío desde otro Business. (Criterio 3)
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
- **VIP sigue al interruptor (criterio 8)**:
  - los tests del front no muestran ninguna marca VIP en la lista ni en la ficha, ni ningún campo VIP en el formulario, mientras VIP customers está apagado;
  - una edición o un pedido que manda VIP mientras está apagado deja sin cambios la marca guardada, y un Customer creado entonces no es VIP;
  - volver a encenderlo muestra toda marca guardada como antes.
- **Cobrar rápido (criterio 9)**: la corrida end-to-end del front, en viewports de celular y de computadora, toca "Collect from <name>" desde una fila de Customers y desde una fila de Home; Record payment se abre con el Customer elegido en 2 toques como máximo desde cada Tab root, nunca más en la computadora; "All" completa todo el Balance en un toque; se registra un Payment desde un viewport de celular, y un movimiento de volver regresa a la pantalla de la que vino. Ningún test mide la duración.
- **Quién debe, de un vistazo (criterio 10)**:
  - los tests del front muestran Owed to you arriba de todos de la A a la Z, la línea de cantidad en sus dos formas, los deudores con el más viejo primero y los empates por nombre, y "Nobody owes you" arriba de una lista completa de la A a la Z cuando nadie debe;
  - el total, la cantidad y el Balance y la fecha de cada deudor son iguales al bloque de Home y a un cálculo directo sobre las Sales y los Payments: 0 diferencias;
  - los Customers con Credit no están en ninguna sección ni en ninguna cifra, y muestran "Credit" solo en la lista de la A a la Z.
- **El layout de Customers**: los tests del front muestran "Collect" con su nombre accesible en cada fila de deudor (las dos secciones y los resultados de búsqueda), la búsqueda colapsando todo en una sola lista ordenada por nombre y las secciones volviendo cuando se borra.
- **La ficha (criterio 11)**: los tests del front y la corrida end-to-end muestran "Record payment" solo con un Balance mayor que $0, y "New sale to <name>" abriendo New sale con ese Customer elegido; la ficha no muestra "+ New sale".
- **Sin regresiones**: las suites existentes de customers, payments y navigation pasan sin aflojar ninguna aserción.
- **Sin curl**: la corrida end-to-end del front agrega, encuentra y edita un Customer, agrega uno sin número, abre Record payment desde "Collect" con el Customer elegido, y abre "New sale to <name>" con ese Customer elegido. (Criterio 4)
- **Diseño**: `scripts/design/compare.sh` se corre antes y después para Customers, `ClienteFicha`, `Payment` y `NuevaVentaCliente`, celular y computadora, claro y oscuro donde el registro tiene los dos, adjunto al PR y juzgado a ojo, con cada diferencia respecto del diseño listada.
- El Balance, la cuenta y las métricas de cifras de Owed to you viven en `payments.md`.

## Fuera de alcance

- Eliminar un Customer: va a tener Sales y Payments.
- Unificar duplicados; importar desde la planilla (import.md).
- Una nueva clave única para los Customers.
- Un filtro VIP; un filtro, lista, insignia, orden o aviso para los Customers sin número.
- Un canal de Customer, o cualquier reemplazo para él; guardar una copia de los valores viejos del canal en cualquier lado.
- Una pantalla Owed to you aparte; una cifra de deuda tocable en la cabecera de Customers; cualquier filtro u orden de Customers más allá de lo definido acá.
- Importar de vuelta un Business export viejo.
- Otras reglas VIP (un porcentaje de descuento sobre el **List price**); activar o desactivar VIP customers (pricing-settings.md).
