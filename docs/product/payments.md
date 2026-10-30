# Pagos

El dinero que un **Customer** entrega, y lo que cada Customer debe por eso: su **Balance**, su **Owing since** y la cuenta de sus **Sales** y **Payments**. Lo ve solo su **Business** (ADR-0004). Lee las Sales y sus **On-the-spot payments** de sales (ADR-0007) y los Customers de customers. **Cash** (#7) cuenta los Payments en sus propias fechas. Qué Sale salda un Payment se calcula en el momento y nunca se guarda, igual que el **Cost of goods sold** (ADR-0009, ADR-0010), mientras que los precios de una Sale quedan congelados (ADR-0003). Quién debe se muestra como la sección Owed to you arriba de Customers y como el bloque "Owed to you" de Home; no hay una pantalla Owed to you aparte.

## Jobs

**Cuando** un cliente me paga parte o todo lo que debe, en efectivo o por transferencia, el mismo día o semanas después, **quiero** registrarlo desde el celular en pocos toques y ver que su Balance y su "owing since" bajan en el acto, **para** saber siempre quién me debe qué y desde cuándo, y que nada de lo que pagó o todavía debe se pierda ni caiga en la persona equivocada.

Es el mismo job de "manejar mi negocio desde el celular" que el de cualquier otra capacidad. Reemplaza la única columna pagado/pendiente de la planilla. Saldar una deuda pisaba esa columna, así que no quedaba fecha de pago ni pago parcial.

**Cuando** manejo mi negocio desde el celular entre pedidos o en medio del chat con un cliente, varias veces por día, **quiero** que la app esté armada según lo que hago de verdad y con qué frecuencia, **para poder** volver con el cliente en lugar de buscar entre menús. (El job de **Navigation**, navigation.md: acá lo sirve "Collect" en cada fila de deudor de Customers y de Home, que abre Record payment con el cliente elegido en 2 toques como máximo.)

**Cuando** un cliente me paga mientras charlo con él en el celular, **quiero** abrir Record payment desde su ficha o desde su fila de deudor, registrar el pago y volver enseguida a ese cliente, **para** ver que su Balance baja sin perder mi lugar. (Seguimiento de GH-46: en el celular Record payment es una **Sheet** sobre la pantalla desde la que se abrió, nunca una página propia, y esa pantalla conserva su posición de scroll.)

**Cuando** estoy atendiendo a un cliente con el celular en la mano, **quiero** que la app se comporte como una app de celular (un formulario que llena la pantalla con su acción principal bajo el pulgar, y nada de lo que necesito escondido detrás del teclado), **para poder** registrar un pago sin pelearme con la pantalla ni perder lo que escribí. (El job del Phone layout, navigation.md, GH-319: acá lo sirve Record payment dibujado con el único `Sheet` compartido.)

Criterios de éxito:

1. **Rápido desde el celular**: un Payment se registra en menos de un minuto, con la fecha ya puesta en hoy. Record payment, con el Customer elegido, se abre en 2 toques como máximo desde cualquier **Tab root** ("Collect" en Customers o en Home). Pagar todo lo que se debe lleva un toque ("All").
2. **Los Payments parciales andan solos, primero la deuda más vieja**: el vendedor nunca elige una Sale. Cada Payment posterior salda primero la Sale impaga más vieja del Customer, después la siguiente. Antes de guardar, el vendedor ve qué Sales salda y cuánto queda debiendo. Después de guardar, ve cuánto queda debiendo.
3. **El Balance siempre es correcto**:
   - El Balance es igual a lo que se compró y no se pagó, menos los Payments, al peso.
   - El Owing since es la fecha de la Sale más vieja que no está pagada por completo.
   - Los dos son correctos inmediatamente después de registrar o eliminar cualquier Sale o Payment, y nunca dependen del orden en que se cargaron las cosas.
4. **Quién debe, de un vistazo**: todo Customer que debe, con la deuda más vieja primero, cada uno con su Balance y su Owing since, arriba de Customers. También el **Total owed** y la cantidad de **Sales still owing**, sin calcularlos a partir de las Sales. En Sales, una Sale que todavía se debe aparece marcada como tal.
5. **Una cuenta que se puede seguir**:
   - La cuenta de cada Customer muestra sus Sales y Payments en orden de fecha, con el Balance corrido.
   - Cada Sale dice cómo se pagó o que quedó debiendo.
   - Cada Payment dice su fecha, su método y a qué Sale fue.
   - Un Payment equivocado se puede eliminar, y la cuenta y el Balance lo siguen al instante.
6. **Las fechas de los Payments se conservan**: un Payment conserva su propia fecha y su método, así que Cash (#7) cuenta el dinero el día en que entró, nunca en la fecha de la Sale.
7. **Los Businesses nunca se mezclan, nada se filtra**: un Payment pertenece a un Customer de su propio Business (ADR-0004). El Customer o el Payment de otro Business no existe (404). Ningún monto ni nombre va a un error, un log, la consola ni el almacenamiento del navegador (ADR-0005).
8. **Sin curl, y el navegador no calcula nada**: todo se hace desde el celular. Todo Balance, Owing since y **Settlement** que se muestra sale de la API.
9. **Nunca perder el lugar**: en el celular, Record payment se abre como una Sheet sobre la pantalla desde la que se abrió (la ficha del Customer, Customers o Home) y se cierra con "Close". Guardar o cerrar deja al vendedor de vuelta en esa pantalla, en la posición de scroll que tenía, con el Balance ya más bajo después de guardar. En la computadora es un modal. Los docs de producto, el dibujo y la app construida coinciden en esto.

## Comportamiento

### Payment

- **Campos**: un Customer del mismo Business, una fecha, un monto en pesos enteros mayor que $0 y un método (efectivo o transferencia). No hay **Note**.
- **Fecha**: por defecto es hoy, el día del Business en hora argentina. Se permiten días anteriores; una fecha futura se rechaza.
- **Customer**: obligatorio. El Customer de otro Business no existe (404).
- **Por encima del Balance**: un Payment mayor que el Balance actual del Customer se rechaza, así que registrar nunca crea un **Credit**.
  - El Balance actual cuenta todas las Sales del Customer, sea cual sea la fecha del Payment.
  - A un Customer cuyo Balance es $0 o un Credit no se le puede cargar un Payment.
- **Sin edición**: un Payment no se puede editar. Uno equivocado se elimina y se vuelve a registrar.
- **Eliminación**: una eliminación definitiva, con confirmación previa. Solo se puede eliminar así un Payment posterior.

### Settlement

- **On-the-spot payment**: el Payment registrado junto con una Sale pagada por completo (sales.md, ADR-0007).
  - Salda esa Sale y solo esa Sale, por completo. Nunca participa del recorrido de la deuda más vieja primero.
  - Se elimina junto con su Sale y no se puede eliminar por separado.
- **Payment posterior**: se registra con Record payment. Los Payments posteriores saldan lo que las Sales del Customer dejaron debiendo, primero la deuda más vieja.
  - Las Sales se toman por fecha, después por orden de registro.
  - Los Payments posteriores se aplican por fecha, después por orden de registro.
  - Un Payment que alcanza más de una Sale sigue con la siguiente.
  - **La fecha propia de un Payment nunca limita lo que salda.** Un Payment con fecha anterior a la Sale debida más vieja del Customer igual salda esa Sale. Su fecha dice cuándo entró el dinero (criterio 6), no qué deuda puede pagar.
- **Nada de un Settlement se guarda.** Qué Sale cubre un Payment, el Balance y el Owing since se calculan en el momento a partir de las Sales y los Payments del Customer tal como están ahora.
  - Una Sale o un Payment registrado tarde ocupa su lugar según su propia fecha.
  - Eliminar cualquiera de los dos hace que todo lo posterior se vuelva a calcular.
- **Eliminar una Sale**: los Payments posteriores que la habían saldado se aplican a la siguiente deuda más vieja del Customer, o pasan a ser un Credit.
- **Eliminar un Payment**: lo que saldaba vuelve a deberse.
- **Lo que nunca se mueve**: los precios, las reglas y los totales de línea guardados de una Sale (ADR-0003, ADR-0007), y la fecha, el monto y el método de un Payment. Solo puede cambiar contra qué Sale se muestra un Payment.

### Credit

- Solo eliminar una Sale que unos Payments posteriores habían saldado puede dejar dinero de más. Sigue visible y nunca se lleva a $0:
  - el Balance pasa a ser menor que cero y se muestra como "Credit $ X";
  - el Credit se aplica automáticamente a las próximas Sales del Customer que queden debiendo;
  - no cuenta en ninguna cifra de deuda;
  - un Credit que no debería existir se corrige eliminando el Payment equivocado;
  - la app no registra reintegros.

### Quién debe y los totales

- **Sales still owing**: toda Sale del Business que no está pagada por completo una vez aplicado el Settlement, las pagadas en parte incluidas, cada una contada una sola vez. Una Sale cubierta por un Credit está pagada.
- **Total owed**: la suma de los Balances mayores que $0. Los Credits nunca la restan.

### En pantalla: la sección "Owed to you" de Customers

- **Dónde**: la sección de arriba de Customers (customers.md), sobre todos de la A a la Z. Reemplaza a la antigua pantalla Owed to you, que ya no existe; su ruta vieja redirige a Customers (navigation.md). El título Owed to you de Home abre Customers en esta sección (results.md).
- **Su cabecera**: el Total owed y la cantidad de Sales still owing.
  - La cantidad dice "1 sale owing" cuando es una sola Sale que todavía se debe, y "N sales owing" cuando son dos o más (por ejemplo "4 sales owing"). Es la misma regla de singular y plural que usa el bloque "Owed to you" de Home para la misma cantidad (results.md).
- **Sus filas**: solo los Customers cuyo Balance es mayor que $0, por Owing since (el más viejo primero), los empates por nombre.
  - Cada fila muestra el Balance en ámbar y "since dd/mm", nunca como chip.
  - Cada fila lleva **"Collect"** (nombre accesible "Collect from <name>"), que abre Record payment con ese Customer ya elegido. Tocar el resto de la fila abre la ficha del Customer. En el celular, "Collect" y "Owed to you" son blancos táctiles de al menos 44×44 (navigation.md, Phone layout).
- **Nadie debe**: la sección dice un "Nobody owes you" fijo, sin nada para tocar.
- **La cabecera de Customers** no lleva ninguna cifra de deuda tocable: la sección misma está en pantalla.
- **Búsqueda**: mientras se escribe una consulta, Customers se colapsa en una sola lista plana por nombre (customers.md); un Customer que debe conserva ahí su Balance, "owes you since dd/mm" y "Collect".
- **Los Customers con Credit** nunca aparecen en la sección y no cuentan en ninguna cifra. En todos de la A a la Z muestran "Credit $ X" con el tratamiento neutro/azul, nunca verde ni ámbar.

### En pantalla: la ficha del cliente (`ClienteFicha`)

- Muestra "Owes you $ X since dd/mm" como una etiqueta chica sobre una cifra grande. Para un Credit muestra "Credit $ X", de la misma manera, sin "since". Con un Balance de $0 no muestra ninguno de los dos.
- "Record payment" se muestra solo cuando el Balance es mayor que $0. Si no, está oculto.
- **La cuenta** abre con la etiqueta "Account · running balance" y lista las Sales y los Payments en orden de fecha, con el Balance corrido.
  - Cada fila muestra su fecha, un título con una sublínea debajo, y a la derecha su monto sobre "balance $ X". Un monto nunca se parte entre "$" y su cifra.
  - **Una Sale**: el título "Sale". Su sublínea es una de estas:
    - "Paid in cash" o "Paid by transfer" para una Sale pagada en el momento, que no tiene fila de Payment propia;
    - "Left owing" para una Sale que quedó debiendo;
    - "Nothing to pay" para una Sale cuyo total es $0, saldada sin método y sin nada debido (sales.md).

    La fila no nombra ninguna **Variety** ni gramos: el detalle de la Sale los tiene (sales.md).
  - **Un Payment posterior**: una fila por cada Sale que alcanza, cada una titulada "Payment · <method>" con la sublínea "On account of the sale of dd/mm" y el monto aplicado a esa Sale.
  - **Cualquier parte de un Payment más allá de todas las deudas**: titulada "Payment · <method>" con la sublínea "Credit".
  - Lo que se debe se lee en ámbar. Un "Credit $ X" corrido se lee con el tratamiento neutro/azul, nunca ámbar ni verde.
- **Balance corrido por debajo de cero**: entre un Payment y una Sale de fecha posterior que ese Payment salda, el Balance corrido pasa a ser menor que cero y esa fila dice "Credit $ X".
  - Es solo la cifra corrida, no un Credit, y no cuenta en ninguna cifra.
  - El Balance propio de la ficha dice "Credit" solo cuando el Balance de hoy es menor que cero.
- **"Delete payment"** existe solo en los Payments posteriores.
  - Se confirma con "Delete the $ 15.000 payment (transfer) from 20/09?", "No, keep it / Yes, delete it". La confirmación nombra el Payment, nunca las Sales que cubría.
  - Después, el toast "Payment deleted", sin datos, y la cuenta y el Balance se refrescan desde la API.
  - Un Payment que ya no existe sigue la regla "That is gone." de accounts.md.

### En pantalla: Record payment (`Payment`)

- **Se abre desde**: "Collect" en una fila de deudor de Customers (cualquiera de las dos secciones, o los resultados de búsqueda) o del bloque "Owed to you" de Home, y "Record payment" en la ficha del Customer. Cada uno lo abre con ese Customer ya elegido.
- **Una Sheet en el celular, un modal en la computadora** (navigation.md):
  - En el celular es una Sheet de pantalla completa dibujada con el único `Sheet` compartido (ADR-0062), sobre la pantalla desde la que se abrió (la ficha del Customer, Customers o Home), nunca una página propia. Esa pantalla queda debajo. No tiene manija ni deja asomar la pantalla de atrás.
  - En el celular la Sheet no tiene afuera: "Close" arriba y el gesto de volver del celular, que son la misma acción, son sus únicas salidas. Un toque en la franja de área segura junto a la barra de estado no hace nada.
  - En el celular la acción principal queda fija abajo del formulario, encima del teclado, con los rechazos en línea arriba de ella. El alto de la Sheet sigue al viewport visible.
  - En la computadora es un modal sobre la misma pantalla, exactamente como antes: tocar su fondo lo cierra solo cuando no se escribió nada.
  - Sin barra y sin "+ New sale". "Close", con una confirmación al salir con algo escrito.
  - Guardar o "Close" deja al vendedor de vuelta en la pantalla desde la que se abrió.
  - Cambiar el tamaño cruzando 900 px o rotar el celular conserva lo escrito.
- **Foco al abrir**: en el celular el foco va al primer campo de la Sheet; el modal de la computadora enfoca su título.
- **Volver donde estabas**: al cerrar, con "Close" o al guardar, la pantalla de abajo queda en la posición de scroll que tenía cuando se tocó "Collect" o "Record payment", en el celular y en la computadora.
  - El refresco posterior al guardado actualiza las filas en su lugar y nunca reinicia el scroll.
  - El foco vuelve al "Collect" (o "Record payment") que se tocó.
  - Cuando el Payment salda todo el Balance y la fila del Customer sale de "Owed to you", la lista queda en el mismo desplazamiento y las filas se cierran; nada salta arriba de todo. El foco va al título "Owed to you", o a "Nobody owes you" cuando la sección quedó vacía.
  - Esto vale solo para este flujo; la restauración del scroll en el resto de la app no es parte de los pagos.
- **La Sheet**:
  - "All: $ X" completa el monto con todo el Balance en un toque;
  - la fecha viene completa con hoy;
  - Cash · Transfer, obligatorio.
- **Antes de guardar**, la vista previa de la API muestra qué Sales salda el Payment ("Taken from the oldest debt") y "They still owe $ X" cuando queda algo.
- **Después de guardar**:
  - "Payment saved · still owing $ X" cuando queda algo;
  - "Payment saved" cuando no queda nada.

  Esta es la segunda excepción deliberada a la regla de toast sin datos de accounts.md. La pantalla desde la que se abrió se refresca desde la API, así que el Balance más bajo ya está ahí cuando la Sheet se cierra. En el celular el toast queda arriba de la barra de esa pantalla (navigation.md, Phone layout).
- **Los rechazos** se muestran en línea, arriba de la acción principal, y conservan todo lo escrito:
  - por encima del Balance;
  - fecha futura;
  - monto menor o igual que $0;
  - falta el método.

### Restricciones

- `payment` es la tabla de ADR-0007 y lleva `business_id`. El Business sale de la **Session**.
- Las rutas de Payment se suman al barrido de aislamiento, al test de rutas con acceso restringido y al test de migración de pertenencia.
- Los códigos de rechazo van en `contract.json` (ADR-0008):
  - por encima del Balance;
  - fecha futura;
  - monto menor o igual que $0;
  - falta el método;
  - eliminar un On-the-spot payment;
  - Customer inexistente;
  - Payment inexistente.
- Ningún monto ni nombre en los rechazos, los logs, la consola ni el almacenamiento del navegador (ADR-0005).
- Todo Balance, Owing since, reparto del Settlement, total y cantidad en pantalla se lee de la API.
- El registro de pantallas no tiene clave para "modal en la computadora"; ningún chequeo del registro distingue una Sheet de una página. La **Design capture** y la corrida e2e son la evidencia.
- La rama de computadora de `CobroFrame` no la edita el layout de celular; solo su rama de celular la dibuja `Sheet`.

## Métricas

- **Tiempo de registro (criterio 1)**: un Payment se registra a través del front desde un viewport de celular en menos de 60 s. Desde Customers y desde Home, Record payment se abre con el Customer elegido en 2 toques como máximo. "All" completa todo el Balance en un toque.
- **Matriz de Settlement (criterios 2, 3)**: 100% aprobada. Cubre:
  - la deuda más vieja primero;
  - un Payment parcial;
  - un Payment que abarca varias Sales;
  - un Payment con fecha anterior a la Sale que salda;
  - un On-the-spot payment que se queda con su Sale;
  - independencia del orden de registro;
  - recalcular después de un registro tardío o de la eliminación de una Sale o de un Payment.
- **Identidad del Balance (criterio 3)**: Balance = comprado e impago − Payments, al peso, después de cada alta y eliminación de Sales y Payments.
- **Credit**: después de eliminar una Sale saldada, el Credit se muestra como "Credit", queda fuera de la sección Owed to you, del Total owed y de la cantidad, y se aplica a la próxima Sale que quede debiendo.
- **Totales de quién debe (criterio 4)**: el Total owed, la cantidad de Sales still owing, la sección "Owed to you" de Customers, el bloque de Home y la marca de Sales son iguales a un cálculo directo sobre las Sales y los Payments. 0 diferencias. La línea de cantidad dice "1 sale owing" para una Sale y "N sales owing" para dos o más, las dos cubiertas por los tests del front.
- **Cuenta (criterio 5)**: las filas y el Balance corrido coinciden con el Settlement en cada caso de la matriz. Los tests del front muestran la etiqueta "Account · running balance", el título y la sublínea de cada fila ("Sale" sobre "Paid in cash", "Paid by transfer", "Left owing" o, para una Sale de $0, "Nothing to pay"; "Payment · <method>" sobre "On account of the sale of dd/mm" o "Credit"), el monto sobre "balance $ X" sin corte dentro de un monto, y ninguna Variety ni gramos en la fila de una Sale.
- **Fechas conservadas (criterio 6)**: después de cualquier recálculo, la fecha, el monto y el método de cada Payment quedan sin cambios.
- **Vista previa = guardado (criterios 2, 8)**: la vista previa de Record payment coincide con el Settlement después de guardar. 0 diferencias.
- **Aislamiento (criterio 7)**: toda ruta de Payment está en el barrido y responde 404 o vacío desde otro Business.
- **Sin eco (criterio 7)**: ningún rechazo ni línea de log contiene un monto ni un nombre. Después de una corrida completa del front, la consola y el almacenamiento del navegador no tienen ninguno.
- **Sin curl (criterio 8)**: una corrida end-to-end solo a través del front:
  - registra un Payment desde "Collect" en Customers y desde "Collect" en Home;
  - salda todo con "All";
  - registra un Payment parcial;
  - elimina un Payment;
  - lee la sección "Owed to you" de Customers y su línea de cantidad.
- **Sheet en el celular (criterio 9)**: una corrida end-to-end en un viewport de celular abre Record payment desde "Collect" en Customers, "Collect" en Home y el "Record payment" de la ficha. Verifica cuatro cosas:
  - es una Sheet con la pantalla de abajo todavía montada, no un cambio de pantalla;
  - "Close" vuelve a esa misma pantalla;
  - un guardado vuelve ahí con el Balance leído más bajo;
  - en un viewport de computadora, los mismos accesos abren un modal.
- **Foco y texto escrito (GH-319)**: un test del front muestra el foco en el primer campo cuando se abre la Sheet del celular; un test de cambio de viewport (de celular a computadora y de vuelta) conserva el monto escrito; los tests de cambios sin guardar de Record payment pasan sin editarse; la lista de infractores del **Mobile check** no nombra ningún estado de Sheet recorrido de Record payment.
- **Lugar conservado (criterio 9)**: una corrida end-to-end desplaza Customers y Home de modo que la fila de deudor tocada quede debajo de la primera pantalla, después abre Record payment y lo cierra, una vez con "Close" y una vez con un guardado parcial. Cada vez el desplazamiento queda sin cambios y el foco está en el "Collect" tocado. Después de un guardado que salda todo el Balance, el desplazamiento queda sin cambios y el foco está en el título "Owed to you" (o "Nobody owes you").
- **Acuerdo con el diseño (criterio 9)**: la Design capture de Record payment en el celular muestra que el dibujo y la app construida son los dos una Sheet. La nota de evidencia no deja ninguna diferencia abierta; la manija y el asomo del dibujo son una diferencia conocida, descartada a propósito (ADR-0062).

## Fuera de alcance

- Reintegros.
- Una Note en un Payment.
- Asignar un Payment a una Sale a mano.
- Eliminar un On-the-spot payment por separado; editar un Payment.
- Una pantalla Owed to you aparte.
- Record payment como página propia en el celular (la Sheet de pantalla completa queda sobre la pantalla desde la que se abrió).
- Cerrar tocando afuera en la Sheet de pantalla completa del celular.
- Una clave o un chequeo del registro de pantallas que distinga una Sheet de una página.
- Restaurar el scroll en cualquier lugar que no sea el cierre de Record payment.
- Cash y **Profit**: la capacidad results (#7).
- Actualizaciones en vivo entre socios.
- Las Varieties o los gramos de una Sale en la cuenta del Customer: el detalle de la Sale los muestra.
