## Jobs

**Cuando** un cliente me pregunta por un pedido, o necesito chequear a una persona o un producto mientras trabajo, **quiero** tipear unas letras de lo que me acuerdo (un nombre, un número de teléfono, un Sale number, el nombre de un producto) e ir directo a eso, **para poder** contestar sin tener que averiguar primero en qué pantalla está. (Parte 1 de la búsqueda global de la computadora, GH-1059: la sirve `GET /api/search`. La parte 2 construye la caja visible "Search sales, customers or products · Ctrl K" y Ctrl K.)

**Cuando** necesito llegar a un Customer o a un Product y me acuerdo solo de una parte del nombre, o de un dígito de su teléfono, **quiero** tipear unas letras y ver quién y qué coincide, con lo que debe cada Customer y el Stock que le queda a cada Product, **para poder** llegar en un paso y juzgarlo de un vistazo sin recorrer una lista. (GH-1103, parte 2, GH-1160: `GET /api/search` con los grupos Customers y Products.)

# Búsqueda global

La **Global search** es una sola búsqueda sobre las **Sales**, los **Customers** y los **Products** de un **Business**. Devuelve hasta 5 resultados por grupo, con lo necesario para reconocer cada fila sin abrirla y para saber dónde se abre. Solo ve el Business de la **Session** (ADR-0004). Solo lee: no cambia nada y no agrega ninguna regla sobre quién cuenta como Customer ni qué cuenta como Product.

Hoy quien vende busca a las personas con la búsqueda de Customers y abre Products para un producto. A una Sale llega solo recorriendo la lista de Sales por fecha o pasando por su Customer. El dolor es buscar entre pantallas. Ya hay un dibujo de la caja en el encabezado de las pantallas de computadora (`InicioCompu`, `ClientesCompu`, `GastosCompu`, `StockCompu` y las demás). La API responde igual la llame la pantalla que la llame: la caja es de la computadora, pero el job es de quien vende, no del dispositivo. El celular conserva sus pantallas sin tocar.

El Balance va en el resultado solo para reconocer a la persona correcta. No es una lista de deudas, que sigue siendo la vista "Owed to you" de Customers y Home (customers.md, payments.md).

## Estado de entrega

- **Entregado (GH-1160, parte 2 de GH-1103):** la ruta `GET /api/search` con los grupos Customers y Products tal como se describen abajo.
- **Pendiente:** el grupo Sales. En esta entrega `sales` responde siempre una lista vacía (`EmptySaleSearch`); el comportamiento de la sección Sales de abajo queda para una parte posterior, no se descarta.
- **Pendiente:** el cliente del front `search(q)` y cualquier pantalla.

Criterios de éxito:

1. **La encuentra con un fragmento.** Una parte del nombre o un dígito del teléfono de un Customer, una parte del nombre de un Product, o un Sale number devuelve la fila correcta en su grupo, en un solo pedido, sin importar mayúsculas ni acentos ("jose" encuentra a "José"). Una Sale se encuentra por su número y por el nombre de su Customer.
2. **Se reconoce sin abrirla.**
   - Una Sale muestra su Sale number, su fecha, el nombre de su Customer (o ninguno) y su total.
   - Un Customer muestra su nombre y su Balance.
   - Un Product muestra su Stock de hoy.
3. **Segura y barata.**
   - La respuesta lleva solo datos del Business de la Session y nunca revela que existe otro, ni siquiera un Customer o Product de otro Business con el mismo nombre y los mismos dígitos de teléfono.
   - Un Archived product nunca aparece.
   - Una consulta faltante, vacía, demasiado corta o demasiado larga responde tres grupos vacíos, nunca un error, y no busca.
4. **Corta.** Como máximo 5 resultados por grupo, con los nombres que empiezan con la consulta primero.
5. **Las cifras coinciden con el resto de la app.** El Balance de un Customer es el que muestra Customers; el Stock de un Product es el que da `/api/stock`, también alrededor de la medianoche de Argentina.

## Comportamiento

### La consulta

- **`GET /api/search?q=`** es una ruta protegida: exige una Session (sin ella responde 401) y está en el barrido de aislamiento y en el test de rutas protegidas.
- `q` se recorta primero. Un `q` que falta, vacío, de un solo carácter o de más de 200 caracteres responde 200 con los tres grupos vacíos, sin buscar. Un `q` de 200 caracteres se busca. La respuesta vacía tiene la misma forma que una llena, así que una consulta corta nunca parece una falla.
- Un "#" adelante seguido de dígitos se acepta como Sale number. Un "#" solo, una vez sacado, cuenta como vacío.
- Un `q` mandado más de una vez se lee como un solo valor, el último, igual que cualquier otro parámetro repetido de la API: `?q=ab&q=cd` es `?q=cd`.

### La respuesta

- Tiene tres listas, `sales`, `customers` y `products`, con 5 resultados como máximo cada una.
- Cada grupo responde por su cuenta, así que una misma consulta puede traer resultados en varios grupos.
- El dinero viaja en unidades de moneda como decimal (ADR-0058), correcto con Money scale 0 y 2.

### Coincidencia

- La coincidencia no distingue mayúsculas ni acentos y acepta una parte de una palabra.
- No se escribe ninguna regla nueva. El servidor aplica exactamente las reglas de los matchers que ya existen:
  - el pliegue de `web/src/components/selectorSearch.ts` (`foldForSearch`, `matchesQuery`);
  - la regla de Customers de `web/src/sales/customerSearch.ts` (`matchCustomers`), que en el servidor es `Customer.matches`: el nombre, o los dígitos de la consulta como un tramo contiguo de los dígitos del teléfono. Por eso una consulta de 2 caracteres con un solo dígito ("#5", "1x") encuentra a un Customer por ese dígito; la búsqueda no agrega ninguna regla de teléfono propia.
- Si alguna de esas reglas queda implementada en el front y en el servidor, un solo archivo de casos compartido prueba que los dos lados coinciden.
- **Orden de Customers y Products:** primero los nombres que empiezan con la consulta, después el resto; cada tanda por nombre plegado (sin acentos ni mayúsculas) y, ante un empate, por id.
- **Costo:** la coincidencia y el orden se calculan en Python en cada pedido, porque ese orden no se puede expresar como un ORDER BY de SQL; el costo crece con la cantidad de Customers y Products del Business, y está aceptado.

### Sales

Pendiente: en la entrega actual el grupo responde siempre vacío. Cuando se entregue:

- **Por número.** Una consulta de solo dígitos (con un "#" adelante o sin él) coincide con el **Sale number** exacto: "12" encuentra solo la Sale #12, nunca la #112 ni la #120. Un Sale number es una referencia exacta que quien vende lee de un **Sale bill**, así que las coincidencias cercanas serían solo ruido.
- **Por Customer.** Cualquier otro texto se compara con el nombre del Customer de la Sale, con la regla de Customers.
- **Sin Customer.** Una **Sale without a customer** se encuentra solo por su número. La **Note** no se busca.
- **Orden**: primero la fecha más reciente, después el Sale number más alto.
- **Cada resultado** lleva `id`, el Sale number, la fecha, su Customer (`id` y nombre) o `null`, y `total`.
- **El `total`** es lo que paga el Customer: las líneas más el **Shipping charged**, esté paga o no. Un **Gift** cuenta $0 y un **Special price** su propio monto. Es la misma cifra que muestran la lista de Sales y el Sale bill, tomada de la misma fuente; la búsqueda nunca la vuelve a calcular.
- El **Payment state** no forma parte del resultado.

### Customers

- Se buscan por nombre o por teléfono, con la regla y el orden de la búsqueda de Customers (customers.md), así las dos búsquedas nunca discrepan.
- **Cada resultado** lleva `id`, `name` y `balance`: el **Balance** con su signo, en unidades de moneda (ADR-0058), leído igual que lo lee Customers. Un **Credit** queda por debajo de cero y nunca se recorta a 0; un Customer sin movimientos se lee como lo lee Customers.
- El Balance se lee solo para los Customers que se devuelven, después de cortar a 5.
- Una consulta de dígitos también llega a este grupo por la regla del teléfono, así que "12" puede traer la Sale #12 y un Customer cuyo teléfono contiene 12.
- Cómo se lee el Balance en pantalla ("Owes you" / "Credit") es de la parte de pantalla, con las palabras del glosario.

### Products

- Se buscan solo por nombre, con el mismo orden que los Customers.
- Solo se dejan afuera los **Archived products**. Se encuentran los **Hidden products**, los Products sin **Current price** y los que tienen Stock en cero o negativo. El Stock siempre se da con su cifra real.
- **Cada resultado** lleva `id`, `name` y el **Stock** de hoy como `quantity` (un decimal), con el mismo nombre y valor que usan las otras respuestas de stock (quantity.md): es la cifra de `/api/stock` para el mismo día, calculada con el mismo reloj, también justo antes y justo después de la medianoche de Argentina.
- El Stock se lee solo para los Products que se devuelven, después de cortar a 5.
- **Sin unidad.** El resultado no tiene campo de unidad, porque **Assume nothing** prohíbe fijar "g" en el código. La parte que entrega la **Unit** (GH-318) suma la unidad a este resultado junto con las demás cantidades, y la parte de pantalla muestra la etiqueta que exista para entonces.

### Aislamiento

- Se devuelven solo datos del Business de la Session.
- Ningún resultado ni error revela otro Business: un Customer de otro Business con el mismo nombre y los mismos dígitos de teléfono, o un Product con el mismo nombre, nunca aparece.

### Front

- Pendiente: `search(q)` en `web/src/api/`, con su tipo y su query key.
- La parte que la sume no la conecta a ninguna pantalla. Si el control de docs del front lo exige, `search(q)` se suma a `web/scripts/docs/front-exclude.json`, y la parte que la conecta saca esa entrada (D-62e6dc23).
- Desde dónde se llega a la búsqueda lo dice `navigation.md`, en un párrafo que remite a este archivo.

## Fuera de esta parte

- La caja de búsqueda visible, Ctrl K y cualquier cambio de pantalla.
- Los resultados del grupo Sales (pendiente, ver Estado de entrega).
- El cliente del front `search(q)`.
- Reglas nuevas de coincidencia por teléfono.
- La etiqueta de unidad de un Product (GH-318).
- Buscar en las Notes.
- El Payment state en el resultado de una Sale.
- Una versión de la búsqueda para el celular.

## Métricas

- **Encuentra con un fragmento:** los tests de la API encuentran a un Customer por una parte del nombre (mayúsculas, acentos, parte de una palabra) y por un dígito del teléfono ("#5", "1x"), y a un Product por una parte del nombre, en un solo pedido.
- **Aislamiento:** cero resultados de otro Business en el barrido de aislamiento y en los tests con Customers y Products parecidos; 401 sin Session.
- **Sin errores por la consulta:** un `q` faltante, vacío, de 1 carácter, "#" o de 201 caracteres responde 200 con tres listas vacías.
- **Cifras coherentes:** el Balance coincide con el de Customers (un Credit queda por debajo de 0, también con 2 decimales) y el Stock coincide con `/api/stock` antes y después de la medianoche de Argentina.
- **Corta y ordenada:** como máximo 5 resultados por grupo, con los nombres que empiezan con la consulta primero.
