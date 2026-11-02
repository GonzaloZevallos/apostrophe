## Jobs

**Cuando** registro cómo me pagó un cliente, en la venta o después, **quiero** elegir entre las formas en que mi negocio cobra de verdad, **para** que cada Payment diga cómo me pagaron realmente, sin forzarlo en una opción que mi negocio no usa.

Hasta esta parte, un pago hecho de cualquier otra forma (una billetera virtual, una tarjeta cobrada fuera de la app, cualquier otra cosa) se cargaba como "cash" o "transfer". Un Payment no tiene Note, así que no había otro lugar donde registrarlo, y los libros quedaban mal sobre cómo entró la plata. El job cubre también al negocio que nunca cobra por transferencia, o nunca en efectivo: puede sacar la opción que no usa, así no se toca por error. Cubre las dos maneras de elegir un método: el **On-the-spot payment** de New sale y el Payment posterior de Record payment.

**Cuando** manejo mi negocio desde el celular entre pedidos, **quiero** que la app esté armada según lo que hago de verdad, **para poder** volver con el cliente en lugar de buscar entre menús. (El job de **Navigation**, navigation.md: acá lo sirve que la lista viva en **Settings** → Business y en ningún otro lado).

Criterios de éxito:

1. **Se maneja desde el celular**: el vendedor agrega, renombra, reordena y saca métodos en Settings → Business → Payment methods, sin ayuda y sin el **Operator**.
2. **Se ofrece exactamente esa lista**: New sale y Record payment ofrecen los métodos activos, en ese orden, sin ningún paso de más. Una Sale se sigue registrando desde el celular en menos de un minuto.
3. **La historia no se reescribe**: los Payments registrados antes de esta parte conservan su método ("Cash" o "Transfer"). Cambiar la lista después nunca altera el monto, la fecha ni el significado de un Payment registrado. Todo Business, existente o nuevo, arranca con "Cash" y "Transfer".
4. **Assume nothing**: nada en la app depende de que un Business conserve "Cash" o "Transfer" por nombre. Un Business que no cobra de ninguna de las dos formas registra todos sus Payments con sus propios métodos.

# Payment methods

La lista propia de cada **Business** de las formas en que cobra. Cada **Payment** lleva exactamente uno. Un Payment method es solo una etiqueta sobre dinero recibido: nunca cambia ninguna cifra. Se guarda por Business en su propio hexágono `payment_methods` (ADR-0055), y lo ve solo su Business (ADR-0004). Pagos (`payments.md`) y ventas (`sales.md`) lo leen por su propio protocolo para ofrecer la lista y mostrar el método de cada Payment. El **Sale bill** (`sale-bill.md`) lleva su nombre. La pantalla vive en Settings → Business → Payment methods. No hay paso de Payment methods en el **Onboarding** ni en la **First-run checklist**: todo Business ya arranca con dos métodos, así que nada frena la primera Sale.

## Comportamiento

### La lista inicial

- Todo Business existente recibe dos métodos con la migración, "Cash" y "Transfer", en ese orden.
- Un Business nuevo los recibe al abrirse, en su **Stored language** (en inglés hasta #317), igual que las **Expense category** por defecto. Desde entonces son datos propios: un cambio de idioma nunca los renombra.
- Cada Payment existente queda vinculado al método que corresponde al valor que tiene hoy (efectivo → "Cash", transferencia → "Transfer"). La columna vieja del método queda congelada con su valor (ADR-0055); nada en pantalla la lee.
- "Cash" y "Transfer" son filas comunes: se pueden renombrar, reordenar, archivar o eliminar como cualquier otra. Ningún código compara el nombre de un método.

### Un Payment method

- **Campos**: un nombre, un ícono opcional y un lugar en el orden del vendedor.
- **Nombre**:
  - Obligatorio, recortado, de hasta 40 caracteres.
  - Único dentro del Business sin importar mayúsculas, minúsculas ni espacios, como una Expense category. Los métodos archivados también cuentan.
  - Es dato del vendedor: se muestra exactamente como se guardó y nunca se traduce.
- **Ícono**:
  - Sale de un juego chico y fijo de íconos neutros: billetera, banco, tarjeta, monedas, teléfono y genérico. Ninguno es de un tipo de negocio ni de flor.
  - Un método nuevo lleva el genérico salvo que el vendedor elija otro.
  - "Cash" arranca con monedas o billetera y "Transfer" con banco. Diseño elige cuál de los dos lleva "Cash".
  - El nombre siempre se muestra junto al ícono y nunca lo reemplaza. Los métodos nunca se distinguen solo por el ícono (**Icon and text rule**).

### En pantalla: Settings → Business → Payment methods

- **Un detalle** (navigation.md): se llega desde el grupo Business de Settings, con la flecha de regreso a Settings.
- **La lista activa**: los métodos activos en el orden del vendedor, cada uno con su ícono y su nombre.
- **Agregar**: nombre e ícono opcional. Un método nuevo va al final de la lista.
- **Editar**: renombrar y cambiar el ícono.
- **Reordenar**:
  - Cada fila lleva "Move up" y "Move down", cada uno con su nombre de texto. No hay arrastrar y soltar.
  - La primera fila no tiene "Move up" y la última no tiene "Move down". Diseño decide si esos botones se omiten o se deshabilitan.
  - El orden que fija el vendedor es el que muestran New sale y Record payment.
- **Eliminar o archivar**:
  - Un método que ningún Payment usa se elimina para siempre, con confirmación previa.
  - Un método que algún Payment usa solo se puede archivar. Sale de New sale, de Record payment y de la lista activa.
  - Si se usa o no se calcula en el momento a partir de los Payments tal como están ahora, On-the-spot payments incluidos, y nunca se guarda. Eliminar la última Sale o el último Payment que lo usaba lo vuelve eliminable.
- **Archived**:
  - Una vista dentro de esta pantalla, la única desde donde se ve y se restaura un método archivado.
  - Restaurar lo devuelve exactamente como estaba, en su lugar anterior del orden.
  - Mientras está archivado, su nombre sigue reservado, así que restaurarlo nunca choca con un nombre repetido.
- **El último método activo** no se puede archivar ni eliminar. La pantalla dice por qué en una oración, con el **Attention icon**.
- **Renombrar** corrige la etiqueta del mismo método: todo Payment vinculado a él, pasado y futuro, muestra el nombre nuevo. Un vendedor que quiere un método distinto agrega uno nuevo y archiva el viejo.
- **Rechazos**: en línea, conservando lo escrito, cada uno con su código en `contract.json` (ADR-0008):
  - nombre vacío;
  - nombre de más de 40 caracteres;
  - nombre repetido;
  - archivar o eliminar el último método activo;
  - eliminar un método en uso;
  - método inexistente o de otro Business (404).
- **En el celular**: cada control mide al menos 44 px de alto, todo campo tiene al menos 16 px, nada desborda a 320 px ni con el texto al 130 %, y la pantalla pasa el **Mobile check** sin infractores nuevos.

### Al registrar: New sale y Record payment

- **Los métodos activos** reemplazan las opciones "Paid in cash / Paid by transfer" de hoy, en el mismo lugar y con la misma cantidad de toques.
  - Van en el orden del vendedor, un toque cada uno, con ícono y nombre.
  - En el celular pasan a la línea siguiente cuando no entran. Nunca hay desplazamiento horizontal ni un nombre recortado, y cada opción mide al menos 44 px.
- **Preselección**: donde hoy viene preseleccionada una opción, ese lugar lo toma el primer método del orden del vendedor. Donde hoy no viene ninguna, sigue sin venir ninguna. Ningún cambio en el formulario vuelve solo a un método.
- **Owing** (no pagada) en New sale sigue siendo una opción aparte, después de los métodos, y no es un método. Una Sale que queda debiendo no registra método.
- **Los métodos archivados** nunca se ofrecen.
- **Un método que ya no está**: si un socio archivó o eliminó un método mientras el formulario estaba abierto, o el método es de otro Business, el guardado se rechaza con su código. Todo lo escrito se conserva y la lista se vuelve a leer.

### Dónde se muestra el método de un Payment registrado

- Donde hoy se muestra el método de un Payment, se muestra el nombre y el ícono actuales del método:
  - el detalle de la Sale;
  - la cuenta del Customer: "Paid · <method>" en lugar de "Paid in cash" / "Paid by transfer", y "Payment · <method>";
  - la confirmación de "Delete payment";
  - el Sale bill, "Paid · <method>", que por ser texto plano lleva solo el nombre, nunca el ícono.
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

- Vincula cada Payment importado al método del Business con ese nombre (efectivo → "Cash", transferencia → "Transfer", sin importar mayúsculas, minúsculas ni espacios), y lo crea si no existe. Sigue corriendo solo en un Business sin registros.

### Restricciones

- La tabla nueva lleva `business_id` no nulo y se lee solo a través de un repositorio armado para un Business. El método de otro Business responde 404.
- Toda ruta nueva entra en el barrido de aislamiento y en el test de rutas con acceso restringido.
- La migración solo agrega tablas, columnas y filas o completa columnas nuevas. Nunca cambia el valor de una columna existente, y el comparador M3 compartido de `tests/migrations/` lo prueba. Su `down_revision` es la revisión anterior de la única cadena lineal, con el número reservado en su brief.
- Ningún texto de pantalla nuevo vive fuera del **Copy module**, y ningún valor por defecto nuevo lleva una palabra de flor.
- Un **Business export** incluye las filas de métodos, y una **Business removal** las borra.
- Tests: tests de TestClient, el comparador M3 y los de aislamiento.

## Métricas

- **Migración (criterio 3)**:
  - todo Payment existente queda vinculado al método que corresponde a su valor viejo, con 0 sin vincular;
  - el comparador M3 no muestra ningún cambio en ninguna columna existente;
  - todo Business existente tiene exactamente "Cash" y "Transfer" después de la migración, y un Business recién abierto los tiene desde el principio.
- **Orden y oferta (criterio 2)**:
  - tests del front muestran que New sale y Record payment listan exactamente los métodos activos, en el orden de Settings, y nunca uno archivado;
  - el presupuesto de toques (`web/e2e/tapBudget.spec.ts`) pasa sin editarse.
- **Manejo desde el celular (criterio 1)**: una corrida end-to-end en un viewport de celular agrega un método, lo renombra, le cambia el ícono, lo sube y lo baja, lo archiva, lo restaura y elimina uno sin uso. La pantalla pasa el Mobile check sin infractores nuevos.
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
- **Assume nothing (criterio 4)**: un Business que archiva o elimina "Cash" y "Transfer" y conserva solo un método propio registra de punta a punta una Sale pagada en el momento y un Payment posterior. Ningún código compara el nombre de un método.
- **Aislamiento**: toda ruta nueva está en el barrido y en el test de rutas con acceso restringido. El método de otro Business responde 404, también dentro de una Sale o de un Payment.
- **Rechazos con código**: cada rechazo de esta pantalla y el de un método que ya no está al registrar tienen su código en `contract.json`, verificado por `tests/test_refusal_codes.py`.

## Fuera de alcance

- Totales o filtros por método. Cash, Profit, Home y Analysis quedan como están.
- Editar el método de un Payment registrado.
- Reordenar arrastrando: es pulido posible para después (**Phone first**).
- Cualquier procesador de tarjetas o proveedor de pagos.
- Un paso de Payment methods en el Onboarding o en la First-run checklist.
- Íconos subidos por el vendedor o fuera del juego fijo.
