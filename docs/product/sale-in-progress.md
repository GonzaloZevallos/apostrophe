## Jobs

- When I hand over an order, I want to record it in a few taps (Products, grams, Customer, how they paid) with the total computed from that day's prices, so I never price from memory. Judged by: a sale is recorded from the phone in under a minute.
- When I open New sale on my phone, or change the date or the Customer, and the prices are still loading or could not be read, I want to see plainly that the list is loading or failed, and never see a price that is wrong, old or empty. That way I never price from memory, and I never record a sale at a figure the app did not actually work out.

## Qué es

La Sale in progress es la Sale que se está armando en New sale antes de guardarla: Customer, líneas (a lo sumo una por Product), fecha, Shipping charged, Note y cómo se paga. Vive solo en memoria durante una apertura de New sale (`useSaleDraft`) y nunca se guarda en el dispositivo.

## Lista de Products de New sale (`web/src/screens/ventas/NuevaVentaProductos.tsx`)

Es la parte 2 de GH-863 (#924 y su recorte de estados de carga y falla). Sigue sin ruta: ninguna ruta, entrada de Navigation ni pantalla la monta hasta la parte del flip de GH-496. Rigen las diez invariantes de #924; la 4 y la 6 son las de los estados de carga y falla.

### Carga

- **Primera carga:** la lista muestra `MOST_SOLD_ROWS` filas esqueleto con `aria-busy` verdadero, mediante `LoadingWhile`. No muestra encabezado, ningún dígito, ningún símbolo de moneda del Money format del Business, ninguna pista ni texto de lista vacía. El esqueleto se queda hasta que se resuelven todas las lecturas, la de New sale suggestions incluida, salga bien o mal, así que las filas no se reacomodan cuando llegan las sugerencias.
- **Cambio posterior de fecha o de Customer con la lista cargada:** los nombres y los steppers de las líneas se quedan. Las celdas que dependen de la fecha muestran la marca compacta de carga, la lista queda `aria-busy` y la pista se oculta hasta que llegan las cifras nuevas. Un precio viejo nunca se muestra como vigente: un cambio de Customer vuelve a calcular el precio sin destellar la cifra anterior.
- **Nueva lectura después de una falla:** como no queda una lista cargada, se vuelven a mostrar las filas esqueleto, con las mismas reglas que la primera carga. La marca compacta es solo para una lista cargada que sigue mostrando sus líneas.

### Falla

- Un `NetworkError` en la lectura de Products muestra SinConexion. Cualquier otro error muestra ErrorGenerico. Ambos se usan tal como ya existen, con el reintento que ya ofrezcan.
- Cualquiera de los dos reemplaza la lista entera, sin `aria-busy`, y no queda a la vista nada de la lista anterior, porque sus precios eran de una fecha o un Customer que ya no rigen.
- Cuando una lectura posterior sale bien, las líneas vuelven con las cantidades que había cargado quien vende y con los precios nuevos.
- Si falla solo la lectura de New sale suggestions, no se ve nada: ni error, ni marca, ni encabezado de sugerencias vacío, y la lista funciona sin sugerencias. Las sugerencias tampoco tienen marca de carga.

### Lectura de nuevo tras una falla

- Tras una falla, la lista vuelve a leer sola cuando el teléfono se reconecta o cuando la app recupera el foco, y reemplaza el aviso por la lista, con las cantidades que había cargado quien vende y los precios nuevos. Sin botón: los dos avisos no cambian (ADR 20261121).
- Nunca vuelve a leer en segundo plano una lista que ya cargó, y no hay un bucle de reintentos: una lectura que vuelve a fallar deja el aviso hasta el próximo evento.
- Sin red al abrir cuenta como una falla: muestra SinConexion sin `aria-busy` y no pide nada hasta que el teléfono vuelve.
- Una falla de Stock o de New sale suggestions es silenciosa: la lista aparece sin texto de stock o sin sugerencias.
- La lista cuenta con el `ContentArea` de la pantalla y no renderiza ninguno: su estado de ocupado pasa solo por `LoadingWhile`.
- Para la parte del flip: Guardar y el total no están disponibles salvo que `status` sea `ready` y el Customer no esté `'pending'`.

### Sale in progress

Ningún estado de carga o de falla de la lista borra ni cambia la Sale in progress: solo cambia lo que muestra la lista.

### Fuera de alcance

- La ruta, la Navigation y el montaje de la lista (parte del flip de GH-496).
- Un botón o un comportamiento de reintento más allá de la lectura de nuevo al reconectar o al recuperar el foco.
- Guardar o recuperar una Sale in progress.
- Cambios a SinConexion o a ErrorGenerico.
- Texto nuevo: no se agrega ninguna clave al Copy module.

## Métricas

La lista no tiene ruta, así que no hay medición de uso en la app hasta el flip de GH-496. Cada criterio de éxito se mide porque sus tests de `NuevaVentaProductos.test.tsx` pasan en el Gate (vitest):

1. **Primera carga sin cifras:** antes de que se resuelvan todas las lecturas, la lista está `aria-busy` y no muestra ningún dígito, ningún símbolo de moneda ni texto de lista vacía. Con la lectura de Products resuelta y la de sugerencias pendiente, el esqueleto sigue.
2. **Recarga sin precio viejo:** un cambio de Customer vuelve a calcular el precio sin destello mientras el nuevo está pendiente, y la pista está oculta mientras carga.
3. **Falla distinguible:** un 500 en Products muestra el error genérico y una falla de red muestra el estado sin conexión.
4. **Sugerencias que nunca bloquean:** un 500 en sugerencias no muestra error y la lista funciona.
5. **Busy solo al cargar:** ningún estado de falla tiene `aria-busy`.

También se prueba que una nueva lectura después de una falla muestra de nuevo el esqueleto, y que una lectura exitosa posterior devuelve las líneas con sus cantidades y los precios nuevos.
