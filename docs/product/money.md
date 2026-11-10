# Dinero

## Jobs

- Cuando mi negocio guarda su dinero a una escala más fina que unidades enteras, quiero que cada monto que registro, veo y se exporta salga exactamente como lo ingresé, así confío en mis saldos, Profit y Cash sin revisarlos a mano. (GH-318, parte 18; ADR-0058.)
- Cuando leo, tipeo o publico un monto de dinero de mi negocio, quiero verlo con el símbolo de moneda y los decimales propios de mi negocio, así leo e ingreso cada monto, en la app y en el Catalog que ven mis clientes, sin convertirlo ni dudar de él. (GH-318, parte 21; Assume nothing.)

## Qué es hoy

Cada Business tiene una Money scale (ADR-0058):

- Los Businesses que ya existían están en escala 0 y guardan unidades enteras de moneda, como siempre.
- Todo Business abierto desde ahora empieza en escala 2 y guarda centésimos: la apertura del Business (`app/money_format/adapters/opening.py`) escribe su fila de `money_format` con "$", 0 decimales y escala 2.

La escala es un dato de guardado, no de pantalla. Lo que se ve y se tipea lo decide el Money format del Business (su símbolo y sus decimales), nunca el código: el front, la vista previa de precios, el Catalog y el texto del bot lo leen del Business. Todo Business tiene por ahora "$" con 0 decimales, así que el vendedor sigue viendo `$ 11.000` y `$11.000` y tipeando montos enteros en cualquier escala, sin ninguna diferencia entre un Business de escala 0 y uno de escala 2.

Antes de estas partes, "$" y el peso entero estaban fijos en el código y nadie los rodeaba a mano, porque ningún Business tenía otro formato.

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
- `GET /auth/me` lleva `money: {symbol, decimals}`, el Money format del Business de la Session, nunca la escala. Es la única fuente del formato para el front; no hay ruta nueva.

### Cómo se muestra un monto

- El símbolo y los decimales salen del Money format del Business, nunca del código: ningún formateador de dinero del front ni del Catalog fija un símbolo ni una cantidad de decimales (Assume nothing). En el front, cada pantalla escribe sus montos con `useMoney()`, que da `GatedLayout` a partir del `money` de `/auth/me`.
- **En la app**: el símbolo, un espacio y la cifra (`$ 11.000`), en todas las pantallas, la vista previa de precios del formulario de Price incluida. Un monto negativo lleva el signo menos (U+2212) delante de esa forma.
- **Montos dentro de una oración de un mensaje existente**: conservan la forma que tienen hoy y solo toman del Business el símbolo y los decimales. El rechazo de un Special price de cero sigue diciendo "The special price must be more than $0", con el símbolo pegado a la cifra: "$0" con "$" y 0 decimales, "<símbolo>0,00" con 2 decimales. Para un Business con "$" y 0 decimales el texto no cambia ni un carácter. Unificar estas oraciones con la forma `$ 11.000` de la app es un cambio de redacción de otra tarea.
- **En el Catalog y el texto del bot**: el símbolo pegado a la cifra, sin espacio (`$11.000`; catalog.md). Los arma el servidor, que lee el Money format por el puerto propio del Catalog (ADR-0055), nunca la escala.
- Cada superficie conserva su disposición; solo el símbolo viene del Business. No se ofrece un símbolo después de la cifra.
- Todo monto muestra exactamente los decimales del Business, también cuando es entero: con 2 decimales, `$ 11.000,00` y `$ 11.000,50` en la app y `$11.000,00` en el Catalog. Con 0 decimales no cambia nada.
- El front y el Catalog formatean a partir de centésimos enteros, agrupan los miles a mano con punto desde cuatro dígitos, redondean mitad hacia arriba alejándose del cero y nunca muestran `-0`. Un único archivo de vectores (`web/src/format/money.vectors.json`) lo prueban vitest y pytest por igual.
- Las cifras siguen el formato argentino: coma antes de los decimales y punto entre los miles (Product language). El formato de dinero sigue al Money format del Business, nunca al idioma.
- Los montos conservan las Tabular figures.
- Las cantidades conservan su propia regla de quitar los ceros finales (quantity.md); no la toca esta regla.
- **Antes de conocer el formato**: nada de lo que está detrás del inicio de sesión se dibuja hasta que llega `/auth/me` con el Money format, igual que antes; si no se puede leer, se muestra el error genérico existente. Nunca se muestra un "$" ni una cantidad de decimales por defecto, ni siquiera dentro de un mensaje, y ningún campo de monto existe antes de conocerse el formato.

### Cómo se tipea un monto

- El teclado del teléfono sigue al Money format: un campo de monto de un Business con decimales usa `inputmode="decimal"`; uno de un Business con 0 decimales usa `inputmode="numeric"`, solo de dígitos (CODING_STANDARDS.md §10 Phone 3). Lo decide `moneyInputMode`, y ningún campo de monto fija su teclado a mano.
- Un único lector de montos del front (`parseMoneyInput`), compartido por todos los campos de monto: Record payment, Expense, costo de una Stock entry, formulario de Price y precio del Onboarding, y en New sale el Shipping charged y el Special price. Con decimales:
  - lee la coma como separador decimal, como en el campo de gramos;
  - lee también como separador decimal un único punto seguido de 1 a `decimals` dígitos, para los teclados que solo ofrecen punto;
  - lee un punto seguido de exactamente 3 dígitos como separador de miles (`11.000`), nunca como decimales;
  - rechaza más dígitos después del separador que los decimales del Business, con "Use up to {decimals} decimals.";
  - rechaza como inválida una coma antes de un punto (`1,234.5`);
  - al salir del campo, muestra el valor de nuevo con coma y exactamente `decimals` dígitos, sin puntos de miles (`formatMoneyInput`, la única forma de precargar un campo de monto).
- Con 0 decimales el campo se comporta exactamente como antes, incluido el rechazo "Use whole amounts only.", y las reglas del punto no se aplican.

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
- El control vive en una sola función del dominio, `money_within`, que cada caso de uso llama con el Money format del Business, leído por su propio puerto (que nunca lee la escala). Rechaza con 422 `money.too_many_decimals` y un `detail` fijo, sin ningún monto. No se redondea ni se guarda nada. El lector de montos del front aplica el mismo límite antes de enviar, pero el servidor sigue siendo la autoridad.
- El vendedor ve un mensaje del Copy module que sigue los decimales del Business (`tooManyDecimalsMessage`): "Use whole amounts only." con 0 decimales y "Use up to {decimals} decimals." en otro caso. No nombra ninguna moneda (Assume nothing) ni lleva ninguna palabra de flor, y el `detail` de la API nunca se muestra (Product language).
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

- El Catalog y el Sale bill son lecturas de dinero.
- El Catalog y el texto del bot escriben el dinero con el símbolo y los decimales del Money format del Business, con el símbolo pegado a la cifra. Un Business con "$" y 0 decimales produce exactamente el mismo texto que antes (`$11.000`), en escala 0 o en escala 2.
- Los precios del Catalog siguen llegando en unidades enteras y se completan con ceros hasta los decimales del Business, nunca se dividen: un precio con fracción se publicaría con `,00`. Ningún Business tiene decimales hoy; lo resuelve la parte que deje cambiar los decimales.
- El Sale bill conserva por ahora su texto de dinero actual, igual en las dos escalas y con su propio formato fijo; no sigue todavía al Money format.

### Aislamiento

- Un Business de escala 2 y uno de escala 0 en la misma instalación nunca cambian ni exponen el dinero, la escala ni el Money format del otro.
- `/auth/me` devuelve solo el Money format del Business de la Session.
- Ningún User, link ni error revela al otro Business.
- Los seeders de aislamiento tienen un Business de cada escala en una misma instalación.

## Fuera de alcance

- Una configuración para elegir el símbolo o los decimales; los centavos se podrán tipear recién cuando una parte posterior la agregue y un Business tenga decimales.
- Un símbolo después de la cifra.
- Cambiar la redacción de los mensajes que nombran un monto dentro de una oración, como el rechazo del Special price de cero, para que usen la forma `$ 11.000` de la app.
- Cambiar la ayuda "Per gram, in whole pesos" del formulario de Price (#330 / #318).
- La regla de cómo se muestran las cantidades.
- El dinero del Sale bill y de la salida de los scripts del Operator.
- El rescale de escala 0 a escala 2.
- Volver a importar un Business export.
- Cambiar migraciones existentes o valores de columnas existentes (invariante 1).

## Métricas

- Tests de rutas de dinero y seeders de aislamiento que pasan en escala 0 y en escala 2 (fixture `money_scale`, `SCALES = (0, 2)`): 100%.
- Diferencia en escala 0, contra antes de la parte 18, en las respuestas del contrato, el Business export (salvo el bloque `money`) y el texto del Catalog y del Sale bill: 0 bytes.
- Montos que en escala 2 vuelven distintos de lo ingresado, en cualquier campo de dinero: 0.
- Cifras, con división o sin ella, que difieren entre escala 0 y escala 2 con los mismos datos (`tests/results/test_figures_across_scales.py`): 0.
- Totales de línea o Balances con una fracción más fina que los decimales que muestra el Business: 0.
- Montos con demasiados decimales que se guardan o se redondean en silencio: 0. Cada campo `MoneyAmount` de cada ruta responde 422 `money.too_many_decimals` ante 10.5.
- Módulos de caso de uso o de dominio que importan el helper de dinero o leen la escala, y adaptadores que tocan una columna de dinero sin el helper: 0.
- Respuestas que filtran el dinero, la escala o el Money format de otro Business: 0.
- **Sin cambio para los Businesses existentes**: con "$" y 0 decimales, los tests de formato de vitest dan `$ 11.000`, el rechazo del Special price de cero dice "The special price must be more than $0" y el texto del Catalog de referencia da `$11.000`, con 0 diferencias.
- **Sigue al formato del Business**: con otro símbolo y 2 decimales, los tests de formato de vitest y la vista previa de precios dan `<símbolo> 11.000,00` y `<símbolo> 11.000,50`, el rechazo del Special price de cero lleva `<símbolo>0,00`, y un segundo texto del Catalog de referencia (`US$`, 2 decimales) da `<símbolo>11.000,00`, con 0 diferencias. 100% de aprobación.
- **Tipeo en el teléfono**: cada campo de monto usa un teclado con separador decimal con decimales y uno solo de dígitos con 0 decimales. Los tests de vitest del lector de montos cubren la coma, el punto de 1 a `decimals` dígitos, el punto de miles de 3 dígitos y el rechazo por demasiados decimales, y la ida y vuelta `parseMoneyInput(formatMoneyInput(x))` sobre los vectores. 100% de aprobación, y el Mobile check pasa en las pantallas tocadas.
- **Sin formato fijo**: símbolos de moneda o cantidades de decimales literales en los formateadores de dinero del front, en los mensajes del Copy module que nombran un monto y en el formato de dinero del Catalog: 0, con el Sale bill como única excepción nombrada. Montos mostrados con un "$" por defecto mientras se carga el formato: 0.
- Gate (pytest, vitest, e2e): pasa.
