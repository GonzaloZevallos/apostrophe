## Jobs

**Cuando** registro cómo me pagó un cliente, en la venta o después, **quiero** elegir entre las formas en que mi negocio cobra de verdad, **para** que cada Payment diga cómo me pagaron realmente, sin forzarlo en una opción que mi negocio no usa.

Hasta esta parte, un pago hecho de cualquier otra forma (una billetera virtual, una tarjeta cobrada fuera de la app, cualquier otra cosa) se cargaba como "cash" o "transfer". Un Payment no tiene Note, así que no había otro lugar donde registrarlo, y los libros quedaban mal sobre cómo entró la plata. El job cubre también al negocio que nunca cobra por transferencia, o nunca en efectivo: puede sacar la opción que no usa, así no se toca por error. Cubre las dos maneras de elegir un método: el **On-the-spot payment** de New sale y el Payment posterior de Record payment.

**Cuando** manejo mi negocio desde el celular entre pedidos, **quiero** que la app esté armada según lo que hago de verdad, **para poder** volver con el cliente en lugar de buscar entre menús. (El job de **Navigation**, navigation.md: acá lo sirve que la lista viva en **Settings** → Business y en ningún otro lado).

Criterios de éxito:

1. **Se maneja desde el celular**: el vendedor agrega, renombra, reordena y saca métodos en Settings → Business → Payment methods, sin ayuda y sin el **Operator**.
2. **Se ofrece exactamente esa lista**: New sale y Record payment ofrecen los métodos activos, en ese orden, y esta parte no suma ningún paso: el medio se sigue eligiendo como desde la parte 5 de GH-581, abriendo el campo "Payment method" y tocando la opción. Una Sale se sigue registrando desde el celular en menos de un minuto.
3. **La historia no se reescribe**: los Payments registrados antes de esta parte conservan su método ("Cash" o "Transfer"). Cambiar la lista después nunca altera el monto, la fecha ni el significado de un Payment registrado. Todo Business, existente o nuevo, arranca con "Cash" y "Transfer".
4. **Assume nothing**: nada en la app depende de que un Business conserve "Cash" o "Transfer" por nombre. Un Business que no cobra de ninguna de las dos formas registra todos sus Payments con sus propios métodos.

# Payment methods

La lista propia de cada **Business** de las formas en que cobra. Cada **Payment** lleva exactamente uno. Un Payment method es solo una etiqueta sobre dinero recibido: nunca cambia ninguna cifra. Se guarda por Business en su propio hexágono `payment_methods` (ADR-0055), y lo ve solo su Business (ADR-0004). Los Payments se vinculan a su método por id, y la columna vieja del método queda congelada (ADR-0082). Pagos (`payments.md`) y ventas (`sales.md`) lo leen por su propio protocolo para ofrecer la lista y mostrar el método de cada Payment. El **Sale bill** (`sale-bill.md`) lleva su nombre. La pantalla vive en Settings → Business → Payment methods. No hay paso de Payment methods en el **Onboarding** ni en la **First-run checklist**: todo Business ya arranca con dos métodos, así que nada frena la primera Sale.

## Comportamiento

### La lista inicial

- Todo Business existente recibe dos métodos con la migración, "Cash" y "Transfer", en ese orden.
- Un Business nuevo los recibe al abrirse, en su **Stored language** (en inglés hasta #317), igual que las **Expense category** por defecto. Desde entonces son datos propios: un cambio de idioma nunca los renombra.
- Cada Payment existente queda vinculado al método que corresponde al valor que tiene hoy (efectivo → "Cash", transferencia → "Transfer"). La columna vieja del método queda congelada con su valor, los Payments nuevos la dejan vacía y nada en pantalla la lee (ADR-0082).
- "Cash" y "Transfer" son filas comunes: se pueden renombrar, reordenar, archivar o eliminar como cualquier otra. Ningún código compara el nombre de un método.

### Un Payment method

- **Campos**: un nombre, un ícono opcional y un lugar en el orden del vendedor.
- **Nombre**:
  - Obligatorio, recortado, de hasta 40 caracteres.
  - Único dentro del Business sin importar mayúsculas, minúsculas ni espacios, como una Expense category. Los métodos archivados también cuentan.
  - Es dato del vendedor: se muestra exactamente como se guardó y nunca se traduce.
- **Ícono**:
  - Sale de un juego chico y fijo de seis íconos neutros, cada uno con su etiqueta en pantalla: Wallet, Bank, Card, Coins, Phone y Other (el genérico). Ninguno es de un tipo de negocio ni de flor.
  - Un método nuevo lleva el genérico salvo que el vendedor elija otro.
  - "Cash" arranca con Coins y "Transfer" con Bank.
  - El nombre siempre se muestra junto al ícono y nunca lo reemplaza. Los métodos nunca se distinguen solo por el ícono (**Icon and text rule**).

### En pantalla: Settings → Business → Payment methods

- **La entrada**: una fila "Payment methods" en el grupo Business de Settings, con los nombres activos separados por coma y la cantidad, y un chevron.
- **Un detalle** (navigation.md, ruta `/payment-methods`): con la flecha de regreso a Settings, un título y una línea de ayuda.
- **La lista activa**: los métodos activos en el orden del vendedor, cada uno con su ícono y su nombre. En la fila, un nombre largo se corta con puntos suspensivos; en el título de la Sheet nunca se corta.
- **Agregar**: "+ Add method" abre la Sheet con nombre e ícono opcional. Un método nuevo va al final de la lista.
- **Editar**: tocar la fila abre la misma Sheet, titulada con el nombre del método, para renombrar y cambiar el ícono. El ícono elegido se marca con un tilde y la palabra oculta "Selected", nunca solo con color. Cerrar con cambios sin guardar pide la confirmación de descarte. Al guardar, la Sheet se cierra recién cuando la lista ya trae el método guardado, así que reabrirla muestra lo guardado.
- **Reordenar**:
  - Cada fila lleva "Move up" y "Move down", cada uno con su texto visible y nombre accesible "Move <name> up" / "Move <name> down". No hay arrastrar y soltar.
  - La primera fila no tiene "Move up" y la última no tiene "Move down": esos botones se omiten, no se deshabilitan.
  - El orden que fija el vendedor es el que muestran New sale y Record payment.
- **Eliminar o archivar** (en la Sheet de edición):
  - Un método que ningún Payment usa ofrece "Delete", que se elimina para siempre con confirmación previa.
  - Un método que algún Payment usa ofrece solo "Archive", sin confirmación porque se puede restaurar. Sale de New sale, de Record payment y de la lista activa.
  - Si se usa o no se calcula en el momento a partir de los Payments tal como están ahora, On-the-spot payments incluidos, y nunca se guarda. Eliminar la última Sale o el último Payment que lo usaba lo vuelve eliminable.
- **Archived**:
  - Una fila "Archived" con la cantidad, debajo de la lista, que lleva a la vista de archivados (ruta `/payment-methods/archived`, con la flecha de regreso a Payment methods). Se muestra siempre; con 0 archivados lleva a "No archived methods".
  - Es el único lugar desde donde se ve y se restaura un método archivado: cada fila muestra su ícono y su nombre a secas, con "Restore" (nombre accesible "Restore <name>").
  - Restaurar lo devuelve exactamente como estaba, en su lugar anterior del orden.
  - Mientras está archivado, su nombre sigue reservado, así que restaurarlo nunca choca con un nombre repetido. El rechazo por nombre repetido lo dice y sugiere restaurarlo o elegir otro.
- **El último método activo** no se puede archivar ni eliminar. En lugar de las dos acciones, la Sheet dice por qué en una oración, con el **Attention icon** ("This is your only method. Add another one first.").
- **Renombrar** corrige la etiqueta del mismo método: todo Payment vinculado a él, pasado y futuro, muestra el nombre nuevo. Un vendedor que quiere un método distinto agrega uno nuevo y archiva el viejo.
- **Carga y error**: mientras carga, la lista muestra barras con la forma de la lista, sin dígitos ni moneda; un error de carga usa el error compartido de la app. Un método inexistente o de otro Business vuelve a la lista y la lee de nuevo.
- **Rechazos**: en línea, conservando lo escrito, cada uno con su código en `contract.json` (ADR-0008):
  - nombre vacío;
  - nombre de más de 40 caracteres;
  - nombre repetido;
  - archivar o eliminar el último método activo;
  - eliminar un método en uso;
  - método inexistente o de otro Business (404).
- **En el celular**: cada control mide al menos 44 px de alto, todo campo tiene al menos 16 px, el nombre lleva `autocomplete="off"`, nada desborda a 320 px ni con el texto al 130 %, y la pantalla, su Sheet, su confirmación y la vista de archivados pasan el **Mobile check** sin infractores nuevos.

### Al registrar: New sale y Record payment

- **Dónde se elige**: los Payment methods son un **Growable set**, así que se eligen con el **Selector** (selector.md), nunca con chips. En New sale, cómo se pagó es primero el estado Paid · Owing (un Fixed set, en chips) y, bajo Paid y solo ahí, el campo obligatorio "Payment method". Record payment muestra el mismo campo "Payment method", sin Owing. Esta regla de selector.md (parte 5 de GH-581) ganó sobre el dibujo anterior de una opción por método.
- **Las opciones** del campo son los métodos activos del negocio, leídos de `GET /api/payment-methods` por `usePaymentMethodOptions()` (`web/src/sales/paymentMethods.ts`), que comparten New sale y Record payment:
  - van en el orden del vendedor; el Selector nunca las reordena;
  - cada opción muestra el nombre del método tal como lo escribió el vendedor, sin su ícono; el valor de la opción es el id del método;
  - con más de 8 métodos, la lista tiene búsqueda;
  - mientras se lee la lista, el campo muestra el estado de carga del Selector, nunca un conjunto vacío;
  - si una carga exitosa no trae ningún método, la lista muestra "No payment methods yet. Add one in Settings." Es un respaldo: un negocio siempre conserva un método activo.
- **Toques**: elegir el medio es abrir el campo y tocar la opción, el mismo paso que sumó la parte 5 de GH-581. Esta parte no suma ningún paso, y el presupuesto de toques (`web/e2e/tapBudget.spec.ts`) pasa sin editarse.
- **Preselección**: ninguna. El campo arranca vacío al abrir New sale o Record payment y cada vez que New sale vuelve a Paid. Ningún cambio en el formulario vuelve solo a un método, y sacar el cliente con Owing elegido deja cómo se pagó sin elegir.
- **Sin medio**: guardar con Paid (o en Record payment) sin método no guarda nada, muestra "Choose how they paid." junto al campo con el Attention icon y le da el foco al campo. Una Sale de $0 se guarda sin medio.
- **Owing** (no pagada) en New sale sigue siendo un estado aparte, nunca un método: está deshabilitado con su explicación cuando no hay Customer, y una Sale que queda debiendo no registra método. Record payment no tiene Owing.
- **Los métodos archivados** nunca se ofrecen.
- **Un método que ya no está**: si un socio archivó o eliminó un método mientras el formulario estaba abierto, o el método es de otro Business, el guardado se rechaza con su código (404 `PaymentMethodUnavailable`) y no se guarda nada. Todo lo escrito se conserva (en Record payment, el monto y la fecha), la lista se vuelve a leer, un método elegido que ya no está se limpia, y un aviso con el Attention icon pide elegir otro método; elegir otro lo limpia.
- **Lo que viaja**: una Sale manda `{"kind":"method","payment_method_id"}` o `{"kind":"owing"}` (o nada para una Sale de $0); un Payment posterior manda `payment_method_id` (sales.md, payments.md).

### Dónde se muestra el método de un Payment registrado

- Donde se muestra el método de un Payment, se muestra el nombre actual del método, tal como lo escribió el vendedor (sin pasar a minúsculas):
  - el detalle de la Sale: "Paid · <method>";
  - la cuenta del Customer: "Paid · <method>" bajo una Sale pagada en el momento, y "Payment · <method>" como título de un Payment posterior;
  - la confirmación de "Delete payment": "Delete the payment of $ 15.000 · <method> from 20/09?";
  - el Sale bill: "Paid · <method>", texto plano, solo el nombre.
- En estas lecturas la app muestra el nombre sin el ícono del método; la API igual informa el ícono en el detalle de la Sale y en la cuenta.
- Ninguna pantalla suma una columna, un filtro ni un total por método.
- Un método archivado se muestra con su nombre a secas, sin etiqueta de "archived".
- El método en un Sale bill se lee tal como lo escribió el vendedor y nunca se traduce. Un Sale bill ya compartido es texto que salió de la app y conserva lo que decía.

### Corregir un Payment

- La fecha, el monto y el método de un Payment nunca cambian. Un método equivocado se corrige eliminando el Payment y registrándolo de nuevo.
- Un On-the-spot payment se va solo con su Sale: para corregirlo, se elimina la Sale y se registra de nuevo.

### Cifras

- Todo método es dinero recibido. Cada uno cuenta en **Cash**, en el **Balance**, en el **Settlement** y en cualquier otra cifra, exactamente como contaban efectivo y transferencia.
- Un método llamado "Cash" es solo una etiqueta y no tiene nada que ver con la cifra Cash, que conserva su nombre.
- Un método llamado "Card" es solo una etiqueta sobre dinero que el vendedor ya recibió. No se conecta con ningún procesador de tarjetas ni proveedor de pagos.

### Spreadsheet import

- Vincula cada Payment importado al método del Business con ese nombre (efectivo → "Cash", transferencia → "Transfer", sin importar mayúsculas, minúsculas ni espacios), y lo crea al final de la lista con el ícono genérico si no existe. Es la única búsqueda por nombre. Sigue corriendo solo en un Business sin registros.

### Restricciones

- La tabla nueva `payment_method` lleva `business_id` no nulo y se lee solo a través de un repositorio armado para un Business. El método de otro Business responde 404.
- `payment.payment_method_id` es obligatorio y referencia un método del mismo Business (clave foránea compuesta con `business_id`, que impide borrar un método en uso).
- Las rutas `/api/payment-methods` entran en el barrido de aislamiento y en el test de rutas con acceso restringido.
- Las migraciones (0028, la tabla; 0029, la columna nueva, las filas iniciales y el relleno) solo agregan tablas, columnas y filas o completan columnas nuevas. Nunca cambian el valor de una columna existente, y el comparador M3 compartido de `tests/migrations/` lo prueba. La vuelta atrás de 0029 se niega una vez que existe algún Payment nuevo.
- Ningún texto de pantalla nuevo vive fuera del **Copy module**, y ningún valor por defecto nuevo lleva una palabra de flor.
- Ningún conjunto de Payment methods se declara en `fixedSets.ts` (ADR-0074).
- Un **Business export** incluye las filas de métodos, y una **Business removal** las borra.
- Tests: tests de TestClient, el comparador M3 y los de aislamiento.

## Métricas

- **Migración (criterio 3)**:
  - todo Payment existente queda vinculado al método que corresponde a su valor viejo, con 0 sin vincular;
  - el comparador M3 no muestra ningún cambio en ninguna columna existente;
  - todo Business existente, también uno sin Payments, tiene exactamente "Cash" y "Transfer" después de la migración, y un Business recién abierto los tiene desde el principio.
- **Orden y oferta (criterio 2)**:
  - tests del front (`paymentMethods.test.tsx`, `NuevaVenta.method.test.tsx` y los de Record payment) muestran que el campo "Payment method" lista exactamente los métodos activos, en el orden de Settings, con el id como valor, cargando primero, y nunca uno archivado;
  - el presupuesto de toques (`web/e2e/tapBudget.spec.ts`) pasa sin editarse.
- **Manejo desde el celular (criterio 1)**: una corrida end-to-end en un viewport de celular (`web/e2e/paymentMethods.spec.ts`) agrega un método, lo renombra, le cambia el ícono, lo sube y lo baja, lo archiva, lo restaura y elimina uno sin uso. La pantalla pasa el Mobile check sin infractores nuevos.
- **Matriz de archivar y eliminar (criterios 1, 3)**: 100 % aprobada. Cubre:
  - eliminar un método sin uso;
  - el rechazo a eliminar uno en uso;
  - archivar uno en uso;
  - restaurarlo a su lugar anterior;
  - su nombre reservado;
  - el rechazo con el último método activo;
  - un nombre repetido sin importar mayúsculas ni espacios;
  - un nombre de 41 caracteres.
- **Renombrar (criterio 3)**: después de renombrar, el detalle de la Sale, la fila de la cuenta y el Sale bill muestran el nombre nuevo, y el monto, la fecha y el vínculo del Payment no cambian.
- **Cifras sin cambios (criterios 3, 4)**: Cash, Balance, Settlement, **Profit** y los totales de Owed to you son idénticos antes y después de la migración, y con métodos renombrados o propios. 0 diferencias.
- **Assume nothing (criterio 4)**: un Business que conserva solo un método propio registra de punta a punta una Sale pagada en el momento y un Payment posterior. Ningún código compara el nombre de un método.
- **Aislamiento**: toda ruta nueva está en el barrido y en el test de rutas con acceso restringido. El método de otro Business responde 404, también dentro de una Sale o de un Payment.
- **Rechazos con código**: cada rechazo de esta pantalla y el de un método que ya no está al registrar tienen su código en `contract.json`, verificado por `tests/test_refusal_codes.py`.

## Fuera de alcance

- Totales o filtros por método. Cash, Profit, Home y Analysis quedan como están.
- Editar el método de un Payment registrado.
- Reordenar arrastrando: es pulido posible para después (**Phone first**).
- Cualquier procesador de tarjetas o proveedor de pagos.
- Un paso de Payment methods en el Onboarding o en la First-run checklist.
- Íconos subidos por el vendedor o fuera del juego fijo.
- Recordar el último método o proponer uno por defecto al registrar.
- El ícono del método en las opciones del campo "Payment method", en el detalle de la Sale y en la cuenta del Customer, y el pulido de la lista de Settings según el dibujo (tarjeta blanca con filas de 60 px, "+ Add method" como botón de ancho completo, la fila "Archived" solo con uno o más, carga con tres filas, el error con "Try again"): pulido posible para después.
