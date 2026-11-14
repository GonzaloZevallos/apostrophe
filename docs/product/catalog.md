## Jobs

**Cuando** cambia un precio, se agota un producto o empiezo a ofrecer uno, **quiero** abrir el texto del Catalog que la app ya armó a partir de los Current prices y el stock de hoy, revisarlo, y compartirlo o copiarlo con un toque, **para** mandárselo yo mismo a mis clientes (por WhatsApp, Telegram o Instagram) sin volver a tipear un precio ni el nombre de un producto, y que mis clientes nunca vean un precio desactualizado ni un producto que no puedo vender.

Configurar los Catalog attributes y el Catalog header and footer es el paso de configuración de este mismo job. Mantener el Pinned catalog al día por sí solo (Test send, Publish, fijarlo) es el job de Telegram de BRIEF.md, que sirve pinned-catalog.md, que reutiliza este texto tal cual.

**Cuando** quiero mandarle el Catalog de hoy a mano a un cliente o a un chat, **quiero** copiarlo con un toque y pegarlo en cualquier lado para que se lea como en pantalla, **para** mandarlo enseguida sin volver a tipear ni corregir nada. (Lo sirven las versiones plana y enriquecida de Copy y Share, que envía la versión plana de Copy.)

**Cuando** configuro cómo cobra mi negocio, registro el precio de un producto o entrego un pedido, **quiero** que la app use solo las Pricing rules que tiene mi negocio, **para** cobrarle a cada cliente exactamente lo que quiero cobrar sin ver campos que no me corresponden. (Se define en pricing-settings.md: acá lo sirven la línea de Bulk price, que sigue a Bulk price, y que el VIP price nunca llega a los clientes.)

**Cuando** llevo mi negocio desde el teléfono entre pedidos o en medio de un chat con un cliente, varias veces por día, **quiero** que la app esté ordenada según lo que hago de verdad y con qué frecuencia, **para** volver al cliente en vez de buscar entre menús. (Es el job de navegación, navigation.md: acá lo sirve la pantalla del Catalog, a 2 toques como máximo desde cualquier Tab root.)

**Cuando** un cliente me pregunta qué tengo o cuánto sale algo, o entra Stock, se termina o cambia de precio, **quiero** abrir un producto y encontrar todo sobre él en su propia página, que la lista me diga de un vistazo qué tengo, qué se está por terminar y qué no puedo vender, y tener el Catalog de hoy a un toque de esa lista, listo para compartir desde el teléfono, **para** contestarle al cliente, registrar lo que entró y mandar un Catalog al día sin moverme entre pantallas, y que mis clientes nunca reciban un precio desactualizado ni un producto que no puedo vender. (El job de navegación aplicado a los Products, el stock y el Catalog, varieties.md: acá lo sirven la pantalla del Catalog y Share.)

**Cuando** un producto que cargué por error, o uno con el que ya no trabajo, sigue apareciendo en mis listas y selectores, **quiero** sacarlo desde el teléfono en pocos toques, eliminándolo si nunca se movió y archivándolo si tiene historial, **para que** mis listas muestren solo lo que todavía vendo, ninguna cifra pasada de ventas, stock, costo o Profit cambie, y pueda volver a tenerlo exactamente como estaba si empiezo a venderlo de nuevo. (Acá lo sirve dejar los Archived products fuera del texto y de lo que no sale; se define en varieties.md.)

**Cuando** mi negocio trabaja en un idioma que no es el inglés, **quiero** que el Catalog de mis clientes hable ese idioma de punta a punta, incluidas las líneas fijas y no solo el header y el footer que tipeé, y que un negocio abierto en ese idioma arranque con su header, su footer y sus Expense categories ya en él, **para que** lo que leen los clientes sea coherente y yo no tenga nada que traducir ni volver a tipear. Mientras mi negocio está en inglés, no cambia absolutamente nada de lo que vemos yo o mis clientes. (Compartido con stored-language.md: acá lo sirven las líneas fijas, que siguen al Shown language, y los valores por defecto del header y el footer, que siguen al Stored language al abrirse.)

**Cuando** mi negocio cuenta la plata en otra moneda o con centavos, **quiero** elegir yo mismo, desde Settings, el símbolo de la moneda y la cantidad de decimales, **para que** cada pantalla muestre y acepte la plata como la contamos mis clientes y yo, sin que ningún monto que ya registré cambie de valor. (Se define en money.md: acá lo sirve que los precios del Catalog y del Pinned catalog lleven el símbolo y los decimales del Business.)

# Catalog

El texto que les ofrece a los Customers de un negocio los Products que se pueden vender hoy. Lo ve solo su **Business** (ADR-0004). Se arma a partir de:
- los **Catalog attributes** de cada **Product**;
- su **Current price** hoy (varieties.md);
- su **Stock status** en este momento (stock.md);
- las **Pricing settings** del Business (pricing-settings.md), para la línea de Bulk price;
- el **Shown language** del Business, para las líneas fijas (stored-language.md);
- el **Money format** del Business, para el símbolo y los decimales de la plata (money.md);

entre el **Catalog header and footer** propios del Business. El **Pinned catalog** (pinned-catalog.md) envía exactamente este texto por el bot de Telegram propio del Business y lo mantiene al día. Share y Copy quedan para enviarlo a mano, en una forma que se pega en cualquier app de chat con sus saltos de línea (ver Copy y Share). Un **Archived product** (varieties.md) nunca forma parte de él.

Dónde viven sus partes (navigation.md):
- la pantalla del **Catalog** (`/varieties/catalog`) se abre desde "Send catalog" en Products;
- los atributos de un Product se editan en su página, en "In the catalog";
- el header y el footer se editan en Settings → Catalog message (o, hasta que exista ese grupo, en el lugar provisorio al que se llega desde la pantalla del Catalog; ver más abajo).

Criterios de éxito:

1. **Texto exacto**: el texto del Catalog sigue exactamente el formato de la planilla.
   - El header, después un bloque por Product, después el footer.
   - Cada bloque tiene su emoji y su nombre en negrita, el Indica share, el Aroma, el List price por gramo y la línea de Bulk price.
   - Los marcadores `**bold**` quedan en el texto (`catalog.text` y lo que envía el Pinned catalog; Copy y Share sacan la versión plana, ver más abajo).
   - La plata se escribe con el símbolo del Business pegado a la cifra y los decimales del Business: `$11.000` con los valores por defecto, `US$11.000,50` con "US$" y 2 decimales.
   - Una línea se deja afuera cuando le falta su dato (Indica share, Aroma, Bulk price), y la línea de Bulk price también mientras Bulk price está desactivado.
   - Se prueba contra un conjunto de referencia con 0 diferencias.
2. **Hoy, solo lo que se puede vender**: un Product aparece solo cuando no está archivado, se muestra, tiene un Current price en la fecha de hoy en Argentina y tiene Stock mayor que cero en este momento.
   - Los Products archivados, ocultos, sin precio, agotados y que nunca tuvieron Stock quedan afuera.
   - El Stock bajo sigue adentro.
3. **Rápido, desde el teléfono**: desde Products → "Send catalog", el vendedor comparte o copia el texto de hoy en unos segundos sin tipear nada. Share le pasa a la hoja nativa de compartir exactamente la versión plana de Copy; sin hoja de compartir, queda Copy. Una hoja de compartir que nunca termina nunca deja la pantalla trabada: Share y Copy siguen usables. Esto incluye el teléfono en la red de la casa por http plano. No hay ninguna llamada a la API a mano.
4. **Sin adivinar por qué**: cada Product sin archivar que no sale da un motivo, el primero que corresponda: oculto, sin precio hoy, después agotado o sin movimientos. Se dice con palabra, nunca solo por color.
5. **Los Businesses nunca se mezclan** (ADR-0004): los atributos, el header, el footer y el Money format pertenecen a un solo Business. El texto y la lista nunca incluyen datos de otro Business.
6. **Los clientes nunca ven el VIP price**: el texto nunca lo lleva, sean cuales sean los interruptores.
7. **Un solo idioma de punta a punta**: para un Business cuyo Shown language no es el inglés, cada línea fija del texto (y la línea vacía del Pinned catalog) está en ese idioma, en la pantalla del Catalog, Test it, Publish y la Upkeep por igual. Un Business en inglés en la misma corrida sigue en inglés.
8. **El inglés sin cambios**: para un Business en inglés con el Money format por defecto, el texto y el header y el footer de un Business nuevo son idénticos byte a byte a la línea de base congelada (`en.baseline.json`). Los formatos de gramos son los mismos en todos los idiomas, y la plata sigue el Money format del Business, nunca el idioma.
9. **Se pega como se ve, en cualquier lado**: copiado con Copy y pegado en la caja de mensaje de Telegram en iPhone, el Catalog conserva cada salto de línea y cada línea en blanco que muestra la pantalla (una línea por viñeta, bloques separados como en pantalla) y no muestra ningún `**` literal. La misma copia se sigue leyendo bien en WhatsApp y en un destino de texto plano, sin regresión, y el vendedor envía lo pegado sin editarlo. Telegram, WhatsApp y el texto plano son todos destinos de primera; arreglar uno nunca justifica romper otro.
10. **La plata del negocio**: después de que el vendedor cambia el símbolo o los decimales, el Catalog de la pantalla y el Pinned catalog muestran la plata con el formato nuevo, sin que ningún precio cambie de valor.

## Comportamiento

### Catalog attributes, por Product

- **Emoji**: opcional, exactamente un emoji. Texto común o más de un emoji se rechaza. Sin ninguno, la línea del nombre no lleva un emoji de reemplazo.
- **Indica share**: número entero opcional de 0 a 100; el resto es sativa. En inglés se lee "• N% indica / (100−N)% sativa", incluidos los extremos 0 y 100. Sin ninguno, la línea se deja afuera.
- **Aroma/flavor**: opcional.
  - Se recorta, y cada tramo de espacios en blanco, saltos de línea incluidos, se colapsa en un solo espacio.
  - Admite hasta 200 caracteres.
  - Vacío significa que no hay, y la línea se deja afuera.
  - Se permite `*` (ver Marcadores de negrita).
- **Se muestra**: sí o no.
  - Sí por defecto para un Product nuevo.
  - Sí para cada Product que existía cuando salió el Catalog.
- **Cuáles se pueden editar**: todo Product sin archivar, incluidos los que quedan afuera por falta de precio o de Stock. Los atributos de un Archived product son de solo lectura hasta que se restaura, y archivarlo o restaurarlo los conserva, incluida la marca de si se muestra (varieties.md).
- **Sin efectos colaterales**: los atributos nunca tocan precios, Stock ni Sales.
- **Dónde**: se editan solo en la página propia del Product, en su sección "In the catalog" (varieties.md), nunca en la pantalla del Catalog.

### Catalog header and footer, por negocio

- **Forma**: texto libre de varias líneas, de hasta 500 caracteres cada uno. Los saltos de línea internos se conservan; las líneas en blanco del principio y del final se recortan.
- **En blanco**: se permite. Un header o un footer en blanco se deja afuera del texto.
- **Valores por defecto**: un Business nuevo se abre con un header y un footer por defecto en su Stored language al abrirse (stored-language.md), guardados como datos propios.
  - En inglés son el header "🌿 **CATALOG** 🌿" y el footer "📩 Questions and orders by private message.", idénticos byte a byte a la línea de base.
  - Un Stored language nunca es el Test locale, así que los valores por defecto nunca se escriben en `en-XA`, ni siquiera mientras está activada la Forced language del Operator.
  - Un cambio de idioma posterior nunca los reescribe: desde la apertura son datos propios del vendedor, nunca traducidos.
  - Un Business que existía cuando salió el Catalog recibió los valores por defecto en inglés una sola vez, al actualizarse; cada Business que existía antes de este cambio conserva exactamente lo que guardó, sin completar nada hacia atrás.
  - No hay "restore default".
- **Dónde**: se editan solo en Settings → Catalog message (navigation.md).
  - **Excepción provisoria**: hasta que exista ese grupo, se editan, exactamente como antes, en el lugar provisorio al que se llega solo desde la pantalla del Catalog (ver En pantalla). Se quita cuando salga Settings.

### El texto del Catalog

- **Disposición**: el header, después un bloque por cada Product que califica, ordenados por nombre, después el footer. Hay una línea en blanco entre secciones, y un header o un footer en blanco no deja una línea en blanco de más.
- **Cuáles califican**: un Product sin archivar, que se muestra, que tiene un Current price hoy en hora argentina y que tiene Stock mayor que cero. El Stock bajo califica. Un Archived product nunca califica, sean cuales sean su marca, su precio o su Stock.
- **Un bloque de Product** (se muestra la redacción en inglés):
  - `<emoji> **<name>**`, o `**<name>**` sin emoji;
  - `• N% indica / M% sativa`, solo con Indica share;
  - `• Aroma/flavor: <aroma>`, solo con Aroma;
  - `• Price per gram: <money>`, el List price por gramo;
  - `• From <grams>: <money> each`, el Bulk minimum en gramos y el Bulk price de cada gramo. Se muestra solo cuando el Current price tiene Bulk price y Bulk price está activado. Los gramos enteros se muestran sin decimales; si no, se usa coma decimal (`2,5 g`).
- **Líneas fijas e idioma**:
  - Las líneas fijas son la línea del Indica share, la línea de Aroma/flavor, la línea de precio por gramo, la línea de Bulk price y la línea vacía del Pinned catalog "Nothing to offer for now." (pinned-catalog.md).
  - Salen del Copy module en el Shown language del Business: la Forced language del Operator cuando hay una, si no el Stored language (stored-language.md). El idioma se calcula al armar el texto, en cada apertura de la pantalla del Catalog y en cada corrida de Test it, Publish y la Upkeep.
  - Cuándo se muestra una línea, y el dato que lleva, no dependen del idioma.
  - Los datos propios del vendedor nunca se traducen: los nombres, los emoji, el Aroma, el header y el footer quedan como se guardaron.
  - Los formatos de gramos son los mismos en todos los idiomas, y la plata sigue el Money format del Business, nunca el idioma.
  - En inglés, cada línea fija es idéntica byte a byte a la línea de base `en.baseline.json`.
- **VIP price**: nunca está en el texto, sean cuales sean los interruptores (pricing-settings.md).
- **Plata**: el estilo propio del Catalog, con el símbolo y los decimales del Money format del Business (money.md). Lleva el símbolo pegado a la cifra, sin espacio, punto para los miles y, con decimales, coma decimal y exactamente los decimales del Business: `$11.000` con los valores por defecto, `US$11.000,50` con "US$" y 2 decimales. No es el `$ 11.000` de la app.
- **Stock en el texto**: ninguno. Nunca menciona gramos, Stock ni Stock bajo.
- **Frescura**: el texto se calcula en cada apertura a partir de los datos, las Pricing settings, el Shown language y el Money format tal como están. No se guarda nada, y la pantalla no se actualiza sola mientras está abierta. Disparan la Upkeep del Pinned catalog (pinned-catalog.md, stored-language.md, money.md):
  - un guardado de Prices que cambia cualquiera de los dos interruptores;
  - un cambio del Stored language;
  - un cambio guardado del símbolo o de los decimales en Settings → Business → Currency and decimals.
- **Cuando nada califica**: no hay texto, y la pantalla dice que hoy no hay nada en el Catalog. El Pinned catalog envía en cambio su propio mensaje vacío (pinned-catalog.md).

### Marcadores de negrita

- **Permitidos en todos lados**: el vendedor puede tipear `**` en el header, el footer, el Aroma y el nombre del Product. Ningún campo rechaza `*`.
- **Se conservan en el texto como se tipearon**: el texto del Catalog (`catalog.text`, y lo que envía el Pinned catalog) conserva cada marcador exactamente como se tipeó. No se escapa ni se quita nada, tampoco cuando un nombre que contiene `**` queda envuelto en los `**` propios de la app.
- **Regla de emparejamiento**: lo que sea que muestre el texto lee los marcadores `**` de izquierda a derecha y los empareja en orden.
  - El texto entre cada par va en negrita, y los marcadores de ese par se ocultan.
  - Un `**` final sin pareja se muestra como se tipeó.
  - Esto vale para la vista previa de acá, para el bot de Telegram (pinned-catalog.md) y para lo que sacan Copy y Share: los marcadores emparejados se quitan de la versión plana de Copy y pasan a negrita en su versión enriquecida; un `**` final sin pareja queda como se tipeó en las dos.

### En pantalla: la pantalla del Catalog

- **Ruta**: `/varieties/catalog`. El viejo `/catalogo` redirige ahí de forma permanente (navigation.md).
- **Se abre desde**: "Send catalog" en Products, y el aviso "Your Telegram catalog is out of date" de Home. Es un detalle (navigation.md): la barra o la barra lateral y "‹ Products", sin "+ New sale".
- **Siempre se abre**, también cuando nada califica: muestra entonces el estado vacío, y el Pinned catalog conserva su propio mensaje vacío y "Up to date" (pinned-catalog.md). "Send catalog" está desactivado, con su motivo en palabras (p. ej. "Add a product with a price and its stock"), solo para un Business anterior al Onboarding que no cumplió los dos pasos obligatorios, mientras nada califica (navigation.md).
- **"How it looks in Telegram"**: el texto como lo lee un cliente. No cambia por cómo funciona Copy.
  - La negrita sigue la regla de emparejamiento de arriba.
  - Cada otra línea, salto, línea en blanco, emoji y precio es idéntico a la versión plana de Copy.
  - Muestra el estado vacío cuando nada califica.
- **Share**, la acción principal:
  - abre la hoja nativa de compartir del dispositivo con exactamente la versión plana de Copy: sin `**` emparejados, con cada salto de línea y cada línea en blanco. Share no tiene una versión enriquecida propia;
  - donde el navegador no ofrece hoja de compartir, no se muestra, y queda Copy;
  - el éxito, o cerrar la hoja de compartir sin enviar, no muestra nada ni cambia nada: la hoja de compartir es su propia respuesta, y no hay toast;
  - una falla real (no que el vendedor cancele) muestra el fijo "Could not share." y deja Copy disponible;
  - una hoja de compartir que espera terminar nunca retiene la pantalla: Share y Copy nunca se desactivan ni quedan ocupados por ella, así que una hoja que nunca termina (gira, o se cerró sin que el navegador le avise a la app) nunca deja la pantalla trabada;
  - un compartir que nunca termina cuenta como cerrar la hoja sin enviar: no muestra nada ni cambia nada. No hay límite de tiempo;
  - tocar Share otra vez mientras un compartir anterior no terminó empieza un compartir nuevo con el mismo texto. Si el navegador lo rechaza, es una falla real ("Could not share.", Copy disponible). Solo se muestra el resultado del último compartir; uno anterior que termina tarde no muestra nada;
  - nunca se copia nada por su cuenta cuando compartir falla o no termina: Copy sigue en pantalla para que el vendedor lo toque;
  - ninguno de los dos mensajes lleva nada del texto del Catalog, ni un nombre ni un monto.
- **Copy**, la alternativa, pone el Catalog en el portapapeles para que se pegue en cualquier app de chat como lo muestra la vista previa:
  - **Versión plana**, siempre presente: el texto del Catalog con cada `**` emparejado quitado, y cada salto de línea y cada línea en blanco conservados. Nunca lleva un `**` emparejado. La lee todo destino de texto plano.
  - **Versión enriquecida**, un extra donde el navegador lo permite: la versión plana más negrita entre marcadores emparejados (los de la app alrededor de los nombres y los propios del vendedor por igual), con saltos de línea y líneas en blanco reales. El texto del vendedor se pone como texto, nunca se lee como marcado: un `<`, `>` o `&` se pega como se tipeó. La negrita nunca pesa más que pegarse bien en todo destino: si no se puede mostrar que la versión enriquecida sobrevive al pegado de Telegram en iPhone con cada salto de línea intacto, Copy pone solo la versión plana.
  - Un `**` final sin pareja queda como se tipeó en las dos versiones.
  - Ya no copia el texto crudo con sus marcadores `**`: el Pinned catalog sigue enviando ese texto, por la API de Telegram, no por un pegado.
  - Al tener éxito muestra el toast "Catalog copied", sean cuales sean las versiones que fueron al portapapeles.
  - Funciona desde el teléfono por el http plano de la red de la casa, con al menos la versión plana; donde no se puede escribir la versión enriquecida, la plana sola es un éxito.
  - Funciona en cualquier estado en que esté Share, incluido un compartir que no terminó.
  - Una falla muestra un "Could not copy." fijo y ningún toast. Ningún mensaje lleva texto del Catalog, y no hay ningún estado que diga qué versión se copió.
- **El estado del Pinned catalog y Publish** (pinned-catalog.md): "Up to date" u "Out of date" con su motivo fijo, y Publish. Cuando Publish no está disponible, dice por qué en palabras y enlaza a donde están los Bot settings: Settings → Integrations, o el lugar provisorio hasta que exista.
- **Lo que no sale, y por qué**: cada Product sin archivar que queda fuera del Catalog de hoy, por nombre, cada uno con un motivo, el primero que corresponda:
  1. oculto por el vendedor ("hidden");
  2. sin precio hoy ("no price");
  3. las propias palabras del Stock: agotado ("sold out") o sin movimientos ("no entries").

  Cada motivo se dice con palabra, nunca solo por color (p. ej. "Sir Jack, sold out · Mango Bomb, no price · X, hidden"). La redacción exacta es de diseño. Los Archived products no se listan acá.
- **Enlaces**: cada Product nombrado en la vista previa o en lo que no sale abre la sección "In the catalog" de ese Product en su página. "Edit header and footer" abre Settings → Catalog message, o el lugar provisorio hasta que exista.
- **La pantalla en sí no edita ningún header, footer ni dato de los Bot settings**: solo enlaza afuera (navigation.md).
- **El lugar provisorio** (una excepción deliberada y provisoria mientras no existan Settings → Integrations y Catalog message):
  - tiene los Bot settings (token, chat del canal, chat propio, Test it) y el header y el footer, funcionando exactamente como antes, sin rehacer nada;
  - se llega solo desde la pantalla del Catalog, por "Edit header and footer" y el enlace "unavailable" de Publish;
  - es un formulario: "Close" vuelve por el historial, y sin historial a la pantalla del Catalog; salir con cambios sin guardar pregunta antes;
  - no tiene pestaña, acceso en More, grupo en Settings ni marca de "coming soon", y no muestra estado del Pinned catalog ni Publish;
  - el propio issue de Settings redirige los dos enlaces y lo quita. Si Settings ya existe, no se construye.
- **Guardar los atributos** (en la página del Product) o **el header y el footer** muestra el toast "Catalog saved"; la pantalla del Catalog muestra el texto nuevo la próxima vez que se abre. Los toasts no llevan datos.
- **Las negativas** se muestran en línea y conservan lo tipeado. Cada una lleva un código de `contract.json` (ADR-0008) y nunca repite lo ingresado (ADR-0005).
- **Un Product que ya no está** sigue la regla "That is gone." de accounts.md.

### Restricciones

- Cada tabla del Catalog lleva `business_id`, y el Business sale de la Session.
- Cada ruta entra en el barrido de aislamiento, en la prueba de rutas protegidas y en la prueba de migración de pertenencia.
- Ningún header, footer, Aroma ni texto del Catalog va a los logs, la consola ni el almacenamiento del navegador.
- Las versiones plana y enriquecida de Copy se arman en el front a partir del texto de la API con la misma regla de emparejamiento que usa la vista previa; el `catalog.text` del servidor no cambia por ellas.
- El Money format le llega al Catalog por su propio puerto de lectura, que nunca lee la Money scale (money.md). Los precios llegan al texto como `Money`, armados de los centésimos que lee el adaptador, así que los centavos se conservan; la plata se escribe con aritmética entera, sin float ni redondeo.
- **Idioma**:
  - El dominio del Catalog no importa ninguna biblioteca de traducción. Las líneas fijas le llegan como un valor `CatalogWords` simple a través de `CatalogWordsSource`, un puerto en la capa de aplicación del Catalog.
  - El idioma del Business le llega al Catalog solo a través de `CatalogLanguage`, implementado en el adaptador propio del Catalog sobre accounts. Ese adaptador es el único lugar donde se aplica el reemplazo forzado.
  - La Upkeep lee el idioma en su propia sesión, después del commit que la dispara.
  - Ninguna ruta, consulta ni cuerpo nombra un Business o un idioma, y ningún dato de una solicitud elige `en-XA`.

## Métricas

- **Texto exacto (criterio 1)**: el conjunto de referencia cubre:
  - emoji o ninguno;
  - Indica share en 0, 50 y 100, o ninguno;
  - Aroma o ninguno;
  - Bulk price o ninguno, con un Bulk minimum entero y uno fraccionario;
  - un Bulk price con Bulk price activado y desactivado;
  - montos con miles;
  - un header en blanco y un footer en blanco;
  - `**` propios del vendedor en el header, el Aroma y un nombre, incluido uno sin pareja;
  - el Money format por defecto, uno con "US$" y 2 decimales (con un precio con centavos y uno entero, que se lee con `,00`) y uno con un símbolo de 1 carácter y 1 decimal.

  0 diferencias.
- **La plata del negocio (criterio 10)**: un cambio guardado de símbolo o de decimales dispara la Upkeep, y el texto siguiente de la pantalla, Test it, Publish y la Upkeep lleva el formato nuevo, sin que cambie el valor de ningún precio. 100% de aprobación.
- **Sin VIP price (criterio 6)**: en todo el conjunto de referencia, con Price entries que llevan VIP price y cada combinación de interruptores, el VIP price nunca aparece en el texto. 100% de aprobación.
- **Emparejamiento de negrita**: la vista previa, con los marcadores quitados, es igual a la versión plana de Copy. La negrita cae entre pares leídos de izquierda a derecha, y un `**` final sin pareja se muestra como se tipeó. 100% de aprobación.
- **Forma de lo que pone Copy (criterio 9)**: con un portapapeles simulado, en todo el conjunto de referencia:
  - la parte plana (`text/plain`) es igual al texto de la API con los marcadores emparejados quitados, byte a byte, con los mismos saltos de línea y líneas en blanco y sin ningún `**` emparejado;
  - cuando está la parte enriquecida, es `text/html`, lleva un salto de línea por cada línea de la versión plana, pone negrita solo entre marcadores emparejados, y muestra como texto un `<b>` o un `&` que tipeó el vendedor;
  - sin copia enriquecida disponible (http plano), se escribe solo la parte plana y el toast igual dice "Catalog copied".

  100% de aprobación.
- **Sobrevive al pegado de Telegram (criterio 9)**: el PR lleva una explicación escrita de por qué el resultado sobrevive al análisis del pegado de Telegram iOS. Reproduce el colapso (Markdown en texto plano pegado: `**…**` a negrita, un salto de línea solo a un espacio), descarta otras causas con un texto sin `**`, y cubre un texto con un `**` sin pareja. Un caso que todavía colapsa es un hallazgo que se devuelve, nunca una regla nueva.
- **Se pega como se ve (criterio 9)**: antes del merge, el dueño toca Copy en el iPhone y pega en un chat de Telegram, un chat de WhatsApp y una nota de texto plano. Cada salto de línea y cada línea en blanco coinciden con la vista previa, no se ve ningún `**`, y no hay nada que editar. El resultado se registra en el PR.
- **Share = la versión plana de Copy (criterio 3)**: con una hoja de compartir simulada, 100% de aprobación:
  - Share pasa exactamente la versión plana de Copy, solo como texto;
  - sin ninguna disponible, Share no se muestra y Copy funciona;
  - una resolución y una cancelación no muestran nada;
  - una falla forzada muestra "Could not share." y deja Copy;
  - un compartir que nunca se resuelve no muestra nada, deja Share activado y Copy funcionando, y un segundo toque vuelve a llamar a la hoja de compartir con el mismo texto;
  - una segunda llamada rechazada muestra "Could not share." y deja Copy;
  - un compartir anterior que se resuelve después de un toque más nuevo no muestra nada;
  - Share no escribe nada en el portapapeles en ningún resultado;
  - ningún mensaje lleva texto del Catalog.
- **Share en el iPhone (criterio 3)**: antes del merge, el dueño comparte desde el iPhone por el link HTTPS a un contacto de Telegram, un contacto de WhatsApp y una nota; donde la hoja gira, la cierra y confirma que Share y Copy siguen funcionando. El resultado se registra en el PR, y una hoja que se cuelga solo con cierto contenido es un hallazgo que se devuelve, nunca un cambio en el contenido.
- **Siempre se abre**: la pantalla del Catalog se abre sin nada que califique fuera del primer uso, y "Send catalog" está desactivado solo para un Business anterior al Onboarding que no cumplió los dos pasos obligatorios, mientras nada califica (navigation.md).
- **Dirección**: `/varieties/catalog` abre la pantalla del Catalog, también al recargar; `/catalogo` responde una redirección permanente a ella.
- **Lugar provisorio**: mientras no existan los grupos de Settings, una prueba del front muestra que los Bot settings y el header y el footer se guardan desde ahí, que los dos enlaces lo abren, que no muestra estado del Pinned catalog ni Publish, y que ninguna pestaña, More ni Settings lleva a él.
- **Sin curl (criterio 3)**: la corrida de punta a punta del front edita los atributos de un Product en su página y el header y el footer (en Settings, o en el lugar provisorio hasta que exista), abre Products → "Send catalog" y toca Copy. La parte plana del portapapeles es igual al texto de la API con los marcadores emparejados quitados.
- **Velocidad (criterio 3)**: la pantalla responde en menos de 300 ms con unas decenas de Products, y se abre a 2 toques como máximo desde cualquier Tab root.
- **Aislamiento (criterio 5)**: cada ruta del Catalog está en el barrido y responde 404 o vacío desde otro Business. Los interruptores, el idioma o el Money format de un Business nunca cambian el texto de otro.
- **Sin eco**: ninguna negativa ni línea de log contiene el header, el footer, el Aroma ni el emoji tipeados; después de una corrida completa del front, la consola y el almacenamiento del navegador no tienen ningún texto del Catalog.
- **Diseño**: `scripts/design/compare.sh` corre antes y después para la pantalla del Catalog, en teléfono y computadora, adjunto al PR.
- **El inglés sin cambios (criterio 8)**: cada línea fija movida y los valores por defecto del header y el footer se muestran en inglés exactamente como en `en.baseline.json`; el conjunto de referencia con el Money format por defecto, más el caso vacío, muestra 0 diferencias con lo de antes de la mudanza.
- **Sigue al idioma (criterio 7)**: con un `de` de prueba (`selectable_languages=("en","de")`), un Business guardado como `de` recibe las líneas fijas de `de` desde `GET /catalog`, Test it, Publish y la corrida de comienzo del día del Ticker, mientras que un Business en `en` en la misma corrida sigue idéntico byte a byte a la línea de base. Las pruebas unitarias del dominio arman `CatalogWords` a mano. 100% de aprobación.
- **Sin inglés sobrante**: con el `en-XA` forzado, el texto del Catalog, el texto vacío del Pinned catalog y los valores por defecto que muestra la fuente de valores por defecto contienen, después de quitar los segmentos `⟦…⟧`, los datos guardados y los tokens de plata y gramos, 0 letras; un literal plantado hace fallar el control.

## Fuera de alcance

- El bot de Telegram (Test send, Publish, fijar, token y chats): pinned-catalog.md.
- Quitar los marcadores `**` del `catalog.text` del servidor o de lo que envía el Pinned catalog.
- Cambiar la vista previa "How it looks in Telegram".
- Una versión enriquecida para Share.
- Estados de respuesta o redacciones nuevas para Copy o Share, o decirle al vendedor qué versión se copió.
- Un límite de tiempo para la hoja de compartir, o copiar el Catalog por su cuenta cuando compartir falla o no termina.
- Agregar un título o un link a lo que Share le pasa a la hoja de compartir, o acortar o reescribir su texto para un destino.
- Hacer que un destino de compartir (la extensión para compartir de Telegram o de otra app) termine cuando se cuelga de su lado.
- Un orden propio de Products.
- Restaurar el header o el footer por defecto.
- Reescribir el header o el footer guardados de un Business cuando cambia su idioma, o completar valores por defecto para Businesses existentes.
- Traducir los datos propios del vendedor.
- Cifras de Stock en el texto.
- Escapar o rechazar los marcadores `**` propios del vendedor.
- Actualizaciones en vivo entre socios mientras la pantalla está abierta.
- Editar los Catalog attributes o el header y el footer desde la propia pantalla del Catalog: enlaza a donde se editan.
- Un toast después de compartir.
- Rediseñar los Bot settings o la edición del header y el footer.
- Un VIP price en el Catalog, o un Catalog aparte para los VIP customers.
- Listar Archived products en la pantalla del Catalog.
- La posición del símbolo (siempre antes de la cifra) y un formato de plata propio del Catalog distinto del Money format del Business.

## Planificado en GH-318

Todavía no está construido. Hasta que salga la parte indicada, las secciones de arriba son lo que hace la app.

Cada pasaje nombra el ADR que lo decide, la parte que lo va a entregar y la oración actual que va a reemplazar. La parte que entrega un pasaje lo saca de acá y edita Comportamiento y Fuera de alcance en el mismo diff.

### La plantilla del Catalog

Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; lo entrega la parte de plantilla del Catalog.

- Los bloques, las líneas y su orden entre el header y el footer van a ser propios del Business, guardados por Business. Un Business nuevo va a arrancar con nombre y precio, y el header "**CATALOG**".
- Va a reemplazar: "**Disposición**: el header, después un bloque por cada Product que califica, ordenados por nombre, después el footer." y las líneas fijas "`• Price per gram: <money>`" y "`• From <grams>: <money> each`".

### Atributos que se muestran en el Catalog

Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; lo entrega la parte de categorías.

- Los atributos que define una subcategoría, con, para cada campo, si se muestra en el Catalog, van a ocupar el lugar de los tres fijos. El emoji, el Indica share y el Aroma van a pasar a ser atributos de la única subcategoría del Business migrado, con el texto del Catalog de hoy sin cambios para él. La línea de un atributo archivado va a salir del Catalog y sus valores se van a conservar. Si un Product está oculto va a seguir siendo una marca del Product.
- Va a reemplazar: "### Catalog attributes, por Product" (**Emoji**, **Indica share**, **Aroma/flavor**) y "**Se muestra**: sí o no."

### La Unit

Decidido en docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md; lo entrega la parte de unidades.

- El Catalog, el bot y los reportes van a usar la etiqueta de la Unit de cada Product en lugar de "g".
- Va a reemplazar: "Los gramos enteros se muestran sin decimales; si no, se usa coma decimal (`2,5 g`)." y, en Fuera de alcance, "Un orden propio de Products."

### El día del negocio

Decidido en docs/adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md; lo entrega la parte de zona horaria.

- Va a reemplazar: "tiene un Current price hoy en hora argentina".
