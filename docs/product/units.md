# Unidades

Las Units propias de cada **Business** y cómo cada **Product** usa una de ellas para controlar las cantidades que se registran. Es la parte units de GH-318 y sirve al criterio 4 del BRIEF, "Assume nothing". Esta parte define las Units y controla las cantidades donde se ingresan. Mostrar cada cantidad en la Unit de su Product y sumar por Unit (`QuantityByUnit`) les toca a partes posteriores de GH-318.

## Jobs

- **Cuando** abro o manejo un negocio que mide lo que vende a su manera (piezas, kilos, mililitros, o una mezcla entre productos), **quiero** definir mis unidades una sola vez, con su nombre, su etiqueta y sus decimales, y darle a cada producto la suya, **para** que toda cantidad que registro de ese producto se controle contra lo que la unidad admite, y que mi stock, mis ventas y mis avisos nunca guarden una cantidad que mi unidad no puede expresar. (GH-318, parte units.)

  Su protagonista es quien abre desde el celular un Business que no vende por gramo. El público secundario es quien ya vende, para quien el job es sobre todo "que no cambie nada en mis libros". También puede renombrar su unidad, subirle los decimales o sumar una segunda unidad para una línea nueva de productos.

## Antes

La app solo hablaba de gramos con dos decimales. Un Business que vendiera de otra forma tenía que hacer de cuenta que su unidad eran gramos y vigilar los decimales a mano, y nada frenaba un error de tipeo como 2.555. Ningún Business de la instalación tenía todavía ese problema.

## Criterios de éxito

1. Quien vende crea una Unit en Settings → Products → Units y se la da a un Product en la propia página del Product, desde el celular, en menos de un minuto.
2. Una cantidad con más decimales de los que admite su Unit se rechaza en los cinco lugares donde se ingresa una cantidad, al registrar y al editar, y no se guarda nada. Los cinco lugares son la **Sale line**, la **Stock entry**, la línea de **Stock withdrawal**, el **Bulk minimum** y el **Low-stock threshold**.
3. Los Businesses existentes no ven ningún cambio. Cada Product conserva la Unit "grams" / "g" con 2 decimales, y no se mueve ninguna cifra guardada.
4. Quien vende nunca puede hacer que los libros contradigan su Unit, y cada rechazo le dice por qué:
   - un Product con historial no cambia de Unit;
   - un Product sin historial no pasa a una Unit con menos decimales de los que usan sus Bulk minimums o su umbral;
   - una Unit no pierde decimales que usa una cantidad registrada;
   - una Unit en uso no se elimina.

## Comportamiento

### Las Units de un Business

- Un Business tiene una o más Units. Cada una tiene un nombre, una etiqueta y de 0 a 2 decimales.
  - El nombre y la etiqueta son obligatorios. Se recortan los espacios al principio y al final y se colapsan los internos.
  - El largo del nombre sigue el precedente del nombre de una **Expense category**; el largo de la etiqueta lo fija diseño.
- Las Units se definen solo en Settings → Products → Units. A propósito, no hay forma de crear una desde el formulario de un Product.
- La lista muestra el nombre de cada Unit, ordenadas por cómo las creó el Business.
- Un Business nuevo arranca con una sola Unit, "unit", con 0 decimales. Quien vende la puede renombrar o cambiar de inmediato.
- Los Businesses existentes reciben una Unit, "grams" / "g" con 2 decimales, y todos sus Products la usan. La migración solo agrega la tabla, la columna nueva que une cada Product con su Unit y las filas; no cambia ningún valor existente.
- El **Spreadsheet import** les da a los Products que carga una Unit "grams" / "g" con 2 decimales, igual que a los Businesses existentes. La Unit "unit" por defecto queda como cualquier otra Unit.
- Los nombres de Unit son únicos dentro de un Business, sin importar mayúsculas, minúsculas ni espacios, con la misma regla que las Expense categories. Las etiquetas se pueden repetir.
- Renombrar una Unit (el nombre o la etiqueta) y subirle los decimales se permite siempre.
- Un Business siempre conserva al menos una Unit: la última no se puede eliminar, y la pantalla dice por qué.

### Elegir la Unit de un Product

- La Unit se elige en la propia página del Product (varieties.md), porque la configuración de un solo Product vive ahí y nunca en Settings.
- Si el Business tiene una sola Unit, el formulario de un Product nuevo la trae preseleccionada, el paso 1 del **Onboarding** incluido. Con dos o más, quien vende tiene que elegir una. El formulario no tiene un valor por defecto oculto y no se puede guardar sin una elección.
- Un Product con **Variety history** muestra su Unit como texto de solo lectura, con una línea corta de motivo (por ejemplo "It has recorded sales, stock or withdrawals"). La línea viene del Copy module y usa las palabras del propio Business, nunca "grams" ni "variety".
- El historial es exactamente la Variety history: cualquier Sale line (los **Gift** y los **Special price** incluidos), cualquier Stock entry de cualquier origen o cualquier línea de Stock withdrawal. Las **Price entry** y el Low-stock threshold no traban la Unit. Se calcula con la misma consulta que decide entre Delete y Archive.
- Un Product sin historial muestra la Unit como una elección. Pasarlo a una Unit con menos decimales de los que usan sus Bulk minimums o su Low-stock threshold se rechaza con una oración que da el motivo.
- La página de una **Archived variety** ya es de solo lectura.

### Cantidades demasiado precisas

- Una cantidad con más decimales de los que admite su Unit se rechaza, al registrar y al editar. Por ejemplo, 2.555 con 2 decimales o 1.5 con 0. Nunca se redondea y no se guarda nada.
- Vale para la Sale line, la Stock entry (alta y edición), la línea de Stock withdrawal (alta y edición), el Bulk minimum de una Price entry y el Low-stock threshold.
- Cada uno lo controla en su propio dominio, a través de su propio puerto, con el valor congelado Unit de `app/shared` y su `admits(quantity)`. El rechazo es `quantity.too_many_decimals`.
- El campo conserva lo tipeado. Una oración llana debajo dice lo que admite la Unit: "Whole units only" con 0 decimales, y si no "Up to N decimals" (en singular con 1).
- Quien vende nunca ve el código `quantity.too_many_decimals`: el `detail` de la API es un diagnóstico y nunca se muestra.

### Rechazos en la pantalla Units

- **Eliminar una Unit**: se rechaza mientras algún Product esté unido a ella, archivado o no, con historial o sin él. Eliminar para siempre un Product sin historial libera su Unit.
- **Bajar los decimales**: se rechaza si alguna cantidad registrada de los Products de esa Unit usa más decimales. El control cubre Sale lines, Stock entries, líneas de Stock withdrawal, Bulk minimums de las Price entries y Low-stock thresholds, con un EXISTS por columna de cantidad.
- **La última Unit** no se elimina.
- **Un nombre repetido**, sin importar mayúsculas, minúsculas ni espacios, se rechaza.
- Cada rechazo es una oración que da el motivo, como "Recorded quantities already use 2 decimals" o "N products use this unit". No lista los registros en conflicto.
- Los rechazos se muestran en línea y conservan lo tipeado.

### En pantalla

- Settings → Products → Units es una tarjeta (navigation.md) con la lista de Units y la acción de agregar una.
- El formulario de una Unit (nombre, etiqueta, decimales) se dibuja en el celular con el único `Sheet` compartido, con "Close" y su acción principal fija abajo.
- La página de un Product muestra su Unit como elección (sin historial) o como texto de solo lectura con su línea de motivo (con historial).
- Todo texto de pantalla viene del Copy module. Ningún valor por defecto nuevo lleva una palabra de flor (variety, gram, g, indica, sativa, aroma, strain, 🌿).

## Qué entrega la primera parte

La primera parte, `units-link`, entrega el vínculo y nada de pantalla:

- la Unit compartida y su regla de decimales (`Unit.admits`);
- la migración `0021_units`: una Unit "grams" / "g" con 2 decimales por Business existente, y cada Product unido a la de su Business, sin cambiar ningún valor guardado;
- la Unit "unit" con 0 decimales en cada Business nuevo;
- el Product con su Unit: al crearlo, sin `unit_id` toma la única Unit del Business, con dos o más responde `product.unit_required`, y la Unit de otro Business responde `unit.not_found`; la lista y el detalle del Product traen su Unit;
- el Spreadsheet import, que le da "grams" / "g" con 2 decimales a los Products que carga.

El control de cantidades, el abm de Units y las pantallas llegan en las partes siguientes.

## Restricciones

- La tabla de Units lleva un `business_id` no nulo y se lee solo con un repositorio construido para un Business. Una Unit de otro Business responde 404 y nunca se revela (ADR-0004). Cada ruta nueva entra en el barrido de aislamiento y en el test de rutas protegidas.
- Una cantidad guardada sigue siendo un número entero de centésimos, cualquiera sea la Unit. Los decimales de la Unit solo validan lo que se ingresa y deciden cómo se muestra (ADR-0056).
- La migración nunca cambia el valor de una columna existente, y el comparador M3 de `tests/migrations/` lo prueba.
- Los códigos de rechazo van en `contract.json` (ADR-0008) y ninguno repite un nombre ni un monto (ADR-0005): demasiados decimales, Unit en uso, decimales ya usados, última Unit, nombre repetido y Unit trabada por historial o por los decimales de sus Bulk minimums o su umbral.
- Phone first: el flujo funciona en el celular antes que cualquier pulido.

## Fuera de alcance

- Mostrar cada cantidad con la Unit de su Product, y sumar cantidades por Unit (partes posteriores de GH-318).
- Crear una Unit desde el formulario de un Product.
- Convertir entre Units.
- Cambiar la Unit de un Product que tiene historial.
- Cualquier cambio a las cantidades o al dinero guardados.

## Métricas

- **Menos de un minuto (criterio 1)**: una corrida e2e en viewport de celular crea una Unit en Settings → Products → Units y se la da a un Product nuevo desde su página, sin ninguna llamada a la API a mano.
- **Rechazo en los cinco lugares (criterio 2)**:
  - una matriz de dominio y otra de TestClient cubren Sale line, Stock entry (alta y edición), línea de Stock withdrawal (alta y edición), Bulk minimum y umbral, cada uno con Units de 0, 1 y 2 decimales;
  - demasiados decimales responde `quantity.too_many_decimals` y escribe 0 filas. 100% en verde;
  - un test del front muestra la oración bajo el campo, con lo tipeado conservado.
- **Sin cambios para los existentes (criterio 3)**: el comparador M3 da 0 valores cambiados en columnas anteriores, y cada Product existente queda unido a "grams" / "g" con 2 decimales.
- **Libros nunca contradichos (criterio 4)**: un test con código propio por cada rechazo:
  - cambiar la Unit de un Product con historial, con cada fuente de historial sola;
  - pasar un Product sin historial a una Unit con menos decimales de los que usa su Bulk minimum o su umbral;
  - bajar decimales, con un test por cada columna de cantidad;
  - eliminar una Unit en uso por un Product archivado, uno con historial y uno sin;
  - eliminar la última Unit;
  - un nombre repetido sin importar mayúsculas, minúsculas ni espacios.
  
  Renombrar y subir decimales funcionan. Ningún rechazo contiene un nombre ni un monto.
- **Aislamiento**: la Unit de otro Business responde 404, y las rutas nuevas están en el barrido y en el test de rutas protegidas.
- **Valores por defecto neutros**: un Business nuevo tiene "unit" con 0 decimales, y en los valores por defecto y textos nuevos hay 0 palabras de flor.
- **Gate** (pytest, vitest, e2e): pasa.
