# Dinero

## Jobs

- Cuando mi negocio guarda su dinero a una escala más fina que unidades enteras, quiero que cada monto que registro, veo y se exporta salga exactamente como lo ingresé, así confío en mis saldos, Profit y Cash sin revisarlos a mano. (GH-318, parte 18; ADR-0058.)

## Qué es hoy

Cada Business tiene una Money scale (ADR-0058):

- Los Businesses que ya existían están en escala 0 y guardan unidades enteras de moneda, como siempre.
- Todo Business abierto desde ahora empieza en escala 2 y guarda centésimos.

La escala es un dato de guardado, no de pantalla. Todo Business muestra por ahora "$" con 0 decimales (Money format), así que el vendedor sigue tipeando montos enteros en cualquier escala.

Antes de esta parte, el peso entero era la única opción y nadie la rodeaba a mano.

## Reglas

### Dónde se aplica la escala

- Toda lectura y escritura de dinero pasa por el único helper de dinero del adaptador: ventas (`sql_sales`), resultados y cifras de stock (`stock_figures`), pagos, gastos, Stock entries y Price entries. Un caso de uso o el dominio nunca leen la escala (invariante 8). Un test falla si alguno importa el helper o lee la configuración.
- Una escritura divide los centésimos por el factor del Business dentro de la propia sentencia SQL.
- Una lectura multiplica en la misma transacción que carga las filas.
- El Spreadsheet import escribe por los mismos adaptadores, así que carga los mismos montos en un Business de escala 0 o de escala 2.
- Un monto se guarda solo en una columna entera tipada declarada con `money_column()` (invariante 9).

### En el contrato

- Todo campo de dinero usa el único tipo de schema de dinero y lleva el valor en unidades de moneda, parseado como Decimal y nunca como float (invariante 7).
- Ningún pedido lleva decimales ni escala.
- Un Business en escala 0 conserva sus enteros byte por byte.
- En escala 2 el valor es el mismo; la forma exacta de serializarlo la decide el Tech Lead, y el front acepta cualquiera de las dos.

### Cifras que dividen

- Las sumas y restas sin división (totales, Balance, Total owed, Profit, Cash, el Panel) dan exactamente lo mismo en un Business de escala 0 y en uno de escala 2 con los mismos datos.
- El Cost of goods sold, el Margin, el Average sale y las Sales de gramos con costo dividen. Se calculan exactos y se redondean mitad hacia arriba con `round_half_up` a la unidad guardada del Business (ADR-0058, que enmienda ADR-0007 y ADR-0010).
- La pantalla las muestra con los decimales del Business.
- Por eso un Business de escala 2 puede ser más exacto que uno de escala 0, con una diferencia menor que una unidad mostrada. Es lo esperado, no un defecto.

### Rechazo por demasiados decimales

- El límite son los decimales que muestra el Business (Money format), no su escala. Hoy son 0 en todos, así que 10.5 se rechaza incluso en un Business de escala 2; con 2 decimales, 10.505 se rechazaría.
- El tipo de schema de dinero y el dominio rechazan el monto con 422 `money.too_many_decimals`. No se redondea ni se guarda nada.
- El vendedor ve, en el campo del monto, un mensaje corto del Copy module (por ejemplo "Use whole amounts only"):
  - su redacción sigue los decimales del Business y nunca dice "pesos" ni otra moneda fija (Assume nothing);
  - no lleva ninguna palabra de flor.
- El valor tipeado queda en el campo para corregirlo, y el `detail` de la API nunca se muestra (Product language).

### Business export

- Los campos de dinero llevan el entero guardado a la escala del Business, tal como está guardado, con un bloque `money {scale, decimals}` al lado (ADR-0058, ADR-0015).
- Un export de escala 0 conserva sus enteros exactamente como antes.
- Un export escrito antes de un rescale se lee como valores de escala 0.
- El chequeo de conteos de la Business removal no cambia.

### Texto que ve el Customer

- El Catalog y el Sale bill son lecturas de dinero.
- Un Business de escala 2 produce exactamente el mismo texto del Catalog ("$11.000") y el mismo Sale bill que uno de escala 0 con los mismos datos, sin formato nuevo.

### Aislamiento

- Un Business de escala 2 y uno de escala 0 en la misma instalación nunca cambian ni exponen el dinero ni la escala del otro.
- Ningún User, link ni error revela al otro Business.
- Los seeders de aislamiento tienen los dos tipos de Business en una misma instalación.

## Fuera de alcance

- Una configuración para elegir decimales; los centavos se podrán tipear recién cuando una parte posterior la agregue.
- El rescale de escala 0 a escala 2.
- Volver a importar un Business export.
- Un formato de dinero nuevo.
- Cambiar migraciones existentes o valores de columnas existentes (invariante 1).

## Métricas

- Tests de rutas de dinero y seeders de aislamiento que pasan en escala 0 y en escala 2 (fixture `money_scale`): 100%.
- Diferencia en escala 0, contra antes de esta parte, en las respuestas del contrato, el Business export y el texto del Catalog y del Sale bill: 0 bytes.
- Montos que en escala 2 vuelven distintos de lo ingresado, en cualquier campo de dinero o cifra sin división: 0.
- Cifras con división que en escala 2 difieren de las de escala 0 en una unidad mostrada o más: 0.
- Montos con demasiados decimales que se guardan o se redondean en silencio: 0. Cada uno responde 422 `money.too_many_decimals` y muestra el mensaje del Copy module.
- Módulos de caso de uso o de dominio que importan el helper de dinero o leen la escala: 0.
- Respuestas que filtran el dinero o la escala de otro Business: 0.
- Gate (pytest, vitest, e2e): pasa.
