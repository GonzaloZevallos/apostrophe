## Jobs

- Cuando mi negocio guarda su dinero a una escala más fina que unidades enteras, quiero que cada monto que registro, veo y se exporta salga exactamente como lo ingresé, así confío en mis saldos, Profit y Cash sin revisarlos a mano. (GH-318, parte 18; ADR-0058.)
- Cuando mi negocio cuenta la plata en otra moneda o con centavos, quiero elegir yo mismo, desde Settings, el símbolo de la moneda y la cantidad de decimales, para que cada pantalla muestre y acepte la plata como la contamos mis clientes y yo, sin que ningún monto que ya registré cambie de valor. (GH-318, parte 20.)
  - Disparadores: un Business en otra moneda quiere su propio símbolo; un Business que cobra con centavos sube los decimales; un vendedor que los subió por error, o que nunca usó centavos, los vuelve a bajar.
  - La parte 20 cumple los tres disparadores: cambia el símbolo, sube los decimales por el rescale (#402) y los baja de vuelta. Después de subir, las nueve rutas de escritura de dinero guardan y devuelven un monto con centavos exactamente (sección "Centavos en el dominio").

# Dinero

## Qué es hoy

Cada Business tiene una Money scale (ADR-0058):

- Los Businesses que ya existían están en escala 0 y guardan unidades enteras de moneda.
- Todo Business abierto desde la parte 18 empieza en escala 2 y guarda centésimos: la apertura del Business (`app/money_format/adapters/opening.py`) escribe su fila de `money_format` con "$", 0 decimales y escala 2.
- El rescale de escala 0 a escala 2 (#402) lo llama la subida de decimales de Settings, en el mismo guardado que el símbolo (ADR-0080).

La escala es un dato de guardado, no de pantalla. Lo que ve el vendedor es el Money format del Business: un símbolo y sus decimales, "$" y 0 por defecto. Cualquier User del Business cambia el símbolo y sube o baja los decimales, de 0 a 2, en Settings → Business → Currency and decimals.

Antes de la parte 20, todo Business estaba fijo en "$" y 0 decimales: un vendedor en otra moneda veía "$" en todas partes, también en el Catalog y el Sale bill que leen sus clientes, y uno que cobraba con centavos no tenía dónde registrarlos.

## Reglas

### Currency and decimals (Settings → Business)

- Es una sola configuración por Business, en su fila de `money_format`. Cualquier User del Business la cambia; no hay roles.
- Se llega desde la fila "Currency and decimals" de la propia lista del grupo Business en Settings (`/settings/currency`), junto a Withdrawal reasons. El formulario del Business conserva sus propios campos. La fila no muestra un resumen del formato guardado.
- Un solo formulario con un solo Save y un monto de ejemplo en vivo ("Example") con el formato nuevo mientras el vendedor tipea. No hay paso de confirmación, porque ningún valor cambia. Salir con cambios sin guardar abre el diálogo compartido de descartar.
- Un Save sin cambios no cambia nada.
- Un guardado exitoso muestra el aviso "Currency and decimals saved", y las pantallas ya abiertas pasan al formato nuevo sin navegar.
- **Símbolo**: de 1 a 4 caracteres, contados en code points después de recortar los espacios de los dos extremos (🇦🇷 cuenta como dos). Siempre va antes del monto. No hay lista de monedas ni elección de posición (Assume nothing).
  - Se acepta todo carácter visible: letras, dígitos, puntuación, un espacio dentro del símbolo, signos de moneda y emoji, con sus selectores de variación ("US$", "R$", "EUR", "€", un `*` suelto).
  - Se rechazan, porque el símbolo entra en cada línea de precio que leen los clientes (el Catalog, el Pinned catalog y el Sale bill) y la romperían o la darían vuelta sin verse:
    - dos asteriscos seguidos (`**`), que en el Catalog marcan negrita y no se pueden escapar;
    - los caracteres de control (categoría Unicode Cc: saltos de línea, tabulaciones);
    - los caracteres de formato (categoría Cf: los de ancho cero, los uniones y los que fuerzan o aíslan la dirección del texto, como el override de derecha a izquierda);
    - los separadores de línea y de párrafo (categorías Zl y Zp).
    Como consecuencia, un emoji compuesto con un unión de ancho cero (p. ej. una familia) se rechaza.
  - Uno en blanco, demasiado largo, con `**` o con uno de esos caracteres se rechaza con un mensaje simple del Copy module junto al campo, que no nombra ninguna moneda. El formulario queda abierto con lo tipeado y no se guarda nada, ni siquiera decimales cambiados en el mismo Save.
- **Decimales**: un número entero de 0 a 2, elegido entre 0 · 1 · 2, un Fixed set (`MONEY_DECIMALS`).
- **Subir** los decimales por encima de 0 llama al rescale (#402) en el mismo guardado cuando la escala todavía es 0 (el rescale multiplica por 100 cada columna de dinero sin cambiar el valor de ningún monto). Un Business que ya está en escala 2 solo cambia el valor de `decimals`. Subir nunca corre el control de la bajada. Cada rechazo del rescale (un monto demasiado grande para reescalar, la base ocupada, una falla del control) tiene su propia oración fija.
- **Se aplica todo o nada**: el símbolo, los decimales y el rescale se guardan en una sola transacción con un solo commit; cualquier rechazo deja el símbolo y los decimales como estaban.
- **Rutas**: `GET` y `PUT /api/money-format` llevan `{symbol, decimals}` y nunca una escala. Los rechazos son `422 money_format.symbol_invalid` (campo `symbol`), `422 money_format.decimals_invalid` (campo `decimals`), `409 money_format.decimals_below_recorded`, `409 money_format.amount_too_large`, `503 money_format.busy` y `500 money_format.rescale_check_failed`. `GET /auth/me` lleva el formato del Business en `money: {symbol, decimals}`.
- **Bajar** los decimales se rechaza cuando algún monto registrado del Business tiene más decimales de los que permite el valor nuevo.
  - El control es un EXISTS por cada columna de dinero declarada con `money_column()`, enumeradas desde la metadata y filtrado por `business_id`, dentro de un adaptador; su costo es lineal en las filas de dinero del Business y corre solo en esta acción rara. Ningún caso de uso lee la escala.
  - El control y el guardado van en una misma transacción, así que un monto con centavos guardado al mismo tiempo nunca queda debajo de una configuración más baja.
  - El rechazo es una sola oración fija con el Attention icon (p. ej. "Some recorded amounts have more decimals than that, so the decimals stay put."). No lista montos ni nombra el tipo de registro.
  - El formulario queda abierto con lo que tipeó el vendedor, y la configuración guardada queda como estaba. Si cambiaron el símbolo y los decimales y la bajada se rechaza, no se guarda nada, ni siquiera el símbolo.
  - El control se prueba plantando montos con centavos directamente, columna por columna, y también con los que las rutas de escritura guardan.
- Una falla de red muestra el aviso de sin conexión y una falla del servidor el error genérico; en los dos casos el formulario conserva lo tipeado.
- Un cambio guardado cuenta como un cambio que puede afectar el texto del Catalog: dispara la Upkeep del Pinned catalog, que solo edita en el lugar, nunca envía ni fija, y una falla muestra Out of date como hoy.
- Cada User del Business ve el formato nuevo la próxima vez que carga una pantalla (lo lee de `/auth/me`). Nada se configura por User ni por dispositivo.
- La línea de moneda del Onboarding lee el formato guardado.

### Cómo se escribe un monto

- El símbolo, un espacio, después el monto con exactamente los decimales del Business, coma decimal y punto para los miles. Los formatos numéricos siguen siendo argentinos hasta #317.
- En la app: `$ 11.000` con los valores por defecto, `US$ 11.000` con "US$". Con 2 decimales se lee `US$ 11.000,50`.
- En el Catalog: su estilo propio, con el símbolo pegado a la cifra (`$11.000`, `US$11.000,50`), catalog.md.
- En el Sale bill: como en la app, sale-bill.md.
- El front toma el formato de `/auth/me` (`me.money`): la parte con sesión (`GatedLayout`) se lo pasa a `MoneyFormatProvider`, y cada pantalla escribe la plata con `useMoney()`. Mientras `me` carga, la parte con sesión no dibuja nada, así que ningún monto se escribe antes de conocer el formato. Un guardado de Currency and decimals pone el formato nuevo en la caché de `me` e invalida todas las consultas, así que las pantallas ya abiertas cambian sin navegar.
- Los formateadores de la app, del Catalog y del Sale bill aceptan de 0 a 2 decimales y se prueban así.
- Con los valores por defecto ("$", 0 decimales), cada pantalla, el Catalog y el Sale bill quedan idénticos byte a byte a como estaban.

### Centavos en el dominio

- El dominio guarda un monto como un entero en la unidad de los decimales del Business: una unidad entera con 0 decimales, un décimo con 1, un centésimo con 2.
- Cada caso de uso de escritura convierte el monto del pedido con `domain_amount_within` (que llama a `money_within` y después a `Money.in_decimals`); cada adaptador lee con `domain_amount` y escribe con `money_of_domain` (`Money.of_decimals`). La respuesta escribe unidades de moneda con los decimales del Business (`MoneyOut`).
- Con 2 decimales, `10.50` se guarda como `1050` en su columna `money_column()` y se lee de vuelta exactamente en las nueve rutas que recorre `tests/money_format/test_money_format_route.py`: `POST /api/products/{id}/prices`, `POST /expenses`, `PUT /expenses/{id}`, `POST /sales` (con `shipping_charged` y con `special_price`), `POST /stock/entries`, `PUT /stock/entries/{id}`, `POST /customers/{id}/payments` y su vista previa.
- Con 0 decimales, un monto con centavos en una ruta de escritura con cuerpo responde `422 money.too_many_decimals` con el mensaje existente: nunca un 500 y nunca un redondeo. Una lectura o un DELETE que encuentra un monto guardado que no se puede representar sigue respondiendo 500.

### Dónde se aplica la escala

- Toda lectura y escritura de dinero pasa por el único helper de dinero del adaptador (`app/db.py`): ventas y Sale lines (`sql_sales`, el Sale bill), Price entries y el texto del Catalog, pagos y Settlement, gastos, Stock entries y Purchases, cifras de stock (`stock_figures`, costos de Draws y de líneas), y resultados (Panel, Analysis, Balances, Total owed).
- Un caso de uso o el dominio nunca leen la escala ni importan el helper (invariante 8). Un test de arquitectura falla si alguno lo hace, y otro recorre los adaptadores y falla si uno toca una columna de dinero sin pasar por el helper.
- **Lectura**: el adaptador lee la columna con `scaled()`, que la multiplica en SQL por el factor del Business (100 en escala 0, 1 en escala 2) dentro de la misma sentencia que carga las filas o dentro del `SUM`, así que todo monto llega en centésimos. Llega al dominio en la unidad de los decimales del Business con `domain_amount` (`Money.in_decimals`), que nunca trunca ni redondea: si el valor guardado no se puede representar, es una falla de integridad que responde el 500 genérico, con un texto fijo y sin ningún monto, nunca un 4xx.
- **Escritura**: un monto del dominio se convierte en `Money` con `money_of_domain` y se guarda con `money_stored_value`, exacto o con error; ninguna sentencia SQL divide un monto.
- El factor de escala y los decimales del Business se leen juntos, en una sola sentencia, una vez por unidad de trabajo, para el Business de la sesión, y se olvidan al terminar la transacción. Leerlos no agrega ninguna consulta por pedido ni por lista.
- El Spreadsheet import controla sus montos con `money_within` y escribe por los mismos repositorios, así que carga los mismos montos en un Business de escala 0 o de escala 2.
- Un monto se guarda solo en una columna entera tipada declarada con `money_column()` (invariante 9).

### En el contrato

- Todo campo de dinero de un pedido usa `MoneyAmount` y se lee como Decimal exacto, nunca como float (invariante 7). Rechaza lo que no es un número, los infinitos y los que tienen demasiados dígitos (`money.invalid`).
- Todo campo de dinero de una respuesta usa `MoneyOut`: un entero JSON cuando el valor es entero, y si no un número JSON exacto (`10.5`); nunca un string ni un float.
- Ningún pedido lleva una escala. El formulario de Currency and decimals lleva el símbolo y los decimales que muestra el Business, nunca una escala; ningún otro pedido lleva decimales.
- El contrato publicado de `MoneyOut` es `entero o número`, porque el serializador puede enviar las dos formas. Para `oasdiff` esto ensancha el tipo de cada campo de dinero de una respuesta (el CI `docs` lo marca como cambio incompatible, ADR-0066): la pull request lo declara con una línea `Breaking-API:`.
- Un Business con 0 decimales responde siempre enteros, en las dos escalas, así que conserva sus respuestas byte por byte. Con centavos, un monto no entero sale como número exacto, y el front lo muestra con los decimales del Business.

### Cifras que dividen

Algunas cifras dividen: el total de una Sale line, el costo por unidad que se toma de un Lot, el Cost of goods sold, el Stock shortfall, el costo de cada Withdrawal reason, el Margin, las Sales de gramos con costo y el Average sale.

- Se calculan exactas y se redondean mitad hacia arriba a los decimales que muestra el Business (Money format), nunca a un lugar más fino que su Money scale. Se guardan y se muestran con esa precisión.
- La asignación de Lots y el costeo de Draws (ADR-0010) corren sobre valores del dominio en la unidad de los decimales del Business, así que, con los mismos decimales, la unidad de redondeo es la misma en las dos escalas.
- Lo que el vendedor debe es siempre un monto que puede tipear. Ningún total de línea deja una fracción imposible de cobrar, y cobrar lo que muestra la pantalla nunca crea un Credit.
- Toda cifra, con división o sin ella (totales, Balance, Total owed, Profit, Cash, Cost of goods sold, Stock shortfall, costos de retiro, Margin, Margin %, Average sale, el Panel y Analysis), da exactamente lo mismo en un Business de escala 0 y en uno de escala 2 con los mismos datos y el mismo Money format.
- Esta regla está en la enmienda de ADR-0058, que también aclara cómo leer "a la unidad guardada" en ADR-0007 y ADR-0010.
- **Después de un cambio de decimales**: una cifra guardada cuando se registró conserva su valor; una calculada después se redondea mitad hacia arriba a los decimales vigentes; una que solo se calcula al leerla (Margin, Average sale, Profit, etc.) no es un monto registrado y se muestra redondeada a los decimales vigentes.

### Rechazo por demasiados decimales

- El límite son los decimales que muestra el Business (Money format), no su escala. Con 0 decimales, 10.5 se rechaza incluso en un Business de escala 2; con 2 decimales, 10.50 se guarda y 10.505 se rechaza. Se controla por valor: 10.00 se acepta con 0 decimales.
- El control vive en una sola función del dominio, `money_within`, que cada caso de uso llama con el Money format del Business, leído por su propio puerto (que nunca lee la escala). Rechaza con 422 `money.too_many_decimals` y un `detail` fijo, sin ningún monto. No se redondea ni se guarda nada.
- En el front, cada campo de monto (`MoneyInput`) toma del Money format del Business su teclado y su lectura (`parseMoneyInput`): con 0 decimales el teléfono abre el teclado numérico y con decimales el decimal. Un monto se acepta con coma decimal o un solo punto y hasta los decimales vigentes. Con decimales, al salir del campo el monto se reescribe como cifra (`11.5` se lee `11,50`).
- El vendedor ve un mensaje del Copy module que sigue los decimales del Business: "Use whole amounts only." con 0 decimales y "Use up to {decimals} decimals." en otro caso. No nombra ninguna moneda (Assume nothing) ni lleva ninguna palabra de flor, y el `detail` de la API nunca se muestra (Product language).
- El valor tipeado queda en el campo para corregirlo y volver a guardar.
- Dónde se ve hoy:
  - Record payment ("Collect"), el formulario de Expense y el costo de una Stock entry: debajo del campo de monto, en la línea de error de Campo, sin Attention icon.
  - El formulario de Price y el precio del Onboarding: siempre debajo del List price, aunque el monto rechazado sea el Bulk price o el VIP price.
  - New sale: como mensaje del formulario, no debajo del Shipping charged ni del Special price.
  - Settings → Prices y el paso de Stock del Onboarding: todavía muestran el genérico "Check the details and try again."; el monto igual se rechaza y no se guarda nada.

### Business export

- Los campos de dinero llevan el entero guardado a la escala del Business, tal como está guardado, con un bloque `money {scale, decimals}` al lado (ADR-0058, ADR-0015).
- El bloque se lee en la misma transacción y en el mismo paso que las filas del export, antes del borrado, por un puerto propio de la Business removal; la fila de `money_format` se cuenta entre las exportadas y las borradas.
- Un export de escala 0 conserva sus enteros exactamente como antes, salvo el bloque nuevo.
- El chequeo de conteos de la Business removal no cambia.

### Texto que ve el Customer

- El Catalog, el Pinned catalog y el Sale bill son lecturas de dinero y siguen el símbolo y los decimales del Money format del Business.
- El Catalog conserva su estilo propio (el símbolo pegado a la cifra, punto para los miles), catalog.md. El Sale bill usa el formato de la app, sale-bill.md, y toma el formato nuevo la próxima vez que se comparte.
- Como el símbolo nunca lleva `**`, ni caracteres de control, de formato o separadores, nunca abre ni cierra una negrita, nunca parte una línea y nunca da vuelta la cifra de al lado en el Catalog, el Pinned catalog ni el Sale bill.
- Con los mismos datos y el mismo Money format, un Business de escala 2 produce exactamente el mismo texto del Catalog y el mismo Sale bill que uno de escala 0.

### Aislamiento

- Un Business de escala 2 y uno de escala 0 en la misma instalación nunca cambian ni exponen el dinero, la escala ni el Money format del otro.
- Los montos con centavos de otro Business nunca frenan la bajada de decimales de un Business.
- Ningún User, link ni error revela al otro Business.
- Los seeders de aislamiento tienen un Business de cada escala en una misma instalación. La ruta de Currency and decimals está en el barrido de aislamiento y en la prueba de rutas protegidas.

## Fuera de alcance

- El rescale en sí (#402).
- Elegir la moneda en el Onboarding.
- La posición del símbolo y una lista de monedas.
- Un resumen del formato guardado en la fila de Settings.
- Ayudar a encontrar los montos que frenan una bajada.
- Escapar los marcadores `**` del texto del Catalog.
- Contar el largo del símbolo en grafemas en lugar de code points.
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
- Montos con demasiados decimales que se guardan o se redondean en silencio: 0. Con 0 decimales, cada campo `MoneyAmount` de cada ruta responde 422 `money.too_many_decimals` ante 10.5, y nunca un 500.
- Módulos de caso de uso o de dominio que importan el helper de dinero o leen la escala, y adaptadores que tocan una columna de dinero sin el helper: 0.
- Sentencias SQL de más por pedido o por lista por leer la escala y los decimales: 0.
- Respuestas que filtran el dinero, la escala o el Money format de otro Business: 0.
- **Rapidez desde el teléfono (criterio 1 de la parte 20)**: un flujo en el viewport del teléfono cambia el símbolo y los decimales en Settings → Business → Currency and decimals y guarda con un solo Save, sin paso de confirmación: pasa.
- **Ningún valor cambia (criterio 1)**: cada campo de dinero de cada ruta, leído antes y después de un cambio de símbolo, una subida y una bajada aceptada, en escala 0 y en escala 2: 0 valores distintos.
- **Símbolo válido**: 100% de aprobación en ambos sentidos.
  - Se rechazan junto al campo, sin guardar nada: uno en blanco, uno de más de 4 code points, uno con `**` ("**", "a**b"), con un salto de línea o una tabulación, con un carácter de ancho cero, con un override o un aislamiento de dirección, con un separador de línea o de párrafo, y un emoji compuesto con unión de ancho cero.
  - Se guardan: "US$", "R$", "EUR", "€", uno con un `*` suelto, uno con un espacio interno, "🇦🇷" (dos code points) y un emoji con selector de variación.
- **Subir (criterio 2)**: después de subir de 0 a 2, `10.50` enviado a cada una de las nueve rutas de escritura de dinero se guarda como `1050` y se lee de vuelta exactamente: 100%. Subir en escala 0 deja el Business en escala 2: 100%.
- **Bajar (criterio 3)**: con una lista de cada columna declarada con `money_column()` y un monto con centavos plantado en cada una, de a una por vez, en un Business de escala 2 con decimales en 2, bajar a 0 se rechaza en el 100% de las columnas, con el símbolo y los decimales guardados sin cambios; sin ninguno, la bajada se acepta: 100%. Una columna que admite NULL y lo tiene nunca frena. Los centavos de otro Business frenan una bajada: 0 casos.
- **Los rechazos (criterio 3)**: la oración fija con el Attention icon se muestra y el formulario conserva lo tipeado (vitest): 100%.
- **Para todos los Users (criterio 4)**: después de que un User guarda, la sesión de un segundo User del mismo Business lee el formato nuevo en su próxima carga: 100%.
- **Upkeep**: un cambio de formato guardado dispara la Upkeep del Pinned catalog una vez, y un Save sin cambios no la dispara: 100%.
- Gate (pytest, vitest, e2e): pasa.
