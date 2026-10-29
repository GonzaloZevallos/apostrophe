# Análisis

Dónde un negocio gana y pierde plata, a lo largo de los períodos y hasta cada variedad: márgenes por variedad de un mes elegido; ventas, costo de lo vendido, faltante de stock, ganancia y caja de las últimas 8 semanas y los últimos 12 meses; el patrón por día de la semana; los totales desde el primer registro, y los gastos por categoría. Es de solo lectura y lo ve solo su negocio (ADR-0004). Cada cifra que comparte con Resultados (#7) sale del cálculo de #7. El costo de lo vendido, el faltante de stock y el costo de los retiros de stock siguen a los lotes como están hoy (ADR-0009, ADR-0010). Lee ventas, stock (entradas y retiros), pagos y gastos. Se llega desde Más en el teléfono y desde la barra lateral en la computadora (navigation.md).

## Jobs

**Cuando** cierro una semana o un mes, o quiero saber por qué un período anduvo bien o mal, **quiero** ver desde el teléfono qué variedades me dejan plata y cuánta, cómo se movieron las ventas, la ganancia y la caja en las últimas semanas y meses, qué día de la semana vende más y adónde se va la plata de los gastos, **para** decidir qué reponer, a qué cambiarle el precio, qué empujar y en qué dejar de gastar, sin la pestaña Análisis de la planilla y con márgenes sacados del costo real de cada lote.

Sirve al job de resultados del brief ("Cuando miro un día, una semana o un mes, quiero ver ventas, ganancia y caja lado a lado, para saber si gano plata y cuánta tengo de verdad"), a lo largo de los períodos y por variedad, y alimenta el job de stock. El control diario de la caja sigue siendo de Resultados (#7).

**Cuando** cierro una semana o un mes en Análisis, o veo que uno dejó menos de lo que esperaba, **quiero** ver en la fila de ese período lo que me costó lo vendido y lo que perdí por faltante de stock, al lado de la ganancia, **para** entender de dónde salió la ganancia sin volver a Inicio ni hacer cuentas, y confiar en que Análisis e Inicio dicen lo mismo.

Este job afina el primero para cada fila de semana y de mes; no es un job nuevo. Antes, el costo de lo vendido y el faltante de un período pasado no se veían en ningún lado: el faltante estaba solo dentro de la ganancia, sin poder separarlo, e Inicio muestra solo la semana y el mes en curso.

**Cuando** saco gramos de mi propio stock sin venderlos (para convidar en una fiesta y que la gente conozca el negocio, o para consumo propio), **quiero** registrarlo desde el teléfono en pocos toques (fecha, variedades y gramos, motivo), **para** mantener el stock bien y ver en la Ganancia lo que me costó promocionar el negocio y lo que consumí, sin registrar una venta que nadie hizo ni un ajuste que se lee como flor perdida. (Acá lo sirven las líneas Promotion y Own use; el retiro se define en stock.md.)

**Cuando** llevo el negocio desde el teléfono entre pedidos o en medio de un chat con un cliente, varias veces por día, **quiero** que la app esté ordenada según lo que hago de verdad y con qué frecuencia, con el análisis a mano para la mirada semanal o mensual, **para** volver al cliente en vez de buscar entre menús. (El job de navegación, navigation.md.)

**Cuando** quiero saber cómo me fue en un mes, desde el teléfono y entre otras cosas, **quiero** elegir primero el mes y leer cada cifra de Análisis de arriba abajo, sin desplazarme de costado ni hacer zoom, **para** saber si gané plata ese mes y qué variedades la dejaron. (GH-319, Análisis en el teléfono. Afina el primer job para el teléfono y cambia solo la disposición, nunca lo que muestra una sección. Antes, el dueño se desplazaba de costado y perdía a qué variedad o período pertenecía una cifra, o esperaba a estar en la computadora.)

Criterios de éxito:

1. **Respuestas sin cuentas**: desde una sola pantalla en el teléfono, un vendedor puede nombrar la variedad de mayor margen del mes elegido y la de menor margen, la mejor de las últimas 8 semanas, el mejor día de la semana y la categoría de gasto que más se llevó ese mes.
2. **Un solo cálculo**: cada cifra es igual a lo que muestra Resultados (#7) para el mismo período y a un cálculo directo sobre las mismas ventas, entradas de stock, retiros, pagos y gastos. Eso cubre ventas, costo de lo vendido, faltante de stock, costo de promoción, costo de consumo propio, gastos, ganancia y caja, en cada fila de semana, cada fila de mes y desde el primer registro. Para la semana y el mes en curso, el costo de lo vendido y el faltante de stock de las filas son iguales a los de Semana y Mes de Inicio. Para el mes en curso, el faltante de stock es una sola cifra, que se lee igual en el encabezado del mes, en la fila del mes y en el Mes de Inicio. 0 diferencias.
3. **Costo honesto** (ADR-0009, ADR-0010):
   - Los márgenes salen del costo real de cada lote, como están hoy los lotes.
   - Cuando el costo de una cifra incluye gramos pendientes, la cifra lo dice con sus propios gramos y nunca los toma como si costaran $0. Una cifra de costo que está toda pendiente nunca muestra "$ 0", aparezca donde aparezca.
   - La flor perdida por un ajuste negativo baja la ganancia.
   - Los gramos retirados por promoción o consumo propio bajan la ganancia en sus propias líneas, nunca dentro del costo de lo vendido, del faltante de stock ni de un margen.
   - Una entrada de stock o un retiro corregidos más tarde se ven en cada semana y mes pasados afectados la próxima vez que se abre la pantalla. Ningún período se cierra nunca.
4. **Nada leído solo por el color, nada inventado**: cada barra y cada fila llevan su propia cifra. Un período sin actividad muestra $0 o queda afuera por una regla explícita, nunca con una cifra de relleno.
5. **Los negocios nunca se mezclan** (ADR-0004): cada cifra cubre solo el negocio de la sesión.
6. **Cada fila explica su ganancia**: las 8 filas de semana y las 12 filas de mes muestran el costo de lo vendido, y el faltante de stock cuando el período lo tiene, al lado de Promotion, Own use, gastos, ganancia y caja.
7. **Se lee de arriba abajo en el teléfono**: a 320 px y a 246 px (texto al 130 %), con un nombre de variedad de 60 caracteres y cifras de nueve dígitos, el dueño puede cambiar de mes y leer cada sección sin desplazarse de costado.
8. **Nada se pierde en el teléfono**: cada cifra de cada fila de tabla aparece en su tarjeta con la misma etiqueta existente y en el mismo orden, y el selector de mes es el primer control de la pantalla.
9. **La computadora no cambia**: la captura de `AnalisisCompu` sale igual que antes de las tarjetas del teléfono.
10. **Se lee de un vistazo**: en el teléfono cada cifra principal entra en una línea, ningún texto mide menos de 12 px y cada zona de toque, las flechas del mes incluidas, mide al menos 44×44.

## Comportamiento

### Ventanas

- **Mes elegido**: abre en el mes en curso en hora argentina y se mueve de a un mes, como en Gastos. Va desde el mes del primer registro del negocio hasta el mes en curso. No hay rango a medida (no hay Fechas).
- **Últimas 8 semanas**: semanas de lunes a domingo en hora argentina, la actual incluida, como en Ventas.
- **Últimos 12 meses**: meses calendario, el actual incluido.
- **Desde el primer registro**: desde el primer registro del negocio (su venta, entrada de stock, retiro de stock, pago o gasto más antiguo en la app) hasta hoy. Un retiro con fecha anterior a todos los demás registros arranca la historia, así que su costo nunca queda afuera. La historia de la planilla es tarea de la importación (#11).
- **Historia escasa**:
  - las semanas y los meses anteriores al primer registro no aparecen, sin filas de relleno;
  - dentro de la historia, una semana o un mes sin actividad muestran $0;
  - un negocio que todavía no tiene ningún registro de ninguno de los cinco tipos muestra una línea fija que dice que todavía no hay nada para analizar, y ninguna cifra.

### Definiciones compartidas (idénticas a Resultados #7)

- **Ventas** en las filas de semana, de mes y del total histórico: los totales de las ventas, envío incluido, pagadas o no, cada una en su propia fecha, como en Ventas y Resultados. Los retiros nunca son ventas.
- **Costo de lo vendido, gastos y caja**: las definiciones de CONTEXT.md, leídas a través del cálculo de Resultados (#7), nunca de uno paralelo.
  - El costo de lo vendido es lo que cuestan los gramos de las líneas de venta del período (regalos incluidos), sacado de sus lotes como están hoy. Nunca incluye un ajuste negativo ni un retiro.
  - La caja es pagos (en el momento y posteriores) en sus fechas − gastos − compras en sus fechas.
- **Faltante de stock**: el costo de los gramos que sacan los ajustes negativos del período, en la fecha del ajuste, de sus lotes como están hoy, del más viejo al más nuevo, con la misma asignación que las líneas de venta. Una parte que queda más allá de todos los lotes está pendiente, y la cifra lleva su propio "and N g without cost". Nunca incluye un retiro y nunca entra en el costo de lo vendido.
- **Costo de promoción ("Promotion") y costo de consumo propio ("Own use")**: el costo de los gramos que sacan los retiros del período con ese motivo, en la fecha del retiro, de sus lotes como están hoy, del más viejo al más nuevo, con la misma asignación. Una parte que queda más allá de todos los lotes está pendiente, y cada cifra lleva su propio "and N g without cost", que cuenta solo los gramos pendientes de su propio motivo.
- **Ventas de gramos con costo**: por línea de venta, total de la línea × gramos con costo ÷ gramos de la línea, redondeado al peso con mitad hacia arriba. Una línea con todo su costo cuenta su total entero, una línea toda pendiente $0 y un regalo $0.
- **Ganancia**: ventas − costo de lo vendido − faltante de stock − costo de promoción − costo de consumo propio − gastos.
  - Cuando parte de su costo está pendiente, la ganancia se calcula sobre la parte con costo, dejando afuera las ventas de los gramos pendientes: ventas − (ventas sin envío − ventas de gramos con costo) − costo de lo vendido con costo − faltante con costo − costo de promoción con costo − costo de consumo propio con costo − gastos.
  - Lleva "and N g without cost", donde N suma cada gramo pendiente que tiene detrás: gramos vendidos o regalados, gramos sacados por ajustes negativos y gramos retirados, cada uno contado en el período de su propia fecha.
  - Ejemplo: una semana que vendió 4 g todavía sin costo, cuyo conteo sacó 2 g todavía sin costo y que retiró 1 g para promoción todavía sin costo muestra la ganancia con "and 7 g without cost", su faltante de stock como "2 g without cost" y su Promotion como "1 g without cost".
  - La cifra de ventas que se muestra al lado sigue siendo la venta completa.
- **Los gramos pendientes** nunca se costean en $0 en ningún lado. Cada cifra que tocan lleva "and N g without cost", con N contando solo los gramos que esa cifra tiene detrás.
- **Una cifra de costo toda pendiente**:
  - Cuando todos los gramos detrás del costo de lo vendido, del faltante de stock, de Promotion o de Own use están pendientes, la cifra muestra solo sus gramos pendientes en palabras (por ejemplo "2 g without cost"), nunca "$ 0" y nunca "$ 0 and N g without cost". La redacción exacta la decide diseño.
  - Vale en todo Análisis donde aparezca la cifra: las filas de semana y de mes, el encabezado del mes y las líneas desde el primer registro.
  - Una cifra con parte pendiente muestra su monto con costo más "and N g without cost".
  - La línea nunca se oculta porque su costo esté pendiente.
  - La ganancia, los márgenes, los porcentajes de margen y el margen promedio siguen sus propias reglas.
  - La API dice si una cifra está toda pendiente, una vez por cifra; el front solo le da formato.

### El mes elegido, por variedad

- **Filas**: solo las variedades vendidas o regaladas ese mes. Una variedad que ese mes solo se retiró no tiene fila.
- **Ventas sin envío**: la suma de los totales guardados de las líneas de la variedad ese mes. Un regalo cuenta $0 y un precio especial su total tipeado.
- **Participación en el mes**: sus ventas sin envío sobre las ventas sin envío del mes. No se muestra cuando las ventas sin envío del mes son $0.
- **Gramos**: gramos vendidos y gramos regalados, como dos cifras. Un ajuste negativo y un retiro no son ninguna de las dos, y quedan afuera de los gramos, el costo y el margen de toda variedad.
- **Costo de lo vendido**: lo que cuestan sus gramos vendidos y regalados, de sus lotes como están hoy, con la marca de pendiente cuando corresponde.
- **Margen**: ventas de gramos con costo − costo de lo vendido con costo, en pesos; puede ser negativo. Sin gramos pendientes, las ventas de gramos con costo son iguales a las ventas sin envío.
- **Porcentaje de margen**: el margen sobre las ventas de gramos con costo de la variedad. No se muestra cuando estas son $0 (solo regalada, o con todos los gramos pendientes).
- **Gramos pendientes**: el margen y el porcentaje llevan "and N g without cost", con N contando solo los gramos pendientes vendidos y regalados de esa variedad. Ejemplo: 10 g vendidos a $10.000, 6 g de una compra de $3.000 y 4 g pendientes, muestran ventas $10.000, margen $3.000 "and 4 g without cost" y 50%.
- **Orden**: por margen en pesos, de mayor a menor. Un margen marcado se ordena por la cifra que muestra y conserva su marca.
- **Encabezado del mes**:
  - las ventas (envío incluido), los gramos vendidos o regalados y el margen promedio;
  - el margen promedio es el margen total del mes sobre sus ventas de gramos con costo. Se marca cuando alguna variedad tiene gramos pendientes (contando solo gramos vendidos y regalados), y no tiene porcentaje cuando esas ventas son $0;
  - "Stock shortfall $ X" cuando el mes tiene algún faltante de stock, con su propia marca de pendiente, o solo sus gramos pendientes cuando está todo pendiente. Es la misma cifra, y se lee igual, que la de la fila del mes y la del Mes de Inicio;
  - "Promotion $ X" y "Own use $ X" cuando el mes tiene un retiro con ese motivo, cada una con su propia marca de pendiente (o solo sus gramos pendientes cuando está todo pendiente), aparte del faltante de stock;
  - la pantalla aclara que la tabla de variedades suma las ventas del mes menos el envío;
  - el encabezado no lleva un total de costo de lo vendido.
- **Un mes sin ventas ni regalos**: totales en $0, sin filas de variedad y con una línea fija que dice que ese mes no se vendió nada. Su faltante de stock, su Promotion y su Own use se siguen mostrando cuando los tiene.

### Semana por semana (últimas 8) y mes por mes (últimos 12)

- **Cada fila**, en este orden (el mismo que Semana y Mes de Inicio, results.md):
  1. ventas;
  2. gramos vendidos o regalados, como una sola cifra;
  3. costo de lo vendido, en todas las filas;
  4. faltante de stock, solo cuando el período tiene un ajuste negativo;
  5. Promotion, solo cuando el período tiene un retiro con ese motivo;
  6. Own use, igual;
  7. gastos;
  8. ganancia;
  9. caja.

  Los gramos retirados y ajustados nunca están en la cifra de gramos.
- **El costo de lo vendido** de una fila es el costo de lo vendido del período, también en los períodos pasados. Un período sin ventas muestra un $0 real. Nunca incluye un faltante ni un retiro.
- **El faltante de stock** de una fila es el faltante de stock del período, una cifra aparte que nunca entra en el costo de lo vendido. Un período sin ajuste negativo no tiene línea de faltante de stock.
- **Gramos pendientes en una fila**:
  - El costo de lo vendido, el faltante de stock, Promotion y Own use muestran cada uno su monto con costo más su propio "and N g without cost", o solo sus gramos pendientes cuando están todos pendientes (ver Definiciones compartidas).
  - N cuenta solo los gramos que esa cifra tiene detrás, cada uno en el período de su propia fecha:
    - costo de lo vendido: gramos vendidos y regalados;
    - faltante de stock: gramos sacados por ajustes negativos;
    - Promotion y Own use: gramos retirados con ese motivo.
  - La ganancia sigue su propia regla y su N total.
  - Ejemplo: una semana con 4 g vendidos, 2 g sacados por ajuste y 1 g retirado para promoción, todos todavía sin costo, muestra:
    - costo de lo vendido "4 g without cost";
    - faltante de stock "2 g without cost";
    - Promotion "1 g without cost";
    - ganancia "and 7 g without cost".
- **Coincidencia con Inicio**: para la semana y el mes en curso, el costo de lo vendido y el faltante de stock de la fila son iguales a los de Semana y Mes de Inicio. Cualquier diferencia es un defecto.
- **La ganancia** incluye el faltante de stock y los costos de promoción y de consumo propio, y lleva la marca de pendiente cuando corresponde.
- **Mejor semana**: la de más ventas; si hay empate, la semana más reciente. Cuando las 8 semanas están en $0, no se marca ninguna. Los retiros nunca la afectan.
- **Meses**: sin marca de "mejor".
- No se dibuja ningún gráfico, variación ni comparación entre períodos.

### Por día de la semana, desde el primer registro

- **Cada día de la semana, de lunes a domingo**: el total de ventas y la cantidad de ventas, según la fecha de cada venta en hora argentina. Los retiros nunca cuentan.
- **Mejor día**: el de mayor total de ventas; si hay empate, el día que va antes en el orden de lunes a domingo. Cuando todos los días están en $0, no se marca ninguno.

### Desde el primer registro

- Ventas, gastos, ganancia y caja, con las mismas definiciones que las filas de semana y de mes. Se agregan "Stock shortfall $ X", "Promotion $ X" y "Own use $ X" cuando los hay, cada uno con su propia marca de pendiente, o solo sus gramos pendientes cuando está todo pendiente. Sin total de costo de lo vendido.
- Se rotula como plata movida desde el primer registro, nunca como plata en mano: la app no tiene un saldo inicial de caja.

### Gastos por categoría: el mes elegido y desde el primer registro

- Dos desgloses, cada uno con solo las categorías que tienen gastos en su ventana, ordenadas por nombre como en Gastos, cada una con su total.
- Las compras de flor son siempre una línea propia en los dos, $0 incluido, con "Kept apart, added in Stock". Nunca se cuentan dentro de los gastos.
- Los retiros nunca son gastos y nunca aparecen acá.
- Cómo se ubican los dos desgloses lo decide diseño.

### En pantalla (`Analisis`, `AnalisisCompu`)

- **Dónde**: una raíz de pestaña (navigation.md). En el teléfono, la entrada de Más "Analysis · Varieties, weeks, months and days"; en la computadora, "Analysis" en la barra lateral, debajo del separador.
- **Computadora**: la disposición de `AnalisisCompu`, con las tres secciones como tablas. La disposición del teléfono nunca la cambia: su captura sigue igual.
- **Filas de semana y de mes**: en el teléfono son tarjetas (ver En el teléfono); en la computadora, cómo se ubican en una fila el costo de lo vendido y el faltante de stock (líneas o subfilas) lo decide diseño. Cada cifra va en palabras, y lo pendiente y lo negativo se dicen con una palabra o un signo, nunca solo con el color, en los dos temas.
- **Gráficos**: solo el acento y los tokens; cada barra lleva su cifra. Las marcas de mejor, las marcas de pendiente y los negativos se dicen con una palabra o una forma, nunca solo con el color.
- **Idioma y formatos**: los textos están en el idioma del producto (product-language.md), y cada uno sale del módulo de textos. Los formatos siguen siendo argentinos: plata `$ 11.000`, gramos `3,5 g`, fechas `dd/mm`.
- **Solo lectura**: sin formularios y sin avisos emergentes. Las cifras vienen de la API cada vez que se abre la pantalla; el navegador no calcula nada, tampoco si una cifra está toda pendiente.
- **Respuesta ante fallas**: la pérdida de red y los errores del servidor siguen accounts.md.

### En el teléfono (debajo del corte de 900 px)

- **El selector de mes primero**: es el primer control de Análisis. La regla de orden que Gastos aplica a su propio selector de mes está acotada a Gastos y nunca llega a Análisis.
- **Una sola disposición a la vez**:
  - En ancho de teléfono, las tres secciones (por variedad, últimas 8 semanas, últimos 12 meses) se muestran como listas de tarjetas, y no hay ninguna tabla en la página.
  - En ancho de computadora se muestran como tablas, y no hay ninguna tarjeta en la página.
  - El selector de mes, los títulos de las secciones y la columna lateral son los mismos elementos en las dos disposiciones.
  - Ninguna cifra queda expuesta dos veces a la tecnología de asistencia.
  - Análisis no tiene formularios, así que cruzar los 900 px no pierde nada.
- **Tarjeta de variedad**: el nombre, después las ventas, la participación en el mes, los gramos vendidos, los gramos regalados, el costo de lo vendido y el margen con su porcentaje. La participación y el porcentaje aparecen con las mismas reglas que en la computadora.
- **Tarjeta de semana y tarjeta de mes**: la etiqueta del período, después las cifras de la fila en el orden de la fila (ver Semana por semana, más arriba). El faltante de stock, Promotion y Own use aparecen solo cuando el período los tiene.
- **Mismas cifras, mismo orden, mismas etiquetas**: cada tarjeta lleva cada cifra de la fila que reemplaza, en el orden de esa fila, con las etiquetas que ya tiene el módulo de textos. Nada se reordena, se esconde detrás de un toque ni se pliega, y no hay saltos entre secciones.
- **Cifra principal**: las ventas son la cifra principal de una tarjeta. Entran en una línea, y su "$" nunca se separa de su número.
- **Ajuste**:
  - Los nombres y las etiquetas de período se cortan con puntos suspensivos. El nombre completo se sigue leyendo en la computadora y en la página de la variedad.
  - Las cifras nunca se cortan, nunca pasan a otra línea, nunca se parten y nunca pierden su "$".
  - Una marca de pendiente ("and N g without cost", o "N g without cost" cuando toda la cifra está pendiente) va en la línea de abajo de su cifra, dentro de la misma tarjeta, y nunca se corta ni se recorta. Así, una cifra con parte pendiente nunca se lee como completa.
  - Nada se desplaza de costado a 320 px ni a 246 px (texto al 130 %), con un nombre de 60 caracteres y cifras de nueve dígitos. Ningún texto mide menos de 12 px. Cada zona de toque mide al menos 44×44, las flechas del mes incluidas.
- **Marcas**: la marca de mejor semana, la línea de "no hubo mejor semana" y la línea del mes vacío se muestran con las mismas palabras que en la computadora. La tarjeta de la semana actual se distingue por la forma (un borde en su lado inicial), nunca solo por el color de fondo, y con una palabra solo si el módulo de textos ya la tiene.
- **Columna lateral**: las barras por día de la semana, las líneas desde el primer registro, los dos desgloses de gastos y la línea de compras "Kept apart, added in Stock" conservan su contenido y su orden, y no se convierten en tarjetas. Cumplen los mismos límites de ajuste; los nombres largos de categoría se cortan con puntos suspensivos.

### Restricciones

- El negocio sale de la sesión. Cada ruta entra en el barrido de aislamiento y en la prueba de rutas protegidas.
- Ningún monto ni nombre va a los logs, la consola ni el almacenamiento del navegador (CODING_STANDARDS §9, ADR-0005).
- Cada regla del teléfono va debajo del corte de 900 px; por ellas, las capturas de la computadora no cambian.

## Métricas

- **Respuestas sin cuentas (criterio 1)**: una prueba del front sobre un negocio sembrado lee, solo desde la pantalla, la mejor y la peor variedad por margen, la mejor semana marcada, el mejor día de la semana marcado y la categoría más grande del mes. Cada una coincide con la respuesta esperada.
- **Un solo cálculo (criterio 2)**:
  - En cada semana, cada mes y la ventana histórica de una historia sembrada, las ventas, el costo de lo vendido, el faltante de stock, el costo de promoción, el costo de consumo propio, los gastos, la ganancia y la caja son iguales a las cifras de Resultados (#7) y a un cálculo directo. 0 diferencias.
  - Las ventas de la tabla de variedades suman las ventas del mes menos su envío.
  - La historia sembrada incluye un ajuste negativo con costo, uno pendiente, una línea de venta con gramos pendientes, un retiro con costo y un retiro pendiente.
    - Sobre ella, el costo de lo vendido y el faltante de cada fila de semana y de mes son iguales a un cálculo directo.
    - La semana y el mes en curso son iguales a `periods.week` y `periods.month` de `/panel`.
    - El faltante del mes en curso es el mismo, y se lee igual, en el encabezado, en la fila y en el panel.
    - 0 diferencias.
  - `tests/design/test_muestra_seed.py` compara las filas con el panel en vez de afirmar que el faltante no está.
- **El primer registro incluye los retiros (criterio 2)**: un retiro con fecha anterior a todos los demás registros arranca la historia.
  - Sus filas de semana y de mes, y la ganancia desde el primer registro, llevan su costo y son iguales a las cifras de Inicio para la misma semana y el mismo mes. 0 diferencias.
  - Un negocio cuyo único registro es un retiro muestra esa historia, no la línea de que no hay nada para analizar.
- **Costo honesto (criterio 3)**: 100% de aprobación.
  - Una entrada de stock o un retiro con fecha atrasada o editados mueven el costo y el margen de las semanas, los meses y las variedades pasados afectados en la siguiente lectura, y nada más.
  - Los gramos pendientes siempre muestran sus gramos y nunca se costean en $0.
  - Un ajuste negativo baja la ganancia en su fecha por el costo de sus lotes, aparece en el faltante de stock de su período y no mueve el margen ni el costo de lo vendido de ninguna variedad.
  - Un retiro de cada motivo baja la ganancia en su fecha por el costo de sus lotes y aparece en su propia línea. No mueve nada de esto:
    - la fila, los gramos, el margen ni la participación de una variedad;
    - el margen promedio;
    - la mejor semana ni el mejor día de la semana;
    - el costo de lo vendido ni el faltante de stock.
  - La semana de ejemplo de 4 g / 2 g / 1 g muestra:
    - costo de lo vendido "4 g without cost";
    - faltante de stock "2 g without cost";
    - Promotion "1 g without cost";
    - ganancia "and 7 g without cost".
  - El N de cada cifra de una fila cuenta solo sus propios gramos. El N de la ganancia no cambia.
  - Una cifra toda pendiente muestra gramos, nunca "$ 0": en una fila, en el encabezado del mes (faltante de stock, Promotion, Own use) y en las líneas desde el primer registro. Un mes en curso cuyo único faltante es de 2 g sin costo muestra "2 g without cost" tanto en el encabezado como en la fila.
- **Las filas explican la ganancia (criterio 6)**: una prueba del front sobre una historia sembrada lee el costo de lo vendido en las 8 filas de semana y las 12 filas de mes, en el orden indicado, y el faltante de stock solo en los períodos con un ajuste negativo.
- **Matriz de márgenes**: 100% de aprobación. Cubre:
  - una variedad solo regalada (margen negativo, sin porcentaje);
  - una mezcla de vendida y regalada;
  - gramos pendientes: 10 g por $10.000, con 6 g que cuestan $3.000, muestran $3.000 "and 4 g without cost" y 50%, ordenada por la cifra que muestra;
  - una línea partida entre gramos con costo y pendientes, con el redondeo de mitad hacia arriba de sus ventas con costo;
  - un ajuste negativo que queda afuera de la tabla de variedades y cuenta como faltante;
  - un retiro que queda afuera de la tabla de variedades y cuenta en la línea de su motivo;
  - un mes con solo regalos (sin participación ni porcentaje promedio).
- **Mejores y empates**: 100% de aprobación. Cubre:
  - una mejor semana elegida por ventas, no por ganancia;
  - un empate de semanas que va a la semana más reciente;
  - un empate de días que va al día que va antes;
  - todo en $0 sin ninguna marcada.
- **Nada inventado (criterio 4)**:
  - ninguna semana ni mes antes del primer registro;
  - filas en $0 dentro de la historia, costo de lo vendido incluido;
  - un mes vacío muestra su línea fija y ninguna fila de variedad;
  - un período sin ajuste negativo no muestra línea de faltante de stock;
  - un período sin retiro de un motivo no muestra línea para ese motivo;
  - un negocio sin registros muestra su línea fija;
  - cada barra lleva su cifra, y ningún estado se dice solo con el color.
- **Cifras que no cambian**: sobre la misma historia sembrada, estas conservan sus valores antes y después de que las filas sumaran el costo de lo vendido y el faltante de stock:
  - la ganancia y la caja;
  - el encabezado del mes;
  - las cifras desde el primer registro;
  - la tabla por variedad;
  - la mejor semana.

  El único cambio de presentación fuera de las filas es un faltante de stock, una Promotion o un Own use todo pendiente en el encabezado o desde el primer registro, que ahora muestra solo sus gramos en vez de "$ 0 and N g without cost".
- **Se lee de arriba abajo en el teléfono (criterio 7)**: con los datos extremos de la semilla (un nombre de 60 caracteres y cifras de nueve dígitos), a 320 px y a 246 px (130 %):
  - el chequeo móvil no encuentra desplazamiento de costado en ninguno de los estados recorridos de Análisis;
  - el nombre termina en puntos suspensivos;
  - cada cifra está entera, con su "$";
  - una marca de pendiente se ve entera, en la línea de abajo de su cifra.
- **Nada se pierde en el teléfono (criterio 8)**: una prueba del front con `fetch` simulado, en una ventana de teléfono, encuentra:
  - el selector de mes como primer control;
  - en cada sección, tarjetas que llevan cada cifra de las filas de su tabla, con las etiquetas existentes y en el orden de la fila;
  - ninguna tabla en la página;
  - la marca de mejor semana, "no hubo mejor semana" y la línea del mes vacío con sus palabras existentes;
  - la tarjeta de la semana actual distinguida por algo que no es el color de fondo.
- **Una sola disposición a la vez**: en una ventana de computadora, la misma prueba encuentra las tablas y ninguna tarjeta. En las dos ventanas, el selector de mes, los títulos de las secciones y la columna lateral son los mismos elementos.
- **La computadora no cambia (criterio 9)**: la captura de `AnalisisCompu` de `scripts/design/compare.sh` es idéntica antes y después.
- **Se lee de un vistazo (criterio 10)**: el chequeo móvil pasa en los estados recorridos de Análisis.
  - No queda ninguna entrada `touch-target`, `text-size`, `h-scroll`, `name-overflow` ni `figure-split` para una celda de contenido de Análisis que este trabajo arregló.
  - Cada entrada que pasó a verde se borra.
  - No se agrega ninguna fuera de las reglas de gate.md.
- **Aislamiento (criterio 5)**: cada ruta de análisis está en el barrido y responde solo las cifras de su propio negocio, nunca los datos del otro negocio sembrado.
- **Sin eco**: después de una corrida completa del front, la consola y el almacenamiento del navegador no tienen montos ni nombres.
- **Velocidad**: la pantalla responde en menos de 300 ms con un año de unos cientos de ventas y unas decenas de variedades (el disparador de revisión de ADR-0010).
- **Sin curl**: la corrida de punta a punta del front:
  - abre Más → Análisis en el teléfono, y la entrada de la barra lateral en la computadora;
  - retrocede un mes;
  - lee cada sección, incluidos el costo de lo vendido, el faltante de stock, Promotion y Own use en las filas (tarjetas en el teléfono).
- **Diseño**: `scripts/design/compare.sh` corre antes y después para Análisis, en teléfono y computadora y en los dos temas. Al PR se adjuntan las capturas, el resultado del e2e `mobile` y la cantidad de entradas en las listas de excepciones.

## Fuera de alcance

- Un rango de fechas a medida (Fechas) o un selector de semana.
- Editar cualquier cosa desde Análisis.
- Un saldo inicial de caja o la plata en mano.
- Faltante de stock por variedad; costo de promoción o de consumo propio por variedad.
- Un total de costo de lo vendido en el encabezado del mes o desde el primer registro.
- Gráficos, variaciones o comparaciones entre períodos.
- Cambiar la nota fija de Inicio "includes pending cost".
- Importar la historia de la planilla: #11.
- Exportar, imprimir o compartir el análisis.
- Actualizaciones en vivo entre socios mientras la pantalla está abierta.
- Pronósticos más allá de los días restantes del stock.
- Atar una promoción a ventas posteriores.
- En el teléfono: secciones plegables, saltos entre secciones, o textos nuevos para las tarjetas o la semana actual.
- La barra inferior, el "+ New sale" flotante y las etiquetas de la barra en Análisis (son de navegación, parte 1 de GH-319).

## Planificado en GH-318

Todavía no está construido. Hasta que salga la parte indicada, las secciones de arriba son lo que hace la app.

Cada pasaje nombra el ADR que lo decide, la parte que lo va a entregar y la oración actual que va a reemplazar. La parte que entrega un pasaje lo saca de acá y edita Comportamiento y Fuera de alcance en el mismo diff.

### Unidades: "and N … without cost" por unidad

Decidido en docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md; lo entrega la parte de unidades.

- Nunca se van a sumar cantidades de unidades distintas. Una cantidad pendiente se va a contar por unidad, así que una cifra va a decir "and N <label> without cost" una vez por cada unidad que tenga pendiente. Los gramos de una semana, de un mes y de una variedad van a pasar a ser un monto por unidad, cada uno con su etiqueta.
- Va a reemplazar: "Lleva "and N g without cost", donde N suma cada gramo pendiente que tiene detrás" y "**Gramos**: gramos vendidos y gramos regalados, como dos cifras."

### Plata

Decidido en docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md; lo entrega la parte de plata.

- Las ventas, los márgenes y la ganancia se van a calcular a partir de montos guardados en la escala del negocio. El redondeo de las ventas de cantidad con costo va a pasar por `round_half_up`, que la parte de plata crea en `app/shared/money.py` (ADR-0058). Subir los decimales de plata de un negocio va a dejar cada cifra con el mismo valor.
- Va a reemplazar: "**Ventas de gramos con costo**: por línea de venta, total de la línea × gramos con costo ÷ gramos de la línea, redondeado al peso con mitad hacia arriba."

### El día del negocio

Decidido en docs/adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md; lo entrega la parte de zona horaria.

- Las ventanas, las semanas y la tabla por día de la semana van a seguir la zona horaria propia del negocio.
- Va a reemplazar: "**Mes elegido**: abre en el mes en curso en hora argentina" y "**Cada día de la semana, de lunes a domingo**: el total de ventas y la cantidad de ventas, según la fecha de cada venta en hora argentina."

### Agrupar por categoría

Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; lo entrega la parte de categorías.

- La tabla del mes elegido se va a poder agrupar por categoría y subcategoría, además de por producto.
- Va a reemplazar: "### El mes elegido, por variedad" y "la pantalla aclara que la tabla de variedades suma las ventas del mes menos el envío".

### La línea de costo de Marketing

Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; lo entrega la parte de motivos de retiro.

- El motivo de retiro que hoy se llama "Promotion" se va a llamar "Marketing" en su línea de costo: en el encabezado del mes, en las filas de semana y de mes y desde el primer registro. Conserva su propia marca de pendiente (`stock.md`).
- Va a reemplazar: "**Costo de promoción ("Promotion") y costo de consumo propio ("Own use")**" y ""Promotion $ X" y "Own use $ X" cuando el mes tiene un retiro con ese motivo".
- En Fuera de alcance, "Atar una promoción a ventas posteriores." va a seguir afuera: las promociones aplicadas se van a registrar en la venta misma (docs/adr/0060-the-applied-promotion-snapshot-is-typed-sale-promotion-rows-recorded-as-the-sale-stood-when-saved-and-never-recomputed.md; `sales.md`), no atadas después.
