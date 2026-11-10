# Dinero

## Jobs

- Cuando mi negocio guarda su dinero a una escala más fina que unidades enteras, quiero que cada monto que registro, veo y se exporta salga exactamente como lo ingresé, así confío en mis saldos, Profit y Cash sin revisarlos a mano. (GH-318, parte 18; ADR-0058.)
- Cuando mi negocio cuenta la plata en otra moneda o con centavos, quiero elegir yo mismo, desde Settings, el símbolo de la moneda y la cantidad de decimales, para que cada pantalla muestre y acepte la plata como la contamos mis clientes y yo, sin que ningún monto que ya registré cambie de valor. (GH-318, parte 20.)
  - Disparadores: un Business en otra moneda quiere su propio símbolo; un Business que cobra con centavos sube los decimales; un vendedor que los subió por error, o que nunca usó centavos, los vuelve a bajar.
  - La parte 20 cumple los tres disparadores: cambia el símbolo, sube los decimales por el rescale (#402) y los baja de vuelta. Queda una brecha abierta, descrita en "Brecha: centavos en el dominio": después de subir, la mayoría de las rutas todavía no puede guardar un monto con centavos.

## Qué es hoy

Cada Business tiene una Money scale (ADR-0058):

- Los Businesses que ya existían están en escala 0 y guardan unidades enteras de moneda.
- Todo Business abierto desde la parte 18 empieza en escala 2 y guarda centésimos: la apertura del Business (`app/money_format/adapters/opening.py`) escribe su fila de `money_format` con "$", 0 decimales y escala 2.
- El rescale de escala 0 a escala 2 (#402) lo llama la subida de decimales de Settings, en el mismo guardado que el símbolo (ADR-0080).

La escala es un dato de guardado, no de pantalla. Lo que ve el vendedor es el Money format del Business: un símbolo y sus decimales, "$" y 0 por defecto. Cualquier User del Business cambia el símbolo en Settings → Business → Currency and decimals. Cualquier User también sube o baja los decimales, de 0 a 2.

Antes de la parte 20, todo Business estaba fijo en "$": un vendedor en otra moneda veía "$" en todas partes, también en el Catalog y el Sale bill que leen sus clientes.

## Reglas

### Currency and decimals (Settings → Business)

- Es una sola configuración por Business, en su fila de `money_format`. Cualquier User del Business la cambia; no hay roles.
- Un solo formulario con un solo Save y un monto de ejemplo en vivo con el formato nuevo mientras el vendedor tipea. No hay paso de confirmación, porque ningún valor cambia.
- Un Save sin cambios no cambia nada.
- **Símbolo**: de 1 a 4 caracteres, contados en code points después de recortar los espacios de los dos extremos (🇦🇷 cuenta como dos). Siempre va antes del monto. No hay lista de monedas ni elección de posición (Assume nothing).
  - Se acepta todo carácter visible: letras, dígitos, puntuación, un espacio dentro del símbolo, signos de moneda y emoji, con sus selectores de variación ("US$", "R$", "EUR", "€", un `*` suelto).
  - Se rechazan, porque el símbolo entra en cada línea de precio que leen los clientes (el Catalog, el Pinned catalog y el Sale bill) y la romperían o la darían vuelta sin verse:
    - dos asteriscos seguidos (`**`), que en el Catalog marcan negrita y no se pueden escapar;
    - los caracteres de control (categoría Unicode Cc: saltos de línea, tabulaciones);
    - los caracteres de formato (categoría Cf: los de ancho cero, los uniones y los que fuerzan o aíslan la dirección del texto, como el override de derecha a izquierda);
    - los separadores de línea y de párrafo (categorías Zl y Zp).
    Como consecuencia, un emoji compuesto con un unión de ancho cero (p. ej. una familia) se rechaza.
  - Uno en blanco, demasiado largo, con `**` o con uno de esos caracteres se rechaza con un mensaje simple del Copy module junto al campo, que no nombra ninguna moneda. El formulario queda abierto con lo tipeado y no se guarda nada, ni siquiera decimales cambiados en el mismo Save.
- **Decimales**: el formulario muestra un número entero de 0 a 2.
- **Subir** los decimales por encima de 0 llama al rescale (#402) en el mismo guardado cuando la escala todavía es 0 (el rescale multiplica por 100 cada columna de dinero sin cambiar el valor de ningún monto). Un Business que ya está en escala 2 solo cambia el valor de `decimals`. Subir nunca corre el control de la bajada.
- **Se aplica todo o nada**: el símbolo, los decimales y el rescale se guardan en una sola transacción con un solo commit; cualquier rechazo deja el símbolo y los decimales como estaban.
- **Rutas**: `GET` y `PUT /api/money-format` llevan `{symbol, decimals}` y nunca una escala. Los rechazos son `422 money_format.symbol_invalid` (campo `symbol`), `422 money_format.decimals_invalid` (campo `decimals`), `409 money_format.decimals_below_recorded`, `409 money_format.amount_too_large`, `503 money_format.busy` y `500 money_format.rescale_check_failed`. `GET /auth/me` lleva `money_format: {symbol, decimals}`.
- **Bajar** los decimales se rechaza cuando algún monto registrado del Business tiene más decimales de los que permite el valor nuevo.
  - El control es un EXISTS por cada columna de dinero declarada con `money_column()`, filtrado por `business_id`, dentro de un adaptador; su costo es lineal en las filas de dinero del Business y corre solo en esta acción rara. Ningún caso de uso lee la escala.
  - El control y el guardado van en una misma transacción, así que un monto con centavos guardado al mismo tiempo nunca queda debajo de una configuración más baja.
  - El rechazo es una sola oración fija con el Attention icon (p. ej. "Some recorded amounts have more decimals than that, so the decimals stay as they were."). No lista montos ni nombra el tipo de registro.
  - El formulario queda abierto con lo que tipeó el vendedor, y la configuración guardada queda como estaba. Si cambiaron el símbolo y los decimales y la bajada se rechaza, no se guarda nada, ni siquiera el símbolo.
  - Hoy casi ninguna capacidad guarda centavos, así que el control se prueba plantando montos con centavos directamente, columna por columna.
- Un cambio guardado cuenta como un cambio que puede afectar el texto del Catalog: dispara la Upkeep del Pinned catalog, que solo edita en el lugar, nunca envía ni fija, y una falla muestra Out of date como hoy.
- Cada User del Business ve el formato nuevo la próxima vez que carga una pantalla. Nada se configura por User ni por dispositivo.

### Cómo se escribe un monto

- El símbolo, después el monto con exactamente los decimales del Business, coma decimal y punto para los miles. Los formatos numéricos siguen siendo argentinos hasta #317.
- En la app: `$ 11.000` con los valores por defecto, `US$ 11.000` con "US$". Con 2 decimales se lee `US$ 11.000,50`.
- En el Catalog: su estilo propio, con el símbolo pegado a la cifra (`$11.000`, `US$11.000`), catalog.md.
- En el Sale bill: como en la app, sale-bill.md.
- Los formateadores de la app, del Catalog y del Sale bill aceptan de 0 a 2 decimales y se prueban así.
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
- Ningún pedido lleva una escala. El formulario de Currency and decimals lleva el símbolo y los decimales que muestra el Business, nunca una escala; ningún otro pedido lleva decimales.
- El contrato publicado de `MoneyOut` es `entero o número`, porque el serializador puede enviar las dos formas. Para `oasdiff` esto ensancha el tipo de cada campo de dinero de una respuesta (el CI `docs` lo marca como cambio incompatible, ADR-0066): la pull request lo declara con una línea `Breaking-API:`.
- Hoy toda respuesta es un entero en las dos escalas, así que un Business en escala 0 conserva sus enteros byte por byte. El front acepta también un número no entero sin cambiar nada de lo que muestra en escala 0.

### Cifras que dividen

Algunas cifras dividen: el total de una Sale line, el costo por unidad que se toma de un Lot, el Cost of goods sold, el Stock shortfall, el costo de cada Withdrawal reason, el Margin, las Sales de gramos con costo y el Average sale.

- Se calculan exactas y se redondean mitad hacia arriba a los decimales que muestra el Business (Money format; hoy, unidades enteras), nunca a un lugar más fino que su Money scale. Se guardan y se muestran con esa precisión.
- La asignación de Lots y el costeo de Draws (ADR-0010) siguen corriendo sobre valores del dominio en unidades enteras, así que la unidad de redondeo es la misma en las dos escalas.
- Lo que el vendedor debe es siempre un monto que puede tipear. Ningún total de línea deja una fracción imposible de cobrar, y cobrar lo que muestra la pantalla nunca crea un Credit.
- Toda cifra, con división o sin ella (totales, Balance, Total owed, Profit, Cash, Cost of goods sold, Stock shortfall, costos de retiro, Margin, Margin %, Average sale, el Panel y Analysis), da exactamente lo mismo en un Business de escala 0 y en uno de escala 2 con los mismos datos.
- Esta regla está en la enmienda de ADR-0058, que también aclara cómo leer "a la unidad guardada" en ADR-0007 y ADR-0010.
- **Después de un cambio de decimales**: una cifra guardada cuando se registró conserva su valor; una calculada después se redondea mitad hacia arriba a los decimales vigentes; una que solo se calcula al leerla (Margin, Average sale, Profit, etc.) no es un monto registrado y se muestra redondeada a los decimales vigentes.

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

- Que cada capacidad guarde centavos, y con ello abrir la subida de decimales y llamar al rescale (#402): una parte posterior de GH-318.
- El rescale en sí (#402).
- Elegir la moneda en el Onboarding.
- La posición del símbolo y una lista de monedas.
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
- Montos con demasiados decimales que se guardan o se redondean en silencio: 0. Cada campo `MoneyAmount` de cada ruta responde 422 `money.too_many_decimals` ante 10.5.
- Módulos de caso de uso o de dominio que importan el helper de dinero o leen la escala, y adaptadores que tocan una columna de dinero sin el helper: 0.
- Respuestas que filtran el dinero, la escala o el Money format de otro Business: 0.
- **Rapidez desde el teléfono (criterio 1 de la parte 20)**: un flujo en el viewport del teléfono cambia el símbolo en Settings → Business → Currency and decimals y guarda con un solo Save, sin paso de confirmación: pasa.
- **Ningún valor cambia (criterio 1)**: cada campo de dinero de cada ruta, leído antes y después de un cambio de símbolo, en escala 0 y en escala 2: 0 valores distintos.
- **Símbolo válido**: 100% de aprobación en ambos sentidos.
  - Se rechazan junto al campo, sin guardar nada: uno en blanco, uno de más de 4 code points, uno con `**` ("**", "a**b"), con un salto de línea o una tabulación, con un carácter de ancho cero, con un override o un aislamiento de dirección, con un separador de línea o de párrafo, y un emoji compuesto con unión de ancho cero.
  - Se guardan: "US$", "R$", "EUR", "€", uno con un `*` suelto, uno con un espacio interno, "🇦🇷" (dos code points) y un emoji con selector de variación.
- **Subir, cerrado por ahora**: un Save con decimales por encima de 0, solo o junto con un símbolo nuevo, muestra la oración fija con el Attention icon y deja guardados el símbolo y los decimales sin cambios: 100%. El criterio 2 (tipear montos con esos decimales después de subir) se mide en la parte que abre la subida.
- **Bajar (criterio 3)**: con una lista de cada columna declarada con `money_column()` y un monto con centavos plantado en cada una, de a una por vez, en un Business de escala 2 con decimales plantados en 2, bajar a 0 se rechaza en el 100% de las columnas, con el símbolo y los decimales guardados sin cambios; sin ninguno, la bajada se acepta: 100%. Los centavos de otro Business frenan una bajada: 0 casos.
- **Los rechazos (criterio 3)**: la oración fija con el Attention icon se muestra y el formulario conserva lo tipeado (vitest): 100%.
- **Para todos los Users (criterio 4)**: después de que un User guarda, la sesión de un segundo User del mismo Business lee el símbolo nuevo en su próxima carga: 100%.
- **Upkeep**: un cambio de formato guardado dispara la Upkeep del Pinned catalog: 100%.
- Gate (pytest, vitest, e2e): pasa.

### Brecha: centavos en el dominio

- Cada caso de uso todavía convierte un monto a unidades enteras con `Money.whole_units()` (42 usos en 21 archivos de `app/`). Después de subir los decimales, `money_within` deja pasar `10.50` y esa conversión no puede guardarlo.
- En una ruta de escritura, ese rechazo se responde `422 money.too_many_decimals` con el mensaje existente, nunca un 500 y nunca un redondeo. Una lectura que encuentra un monto guardado que no es entero sigue respondiendo 500.
- Que el dominio guarde centavos es un trabajo aparte que decide el humano; esta parte no lo hace.
