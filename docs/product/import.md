## Jobs

**Cuando** paso mi negocio de la planilla a la app, **quiero** que lo que la planilla ya tiene (los productos y su historial de precios, la configuración del Catalog, las Stock entries, las Expenses, y cada venta con quién todavía la debe) se cargue en mi negocio una sola vez, el día en que dejo de usar la planilla, **para poder** seguir vendiendo en la app desde el próximo pedido con mis precios, mi stock y mis deudas reales en su lugar. No vuelvo a tipear meses de filas, y no pierdo la cuenta de quién me debe.

**Cuando** registro a un cliente (desde Customers, en medio de una venta o con la **Spreadsheet import** única) y no tengo su Phone number, **quiero** guardarlo igual con su nombre y agregar el número más adelante si algún día lo consigo, **para poder** registrar cada venta y cada deuda a nombre de la persona que de verdad debe, sin inventar un número ni dejar a esa persona fuera de la app. (Lo sirve acá el archivo opcional de correspondencias; definido en customers.md.)

**Cuando** configuro cómo pone precios mi negocio, registro el precio de un producto o entrego un pedido, **quiero** que la app use solo las Pricing rules que tiene mi negocio, **para poder** cobrarle a cada cliente exactamente lo que quiero, sin que el precio de nadie cambie por sorpresa. (Lo sirve acá activar las reglas que usa la planilla y sumar sus VIP al **VIP type**; definido en pricing-settings.md y customers.md.)

**Cuando** abro la app entre pedidos o al final del día, **quiero** ver qué vendí hoy, quién me debe y qué se está terminando, y actuar en el acto (cobrarle a un deudor, abrir un producto que está bajo, arreglar lo que me dice un aviso), **para poder** volver con el cliente sin recorrer Customers y Products uno por uno ni hacer cuentas. (Lo sirve acá registrar que el Business fue importado, para que le llegue el aviso de Home posterior a la Spreadsheet import; definido en navigation.md y results.md.)

# Spreadsheet import

La carga única del historial de un Business desde la planilla `Control_de_ventas_y_gastos` (una exportación `.xlsx`) en ese Business. La corre el **Operator** de la instalación el día en que el Business pasa a la app. Es un script del Operator, no una ruta ni una pantalla.

Escribe:
- Products e historial de precios (varieties.md);
- Catalog attributes, y el Catalog header and footer (catalog.md);
- Stock entries (stock.md);
- Expense categories y Expenses (expenses.md);
- Customers, y la pertenencia de sus VIP al VIP type (customers.md);
- Sales con sus On-the-spot payments (sales.md);
- los interruptores de precios que necesita (pricing-settings.md);
- el fin del Onboarding del Business, y el hecho de que el Business fue cargado por la Spreadsheet import, con cuándo (navigation.md, onboarding.md).

Cada registro importado es el mismo dato, bajo las mismas reglas, que si se hubiera cargado a mano. Todo lo que escribe pertenece solo al Business de destino (ADR-0004).

Criterios de éxito:

1. **Mirar antes de escribir.** Una corrida de prueba (dry run) informa todo lo que se importaría y cada problema que encuentra, y no escribe nada. La corrida real carga todo o nada. Si se rechaza, el Business queda exactamente como estaba.
2. **El vendedor arranca donde la planilla dejó lo que usa para actuar.** Después de la Spreadsheet import, estas cifras coinciden con los propios registros de la planilla:
   - el Current price de cada Product;
   - el texto del Catalog;
   - el Stock por Product, al centésimo de gramo;
   - el Balance y el Owing since de cada Customer, al peso.

   Toda cifra que no coincide se explica en el informe. No se espera que el Profit ni el Cash coincidan con el Panel de la planilla, porque la planilla calculaba mal el Profit. El Profit y el Cash pasados salen de las propias reglas de la app sobre las filas importadas.
3. **Nada inventado.** El comando nunca adivina un Phone number, nunca importa una fila que la planilla marcó como no terminada, y nunca toma una columna derivada (las columnas `Total`, `Precio x g` y `Revisar` de la planilla). Las cifras derivadas se recalculan con las reglas del producto. Todo lo que no puede dar por bueno se le informa al Operator, que corrige el archivo o la correspondencia y la vuelve a correr.
4. **Un Business, una vez, sin mezclar.** Importa solo en un Business que todavía no tiene registros, y nunca toca un Business con datos. Todo lo importado pertenece solo a ese Business (ADR-0004). La planilla real y los datos de sus clientes nunca entran al repositorio.
5. **Una planilla sin números de teléfono se importa completa.** La corrida sale sin archivo de correspondencias o con uno parcial. El informe dice cuántos Customers entraron sin número y nunca repite un número. Un número que la correspondencia sí da se sigue verificando, y uno mal formado sigue bloqueando.
6. **Los precios de la planilla siguen funcionando.** Un Business cuya planilla usa precios por cantidad o filas `"Amigo"` arranca con esas reglas activadas y con sus VIP en el VIP type, así sus precios y las próximas Sales de sus VIP customers salen como los ponía la planilla.
7. **La app sabe que fue importado.** Una corrida real exitosa registra, en su único commit, que el Business fue cargado por la Spreadsheet import y cuándo, así el aviso de Home posterior a la Spreadsheet import se muestra para él y para ningún otro Business.

## Comportamiento

### Quién la corre, y cómo

- **Quién y cuándo**: un script del Operator, como `scripts/invite-business.sh`. Corre una vez por Business el día del traspaso, después de que el Business se abre con su Invitation de Business nuevo y antes de que el vendedor registre nada.
- **No es una función de la app**: no es una ruta ni una pantalla, y queda fuera del criterio "sin curl" de accounts.md, como `invite-business.sh`.
- **Qué Business**: el Operator nombra el Business de destino en la línea de comandos. Un Business desconocido se rechaza y no se escribe nada.
- **Entradas**:
  - la exportación `.xlsx`;
  - opcionalmente, un archivo que hace corresponder nombre de Customer → Phone number. Dejarlo afuera se comporta exactamente igual que dar un archivo vacío;
  - un interruptor de corrida de prueba.

### Corrida de prueba y corrida real

- **Corrida de prueba**: corre cada chequeo y no escribe nada, sea cual sea el resultado. Lista cada problema en una sola pasada.
- **Corrida real**: carga todo o nada. Cualquier problema que bloquea deja el Business exactamente como estaba.
- **Diferencias**: las dos corridas informan cada fila importada de la pestaña Ventas de la planilla cuyo `Total` difiere del total de la Sale recalculado por la app, envío incluido. El `Total` de la planilla incluye el envío, así que se comparan cosas iguales. Una diferencia nunca bloquea.
- **El informe**, el mismo para una corrida de prueba y para una corrida real exitosa:
  - cantidades por tipo de registro: Products, Price entries, Catalog attributes, Stock entries, Expense categories, Expenses, Customers, Sales y Payments;
  - la cantidad de Customers importados sin Phone number;
  - qué interruptores de precios activa la Spreadsheet import (Bulk price, y el que en pantalla se lee Customer types y que el informe sigue nombrando "VIP customers"), o que no activa ninguno;
  - cada problema que bloquea, con su hoja y su fila;
  - cada fila dejada afuera por no terminada, con el propio texto de la planilla (p. ej. `Falta pago`);
  - cada diferencia de total, con el total de la planilla y el recalculado;
  - las categorías unidas por nombre;
  - las grafías unidas en un solo Customer, y el nombre que se conserva;
  - las líneas de la correspondencia que no se usaron.
- **Qué puede mostrar el informe**: existe solo en la terminal del Operator. Puede nombrar Customers y mostrar montos. Nunca repite un Phone number, ni siquiera uno mal formado. Nada de él va a los logs (ADR-0005). Todo su texto fijo sale del **Copy module**.

### Registrar la Spreadsheet import (navigation.md)

- **Una corrida real exitosa** termina el Onboarding del Business (onboarding.md) y registra que el Business fue cargado por la Spreadsheet import, con el instante de la corrida, las dos cosas dentro del único commit de la Spreadsheet import y a través de puertos que la Spreadsheet import declara (ADR-0006).
- **El registro guarda** solo el Business y ese instante: ningún dato personal, ninguna cantidad y nada de la planilla.
- **Nunca se borra ni se mueve**, y nada más lo escribe. Una corrida rechazada y una corrida de prueba no escriben ninguno de los dos.
- **No es un registro para la elegibilidad**: nunca hace que la Spreadsheet import se rechace.
- **Antes de que existiera**: un Business importado antes de que existiera este registro no tiene ninguno, y no se completa hacia atrás; nunca ve el aviso posterior a la Spreadsheet import.

### Elegibilidad

- La Spreadsheet import se rechaza si el Business tiene algún Product, Price entry, Stock entry, Customer, Sale, Payment o Expense. El rechazo llega antes de cualquier chequeo de la planilla y no cambia nada.
- Estos no cuentan:
  - el Business, su nombre, sus Users y sus Invitations;
  - las Expense categories sembradas, aunque se hayan renombrado o eliminado;
  - el Catalog header and footer sembrados;
  - los interruptores de precios, en cualquier estado;
  - los Customer types, el VIP type incluido (un tipo sin Customers no es un registro);
  - los pasos recordados del Onboarding y el estado de primer uso (navigation.md).
- La Spreadsheet import sobrescribe el header y el footer. Une o agrega categorías, y nunca renombra ni elimina una.

### Leer el archivo

- **Cualquier exportación**: un `.xlsx` guardado por Excel o exportado por Google Sheets se lee igual.
  - Los títulos de la fila 1 se encuentran sea cual sea el tamaño que declara el archivo, incluso ninguno.
  - Las filas de datos se leen hasta la última fila con datos, en la pestaña Ventas, la pestaña Entradas y la pestaña Gastos de la planilla, y en el historial de precios de su pestaña Ajustes.
  - Las celdas y rangos fijos (las pestañas Ajustes y Catálogo de la planilla) se leen en su dirección sea cual sea el tamaño que declara el archivo.
- **Números donde se espera un número entero o gramos**: nunca importa cómo guarda la celda un número, solo su valor.
  - En un campo de número entero (las columnas `% índica`, `Costo total`, `Monto`, `Envío cobrado` y `Precio especial (total)` de la planilla, y el List price y el Bulk price), un número sin parte fraccionaria es ese número entero: `60.0` es 60. Un valor fraccionario se sigue rechazando por la regla del dueño (`60.5` no es un porcentaje).
  - Los gramos, los Bulk minimums y los Low-stock thresholds conservan su valor exacto al centésimo (`3.5` es 3,5 g).
- **Números donde se espera texto**: un número en una celda de texto se lee como su texto, y después sigue las reglas de ese campo como cualquier texto. Esto vale para los nombres de Products, Customers y categorías, las columnas `Detalle`, `Nota` y `Aroma` de la planilla, el header y el footer, y las celdas con un conjunto fijo de valores (las columnas `Origen`, `Pago` y `Tipo` de la planilla, y la columna de mostrado de su pestaña Catálogo).
  - Un número entero se lee como sus dígitos, sin decimales ni separador de miles: `100`, `2024`, `1000`.
  - Un número no entero se lee con coma decimal y la menor cantidad de decimales que da su valor exacto, sin separador de miles: `3,5`, `0,25`.
  - Un número nunca se rechaza solo por ser un número donde se espera texto. Un valor numérico fuera de un conjunto fijo (p. ej. una celda de la columna `Origen` con `3`) igual bloquea por desconocido.
- **Fechas donde se espera texto**: una fecha en cualquiera de esas celdas de texto (p. ej. una celda de la columna `Nota` tipeada como `12/10` que la planilla convirtió en fecha) nunca se lee como texto, porque el archivo ya no guarda lo que se tipeó: el día y el mes pueden estar invertidos por la configuración regional de la planilla y se agregó un año.
  - Bloquea, listada con su hoja y su fila, como una fecha donde se espera texto.
  - El problema le dice al Operator que vuelva a tipear la celda como texto en la planilla (en Google Sheets, empezándola con un apóstrofo) y la vuelva a correr.
  - La corrida de prueba lista todas esas celdas en una sola pasada.
  - Las fechas en columnas de fecha (la columna `Fecha` de la planilla, la fecha de vigencia) se leen como fechas, como siempre.
- **Las pestañas Ventas, Entradas y Gastos de la planilla**: los títulos de columna están en la fila 1 y los datos empiezan en la fila 2. Las columnas se encuentran por su título.
  - **Ventas** lee `Fecha`, `Variedad`, `Gramos`, `Pago`, `Cliente`, `Tipo`, `Envío cobrado`, `Precio especial (total)` y `Nota`. También lee `Total`, solo para saber si una fila está terminada y para informar diferencias.
  - **Entradas** lee `Fecha`, `Variedad`, `Gramos`, `Origen`, `Costo total` y `Nota`, más `Revisar` para saber si una fila está terminada.
  - **Gastos** lee `Fecha`, `Categoría`, `Monto` y `Detalle`, más `Revisar` para saber si una fila está terminada.
  - Las otras columnas de fórmula de la planilla (`Precio x g`, `Rige desde`, `Precio lista`, `Precio por cantidad`, `Cantidad mínima`, `Orden deuda`, `Día`, `Gramos válidos`, `Costo válido`, `Gramos con costo`) nunca se leen. Nada de las columnas `Total` o `Revisar` se guarda nunca.
- **Una columna que falta**: una columna obligatoria que no se encuentra bloquea la corrida. La corrida de prueba lista todas las columnas que faltan de una vez.
- **Filas terminadas y no terminadas**:
  - **Ventas**: una fila está terminada cuando su `Total` es un número. Un texto en `Total` significa que la fila no está terminada: `Falta fecha`, `Falta variedad`, `Faltan gramos`, `Falta pago`, `Falta cliente`, `Sin precio` o cualquier otro texto. Una fila no terminada se deja afuera y se lista con ese texto.
  - **Entradas y Gastos**: una fila está terminada cuando su `Revisar` está en blanco. Cualquier texto en `Revisar` significa que la fila no está terminada, y se deja afuera y se lista con ese texto.
  - Una fila completamente vacía se saltea y no se lista.
  - Las filas no terminadas nunca bloquean.
- **Un archivo que no se recalculó**: una fila de Ventas con alguna celda tipeada completa y el `Total` vacío bloquea la corrida. Un solo mensaje le pide al Operator que recalcule y guarde el archivo. Es el único chequeo de recálculo. En Entradas y Gastos, todo lo que `Revisar` marcaría también lo rechazan las propias reglas de stock.md y expenses.md, así que igual bloquea.
- **Una fila no terminada no agrega nada.** No crea ningún Customer, no hace VIP a nadie, no necesita Phone number y no cuenta al elegir qué grafía de un Customer se conserva.

### Hoja por hoja

- **Products y umbrales** (filas 7–16 de Ajustes, umbrales en F7:F16):
  - Estas filas son la lista completa de Products. Las filas en blanco se saltean.
  - Dos filas con el mismo nombre según la regla de varieties.md (sin importar mayúsculas ni espacios) bloquean.
  - Todo Product nombrado en cualquier otro lado (Catálogo, Entradas, Ventas, historial de precios) debe coincidir con una de ellas, o la Spreadsheet import bloquea.
  - Un umbral en blanco significa ninguno. Un umbral que no es mayor que cero con como máximo dos decimales bloquea.
- **Historial de precios** (Ajustes desde la fila 37: producto, fecha de vigencia, List price, Bulk price, Bulk minimum):
  - una Price entry por fila, con las reglas de varieties.md;
  - dos Price entries de un Product en una misma fecha bloquean;
  - un Bulk price sin Bulk minimum, o al revés, bloquea;
  - un Bulk price que no es menor que el List price bloquea;
  - una Price entry con Bulk price recibe además un VIP price igual a él, que reproduce la regla `"Amigo"` de la planilla. La planilla no tiene columna de VIP price.
- **Catálogo** (filas 6–15: producto, mostrada, emoji, % índica, aroma; B18/B19: header y footer):
  - El "Sí" de la planilla significa mostrada y "No" significa Hidden product. Cualquier otro valor bloquea.
  - Una celda de emoji con texto común o más de un emoji bloquea.
  - Un Indica share que no es un número entero de 0 a 100 bloquea. Un Aroma de más de 200 caracteres bloquea.
  - Un Product sin fila en Catálogo se muestra, sin emoji, porcentaje ni aroma.
  - B18 y B19 reemplazan el header y el footer sembrados. Una celda en blanco da un header o footer en blanco. Más de 500 caracteres bloquea.
- **Entradas** (solo filas terminadas):
  - "Compra" → Purchase, "Cosecha" → Harvest, "Stock inicial" → Opening stock, "Ajuste" → Adjustment. Cualquier otro origen bloquea.
  - Cada fila sigue las reglas de stock.md como si se registrara hoy: gramos, fecha, costo según el origen y nota. Una fila que stock.md rechazaría bloquea.
- **Gastos y categorías** (filas terminadas de Gastos; categorías en Ajustes A21:A28):
  - Cada nombre de A21:A28 se hace coincidir con una categoría existente según la regla de nombres de expenses.md. Un nombre sin coincidencia se crea.
  - Dos nombres de A21:A28 que coinciden entre sí pasan a ser una sola categoría, y el informe lo dice.
  - Una Expense bajo una categoría fuera de A21:A28 bloquea.
  - Cada fila sigue las reglas de expenses.md: una fecha pasada o de hoy, un monto en pesos enteros mayor que $0, y un detalle no en blanco de hasta 200 caracteres.
- **Ventas** (solo filas terminadas): una Sale con una Sale line por fila.
  - **Envío y nota**: el Shipping charged sale de la columna `Envío cobrado`. La Note sigue la regla de sales.md.
  - **El "Pendiente" de la planilla**: la Sale queda debiendo.
  - **"Efectivo" / "Transferencia"**: un On-the-spot payment igual al total recalculado, con ese método, en la fecha de la fila.
  - **Cualquier otro valor de pago** bloquea.
  - **Una fila con total $0**: su valor de pago se ignora y no queda nada adeudado (sales.md).

### Pricing settings

- **Qué activa la Spreadsheet import**:
  - **Bulk price**, cuando alguna Price entry importada tiene Bulk price;
  - **Customer types** (`is_vip_customers`, que el informe nombra "VIP customers"), cuando algún Customer se importa como VIP.
- **Nunca apaga**: la Spreadsheet import nunca desactiva un interruptor. Uno que ya estaba activado sigue activado.
- **Con precio según los interruptores que va a dejar**: cada fila recibe precio como si los interruptores ya estuvieran como los va a dejar la Spreadsheet import, así los interruptores apagados de un Business nuevo nunca cambian cómo se cotiza una fila de la planilla.

### Pricing rules

- **El tipo `""` o `"Lista"` de la planilla**: list o bulk, por la regla del precio más bajo de sales.md, a partir del historial de precios importado en la fecha de la fila y con los gramos de la fila. Nunca VIP, aunque el Customer sea VIP en otra fila.
- **El `"Amigo"` de la planilla**: la regla VIP (sales.md), con el VIP price igual al Bulk price de ese día. El resultado es el Bulk price de ese día, o el List price cuando ese día no tiene, como en la planilla. Un empate con el Bulk price se guarda como VIP.
  - Todo Customer con al menos una fila `"Amigo"` terminada se importa como VIP: entra al VIP type del Business (el Customer type que hizo la actualización, que se encuentra por su marca y nunca por su nombre). La Spreadsheet import crea ese tipo, con el nombre "VIP", cuando el Business no tiene ninguno. La marca VIP congelada nunca se escribe.
  - **Un nombre ocupado detiene la corrida.** Cuando la planilla tiene un VIP customer, el Business no tiene VIP type y otro Customer type se llama "VIP" (sin importar mayúsculas ni espacios, así que " vip " también), la corrida se rechaza antes de escribir nada, tanto en la corrida de prueba como en la real, que lo vuelve a verificar antes de la primera escritura. El informe, con un texto fijo del Copy module, nombra el conflicto y la solución (renombrar o eliminar ese tipo y volver a correrla), sin ningún Customer ni monto. No es una fila no terminada. Un Business que ya tiene su VIP type lo usa, se llame como se llame hoy; una planilla sin ningún VIP customer nunca se verifica.
  - Una fila `"Amigo"` sin Customer bloquea.
- **El `"Regalo"` de la planilla**: un Gift. Se cobra $0 y sus gramos igual salen del Stock. Con envío, el total de la Sale es solo el envío, como en la planilla.
- **Total especial** (la columna `Precio especial (total)` de la planilla): un número entero mayor que $0 hace de la línea un Special price con ese total, sea cual sea el tipo. Una fila `"Amigo"` con total especial igual hace VIP a su Customer.
- **Estos bloquean**:
  - un total especial en una fila `"Regalo"`;
  - una celda de total especial que no es un número entero mayor que $0 (cero, negativo o texto).
- **Qué se guarda**: siempre el precio, la regla y el total recalculados por la app. Una diferencia con la planilla se informa y nunca bloquea. Para conservar la cifra de la planilla, el Operator la pone en la celda de total especial y la vuelve a correr.

### Qué bloquea

Una fila terminada bloquea si las propias reglas del producto la rechazarían al registrarla hoy. Por ejemplo:

- un Product sin precio ese día y sin total especial;
- gramos que no son mayores que cero con como máximo dos decimales;
- una fecha futura;
- un total mayor que $0 sin método de pago;
- una Purchase sin costo;
- una nota, un aroma, un header o un footer demasiado largos.

También bloquean:

- una columna obligatoria que no se encuentra en Ventas, Entradas o Gastos;
- una fila completa de Ventas con el `Total` vacío (el archivo no se recalculó);
- una fecha en una celda de texto (ver Leer el archivo);
- un nombre de Product desconocido, o dos filas de Ajustes 7–16 con el mismo nombre;
- dos Price entries de un Product en una misma fecha;
- un origen o un valor de pago desconocidos;
- una categoría fuera de A21:A28;
- un valor inválido en Catálogo o un umbral inválido;
- un número de la correspondencia que no se normaliza;
- un "Pendiente" sin Customer, o un `"Amigo"` sin Customer;
- un `"Regalo"` con total especial;
- un total especial que no es un número entero mayor que $0;
- un VIP en la planilla con un tipo del vendedor llamado "VIP" y sin VIP type (ver Pricing rules).

Las filas que la planilla marca como no terminadas son la única excepción: se dejan afuera y se listan, y nunca bloquean. Un nombre de Customer que falta en la correspondencia nunca bloquea: ese Customer se importa sin número. Cómo guarda el archivo una celda nunca bloquea por sí solo, con una excepción: una fecha en una celda de texto, porque ya no se puede saber qué se tipeó.

### Customers

- **Quién pasa a ser Customer**: cada nombre de una fila terminada de Ventas, haya debido alguna vez o no. Un nombre que aparece solo en filas no terminadas no crea ningún Customer.
- **Una celda de cliente en blanco**: la fila pasa a ser una Sale without a customer, que se permite solo cuando no queda nada adeudado.
- **Hacer coincidir nombres con la correspondencia**: exacto, después de recortar y colapsar los espacios internos, sin ignorar mayúsculas.
- **Un nombre sin línea en la correspondencia**, o todo nombre cuando no hay archivo de correspondencias, se importa sin Phone number. No es un problema y no se lista; el informe cuenta los Customers importados sin número.
- **Números**: cada número de la correspondencia pasa por la normalización de customers.md. Uno que falla bloquea, y el informe nunca lo repite.
- **Un Customer por nombre**: las filas terminadas de Ventas cuyas celdas de cliente son iguales después de recortar y colapsar los espacios internos (exacto, conservando mayúsculas) son un solo Customer. Una grafía sin correspondencia que difiere de cualquier otra forma es otro Customer; nada se une por suposición.
- **Varias grafías, un número**: cuando grafías con correspondencia se normalizan al mismo número, pasan a ser un solo Customer, y el informe las lista juntas.
  - El Customer recibe el nombre de la grafía de su fila terminada de Ventas más reciente.
  - Si esas filas comparten fecha, gana la fila más baja de la planilla.
  - El vendedor puede renombrar al Customer después.
- **VIP**: un Customer importado como VIP queda en el VIP type del Business (ver Pricing rules), y ningún otro Customer importado recibe tipo.
- **Líneas de la correspondencia sin usar**: una línea cuyo nombre no está en ninguna fila terminada de Ventas no crea ningún Customer y se informa como sin usar.

### Orden

- Dentro de Entradas, y por separado dentro de Ventas, las filas que comparten fecha se registran en el orden de la planilla, de arriba hacia abajo. Ese orden es su orden de registro, así que fija el Lot order (ADR-0010) y el Settlement (ADR-0012) en esa fecha.
- Entre fechas distintas decide la fecha, así que una planilla desordenada igual queda bien.
- Las filas del historial de precios y de la pestaña Gastos no necesitan desempate.

### Restricciones

- **Aislamiento (ADR-0004)**: cada fila creada lleva el Business de destino, y nada es accesible desde otro Business.
- **Sin eco (ADR-0005)**: ningún nombre de Customer, Phone number ni monto va a los logs. El informe existe solo en la terminal del Operator.
- **Datos de prueba**: los tests arman sus propios fixtures chicos de `.xlsx` y de correspondencia, dispuestos como la planilla real (títulos en la fila 1). La planilla real y los datos reales de los clientes nunca entran al repositorio.

## Métricas

A partir de fixtures de test, sin telemetría:

- **Mirar antes de escribir (criterio 1)**:
  - una corrida de prueba escribe 0 filas en todas las tablas, sea cual sea el resultado, y no cambia ningún interruptor;
  - una corrida real rechazada escribe 0 filas y no cambia ningún interruptor;
  - la corrida de prueba lista cada problema que bloquea de un fixture en una sola pasada, cada columna que falta incluida.
- **Cualquier exportación (criterios 1, 3)**: un fixture dispuesto como una exportación de Google Sheets, sin tamaño declarado en ninguna hoja y con cada número guardado como decimal, se lee completo en la corrida de prueba. 100% aprobado. Contiene:
  - números enteros en la columna `% índica`, en precios, costos, montos, envíos y un total especial, todos leídos como enteros;
  - gramos decimales y un umbral decimal, leídos al centésimo;
  - números en celdas de texto (una celda de Detalle o Nota, un nombre de Product, de Customer y de categoría hechos de dígitos, uno de ellos no entero), leídos como dígitos al estilo `100` o con coma decimal.

  Se encuentran todas las columnas y todas las filas, y ninguno de estos se informa como problema. Un porcentaje de `60.5` se sigue rechazando.
- **Fechas en celdas de texto (criterios 1, 3)**: el mismo fixture con una fecha en una celda de Nota, una de Detalle y una de nombre informa cada una, con su hoja y su fila, como una fecha donde se espera texto, con la solución de volver a tipearla como texto. No se lee nada de ellas, y una corrida real sobre ese archivo escribe 0 filas. 100% aprobado.
- **Arranca donde la planilla quedó (criterio 2)**: después de importar un fixture, estas cifras son iguales a las esperadas, con 0 diferencias sin explicar:
  - el Current price de cada Product;
  - el texto del Catalog;
  - el Stock por Product, al centésimo;
  - el Balance y el Owing since de cada Customer, al peso.

  El Profit y el Cash no se comparan con la planilla.
- **Orden de registro (criterio 2)**: un fixture con filas de Entradas y de Ventas de la misma fecha, en fechas desordenadas, obtiene su Lot order y su Settlement primero por fecha y después por orden de la planilla. 100% aprobado.
- **Pricing settings (criterio 6)**: 100% aprobado.
  - Un fixture con precios por cantidad y filas `"Amigo"` termina con los dos interruptores activados y VIP price = Bulk price en cada Price entry con Bulk price, y el informe lista los dos interruptores.
  - Un fixture sin ninguno de los dos termina con los dos apagados.
  - Un interruptor ya activado antes de la Spreadsheet import sigue activado.
  - El precio, la regla y el total guardados de cada fila son iguales a lo que guardaba la Spreadsheet import antes de que existieran los Pricing settings, las filas `"Amigo"` incluidas.
- **El VIP type (criterio 6)**: 100% aprobado.
  - Los VIP de la planilla entran al VIP type existente, aunque esté renombrado.
  - Sin VIP type, se crea exactamente una fila de VIP type, también cuando el VIP type anterior se había eliminado.
  - Sin VIP type y con un tipo del vendedor llamado "VIP" (también " vip "), la corrida de prueba y la real se rechazan con su texto fijo y dejan 0 filas nuevas en todas las tablas.
  - Una planilla sin VIP no hace el chequeo.
  - Ninguna corrida escribe la marca VIP congelada `customer.vip`, probado con un registro de sentencias.
- **Spreadsheet import registrada (criterio 7)**: 100% aprobado.
  - Una corrida real exitosa registra el hecho de la Spreadsheet import con el instante de la corrida, en el mismo commit que todo lo demás.
  - Una corrida de prueba y una corrida real rechazada no registran nada.
  - El registro nunca hace que un chequeo de elegibilidad posterior se rechace.
  - La Business removal lo exporta y lo elimina, y es invisible desde otro Business en el barrido de aislamiento.
- **Nada inventado (criterio 3)**:
  - una matriz de cada caso que bloquea pasa al 100%, incluidas una columna que falta y una fila completa de Ventas con el `Total` vacío;
  - las filas de Ventas con texto en `Total`, y las de Entradas y Gastos con texto en `Revisar`, se dejan afuera y se listan con ese texto, sin bloquear;
  - un nombre, un `Amigo` o una grafía que aparece solo en filas no terminadas no crea ningún Customer, ningún VIP ni ningún nombre conservado;
  - un conjunto de referencia de diferencias de total, con y sin envío e incluido un `Regalo` con envío, se informa y nunca bloquea;
  - las categorías unidas, las grafías unidas y las líneas de correspondencia sin usar aparecen todas en el informe.
- **Un Business, una vez (criterio 4)**:
  - una Spreadsheet import en un Business con cualquiera de los siete tipos de registro se rechaza con 0 filas escritas, probado para cada tipo;
  - un Business con solo categorías sembradas, renombradas o eliminadas, el header y el footer sembrados, y cualquier estado de los interruptores se acepta;
  - las filas importadas son invisibles desde otro Business en el barrido de aislamiento.
- **Sin números de teléfono (criterio 5)**: 100% aprobado.
  - un fixture sin archivo de correspondencias se importa completo, cada Customer sin número;
  - un fixture con una correspondencia parcial importa los nombres sin correspondencia sin número y los que la tienen con el suyo;
  - la cantidad de Customers sin número del informe es igual a los Customers guardados sin ninguno, en la corrida de prueba y en la real;
  - un número de la correspondencia mal formado sigue bloqueando;
  - los nombres sin correspondencia que son iguales después de recortar y colapsar espacios pasan a ser un solo Customer, y los que difieren de otra forma quedan separados.
- **Sin eco**: después de una corrida sobre un fixture con nombres, números y montos, ninguna línea de log contiene ninguno de ellos, y el informe nunca contiene un Phone number.

## Fuera de alcance

- Importar en un Business que ya tiene registros; volver a correrla, retomarla o unir.
- Una pantalla o ruta de Spreadsheet import en la app.
- Importar columnas derivadas, o reproducir el Profit y el Cash de la planilla.
- Importar filas que la planilla marca como no terminadas, o lo que nombran.
- Inventar Customers, Phone numbers, categorías o Products para que una Spreadsheet import pase.
- Unir nombres de Customers escritos distinto que no tienen número en la correspondencia.
- Volver a leer como texto una fecha que la planilla armó a partir de lo que se tipeó en una celda de texto.
- Agrupar varias filas en una sola Sale con varias líneas.
- Deshacer una Spreadsheet import una vez hecha.
- Cómo se lee un Phone number guardado como número en la correspondencia (#54).
- Una columna de VIP price en la planilla; desactivar un interruptor de precios.
- Resolver sola un choque con un tipo del vendedor llamado "VIP" (adoptarlo, renombrarlo o crear el VIP type con otro nombre).
- Completar hacia atrás el hecho de la Spreadsheet import para un Business importado antes de que existiera.
