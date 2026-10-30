# Pricing settings

Qué Pricing rules usa un **Business**: dos interruptores independientes, **Bulk price** (la regla bulk) y **VIP customers** (la regla VIP). Los ve y los cambia solo el Business al que pertenecen (ADR-0004), en **Settings** → Prices (navigation.md).

Lo que hace cada regla lo define la capacidad a cargo, y cada una sigue los interruptores:
- cómo se pone precio a una **Sale line**: sales.md;
- el Bulk price y el **VIP price** de una **Price entry**: varieties.md;
- la marca de **VIP customer**: customers.md;
- la línea de Bulk del **Catalog**: catalog.md;
- el disparador del **Upkeep**: pinned-catalog.md;
- lo que activa la **Spreadsheet import**: import.md.

## Jobs

**Cuando** configuro cómo pone precios mi negocio, registro el precio de una variedad o entrego un pedido, **quiero** que la app use solo las Pricing rules que tiene mi negocio (un Bulk price si vendo por cantidad, y un VIP price que fijo por variedad si tengo VIP customers), **para** cobrarle a cada cliente exactamente lo que quiero sin tipear un **Special price** a mano, sin ver campos que no me corresponden y sin que el precio de nadie cambie por sorpresa.

La protagonista es quien vende. Afina los jobs de ventas y de variedades; no es un job nuevo. Las configuraciones son raras y deliberadas. El formulario de precio, el formulario de cliente y New sale las siguen.

**Cuando** necesito cambiar cómo está configurado mi negocio, **quiero** cada configuración de todo el negocio en un solo lugar, cada una en su propia pantalla corta, **para** cambiarla en pocos toques desde el celular y volver con el cliente. (El job de Settings, navigation.md: lo sirve acá el grupo Prices.)

Sin esto, quienes venden dejan en blanco los campos de Bulk y VIP que no usan, y tipean a mano un Special price para cualquier VIP price que no sea el Bulk price.

Criterios de éxito:

1. **Solo se ven mis reglas.**
   - Con una regla desactivada, nada de ella aparece en el formulario de precio, la página de la **Variety**, la marca VIP del formulario de Customer, New sale ni el texto del Catalog.
   - Una **Sale** recibe precio como si la regla no existiera.
   - Con las dos desactivadas, una Sale recibe precio solo por **List price**. **Gift** y Special price siguen funcionando.
2. **Mi VIP price, nunca peor que el normal.** A un VIP customer se le cobra el menor de los precios de las reglas que se aplican a la línea:
   - el List price;
   - el Bulk price, cuando Bulk está activado y la línea llega al **Bulk minimum**;
   - el VIP price de la Variety, cuando VIP está activado y la Price entry de ese día tiene uno.

   Una Variety sin VIP price le cobra a un VIP customer como a cualquier otro. La vista previa en vivo muestra el mismo precio antes de guardar.
3. **El precio de nadie se mueve por sorpresa.** Después del cambio, a cada VIP customer existente se le cobra exactamente lo que se le cobraba antes, por la misma Variety, día y gramos. No cambia el precio, la regla ni el total de ninguna Sale pasada, hagan lo que hagan después los interruptores.
4. **Cambiar de interruptor no pierde nada.** Desactivar una regla y volver a activarla trae de vuelta cada Bulk price, VIP price y marca VIP guardados. Solo las Sales y las Price entries registradas mientras estaba desactivada quedan sin ella.
5. **Los Customers nunca ven el VIP price.** El Catalog nunca lo muestra. Su línea de Bulk se muestra solo mientras Bulk price está activado.
6. **Rápido.** Cada interruptor se cambia en pocos toques desde Settings → Prices. Registrar una Sale sigue llevando menos de un minuto.
7. **Los Businesses nunca se mezclan** (ADR-0004). Los interruptores de un Business nunca afectan los precios, las pantallas ni el Catalog de otro.

## Comportamiento

### Los interruptores

- **Dos por Business**, independientes entre sí: Bulk price y VIP customers.
- **Dónde se cambian**: solo en Settings → Prices. Cualquier **User** del Business puede cambiarlos; no hay roles.
- **Una regla desactivada**:
  - deja de aplicarse a las Sales nuevas y se oculta en cada pantalla que la muestra;
  - no elimina nada: las Sales pasadas conservan su precio y su regla (ADR-0003), y los Bulk prices, los VIP prices y las marcas VIP de los Customers siguen guardados;
  - al volver a activarla, cada valor guardado vuelve como estaba.
- **Cuándo rige un cambio de interruptor**: una Sale recibe precio según los interruptores vigentes cuando se guarda. Un cambio hecho mientras un formulario de Sale está abierto ni se rechaza ni se anuncia (sales.md).
- **Qué responde la API**: los valores guardados junto con los interruptores. Las pantallas ocultan lo desactivado. El texto del Catalog, que se arma en el servidor, deja afuera la línea de Bulk por sí mismo (catalog.md).

### Valores iniciales

- **Businesses existentes** (en la migración): los dos interruptores activados.
  - Cada Price entry con un Bulk price recibe VIP price = Bulk price, así cada VIP customer paga exactamente lo que pagaba antes.
  - Un Bulk price ya es menor que el List price, así que el VIP price copiado cumple su propia regla.
- **Un Business nuevo**: los dos interruptores desactivados, hasta que el issue del **Onboarding** decida otra cosa.
- **Un Business cargado por la Spreadsheet import**: la Spreadsheet import activa lo que usa la planilla y nunca desactiva nada (import.md).

### En pantalla: Settings → Prices

- **Lugar**: un grupo de Settings (navigation.md), después de Users y antes de Integrations.
- **Ruta**: `/settings/prices`, fijada en `scripts/design/screens.json`. No hay otro punto de entrada: no se llega desde la página de una Variety ni desde el formulario de precio.
- **Un formulario**:
  - "Close", y una confirmación al salir con cambios sin guardar; un grupo sin tocar se cierra de inmediato;
  - dos interruptores, "Bulk price" y "VIP customers", cada uno marcado como activado o desactivado por palabra o forma y `aria-checked`, nunca solo por color;
  - el botón "Save the prices";
  - si sale bien, el toast "Prices saved", que no lleva datos.
- **Una línea fija** dice que las Sales pasadas conservan el precio con el que se registraron, y que desactivar una regla no elimina nada.
- **Una línea de ayuda fija bajo el interruptor VIP**, que se muestra esté activado o desactivado: "Each variety needs its VIP price: without it, a VIP customer pays like anyone else." No hay conteo, ni lista, ni aviso en ningún otro lado.
- **Upkeep**: un guardado que cambia cualquiera de los dos interruptores lo dispara (pinned-catalog.md), porque la línea de Bulk del Catalog depende de Bulk price.
- **Avisos**: un grupo que ya no existe, la falta de red y los errores del servidor siguen accounts.md.

### Exportación

El **Business export** (accounts.md) guarda los dos interruptores tal como están guardados.

### Restricciones

- Los interruptores pertenecen al Business de la **Session** (ADR-0004).
- Sus rutas entran en el barrido de aislamiento y en el test de rutas protegidas. Su almacenamiento entra en el test de migración de pertenencia.
- Ningún precio va a rechazos, logs, la consola ni el almacenamiento del navegador (ADR-0005).

## Métricas

- **Migración (criterio 3)**:
  - los Businesses existentes terminan con los dos interruptores activados;
  - cada Price entry con un Bulk price tiene VIP price = Bulk price;
  - para cada VIP customer existente, el precio, la regla y el total de una Sale son iguales a lo que eran antes, por la misma Variety, día y gramos: 0 diferencias.
- **Valores por defecto**: un Business abierto con una **Invitation** de Business nuevo tiene los dos interruptores desactivados.
- **Cambiar de interruptor no pierde nada (criterio 4)**: después de desactivar y volver a activar, cada Bulk price, VIP price y marca VIP guardados se leen como antes, incluido un Customer editado mientras VIP estaba desactivado.
- **Inmutabilidad del precio guardado (criterio 3)**: después de cualquier cambio de interruptor, el precio, la regla y el total de las líneas existentes no cambian.
- **Las pantallas siguen los interruptores (criterio 1)**: tests del front muestran, con cada interruptor desactivado, ningún rastro de él en el formulario de precio, la página de la Variety, el formulario, la ficha y la lista de Customers, el badge de Sales, New sale ni el Catalog. Los badges registrados en el detalle de una Sale se mantienen.
- **Grupo Prices (criterio 6)**:
  - tests del front cubren "Close", la confirmación de cambios sin guardar, un cierre sin tocar, "Save the prices", "Prices saved", las dos líneas fijas, su lugar y su ruta, y la ausencia de cualquier otro punto de entrada;
  - Prices se abre en 2 toques como máximo desde cualquier **Tab root**;
  - la corrida de punta a punta de Settings cambia cada regla desde un viewport de celular.
- **Upkeep**: un guardado que cambia cualquiera de los dos interruptores dispara el Upkeep; un guardado que no cambia ninguno no envía nada.
- **Aislamiento (criterio 7)**: las rutas de los interruptores están en el barrido y en el test de rutas protegidas. Los interruptores de un Business nunca cambian los precios, las pantallas ni el Catalog de otro.
- **Sin eco**: ningún rechazo ni línea de log contiene un precio.
- **Diseño**: `scripts/design/compare.sh` corre antes y después para Prices, en celular y computadora, adjunto al PR.

## Fuera de alcance

- Otras reglas VIP, como un porcentaje sobre el List price.
- Precios promocionales por fecha.
- El Onboarding, incluido con qué arranca un Business nuevo.
- Rechazar o avisar en una Sale porque los interruptores cambiaron en medio de la Sale.
- Un aviso o conteo de Varieties sin VIP price.
- Roles o permisos para cambiar los interruptores.
- Aplicar al tocar, como hace Appearance: los interruptores cambian el precio de cada Sale nueva para cada socio, así que se guardan de forma explícita.

## Planned in GH-318

Todavía no está construido. Hasta que salga la parte nombrada, las secciones de arriba son lo que hace la app.

Cada pasaje nombra el ADR que lo decide, la parte que lo va a entregar y la oración actual que va a reemplazar. La parte que entrega un pasaje lo quita de acá y edita Comportamiento y Fuera de alcance en el mismo diff.

### Los Customer types y las Pricing rules

Decidido en docs/adr/0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md; lo entrega la parte customer-type prices.

- Los Customer types van a reemplazar la marca VIP única. Cada tipo va a tener su propio precio por Product, guardado como filas con fecha de vigencia; las columnas de la marca `vip` y de `vip_price` van a quedar congeladas en su lugar. El List price, el Bulk price y los Customer-type prices van a seguir pudiendo activarse o desactivarse por Business, como hoy los Pricing settings. Un Business nuevo va a arrancar sin ningún Customer type.
- Los Businesses existentes van a conservar VIP como Customer type, así cada VIP customer va a pagar exactamente lo que pagaba antes.
- Va a reemplazar: "**Dos por Business**, independientes entre sí: Bulk price y VIP customers." (el interruptor VIP va a pasar a ser el interruptor de Customer types) y "Cada Price entry con un Bulk price recibe VIP price = Bulk price, así cada VIP customer paga exactamente lo que pagaba antes."
- Fuera de alcance: "Otras reglas VIP, como un porcentaje sobre el List price." va a quedar afuera. "Precios promocionales por fecha." lo va a revertir la parte promotions (docs/adr/0060-the-applied-promotion-snapshot-is-typed-sale-promotion-rows-recorded-as-the-sale-stood-when-saved-and-never-recomputed.md; `sales.md`).
