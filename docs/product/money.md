# Dinero

## Jobs

- Cuando mi negocio guarda su dinero a una escala más fina que unidades enteras, quiero que cada monto que registro, veo y se exporta salga exactamente como lo ingresé, así confío en mis saldos, Profit y Cash sin revisarlos a mano. (GH-318, parte 18; ADR-0058.)
- Cuando mi negocio cuenta la plata en otra moneda o con centavos, quiero elegir yo mismo, desde Settings, el símbolo de la moneda y la cantidad de decimales, para que cada pantalla muestre y acepte la plata como la contamos mis clientes y yo, sin que ningún monto que ya registré cambie de valor. (GH-318, parte 20.)
  - Disparadores: un Business en otra moneda quiere su propio símbolo; un Business que cobra con centavos sube los decimales; un vendedor que los subió por error, o que nunca usó centavos, los vuelve a bajar.

## Qué es hoy

Cada Business tiene una Money scale (ADR-0058):

- Los Businesses que ya existían arrancaron en escala 0 y guardan unidades enteras de moneda.
- Todo Business abierto desde la parte 18 empieza en escala 2 y guarda centésimos: la apertura del Business (`app/money_format/adapters/opening.py`) escribe su fila de `money_format` con "$", 0 decimales y escala 2.
- Un Business en escala 0 pasa a escala 2 por el rescale (#402) cuando sube sus decimales. Un Business con más de 0 decimales siempre está en escala 2.

La escala es un dato de guardado, no de pantalla. Lo que ve el vendedor es el Money format del Business: un símbolo y de 0 a 2 decimales, "$" y 0 por defecto, que cualquier User del Business cambia en Settings → Business → Currency and decimals.

Antes de la parte 20, todo Business estaba fijo en "$" y 0 decimales: un vendedor en otra moneda veía "$" en todas partes, y uno que cobraba con centavos redondeaba o llevaba la diferencia fuera de la app.

## Reglas

### Currency and decimals (Settings → Business)

- Es una sola configuración por Business, en su fila de `money_format`. Cualquier User del Business la cambia; no hay roles.
- Un solo formulario con un solo Save y un monto de ejemplo en vivo con el formato nuevo mientras el vendedor tipea. No hay paso de confirmación, porque ningún valor cambia.
- Un Save sin cambios no cambia nada.
- **Símbolo**: de 1 a 4 caracteres después de recortar los espacios de los dos extremos, cualquier carácter ("US$", "R$", "EUR"). Siempre va antes del monto. No hay lista de monedas ni elección de posición (Assume nothing). Uno en blanco o demasiado largo se rechaza con un mensaje simple junto al campo, y no se guarda nada.
- **Decimales**: un número entero de 0 a 2.
- **Subir** los decimales rige de inmediato para todos los Users del Business. Si la Money scale todavía es 0, el mismo guardado llama al rescale (#402), que reescribe los enteros guardados sin cambiar el valor de ningún monto. Cambiar solo el símbolo, o subir los decimales, nunca corre el control de bajada.
- **Bajar** los decimales se rechaza cuando algún monto registrado del Business tiene más decimales de los que permite el valor nuevo.
  - El control es un EXISTS por cada columna de dinero declarada con `money_column()`, filtrado por `business_id`, dentro de un adaptador; su costo es lineal en las filas de dinero del Business y corre solo en esta acción rara. Ningún caso de uso lee la escala.
  - El control y el guardado van en una misma transacción, así que un monto con centavos guardado al mismo tiempo nunca queda debajo de una configuración más baja.
  - El rechazo es una sola oración fija con el Attention icon (p. ej. "Some recorded amounts have more decimals than that, so the decimals stay as they were."). No lista montos ni nombra el tipo de registro.
  - El formulario queda abierto con lo que tipeó el vendedor, y la configuración guardada queda como estaba. Si cambiaron el símbolo y los decimales y la bajada se rechaza, no se guarda nada, ni siquiera el símbolo.
- Un cambio guardado cuenta como un cambio que puede afectar el texto del Catalog: dispara la Upkeep del Pinned catalog, que solo edita en el lugar, nunca envía ni fija, y una falla muestra Out of date como hoy.
- Cada User del Business ve el formato nuevo la próxima vez que carga una pantalla. Nada se configura por User ni por dispositivo.

### Cómo se escribe un monto

- El símbolo, después el monto con exactamente los decimales del Business, coma decimal y punto para los miles. Los formatos numéricos siguen siendo argentinos hasta #317.
- En la app: `$ 11.000` con los valores por defecto; `US$ 11.000,50` con "US$" y 2 decimales.
- En el Catalog: su estilo propio, con el símbolo pegado a la cifra (`$11.000`, `US$11.000,50`), catalog.md.
- En el Sale bill: como en la app (`US$ 11.000,50`), sale-bill.md.
- Con los valores por defecto ("$", 0 decimales), cada pantalla, el Catalog y el Sale bill quedan idénticos byte a byte a como estaban.

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
- Ningún pedido lleva decimales ni escala. El formulario de Currency and decimals lleva el símbolo y los decimales que muestra el Business, nunca una escala.
- El contrato publicado de `MoneyOut` es `entero o número`, porque el serializador puede enviar las dos formas. Para `oasdiff` esto ensancha el tipo de cada campo de dinero de una respuesta (el CI `docs` lo marca como cambio incompatible, ADR-0066): la pull request lo declara con una línea `Breaking-API:`.
- Un Business con 0 decimales responde enteros en las dos escalas, así que un Business en escala 0 conserva sus enteros byte por byte. Uno con decimales puede responder un número no entero.

### Cifras que dividen

Algunas cifras dividen: el total de una Sale line, el costo por unidad que se toma de un Lot, el Cost of goods sold, el Stock shortfall, el costo de cada Withdrawal reason, el Margin, las Sales de gramos con costo y el Average sale.

- Se calculan exactas y se redondean mitad hacia arriba a los decimales que muestra el Business (Money format), nunca a un lugar más fino que su Money scale. Se muestran con esa precisión, y las que se guardan se guardan con ella.
- La asignación de Lots y el costeo de Draws (ADR-0010) siguen corriendo sobre valores del dominio en unidades enteras de centésimos, así que la unidad de redondeo es la misma en las dos escalas.
- Lo que el vendedor debe es siempre un monto que puede tipear. Ningún total de línea deja una fracción imposible de cobrar, y cobrar lo que muestra la pantalla nunca crea un Credit.
- Toda cifra, con división o sin ella (totales, Balance, Total owed, Profit, Cash, Cost of goods sold, Stock shortfall, costos de retiro, Margin, Margin %, Average sale, el Panel y Analysis), da exactamente lo mismo en un Business de escala 0 y en uno de escala 2 con los mismos datos y los mismos decimales.
- Esta regla está en la enmienda de ADR-0058, que también aclara cómo leer "a la unidad guardada" en ADR-0007 y ADR-0010.
- **Después de un cambio de decimales**:
  - Una cifra guardada cuando se registró (un total de línea, un costo) conserva el valor con que se guardó.
  - Una cifra calculada después del cambio se redondea mitad hacia arriba a los decimales vigentes. Siempre ocurre con decimales menores o iguales a la escala, porque subir hace primero el rescale.
  - Una cifra que solo se calcula al leerla (Margin, Average sale, Profit, etc.) no es un monto registrado: después de bajar los decimales se muestra redondeada mitad hacia arriba a los decimales nuevos.

### Rechazo por demasiados decimales

- El límite son los decimales que muestra el Business (Money format), no su escala. Con 0 decimales, 10.5 se rechaza incluso en un Business de escala 2; con 2 decimales, 10.505 se rechaza. Se controla por valor: 10.00 se acepta con 0 decimales.
- Todo monto que tipea el vendedor acepta hasta los decimales del Business: List, Bulk y VIP prices, Special price, Shipping charged, Payments, Expenses y el costo de cualquier Stock entry (Purchase, y el costo opcional de una Harvest o un Opening stock). Ninguno queda solo en enteros.
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

- El Catalog, el Pinned catalog y el Sale bill son lecturas de dinero y siguen el símbolo y los decimales del Money format del Business.
- El Catalog conserva su estilo propio (el símbolo pegado a la cifra, punto para los miles), catalog.md. El Sale bill usa el formato de la app, sale-bill.md, y toma el formato nuevo la próxima vez que se comparte.
- Con los mismos datos y el mismo Money format, un Business de escala 2 produce exactamente el mismo texto del Catalog y el mismo Sale bill que uno de escala 0.

### Aislamiento

- Un Business de escala 2 y uno de escala 0 en la misma instalación nunca cambian ni exponen el dinero, la escala ni el Money format del otro.
- Los montos con centavos de otro Business nunca frenan la bajada de decimales de un Business.
- Ningún User, link ni error revela al otro Business.
- Los seeders de aislamiento tienen un Business de cada escala en una misma instalación. La ruta de Currency and decimals está en el barrido de aislamiento y en la prueba de rutas protegidas.

## Fuera de alcance

- El rescale en sí (#402): esta parte solo lo llama.
- Elegir la moneda en el Onboarding.
- La posición del símbolo y una lista de monedas.
- Roles.
- Formatos numéricos y de fecha distintos de los argentinos, hasta #317.
- Cambiar el mensaje genérico que todavía muestran las Sheets de precio de promoción, Settings → Prices y el paso de Stock del Onboarding.
- Volver a importar un Business export.
- Cambiar migraciones existentes o valores de columnas existentes (invariante 1).

## Métricas

- Tests de rutas de dinero y seeders de aislamiento que pasan en escala 0 y en escala 2 (fixture `money_scale`, `SCALES = (0, 2)`): 100%.
- Diferencia en escala 0 con los valores por defecto, contra antes de la parte 18, en las respuestas del contrato, el Business export (salvo el bloque `money`) y el texto del Catalog y del Sale bill: 0 bytes.
- Montos que en escala 2 vuelven distintos de lo ingresado, en cualquier campo de dinero: 0.
- Cifras, con división o sin ella, que difieren entre escala 0 y escala 2 con los mismos datos (`tests/results/test_figures_across_scales.py`): 0.
- Totales de línea o Balances con una fracción más fina que los decimales que muestra el Business: 0.
- Montos con demasiados decimales que se guardan o se redondean en silencio: 0. Cada campo `MoneyAmount` de cada ruta responde 422 `money.too_many_decimals` ante 10.5 con 0 decimales y ante 10.505 con 2.
- Módulos de caso de uso o de dominio que importan el helper de dinero o leen la escala, y adaptadores que tocan una columna de dinero sin el helper: 0.
- Respuestas que filtran el dinero, la escala o el Money format de otro Business: 0.
- **Rapidez desde el teléfono (criterio 1 de la parte 20)**: un flujo en el viewport del teléfono cambia el símbolo y los decimales en Settings → Business → Currency and decimals y guarda con un solo Save, sin paso de confirmación: pasa.
- **Ningún valor cambia (criterio 1)**: cada campo de dinero de cada ruta, leído antes y después de un cambio de símbolo, de una subida y de una bajada aceptada, en escala 0 y en escala 2: 0 valores distintos.
- **Subir (criterio 2)**: después de subir de 0 a 2, un monto con 2 decimales en cada campo `MoneyAmount` vuelve exactamente como se ingresó: 100%. Subir en escala 0 deja al Business en escala 2: 100%.
- **Bajar (criterio 3)**: con una lista de cada columna declarada con `money_column()` y un monto con centavos plantado en cada una, de a una por vez, bajar a 0 se rechaza en el 100% de las columnas, con el símbolo y los decimales guardados sin cambios; sin ninguno, la bajada se acepta: 100%. Los centavos de otro Business frenan una bajada: 0 casos.
- **El rechazo (criterio 3)**: la oración fija con el Attention icon se muestra y el formulario conserva lo tipeado (vitest): 100%.
- **Para todos los Users (criterio 4)**: después de que un User guarda, la sesión de un segundo User del mismo Business lee el símbolo y los decimales nuevos en su próxima carga: 100%.
- **Upkeep**: un cambio de formato guardado dispara la Upkeep del Pinned catalog: 100%.
- Gate (pytest, vitest, e2e): pasa.
