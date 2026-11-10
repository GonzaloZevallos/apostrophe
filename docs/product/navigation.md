## Jobs

**Cuando** manejo mi negocio desde el celular entre pedidos o en medio de un chat con un cliente, varias veces al día, **quiero** la app organizada según lo que de verdad hago y cada cuánto: registrar una venta, ver quién debe y cobrar, mandar el Catalog, registrar el stock que entra. Cada cosa tiene que estar a uno o dos toques. Todo lo de un producto tiene que estar en un solo lugar, cada configuración del negocio en otro lugar único, y las Expenses y el análisis a mano para la mirada semanal o mensual. **para poder** volver con el cliente en vez de buscar entre menús, sin preguntarme nunca cuál de varias pantallas tiene lo que necesito.

Este es el job de navegación que está debajo del job propio "desde mi celular" de cada capacidad (ventas, pagos, stock, Catalog, Expenses). No reemplaza a ninguno. La computadora es el mismo job en una pantalla más grande. El protagonista es quien vende; las herramientas del **Operator** quedan fuera de la app (accounts.md).

**Cuando** abro la app entre pedidos o al final del día, **quiero** ver qué vendí hoy, quién me debe y qué se está terminando, y actuar en el acto (cobrarle a un deudor, abrir un producto que está bajo, arreglar lo que me dice un aviso), **para poder** volver con el cliente sin recorrer Customers y Products uno por uno ni hacer cuentas.

Esto afina el job de navegación y el job del **Panel** de results.md para Home (GH-45); no es un job nuevo. Lo sirven acá "Collect" en las filas de deudores de Home y el aviso de **Out of date** del Pinned catalog, cada uno llevando a su arreglo. Home no muestra ningún elemento de primer uso (results.md).

**Cuando** un cliente me pregunta qué tengo o cuánto sale algo, o entra flor, se termina o cambia de precio, **quiero** abrir un producto y encontrar todo lo suyo en su propia página, que la lista me diga de un vistazo qué tengo, qué se está terminando y qué no puedo vender, y el Catalog de hoy a un toque de esa lista, listo para compartir desde el celular, **para poder** contestarle al cliente, registrar lo que entró y mandar un Catalog al día sin moverme entre pantallas, y que mis clientes nunca reciban un precio viejo ni un producto que no puedo vender.

Esto afina el job de navegación para productos, stock y el Catalog (varieties.md); no es un job nuevo.

**Cuando** un producto que cargué por error, o uno con el que ya no trabajo, sigue apareciendo en mis listas y selectores, **quiero** sacarlo desde el celular en pocos toques, eliminándolo si nunca se movió y archivándolo si tiene historial, **para que** mis listas muestren solo lo que todavía vendo, no cambie ninguna cifra pasada de venta, stock, costo o Profit, y pueda traerlo de vuelta exactamente como estaba si vuelvo a venderlo.

Esto afina el job de productos y navegación para el fin de la vida de un producto (varieties.md); no es un job nuevo. Lo sirven acá la tarjeta Archived y la página del **Archived product**.

**Cuando** necesito cambiar cómo está configurado mi negocio (renombrarlo, sumar un socio, conectar o cambiar el bot de Telegram, editar el **Catalog header and footer**, manejar mis **Expense category**s, pasar a oscuro, cambiar mi contraseña o cerrar sesión), **quiero** cada configuración de todo el negocio en un solo lugar, cada una en su propia pantalla corta, **para poder** cambiarla en pocos toques desde el celular y volver con el cliente, sin preguntarme qué pantalla la tiene.

**Settings** es poco frecuente y deliberado; los jobs diarios nunca lo necesitan. Afina el "cada configuración del negocio en otro lugar único" del job de navegación. Las configuraciones que son de un solo producto viven en su página y no son parte de este job.

**Cuando** me muevo entre pantallas entre pedidos o en medio de un chat con un cliente (Products y la página de un producto, sus precios y sus Stock entries, una **Stock entry**, la ficha de un cliente, Record payment), **quiero** que cada pantalla me dé la misma forma de salir y volver, y que mis links viejos sigan abriendo la pantalla correcta, **para poder** volver con el cliente sin buscar, sin perder mi lugar ni tocar atrás dos veces.

Esto afina el job de navegación y el criterio 5; no es un job nuevo. Su protagonista es quien vende, en el celular o en una computadora. Antes, el formulario de Stock entry decía "Back" donde cualquier otro formulario decía "Close", un registro que ya no existía dejaba dos veces a su pantalla madre en el historial, así que volver llevaba dos toques, y Products y los paths viejos se comportaban distinto del resto de la app al recargar y al redirigir. Quien vendía tocaba atrás de nuevo o usaba la barra.

GH-480 afina el mismo job para la página en sí: una pantalla a la que llego empieza arriba de todo, y volver me deja donde estaba en la pantalla que dejé, como hace una app de celular. Antes, una pantalla nueva se abría en el offset de la pantalla que quedaba atrás, así que una pestaña o un detalle abiertos desde muy abajo en una lista caían en el medio de la pantalla nueva, y volver dejaba a quien vendía donde el navegador lo pusiera. No es un job nuevo; lo sirven "Scroll al cambiar de pantalla (GH-480)" y los criterios 21–23.

**Cuando** saco gramos de mi propio stock sin venderlos (para compartir en una fiesta y que la gente conozca el negocio, o para consumo propio), **quiero** registrarlos desde el celular en pocos toques (fecha, productos y gramos, el motivo), **para poder** mantener el stock bien y ver en el **Profit** cuánto me costó promocionar el negocio y mi propio consumo, sin registrar una venta que nadie hizo ni un **Adjustment** que se lee como flor perdida. (Lo sirve acá "Take from stock" en More, en Products y en la página de un producto, a 2 toques como máximo desde cualquier **Tab root**; definido en stock.md.)

**Cuando** acabo de abrir mi negocio y todavía está vacío, **quiero** que me guíen por lo que necesita, un paso corto por vez, con los valores por defecto ya completos, **para** registrar mi primera venta el mismo día sin buscar entre Settings, Products y la pantalla del Catalog. (Lo sirve acá el **Onboarding** como el único elemento de primer uso de un **Business** recién creado, abierto al aceptar la **Invitation** y en su propia dirección, `/onboarding`; definido en onboarding.md.)

**Cuando** reviso un cambio en las reglas de primer uso que quedan (la línea de precio faltante de "+ New sale" y el "Send catalog" deshabilitado) antes de aprobarlo, **quiero** que los tests y el contrato `/first-run` prueben lo que dicen navigation.md y ADR-0046 en cada estado en que pueden estar y en los dos temas, **para poder** aprobar solo con la evidencia, sin confiar en controles parciales ni arrastrar hallazgos abiertos a la próxima tarea.

- Su protagonista es el mantenedor, o quien revisa en su nombre, como en gate.md, design-capture.md y el criterio 6 de onboarding.md. Quien vende se ve afectado solo de forma indirecta: un head que nadie puede aprobar frena el trabajo que espera.
- Afina el criterio 12 y ADR-0046 (su lugar en Home ya no existe: ADR-0081); no es un job de producto nuevo y no agrega comportamiento de producto.
- Su lado de captura (la fila `InicioHoyCompu`) es de design-capture.md.
- Antes (el seguimiento de GH-45): el test de concordancia llegaba a `/first-run` solo donde se muestra la checklist, la forma de `checklist` fuera del tipo checklist estaba sin decidir, solo el test de la checklist corría en los dos temas, y la captura de Today mostraba una diferencia por construcción.

**Cuando** estoy en medio de atender a un cliente con el celular en la mano, **quiero** que la app se comporte como una app de celular (las pestañas y "+ New sale" a mano, un formulario que llena la pantalla con su acción principal bajo el pulgar, y nada de lo que necesito escondido detrás del teclado o fuera del borde de la pantalla), **para poder** registrar una venta, un pago o stock sin pelearme con la pantalla ni perder lo que tipeé.

- Es un piso de calidad sobre el job de navegación y los jobs de celular del BRIEF (registrar una venta, cobrar un pago, registrar stock, mirar Home), solo por debajo de 900 px (GH-319). No es un job nuevo. La computadora conserva cada capacidad y no recibe nada de esto (**Phone first**).
- Antes: la barra se iba con el scroll de la página, "+ New sale" estaba en el flujo de la página, los formularios eran ventanas superpuestas o páginas con ruta cuya acción podía quedar debajo del pliegue o detrás del teclado, algunos objetivos táctiles y etiquetas eran demasiado chicos, y algunas pantallas se desplazaban de costado. Quien vendía volvía a subir, hacía zoom con los dedos o repetía toques.
- Lo sirven "Disposición en el celular (GH-319)" más abajo y los criterios 19 y 20. El contenido de Analysis (sus tres tablas y su selector de mes) es la parte 2 de GH-319; su marco se cubre acá.

Elegir qué reglas de precio usa el Business (pricing-settings.md) también es de Settings, como el grupo Prices.

Antes de esta estructura: la barra era Home · Sales · Customers · Stock · More; un producto estaba repartido entre Stock, Products y Catalog; cobrar una deuda llevaba cuatro toques desde Customers; las configuraciones estaban repartidas entre Business, Catalog y Expenses → Expense categories, y el bot se configuraba dentro de Catalog. No se conserva nada de eso salvo las redirecciones desde sus paths y, hasta que existan Integrations y Catalog message de Settings, el lugar provisorio para el bot y el Catalog header and footer al que se llega desde la pantalla del Catalog (catalog.md).

# Navigation

La **Navigation** es la única estructura de la app para un Business: las pestañas en el celular, la barra lateral en una computadora, More, Settings, la única regla que le da a cada pantalla su marco y su camino de vuelta, qué lugar queda marcado, las rutas y sus redirecciones, la disposición en el celular (barra fija, "+ New sale" flotante, formularios como **Sheet**s), dónde empieza una pantalla y adónde vuelve atrás en la página, y el primer uso (el Onboarding para un Business recién creado; Home no muestra ningún elemento de primer uso). Dice desde dónde se llega a cada capacidad. Lo que hace cada capacidad queda en su propio archivo; nada de acá cambia una regla de precios, **Settlement**, **Stock**, el **Catalog**, el aislamiento o los mensajes de respuesta. Lo ve solo el Business de la **Session** (ADR-0004).

Criterios de éxito:

1. **Los jobs diarios, por frecuencia.** Desde cualquier Tab root en el celular:
   - una **Sale** se abre en 1 toque ("+ New sale");
   - la Sheet de **Payment** con el **Customer** ya elegido se abre en 2 toques como máximo (Customers → "Collect", o "Collect" directo en Home);
   - la pantalla del Catalog se abre en 2 toques como máximo (Products → "Send catalog");
   - una Stock entry se abre en 2 toques como máximo (Products → "+ Stock entry");
   - un **Stock withdrawal** se abre en 2 toques como máximo (More → "Take from stock", o Products → "Take from stock");
   - una **Expense** se abre en 2 toques como máximo (More → "+ Add expense").

   En una computadora, cada uno no lleva más toques que en el celular.
2. **Cada configuración de todo el Business en un solo lugar.** El nombre, los **User**s y los links para sumarse, las reglas de precio (Bulk price y VIP customers), el bot de Telegram, el Catalog header and footer, las Expense categories, la apariencia y tu cuenta (contraseña, cerrar sesión) están todos en Settings y en ningún otro lado. Se llega a Settings en 2 toques como máximo desde cualquier Tab root: desde el avatar del Business en Home y desde More en el celular, desde la fila del Business de la barra lateral en una computadora. Las configuraciones que son de un solo **Product** viven en el Product, y en ningún otro lado. La única excepción provisoria es el bot y el Catalog header and footer, a los que se llega desde la pantalla del Catalog hasta que existan sus grupos de Settings. Los pasos del Onboarding guardan estas mismas configuraciones a través de sus dueños y no son un segundo lugar para ellas (onboarding.md).
3. **Un Product, una página.** El Stock de un Product y sus movimientos (Stock entries y Stock withdrawals), sus precios, su aviso de Stock bajo y sus **Catalog attributes** se ven y se editan desde su página. Ningún dato se edita en dos lugares con dos nombres.
4. **Nada perdido, nada inventado.** Todo lo que quien vende podía hacer antes sigue a su alcance. La única excepción deliberada es el canal del Customer, que se quita. No existe ninguna opción de Navigation ni pantalla para algo que todavía no está construido: ningún "coming soon", ni promociones, automatizaciones o idiomas. Ningún link apunta a una pantalla que no existe.
5. **Una sola regla para el marco y la vuelta.** Cada pantalla es de uno de tres tipos: Tab root, tarjeta o detalle, formulario o Sheet. Cada tipo recibe su marco por la regla. Atrás sigue el historial, y la pantalla madre es la alternativa.
6. **Legible y accesible.** Las etiquetas de las pestañas siempre se ven. La pestaña activa y cada estado se marcan por forma o palabra, nunca solo por color. La barra entra a 320 px con el texto al 130 %, medido en un navegador real.
7. **Una estructura, dicha una vez.** Los docs del producto, CONTEXT.md, el diseño (`docs/product/design-system/pantallas/`, celular y computadora) y `scripts/design/screens.json` dicen la misma estructura y las mismas rutas.
8. **Settings, grupo por grupo.** Cada grupo es su propia subpantalla con "Close"; salir con cambios sin guardar pregunta primero, y un grupo sin tocar se cierra de inmediato. Renombrar, "Invite a partner", los interruptores de precio, el bot (token, chats, Test it), el Catalog header and footer, las categorías (agregar, renombrar, quitar, incluido el rechazo al quitar), Appearance, cambiar la contraseña y cerrar sesión funcionan todos desde el celular, y la corrida de punta a punta del front pasa por cada grupo.
9. **Marco por tipo, en todas partes.** Cada pantalla, incluidas las de Products (la lista de dos paneles, la página de un Product, sus listas "See all" de precios y de Stock entries, New price, New product, "All entries" y el formulario de Stock entry), es exactamente de un tipo y tiene una pantalla madre. El formulario de Stock entry dice "Close", nunca "Back".
10. **Un solo movimiento atrás.** Atrás o "Close" deja una pantalla en un toque y nunca cae dos veces en la misma pantalla del historial, incluidas las salidas de "That is gone." y Record payment. Sin historial, atrás va a la pantalla a la que pertenece el formulario, la Sheet o la tarjeta.
11. **Cada dirección abre su pantalla.** Recargar cualquier ruta de Products, incluidas las que llevan parámetros, abre la pantalla y nunca la respuesta de la API. Cada path viejo en español, incluidos `/variedades/{id}` y `/mi-stock/entradas/{id}`, responde una redirección permanente a su ruta nueva con el id pasado.
12. **Primer uso, fuera de Home.** Home no muestra ningún elemento de primer uso. El Onboarding se abre solo al aceptar la Invitation de un Business nuevo o en la dirección `/onboarding`.

Criterios de éxito, revisión del primer uso (seguimiento de GH-45):

13. **Aprobado solo con la evidencia.** Una revisión del head que se integra no levanta ningún hallazgo importante sobre el test de concordancia del primer uso, la forma de `checklist`, su cobertura de temas o la captura de Today, y ninguno se arrastra a otra tarea.
14. **Una respuesta rota hace fallar un test.** En cualquier estado alcanzable (sin Product; con precio sin Stock; con Stock sin precio; agotado; que califica; checklist ida), un test falla si el `nothing_qualifies` de `/first-run` no es exactamente "el tipo es la checklist y `GET /catalog` no tiene texto", o si sus pasos de checklist no concuerdan con los datos.
15. **Una sola forma para `checklist`.** Su forma fuera del tipo checklist se escribe una vez, acá. La API, `contract.json` y el front concuerdan en ella, y un test la fija.
16. **Los dos temas.** Cada test de las reglas laterales de primer uso (el Shell y Products) corre en claro y en oscuro.
17. **La captura dice la verdad.** `InicioHoyCompu` se compara contra su propia sección nombrada (design-capture.md).
18. **Nada de lo que ve quien vende cambia, y ningún test se afloja.** Este archivo, results.md y cada pantalla se leen y se comportan como antes; cada suite pasa; los tests editados conservan cada aserción que tenían; los cambios del registro quedan dentro de sus costuras declaradas.

Criterios de éxito, la disposición en el celular (GH-319). Se verifican a 320, 360 y 390 px. El contenido de Analysis los cumple en la parte 2 de GH-319; su marco los cumple acá. La velocidad es el criterio 1 junto con la medida del BRIEF: la cantidad de toques hasta una Sale guardada no cambia, y una Sale se sigue registrando desde el celular en menos de un minuto.

19. **Nada de lo necesario queda fuera de alcance en el celular.**
    - En los Tab roots, la barra y "+ New sale" quedan a la vista en cualquier posición de scroll. En tarjetas y detalles solo se muestra la barra, y en formularios y Sheets no se muestra ninguna de las dos.
    - Mientras hay un teclado de texto abierto, la barra y el botón se ocultan y no se pueden tocar, y nada se corre cuando vuelven.
    - La acción principal de una Sheet, y cualquier error sobre ella, queda fija y visible abajo. Los tres formularios que conservan la ventana superpuesta vieja (abajo) son una excepción con nombre.
    - Ninguna página es más ancha que la pantalla, hasta 246 px, con datos extremos.
    - Los nombres largos se cortan con puntos suspensivos. Una cifra nunca se parte, y "$" nunca queda solo en una línea.
    - Cada objetivo táctil mide al menos 44×44, y ningún texto está por debajo de 12 px.
20. **Nada de lo tipeado o encontrado se pierde, y la computadora no se toca.**
    - Girar el celular o cambiar el tamaño cruzando 900 px conserva lo tipeado.
    - Cerrar una Sheet abierta desde una lista desplazada vuelve a la misma posición de scroll.
    - Tocar fuera de una Sheet nunca descarta trabajo y nunca agrega una confirmación. Donde hay un área visible fuera de ella, un toque ahí la cierra solo cuando no se cambió nada. Una Sheet de celular a pantalla completa no tiene afuera: la franja de área segura junto a la barra de estado nunca cuenta como afuera.
    - Las disposiciones de computadora salen con capturas sin cambios, incluido el diálogo modal de precio de ADR-0044.

Criterios de éxito, scroll al cambiar de pantalla (GH-480). Se verifican a 320, 375 y 430 px y en una computadora.

21. **Una pantalla nueva empieza arriba.** Cada movimiento hacia adelante a otra pantalla (una pestaña de la barra o de la barra lateral, una opción de More, "+ New sale", un link, una fila de lista hacia su tarjeta o detalle, una redirección) muestra esa pantalla desde arriba, sea cual sea el offset de la pantalla que quedó atrás.
22. **Atrás devuelve al lugar.** El atrás del celular o del navegador, "‹ <parent>" cuando pasa por el historial, y "Close" de un formulario o Sheet abierto desde dentro de la app vuelven todos a la pantalla anterior en el offset que tenía cuando se la dejó. Esto incluye New sale abierta desde "+ New sale" y Record payment abierto desde "Collect" o "Record payment". Sin historial, la pantalla madre alternativa se abre arriba.
23. **Una Sheet o una ventana superpuesta no mueve la página.** Abrir y cerrar cualquier Sheet, con ruta o dentro de la página, cualquier confirmación o ventana superpuesta, y cualquier toast deja la pantalla de abajo en el mismo offset. El offset se juzga en la pantalla real una vez que la Sheet o el diálogo se cierra, por Close, atrás o un guardado. Una imagen inerte de la pantalla dibujada detrás de un diálogo de computadora (`InicioFondo` de Home detrás de Record payment) no tiene que respetar ese offset mientras el diálogo está abierto.

## Comportamiento

### Pestañas (celular)

- **La barra**: Home · Sales · Customers · Products · More, en ese orden. Las pestañas son objetos, elegidos según cuánto se usan. Está fija abajo de la pantalla (Disposición en el celular).
- **"+ New sale"** flota justo arriba de la barra en los Tab roots, aparte de las pestañas, y abre directamente el formulario de Sale (sales.md). No es una pestaña.
- **Etiquetas**: siempre se ven, de al menos 12 px; ninguna pestaña es solo un ícono.
- **La pestaña activa** se marca con algo más que color: un ícono relleno o un subrayado, y `aria-current` en el elemento.
- **Entra**: la barra, "Products" incluida, entra a 320 px de ancho de viewport con el texto al 130 %, medido en un navegador real.

### Barra lateral (computadora)

- Desde arriba: "+ New sale"; Home, Sales, Customers, Products; un divisor; Expenses, Analysis.
- Abajo: el nombre del Business con su avatar, que abre Settings (como lo dibuja `InicioCompu`).
- No hay More en una computadora. Al formulario de Stock withdrawal se llega desde el "Take from stock" secundario de Products y desde la página de un Product.
- **Dos paneles**: Customers y Products muestran la lista a la izquierda y la ficha del Customer o la página del Product elegidos a la derecha. Products abierto sin nada elegido elige el primer Product sin archivar por nombre (varieties.md); eso cuenta como ningún toque. Archived usa los mismos dos paneles y elige el primer Archived product por nombre. Customers no elige nada por su cuenta.
- **Dos paneles e historial**: en una computadora, elegir una fila del panel izquierdo reemplaza la entrada actual del historial, y lo mismo hace la selección automática del primer Product de Products. Atrás desde cualquiera de las dos pantallas la deja en un paso, nunca uno por fila mirada. En el celular, abrir un Product o un Customer agrega una entrada al historial, y atrás vuelve a la lista.

### More (celular)

- En orden: "+ Add expense" (abre el formulario de Expense con la fecha de hoy, expenses.md), "Take from stock" (abre el formulario de Stock withdrawal con la fecha de hoy y sin Product elegido, stock.md), Expenses, Analysis, Settings.
- "+ Add expense" y "Take from stock" van arriba porque son las cargas sin un camino más corto desde cada Tab root.
- Nada más: una opción aparece solo una vez que existe lo que abre. No hay ninguna opción para el Onboarding.

### Settings

- **Una pantalla que reúne cada configuración de todo el Business, en grupos, y nada más.** Los grupos, en este orden (el comportamiento de cada grupo es de su dueño):
  - **Business**: el nombre del Business (accounts.md). Toast "Business renamed".
  - **Users**: los socios por email, ordenados por email, el que inició sesión marcado "you", e "Invite a partner", que crea un link nuevo para sumarse por toque, para copiar o compartir (accounts.md). Sin lista de Invitations, sin revocar, sin roles.
  - **Prices** (pricing-settings.md), en `/settings/prices`:
    - los dos interruptores, Bulk price y VIP customers;
    - "Save the prices", y el toast "Prices saved";
    - la línea fija de que las Sales pasadas conservan su precio y que desactivar no borra nada, y la línea fija de ayuda bajo el interruptor VIP.
  - **Integrations**: el bot de Telegram (pinned-catalog.md):
    - el token, el chat del canal, el chat propio, y Test it, la única forma en que se guardan;
    - después de un cambio de token o de canal, "The previous pinned message stays as it is; unpin it yourself in Telegram.";
    - un link simple a la pantalla del Catalog, para publicar, sin ningún estado. Publish y el estado del fijado están solo en la pantalla del Catalog.
  - **Catalog message**: el Catalog header and footer (catalog.md). Toast "Catalog saved".
  - **Expense categories**: agregar, renombrar y quitar, incluido el rechazo al quitar (expenses.md).
  - **Appearance**: el tema, Light o Dark, bajo la regla de tema de accounts.md (Dark pone `data-tema="oscuro"`, Light lo quita).
    - Un toque aplica y recuerda la elección en el dispositivo de inmediato: sin guardar, sin toast, sin aviso de cambios sin guardar.
    - La elección actual se marca por palabra o forma y `aria-checked`, nunca solo por color.
    - Language no tiene opción hasta que exista.
  - **Your account**: "Change password" arriba de "Sign out" (accounts.md). Nada nuevo.
- **Desde dónde se llega**: el avatar del Business arriba de Home; More en el celular; la fila del Business de la barra lateral en una computadora. `/settings` marca More como pestaña activa en el celular.
- **La lista de grupos** es una tarjeta: la barra o la barra lateral y una flecha de regreso, sin "+ New sale". Atrás sigue el historial; sin historial, va a "‹ More" en el celular y a "‹ Home" en una computadora.
- **Cada grupo** es su propia subpantalla, un formulario: "Close", sin barra, sin "+ New sale"; los cambios sin guardar preguntan antes de descartar, y un grupo sin tocar se cierra de inmediato. Appearance nunca tiene cambios sin guardar, así que siempre se cierra de inmediato.
- **Business vacío**: cada grupo funciona. Users lista al menos al User que inició sesión; Prices muestra los dos interruptores como están (apagados para un Business nuevo); Expense categories sin ninguna muestra una lista vacía y la acción de agregar; Integrations sin nada guardado muestra campos vacíos y ninguna línea "Saved".
- **Nunca acá**: las configuraciones propias de un Product (Catalog attributes, **Low-stock threshold**, sus precios, incluido su VIP price) o su archivado, que viven solo en su página y en Archived (varieties.md); nada para el Operator (ADR-0002); un grupo o marcador de lugar para algo no construido; una opción para volver a correr el Onboarding.
- **En ningún otro lado**: la vieja pantalla Business ya no existe; la pantalla del Catalog no edita el Catalog header and footer (su "Edit header and footer" abre Catalog message); Expenses no tiene opción de categorías, salvo crear una dentro del formulario de Expense (expenses.md); a los interruptores de precio no se llega desde ninguna página de Product, formulario de precio ni formulario de Customer. Los pasos del Onboarding guardan las mismas configuraciones a través de sus dueños, nunca una copia (onboarding.md).
- **Excepción provisoria, hasta que existan Integrations y Catalog message**: los **Bot settings** y el Catalog header and footer siguen editables, exactamente como antes, en un lugar provisorio al que se llega solo desde la pantalla del Catalog ("Edit header and footer" y el link "unavailable" de Publish). Es un formulario ("Close" vuelve por el historial, si no a la pantalla del Catalog; confirmación al salir con cambios sin guardar), sin pestaña, opción de More, grupo de Settings ni marca de "coming soon", y sin estado del fijado ni Publish. La pantalla del Catalog en sí sigue sin editar nada; manda afuera con un link. El issue propio de Settings reapunta los dos links y quita el lugar provisorio.

### Marco y camino de vuelta: una sola regla

Cada pantalla es exactamente de uno de tres tipos, tiene una sola pantalla madre y recibe su marco solo de su tipo.

- **Tab root**: Home, Sales, Customers, Products, Expenses, Analysis y More. Muestra la barra (o la barra lateral) y "+ New sale". A Expenses y Analysis se llega desde More en el celular y desde la barra lateral en una computadora.
- **Tarjeta o detalle**: la ficha de un Customer, la página de un Product, la página de un Archived product ("‹ Archived"), la tarjeta Archived ("‹ Products"), el detalle de una Sale, una Expense, el detalle de un Stock withdrawal, la pantalla del Catalog, "All entries", cada lista "See all" de la página de un Product (sus Stock entries y Stock withdrawals, y sus precios), y la lista de grupos de Settings.
  - Muestra la barra (o la barra lateral) y una flecha de regreso "‹ <parent>" que nombra la pantalla a la que vuelve. El detalle de un Stock withdrawal vuelve a la pantalla desde la que se abrió, y a Products sin historial.
  - Nunca muestra "+ New sale". La ficha de un Customer lleva solo "New sale to <name>".
- **Formulario o Sheet**: New sale y Pick a customer, Record payment, el formulario de Customer (nuevo, `/customers/new`, y edición, `/customers/{id}/edit`), el formulario de Stock entry (nuevo o edición, `/varieties/entries/{id}`), el formulario de Stock withdrawal ("Take from stock", nuevo o edición), el formulario de **Price entry**, el formulario de Expense, agregar y renombrar un Product, el formulario del aviso de Stock bajo y el formulario de Catalog attributes de un Product, cada grupo de Settings, cada paso del Onboarding y su pantalla de cierre "Done", y el lugar provisorio para el bot y el Catalog header and footer mientras exista.
  - No muestra ni la barra ni "+ New sale". Se cierra con "Close", nunca con otra palabra como "Back".
  - Salir con cambios sin guardar pregunta antes de descartar. New sale conserva su propio "Discard the sale?" (sales.md); cada otro formulario o Sheet pregunta de la misma manera con su propio texto fijo.
  - Un formulario o Sheet sin tocar se cierra de inmediato.
  - En el celular, los formularios listados en "Disposición en el celular" los dibuja como Sheets el único `Sheet` compartido.
  - El "Close" del Onboarding cae en Home y conserva su punto de retomar; New sale abierta desde "Done" vuelve a Home, nunca a "Done" ni al Onboarding (onboarding.md).
- **Abierto desde dentro de la app, un formulario o Sheet es una entrada en el historial de la app.** Eso cubre cada forma de entrar: "+ New sale" en la zona de la barra y en la barra lateral, "New sale to <name>", "Collect" y "Record payment", y cada acción "+" y de edición. Su "Close" y atrás son entonces un paso atrás hasta la pantalla desde la que se abrió, nunca un salto a su pantalla madre fija. La pantalla madre fija es solo la alternativa para un formulario abierto con un link directo.
- **Atrás** sigue el historial de la app y sale en un movimiento; nunca cae dos veces en la misma pantalla. Sin historial (un link abierto directamente), va a la pantalla madre nombrada por "‹", o para un formulario o Sheet a la pantalla a la que pertenece:

| Pantalla | Atrás sin historial va a |
|---|---|
| New sale | Sales |
| New product | Products |
| New price | la página de ese Product |
| Formulario de Stock entry, nuevo | Products |
| Formulario de Stock entry, edición | "All entries" |
| Formulario de Customer, nuevo | Customers |
| Formulario de Customer, edición | la ficha de ese Customer |
| Record payment | Customers |
| Formulario de Expense, nuevo | Expenses |
| El "See all" de precios o de Stock entries de un Product | la página del Product |
| "All entries" | Products |
| Formulario de Stock withdrawal, nuevo | Products |
| Formulario de Stock withdrawal, edición | el detalle de ese Stock withdrawal |
| El detalle de un Stock withdrawal | Products |
| Archived | Products |
| La página de un Archived product | Archived |
| Un paso del Onboarding o "Done" | Home |

- **Salir porque el registro ya no existe es el mismo movimiento que "Close".** Cuando guardar, eliminar o deshacer en el formulario de Stock entry, el formulario de Customer o Record payment da con un registro que ya no existe, la pantalla vuelve un paso en el historial cuando se abrió desde dentro de la app, o a su pantalla madre cuando se abrió con un link directo. La lista se actualiza y se muestra "That is gone. The list is up to date.", como lo define accounts.md. Nunca se duplica una entrada del historial.
- **"Collect from <name>"** en una fila de deudor (Customers o Home) abre Record payment con ese Customer elegido, como una entrada en el historial de la app; atrás o "Close" lo cierra en un movimiento, de vuelta a la pantalla de la que vino.

### Disposición en el celular (GH-319)

Solo por debajo de 900 px. Cada regla de acá rige bajo ese corte. Las disposiciones de computadora, incluido el diálogo modal de precio de ADR-0044, quedan exactamente como están. El contenido de Analysis (sus tres tablas y su selector de mes) es la parte 2 de GH-319; por ahora solo su marco sigue esta sección.

- **Barra fija**: la barra está fija abajo de la pantalla en los Tab roots y en tarjetas y detalles, respetando los márgenes del dispositivo.
- **"+ New sale" flotante**: flota junto con su línea de "qué falta" justo arriba de la barra, solo en los Tab roots. Los formularios y las Sheets no muestran ni la barra ni el botón.
- **Espacio de abajo**: el contenido nunca termina debajo de la barra o del botón, y la última fila se ve entera arriba de ellos. Un solo valor de espacio de abajo (`--bottom-chrome-height`) maneja tres cosas: el relleno del contenido, la posición del botón y la posición del toast. Ninguna regla fija esas alturas en el código. La ficha de un Customer fija su "New sale to <name>" arriba de la barra a partir del mismo valor.
- **Teclado**:
  - Siempre que hay un teclado de texto abierto, en cualquier Tab root o tarjeta con un campo de texto (la búsqueda de Customers, la búsqueda o los filtros de Sales, y el resto), la barra y el botón se ocultan y no se pueden tocar. Nunca se empujan arriba del teclado.
  - El relleno no cambia, así que nada se corre. Cerrar el teclado trae de vuelta a los dos con el texto tipeado y la posición de scroll sin cambios.
  - El zoom con los dedos nunca cuenta como teclado abierto. Tampoco un control de fecha, hora, select, checkbox, radio, rango, color, archivo o botón: esos dejan la barra en su lugar.
  - Funciona en iOS, en Android y sin la API de visual viewport. Solo `useVisualViewport` lo decide, mediante una sola función pura (ADR-0028 tal como se enmendó). New sale conserva su comportamiento de formulario fijo.
- **Toasts**: solo cambia su posición, nunca su duración ni cómo se descartan.
  - Se ubican arriba de la barra y del grupo "+ New sale" en los Tab roots, arriba de la barra en tarjetas y detalles, y arriba de la acción fija en una Sheet. Un toast nunca tapa una acción principal.
  - Después de que un guardado cierra una Sheet, el toast se muestra en su lugar en la pantalla a la que vuelve quien vende.
- **Sheets**:
  - Un solo `Sheet` compartido dibuja cada formulario de celular listado abajo. Es un diálogo modal a pantalla completa con "Close" arriba, y el fondo no se desplaza.
  - El foco va al primer campo habilitado (incluida la primera opción de un grupo de opciones), o a un campo que el formulario nombre.
  - La acción principal está en un contenedor de acciones fijo abajo del formulario, dentro del formulario. Los errores y las acciones destructivas van arriba de la acción principal, y nada se dibuja debajo de ella.
  - La altura de la Sheet sigue el viewport visible, así que el teclado no tapa la acción.
  - El árbol de elementos del formulario es el mismo en celular y computadora, así que un cambio de tamaño cruzando 900 px o un giro conserva lo tipeado.
- **Atrás y Close en una Sheet**: el gesto de atrás del celular es la misma acción que "Close".
  - Sin nada cambiado, la Sheet se cierra y quien vende vuelve a donde la abrió, en la misma posición de scroll.
  - Con algo tipeado, aparece la confirmación de salida que ya tiene el formulario, exactamente como antes.
  - Las ediciones en línea de la página de un Product cierran primero su Sheet y nunca saltan por encima de la página.
- **Tocar afuera**:
  - En el celular una Sheet llena la pantalla y no tiene afuera. La franja de área segura junto a la barra de estado no cuenta como afuera: un toque ahí no hace nada, esté la Sheet tocada o no. No se agrega ningún hueco ni fondo visible para crear un afuera. "Close" y atrás son las únicas salidas de una Sheet de celular.
  - Donde sí hay un área visible fuera de un diálogo (los diálogos que ya existen en la computadora), un toque ahí cierra un diálogo sin tocar y no hace nada en uno tocado. Esos marcos de computadora conservan su comportamiento de fondo exactamente como hoy; esta parte no los edita.
  - En cualquier lado, tocar afuera nunca descarta trabajo, nunca abre un diálogo, y ningún formulario gana una confirmación nueva.
- **Qué hay detrás de una Sheet**:
  - Abierto desde dentro de la app, la pantalla de atrás es aquella desde la que se abrió el formulario. Una Sheet dentro de la página (las ediciones en línea de un Product, editar una Expense) tiene su propia pantalla detrás.
  - Abierto con una dirección directa, un formulario con ruta muestra su Sheet sobre la pantalla madre de la tabla de atrás sin historial. Esa pantalla madre es inerte y queda oculta para la tecnología de asistencia, sin marco, sin título y sin ids, y no muestra nada mientras sus datos cargan o faltan.
  - Las rutas, los tipos y las pantallas madre no cambian.
- **Formularios dibujados como Sheets**:
  - Record payment;
  - el formulario de Price entry (solo en el celular; su diálogo modal de computadora es el de ADR-0044);
  - el formulario de Customer, nuevo y edición;
  - el formulario de Expense, nuevo y edición;
  - el formulario de Stock entry, nuevo y edición;
  - el formulario de Stock withdrawal, nuevo y edición;
  - New product;
  - el renombrar, el formulario del aviso de Stock bajo y el formulario de Catalog attributes de un Product.
- **Excepción conocida**: Change password, el editor de Expense categories y la ventana superpuesta de Customer nuevo de New sale conservan la ventana superpuesta vieja en el celular, sin acción fija. El ADR del `Sheet` (ADR-0062) los nombra. Es una excepción a la acción fija del criterio 19, no una falla de él.
- **El foco de Record payment**: en el celular, abrirlo pone el foco en su primer campo, no en su título; su diálogo modal de computadora sigue enfocando el título. Cerrar sigue devolviendo el foco al "Collect" o "Record payment" que se tocó (payments.md).
- **La elección de pago de New sale**:
  - La elección Cash / Transfer / Owing sigue visible arriba de la franja inferior del formulario de Sale.
  - Save nunca se deshabilita. No parece listo hasta que se hace una elección: hasta entonces se dibuja como botón secundario y después como botón principal.
  - Un toque en Save antes de la elección hace lo que hacía antes: la línea nombra lo que falta. La cantidad de toques hasta una Sale guardada no cambia.
- **Entra**: ninguna página es más ancha que el viewport a 320 y 246 px con datos extremos. Los nombres largos se cortan con puntos suspensivos, una cifra nunca se parte, y "$" nunca queda solo en una línea. La regla de orden por mes de Expenses rige solo para Expenses.
- **Objetivos táctiles y texto**: cada objetivo táctil mide al menos 44×44 y ningún texto está por debajo de 12 px. Esto incluye:
  - New product;
  - el Skip y el Skip the rest del Onboarding;
  - Categories, Integrations y Edit header and footer;
  - Owed to you;
  - las flechas de mes;
  - el interruptor de Stock bajo.
- **Ayuda del teclado**:
  - El login sugiere el usuario y la contraseña actual.
  - Change password y la página de reseteo sugieren la contraseña nueva y la actual.
  - La búsqueda de Customers es un campo de búsqueda con una tecla de buscar en el teclado.

### Scroll al cambiar de pantalla (GH-480)

En el celular y en una computadora por igual. Una pantalla es el path de su ruta. Un cambio de profundidad de una Sheet (ADR-0027), o una Sheet con ruta que se abre sobre la pantalla desde la que se abrió, no es un cambio de pantalla. Tampoco lo es elegir una fila en los dos paneles de una computadora.

- **Llegar empieza arriba.** Cada movimiento hacia adelante a otra pantalla la muestra desde arriba, sea cual sea el offset de la pantalla que quedó atrás. Un movimiento hacia adelante es una pestaña de la barra o de la barra lateral, una opción de More, "+ New sale", un link, una fila de lista hacia su tarjeta o detalle, una redirección, o el avatar del Business hacia Settings.
- **Volver devuelve al lugar.** Todos estos son un movimiento atrás, y cada uno vuelve a la pantalla anterior en el offset que tenía cuando se la dejó:
  - el gesto de atrás del celular o el atrás del navegador;
  - "‹ <parent>" cuando pasa por el historial;
  - "Close" de un formulario o Sheet abierto desde dentro de la app (Marco y camino de vuelta).

  El offset se aplica una vez que cargó el contenido de la pantalla, nunca antes sobre una pantalla que está cargando. Cuando el contenido ahora es más corto, la pantalla cae lo más abajo que llega. El adelante del navegador hace lo mismo para la pantalla a la que vuelve.
- **Una alternativa es una llegada.** Sin historial (un link abierto directamente), atrás, "‹" o "Close" va a la pantalla madre nombrada en la tabla de atrás sin historial, y esa pantalla madre empieza arriba.
- **New sale y Record payment no son una excepción.**
  - "Close" o atrás desde New sale abierta con "+ New sale" vuelve a la pantalla desde la que se abrió, en su offset. "Discard the sale?" sigue preguntando primero cuando se tipeó algo (sales.md).
  - "Close" o atrás desde Record payment sin guardar vuelve a la pantalla de abajo en su offset. Su guardado conserva ese lugar por la regla propia de payments.md ("Volver donde estabas").
  - Un Record payment abierto y cerrado sin guardar no deja nada atrás que cambie dónde cae la próxima apertura o cierre.
- **Las Sheets y las ventanas superpuestas no mueven la página.** Ninguna de estas mueve nunca la pantalla de abajo, y cerrar vuelve al mismo offset (criterio 20):
  - abrir o cerrar una Sheet, con ruta o dentro de la página;
  - una confirmación;
  - las ventanas superpuestas viejas (Change password, el editor de Expense categories, la ventana superpuesta de Customer nuevo de New sale);
  - un toast.

  Lo que cuenta es la pantalla real una vez que la Sheet o el diálogo se cierra, por Close, atrás o un guardado. En una computadora, un diálogo con ruta puede dibujar una imagen inerte de la pantalla de atrás, como `InicioFondo` de Home detrás de Record payment. Esa imagen no tiene que respetar el offset de la pantalla mientras el diálogo está abierto, y no se vuelve a dibujar para que coincida: todo lo que quien vende lee y hace está en el diálogo (**Drawing as guide**), y la computadora no recibe pulido dedicado (Phone first).
- **Dos paneles son una sola pantalla.** En una computadora, elegir una fila en los dos paneles de Customers o de Products, o la selección automática del primer Product de Products, nunca mueve la lista que quien vende está mirando.
- **El scroll propio de una pantalla sigue siendo suyo.** Un scroll deliberado que una pantalla ya hace (el propio de Home, la vuelta de Record payment después de un guardado) no lo cambia esta sección.
- **Solo en memoria.** Los offsets se recuerdan solo mientras la app está abierta en esa pestaña. Nunca se escriben en el almacenamiento del navegador (ADR-0026) y nunca se guardan junto con datos de ningún Business. Una recarga los olvida, y una pantalla a la que se llega con atrás después de una recarga empieza arriba.

### Rutas

- La ruta de cada pantalla está en inglés: `/sales`, `/customers`, `/varieties`, `/expenses`, `/analysis`, `/settings`, `/settings/prices`, `/more`, y lo mismo para cada otra pantalla. El formulario de Stock withdrawal es `/withdrawals/new` (y `/withdrawals/{id}/edit`), el detalle de un Stock withdrawal `/withdrawals/{id}`. Cada pantalla se registra una vez, con su tipo y su pantalla madre, en `scripts/design/screens.json`, que fija su path exacto; se incluyen cada grupo de Settings, cada paso del Onboarding y "Done", y también `/customers/new`, `/customers/{id}/edit` y `/varieties/entries/{id}`.
- **Products** y sus pantallas: `/varieties`, `/varieties/{id}`, `/varieties/catalog` (la pantalla del Catalog), `/varieties/entries` ("All entries"), `/varieties/entries/new`, `/varieties/entries/{id}` (editar una Stock entry), `/varieties/{id}/entries` (las Stock entries de un Product, la misma lista filtrada a él, con los Stock withdrawals que lo tocan, "‹ <product>"), `/varieties/{id}/prices`, `/varieties/{id}/prices/new`, `/varieties/new` y `/varieties/archived` (la tarjeta Archived). La página de un Product es de solo lectura cuando el Product está archivado. `{id}` es el id propio del Product o de la Stock entry. Recargar cualquiera de ellas abre la pantalla, nunca la respuesta de la API, y las llamadas propias del front a la API siguen llegando a la API.
- **Campos personalizados** (dibujados en `docs/design/campos-personalizados/`, construidos por #394 y #395; todavía no construidos, así que sus filas en `scripts/design/screens.json` tienen `route: null`): los campos personalizados de una categoría viven bajo esa categoría, junto a Categories en `/settings/products/categories`. En `screens.json` los ids son números concretos de ejemplo (`1` para la categoría y para el campo); acá `:category` es un id de categoría y `:field` un id de campo. La lista es `/settings/products/categories/:category/fields`; su Sheet de campo nuevo es `.../fields/new`; la Sheet de un campo numérico es `.../fields/:field`; sus valores de lista son `.../fields/:field/values` y archivar un valor es `.../fields/:field/values/archive`; copiar un campo a las hojas hermanas es `.../fields/apply-to-siblings`; copiar los campos de otra categoría es `.../fields/copy`. Cada gemelo oscuro tiene el path de su pantalla clara, y las dos pantallas de computadora tienen el path de su pantalla de celular.
- Cada path viejo en español redirige de forma permanente a su ruta nueva, cada uno probado uno por uno, con el id del registro pasado:
  - `/ventas`, `/clientes`, `/mi-stock`, `/mi-stock/nueva-entrada`, `/mi-stock/entradas/{id}` (a `/varieties/entries/{id}`), `/variedades`, `/variedades/{id}` (a `/varieties/{id}`), `/catalogo`, `/gastos`, `/mas`, y cada otro, incluido el path de la vieja pantalla Owed to you, que va a Customers;
  - `/negocio` va a Settings;
  - el path viejo de Expenses → Expense categories (`/gastos/categorias`) va a Settings → Expense categories.
- Cada destino de redirección es una pantalla registrada. El servidor responde cada path viejo mediante un solo mecanismo de redirección; el front no tiene redirecciones propias.
- El Catalog viejo no tenía paths aparte para el bot ni para el header y el footer, así que nada redirige a Integrations ni a Catalog message. Prices es nuevo, así que nada redirige a él.
- Una dirección desconocida o mal tipeada va a Home (`/`), como siempre. Un path del Onboarding abierto para un Business cuyo Onboarding terminó, o que nunca tuvo uno, también va a Home. Una tarea posterior que quite un path sin equivalente decide adónde va ese path.
- Ninguna ruta lleva un Business (ADR-0004); se permite el id propio de un registro en un path. `/invitation/{token}` y `/reset/{token}` quedan como están (accounts.md).
- El texto de pantalla sigue en español rioplatense; solo cambian las rutas.

### Rutas para pantallas que todavía se van a rehacer

Esto cubre Settings y sus grupos, la pantalla del Catalog y la página de un Product, cuyas pantallas rehacen sus propios issues.

- Una ruta muestra la pantalla o el contenido existente que hoy tiene esa función, dentro del marco nuevo. Por ejemplo, `/settings/users` muestra la lista de Users de hoy e "Invite a partner".
- Una ruta sin nada existente detrás no se registra. La agrega el issue que construye esa pantalla.
- Ninguna ruta dibuja una página vacía, un marcador de lugar ni "coming soon".
- Cada función a la que llega quien vende hoy sigue siendo alcanzable desde alguna ruta registrada. Si una función fuera a perder su única forma de entrar, su ruta se registra con el contenido de hoy.

### Primer uso

- **Home no muestra ningún elemento de primer uso**: ni el aviso del Onboarding, ni una checklist, ni "Start with your products", ni un aviso posterior a la **Spreadsheet import**. Home no lee `/first-run` ni `/onboarding-progress`, y es el Panel de results.md para un Business en cualquier estado de su configuración (ADR-0081).
- **El Onboarding** es el único elemento de primer uso, para un Business abierto con una Invitation de Business nuevo después de que salió (onboarding.md). Una vez que la Spreadsheet import carga un Business, su Onboarding terminó.
- No hay tour ni pantalla de bienvenida más allá de él.
- **El estado de primer uso es del Business.** Cada User de él comparte el mismo estado: un User que se sumó con una Invitation para sumarse comparte el del Business al que se sumó, o ninguno. Una Invitation para sumarse nunca abre un Business, así que nunca arranca un primer uso propio.
- **Qué se guarda**: el estado propio del Onboarding (ADR-0036) nunca se copia. Además de él, se guardan solo tres hechos del Business:
  1. que el Business lo cargó la Spreadsheet import, y cuándo. Solo la Spreadsheet import lo escribe, dentro de su único commit, y nunca se borra ni se mueve (import.md). Termina el Onboarding del Business. Un Business importado antes de que existiera este hecho no tiene ninguno, y no se completa hacia atrás;
  2. que la checklist se fue para siempre;
  3. que se descartó el aviso posterior a la Spreadsheet import. Ya no lo lee ninguna pantalla; quitarlo es una decisión aparte (ADR-0081).

  Ninguno guarda datos personales. Ningún paso de la checklist se guarda nunca como tildado.
- **Las reglas laterales** siguen, sin ninguna pantalla que las anuncie. Rigen para un Business que existía antes de que saliera el Onboarding y que todavía no cumplió los dos pasos obligatorios, y valen para cada User de él:
  - los pasos, calculados a partir de los datos del Business en el momento, nunca de una marca guardada: (1) un Product con **Current price** hoy (obligatorio); (2) cualquier Stock entry (obligatorio); (3) el **Pinned catalog** publicado al menos una vez y (4) un segundo User en el Business, ambos opcionales y que nunca las retienen;
  - se van para siempre la primera vez que los pasos 1 y 2 están cumplidos los dos, y nunca vuelven, aunque la condición de un paso obligatorio después vuelva a ser falsa (por ejemplo, se elimina la única Price entry);
  - mientras rigen, "+ New sale" sigue visible y, sin ningún Product con precio hoy, dice en palabras qué falta;
  - mientras rigen y nada califica para el Catalog, "Send catalog" está deshabilitado con su motivo en palabras (p. ej. "Add a product with a price and its stock"). Es la única vez que se deshabilita (catalog.md). El link de Integrations a la pantalla del Catalog nunca se deshabilita;
  - un Business recién creado y un Business importado no las tienen: el primero tiene el Onboarding, el segundo llega con precios y Stock.
- Qué regla rige, y cada paso, lo responde el servidor para el Business de la Session.

### Qué responde `/first-run`, y cómo se prueba (seguimiento de GH-45)

- **Quién lo lee**: solo el Shell ("+ New sale", la línea de precio faltante) y Products ("Send catalog" deshabilitado). Home no lo lee. El endpoint conserva su respuesta tal como está (ADR-0046); `POST /first-run/import-notice/dismissal` y el indicador `import_notice` no tienen lector, y quitarlos es una decisión aparte (ADR-0081).
- **La forma de `checklist`**: fuera del tipo checklist (el aviso del Onboarding, "Start with your products", ninguno), `checklist` es una lista vacía `[]`, nunca `null`. El indicador `import_notice` es independiente y nunca la cambia. Esta es la única declaración de la forma: el plan, el esquema de la API y el front la leen, y el verificador del contrato no cambia. El front lee la regla lateral solo cuando el tipo dice checklist, nunca porque la lista tenga elementos.
- **`nothing_qualifies`** es verdadero exactamente cuando el tipo es la checklist y el Catalog no tiene texto para enviar; en cualquier otro tipo es falso, tenga lo que tenga el Catalog. Lo lee solo la regla que deshabilita "Send catalog", y fuera de la checklist no significa nada. Nunca se amplía para responder por cada tipo.
- **El test de concordancia** compara `/first-run` con sus fuentes en ocho estados: sin Product; con precio sin Stock; con Stock sin precio; agotado; que califica; checklist ida; un Onboarding abierto; y un Business importado, mientras tiene el indicador `import_notice` y una vez que terminó. En cada estado:
  - el tipo y el indicador son iguales a lo que dicen sus fuentes: `/onboarding-progress`, el hecho de la Spreadsheet import y el hecho de la publicación;
  - se lee el propio `GET /catalog` (no solo el puerto por el que lo lee el servidor), y `nothing_qualifies` es igual a "el tipo es la checklist y `GET /catalog` no tiene texto".

  Cada tipo que el endpoint responde aparece en al menos un estado. Solo agrega controles; no cambia ninguna regla ni matriz de acá.
- **Los dos temas**: los tests del front de la línea de precio faltante de "+ New sale" y del "Send catalog" deshabilitado corren cada uno en claro y en oscuro, conservando cada aserción que tenían. Las cifras de Home quedan fuera de este alcance.

### El Onboarding (primer uso de un Business recién creado)

- **Entrada**: aceptar una Invitation de Business nuevo cae en el Onboarding en lugar de Home. Es la única vez que se abre solo. Después, se vuelve a él solo abriendo la dirección `/onboarding`: ninguna pantalla enlaza a él, ni Home, ni Settings, ni More.
- **Home no lo anuncia**: ni un aviso, ni una marca, ni un recordatorio. Home es el Panel, sea cual sea el estado de la configuración.
- **Abrir `/onboarding`**:
  - mientras no terminó, lleva al paso donde se retoma;
  - con cada paso hecho o pasado y sin "Done" alcanzado, manda `advance` una sola vez por montaje, muestra "Done" (reemplazando su entrada del historial) y con eso termina el Onboarding (ADR-0081). Una segunda apertura lleva a Home;
  - para un Business cuyo Onboarding terminó (por "Done" o por la Spreadsheet import) y para uno que nunca tuvo uno, lleva a Home.
- **No agrega ninguna regla lateral**: "+ New sale" y "Send catalog" se comportan como para cualquier Business. Lo que falta lo dicen la propia línea de falta de precio de New sale antes de guardar y el estado vacío de la pantalla del Catalog.
- **Una vez que terminó** ("Done" alcanzado, o la Spreadsheet import cargó el Business), no vuelve; los faltantes que siguen los dicen los avisos permanentes.
- Sus pasos, pases, retomar y pantalla de cierre están en onboarding.md.

### Restricciones

- Nada de acá agrega una ruta que responda datos del Business más allá de lo que necesitan el Panel de Home y el estado de primer uso; cada pantalla lee las rutas de su dueño, que ya están en el barrido de aislamiento y en el test de rutas protegidas. Las rutas propias del Onboarding, y cualquier ruta del estado de primer uso (el hecho de la Spreadsheet import, el fin de la checklist), se suman a los dos, y ese estado lleva `business_id` y lo exporta y lo borra la **Business removal** (ADR-0015).
- Servir un path del front a una navegación del navegador nunca amplía lo que la API responde a un pedido JSON, y no agrega ninguna ruta de la API (ADR-0024).
- Lo que deciden el Onboarding y las reglas laterales lo responde el servidor solo para el Business de la Session. Abrir `/onboarding` puede terminar solo el Onboarding del Business de la Session, y solo en `finish`; el pedido no nombra ningún Business (ADR-0081).
- Ningún id de Business en una URL; ningún dato personal ni dinero en la consola o el almacenamiento del navegador (accounts.md). La **Theme choice** es lo único que se guarda en el dispositivo (ADR-0026); los hechos de primer uso se guardan en el servidor, nunca en el navegador. Los offsets de scroll (GH-480) viven solo en la memoria de la app en marcha, nunca en `sessionStorage`, `localStorage` ni ningún otro almacenamiento del navegador.
- Los mensajes de respuesta siguen accounts.md, en Settings, el Onboarding y Home como en todas partes:
  - sin red se muestra "No connection";
  - un error del servidor muestra un reintento genérico;
  - un registro que ya no existe sigue la regla de "That is gone.".
- **Disposición en el celular (GH-319)**:
  - Cada Sheet de celular la dibuja el único `Sheet` compartido (ADR-0062). Ningún formulario define su propio fondo, ubicación de Close, disposición de acción fija ni bloqueo de scroll.
  - Donde una Sheet tiene afuera, su toque afuera y su Close leen el mismo valor `touched`: el `dirty` que el host ya le pasa a `useLeaveGuard`. En la Sheet a pantalla completa del celular nada fuera de ella la cierra.
  - "Teclado abierto" lo decide solo `useVisualViewport` (ADR-0028 tal como se enmendó).
  - Las reglas del celular nunca editan la rama de diálogo `PriceFrame` de ADR-0044 ni la rama de computadora de `CobroFrame`.
  - Cada paso deja el **Mobile check** en verde, borra de las listas cada infractor que pone en verde, conserva las claves del registro y no agrega ningún infractor fuera de las reglas de canje o de fila nueva de gate.md.

## Métricas

- **Presupuesto de toques (criterio 1)**: a través del front, desde cada Tab root, en viewports de celular y de computadora, la corrida de punta a punta cuenta los toques para abrir: el formulario de Sale (1), Record payment con el Customer elegido desde Customers y desde Home (≤2), la pantalla del Catalog (≤2), el formulario de Stock entry (≤2), el formulario de Stock withdrawal (≤2) y el formulario de Expense (≤2). 100% dentro del presupuesto.
- **Settings en un solo lugar (criterio 2)**: cada configuración de todo el Business nombrada en los docs del producto está en exactamente un grupo de Settings y en ninguna otra pantalla, incluidos los interruptores de precio; la pantalla del Catalog no edita el Catalog header and footer, Expenses no tiene opción de categorías y la vieja pantalla Business no existe; cada configuración de un solo Product está solo en la página del Product. Settings y Prices se abren en ≤2 toques desde cada Tab root, en celular y computadora. Mientras el lugar provisorio reemplaza a Integrations y Catalog message, se llega a él solo desde la pantalla del Catalog y desde ninguna pestaña ni opción de More o de Settings. Los pasos del Onboarding escriben a través de las rutas de los dueños, y un valor guardado ahí se lee igual en Settings.
- **Un dato, un lugar (criterio 3)**: ningún precio, Stock entry, Stock withdrawal, umbral ni Catalog attribute se puede editar desde dos pantallas, verificado contra los docs y el diseño. Una Stock entry se edita con su único formulario, `/varieties/entries/{id}`, sea cual sea la lista desde la que se abrió.
- **Nada perdido, nada inventado (criterio 4)**: cada acción que quien vende tenía antes del rediseño, y todo lo alcanzable en master o en #59, corresponde a un lugar de la estructura nueva, salvo el canal del Customer; la barra, la barra lateral, More y Settings muestran exactamente las opciones listadas arriba, sin grupo de marcador de lugar ni opción del Onboarding; ningún link apunta a una pantalla que falta. Las especificaciones de punta a punta de #47 y las esperas de tests de #118 pasan sin editarse para que encajen.
- **Marco (criterios 5, 9)**: cada pantalla de los docs y de `scripts/design/screens.json` se clasifica como exactamente un tipo con una pantalla madre, incluidos los pasos del Onboarding y "Done", y tests del front verifican su marco: los Tab roots con la barra y "+ New sale", las tarjetas con "‹ <parent>" y sin "+ New sale", los formularios y las Sheets sin ninguno de los dos, "Close" y una confirmación al salir con cambios sin guardar. El formulario de Stock entry dice "Close", nunca "Back"; el formulario de Customer muestra "Close".
- **Un solo movimiento atrás (criterio 10)**:
  - cada salida por un registro que ya no existe (formulario de Stock entry, formulario de Customer, Record payment), abierta desde su pantalla madre, deja el historial con la pantalla madre una sola vez, y un atrás sale; abierta con un link directo, va a la pantalla madre nombrada;
  - cada fila de la tabla de atrás sin historial se prueba una por una; atrás sin historial desde la lista de Settings va a More en el celular y a Home en una computadora; desde el detalle de un Stock withdrawal, a Products; desde la página de un Archived product, a Archived; desde Archived, a Products; desde el Onboarding, a Home;
  - en una computadora, elegir filas en los dos paneles de Products y de Customers, y el primer Product elegido automáticamente de Products, dejan atrás en un paso; en el celular, abrir un registro agrega una entrada al historial;
  - tocar "Collect from <name>" en una fila de Customers y en una fila de Home abre Record payment con el Customer elegido, lleva el estado de historial de la app, y atrás lo cierra en un movimiento;
  - "+ New sale", en la zona de la barra y en la barra lateral, abre New sale con el estado de historial de la app, y su "Close" sin tocar va un paso atrás hasta la pantalla desde la que se abrió.
- **Barra accesible (criterio 6)**: un test de Playwright a 320 px con el texto al 130 % muestra entera cada etiqueta de pestaña; la pestaña activa lleva `aria-current` y una marca que no es color; ningún estado se dice solo por color.
- **Settings (criterio 8)**:
  - tests del front:
    - cada grupo tiene "Close" y no tiene barra;
    - los cambios sin guardar preguntan, y un grupo sin tocar se cierra de inmediato;
    - Appearance no muestra guardar, toast ni aviso;
  - Prices está después de Users y antes de Integrations, en `/settings/prices`;
  - Integrations muestra el link a la pantalla del Catalog, sin estado del fijado y sin Publish, y la línea "unpin it yourself in Telegram" después de un cambio de token o de canal;
  - una corrida de punta a punta del front desde un viewport de celular:
    - renombra el Business y crea un link para sumarse;
    - cambia y guarda Prices;
    - corre Test it y sigue el link a la pantalla del Catalog;
    - edita el Catalog header and footer;
    - agrega, renombra y quita una categoría, incluido un rechazo al quitar;
    - cambia Appearance, cambia la contraseña y cierra sesión.
- **Matriz de primer uso, el Onboarding**: 100% en verde, celular y computadora:
  - un Business recién creado cae en el Onboarding al aceptar su Invitation; Home, abierto después, no muestra ningún aviso del Onboarding;
  - mientras corre, "+ New sale" y "Send catalog" se comportan como para cualquier Business;
  - `/onboarding` retoma en el primer paso ni hecho ni pasado; con cada paso hecho o pasado y sin "Done", muestra "Done" y lo termina, y una segunda apertura lleva a Home;
  - un Business preexistente y un Business importado (incluido uno que cayó en el Onboarding antes de la Spreadsheet import) caen en Home al abrir `/onboarding`; un User que se suma a un Business a mitad del Onboarding comparte su estado.
- **Matriz de primer uso, Home y las reglas laterales (criterio 12)**: 100% en verde, celular y computadora:
  - Home no muestra ningún aviso de primer uso ni "Start with your products", para un Business en Onboarding, uno preexistente, uno importado y uno sin precio hoy, y sigue mostrando "Your Telegram catalog is out of date" mientras aplica; Home no pide `/first-run` ni `/onboarding-progress`;
  - un Business que existía antes del Onboarding y no cumplió los pasos 1 y 2 tiene la línea de precio faltante de "+ New sale" y el "Send catalog" deshabilitado cuando nada califica;
  - se van la primera vez que los pasos 1 y 2 están cumplidos los dos, sean como sean el 3 y el 4, y eliminar después la única Price entry nunca las trae de vuelta;
  - un Business importado y uno recién creado nunca las tienen;
  - un User que se sumó ve las reglas de su Business, o ninguna.
- **Estado de primer uso aislado**: sus rutas están en el barrido y en el test de rutas protegidas; la Business removal deja 0 filas de él y conteo exportado = conteo borrado.
- **Concordancia de primer uso (criterios 13, 14)**: en los ocho estados, el tipo y el indicador `import_notice` de `/first-run` son iguales a sus fuentes, y `nothing_qualifies` es igual a "el tipo es la checklist y `GET /catalog` no tiene texto": 0 diferencias; cada tipo que el endpoint responde aparece en al menos un estado; un `nothing_qualifies` roto a propósito hace fallar el test, mostrado una vez en el PR y sin commitear. 0 hallazgos de estos tipos en el head que se integra, y 0 arrastrados a otra tarea.
- **Una sola forma (criterio 15)**: un test del backend muestra `checklist == []` para cada tipo que no es la checklist; un test del front muestra que `[]` se lee como sin checklist; el plan, el esquema y el front concuerdan, y el código del verificador del contrato no cambia.
- **Los dos temas (criterio 16)**: cada uno de los tests del front de las reglas laterales (la línea de precio faltante de "+ New sale" y el "Send catalog" deshabilitado) corre en claro y en oscuro, y ningún test tiene menos aserciones que antes.
- **Nada aflojado (criterio 18)**: cada suite pasa; los únicos tests editados son el test de concordancia, los tests de primer uso que quedan y los dos tests del registro, cada uno conservando sus aserciones; bajo `web/src/` no cambia nada salvo tests, aparte del tipo `/first-run` del front si declaraba `checklist` como anulable.
- **Redirecciones (criterio 11)**: cada path viejo en español que se movió responde una redirección permanente a su ruta en inglés, probado uno por uno, incluidos `/negocio`, `/gastos/categorias`, `/catalogo`, `/mi-stock/nueva-entrada`, y `/variedades/{id}` y `/mi-stock/entradas/{id}` con el id pasado. Un test muestra que cada destino de redirección es un path de `screens.json`, sin excepción. Hay un solo mecanismo de redirección, en el servidor, y ninguno en el front.
- **Recargas bajo `/varieties` (criterio 11)**: una navegación del navegador a cada ruta de Products, incluidas las que llevan parámetros (`/varieties/{id}`, `/varieties/{id}/entries`, `/varieties/{id}/prices`, `/varieties/{id}/prices/new`, `/varieties/entries/{id}`) y `/varieties/archived`, abre la pantalla, nunca la respuesta de la API; las llamadas propias del front a la API siguen llegando a la API.
- **Una estructura (criterio 7)**: los docs, CONTEXT.md, `pantallas/` y `screens.json` nombran las mismas pantallas y rutas, incluidos el formulario y el detalle de Stock withdrawal, la tarjeta Archived, la página del Archived product, Prices, las pantallas del Onboarding y Home sin ningún estado de primer uso; Zeta aprueba el pull request que las enuncia.
- **Diseño**: `scripts/design/compare.sh` corre antes y después para el formulario de Stock entry, el formulario de Customer, New sale y Home (celular y computadora, los dos temas), adjuntado al PR y juzgado a ojo; `NuevaVentaCompu` sale sin cambios; cualquier diferencia con el diseño se lista en el PR.
- **Velocidad en el celular (GH-319, con el criterio 1)**: el e2e de New sale pasa sin editarse, con la misma cantidad de toques hasta una Sale guardada. Una Sale se registra desde un viewport de celular en menos de 60 s.
- **Marco a mano (criterio 19)**:
  - El Mobile check corre a 320, 360 y 390 px, en las posiciones de scroll de arriba, del medio y de abajo. En cada Tab root, incluido el marco de Analysis, encuentra la barra y "+ New sale" dentro del viewport con la última fila entera arriba de ellos. En las tarjetas encuentra la barra y ningún botón, y en formularios y Sheets ninguno de los dos.
  - Quedan 0 infractores `chrome-at-load`, `chrome-mid-scroll` o de etiqueta de barra para las pantallas del alcance.
- **Teclado (criterio 19)**:
  - La matriz unitaria de la decisión del teclado pasa al 100%: hueco de iOS, caída de Android, foco al montar, un cambio de la barra de direcciones de menos de 120 px, `scale = 2`, y sin `visualViewport` con foco en texto, fecha y select.
  - En Customers, el e2e oculta la barra y el botón con el teclado abierto y los trae de vuelta con el texto de búsqueda y el offset de scroll sin cambios.
  - Un scroll del tamaño de Android mantiene la barra visible.
  - `nuevaVentaTelefono.spec.ts` y los tests existentes del hook pasan sin editarse.
- **Acción fija y foco (criterio 19)**:
  - En cada Sheet, el borde inferior de la acción queda dentro de `--inset-abajo` del borde inferior de la Sheet. Se verifica en renombrar (el formulario más corto) y en un Stock withdrawal con líneas (el más alto).
  - Un test del front por formulario afirma su control con el primer foco, incluido el primer campo de Record payment.
  - Una dirección directa muestra cada Sheet con ruta sobre su pantalla madre, un test por ruta.
- **Entrar, objetivos y texto (criterio 19)**:
  - 0 infractores `h-scroll`, `name-overflow` o `figure-split` a 320 y 246 px con los datos extremos de la semilla, en cada pantalla de celular salvo el contenido de Analysis.
  - 0 infractores `touch-target`, `text-size` o `autocomplete` en las pantallas del alcance.
  - Ningún infractor nombra los estados recorridos de la Sheet de Record payment.
- **Nada perdido (criterio 20)**:
  - Tests de giro del viewport en el formulario de precio y en Record payment conservan el texto tipeado.
  - Close desde una lista desplazada vuelve al mismo offset.
  - Tests unitarios de `Sheet`, donde se dibuja un fondo: tocarlo cierra una Sheet sin tocar y no hace nada en una tocada.
  - Un test unitario de `Sheet` en el celular: un toque en la franja de área segura de arriba deja la Sheet abierta, tocada o sin tocar.
  - Los tests existentes de cambios sin guardar pasan sin editarse.
- **Computadora sin tocar (criterio 20)**: las capturas de computadora de las pantallas tocadas no cambian. La rama de diálogo de `PriceFrame` y la rama de computadora de `CobroFrame` tienen 0 líneas cambiadas.
- **Listas de infractores (GH-319)**: 0 infractores agregados fuera de las reglas de canje o de fila nueva de gate.md. Cada aserción nueva se muestra fallando una vez sobre un caso roto a propósito en el PR, y ese caso no se commitea.
- **Scroll al cambiar de pantalla (criterios 21–23)**: una corrida de punta a punta a 320, 375 y 430 px y a 1280 px, 100% en verde, sin ninguna aserción aflojada:
  - desde una lista desplazada bien por debajo de su primera pantalla, una pestaña, un link y una fila hacia su detalle hacen caer cada uno la pantalla nueva en el offset 0;
  - atrás (el del navegador o el del celular) y "‹" desde un detalle abierto en una lista de Sales desplazada vuelven a Sales en el offset en que se la dejó;
  - New sale abierta con "+ New sale" desde una lista de Customers desplazada y cerrada sin tocar vuelve a Customers en su offset;
  - Record payment abierto con "Collect" desde una lista desplazada vuelve a esa lista en su offset, una vez cerrado con "Close" y otra con atrás, sin guardar. Una apertura y un cierre siguientes caen igual. En una computadora, el offset se lee en la pantalla real después de que se cierra el diálogo; no se afirma el offset de una imagen de fondo inerte mientras el diálogo está abierto (`InicioFondo` de Home);
  - un link directo a un formulario, cerrado, abre su pantalla madre alternativa en el offset 0;
  - abrir y cerrar una Sheet deja sin cambios el offset de abajo;
  - en una computadora, elegir una fila en los dos paneles de Customers deja sin cambios el offset de la lista.

  Tests unitarios cubren la decisión de llegada o vuelta y las secuencias abrir → Close y abrir → atrás de Record payment. Después de la corrida, el almacenamiento del navegador no guarda nada salvo la Theme choice. Cada aserción nueva se muestra fallando una vez sobre un caso roto a propósito en el PR, y ese caso no se commitea.

## Fuera de alcance

- Los textos de pantalla en inglés (#53); una opción de idioma.
- Rehacer las pantallas de cada área (#45–#49, los grupos de Settings): sus rutas muestran el contenido de hoy hasta entonces.
- Cualquier superficie del Operator o de administración en la app; roles; listar o revocar Invitations.
- Un tour o pantalla de bienvenida más allá del Onboarding.
- Una opción para volver a correr el Onboarding.
- Reglas laterales sobre "+ New sale" o "Send catalog" atadas al Onboarding.
- Un aviso, una marca o un link a `/onboarding` en Home, Settings o More; quitar o adelgazar `/first-run` (decisión aparte, ADR-0081).
- Una checklist para un Business recién creado; guardar un paso de la checklist como tildado.
- Completar hacia atrás el hecho de la Spreadsheet import para un Business importado antes de que existiera.
- Promociones (como campañas u ofertas), automatizaciones, idiomas, y cualquier opción para ellas antes de que existan. Un Stock withdrawal para promoción es un registro de Stock, no esto.
- El estado del fijado o Publish en Integrations.
- Configuraciones de un solo Product en Settings (#47).
- Una opción Archived en la barra, la barra lateral, More o Settings: se llega solo desde Products.
- Una regla de redirección para paths quitados sin equivalente; cambiar adónde van las direcciones desconocidas.
- Marcas o etiquetas "‹ <parent>" que dependan de cómo se llegó a una pantalla.
- Una flecha de regreso que ignore el historial.
- Cambiar el texto de cualquier pregunta existente de cambios sin guardar.
- Actualizaciones en vivo entre socios.
- Una forma de llegar a Prices desde la página de un Product, el formulario de precio o el formulario de Customer.
- Redirecciones en el front; un segundo mecanismo de redirección.
- Elegir automáticamente un Customer en los dos paneles de Customers.
- Cualquier cambio de token, redacción o disposición en una pantalla más allá de lo que le da la regla del marco.
- Una lista de Stock withdrawals de todo el Business.
- Cambiar el verificador del contrato para que pueda declarar un arreglo anulable; una checklist `null`.
- Un `nothing_qualifies` que responda por cada tipo, o una lectura del Catalog agregada a cada lectura de Home para eso.
- La cobertura de temas de las cifras de Today, Week y Month de Home como parte de la revisión del primer uso.
- El contenido de Analysis en el celular (sus tres tablas y su selector de mes): la parte 2 de GH-319.
- Convertir en Sheets Change password, el editor de Expense categories o la ventana superpuesta de Customer nuevo de New sale.
- Cualquier cambio en la disposición de computadora a partir de la disposición en el celular; cambiar la duración o el descarte de los toasts; cambiar la cantidad de toques de New sale o lo que hace Save antes de la elección de pago.
- Deshabilitar Save en New sale; un scroll con resaltado sobre Save.
- Un área de toque afuera en la Sheet a pantalla completa del celular: un hueco, una franja de fondo visible, o la franja de área segura funcionando como objetivo para cerrar.
- Recordar offsets de scroll después de una recarga o en el almacenamiento del navegador; restaurar el scroll dentro de una lista anidada en una pantalla (un panel, un selector) más allá de la regla de los dos paneles; ir arriba cuando quien vende toca la pestaña en la que ya está.
- Hacer coincidir el offset de una imagen de fondo inerte dibujada detrás de un diálogo de computadora (`InicioFondo` de Home detrás de Record payment) mientras el diálogo está abierto, o volver a dibujar ese fondo para lograrlo.

## Planned in GH-318

Todavía no está construido. Hasta que salga la parte nombrada, las secciones de arriba son lo que hace la app.

Cada pasaje nombra el ADR que lo decide, la parte que lo va a entregar y la oración actual que va a reemplazar. La parte que entrega un pasaje lo quita de acá y edita Comportamiento y Fuera de alcance en el mismo diff.

### Settings

Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md y docs/adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md y docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md y docs/adr/0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md; lo entregan las partes de Settings, cada una para la configuración que construye.

- Cada configuración que fija quien vende va a tener un grupo en Settings, cada uno su propia subpantalla pensada primero para el celular: categorías y subcategorías con sus atributos, Units, Customer types, Payment methods, Withdrawal reasons, Expense categories, la plantilla del Catalog, y el símbolo de moneda y los decimales del dinero.
- **Zona horaria y país del teléfono**: cada Business va a tener una zona horaria, que se cambia en Settings; un cambio solo va a mover qué es "hoy" de ahí en adelante, y las fechas registradas nunca se van a reescribir (ADR-0057). Cada Business va a tener un país de teléfono por defecto; los Phone numbers van a seguir siendo opcionales y en formato internacional.
- **Los decimales del dinero** los va a poder subir en Settings cualquier Business, incluido uno que existía antes, mediante un reescalado único en una sola transacción que va a dejar iguales cada valor y cada cifra derivada (ADR-0058). Solo van a bajar cuando ningún monto registrado tenga más decimales.
- Va a reemplazar: "**Una pantalla que reúne cada configuración de todo el Business, en grupos, y nada más.** Los grupos, en este orden (el comportamiento de cada grupo es de su dueño):" (la lista de grupos va a crecer), "**Prices** (pricing-settings.md), en `/settings/prices`:" (el interruptor VIP va a pasar a ser Customer types) y "**Expense categories**: agregar, renombrar y quitar, incluido el rechazo al quitar (expenses.md)." (va a pasar a ser una de las listas propias del Business).
- Fuera de alcance: "Configuraciones de un solo Product en Settings (#47)." va a seguir afuera; los atributos de una subcategoría van a ser del Business, no de un Product.
