# Pricing settings

Qué **Pricing rule**s usa un **Business**: dos interruptores independientes, **Bulk price** (la regla bulk) y **Customer types** (los **Customer type**s y la regla VIP, que hasta la parte customer-type prices se lee de la pertenencia al **VIP type**). Los ve y los cambia solo el Business al que pertenecen (ADR-0004), en **Settings** → Prices (navigation.md).

Lo que hace cada regla lo define la capacidad a cargo, y cada una sigue los interruptores:
- cómo se pone precio a una **Sale line**: sales.md;
- el Bulk price y el **VIP price** de una **Price entry**: varieties.md;
- los Customer types, la pertenencia y el VIP type: customers.md;
- la línea de Bulk del **Catalog**: catalog.md;
- el disparador del **Upkeep**: pinned-catalog.md;
- lo que activa la **Spreadsheet import**: import.md.

## Jobs

**Cuando** configuro cómo pone precios mi negocio, registro el precio de una variedad o entrego un pedido, **quiero** que la app use solo las Pricing rules que tiene mi negocio (un Bulk price si vendo por cantidad, y un VIP price que fijo por variedad para mis VIP customers), **para** cobrarle a cada cliente exactamente lo que quiero sin tipear un **Special price** a mano, sin ver campos que no me corresponden y sin que el precio de nadie cambie por sorpresa.

La protagonista es quien vende. Afina los jobs de ventas y de variedades; no es un job nuevo. Las configuraciones son raras y deliberadas. El formulario de precio, el formulario de cliente y New sale las siguen.

**Cuando** tengo clientes habituales a los que trato distinto, **quiero** agruparlos en tipos a los que les pongo nombre yo y elegir el tipo de cada uno desde su ficha, **para poder** distinguirlos de un vistazo, y más adelante cobrarles según su tipo, sin depender de la memoria ni de notas. (GH-405: lo sirven acá el interruptor Customer types y la lista Customer types del grupo Prices; definido en customers.md.)

**Cuando** necesito cambiar cómo está configurado mi negocio, **quiero** cada configuración de todo el negocio en un solo lugar, cada una en su propia pantalla corta, **para** cambiarla en pocos toques desde el celular y volver con el cliente. (El job de Settings, navigation.md: lo sirve acá el grupo Prices.)

Sin esto, quienes venden dejan en blanco los campos de Bulk y VIP que no usan, y tipean a mano un Special price para cualquier VIP price que no sea el Bulk price.

Criterios de éxito:

1. **Solo se ven mis reglas.**
   - Con una regla desactivada, nada de ella aparece en el formulario de precio, la página de la **Variety**, el campo "Customer type" del formulario de **Customer**, New sale ni el texto del Catalog.
   - Una **Sale** recibe precio como si la regla no existiera.
   - Con las dos desactivadas, una Sale recibe precio solo por **List price**. **Gift** y Special price siguen funcionando.
2. **Mi VIP price, nunca peor que el normal.** A un VIP customer (un Customer del VIP type) se le cobra el menor de los precios de las reglas que se aplican a la línea:
   - el List price;
   - el Bulk price, cuando Bulk está activado y la línea llega al **Bulk minimum**;
   - el VIP price de la Variety, cuando Customer types está activado y la Price entry de ese día tiene uno.

   Una Variety sin VIP price le cobra a un VIP customer como a cualquier otro. La vista previa en vivo muestra el mismo precio antes de guardar.
3. **El precio de nadie se mueve por sorpresa.** Después de cada cambio, a cada VIP customer existente se le cobra exactamente lo que se le cobraba antes, por la misma Variety, día y gramos; también después de la actualización que pasó la marca VIP al VIP type. No cambia el precio, la regla ni el total de ninguna Sale pasada, hagan lo que hagan después los interruptores.
4. **Cambiar de interruptor no pierde nada.** Desactivar una regla y volver a activarla trae de vuelta cada Bulk price, VIP price, Customer type y pertenencia guardados. Solo las Sales y las Price entries registradas mientras estaba desactivada quedan sin ella.
5. **Los Customers nunca ven el VIP price.** El Catalog nunca lo muestra. Su línea de Bulk se muestra solo mientras Bulk price está activado.
6. **Rápido.** Cada interruptor se cambia en pocos toques desde Settings → Prices. Registrar una Sale sigue llevando menos de un minuto.
7. **Los Businesses nunca se mezclan** (ADR-0004). Los interruptores y los Customer types de un Business nunca afectan los precios, las pantallas ni el Catalog de otro.

## Comportamiento

### Los interruptores

- **Dos por Business**, independientes entre sí: Bulk price y Customer types.
- **Customer types** es el interruptor que antes se leía "VIP customers": conserva su columna `pricing_settings.is_vip_customers`, su valor guardado y su efecto; solo cambia la palabra de pantalla (ADR-0059). Gobierna los Customer types, el campo "Customer type" del formulario, el tipo en la ficha, la marca VIP y el VIP price.
- **Dónde se cambian**: solo en Settings → Prices. Cualquier **User** del Business puede cambiarlos; no hay roles.
- **Una regla desactivada**:
  - deja de aplicarse a las Sales nuevas y se oculta en cada pantalla que la muestra;
  - no elimina nada: las Sales pasadas conservan su precio y su regla (ADR-0003), y los Bulk prices, los VIP prices, los Customer types y la pertenencia de cada Customer siguen guardados;
  - con Customer types desactivado, guardar un Customer nunca cambia su tipo, y un Customer creado entonces no tiene tipo (customers.md);
  - al volver a activarla, cada valor guardado vuelve como estaba.
- **Cuándo rige un cambio de interruptor**: una Sale recibe precio según los interruptores vigentes cuando se guarda. Un cambio hecho mientras un formulario de Sale está abierto ni se rechaza ni se anuncia (sales.md).
- **Qué responde la API**: los valores guardados junto con los interruptores. Las pantallas ocultan lo desactivado. El texto del Catalog, que se arma en el servidor, deja afuera la línea de Bulk por sí mismo (catalog.md).

### El VIP price hasta los precios por tipo

- La pertenencia al VIP type, el tipo que la actualización creó en cada Business existente, da el VIP price en las Sales nuevas, con la regla de siempre y solo mientras Customer types está activado (customers.md, sales.md).
- Los tipos que crea el vendedor no llevan precio en esta parte.
- El campo "VIP price" del formulario de Price entry sigue atado a este interruptor y conserva su etiqueta hasta la parte customer-type prices.

### Valores iniciales

- **Businesses existentes** (en la migración de los interruptores): los dos interruptores activados.
  - Cada Price entry con un Bulk price recibe VIP price = Bulk price, así cada VIP customer paga exactamente lo que pagaba antes.
  - Un Bulk price ya es menor que el List price, así que el VIP price copiado cumple su propia regla.
- **Businesses existentes** (en la migración de los Customer types, ADR-0059): cada uno recibe su VIP type, con los Customers que tenían la marca VIP; ningún interruptor cambia.
- **Un Business nuevo**: los dos interruptores desactivados, hasta que el issue del **Onboarding** decida otra cosa, y ningún Customer type.
- **Un Business cargado por la Spreadsheet import**: la Spreadsheet import activa lo que usa la planilla y nunca desactiva nada (import.md).

### En pantalla: Settings → Prices

- **Lugar**: un grupo de Settings (navigation.md), después de Users y antes de Integrations.
- **Ruta**: `/settings/prices`, fijada en `scripts/design/screens.json`. No hay otro acceso: no se llega desde la página de una Variety ni desde el formulario de precio. A Customer types también se llega desde el aviso "Add a customer type" del formulario del Customer (customers.md).
- **Un formulario**:
  - "Close", y una confirmación al salir con cambios sin guardar; un grupo sin tocar se cierra de inmediato;
  - dos interruptores, "Bulk price" y "Customer types", cada uno marcado como activado o desactivado por palabra o forma y `aria-checked`, nunca solo por color;
  - el botón "Save the prices";
  - si sale bien, el toast "Prices saved", que no lleva datos.
- **Una línea fija** dice que las Sales pasadas conservan el precio con el que se registraron, y que desactivar una regla no elimina nada.
- **Una línea de ayuda fija bajo el interruptor Customer types**, que se muestra esté activado o desactivado:
  - en un Business con VIP type: "Customers in the VIP type pay the VIP price where a price has one. Other types have no price yet.";
  - en cualquier otro: "Customer types have no price yet."
  - No hay conteo, ni lista de Varieties sin VIP price, ni aviso en ningún otro lado.
- **Customer types**: la lista y la gestión de los tipos (crear, renombrar, cambiar el ícono, eliminar), en el mismo grupo Prices, oculta mientras el interruptor está apagado (customers.md).
- **Upkeep**: un guardado que cambia cualquiera de los dos interruptores lo dispara (pinned-catalog.md), porque la línea de Bulk del Catalog depende de Bulk price.
- **Avisos**: un grupo que ya no existe, la falta de red y los errores del servidor siguen accounts.md.
- Todo texto vive en el **Copy module**.

### Exportación

El **Business export** (accounts.md) guarda los dos interruptores tal como están guardados, y los Customer types por reflexión del esquema (ADR-0015).

### Restricciones

- Los interruptores y los Customer types pertenecen al Business de la **Session** (ADR-0004).
- Sus rutas entran en el barrido de aislamiento y en el test de rutas protegidas. Su almacenamiento entra en el test de migración de pertenencia.
- Ningún precio va a rechazos, logs, la consola ni el almacenamiento del navegador (ADR-0005).

## Métricas

- **Migración de los interruptores (criterio 3)**:
  - los Businesses existentes terminan con los dos interruptores activados;
  - cada Price entry con un Bulk price tiene VIP price = Bulk price;
  - para cada VIP customer existente, el precio, la regla y el total de una Sale son iguales a lo que eran antes, por la misma Variety, día y gramos: 0 diferencias.
- **Migración de los Customer types (criterio 3)**: ningún interruptor cambia de valor; cada Business existente tiene su VIP type con exactamente los Customers de `vip = 1`; para cada uno de ellos el precio, la regla y el total de una Sale nueva son iguales antes y después: 0 diferencias; el comparador M3 compartido encuentra 0 valores cambiados.
- **Valores por defecto**: un Business abierto con una **Invitation** de Business nuevo tiene los dos interruptores desactivados y ningún Customer type.
- **Cambiar de interruptor no pierde nada (criterio 4)**: después de desactivar y volver a activar, cada Bulk price, VIP price, Customer type y pertenencia guardados se leen como antes, incluido un Customer editado mientras Customer types estaba desactivado.
- **Inmutabilidad del precio guardado (criterio 3)**: después de cualquier cambio de interruptor o de pertenencia, el precio, la regla y el total de las líneas existentes no cambian.
- **Las pantallas siguen los interruptores (criterio 1)**: tests del front muestran, con cada interruptor desactivado, ningún rastro de él en el formulario de precio, la página de la Variety, el formulario, la ficha y la lista de Customers, la pantalla Customer types, el badge de Sales, New sale ni el Catalog. Los badges registrados en el detalle de una Sale se mantienen.
- **Grupo Prices (criterio 6)**:
  - tests del front cubren "Close", la confirmación de cambios sin guardar, un cierre sin tocar, "Save the prices", "Prices saved", la etiqueta "Customer types", la línea fija, las dos formas de la línea de ayuda, su lugar y su ruta, y la ausencia de cualquier otro acceso;
  - Prices se abre en 2 toques como máximo desde cualquier **Tab root**;
  - la corrida de punta a punta de Settings cambia cada regla desde un viewport de celular.
- **Upkeep**: un guardado que cambia cualquiera de los dos interruptores dispara el Upkeep; un guardado que no cambia ninguno no envía nada.
- **Aislamiento (criterio 7)**: las rutas de los interruptores y de los Customer types están en el barrido y en el test de rutas protegidas. Los interruptores y los tipos de un Business nunca cambian los precios, las pantallas ni el Catalog de otro.
- **Sin eco**: ningún rechazo ni línea de log contiene un precio.
- **Textos**: todo texto nuevo está en el Copy module y ningún valor por defecto nuevo lleva una palabra de flor.
- **Diseño**: `scripts/design/compare.sh` corre antes y después para Prices y Customer types, en celular y computadora, adjunto al PR.

## Fuera de alcance

- Otras reglas VIP, como un porcentaje sobre el List price.
- Precios promocionales por fecha.
- Precios por Customer type (parte customer-type prices).
- El Onboarding, incluido con qué arranca un Business nuevo.
- Rechazar o avisar en una Sale porque los interruptores cambiaron en medio de la Sale.
- Un aviso o conteo de Varieties sin VIP price.
- Roles o permisos para cambiar los interruptores.
- Aplicar al tocar, como hace Appearance: los interruptores cambian el precio de cada Sale nueva para cada socio, así que se guardan de forma explícita.

## Planned in GH-318

Todavía no está construido. Hasta que salga la parte nombrada, las secciones de arriba son lo que hace la app.

Cada pasaje nombra el ADR que lo decide, la parte que lo va a entregar y la oración actual que va a reemplazar. La parte que entrega un pasaje lo quita de acá y edita Comportamiento y Fuera de alcance en el mismo diff.

### Los precios por Customer type

Decidido en docs/adr/0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md; lo entrega la parte customer-type prices. (Los Customer types, su pertenencia, el VIP type y el interruptor Customer types ya los entregó la parte customer types, GH-405.)

- Cada tipo va a tener su propio precio por **Product**, guardado como filas con fecha de vigencia; la columna `vip_price` va a quedar congelada en su lugar. El List price, el Bulk price y los **Customer-type price**s van a seguir pudiendo activarse o desactivarse por Business.
- Cada Price entry con un VIP price va a recibir una fila de precio del VIP type, con la misma fecha y el mismo monto, así cada VIP customer va a pagar exactamente lo que pagaba antes.
- Va a reemplazar: toda la sección "El VIP price hasta los precios por tipo" y "Cada Price entry con un Bulk price recibe VIP price = Bulk price, así cada VIP customer paga exactamente lo que pagaba antes."
- Fuera de alcance: "Otras reglas VIP, como un porcentaje sobre el List price." y "Precios por Customer type" van a quedar afuera. "Precios promocionales por fecha." lo va a revertir la parte promotions (docs/adr/0060-the-applied-promotion-snapshot-is-typed-sale-promotion-rows-recorded-as-the-sale-stood-when-saved-and-never-recomputed.md; `sales.md`).
