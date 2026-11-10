## Jobs

**Cuando** acabo de abrir mi negocio y todavía está vacío, **quiero** que me guíen por lo que necesita, un paso corto por vez, con los valores por defecto ya completos, **para** registrar mi primera venta el mismo día sin buscar entre Settings, Products y la pantalla del Catalog.

Antes, quien vendía caía en un Home vacío y abría Products, la pantalla del Catalog y Settings una por una. Antes de la app, hacía todo eso en la pestaña Ajustes de la planilla.

**Cuando** manejo mi negocio desde el celular entre pedidos o en medio de un chat con un cliente, varias veces al día, **quiero** la app organizada según lo que de verdad hago y cada cuánto, **para** volver con el cliente en vez de buscar entre menús. (El job de navegación, navigation.md: lo sirve acá el Onboarding como el único camino guiado de un Business nuevo, abierto al aceptar su Invitation; Home no muestra ningún aviso de primer uso.)

**Cuando** abro Home en el celular para ver cómo viene el día, **quiero** ver solo lo que vendí, lo que me deben y mi Stock por Product, **para** llevar el negocio de un vistazo sin avisos de configuración en el medio. (Se define en results.md; lo sirve acá que el Onboarding no ponga ningún aviso en Home: se entra solo al aceptar la Invitation o abriendo `/onboarding`.)

**Cuando** un precio cambia en mitad del día y estoy con el celular entre pedidos o en medio de un chat con un cliente, **quiero** registrar el precio nuevo y el día desde el que rige en un formulario corto que se lea en pesos y arranque en hoy, sin salir del producto que estaba mirando, **para** volver con el cliente seguro de que rige el precio correcto, sin dudar del monto ni de la fecha. (Se define en varieties.md; lo sirve acá su situación secundaria: el paso 1 comparte los campos de precio, así que sus montos se leen en pesos con "$". El paso 1 siempre guarda un precio que rige desde hoy y no muestra fecha.)

**Cuando** reviso un cambio del Onboarding contra su diseño antes de aprobarlo, **quiero** que cada diferencia entre los pasos construidos (incluido el chip "Initial stock" del Opening stock) y el dibujo esté o bien corregida o bien registrada como decisión en este doc, y que las capturas de antes y después cubran cada pantalla que el cambio toca, **para** aprobar solo a partir de la evidencia del PR, sin revisar pantallas a mano ni arrastrar un hallazgo abierto a la próxima tarea.

Este afina el criterio 5 y su métrica de diseño; no es un job de producto nuevo. Su protagonista es quien revisa en nombre del mantenedor y, al final, Zeta, como en design-capture.md y en el criterio 11 de pinned-catalog.md. Quien vende se ve afectado solo de forma indirecta. Salió del seguimiento de GH-144, donde la etiqueta "Origin" sobre el chip del paso 2 estaba sin decidir y la evidencia de comparación no tenía corrida de antes, ni pasos oscuros, ni el aviso de Home de entonces.

**Cuando** trabajo en la app desde el celular, venda lo que venda, **quiero** que llame "products" a lo que vendo, **para** que la app se ajuste a mi negocio sin que yo traduzca sus palabras ni le elija una. (Se define en varieties.md; lo sirve acá su segunda situación, el primer uso: el Onboarding dice "Product" en sus pasos y nunca pregunta "What you sell".)

# Onboarding

La configuración paso a paso por la que se guía a un **Business** recién creado una vez que se acepta su **Invitation** de Business nuevo. Pide lo que necesita una primera **Sale** (un **Product** con precio para hoy y su **Opening stock**) y ofrece las configuraciones de todo el Business que quien vende recién empieza tendría que salir a buscar (**Catalog header and footer**, el bot de Telegram, un socio, **Expense category**s). Cada paso guarda exactamente lo que guarda su dueño: varieties.md, stock.md, catalog.md, pinned-catalog.md, accounts.md y expenses.md. El Onboarding no tiene ninguna configuración propia; solo recuerda qué pasos opcionales se pasaron. Lo ve solo su Business (ADR-0004). Dónde se ubica está en navigation.md. No pone ningún aviso en Home (results.md): el dueño sacó los avisos de primer uso (`docs/design/redesign/registro-unificado.md`).

El Onboarding nunca pregunta cómo se llama lo que vende el Business: en pantalla es siempre "Product" / "Products" para todo Business (varieties.md, docs/adr/0075-the-screen-word-is-always-product-and-no-product-word-setting-exists.md), y no existe ningún paso "What you sell".

Criterios de éxito:

1. **Rápido, desde el celular**: desde aceptar la Invitation hasta un Business listo para su primera Sale (un Product con precio para hoy, con Opening stock) en menos de 5 minutos, solo desde el celular.
2. **Solo la venta es obligatoria**: nada es obligatorio más allá de un Product con precio y su Opening stock. Cualquier otro paso se puede saltear con un toque y dice dónde se puede hacer más adelante.
3. **Nada perdido**: salir a mitad de camino no pierde nada de lo ya guardado. Retomar (al volver por su propia entrada) arranca en el primer paso que no está ni hecho ni pasado. Quien no vuelve termina la configuración desde Settings y la página del Product, que guardan lo mismo.
4. **Un dato, un lugar**: cada paso guarda la misma configuración, bajo las mismas reglas y rechazos, que guardan Settings o la página del Product. Un valor fijado en un paso es el valor que se ve después en su lugar de siempre, y al revés.
5. **Simple y atractivo, sin inventar nada**: armado con elementos del design system y juzgado a ojo en celular y computadora. Sin datos de relleno, sin cifras falsas y sin ningún paso para una configuración que todavía no existe.
6. **Un cambio se aprueba solo con su evidencia**:
   - cada diferencia entre un paso construido y su dibujo está o bien corregida o bien decidida acá, y la pantalla construida, sus tests y este doc coinciden;
   - las capturas de antes (base de la tarea) y después (head) cubren cada pantalla que el cambio toca, sin ninguna celda faltante;
   - cada diferencia que muestran las capturas se lista en el PR;
   - la comparación nunca es un paso del **Gate** (ADR-0042, gate.md).
7. **Ninguna palabra que elegir**: el Onboarding nunca muestra "What you sell" ni pide una Unit, y cada texto suyo dice "Product" / "Products", nunca "variety".
8. **Home queda limpio**: ningún estado del Onboarding (sin empezar, a mitad de camino, con todo hecho o pasado sin "Done", terminado) pone un aviso, insignia ni recordatorio en Home ni en ningún otro lado.

## Comportamiento

### A quién le toca, y cuándo

- Solo a un Business recién abierto con una Invitation de Business nuevo, desde el momento en que se acepta la Invitation.
- **Nunca se ofrece a**:
  - un Business importado. Una vez que la **Spreadsheet import** carga un Business, el Onboarding terminó para él: `/onboarding` lleva a Home y "Done" nunca se muestra. Sus pasos recordados como pasados no son registros para el control de elegibilidad de la Spreadsheet import (import.md);
  - un Business al que un **User** se sumó con una Invitation para sumarse;
  - un Business que existía antes de que saliera el Onboarding.
- **Sin "hacerlo de nuevo"**: una vez que terminó, nada en la app vuelve a apuntar a él.
- **Un estado por Business**: un socio que se suma a mitad de camino comparte el mismo estado y puede seguir abriendo `/onboarding`. Sin roles.

### Home y las demás pantallas mientras no terminó

- **Home no muestra nada del Onboarding**: ni avance, ni paso que falta, ni "Start with your products". Un Business a mitad de camino ve el Panel normal con sus estados vacíos de siempre, sin texto de configuración (results.md).
- **Sin reglas laterales propias**: "+ New sale" y "Send catalog" se comportan mientras corre el Onboarding como para cualquier Business. Lo que falta lo dicen el propio "<product> has no price for that date" de New sale antes de guardar y el estado vacío propio de la pantalla del Catalog. Las reglas laterales de "+ New sale" y "Send catalog" para un Business que existía antes del Onboarding (navigation.md) no son del Onboarding.
- **El Onboarding no arma nada en Home** y no lee ni escribe el estado de primer uso de `/first-run` más allá de su propio fin.

### Entrada y cómo se vuelve

- **Entrada**: aceptar una Invitation de Business nuevo lleva al Onboarding, no a un Home vacío. Una Invitation para sumarse sigue llevando a Home. Es la única vez que el Onboarding se abre solo.
- **Volver**: mientras no terminó, abrir la dirección `/onboarding` lleva al paso donde se retoma, o a "Done" cuando cada paso está hecho o pasado. Ninguna pantalla enlaza a él: ni Home, ni Settings, ni More. Su propia entrada es eso: el aterrizaje tras la Invitation y su dirección.
- **Quien sale antes de "Done"** y no vuelve termina la configuración desde Settings (Integrations, Users, Catalog message, Expense categories) y la página del Product, que guardan exactamente lo mismo que cada paso.
- Quien vende que lo quiera terminado antes termina los dos pasos obligatorios y toca "Skip the rest".

### Las pantallas

- **Tipo**: una pantalla completa del tipo formulario o Sheet (navigation.md): sin barra ni barra lateral, sin "+ New sale". Una sola columna centrada, del ancho de un celular, en todo viewport, sin disposición propia para la computadora.
- **Cada paso muestra**:
  - un título corto y una oración sobre por qué importa;
  - sus campos y una acción principal;
  - el avance en palabras además de forma ("Step 2 of 6"), nunca solo por color;
  - "Back", al paso anterior, en cada paso salvo el paso 1. El paso 1 no tiene paso anterior: no muestra "Back", y "Close" es su salida;
  - "Skip", solo en los pasos opcionales;
  - "Skip the rest", solo en los pasos opcionales, solo una vez que los dos pasos obligatorios están hechos, y nunca en el último paso (paso 6), donde no pasaría nada que "Skip" no pase;
  - "Close", que lleva a Home y conserva todo lo guardado y el punto donde se retoma.
- **Los controles para saltear**: "Skip" y, cuando se muestra, "Skip the rest" van juntos en una línea como links de texto, como los dibuja el diseño; ninguno es un botón.
- **El marco del paso sigue el diseño dibujado** (`docs/product/design-system/pantallas/Onboarding*.dc.html`); una diferencia entre este archivo y el dibujo sobre lo que muestra un paso es un defecto del diseño. Un dibujo que todavía diga "variety" es un defecto conocido del dibujo, que diseño corrige en su propio trabajo.
- **Cambios sin guardar**: salir de un paso con algo tipeado y sin guardar, por "Close", "Back" o "Skip", pregunta antes de descartar. Un paso sin tocar se sale de inmediato.
- **Dentro de los pasos**, rige sin cambios el comportamiento propio de los dueños: reglas de campos, rechazos en línea que conservan lo tipeado, toasts, los motivos de Test it y de Find my chat, "No connection", el reintento genérico y "That is gone.".

### Los seis pasos, en orden

| # | Paso | Obligatorio | Guarda |
|---|---|---|---|
| 1 | A product with today's price | Sí | Un Product y una **Price entry** que rige desde hoy (**List price**, opcionalmente un **Bulk price** y su mínimo), bajo las reglas y los rechazos de Products (varieties.md) |
| 2 | Its opening stock | Sí | Una **Stock entry** con origen Initial stock, gramos, la fecha de hoy y un costo total opcional (stock.md) |
| 3 | Catalog header and footer | No | El Catalog header and footer del Business, mostrados con sus valores por defecto (catalog.md) |
| 4 | Telegram bot | No | Token, chat del canal, chat propio (con Find my chat) y Test it, exactamente como Integrations (pinned-catalog.md) |
| 5 | A partner | No | Un link para sumarse por toque, para copiar o compartir (accounts.md) |
| 6 | Expense categories | No | Agregar, renombrar y quitar, como en Expense categories (expenses.md) |

- **El paso 2** dice con claridad que sin costo el **Lot** cuesta $0.
- **El origen del paso 2** se muestra como el chip fijo, solo de texto, "Initial stock", sin una etiqueta "Origin" arriba: el título del paso ya dice que es el Opening stock, y el origen no se puede cambiar ahí. La etiqueta "Origin" de `Onboarding*.dc.html` es un defecto conocido del dibujo, que diseño corrige en su propio trabajo. Esto rige solo donde el origen es el chip fijo: el formulario completo de Stock entry conserva su elección de origen, y la etiqueta que dibuje sobre ella, como lo define stock.md.
- **Más Products**: después de un Product y su Opening stock, quien vende ve "Add another product" (otro nombre, precio y Opening stock) o "Continue".
  - No hay tope, y cada Product se guarda en el momento en que se guarda su paso.
  - Con un Product alcanza para seguir.
  - El avance se queda en los pasos 1–2 mientras se agregan Products.
  - "Add another product" es la única forma en que el Onboarding agrega otro Product.
- **El paso 4** termina en el bot guardado y dice: "Whenever you like, publish it from Products → Send catalog". **Publish** y el estado del fijado quedan en la pantalla del Catalog.
- **El paso 5** dice "Send the link to your partner" y nunca espera a que el socio se sume.
- **Un paso salteado** dice dónde se puede hacer más adelante: Settings → Integrations, Users, Catalog message o Expense categories. Saltear el paso 3 o el 6 conserva los valores por defecto.

### Paso 1

- **Un formulario, una acción principal**: el nombre del Product, su List price y los campos opcionales del formulario de precio tal como los muestra Products bajo los interruptores de precio (pricing-settings.md), guardados con una sola acción principal. No hay un guardado aparte para el nombre y para el precio.
- **Montos en pesos**: los campos de precio son los que comparte el formulario de Price entry (varieties.md), así que el List price, el Bulk price y el **VIP price** muestran cada uno "$" antes del monto, y el **Bulk minimum**, en gramos, nunca.
- **Sin fecha**: el paso 1 siempre guarda un precio que rige desde hoy. No muestra ningún campo de fecha ni chip de fecha; el chip "Effective from" del formulario de precio (varieties.md) no es parte de él.
- **Sin Unit**: el paso 1 no pide ninguna Unit; cuando exista, la Unit se elige al crear el Product, fuera del Onboarding (#390).
- **Dos escrituras a través de los dueños**: esa única acción puede guardar el Product y después su Price entry que rige desde hoy, cada uno por la ruta y los rechazos de su dueño (varieties.md). Acá no se repite nada.
  - Un nombre rechazado no guarda nada y conserva todo lo tipeado.
  - Un precio rechazado deja guardado el Product, conserva todo lo tipeado y muestra el rechazo en su campo. El reintento manda solo el precio y nunca agrega un segundo Product.
- **Qué muestra el paso 1 al volver**, el primero que corresponda:
  1. **Un Product guardado sin Price entry** (un precio rechazado y después abandonado; en el primer Product o en uno agregado con "Add another product"): el paso 1 muestra el nombre de ese Product conservado y solo el precio por completar, tenga o no otro Product un precio para hoy. Con varios, muestra el primero por nombre, y cada precio guardado pasa al siguiente. Guardar el precio sigue exactamente como cualquier guardado del paso 1, y manda solo el precio.
  2. **Si no, un paso 1 hecho** (un Product tiene precio para hoy): el paso muestra el Product guardado, su nombre y el List price de hoy, marcado "Done", nunca un formulario vacío. Con varios, muestra el primero por nombre que tiene precio para hoy. Su acción principal pasa al paso 2 y no guarda nada.
  3. **Si no** (todavía no hay ningún Product): el formulario vacío.
- En todos los casos el paso 1 cuenta como hecho solo a partir de los datos (un Product con precio para hoy): mostrar el formulario de precio de un Product sin precio nunca mueve el conteo de avance ni el punto donde se retoma, y "Close" sale de inmediato conservando todo.
- Otro Product se agrega solo con "Add another product".

### Hecho y pasado

- **Los pasos obligatorios se calculan a partir de los datos**: el paso 1 está hecho cuando un Product tiene precio para hoy, y el paso 2 cuando existe una Stock entry.
- **Los pasos opcionales se pasan con un toque explícito**, y el paso pasado se recuerda para el Business. Este estado guardado es solo del Onboarding.

| Paso | Se pasa con |
|---|---|
| 3. Catalog header and footer | "Save" (editado) o "Leave as is" (valores por defecto conservados) |
| 4. Bot | Un Test it exitoso (la única forma de guardarlo) muestra "Done". "Skip" pasa el paso sin bot. Un Test it fallido muestra su motivo y no guarda nada |
| 5. Socio | "Continue" una vez creado un link, o "Skip" |
| 6. Categorías | Solo "Continue". Agregar, renombrar o quitar una categoría guarda de inmediato pero nunca pasa el paso |

- **Los datos que ya existen** muestran "Done" y cuentan como pasados: un bot guardado antes, un segundo User que ya está en el Business. Un paso obligatorio hecho muestra "Done" de la misma manera (el paso 1 como arriba).
- **Retomar** lleva al primer paso que no está ni hecho ni pasado, o a "Done" cuando no hay ninguno.
- **Salir** ("Close", cerrar la app, una conexión caída) conserva todo lo guardado y el punto donde se retoma.
- **"Skip the rest"** pasa de una vez cada paso opcional que queda.
- **Sin final anticipado**: el Onboarding nunca termina antes de que se cumplan los dos pasos obligatorios, y nada fuera de él (un precio agregado en la página del Product, por ejemplo) lo termina.

### "Done"

- Una vez que los dos pasos obligatorios están hechos y cada paso opcional está pasado, la siguiente pantalla que muestra el Onboarding es "Done", y **llegar a "Done" termina el Onboarding**. Por lo general eso pasa con el toque que pasa el último paso opcional (su propia acción, o "Skip the rest"); cuando cada paso quedó hecho o pasado fuera de él, pasa al abrir `/onboarding`. Si nunca se vuelve a abrir, el Onboarding queda sin terminar sin que nada lo muestre.
- Desde ahí terminó para siempre: salir de "Done" por cualquier medio, o cerrar la app en esa pantalla, nunca trae de vuelta el Onboarding. No hace falta tocar nada en "Done".
- **Una línea por paso**:
  - "Done" para un paso cuyos datos existen o que se guardó;
  - "For later — in Settings → <group>" o "in Products" para un paso salteado;
  - las líneas de los pasos obligatorios cuentan los registros hechos, p. ej. "Done · 2 products": un conteo, nunca una cifra ni un monto.
- **Acciones**: la principal "Add my first sale", que abre New sale, y la secundaria "Go to Home". Sin festejo y sin contenido extra.
- **New sale abierta desde "Done"** vuelve a Home, se cierre con "Close" o se guarde. Nunca vuelve a "Done" ni al Onboarding.

### Estados vacíos y errores

- El paso 1 arranca con los campos vacíos mientras el Business no tiene ningún Product. Ningún paso muestra una cifra, un dato de relleno ni datos de ejemplo.
- Los rechazos y las fallas son del dueño de cada configuración: en línea, conservando lo tipeado, sin llevar datos. Sin red se muestra "No connection", y un error del servidor, el reintento genérico.
- Un registro que ya no existe sigue la regla "That is gone." de accounts.md.
- Los datos que creó un socio muestran "Done" la próxima vez que se abre. Sin actualizaciones en vivo.

### Diseño

- Solo elementos del design system: tokens, componentes y los dos temas. Sin ilustraciones, animación, textos de marketing, colores nuevos ni componentes nuevos.
- Si nada existente sirve para el indicador de avance o la disposición del paso, diseño lo dibuja solo a partir de tokens, dentro del design system, antes de construirlo; nunca se inventa en el código.
- El texto del producto sigue el **Product language** (product-language.md). Nada recortado entre 320 y 430 px ni con el texto al 130 %; controles de al menos 44 px de alto y campos de al menos 16 px.
- Cada paso y "Done" entran en `scripts/design/screens.json`; `scripts/design/compare.sh` corre antes y después, en celular y computadora, juzgado a ojo. Home ya no tiene filas del Onboarding: las filas `InicioOnboardingEnCurso*` e `InicioOnboardingCompleto*` se retiraron.

### Revisar un cambio contra el diseño (criterio 6)

- **La matriz de evidencia**: cada celda se captura en la base de la tarea (antes) y en el head (después) con `scripts/design/comparisons.mjs --strict`. Un solo script desde una sola instalación toma los dos lados, en el mismo día de Argentina, con las fuentes fijadas (ADR-0042). El PR registra la versión instalada de `@fontsource/plus-jakarta-sans`. Las celdas son:
  - cada paso del Onboarding y "Done", claro y oscuro, celular y computadora;
  - cuando el cambio toca el chip del paso 2, el formulario de Stock entry abierto desde un Product sin Stock entries ("Initial stock" preseleccionado), claro y oscuro, celular y computadora.

  Las pantallas que el cambio no toca quedan afuera.
- **Filas del registro**: una celda sin fila en `scripts/design/screens.json` recibe una bajo las reglas de design-capture.md:
  - la fila llega a su pantalla como lo hace quien vende;
  - captura la sección nombrada entera;
  - los dos tests del registro se declaran como costuras;
  - se conserva cada guard de esos tests.
- **Cada diferencia se lista** en el PR como buscada, como un defecto conocido del diseño (como la etiqueta "Origin" del dibujo en el paso 2) o como un defecto.
  - Una diferencia que el cambio introdujo respecto de la base de la tarea es una regresión, y se corrige en la misma tarea, salvo que sea la intención decidida del propio cambio.
  - Una diferencia ya presente en la base de la tarea se carga como un issue de seguimiento nuevo, que el PR enlaza, y no se corrige ahí.
  - No queda ninguna diferencia sin explicar.
- **Una captura faltante**: una celda que no se puede capturar, de cualquiera de los dos lados, significa que el cambio no está terminado. No hay excepción (design-capture.md).
- **Solo evidencia de revisión**: las capturas se juzgan a ojo y nunca son un paso del Gate (ADR-0042, gate.md).

### Restricciones

- El estado del Onboarding lleva `business_id`, tomado de la sesión. Sus rutas entran en el barrido de aislamiento y en el test de rutas protegidas; el estado de otro Business no existe (404 o ausente).
- `/onboarding-progress` sigue existiendo y lo lee solo `OnboardingLayout`; Home no lo lee.
- La **Business removal** lo exporta y lo borra mediante la reflexión de esquema de ADR-0015, y la corrida de prueba lo cuenta.
- Cada paso llama a los casos de uso y códigos de rechazo propios de su dueño (`contract.json`, ADR-0008); no hay copia de ninguna regla.
- Nada sobre él va a los logs, la consola ni el almacenamiento del navegador (ADR-0005, ADR-0026). No se guarda ni se registra nada sobre el tiempo que llevó ni sobre dónde se fue quien vende.
- No hay ninguna ruta, campo ni estado para una palabra de lo que vende el Business.

## Métricas

No hay telemetría.

- **Menos de 5 minutos (criterio 1)**: una corrida de punta a punta del front desde un viewport de celular acepta una Invitation de Business nuevo, le pone precio a un Product, carga su Opening stock, pasa los pasos opcionales y abre New sale desde "Done" (`web/e2e/onboarding.spec.ts`); ningún test mide su duración.
- **Nada perdido (criterio 3)**:
  - una segunda corrida de punta a punta sale a mitad de camino con "Close", cae en Home sin ningún aviso, retoma abriendo `/onboarding` y cae en el primer paso ni hecho ni pasado;
  - una matriz de retomar, 100 % en verde, cubre:
    - los pasos obligatorios calculados a partir de los datos;
    - los pasos opcionales pasados recordados;
    - "Done" para datos que ya existen;
    - ningún final antes de que se cumplan los dos pasos obligatorios, y ninguno por un cambio hecho fuera del Onboarding;
    - cada paso hecho o pasado fuera de él: abrir `/onboarding` abre "Done", y llegar a "Done" lo termina;
    - el final al llegar a "Done".
- **Un dato, un lugar (criterio 4)**: un valor guardado en cada paso se lee igual en Settings o en la página del Product, y al revés.
- **Solo la venta es obligatoria (criterio 2)**: tests del front muestran:
  - cada paso opcional salteado con un toque;
  - "Skip the rest" solo una vez que los dos pasos obligatorios están hechos, y nunca en el paso 6;
  - "Skip" y "Skip the rest" como links de texto en una línea;
  - "Done" nombrando dónde vive cada paso salteado.
- **El marco del paso**: tests del front muestran que no hay "Back" en el paso 1 y que "Back" abre el paso anterior en los pasos 2–6.
- **Paso 1**: tests del front muestran:
  - una acción principal, que guarda el Product y su precio;
  - un precio rechazado que conserva todo lo tipeado, con el reintento que manda solo el precio y sin crear un segundo Product;
  - al volver al paso 1 después de que un Product tiene precio para hoy, ese Product marcado "Done", y pasar al paso 2 sin agregar ningún Product;
  - con un Product con precio para hoy y un segundo guardado sin precio, al volver al paso 1, el nombre del segundo conservado y solo su precio por completar, guardando solo el precio, con el conteo de avance sin cambios;
  - el "$" antes del List price, el Bulk price y el VIP price y nunca antes del Bulk minimum, y ningún campo ni chip de fecha.
- **El chip del paso 2**: tests del front (`web/src/screens/StockEntryForm.test.tsx`) muestran:
  - ninguna etiqueta "Origin" sobre el chip fijo "Initial stock" del paso 2. La aserción de que estaba presente pasa a ausente en el mismo diff que este doc, y el PR la lista (icon-and-text-rule.md criterio 5);
  - la elección de origen del formulario completo de Stock entry sin cambios, con cada aserción sobre ella sin editar.

  0 hallazgos abiertos sobre la etiqueta.
- **A quién le toca**:
  - a un Business recién creado le toca;
  - un Business importado (incluido uno que cayó en el Onboarding antes de la Spreadsheet import) nunca lo vuelve a ver: `/onboarding` lleva a Home;
  - el Business de un User que se sumó y un Business preexistente nunca lo ven;
  - los pasos pasados recordados nunca hacen que la Spreadsheet import rechace.
- **Home limpio (criterio 8)**, tests del front en celular y computadora: Home no muestra ningún aviso del Onboarding ni "Start with your products" para un Business sin empezar, a mitad de camino, con todo hecho o pasado sin "Done", ni terminado; ninguna pantalla fuera del Onboarding enlaza a `/onboarding`; nada bajo `web/src`, `web/e2e` ni `tests` nombra `OnboardingNotice`.
- **Marco**: "+ New sale" y "Send catalog" se comportan como para cualquier Business mientras corre; el Onboarding no tiene barra ni "+ New sale"; New sale abierta desde "Done" vuelve a Home.
- **Ninguna palabra que elegir (criterio 7)**: tests del front muestran que ningún paso ni "Done" muestra "What you sell", ningún campo de Unit ni la palabra "variety"; el barrido de palabras de varieties.md cubre los textos del Onboarding.
- **Aislamiento**: las rutas están en el barrido de aislamiento y en el test de rutas protegidas; la Business removal deja 0 filas del estado y conteo exportado = conteo borrado.
- **Diseño (criterio 5)**: cada pantalla en `screens.json`, `compare.sh` antes y después, y una pasada a ojo en celular y computadora en los dos temas; el marco del paso y el paso 1 coinciden con `OnboardingVariedad` (el paso del Product) y `OnboardingCategorias` (el paso de las Expense categories). El paso de precio del paso 1 está registrado en `screens.json` y capturado antes y después de que le llegue el "$" (varieties.md).
- **Aprobación con la evidencia (criterio 6)**, leída del PR:
  - se adjuntan capturas de antes y después para cada celda de la matriz: 0 celdas faltantes;
  - cada diferencia se lista como buscada, defecto conocido del diseño o defecto: 0 sin listar;
  - 0 regresiones en el head que se integra, y cada diferencia preexistente enlazada a un issue de seguimiento;
  - cada suite pasa, y los únicos tests editados son los tests del registro dentro de sus costuras declaradas y cualquier aserción cambiada en el mismo diff que el doc que la decide;
  - no se agrega ningún paso de captura ni de comparación a `.agentic/stack.yaml`, al CI ni al Gate.
- **Métricas de negocio**, que el **Operator** lee solo de los registros existentes (sin herramienta, sin dashboard, nunca mostradas en la app):
  - la proporción de Businesses recién creados con un Product con precio y una Stock entry;
  - la proporción cuya primera Sale cae el mismo día en que se abrieron.

## Fuera de alcance

- Un paso para el nombre del Business: el nombre se toma en la Invitation.
- Los **Catalog attributes** por Product y el **Low-stock threshold** en el Onboarding.
- Un paso de Appearance.
- Un paso para los interruptores de precio de #85: lo decide ese issue una vez que existan.
- Un paso "What you sell" o cualquier pregunta por la palabra de lo que vende el Business: no existe ninguna palabra configurable.
- Preguntar la Unit en el Onboarding: se elige por Product al crearlo (#390).
- Hacerlo de nuevo, o cualquier entrada que vuelva a apuntar a él una vez que terminó.
- Cualquier aviso, insignia, recordatorio o link hacia el Onboarding en Home, Settings, More o cualquier otra pantalla; un mensaje a los Users existentes de que el aviso de Home se fue.
- "Finish for now" como segunda salida.
- Ofrecerlo a Businesses importados, de un User que se sumó o preexistentes.
- Las reglas laterales de "+ New sale" y "Send catalog" para Businesses preexistentes (navigation.md).
- Quitar `/onboarding-progress` o `/first-run` del backend: decisión aparte.
- Terminar el Onboarding desde afuera, sin llegar a "Done".
- Publicar el Catalog desde el Onboarding.
- Esperar a que se sume un socio.
- Editar o renombrar un Product guardado desde el paso 1: eso es la página del Product.
- Un campo o chip de fecha en el paso 1: siempre guarda un precio que rige desde hoy.
- Una etiqueta "Origin" sobre el chip del paso 2; cualquier cambio en la elección de origen del formulario completo de Stock entry o en su etiqueta.
- Corregir `Onboarding*.dc.html` como parte de la revisión de un cambio: diseño corrige sus propios dibujos.
- Corregir, en el cambio en revisión, una diferencia de diseño ya presente en su base de tarea: va a un seguimiento.
- Hacer de la comparación de diseño un paso del Gate, o cualquier control automático de una captura.
- Seguimiento de uso, un dashboard o un script del Operator para sus métricas.
- Ilustraciones, animación, textos de marketing, colores nuevos o componentes nuevos.
- Actualizaciones en vivo entre socios mientras está abierto.

## Planned in GH-318

Todavía no está construido. Hasta que salga la parte nombrada, las secciones de arriba son lo que hace la app.

Cada pasaje nombra el ADR que lo decide, la parte que lo va a entregar y la oración actual que va a reemplazar. La parte que entrega un pasaje lo quita de acá y edita Comportamiento y Fuera de alcance en el mismo diff.

### Configuración inicial

Decidido en docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md y docs/adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md y docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md; lo entrega la parte onboarding setup.

- La configuración inicial va a ser el Onboarding, extendido. Los pasos obligatorios van a seguir siendo un Product con precio para hoy y su Opening stock. Confirmar la zona horaria va a ser un toque dentro del flujo, con la zona horaria del teléfono que acepta como sugerencia.
- La moneda, las categorías, los atributos y la plantilla del Catalog van a ser pasos opcionales con sus valores por defecto completos ("$" con 0 decimales, "Products" y "General"). El flujo va a seguir siendo para el celular primero, con íconos y botones grandes. No va a haber paso de palabra para lo que vende el Business (no existe ninguna) ni paso de Units: la Unit se elige por Product al crearlo (#390).
- Los Businesses que existían antes del Onboarding no lo van a recibir.
- Va a reemplazar: "### Los seis pasos, en orden" (la tabla de seis pasos), "A product with today's price" (la redacción del paso 1) y "Los **Catalog attributes** por Product y el **Low-stock threshold** en el Onboarding." en Fuera de alcance.
- También va a reemplazar, en el paso 2, "Its opening stock": el Opening stock se va a ingresar en la Unit del Product (docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md).
