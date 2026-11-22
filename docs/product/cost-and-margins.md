# Costo y márgenes

El **Cost and margins** de un **Product**: el costo por unidad de su última **Purchase** con costo y el margen que deja cada uno de sus precios vigentes (lista, mayorista y VIP, cuando el **Business** los usa). Es un costo de reposición, lo que costaría comprar más hoy; no es el **Lot order** ni el **Cost of goods sold**, y nunca cambia el **Profit**, el **Margin** ni ninguna cifra de Home o Analysis. Se calcula en cada lectura y nunca se guarda. Lo ve solo el Business dueño del Product (ADR-0004).

Hoy lo expone `GET /api/products/{id}`; ninguna pantalla lo muestra todavía. La página del Product que lo va a mostrar es una parte posterior de GH-522.

## Jobs

**Cuando** estoy por fijar o cambiar el precio de un Product, **quiero** ver cuánto me costó por unidad mi última Purchase de él y el margen que me deja cada uno de mis precios vigentes (lista, mayorista y VIP, cuando los uso), **para** saber si un precio todavía me deja plata sin sacar la cuenta a mano ni en la planilla vieja.

Antes, quien vendía dividía a mano el total de la Purchase por la cantidad, o buscaba en la planilla vieja. Esta parte (GH-968, dentro de GH-522) lo sirve con la API; el criterio "quien vende lo ve" se controla cuando salga la pantalla.

Criterios de éxito:

1. **Qué Purchase fija el costo**: la última Purchase con costo mayor que 0 y cantidad mayor que 0, con fecha de hoy o anterior. "Última" es por fecha y, dentro de la misma fecha, por orden de registro. Editar o eliminar esa Purchase cambia el costo. Una **Harvest**, un **Opening stock** o un **Adjustment** nunca lo fijan, aunque tengan costo.
2. **Qué significa el costo**: es un costo de reposición, no el Lot order ni el Cost of goods sold. Nunca cambia el Profit, el Margin ni ninguna cifra de Home o Analysis: las respuestas de `/analysis` y `/panel` quedan idénticas, byte por byte.
3. **Márgenes**:
   - cada **Pricing rule** que el Business tiene activada y que tiene precio hoy lleva un margen, en el orden lista, mayorista, VIP;
   - el margen se calcula desde el costo exacto y se redondea la mitad hacia arriba a un porcentaje entero;
   - el porcentaje es el mismo con 0 y con 2 decimales; solo el monto sigue los decimales del Business (333 con 0 decimales, 333.33 con 2);
   - un costo mayor que el precio da un margen negativo, sin ningún trato especial.
4. **Si no se sabe, no se inventa**:
   - un Product sin Purchase con costo no tiene monto ni márgenes, y nunca se muestra como $0;
   - un Product sin precio hoy tiene su costo y ningún margen;
   - un **Hidden product** tiene su costo;
   - un **Archived product** no tiene costo en absoluto, y restaurarlo lo devuelve.
5. **Los Businesses nunca se mezclan**: las Purchases de un Business nunca alimentan el costo de otro.

## Comportamiento

### Qué Purchase cuenta

- Entre las **Stock entry** del Product en el Business de la sesión, solo las de origen Purchase con `total_cost > 0`, `quantity > 0` y `entered_on` en el día pedido o antes.
- Gana la de fecha más reciente; en un empate, la registrada después (`recorded_at`, y después `id`).
- El filtro `total_cost > 0` se aplica al leer: una Purchase guardada con costo 0 nunca fija el costo.
- Una Purchase con fecha futura se ignora hasta que llega su día, y se vuelve a ignorar si el reloj retrocede.
- La lee un adaptador de stock, `SqlLatestCostedPurchase(session, business_id)` en `app/stock/adapters/latest_costed_purchase.py`, que implementa el puerto de productos `LatestCostedPurchase` con un solo select ordenado por `entered_on DESC, recorded_at DESC, id DESC` y `LIMIT 1`. Lee el dinero con `scaled` y `domain_amount`, como `purchases.py`, y nunca divide. `app/products/` nunca importa `app.stock`.

### El costo y su redondeo

- El costo por unidad es el costo total de esa Purchase dividido por su cantidad. Hoy la unidad guardada es el gramo, hasta que salga la parte units de GH-318; la definición habla de "por unidad" para no suponer nada del negocio.
- El monto se expresa a los decimales del **Money format** del Business y viaja en unidades de moneda (ADR-0058), redondeado la mitad hacia arriba: $1 por 2 g da 1 con 0 decimales. $10.000 por 30 g da 333 con 0 decimales y 333.33 con 2.
- El redondeo de razones vive en un solo lugar compartido, `app/shared/ratio.py`.

### Qué márgenes aparecen

- **Lista**: siempre que el Product tiene un **Current price** hoy.
- **Mayorista**: solo mientras la opción **Bulk price** está activada en los **Pricing settings** y la Price entry vigente tiene Bulk price. Sigue la opción cuando cambia.
- **VIP**: solo cuando se cumplen las tres condiciones: Customer types está activado, el Business tiene su **VIP type** y la Price entry vigente tiene un **VIP price** para ese tipo. Desactivar Customer types lo saca y volver a activarlo lo devuelve; eliminar el VIP type lo saca. Un tipo que quien vende llama "VIP" no da ningún margen VIP, porque solo cuenta el VIP type que crearon la actualización o la importación.
- Sin precio hoy no hay ningún margen.
- Cada margen es el precio menos el costo exacto, sobre el precio, en porcentaje entero redondeado la mitad hacia arriba (un -2,5 es -2). $1 por 2 g con precio de lista 3 da 83, calculado desde el costo exacto de 0,50 y no desde el 1 redondeado.

### Contrato

- Solo cambia `GET /api/products/{id}`, de forma aditiva: `ProductDetailOut` suma `cost: ProductCostOut | null`.
- `ProductCostOut = {amount: MoneyOut | null, margins: list[PriceMarginOut]}` y `PriceMarginOut = {rule: 'list' | 'bulk' | 'vip', percent: int}`.
- `cost` es `null` para un Archived product; `{amount: null, margins: []}` cuando el costo está pendiente (sin Purchase con costo); si no, `{amount, margins}`, con los márgenes en el orden lista, mayorista, VIP.
- `api_breaks` debe leer el cambio como aditivo.

### Restricciones

- Aislamiento (ADR-0004): el adaptador filtra por el `business_id` de la sesión; ninguna respuesta ni error revela datos de otro Business.
- No se guarda nada: ni el costo ni los márgenes tienen columna ni tabla.
- El ADR [20261122](../adr/20261122-el-costo-y-los-margenes-de-un-product-salen-de-la-ultima-purchase-con-costo-a-traves-de-un-puerto-de-products.md), en español con `summary:`, registra la elección del costo de reposición desde la última Purchase con costo a través de un puerto de productos que implementa stock, el monto en la unidad de los decimales del Business, el filtro `total_cost > 0` al leer, el redondeo compartido en `app/shared/ratio.py` y que nada se guarda.

## Métricas

- **Ejemplos fijados (criterios 1 y 3)**: `tests/products/test_cost_and_margins_api.py`, a través de `client` con el reloj movible y `money_scale`, 100% en verde, en las dos escalas:
  - $10.000 por 30 g con lista 11.000: 333 y 97% con 0 decimales; después de subir los decimales a 2 en Currency and decimals, 333.33 y 97%;
  - $1 por 2 g con lista 3, con 0 decimales: monto 1 y 83%;
  - dos Purchases en una misma fecha: gana la registrada después;
  - una Purchase con fecha de mañana se ignora al volver el reloj atrás;
  - editar y después eliminar la última Purchase: el costo la sigue y después queda pendiente;
  - una Harvest o un Opening stock con costo dejan el costo pendiente;
  - sin precio hoy, ningún margen;
  - el margen mayorista sigue la opción Bulk price;
  - VIP: orden lista, mayorista, VIP; desactivar Customer types lo saca y activarlo lo devuelve; eliminar el VIP type lo saca; un tipo llamado "VIP" creado por la API no da margen VIP;
  - un Hidden product muestra su costo; un Archived product da `null` y restaurarlo lo devuelve;
  - un costo mayor que el precio da un margen negativo.
- **Libros intactos (criterio 2)**: los tests fijados de `/analysis` y `/panel` de la parte anterior pasan byte por byte, sin ninguna aserción editada.
- **Aislamiento (criterio 5)**: `seed_varieties` de `tests/test_business_isolation.py` suma una Purchase con costo, y un test `client` / `other_client` muestra que la Purchase de un Business nunca alimenta el costo de otro. 100% en verde.
- **Contrato aditivo**: `api_breaks` no marca ninguna ruptura.

## Fuera de alcance

- Cualquier pantalla que muestre el costo o los márgenes: una parte posterior de GH-522.
- Cualquier cambio en otros endpoints, en el Profit, el Margin o el Cost of goods sold, o en lo que se guarda.
- Un costo promedio, un costo tomado de los **Lot**s o uno que sume Harvests, Opening stock o Adjustments.
- Márgenes para Customer types que no son el VIP type.
- Un aviso cuando un margen es negativo.
