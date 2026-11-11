## Jobs

**Cuando** un cliente me paga, en la venta o más tarde, **quiero** registrar cómo me pagó con los medios que mi negocio de verdad acepta, nombrados a mi manera, **para** que cada pago me diga después cómo me llegó la plata, sin que la app decida por mí que la plata es efectivo o transferencia.

**Cuando** un cliente me paga, con una venta o a cuenta de una deuda, **quiero** decir cómo me pagó con el mismo control que uso para cualquier elección que puede crecer, **para** registrar el medio a propósito y nunca por un valor que quedó de antes; y cuando los Payment methods pasen a ser mi propia lista, registrar un pago se tiene que sentir igual. (El job de la parte 5 de GH-581, payments.md y sales.md: esta capacidad cumple su segunda mitad.)

# Payment methods

La lista propia de cada **Business** de las formas en que le pagan sus **Customers**. Es un **Growable set**, así que se elige solo con el **Selector** y nunca se declara en `fixedSets.ts` (ADR-0074). Cada **Payment** apunta a un medio por su id (`payment_method_id`); la columna vieja `payment.method` queda congelada con el valor que tenía y ya no se lee ni se escribe (ADR-0084). La configuración se guarda por Business en su propio hexágono `payment_methods` (ADR-0055). Hasta esta parte los medios eran Cash y Transfer, incorporados en la app; eso fallaba **Assume nothing**, que nombra a los Payment methods como algo que la app no puede fijar en el código. Parte 24 de GH-318.

Supuesto sobre hoy: la vendedora registra efectivo o transferencia y guarda el canal real en la cabeza o, en una venta, en la **Note**; la información se pierde.

Criterios de éxito:

1. **Mi lista, sin código**: desde Settings en el teléfono, la vendedora agrega un medio (por ejemplo "Mercado Pago") con nombre e ícono y lo pone en el orden que quiere. Después aparece en New sale y en Record payment en ese orden, sin ningún cambio de código.
2. **Nada de antes cambia**: todo Business existente y todo Business nuevo arranca con "Cash" y "Transfer". Todo Payment ya registrado sigue mostrando el medio con que se registró, y nada registrado antes cambia.
3. **Los mismos toques**: registrar una venta o un pago en el teléfono lleva los mismos pocos toques que antes, y una venta sigue llevando menos de un minuto. Elegir el medio cuesta como máximo un paso (abrir el campo, tocar la opción) y nunca viene puesto.
4. **Dejar de ofrecer sin perder historia**: un medio que la vendedora ya no acepta deja de ofrecerse para Payments nuevos, y los Payments pasados lo siguen mostrando.
5. **Los Businesses nunca se mezclan**: los medios de un Business nunca se ven ni se usan desde otro (ADR-0004).

## Comportamiento

### Payment method

- **Campos**: `business_id`, nombre, ícono y posición, más si está archivado.
- **Nombre**: único en el Business sin importar mayúsculas, minúsculas ni espacios, los archivados incluidos. No puede quedar en blanco después de recortar y tiene hasta 60 caracteres.
- **Renombrar**: se permite en cualquier momento. Los Payments pasados muestran el nombre nuevo, porque un Payment apunta al medio y no a su texto. Es a propósito, a diferencia de una **Price entry**. Quien quiera conservar el nombre viejo como historia agrega un medio nuevo y archiva el viejo.
- **Ícono**: se elige de un conjunto fijo y neutro, nunca texto libre: `banknote`, `coins`, `card`, `bank`, `phone`, `wallet`, `qr`, `other`. Nada en él es propio de la flor, de un país, de un banco ni de una marca. Un medio nuevo recibe `other` por defecto, así que nunca hay que elegir uno. En Settings el ícono va al lado del nombre y nunca lo reemplaza (**Icon and text rule**); en el Selector de New sale y Record payment cada medio se muestra solo por su nombre, sin ícono.
- **Orden**: la posición la fija la vendedora; New sale y Record payment muestran los medios ofrecidos en ese orden, y el Selector nunca los reordena.

### Los valores por defecto

- Un Business nuevo recibe "Cash" (`banknote`) y "Transfer" (`bank`), en ese orden, en su **Stored language** al abrirse. Un cambio de idioma posterior nunca los renombra, igual que los **Withdrawal reasons** y las **Expense categories**.
- Los Businesses existentes reciben "Cash" y "Transfer" en inglés, porque todos tienen inglés como Stored language. La migración solo agrega la tabla, sus filas y la columna nueva `payment.payment_method_id`, que llena enlazando cada Payment existente (los On-the-spot payments incluidos) con el medio que corresponde a su valor de hoy (`cash` → "Cash", `transfer` → "Transfer"). No cambia el valor de ninguna columna existente, y el comparador M3 compartido lo prueba.
- "Cash" y "Transfer" son medios comunes: se pueden renombrar, reordenar, archivar o eliminar con las mismas reglas que cualquier otro. Ningún código los distingue por su nombre.
- **Spreadsheet import**: las palabras cash/transfer de la planilla se resuelven al nombre por defecto del Business. Si hay un medio ofrecido con ese nombre se reutiliza; si no hay ninguno, se agrega al final con el ícono `other`; si lo tiene un medio archivado, la importación entera se rechaza con `import.payment_method_archived` (import.md).

### Nunca vacía

- La lista nunca tiene cero medios ofrecidos. Archivar o eliminar el último medio ofrecido se rechaza (`payment_method.last_offered`), y la pantalla dice por qué: "You need at least one payment method. Add another one first."

### Eliminar y archivar

- **Sin Payments**: un medio sin ningún Payment se puede eliminar para siempre, con confirmación previa ("Keep it" para no hacerlo).
- **Con Payments**: solo se puede archivar, con confirmación previa. Eliminarlo se rechaza (`payment_method.in_use`).
  - Archivarlo lo saca de todo Selector para Payments nuevos.
  - Los Payments pasados lo siguen mostrando con su nombre.
  - Conserva reservado su nombre: no se puede crear otro medio con ese nombre; el rechazo manda a restaurarlo desde Archived.
  - Se ve y se restaura solo desde "Archived", dentro de Settings → Payments and expenses → Payment methods. Al restaurarlo vuelve exactamente como estaba: su nombre, su ícono y su propia posición guardada.
- **"Paid later" no es un medio**: que una Sale quede debiendo (Owing) es un estado, nunca un medio. La vendedora no puede agregarlo a la lista ni archivarlo.

### Elegir un medio (New sale y Record payment)

- El campo "Payment method" es un Selector obligatorio, el mismo en New sale (bajo Paid) y en Record payment. Sus opciones son los medios ofrecidos del Business, leídos del servidor (`GET /api/payment-methods`, sin caché vieja), en el orden de la vendedora.
- **Nunca viene puesto**: abre vacío, sin valor por defecto, sin opción "Select…" y sin fila para borrar. En New sale vuelve a quedar vacío cada vez que se vuelve a Paid; Record payment nunca recuerda un medio entre Payments. (payments.md criterio 10, sales.md criterio 34.)
- **Carga**: mientras la lista no se cargó con éxito, el campo queda en `loading`: deshabilitado, con su esqueleto, nunca vacío.
- **La lista no carga** (decisión 21 del humano): sin conexión se muestra el aviso "Sin conexión" de Estados; con un error del servidor la lista dice "Could not load the payment methods. Tap to try again." y tocar el campo de nuevo vuelve a leerla. En los dos casos no se pierde nada de lo escrito.
- **Conjunto vacío**: no debería verse nunca, porque siempre hay al menos un medio ofrecido. El texto existe en el Copy module (`emptyStates.selectorNoPaymentMethods`: "No payment methods yet. Add one in Settings → Payment methods.") y nombra un camino que no es el real (Settings → Payments and expenses → Payment methods); queda como observación para corregir su redacción.
- **Búsqueda**: con más de 8 medios ofrecidos, la lista tiene búsqueda.
- **Sin medio al guardar**: "Choose how they paid." junto al campo, como hoy. Un medio solo se pide cuando entra plata: Owing nunca lo muestra ni lo pide, y una venta de $0 no lo necesita.
- **Un medio que dejó de ofrecerse con el formulario abierto** (una socia lo archivó o lo eliminó): el guardado se rechaza con 404 `payment_method.unavailable`, el campo muestra el medio elegido con la marca "no longer available", la lista se vuelve a leer y se conserva todo lo escrito. Record payment agrega además la frase "That payment method is no longer available. Choose another one."; New sale muestra solo la marca en el campo. Elegir un medio ofrecido saca la marca.
- **El medio de un Payment nunca cambia** una vez registrado. Un Payment equivocado se elimina y se vuelve a registrar; para un On-the-spot payment, se elimina la Sale y se vuelve a registrar.

### Cómo se muestra el medio

- En la cuenta del Customer, una Sale pagada en el momento dice "Paid · <medio>" (`CUSTOMERS_TEXT.paidWith`), con el `payment_method` que la API trae en la fila de la Sale; reemplaza a "Paid in cash" / "Paid by transfer". Solo una fila sin medio diría "Paid" a secas.
- Un Payment posterior se titula "Payment · <medio>", y la confirmación de eliminarlo nombra el medio ("Delete the payment of $ X (<medio>) from dd/mm?").
- Siempre es el nombre actual del medio, archivado o no: después de renombrarlo, las filas pasadas muestran el nombre nuevo.
- El **Sale bill** informa una Sale pagada en el momento como `paid`, sin nombrar el medio (sale-bill.md).
- **Cash** sigue contando todo Payment como hoy, sea cual sea su medio.

### En pantalla: Settings → Payments and expenses → Payment methods

- Camino (decisión 21 del humano, como el dibujo `ConfiguracionCobros`): Settings → **Payments and expenses** → **Payment methods**, 3 toques desde cualquier pantalla principal (avatar → Payments and expenses → Payment methods). No está dentro de Business.
- **Payments and expenses** es un grupo de Settings (`/settings/payments`) con una sola fila hoy, "Payment methods" (`/settings/payments/methods`), cuyo subtítulo son los nombres ofrecidos unidos por ", " y cortados con puntos suspensivos. Archived está en `/settings/payments/methods/archived`. La página del grupo no lleva todavía el encabezado grande, el título de sección ni la tarjeta del dibujo; se lee como la misma pantalla.
- Mover las filas de Expense categories y Withdrawal reasons a este grupo, como lo dibuja la pantalla, no es parte de esta tarea: queda como hallazgo.
- **La lista** muestra los medios ofrecidos en su orden, cada uno con su ícono y su nombre. Cada fila tiene "Move up" y "Move down" (en el teléfono, sin arrastrar; el "Move up" del primero y el "Move down" del último quedan deshabilitados) y, según el medio, "Delete" cuando no tiene Payments o "Archive" cuando los tiene, cada una con su confirmación. Tocar la fila abre su edición. Tiene "Add method" y la entrada "Archived". Mientras carga muestra la forma de la lista; si falla, "Try again"; sin conexión, el aviso de Estados.
- **Agregar** y **editar** se hacen en un formulario (una **Sheet** en el teléfono, con "Close" arriba y Save fijo abajo) con nombre e ícono, el ícono por defecto ya elegido. Los rechazos del nombre (en blanco, más de 60 caracteres, repetido, reservado por un archivado con "Restore it from Archived.") se muestran junto al campo y conservan lo escrito. La edición avisa "Past payments will show the new name." y, al volver a abrirla después de guardar, muestra lo guardado (decisión 1 del humano). Salir con cambios sin guardar pide confirmación.
- **Archived**: muestra los medios archivados, cada uno con "Restore"; vacío dice "No archived payment methods."
- Todo texto sale del **Copy module**; ningún valor por defecto nuevo lleva una palabra de la flor.

### API y restricciones

- Rutas de gestión, todas con sesión (`/api/payment-methods`):
  - `GET` ofrecidos, en orden de posición, como `[{id, name, icon, position, in_use}]`; `GET /archived` los archivados.
  - `POST {name, icon?}` agrega el medio al final (201).
  - `PATCH /{id} {name?, icon?}` renombra o cambia el ícono.
  - `POST /{id}/move {direction: "up"|"down"}` intercambia con el vecino ofrecido; en un extremo no cambia nada.
  - `POST /{id}/archive` y `POST /{id}/restore`; un medio restaurado vuelve a su propia posición guardada.
  - `DELETE /{id}` (204).
- Rechazos de gestión: `payment_method.name_required` y `name_too_long` (422); `name_taken`, `name_taken_archived`, `last_offered` e `in_use` (409); id desconocido o de otro Business, 404 `payment_method.not_found`.
- Payments y Sales llevan `payment_method_id` en lugar de `method`, y el pago de una Sale pasa a ser una unión por `kind` (`{kind: "paid", payment_method_id}` o `{kind: "owing"}`). La cuenta del Customer trae `how_paid` (`paid`, `owing` o `none`) y `payment_method` (`{id, name, icon}` o null). Es un quiebre real de la API: el cuerpo del PR lleva una línea `Breaking-API: <motivo>` (ADR-0066, ADR-0084).
- Al escribir un Payment o una Sale, todo medio que no se puede usar (archivado, eliminado, inexistente o de otro Business) responde el mismo 404 `payment_method.unavailable`, controlado dentro del mismo `INSERT … SELECT` que escribe, así que no se escribe nada y no se revela nada.
- `payment.payment_method_id` apunta a `payment_method` con una FK compuesta `(business_id, payment_method_id)` ON DELETE RESTRICT.
- `payment_method` lleva `business_id` no nulo y se lee solo mediante un repositorio construido para un Business.
- Los rechazos llevan su código en `contract.json` (ADR-0008), son fijos y nunca repiten el nombre tipeado (ADR-0005).
- Toda ruta nueva entra en el barrido de aislamiento y en el test de rutas con acceso restringido.
- Las migraciones siguen la única cadena lineal, cada una con su `down_revision` en la anterior.

## Métricas

- **Mi lista (criterio 1)**: una corrida end-to-end en un viewport de teléfono agrega "Mercado Pago" con un ícono, lo sube al primer lugar, y lo ve primero en el campo "Payment method" de New sale y de Record payment; guarda una venta y un Payment con él.
- **Nada de antes cambia (criterio 2)**: el comparador M3 pasa sobre la migración; cada Payment existente queda enlazado al medio que corresponde a su valor de `method`, 0 sin enlazar; un Business nuevo tiene exactamente "Cash" y "Transfer" en su Stored language. En la cuenta, una Sale pagada en el momento dice "Paid · Cash" y, después de renombrar, el nombre nuevo (`accountRows.test.ts`).
- **Los mismos toques (criterio 3)**: una venta pagada se sigue registrando desde un viewport de teléfono en menos de 60 s; el medio suma como máximo un paso; los tests del front de "siempre vacío" y "sin medio no se guarda" pasan sin editar sus aserciones.
- **Dejar de ofrecer (criterio 4)**: un test de API archiva un medio con Payments y comprueba que no aparece entre los ofrecidos, que un Payment nuevo con él responde 404 `payment_method.unavailable`, que los Payments pasados siguen mostrando su nombre y que restaurarlo lo devuelve igual; uno sin Payments se elimina; el último ofrecido no se archiva ni se elimina; un nombre archivado no se reutiliza. El spec e2e de teléfono `paymentMethods.spec.ts` cubre agregar, editar y volver a abrir, archivar, restaurar y eliminar.
- **Aislamiento (criterio 5)**: toda ruta de medios está en el barrido y responde 404 o vacío desde otro Business; un Payment o una venta con el medio de otro Business responde 404.
- **Assume nothing**: ningún literal "cash" o "transfer" decide comportamiento en el código nuevo; ningún medio aparece en `fixedSets.ts`.

## Fuera de alcance

- Informes por medio: Cash separado por medio, totales por medio y el medio en el Sale bill. Es otro job.
- Editar un Payment registrado, su medio incluido.
- Recordar el último medio usado o proponer uno por defecto.
- Arrastrar para ordenar.
- Íconos subidos o de texto libre.
- El ícono del medio dentro del Selector de New sale y Record payment.
