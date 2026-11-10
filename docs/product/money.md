# Dinero

## Jobs

- Cuando mi negocio guarda su dinero a una escala más fina que unidades enteras, quiero que cada monto que registro, veo y se exporta salga exactamente como lo ingresé, así confío en mis saldos, Profit y Cash sin revisarlos a mano. (GH-318, parte 18; ADR-0058.)

## Qué es hoy

Cada Business tiene una Money scale (ADR-0058):

- Los Businesses que ya existían están en escala 0 y guardan unidades enteras de moneda, como siempre.
- Todo Business abierto desde ahora empieza en escala 2 y guarda centésimos: la apertura del Business (`app/money_format/adapters/opening.py`) escribe su fila de `money_format` con "$", 0 decimales y escala 2.

La escala es un dato de guardado, no de pantalla. Todo Business muestra por ahora "$" con 0 decimales (Money format), así que el vendedor sigue tipeando montos enteros en cualquier escala, y no ve ninguna diferencia entre un Business de escala 0 y uno de escala 2.

Antes de esta parte, el peso entero era la única opción y nadie la rodeaba a mano.

## Reglas

### Dónde se aplica la escala

- Toda lectura y escritura de dinero pasa por el único helper de dinero del adaptador (`app/db.py`): ventas y Sale lines (`sql_sales`, el Sale bill), Price entries y el texto del Catalog, pagos y Settlement, gastos, Stock entries y Purchases, cifras de stock (`stock_figures`, costos de Draws y de líneas), y resultados (Panel, Analysis, Balances, Total owed).
- Un caso de uso o el dominio nunca leen la escala ni importan el helper (invariante 8). Un test de arquitectura falla si alguno lo hace, y otro recorre los adaptadores y falla si uno toca una columna de dinero sin pasar por el helper.
- **Lectura**: el adaptador lee la columna con `scaled()`, que la multiplica en SQL por el factor del Business (100 en escala 0, 1 en escala 2) dentro de la misma sentencia que carga las filas o dentro del `SUM`, así que todo monto llega en centésimos. Llega al dominio en unidades enteras con `Money.whole_units()`, que nunca trunca ni redondea: si el valor guardado no se puede representar, es una falla de integridad que responde el 500 genérico, con un texto fijo y sin ningún monto, nunca un 4xx.
- **Escritura**: un monto del dominio se convierte en `Money` y se guarda con `money_stored_value`, exacto o con error; ninguna sentencia SQL divide un monto.
- El factor se busca una sola vez por unidad de trabajo, para el Business de la sesión, y se olvida al terminar la transacción.
- El Spreadsheet import controla sus montos con `money_within` y escribe por los mismos repositorios, así que carga los mismos montos en un Business de escala 0 o de escala 2.
- Un monto se guarda solo en una columna entera tipada declarada con `money_column()` (invariante 9).

### En el contrato

- Todo campo de dinero de un pedido usa `MoneyAmount` y se lee como Decimal exacto, nunca como float (invariante 7). Rechaza lo que no es un número, los infinitos y los que tienen demasiados dígitos (`money.invalid`).
- Todo campo de dinero de una respuesta usa `MoneyOut`: un entero JSON cuando el valor es entero, y si no un número JSON exacto; nunca un string ni un float.
- Ningún pedido lleva decimales ni escala.
- El contrato publicado de `MoneyOut` es `entero o número`, porque el serializador puede enviar las dos formas. Para `oasdiff` esto ensancha el tipo de cada campo de dinero de una respuesta (el CI `docs` lo marca como cambio incompatible, ADR-0066): la pull request lo declara con una línea `Breaking-API:`. Ninguna respuesta de hoy cambia de valor.
- Hoy toda respuesta es un entero en las dos escalas, así que un Business en escala 0 conserva sus enteros byte por byte. El front acepta también un número no entero sin cambiar nada de lo que muestra en escala 0.

### Cifras que dividen

Algunas cifras dividen: el total de una Sale line, el costo por unidad que se toma de un Lot, el Cost of goods sold, el Stock shortfall, el costo de cada Withdrawal reason, el Margin, las Sales de gramos con costo y el Average sale.

- Se calculan exactas y se redondean mitad hacia arriba a los decimales que muestra el Business (Money format; hoy, unidades enteras), nunca a un lugar más fino que su Money scale. Se guardan y se muestran con esa precisión.
- La asignación de Lots y el costeo de Draws (ADR-0010) siguen corriendo sobre valores del dominio en unidades enteras, así que la unidad de redondeo es la misma en las dos escalas.
- Lo que el vendedor debe es siempre un monto que puede tipear. Ningún total de línea deja una fracción imposible de cobrar, y cobrar lo que muestra la pantalla nunca crea un Credit.
- Toda cifra, con división o sin ella (totales, Balance, Total owed, Profit, Cash, Cost of goods sold, Stock shortfall, costos de retiro, Margin, Margin %, Average sale, el Panel y Analysis), da exactamente lo mismo en un Business de escala 0 y en uno de escala 2 con los mismos datos.
- Esta regla está en la enmienda de ADR-0058, que también aclara cómo leer "a la unidad guardada" en ADR-0007 y ADR-0010.
- Qué pasa con el redondeo cuando un Business sube sus decimales lo define la parte que agregue esa configuración.

### Rechazo por demasiados decimales

- El límite son los decimales que muestra el Business (Money format), no su escala. Hoy son 0 en todos, así que 10.5 se rechaza incluso en un Business de escala 2; con 2 decimales, 10.505 se rechazaría. Se controla por valor: 10.00 se acepta con 0 decimales.
- El control vive en una sola función del dominio, `money_within`, que cada caso de uso llama con el Money format del Business, leído por su propio puerto (que nunca lee la escala). Rechaza con 422 `money.too_many_decimals` y un `detail` fijo, sin ningún monto. No se redondea ni se guarda nada.
- El vendedor ve un mensaje del Copy module que sigue los decimales del Business: "Use whole amounts only." con 0 decimales y "Use up to {decimals} decimals." en otro caso. No nombra ninguna moneda (Assume nothing) ni lleva ninguna palabra de flor, y el `detail` de la API nunca se muestra (Product language).
- El valor tipeado queda en el campo para corregirlo y volver a guardar.
- Dónde se ve hoy:
  - Record payment ("Collect"), el formulario de Expense y el costo de una Stock entry: debajo del campo de monto, en la línea de error de Campo, sin Attention icon.
  - El formulario de Price y el precio del Onboarding: siempre debajo del List price, aunque el monto rechazado sea el Bulk price o el VIP price.
  - New sale: como mensaje del formulario, no debajo del Shipping charged, el Special price o el monto pagado en el acto.
  - Las Sheets de precio de promoción, Settings → Prices y el paso de Stock del Onboarding: todavía muestran el genérico "Check the details and try again."; el monto igual se rechaza y no se guarda nada.

### Business export

- Los campos de dinero llevan el entero guardado a la escala del Business, tal como está guardado, con un bloque `money {scale, decimals}` al lado (ADR-0058, ADR-0015).
- El bloque se lee en la misma transacción y en el mismo paso que las filas del export, antes del borrado, por un puerto propio de la Business removal; la fila de `money_format` se cuenta entre las exportadas y las borradas.
- Un export de escala 0 conserva sus enteros exactamente como antes, salvo el bloque nuevo.
- El chequeo de conteos de la Business removal no cambia.

### Texto que ve el Customer

- El Catalog y el Sale bill son lecturas de dinero.
- Un Business de escala 2 produce exactamente el mismo texto del Catalog ("$11.000") y el mismo Sale bill que uno de escala 0 con los mismos datos, sin formato nuevo.

### Aislamiento

- Un Business de escala 2 y uno de escala 0 en la misma instalación nunca cambian ni exponen el dinero ni la escala del otro.
- Ningún User, link ni error revela al otro Business.
- Los seeders de aislamiento tienen un Business de cada escala en una misma instalación.

## Fuera de alcance

- Una configuración para elegir decimales; los centavos se podrán tipear recién cuando una parte posterior la agregue.
- El rescale de escala 0 a escala 2.
- Volver a importar un Business export.
- Un formato de dinero nuevo.
- Cambiar migraciones existentes o valores de columnas existentes (invariante 1).

## Métricas

- Tests de rutas de dinero y seeders de aislamiento que pasan en escala 0 y en escala 2 (fixture `money_scale`, `SCALES = (0, 2)`): 100%.
- Diferencia en escala 0, contra antes de esta parte, en las respuestas del contrato, el Business export (salvo el bloque `money`) y el texto del Catalog y del Sale bill: 0 bytes.
- Montos que en escala 2 vuelven distintos de lo ingresado, en cualquier campo de dinero: 0.
- Cifras, con división o sin ella, que difieren entre escala 0 y escala 2 con los mismos datos (`tests/results/test_figures_across_scales.py`): 0.
- Totales de línea o Balances con una fracción más fina que los decimales que muestra el Business: 0.
- Montos con demasiados decimales que se guardan o se redondean en silencio: 0. Cada campo `MoneyAmount` de cada ruta responde 422 `money.too_many_decimals` ante 10.5.
- Módulos de caso de uso o de dominio que importan el helper de dinero o leen la escala, y adaptadores que tocan una columna de dinero sin el helper: 0.
- Respuestas que filtran el dinero o la escala de otro Business: 0.
- Gate (pytest, vitest, e2e): pasa.
