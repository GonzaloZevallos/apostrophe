# Customer search

## Jobs

- When I am recording a sale for someone who just ordered, I want to pick them from the people I sold to most recently, or find them by typing a few letters of their name or phone, so the sale lands on the right person's account in a couple of taps and one person never becomes two customers.

## Qué es

La Sheet de New sale con la que se elige el Customer de la Sale in progress. Hay tres formas de usarla:

- elegir entre los Customers a los que se les vendió más recientemente;
- buscar tipeando parte del nombre o del Phone number, sin importar acentos ni mayúsculas;
- salir creando un Customer nuevo con lo tipeado, o siguiendo sin Customer.

Estado actual (GH-865 parte 2): el componente `web/src/screens/ventas/CustomerSearchSheet.tsx` existe, pero ninguna ruta ni entrada de la Navigation lo monta hasta la parte flip de GH-496. Por eso no tiene imagen de pantalla ni fila en el registro de pantallas.

## Comportamiento

### Encabezado
Título "Customer", con "Close". Nombre de la Sheet: "Choose a customer". Ayuda: "Search by name or phone, with or without accents.".

### Campo de búsqueda
- Tiene el foco al abrirse.
- Es `type=search`, con `autocomplete=off`, `enterkeyhint=search`, sin `inputmode` y con letra de al menos 16 px.
- La tecla de búsqueda solo cierra el teclado en pantalla: nunca elige a nadie.

### Búsqueda vacía
- Muestra el título "Recent customers" y hasta `RECENT_ROWS` (3) filas, tomadas de las New sale suggestions.
- Los ids que no corresponden a ningún Customer se descartan antes de aplicar el límite.
- Si no se resuelve ninguno, no se muestra nada.

### Búsqueda tipeada
- Las coincidencias no llevan título.
- Primero van los nombres que empiezan con lo tipeado y después el resto, incluidas las coincidencias solo por teléfono. Cada grupo va en orden alfabético, sin importar acentos ni mayúsculas.
- La parte que coincide se resalta con `<mark>`: negrita con subrayado de acento, desde tokens.
- Ninguna fila se marca como elegida ni lleva `aria-selected`.

### Fila
- Muestra el nombre y, en una segunda línea, el Phone number agrupado, solo cuando el Customer tiene uno.
- El teléfono se resalta cuando lo tipeado coincide con sus dígitos. El rango corresponde al texto agrupado que se muestra.
- No muestra el Balance, el Owing since, el Customer type ni la marca VIP.
- Un toque en la fila elige a ese Customer (`onChoose`).

### Orden de la lista
En todos los estados, la lista desplazable va en este orden:

1. Las coincidencias, o los Recent customers.
2. "Create «query»" (nombre accesible "Create customer query").
   - Aparece solo cuando lo tipeado no está en blanco, aunque coincida exactamente con el nombre de un Customer existente.
   - Lanza `onCreate(query)` y nunca cierra la Sheet.
   - Corta una búsqueda larga con puntos suspensivos.
3. "No customer" (nombre accesible "Continue without a customer"), que lanza `onContinueWithout()`. Que una Sale without a customer no quede debiendo lo hace cumplir el formulario de la Sale, no esta Sheet.

### Estados
- **Cargando:** `RECENT_ROWS` filas esqueleto bajo `aria-busy` (nombre "Loading customers"), hasta que estén listas la lectura de Customers y las sugerencias, una vez por apertura.
- **Sin coincidencias:** "No customer matches «query».", sin ícono.
- **Falla la lectura de Customers:** el aviso "Customers did not load." con el Attention icon y "Try again". Reemplaza solo las filas.
- **Falla la lectura de sugerencias:** simplemente no hay filas recientes.

### Vida de la Sheet
- El padre la monta solo mientras existe su entrada del historial.
- Lo tipeado sobrevive a Create y vuelve vacío en la próxima apertura.
- Un Customer guardado desde Create aparece recién en la próxima apertura, así que el padre lo elige y cierra la Sheet.
- Cerrar, volver, Create y No customer nunca pierden las líneas de la Sale in progress.
- Cada apertura vuelve a leer los Customers (`keys.saleFormCustomers()`, `gcTime` 0, `staleTime` Infinity, `refetchOnMount` true). No se vuelven a leer al recuperar el foco, al reconectar ni cuando se invalida 'customers'.

### Reglas de construcción
- El nivel de la Sheet sale solo de `SheetLevel`.
- La coincidencia, la resolución de recientes y los rangos resaltados viven solo en `web/src/sales/customerSearch.ts`.
- Los textos van en `web/src/copy/sales.ts`, en inglés, sin palabras de unidad ni de tipo de producto.
- Solo tokens: ningún texto literal ni valor hex en el componente.

### Fuera de esta parte
- Cómo vuelve a la Sale un Customer guardado desde Create.
- La nota de recálculo de precios, levantada como desvío.
- Cualquier ruta o entrada de la Navigation.

### Pendiente de comparar con el dibujo
Nada de esto se verificó contra NuevaVentaCliente. Toda diferencia es un desvío que decide el dueño:

- qué muestra una fila;
- que Create aparezca con una coincidencia exacta de nombre;
- la posición de No customer al final.

## Métricas

- **Elegir un reciente:** un Customer reciente se elige con un toque en su fila, sin tipear. Lo verifica el test "choosing sets the draft customer".
- **Buscar:** unas letras del nombre, con o sin acentos, o unos dígitos del teléfono encuentran al Customer, resaltado. Lo verifica el test de coincidencia sin acentos.
- **No perder líneas:** cerrar, volver, Create y No customer nunca pierden líneas de la Sale in progress. Lo verifican los tests de Close/back y de Create.
- **Lectura fallida:** muestra el motivo y "Try again". Lo verifica el test de falla.
- **Duplicados y tiempo:** cuando la Sheet esté montada, no debería aparecer un mismo Customer registrado dos veces, y se apunta a una Sale registrada desde el teléfono en menos de un minuto.
