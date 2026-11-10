## Jobs

**Cuando** configuro cómo pone precios mi negocio, registro el precio de un producto o entrego un pedido, **quiero** que la app use solo las Pricing rules que tiene mi negocio (un Bulk price si vendo por cantidad, y un VIP price que fijo por producto para mis VIP customers), **para** cobrarle a cada cliente exactamente lo que quiero sin tipear un **Special price** a mano, sin ver campos que no me corresponden y sin que el precio de nadie cambie por sorpresa.

**Cuando** tengo clientes habituales a los que trato distinto, **quiero** agruparlos en tipos a los que les pongo nombre yo y elegir el tipo de cada uno desde su ficha, **para poder** distinguirlos de un vistazo, y más adelante cobrarles según su tipo, sin depender de la memoria ni de notas. (GH-405: lo sirven acá el interruptor Customer types y la fila Customer types del grupo Prices; definido en customers.md.)

**Cuando** registro una venta para un cliente que pertenece a uno de mis grupos de clientes, **quiero** que cada línea se cotice al precio que fijé para ese grupo y ese producto, **para** cobrarle a cada grupo su propio precio sin tipearlo ni sacarlo de memoria. (Parte customer-type prices de GH-318: lo sirven acá los **Customer-type price**s y el campo "VIP price" que escribe el del VIP type; la cotización de la línea está en sales.md.)

**Cuando** necesito cambiar cómo está configurado mi negocio, **quiero** cada configuración de todo el negocio en un solo lugar, cada una en su propia pantalla corta, **para** cambiarla en pocos toques desde el celular y volver con el cliente. (El job de Settings, navigation.md: lo sirve acá el grupo Prices.)

# Pricing settings

Qué **Pricing rule**s usa un **Business**: dos interruptores independientes, **Bulk price** (la regla bulk) y **Customer types** (los **Customer type**s y sus Customer-type prices, entre ellos el del **VIP type**). Los ve y los cambia solo el Business al que pertenecen (ADR-0004), en **Settings** → Prices (navigation.md).

Lo que hace cada regla lo define la capacidad a cargo, y cada una sigue los interruptores:
- cómo se pone precio a una **Sale line**: sales.md;
- el Bulk price y el **VIP price** de una **Price entry**: varieties.md (dónde se guarda el VIP price: acá, "Los precios por Customer type");
- los Customer types, la pertenencia y el VIP type: customers.md;
- la línea de Bulk del **Catalog**: catalog.md;
- el disparador del **Upkeep**: pinned-catalog.md;
- lo que activa la **Spreadsheet import**: import.md.

La protagonista es quien vende. Afina los jobs de ventas y de productos; no es un job nuevo. Las configuraciones son raras y deliberadas. El formulario de precio, el formulario de cliente y New sale las siguen.

Sin esto, quienes venden dejan en blanco los campos de Bulk y VIP que no usan, y tipean a mano un Special price para cualquier VIP price que no sea el Bulk price. Sin precios por tipo, un grupo que no sea el VIP no tiene forma de recibir su propio precio: quien vende tipea un Special price en cada línea (lo que pierde el vínculo entre la venta y el grupo que recibió el precio) o cotiza de memoria.

Criterios de éxito:

1. **Solo se ven mis reglas.**
   - Con una regla desactivada, nada de ella aparece en el formulario de precio, la página del **Product**, el campo "Customer type" del formulario de **Customer**, New sale ni el texto del Catalog.
   - Una **Sale** recibe precio como si la regla no existiera.
   - Con las dos desactivadas, una Sale recibe precio solo por **List price**. **Gift** y Special price siguen funcionando.
2. **El precio de mi grupo, nunca peor que el normal.** A un Customer con un Customer type se le cobra el menor de los precios de las reglas que se aplican a la línea:
   - el List price;
   - el Bulk price, cuando Bulk está activado y la línea llega al **Bulk minimum**;
   - el Customer-type price de su tipo para ese Product en la fecha de la Sale, cuando Customer types está activado y el tipo tiene uno vigente.

   Un tipo sin precio vigente para un Product le cobra a su Customer como a cualquier otro, y lo mismo un Customer sin tipo o una Sale sin Customer. La vista previa en vivo muestra el mismo precio antes de guardar.
3. **El precio de nadie se mueve por sorpresa.** Después de cada cambio, a cada VIP customer existente se le cobra exactamente lo que se le cobraba antes, por el mismo Product, día y gramos: el mismo precio por gramo, el mismo total y la misma insignia mostrada. Vale también después de la actualización que pasó la marca VIP al VIP type, después de la que pasó los VIP prices a filas de Customer-type price, y para los VIP prices registrados después. No cambia el precio, la regla ni el total de ninguna Sale pasada, hagan lo que hagan después los interruptores, los tipos, sus nombres o sus precios. Un Business sin VIP type no tiene VIP customers, así que sus VIP prices congelados no le cobraban nada a nadie y siguen sin cobrarle nada a nadie.
4. **Cambiar de interruptor no pierde nada.** Desactivar una regla y volver a activarla trae de vuelta cada Bulk price, Customer-type price, Customer type y pertenencia guardados. Solo las Sales y las Price entries registradas mientras estaba desactivada quedan sin ella. Los VIP prices congelados de un Business sin VIP type no se muestran con ninguna posición del interruptor, porque nunca pudieron aplicarse; siguen guardados en su columna.
5. **Los Customers nunca ven un precio de tipo.** El Catalog nunca muestra el VIP price ni ningún Customer-type price, y el **Sale bill** nunca nombra el tipo. La línea de Bulk del Catalog se muestra solo mientras Bulk price está activado.
6. **Rápido.** Cada interruptor se cambia en pocos toques desde Settings → Prices. Registrar una Sale sigue llevando menos de un minuto.
7. **Los Businesses nunca se mezclan** (ADR-0004). Los interruptores, los Customer types y los Customer-type prices de un Business nunca afectan los precios, las pantallas ni el Catalog de otro.

## Comportamiento

### Los interruptores

- **Dos por Business**, independientes entre sí: Bulk price y Customer types.
- **Customer types** es el interruptor que antes se leía "VIP customers": conserva su columna `pricing_settings.is_vip_customers`, su valor guardado y su efecto; solo cambia la palabra de pantalla (ADR-0059). Gobierna la fila Customer types de Prices, el campo "Customer type" del formulario, el tipo en la ficha, la marca VIP, el campo "VIP price" y todo Customer-type price.
- **Dónde rige**: en el precio de las Sales y en el alta y la edición de Customers. Las rutas de `/api/customer-types` no lo leen y responden igual encendido o apagado; son las pantallas las que se ocultan.
- **Dónde se cambian**: solo en Settings → Prices. Cualquier **User** del Business puede cambiarlos; no hay roles.
- **Una regla desactivada**:
  - deja de aplicarse a las Sales nuevas y se oculta en cada pantalla que la muestra;
  - no elimina nada: las Sales pasadas conservan su precio y su regla (ADR-0003), y los Bulk prices, los Customer-type prices, los Customer types y la pertenencia de cada Customer siguen guardados;
  - con Customer types desactivado, guardar un Customer nunca cambia su tipo, y un Customer creado entonces no tiene tipo (customers.md);
  - al volver a activarla, cada valor guardado vuelve como estaba.
- **Cuándo rige un cambio de interruptor**: una Sale recibe precio según los interruptores vigentes cuando se guarda. Un cambio hecho mientras un formulario de Sale está abierto ni se rechaza ni se anuncia (sales.md).
- **Qué responde la API**: los valores guardados junto con los interruptores. Las pantallas ocultan lo desactivado. El texto del Catalog, que se arma en el servidor, deja afuera la línea de Bulk por sí mismo (catalog.md).

### Los precios por Customer type

Decidido en docs/adr/0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md.

- **Qué es**: un Customer-type price es una fila con fecha de un Business, para un Customer type, un Product y una fecha de vigencia, con un precio por gramo en una columna declarada con `money_column()`. Puede estar atada a la Price entry con la que se guardó (`price_entry_id`, opcional). El Product se referencia con `variety_id` (ADR-0061); el dominio, los puertos y la API dicen `product_id`.
- **Nunca se edita**: un precio nuevo es una fila nueva. Un tipo tiene a lo sumo un precio por Product por día.
- **Cuál rige en una fecha**:
  - la fila más reciente de ese tipo y Product en esa fecha o antes;
  - una fila atada a una Price entry rige solo mientras esa Price entry es el **Current price** del Product. Una Price entry posterior sin precio para ese tipo lo termina desde su propia fecha, igual que una Price entry sin VIP price lo terminaba antes. Así a cada VIP customer se le cobra lo mismo que antes;
  - una fila sin Price entry (solo las va a crear la parte de la pantalla de precios por tipo) sigue la regla de la fila más reciente, sin más.
- **Cuándo es válido**:
  - un monto entero mayor que $0 en el **Money format** del Business, estrictamente menor que el List price vigente en la fecha de la propia fila; una fila guardada con una Price entry, menor que el List price de esa Price entry;
  - si no, se rechaza (la regla `CustomerTypePriceNotBelowList`, del dominio de productos), con el mensaje fijo y el código de rechazo que ya usa el VIP price (ADR-0008), sin repetir el monto (ADR-0005);
  - un List price posterior que baja hasta un Customer-type price o por debajo no rechaza ni reescribe nada: la línea toma el List price y se guarda como lista. No hay aviso.
- **Cómo se fija en esta parte**: solo con el campo "VIP price" del formulario de Price entry (varieties.md), para el VIP type.
  - El campo se muestra mientras Customer types está activado y el Business tiene su VIP type; en un Business sin VIP type (todo Business nuevo, o uno que eliminó el suyo) no se muestra.
  - Su etiqueta, su lugar, su "$" y su rechazo no cambian.
  - Lo tipeado se guarda como una fila del VIP type con la fecha de la Price entry y atada a ella. La columna `price_entry.vip_price` no se vuelve a escribir.
  - La sección Prices de la página del Product y el historial de precios leen el VIP price de esa fila, así que en pantalla no cambia nada para un Business con VIP type.
  - Una Price entry registrada mientras Customer types está desactivado no guarda ninguna fila, mande lo que mande el pedido.
  - Los demás tipos no tienen precio hasta la parte de la pantalla de precios por tipo. La línea de ayuda bajo el interruptor lo sigue diciendo.
- **Al eliminar**:
  - eliminar una Price entry se lleva sus filas, y vuelve a regir la Price entry anterior con sus propias filas;
  - eliminar un Product sin historial se lleva las filas de sus Price entries antes que las entries;
  - eliminar un Customer type (solo se puede sin Customers, customers.md) se lleva sus filas;
  - en los dos casos, las Sales registradas conservan su precio, su regla y su copia del nombre del tipo.
- **La migración**: una fila del VIP type por cada Price entry con VIP price de un Business que tiene su VIP type en ese momento, con la misma fecha, el mismo monto y atada a esa Price entry. Solo agrega una tabla y filas: ningún valor existente cambia, y `customer.is_vip` y `price_entry.vip_price` quedan congeladas en su lugar, como historia, sin que nadie las vuelva a leer ni escribir. Un Business sin VIP prices queda sin ningún Customer-type price, y cada línea se cotiza como antes: es lo normal, no un error.
- **Un Business sin VIP type con VIP prices congelados** (abierto después de los Customer types, o que eliminó su VIP type): esos VIP prices no se migran a ninguna fila, no cotizan ninguna línea y su sección Prices y su historial de precios dejan de mostrarlos, porque ningún Customer pudo ni puede pagarlos. Un tipo propio llamado "VIP" no los recibe. Siguen guardados tal cual en `price_entry.vip_price` y salen en el **Business export**. No hay aviso.
- **La regla en una línea**: cómo un Customer-type price entra en la cotización de una Sale line, y qué se guarda en ella, está en sales.md.

### Valores iniciales

- **Businesses existentes** (en la migración de los interruptores): los dos interruptores activados.
  - Cada Price entry con un Bulk price recibió VIP price = Bulk price, así cada VIP customer pagó exactamente lo que pagaba antes; la migración de los Customer-type prices pasó esos VIP prices a filas del VIP type.
  - Un Bulk price ya es menor que el List price, así que el VIP price copiado cumple su propia regla.
- **Businesses existentes** (en la migración de los Customer types, ADR-0059): cada uno recibe su VIP type, con el ícono `star` y los Customers que tenían la marca VIP; ningún interruptor cambia.
- **Businesses existentes** (en la migración de los Customer-type prices): una fila del VIP type por cada VIP price, solo en los Businesses con VIP type, como dice arriba; ningún interruptor cambia.
- **Un Business nuevo**: los dos interruptores desactivados, hasta que el issue del **Onboarding** decida otra cosa, ningún Customer type y ningún Customer-type price.
- **Un Business cargado por la Spreadsheet import**: la Spreadsheet import activa lo que usa la planilla y nunca desactiva nada (import.md). Crea el VIP type antes de escribir las Price entries, y el VIP price = Bulk price de cada una se guarda como una fila del VIP type, no en `price_entry.vip_price`; sin VIP type (la planilla no tiene VIP customers) no guarda ninguna fila.

### En pantalla: Settings → Prices

- **Lugar**: un grupo de Settings (navigation.md), después de Users y antes de Integrations.
- **Ruta**: `/settings/prices`, fijada en `scripts/design/screens.json`. No hay otro acceso: no se llega desde la página de un Product ni desde el formulario de precio. Prices queda a 2 toques de una Tab root.
- **Un formulario**:
  - "Close", y una confirmación al salir con cambios sin guardar ("Discard the prices?"); un grupo sin tocar se cierra de inmediato;
  - dos interruptores, "Bulk price" y "Customer types", cada uno marcado como activado o desactivado por palabra o forma y `aria-checked`, nunca solo por color;
  - el botón "Save the prices";
  - si sale bien, el toast "Prices saved", que no lleva datos.
- **Una línea fija** dice que las Sales pasadas conservan el precio con el que se registraron, y que desactivar una regla no elimina nada.
- **Una línea de ayuda fija bajo el interruptor Customer types**, en texto chico atenuado, que se muestra esté activado o desactivado:
  - en un Business con VIP type: "Customers in the VIP type pay the VIP price where a price has one. Other types have no price yet.";
  - en cualquier otro: "Customer types have no price yet."
  - No hay conteo, ni lista de Products sin VIP price, ni aviso en ningún otro lado.
- **La fila "Customer types"** (rótulo y chevron), dentro de la tarjeta del interruptor, debajo de la línea de ayuda y arriba de "Save the prices": lleva a la lista y la gestión de los tipos (`/settings/prices/customer-types`, a 3 toques de una Tab root; customers.md). Sigue el valor guardado del interruptor, no el que se está editando: aparece después de activar el interruptor y tocar "Save the prices", y desaparece al guardarlo desactivado.
- **Upkeep**: un guardado que cambia cualquiera de los dos interruptores lo dispara (pinned-catalog.md), porque la línea de Bulk del Catalog depende de Bulk price.
- **Avisos**: un grupo que ya no existe, la falta de red y los errores del servidor siguen accounts.md.
- Todo texto vive en el **Copy module**.

### Exportación

El **Business export** (accounts.md) guarda los dos interruptores tal como están guardados, y los Customer types, los Customer-type prices y las columnas congeladas (`price_entry.vip_price` incluida) por reflexión del esquema (ADR-0015).

### Restricciones

- Los interruptores, los Customer types y los Customer-type prices pertenecen al Business de la **Session** (ADR-0004). La tabla de Customer-type prices lleva `business_id` no nulo y se lee solo con un repositorio armado para un Business; un registro de otro Business responde 404.
- Sus rutas entran en el barrido de aislamiento y en el test de rutas protegidas. Su almacenamiento entra en el test de migración de pertenencia.
- Ningún precio va a rechazos, logs, la consola ni el almacenamiento del navegador (ADR-0005).

## Métricas

- **Migración de los interruptores (criterio 3)**:
  - los Businesses existentes terminan con los dos interruptores activados;
  - cada Price entry con un Bulk price tiene VIP price = Bulk price;
  - para cada VIP customer existente, el precio, la regla y el total de una Sale son iguales a lo que eran antes, por el mismo Product, día y gramos: 0 diferencias.
- **Migración de los Customer types (criterio 3)**: ningún interruptor cambia de valor; cada Business existente tiene su VIP type con exactamente los Customers de `vip = 1`; para cada uno de ellos el precio, la regla y el total de una Sale nueva son iguales antes y después: 0 diferencias; el comparador M3 compartido encuentra 0 valores cambiados.
- **Migración de los Customer-type prices (criterio 3)**:
  - en un Business con VIP type, cada Price entry con un VIP price tiene exactamente una fila del VIP type con su fecha, su monto y su id, y ninguna sin VIP price la tiene;
  - en un Business sin VIP type, ninguna Price entry recibe fila, su `vip_price` queda igual, y su sección Prices y su historial no muestran ningún VIP price;
  - el comparador M3 compartido de `tests/migrations/` encuentra 0 valores cambiados en las columnas que ya existían;
  - para cada Customer del VIP type, cada Product, día y cantidad, el precio por gramo, el total y la insignia mostrada de una línea nueva son iguales antes y después: 0 diferencias.
- **Paridad VIP después de la migración (criterio 3)**: un test registra, para un Product, una Price entry con VIP price y después otra sin VIP price; desde la fecha de la segunda, un Customer del VIP type paga lista o bulk, igual que antes de esta parte. Otro registra un VIP price desde el formulario y comprueba que se guarda como fila del VIP type y que `price_entry.vip_price` queda vacío.
- **El campo "VIP price" (criterio 1)**: tests del front lo muestran solo con Customer types activado y con VIP type; sin VIP type no se muestra. Su etiqueta, su "$" y su rechazo son los de antes.
- **Validez del precio (criterio 2)**: igual o mayor que el List price se rechaza con su código, que está en `contract.json` y lo controla `tests/test_refusal_codes.py`; ningún rechazo contiene el monto. Un List price posterior por debajo de un Customer-type price no rechaza nada y la línea se guarda como lista.
- **Las filas se van con su Price entry**: eliminar una Price entry deja 0 filas atadas a ella, y vuelve a regir la anterior con su propio precio de tipo. Eliminar un Customer type deja 0 filas suyas, y las líneas registradas conservan su copia del nombre.
- **Valores por defecto**: un Business abierto con una **Invitation** de Business nuevo tiene los dos interruptores desactivados, ningún Customer type y ningún Customer-type price.
- **Cambiar de interruptor no pierde nada (criterio 4)**: después de desactivar y volver a activar, cada Bulk price, Customer-type price, Customer type y pertenencia guardados se leen como antes, incluido un Customer editado mientras Customer types estaba desactivado.
- **Inmutabilidad del precio guardado (criterio 3)**: después de cualquier cambio de interruptor, de pertenencia, de nombre de un tipo o de sus precios, el precio, la regla, la copia del nombre y el total de las líneas existentes no cambian.
- **Las pantallas siguen los interruptores (criterio 1)**: tests del front muestran, con cada interruptor desactivado, ningún rastro de él en el formulario de precio, la página del Product, el formulario, la ficha y la lista de Customers, la fila Customer types de Prices, el badge de Sales, New sale ni el Catalog. Los badges registrados en el detalle de una Sale se mantienen.
- **Grupo Prices (criterio 6)**:
  - tests del front cubren "Close", la confirmación de cambios sin guardar, un cierre sin tocar, "Save the prices", "Prices saved", la etiqueta "Customer types", la línea fija, las dos formas de la línea de ayuda, la fila Customer types siguiendo el valor guardado, su lugar y su ruta, y la ausencia de cualquier otro acceso;
  - Prices se abre en 2 toques como máximo desde cualquier **Tab root**, y la lista de Customer types en 3;
  - la corrida de punta a punta de Settings cambia cada regla desde un viewport de celular.
- **Upkeep**: un guardado que cambia cualquiera de los dos interruptores dispara el Upkeep; un guardado que no cambia ninguno no envía nada.
- **Aislamiento (criterio 7)**: las rutas de los interruptores, de los Customer types y de las Price entries que escriben Customer-type prices están en el barrido y en el test de rutas protegidas. Los interruptores, los tipos y sus precios de un Business nunca cambian los precios, las pantallas ni el Catalog de otro.
- **Sin eco**: ningún rechazo ni línea de log contiene un precio.
- **Textos**: todo texto nuevo está en el Copy module y ningún valor por defecto nuevo lleva una palabra de flor.
- **Diseño**: `scripts/design/compare.sh` corre antes y después para Prices (`ConfiguracionPrecios`), en celular y computadora, adjunto al PR; la lista de Customer types no tiene dibujo y se juzga contra el diseño escrito.

## Fuera de alcance

- Otras reglas VIP, como un porcentaje sobre el List price.
- Precios promocionales por fecha.
- Una pantalla para fijar o gestionar los precios de los Customer types que no son el VIP type, o de cualquier tipo fuera de una Price entry (la parte de la pantalla de precios por tipo).
- Un aviso cuando un List price baja hasta un Customer-type price o por debajo.
- Mostrar, migrar o avisar sobre los VIP prices congelados de un Business sin VIP type.
- El Onboarding, incluido con qué arranca un Business nuevo.
- Rechazar o avisar en una Sale porque los interruptores cambiaron en medio de la Sale.
- Un aviso o conteo de Products sin VIP price.
- Roles o permisos para cambiar los interruptores.
- La fila "Tipos de cliente" bajo el grupo Customers que mostraba el dibujo de Configuración: a los Customer types se llega solo desde Prices.
- Aplicar al tocar, como hace Appearance: los interruptores cambian el precio de cada Sale nueva para cada socio, así que se guardan de forma explícita.
- Anunciar el cambio a quienes venden.

## Planned in GH-318

Todavía no está construido. Hasta que salga la parte nombrada, las secciones de arriba son lo que hace la app.

Cada pasaje nombra el ADR que lo decide, la parte que lo va a entregar y la oración actual que va a reemplazar. La parte que entrega un pasaje lo quita de acá y edita Comportamiento y Fuera de alcance en el mismo diff.

### Precios promocionales

Decidido en docs/adr/0060-the-applied-promotion-snapshot-is-typed-sale-promotion-rows-recorded-as-the-sale-stood-when-saved-and-never-recomputed.md; lo entrega la parte promotions (`sales.md`).

- Va a revertir, en Fuera de alcance: "Precios promocionales por fecha."
