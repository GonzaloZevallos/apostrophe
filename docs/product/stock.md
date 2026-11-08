## Jobs

**Cuando** compro, cosecho o cuento flor, **quiero** registrarlo desde el teléfono en pocos toques (fecha, Variety, gramos, de dónde vino y cuánto costó), **para** saber cuánto tengo de cada Variety, ver que una se está por terminar antes de que un Customer me la pida y saber cuánto me costaron los gramos que vendo o regalo.

**Cuando** saco gramos de mi propio stock sin venderlos (para convidar en una fiesta y que la gente conozca el negocio, o para consumo propio), **quiero** registrarlo desde el teléfono en pocos toques (fecha, Varieties y gramos, motivo), **para** mantener bien el stock y ver en el Profit lo que me costó promocionar el negocio y lo que consumí, sin registrar una venta que nadie hizo ni un ajuste que se lee como flor perdida.

Este job afina el job de stock y el de resultados de BRIEF.md; no es un job nuevo. Antes, el vendedor registraba esos gramos como una Sale without a customer hecha de líneas de Gift (una venta que nadie hizo), como un Adjustment negativo (flor perdida, contada como faltante) o directamente no los registraba (el stock se iba corriendo hasta que el próximo conteo lo corregía como faltante).

**Cuando** saco stock sin venderlo, **quiero** archivarlo bajo un motivo con mis propias palabras, **para que** Home y Analysis muestren cuánto me cuesta cada tipo de retiro y cuánto baja mi Profit. (GH-318, motivos de retiro. Afina el job anterior para cualquier Business: los motivos dejan de ser fijos en el código y pasan a ser la lista propia del Business, de acuerdo con el criterio 4, "Assume nothing". Antes, un retiro que no encajaba se metía en el motivo fijo más parecido, o no se registraba, y su línea de costo mezclaba cosas distintas.)

**Cuando** entra flor a mi stock o sale sin venderse (la compré, la coseché, la conté o saqué un poco por un motivo propio), **quiero** elegir la Variety correcta, y en un retiro el motivo correcto, desde el teléfono en pocos toques, tenga las Varieties y los motivos que tenga, **para que** el stock por Variety quede bien y sepa qué puedo ofrecer. (GH-581, parte 3. Afina el job de stock de BRIEF.md; no es un job nuevo. Antes, la Variety se elegía de una lista nativa sin búsqueda que crecía con las Varieties, el motivo era una fila de opciones para tocar sobre los datos del Business (lo que ADR-0074 prohíbe para un Growable set), una Variety guardada que ya no está aparecía como una opción desactivada, y en el teléfono volver podía actuar sobre el formulario en lugar de la lista.)

**Cuando** llevo el negocio desde el teléfono, **quiero** mantener el stock al día desde el teléfono, **para** dejar de llevarlo en la pestaña de stock de la planilla.

**Cuando** llevo el negocio desde el teléfono entre pedidos o en medio de un chat con un Customer, varias veces por día, **quiero** que la app esté ordenada según lo que hago de verdad y con qué frecuencia, **para** volver al Customer en vez de buscar entre menús. (Es el job de navegación, navigation.md. Acá lo sirven "+ Stock entry" y "Take from stock" en Varieties, a 2 toques como máximo desde cualquier Tab root, y el stock de una Variety en su propia página.)

**Cuando** una Variety que cargué por error, o una con la que ya no trabajo, sigue apareciendo en mis listas y selectores, **quiero** sacarla desde el teléfono en pocos toques, eliminándola si nunca se movió y archivándola si tiene historial, **para que** mis listas muestren solo lo que todavía vendo, ninguna cifra pasada de ventas, stock, costo o Profit cambie, y pueda volver a tenerla exactamente como estaba si empiezo a venderla de nuevo. (Acá lo sirve rechazar Stock entries y líneas de retiro nuevas sobre una Archived variety, mientras las que ya existen siguen editables; se define en varieties.md.)

Criterios de éxito:

1. **Stock exacto**: el stock de una Variety siempre es igual a sus Stock entries menos los gramos vendidos, regalados o retirados, exacto al centésimo, sin corrimientos ni redondeos. Se cumple apenas se registra, edita o elimina una Stock entry o un retiro, y apenas se registra o elimina una Sale.
2. **Un conteo lo corrige**: el vendedor pesa lo que tiene y registra la diferencia como un Adjustment, en más o en menos. Después, el stock que se muestra es igual al conteo. La app nunca se concilia sola.
3. **Costo rastreable y acotado**: cada línea de venta o de Gift y cada línea de retiro sabe de qué Lot o Lots salieron sus gramos, primero el más antiguo, y cuánto costaron.
   - Sumando todos los Draws, el costo tomado de un Lot nunca supera el costo del Lot.
   - Una vez agotado un Lot, los costos tomados de él suman exactamente su costo.
   - Los gramos sin Lot detrás están pendientes, nunca en $0.
4. **Estado visible, sin sorpresas**: Varieties (la lista y la página de cada Variety) dice por sí sola, por forma y palabra y nunca solo por color, cuándo una Variety está agotada o por debajo de su umbral, para que el vendedor nunca se entere en medio de una venta. Una Variety sin umbral igual muestra agotado. Al lado de los gramos de cada Variety van los Days left al ritmo de los últimos 30 días.
5. **Arranque limpio**: un Business nuevo registra su stock inicial como Stock entries comunes de origen `opening stock` antes de su primera venta. Un Business que trae historial real lo pasa con el Spreadsheet import (#11). No hay regla de fechas entre el stock inicial y las ventas.
6. **Desde el teléfono**: una Stock entry se registra desde el teléfono en menos de un minuto, y todo lo de acá se hace sin llamar a la API a mano.
7. **Retiros, rápidos desde el teléfono**: un retiro se registra en menos de un minuto. Su formulario abre a 2 toques como máximo desde cualquier Tab root, y en la computadora nunca con más toques que en el teléfono.
8. **Los retiros mantienen bien el stock**: una vez que se registra, edita o elimina un retiro, el cambio se ve enseguida en el stock de la Variety, su estado, sus Days left y su historial, y en los Lots posteriores. Los gramos pendientes están pendientes, nunca en $0.
9. **Un retiro no es una venta ni una pérdida**: la cantidad de ventas, el total de ventas, el Average sale, Sales, el historial de cada Customer y el Cash quedan exactamente como estaban, y el Stock shortfall nunca incluye un retiro. Su costo se muestra solo en la línea de su Withdrawal reason (results.md, analysis.md).
10. **Los Businesses nunca se mezclan** (ADR-0004), ni en los retiros ni en sus motivos ni en las Stock entries.
11. **Nada nuevo sobre una Archived variety, nada pasado bloqueado**: una Stock entry o una línea de retiro nueva que nombra una Archived variety se rechaza como que ya no está, tanto por la API como por los formularios. Una Stock entry o un retiro que ya nombra una Variety archivada después sigue siendo editable y eliminable, y la conserva. Un formulario abierto mientras un socio archiva una Variety no pierde nada de lo tipeado.
12. **Nada cambia para un Business existente** (GH-318, motivos de retiro): ve los mismos retiros, costos, Profit y Cash. El único cambio visible es que "Promotion" ahora dice "Marketing".
13. **Un motivo propio desde el teléfono**: el dueño agrega un motivo en Settings → Business → Withdrawal reasons. La próxima vez que usa "Take from stock", el motivo nuevo aparece junto a los demás y puede registrar un retiro con él.
14. **Una línea por motivo**: Home (Week y Month) y Analysis muestran una línea de costo por motivo, en el orden de la lista del Business, y cada una baja el Profit igual que hoy (results.md, analysis.md).
15. **Encontrar entre muchas** (GH-581, parte 3): con 12 o más Varieties o motivos, el vendedor encuentra y elige uno en el teléfono tipeando parte de su nombre, sin recorrer toda la lista.
16. **Volver cierra solo la lista**: en el teléfono, abrir una lista y volver cierra solo la lista; el formulario y lo tipeado quedan, y el formulario pide confirmación al salir solo cuando tiene algo tipeado.
17. **No se pierde nada de lo que hacían las pantallas**: la línea de gramos en existencia, la Variety fija del Onboarding, conservar en una edición una Variety archivada después, la negativa sobre una línea que ya no está, el aviso de motivo eliminado, las opciones de origen y el signo de un Adjustment tipeado en los gramos.
18. **Los formularios no engañan**: mientras una lista carga, el campo muestra que carga y nunca un texto de conjunto vacío; con un conjunto vacío, dice dónde se crean las opciones.

# Stock

Lo que entra a un **Business** (**Stock entries**), lo que sale de él sin una venta (**Stock withdrawals**), lo que tiene en existencia por **Variety**, y lo que costó cada gramo vendido, regalado o retirado, tomado de los **Lots** de los que salió, primero el más antiguo. Lo ve solo su Business (ADR-0004). Lee las **Sale lines** de sales y las Varieties de varieties. Su **Cost of goods sold** alimenta el **Profit** (#7) y los márgenes (#8). El costo de los gramos retirados alimenta el Profit en una línea por **Withdrawal reason**, nunca el Cost of goods sold ni los márgenes. El costo sigue a los Lots tal como están y nunca se congela (ADR-0009). Stock no tiene pestaña propia: se muestra en Varieties, en la lista y en la página de cada Variety (varieties.md). Contra una **Archived variety** no se registra nada nuevo, ni una Stock entry ni una línea de retiro (varieties.md, ADR-0032). Los Withdrawal reasons son la lista propia de cada Business, que se edita en Settings → Business → Withdrawal reasons (ADR-0055). La Variety de una Stock entry, el motivo de un retiro y la Variety de cada línea de retiro se eligen con el **Selector** (selector.md, ADR-0074); el origen de una Stock entry es un **Fixed set**, y el signo de un Adjustment se tipea en los gramos.

## Comportamiento

### Stock entry

- **Campos**: una fecha, una Variety, gramos, un origen, un costo total opcional y una nota opcional.
- **Fecha**: por defecto, hoy en hora argentina. Se permiten días anteriores; una fecha futura se rechaza.
- **Variety**: tiene que ser una del propio Business. Cualquier otro id responde 404.
- **Archived varieties**: una Stock entry nueva que nombra una Archived variety se rechaza como que ya no está (`variety.archived`, 404). Una edición puede conservar la Archived variety que la Stock entry ya tiene, pero nunca puede pasar la Stock entry a otra Archived variety distinta (varieties.md).
- **Gramos**: hasta dos decimales, nunca cero.
  - Mayores que cero para Purchase, Harvest y Opening stock.
  - Un Adjustment puede ser positivo o negativo; el negativo se tipea con signo menos en los gramos, sin un control de signo aparte.
- **Origen**: Purchase, Harvest, Opening stock o Adjustment.
  - Opening stock no tiene límite por Variety: es un origen común.
- **Costo total**: en pesos enteros.
  - Obligatorio y mayor que $0 para una Purchase.
  - Opcional para Harvest, Opening stock y un Adjustment positivo; mayor que $0 cuando se da.
  - Se rechaza en un Adjustment negativo.
- **Nota**: opcional. Se recorta, admite hasta 200 caracteres, y vacía significa que no hay. Nunca se registra en logs, ni se busca, ni se repite en errores.
- **Edición**: todos los campos, la Variety incluida, con la misma validación que al registrar. Se confirma antes de guardar.
- **Eliminación**: definitiva, confirmada antes.
- **Stock entries ya consumidas**: ni una edición ni una eliminación se rechazan nunca porque los gramos de la Stock entry ya se hayan usado (ADR-0009). Los gramos que deja de cubrir salen del Lot siguiente, o pasan a ser Pending cost y stock negativo.

### Withdrawal reasons (motivos de retiro)

- **La lista**: cada Business tiene su propia lista de Withdrawal reasons, cada uno con un nombre y una posición.
- **Valores por defecto**: un Business nuevo arranca con "Marketing" y "Own use" en su Stored language, tomados por el puerto `BusinessDefaults` como las Expense categories. Un cambio de idioma nunca los renombra: son datos propios del vendedor.
  - Cada Business existente recibió los mismos dos, en inglés, al actualizarse la app. Cada retiro existente quedó atado al motivo que le corresponde: el que era Promotion, a "Marketing"; el que era Own use, a "Own use". Ningún retiro cambió de motivo y no se reescribió ningún valor guardado; la columna vieja del motivo queda congelada.
  - Cada Business recibe los valores por defecto una sola vez. Un motivo por defecto que se elimina nunca se vuelve a crear.
  - Los dos valores por defecto son motivos comunes, sin ningún trato especial.
- **No es una pérdida**: un Withdrawal reason nunca es una segunda forma de registrar flor perdida. Los gramos que faltan en un conteo físico siguen siendo un Adjustment negativo y se muestran como Stock shortfall.
- **Nombre**: se recorta, los espacios internos se colapsan, no puede quedar en blanco y admite hasta 60 caracteres. Es único dentro del Business sin importar mayúsculas, minúsculas ni espacios; dos Businesses pueden tener cada uno un motivo con el mismo nombre. Un nombre en blanco, repetido (también uno que un socio acaba de guardar) o demasiado largo se rechaza en línea y se conserva lo tipeado.
- **Agregar**: un motivo nuevo va al final de la lista.
- **Renombrar**: el nombre cambia en todos lados, retiros y períodos pasados incluidos. Las cifras no cambian.
- **Eliminar**: definitivo y confirmado antes. No hay estado archivado.
  - Un motivo sin retiros se puede eliminar.
  - Un motivo con retiros, de cualquier fecha, no se puede eliminar, y la pantalla dice por qué: "It can't be deleted: it still has withdrawals. You can rename it."
  - La lista siempre conserva al menos un motivo. Eliminar el último se rechaza, y la pantalla dice por qué: "It can't be deleted: you need at least one reason."
- **Orden**: cada fila tiene un botón para subir y otro para bajar, sin arrastrar. La primera fila no tiene subir y la última no tiene bajar. Mover intercambia el motivo con su vecino y se aplica enseguida. El orden decide el orden de las opciones de Reason en "Take from stock" y el de las líneas de costo en Home y Analysis.
- Cualquier User del Business puede editar la lista. No hay roles.
- Agregar un motivo desde adentro del formulario de retiro queda afuera: la lista se edita solo en Settings.

### Stock withdrawal (retiro)

- **Campos**: un Withdrawal reason, una fecha, una o más líneas de Variety y gramos, y una nota opcional.
- **Motivo**: uno de los Withdrawal reasons del Business. Se fija una vez para todo el retiro, nunca por línea. Es obligatorio y no tiene valor por defecto, ni siquiera cuando el Business tiene un solo motivo: se elige cada vez, y el formulario nunca preselecciona ninguno. Un motivo de otro Business responde 404, igual que uno que ya no existe. Una fiesta que mezcla dos motivos son dos retiros.
- **Fecha**: por defecto, hoy en hora argentina. Se permiten días anteriores; una fecha futura se rechaza. Es el día en que los gramos salieron del stock; no hay retiros planificados ni borradores.
- **Líneas**: cada una es una Variety del Business (cualquier otro id responde 404) y gramos mayores que cero con dos decimales como máximo. La misma Variety puede aparecer en varias líneas, sin fusionarse. Un retiro sin líneas se rechaza.
- **Archived varieties** (varieties.md, ADR-0032):
  - un retiro nuevo con alguna línea que nombra una Archived variety se rechaza entero como que ya no está (`variety.archived`, 404, tipo `gone`); no se registra nada;
  - una edición se rechaza igual cuando una línea nombra una Archived variety que el retiro guardado no tenía ya en alguna de sus líneas (una línea agregada sobre ella, o una línea cuya Variety se cambió a ella);
  - una edición que conserva una Variety que el retiro ya tenía, archivada después, se acepta, y todos los demás campos (fecha, motivo, gramos, nota, otras líneas) se editan como siempre;
  - abrir, editar y eliminar un retiro que toca una Archived variety siempre funciona (ADR-0009).
- **Nota**: opcional, recortada, de hasta 200 caracteres; vacía significa que no hay. Nunca se registra en logs, ni se busca, ni se repite en errores.
- **Nunca se rechaza por falta de stock** (ADR-0009). El stock puede quedar negativo y entonces se muestra agotado.
- **No se mueve dinero**: el Cash no se toca. Un retiro nunca es una venta: no está en ninguna cantidad de ventas, total de ventas, Average sale, Sales ni historial de Customer.
- **Edición**: todos los campos (fecha, motivo, líneas, nota), con la misma validación que al registrar. El motivo se puede cambiar a cualquier motivo de la lista. Guardar se confirma antes. Los Lots posteriores se vuelven a calcular.
- **Elegir en el formulario** (GH-581, parte 3): el motivo y la Variety de cada línea se eligen con el Selector (selector.md).
  - Una línea guardada cuya Variety se archivó después muestra el nombre guardado con la marca "no longer available"; esa Variety no se ofrece y guardar la conserva.
  - "That is gone." bajo una línea (con role=alert) aparece solo cuando guardar se rechaza con `variety.archived`: la línea conserva su Variety por nombre con la marca y guardar queda apagado hasta elegir otra Variety de la lista o quitar la línea. Recargar la lista nunca marca una línea ni bloquea guardar por sí solo.
  - Un motivo eliminado mientras tanto (`stock.withdrawal_reason_not_found`) vacía el campo, vuelve a leer la lista y dice "That reason is gone. Pick another."; todo lo demás tipeado queda.
  - Al editar, el campo del motivo está ocupado hasta que llega la lista; el motivo guardado sigue elegido y aparece entonces. Con la lista vacía, el Selector dice dónde crear las opciones ("No reasons yet. Add them in Settings → Business → Withdrawal reasons."; las Varieties, "No varieties yet. Add them in the Varieties tab."), nunca mientras carga.
- **Eliminación**: definitiva, confirmada con "Before deleting", que nombra el motivo por su propio nombre, la fecha y los gramos totales, por ejemplo "Delete the Marketing withdrawal from 03/10? 5 g go back to stock.", con "No, keep it / Yes, borralo". Sus gramos vuelven al stock y se reubican en los Lots por fecha.
- Ni una edición ni una eliminación se rechazan porque los gramos del retiro ya se hayan tomado de los Lots (ADR-0009).

### Lots y Cost of goods sold (ADR-0009)

- **Lots**: cada Stock entry positiva es un Lot. Su costo por gramo es el costo total sobre sus gramos.
  - Sin costo registrado, el Lot cuesta $0.
  - Un Adjustment negativo no es un Lot. Sus gramos salen como los de una venta.
- **Orden**: los gramos que salen de una Variety (líneas de venta, líneas de Gift, Adjustments negativos y líneas de retiro) se toman primero del Lot más antiguo de esa Variety.
  - Los Lots se ordenan por fecha y después por orden de registro.
  - Los gramos que salen siguen el mismo orden: por fecha, y después toma primero el que se registró primero. El motivo de un retiro nunca cambia ese orden.
  - Una Stock entry o un retiro registrados tarde o corregidos ocupan su lugar por su propia fecha, sin importar cuándo se tipearon.
- **Pending cost**: los gramos que salen más allá de todo Lot todavía no tienen costo, nunca $0. Una Stock entry posterior de cualquier origen los cubre en orden de fecha, caiga donde caiga su fecha.
- **Costo de una línea**: el costo de cada Draw es un monto en pesos enteros, redondeado una sola vez sobre todo lo que tomó de todos los Lots, nunca Lot por Lot. Los costos tomados de un Lot agotado suman exactamente su costo.
- **Adónde va el costo de cada Draw**: el de una línea de venta o de Gift es Cost of goods sold; el de un Adjustment negativo es Stock shortfall; el de una línea de retiro es el costo del Withdrawal reason de su retiro. El costo de un retiro nunca entra en el Cost of goods sold, el Stock shortfall ni el Margin de ninguna Variety.
- **Nunca se congela**: los costos siempre se calculan a partir de las Stock entries, los retiros y las ventas tal como están ahora.
  - Cualquier cambio en ellos se ve en cada costo afectado la próxima vez que se lee.
  - No hay límite de tiempo ni períodos cerrados.
  - Solo se mueven los costos de esa Variety: nunca los precios de una venta, los totales de línea, los Payments ni los Balances (ADR-0003, ADR-0007), ni los costos de otras Varieties.
- **Sobreventa**: registrar una venta, un Gift o un retiro nunca se rechaza por el stock.

### Stock, estado y Days left

- **Stock** de una Variety: la suma de los gramos de sus Stock entries, con signo, menos los gramos de sus líneas de venta (Gifts incluidos) y de sus líneas de retiro. Puede ser negativo, y siempre se muestra como cifra.
- **Estado**: se revisa en este orden, y vale el primero que corresponda.
  1. **Sin movimientos**: no se movió nada de la Variety: ninguna Stock entry, ninguna venta ni Gift y ningún retiro. Su stock es exactamente 0.
  2. **Agotado**: stock ≤ 0. Incluye una Variety con ventas, Gifts o retiros pero sin Stock entry, y una cuyas Stock entries suman 0 (ADR-0009: la sobreventa se muestra agotada enseguida). Muestra la fecha del movimiento (un retiro incluido) después del cual el stock quedó en 0 o menos ("No grams since 30/09"); para una Variety sin Stock entries, es el día de su primera venta, Gift o retiro.
  3. **Bajo**: stock > 0 y por debajo del Low-stock threshold de la Variety.
  4. **Ok**: en cualquier otro caso.
- **Low-stock threshold**: opcional, por Variety, mayor que cero, con hasta dos decimales. Se fija o se desactiva en la página de la Variety, en "Low stock warning". Sin umbral, una Variety nunca está baja, pero igual puede estar agotada.
- **Days left**: stock ÷ (gramos vendidos, regalados o retirados en los últimos 30 días, hoy incluido, ÷ 30), redondeado hacia abajo a días enteros. No se muestra nada cuando el stock es ≤ 0 o cuando no salió ningún gramo en esos 30 días.
- **Total**: la suma del stock de todas las Varieties. La API lo responde; ninguna pantalla lo muestra.

### En pantalla (en Varieties y Settings)

- **No hay pestaña Stock.** El stock vive en Varieties (varieties.md, navigation.md); el path viejo de Stock redirige ahí.
- **Por Variety**, en la lista de Varieties y arriba de su página: sus gramos, su marca de estado y su detalle ("No grams since 30/09", "You are warned below 20 g", "At the pace of the last 30 days", y "Add its first entry" solo cuando no tiene movimientos), más los Days left.
- **Marcas de estado** (`MarcaEstado`): se distinguen por forma y palabra, nunca solo por color.
  - cuadrado = agotado, como el chip invertido, no rojo;
  - círculo lleno = bajo;
  - círculo vacío = ok.
- **"Stock and entries"** en la página de una Variety: sus últimos 3 movimientos (Stock entries y retiros) y "See all" para todos los movimientos de esa Variety, la fecha más reciente primero y después el registrado más recientemente primero.
  - Una fila de retiro muestra su fecha, el nombre actual de su Withdrawal reason y los gramos de esa Variety en él con signo menos (por ejemplo "−5 g"): la salida se dice con palabra y signo, nunca con color. Un retiro que toca varias Varieties se muestra en la página de cada una.
- **"All entries"**, al pie de Varieties: un detalle ("‹ Varieties") con cada Stock entry del Business, con fecha, Variety, origen, gramos, costo total y costo por gramo, la fecha más reciente primero y después la registrada más recientemente primero. Cada una se puede editar o eliminar. Lista solo Stock entries, nunca retiros; no hay una lista de retiros de todo el Business.
  - Su estado vacío: "No stock entries · Enter your initial stock or a purchase".
- **Stock entry nueva** (`EntradaStock`), un formulario (navigation.md): "Close", y una confirmación al salir con algo tipeado.
  - Se abre desde "+ Stock entry" en Varieties (el vendedor elige la Variety), desde "+ Entry" en la página de una Variety (con esa Variety ya elegida, y con "Initial stock" preseleccionado como origen cuando la Variety todavía no tiene Stock entries) y desde el paso de stock del Onboarding (`StockStep`, con su Variety ya fijada por el paso anterior).
  - fecha (con hoy), gramos (un Adjustment negativo se tipea con signo menos, como hasta ahora), y Variety con "It has N g today";
  - **Variety**: un Selector obligatorio sobre las Varieties sin archivar, en orden por nombre, que recibe como `loading` el estado de la consulta de Varieties (pendiente, o fallida sin datos; nunca una recarga en segundo plano, que no cierra una lista abierta). La línea "It has N g today" sigue debajo del campo.
    - Abierto desde la página de una Variety, el Selector llega con esa Variety elegida y se puede cambiar por otra. Una Variety preseleccionada (`?variety=<id>`) que no está en la lista cuenta como ninguna elegida.
    - En el paso de stock del Onboarding la Variety se muestra como texto fijo, sin Selector, y "Initial stock" es la única opción de origen, fija: ahí nunca se abre una lista ni aparece el texto de conjunto vacío.
  - **Editar una Stock entry cuya Variety ya no está en la lista** (archivada después): el campo muestra el nombre guardado de la Variety con la marca "no longer available" (`selected`), y esa Variety nunca se ofrece. Guardar otros cambios (gramos, fecha, costo, origen) conserva la Variety guardada: la marca es solo información (ADR-0009). Elegir otra Variety la reemplaza.
    - Si falla la consulta que trae el nombre de la Variety archivada, en lugar del Selector, bajo la misma etiqueta "Variety", aparece el aviso de sin conexión o de error, que al tocarlo reintenta solo esa consulta; el campo no queda ocupado y guardar igual envía la Variety guardada.
  - origen: Purchase · Harvest · Initial stock · Adjustment, como opciones para tocar. Es un Fixed set declarado en `web/src/components/fixedSets.ts` (`STOCK_ENTRY_ORIGINS`) con el motivo "fixed set: Stock entry origins"; su aspecto y su comportamiento no cambian. Es el único Fixed set del formulario: el signo de un Adjustment no tiene control propio;
  - costo total, con "Required for a purchase";
  - nota;
  - el costo por gramo antes de guardar ("It comes to $ 8.500 per gram") siempre que haya un costo.
- **Take from stock**, el formulario de retiro, un formulario (navigation.md): "Close", sin barra, sin "+ New sale", y una confirmación al salir con algo tipeado. Sigue el estándar del teléfono para campos y zonas de toque (#80).
  - Se abre desde More (segundo, después de "+ Add expense"), desde el "Take from stock" secundario de Varieties (junto a "+ Stock entry", en teléfono y computadora), sin Variety elegida, y desde "Take from stock" en la página de una Variety, con esa Variety ya elegida. La página de una Archived variety no ofrece "Take from stock".
  - motivo, fecha (con hoy), una o más líneas de Variety y gramos, y nota.
  - **Reason**: un Selector obligatorio sobre los Withdrawal reasons del Business, en el orden de su lista, leídos de la API al abrir el formulario y con el estado de esa consulta como `loading`. Ninguno arranca elegido, ni siquiera con un solo motivo, y "Save the withdrawal" queda desactivado hasta que se elige uno; no se pierde nada de lo tipeado. Si la API igual recibe un retiro sin motivo, lo rechaza con "Pick a reason.".
  - **Variety de cada línea**: un Selector obligatorio que ofrece solo Varieties sin archivar. Una Variety elegida en una línea se sigue ofreciendo en las demás, en el mismo orden y sin excluir nada. Si se abre con una Variety preseleccionada que está archivada o no existe (`/withdrawals/new?variety=<id>`), el formulario abre sin Variety elegida, como si se hubiera abierto sin ninguna; no se registra nada contra esa Variety y no se muestra ningún mensaje por ella.
  - Editar abre el mismo formulario con el retiro cargado y su propio motivo elegido; mientras la lista de motivos se carga, el campo Reason se muestra ocupado y el motivo guardado sigue elegido, nunca se borra, y aparece al llegar la lista. Guardar una edición se confirma antes.
  - **Editar un retiro que toca una Variety archivada después**: cada línea así muestra en su Selector el nombre guardado de su Variety con la marca "no longer available" (`selected`), y esa Variety nunca se ofrece. El vendedor puede conservarla (guardar funciona), elegir otra Variety sin archivar o quitar la línea.
  - **Una Variety archivada mientras el formulario está abierto** (la archivó un socio): guardar se rechaza con `variety.archived`, según la regla "That is gone" de accounts.md:
    - el formulario queda abierto y no se borra nada de lo tipeado, incluida la Variety de cada línea culpable, que se sigue mostrando por su nombre con la marca "no longer available";
    - debajo de cada línea culpable se muestra "That is gone." (role=alert, atado al campo con `aria-describedby`), y la lista de Varieties se actualiza con el Selector ocupado, sin desmontarlo;
    - el formulario no se puede volver a guardar mientras una línea culpable siga nombrando la Variety archivada: el vendedor elige otra Variety o quita la línea, y eso borra su mensaje.
  - **Un motivo eliminado mientras el formulario está abierto** (lo eliminó un socio): guardar se rechaza con `stock.withdrawal_reason_not_found`, según la misma regla "That is gone" de accounts.md. El formulario queda abierto con todo lo tipeado, la lista de motivos se actualiza, Reason queda vacío y el campo muestra "That reason is gone. Pick another." con role=alert y el Attention icon.
- **Conjuntos vacíos y carga en los dos formularios**:
  - sin Varieties en la lista (un Business nuevo, o todas archivadas), la lista del Selector de Variety muestra "No varieties yet. Add them in the Varieties tab." (`emptyStates.selectorNoVarieties`), en los dos formularios;
  - sin motivos, la lista de Reason muestra "No reasons yet. Add them in Settings → Business → Withdrawal reasons." (`emptyStates.selectorNoReasons`); es una red de seguridad, porque la lista de motivos siempre conserva al menos uno;
  - estos textos aparecen solo después de una carga exitosa. Mientras una lista carga, o después de una carga fallida, el campo queda ocupado (`aria-busy`, esqueleto) sin ningún texto de conjunto vacío, y el manejo de errores de la pantalla dice qué falló.
- **Historial, volver y Escape** en `EntradaStock` (desde Varieties o desde la página de una Variety), en el `StockStep` del Onboarding y en `WithdrawalFormRoute` (nuevo y edición), cada uno con un `SheetStackProvider` en su raíz:
  - un formulario sin nada tipeado: volver va a la pantalla madre;
  - un formulario con algo tipeado: volver abre la confirmación al salir;
  - con una lista del Selector abierta en el teléfono: volver cierra solo la lista y conserva lo tipeado; un segundo volver abre la confirmación si hay algo tipeado;
  - en la computadora, Escape con el desplegable abierto cierra solo el desplegable;
  - el `StockStep` no tiene Selector, así que ahí valen solo los dos primeros casos.
- **El detalle de un retiro**, abierto desde su fila: un detalle (navigation.md), con la barra o la barra lateral y un "‹" de regreso a la página de la Variety desde la que se llegó (Varieties cuando no hay historial), y sin "+ New sale". Muestra la fecha, el nombre actual del motivo ("Reason: Marketing"), cada línea y la nota, con "Edit" y "Delete", también cuando la Variety de una línea está archivada.
- **Settings → Business → Withdrawal reasons** (`/settings/withdrawal-reasons`):
  - **Entrada**: una fila "Withdrawal reasons" en el grupo Business de Settings, debajo del nombre del Business, con su ícono, la etiqueta y una flecha, hecha con la fila de entrada común de Settings. La pantalla tiene "Close" y el regreso del teléfono sigue el historial.
  - **Arriba**: el título y la línea "The reasons you pick when you take stock out without selling it."
  - **Filas**: cada motivo del Business en el orden de su lista. Por fila: el nombre (cortado con puntos suspensivos si es largo); los botones "Up" y "Down" con texto visible y nombres accesibles "Move <name> up" y "Move <name> down" (la primera fila no tiene "Up" y la última no tiene "Down"); y "Rename" y "Delete", visibles con ícono y texto. Cada botón mide al menos 44×44.
  - **Agregar y renombrar**: "Add reason", al pie de la lista, abre una Sheet ("Add reason") con un solo campo de nombre y la acción principal fija abajo; "Rename" abre la misma Sheet ("Rename reason") con el nombre ya cargado. "Close", Escape y el gesto de volver la cierran sin guardar nada. Las negativas se muestran en línea dentro de la Sheet y conservan lo tipeado: "Write a name.", "Use 60 characters or fewer." y "You already have a reason with that name.". Al guardar, la lista se vuelve a leer de la API.
  - **Mover**: se aplica con un toque y la pantalla muestra la lista que responde la API. Mientras se guarda, los botones de mover quedan desactivados. Si falla, dice "The order wasn't saved. Try again."; si el motivo ya no está, la lista se vuelve a leer.
  - **Eliminar**: "Delete" pregunta "Delete the reason <name>?". Las dos negativas ("It can't be deleted: it still has withdrawals. You can rename it." y "It can't be deleted: you need at least one reason.") se muestran como un aviso en pantalla debajo de la lista, con el Attention icon al lado de la oración, y el dueño sigue en la pantalla.
  - **Estados**: cargando, con la lista (nunca hay estado vacío: la lista siempre tiene un motivo), sin conexión y error con reintento, con los componentes comunes.
- **Editar una Stock entry**: guardar se confirma antes.
- **Eliminar una Stock entry**: se confirma con "Before deleting", que nombra la fecha, la Variety y los gramos.
- **Pending cost**, donde se muestre el costo de una línea:
  - "Pending cost" cuando no hay ninguna parte de la línea con costo;
  - la parte con costo más "and N g without cost" para una línea partida;
  - un Gift dice "Gift".
- **Toasts**: "Entry saved", "Entry deleted", "Warning saved", "Withdrawal saved", "Withdrawal deleted", "Reason saved" y "Reason deleted". Ninguno lleva gramos, montos ni nombres.
- **Las negativas** de los formularios se muestran en línea y conservan lo tipeado.
- **Una Stock entry, un retiro o un motivo que ya no está** siguen la regla "That is gone." de accounts.md: abrir uno ofrece volver a su pantalla madre ("Back to Varieties" para Stock entries y retiros); guardar, eliminar o confirmar sobre él muestra "That is gone. The list is up to date.", y en Withdrawal reasons la lista se vuelve a leer.
- **Pinned catalog**: registrar, editar o eliminar una Stock entry o un retiro dispara la Upkeep (pinned-catalog.md). Editar los motivos no la dispara: el Catalog no los muestra.

### Restricciones

- Cada tabla de stock, de retiro y de Withdrawal reason lleva `business_id`, y se lee solo a través de un repositorio hecho para un único Business. El Business sale de la Session.
- Cada ruta entra en el barrido de aislamiento, en la prueba de rutas protegidas y en la prueba de migración de pertenencia. Un motivo de otro Business responde 404 tanto en el path como cuando se usa como motivo de un retiro.
- La Business removal exporta y elimina los retiros, sus líneas y los Withdrawal reasons mediante la reflexión de esquema de ADR-0015.
- La migración de los motivos solo agrega la tabla, la columna nueva del retiro y las filas por defecto, y llena la columna nueva a partir del valor viejo; nunca cambia el valor de una columna existente, y el comparador M3 compartido de `tests/migrations/` lo prueba.
- Las negativas llevan códigos de `contract.json` (ADR-0008) y nunca repiten la nota, los gramos, los montos ni los nombres (ADR-0005). Una Archived variety nombrada por una Stock entry o una línea de retiro nueva responde el `variety.archived` que ya existe en varieties (tipo `gone`); no hay un código propio de retiros para eso.
- Ninguna nota, gramo, monto ni nombre de motivo va a los logs, la consola ni el almacenamiento del navegador.
- Todo texto nuevo de pantalla sale del Copy module, en el Product language; los motivos por defecto no llevan ninguna palabra de flor.
- La Variety y el Withdrawal reason son Growable sets: se eligen solo con el Selector, nunca con chips, opciones para tocar ni un `<select>` nativo (ADR-0074). Solo el origen de una Stock entry, un Fixed set, se muestra como chips. Ningún conjunto leído de los datos del Business se declara en `fixedSets.ts`, y tampoco se declara ahí un conjunto para el signo de un Adjustment, que no tiene control propio.
- El Mobile check tiene los estados `stock-entry/variety-selector-open` (con 12 Varieties, así aparece la búsqueda), `stock-entry/edit-archived-variety`, `stock-entry/edit-archived-variety-failed`, `withdrawal/reason-selector-open` y `withdrawal/line-archived-variety`. Las listas de infractores no tienen ninguna entrada de `EntradaStock` que el cambio al Selector dejó obsoleta, y el cambio no agregó ninguna.

## Métricas

- **Stock exacto (criterios 1, 8)**: después de cada tipo de operación (registrar, editar o eliminar una Stock entry o un retiro; registrar o eliminar una venta), el stock es igual a lo que entró menos lo que salió, al centésimo. 100% de aprobación.
- **El conteo corrige (criterio 2)**: un stock N más un Adjustment de (conteo − N) da el conteo, con los dos signos.
- **Conservación de los Lots (criterio 3)**: para cada Lot, los gramos tomados son ≤ sus gramos y el costo tomado es ≤ su costo, y los dos son iguales una vez agotado el Lot, retiros incluidos. Un Draw que abarca varios Lots se redondea una sola vez. Los gramos pendientes nunca se costean en $0.
- **Recálculo (criterios 3, 8)**: una Stock entry o un retiro con fecha atrasada, editados o eliminados mueven los costos solo de esa Variety. Los precios, los totales de línea, los Payments y las demás Varieties no cambian. 100% de aprobación.
- **Sobreventa (criterio 3)**: una venta o un retiro que supera el stock se registra. El stock queda negativo y el estado dice agotado.
- **Estado (criterio 4)**: la matriz de nada movido (sin movimientos), ventas sin Stock entries (agotado), solo un retiro (no "sin movimientos"), Stock entries que suman 0 (agotado), bajo, ok y sin umbral, más Days left contando los gramos retirados y "No grams since" siguiendo la fecha de un retiro: 100%. Ningún estado se dice solo por color.
- **Stock entry desde una Variety**: una Stock entry empezada desde la página de una Variety llega con esa Variety elegida en el Selector, que se puede cambiar, y con "Initial stock" preseleccionado solo cuando no tiene Stock entries.
- **Ni venta ni pérdida (criterio 9)**: después de registrar un retiro de cualquier motivo, 0 diferencias en el total y la cantidad de ventas, el Average sale, Sales, el Balance y la cuenta de cada Customer, el Cash, el Stock shortfall, y el Margin y los gramos vendidos o regalados de cada Variety.
- **Matriz de validación de retiros**: gramos en cero o menos, más de dos decimales, una fecha futura, un motivo faltante, un motivo de otro Business, ninguna línea, una nota de más de 200 caracteres y una Variety de otro Business dan cada uno su propia negativa con código, que nunca repite lo ingresado.
- **Archived varieties, API (criterio 11)**: por HTTP, 100% de aprobación:
  - un retiro nuevo con una línea sobre una Archived variety responde 404 `variety.archived` y escribe 0 filas;
  - una edición que agrega una línea sobre una Archived variety que el retiro guardado no tenía, o que mueve una línea a ella, responde lo mismo y no cambia nada;
  - una edición que conserva una Variety que el retiro ya tenía, archivada después, se acepta, con sus gramos, fecha, motivo y nota cambiados como se enviaron;
  - abrir y eliminar un retiro que toca una Archived variety funcionan;
  - la misma matriz para Stock entries (nueva rechazada, conservada aceptada, movida a otra archivada rechazada).
- **Archived varieties, formulario (criterios 11, 17)**: pruebas de Testing Library, 100% de aprobación:
  - `/withdrawals/new?variety=<id archivado>` abre sin Variety elegida;
  - editar un retiro con una línea sobre una Variety archivada después muestra en su Selector el nombre de esa Variety con la marca "no longer available", no la ofrece y guarda conservándola; lo mismo para una Stock entry editada, que además, si falla la consulta del nombre, muestra el aviso con reintento y guarda conservando la Variety;
  - un guardado rechazado con `variety.archived` deja el formulario abierto con cada campo, incluidos la Variety de la línea culpable y su nombre con la marca, muestra "That is gone." debajo de esa línea y deja guardar deshabilitado hasta que se elija otra Variety o se quite la línea. Ninguna prueba afirma que el campo de Variety de la línea culpable se vacía.
- **M1, nada cambia para un Business existente (criterio 12)**: el comparador M3 no muestra ningún cambio en ninguna columna que existía antes de la migración. Sobre una historia sembrada, cada retiro, el costo de cada motivo, el Profit y el Cash dan lo mismo antes y después, en Home y en Analysis: 0 diferencias. La única etiqueta que difiere es "Promotion" → "Marketing".
- **M2, un motivo propio desde el teléfono (criterio 13)**: la corrida de punta a punta del front, en tamaño teléfono, entra a Settings → Business → Withdrawal reasons y agrega un motivo. Después abre "Take from stock", encuentra el motivo nuevo al final de la lista del Selector de Reason sin nada preseleccionado, registra un retiro con él y lee su línea de costo en Week de Home.
- **M3, una línea por motivo (criterio 14)**: la métrica de acuerdo de results.md y analysis.md, sobre una historia con tres o más motivos, uno renombrado, uno reordenado y uno con gramos pendientes.
- **M4, reglas de la lista**: pruebas con TestClient de agregar, renombrar, subir, bajar y eliminar; de un nombre en blanco, uno repetido sin importar mayúsculas ni espacios y uno de más de 60 caracteres; de eliminar un motivo con retiros y de eliminar el último. 100% de aprobación. Las pruebas del front cubren las negativas, los toasts, los nombres accesibles de los botones de mover y un motivo que ya no está mientras el formulario de retiro está abierto (el campo se vacía, lo demás queda y aparece "That reason is gone. Pick another.").
- **M5, encontrar entre muchas (criterio 15)**: pruebas de vitest con la API simulada en fetch, con 12 o más Varieties y 12 o más motivos sembrados. En cada formulario hay un Selector, y no hay ningún grupo de radio, botón `aria-pressed` ni `<select>` nativo, salvo las opciones de origen de la Stock entry. Tipear parte de un nombre en la búsqueda deja elegirlo. 100% de aprobación.
- **M6, volver cierra solo la lista (criterio 16)**: para `EntradaStock` desde la página de una Variety y en edición, y para `WithdrawalFormRoute` nuevo y edición: sin nada tipeado, volver va a la pantalla madre; con algo tipeado, volver abre la confirmación; con la lista abierta, volver cierra solo la lista y conserva lo tipeado, y un segundo volver abre la confirmación si hay algo tipeado; en la computadora, Escape con el desplegable abierto cierra solo el desplegable. Para el `StockStep`, que no tiene Selector, solo los casos sin nada tipeado y con algo tipeado. 100% de aprobación.
- **M7, nada se pierde (criterio 17)**: siguen en verde las pruebas de la línea "It has N g today", la Variety fija del Onboarding mostrada como texto, las opciones de origen (mismo aspecto y comportamiento, "Initial stock" preseleccionado incluido), un Adjustment negativo tipeado con signo menos en los gramos (sin costo, nunca cero), la negativa sobre una línea que ya no está y el motivo eliminado mientras el formulario está abierto.
- **M8, los formularios no engañan (criterio 18)**: mientras una consulta carga o después de una carga fallida, el campo tiene `aria-busy` y no hay texto de conjunto vacío; después de una carga exitosa sin opciones, la lista muestra el texto que nombra su lugar. Una recarga en segundo plano con la lista abierta la deja abierta con su búsqueda. 100% de aprobación.
- **M9, Mobile check**: los estados `stock-entry/variety-selector-open`, `stock-entry/edit-archived-variety`, `stock-entry/edit-archived-variety-failed`, `withdrawal/reason-selector-open` y `withdrawal/line-archived-variety` pasan sin infractores nuevos, y no queda ninguna entrada obsoleta.
- **Aislamiento (criterio 10)**: cada ruta de stock, de retiro y de motivos está en el barrido y responde 404 o vacío desde otro Business, incluida una referencia a una Variety o a un motivo de otro Business.
- **Sin eco**: ninguna negativa ni log contiene la nota, los gramos, los montos ni el nombre de un motivo. Después de una corrida completa del front, la consola y el almacenamiento del navegador no tienen ninguno de ellos.
- **Velocidad (criterios 6, 7)**: una Stock entry y un retiro se registran cada uno desde el teléfono en menos de 60 s por el front, y cada formulario abre a 2 toques como máximo desde cualquier Tab root, en ventanas de teléfono y de computadora, nunca con más toques en la computadora. Leer el stock y los costos responde en menos de 300 ms con unas decenas de Varieties.
- **Pantallas de retiro**: las pruebas del front muestran el marco del formulario y su confirmación al descartar, el marco del detalle, las confirmaciones de edición y de eliminación (esta con el nombre del motivo), "Withdrawal saved" y "Withdrawal deleted", los dos formularios de "That is gone.", las filas de historial distinguidas por palabra y signo, y "All entries" sin ningún retiro.
- **Sin curl (criterios 6, 7, 13)**: la corrida de punta a punta del front registra una Stock entry desde Varieties y otra desde la página de una Variety, edita y elimina una desde "All entries", fija y desactiva un umbral en la página de una Variety, registra un retiro desde More y otro desde la página de una Variety, edita y elimina un retiro, y agrega, renombra, reordena y elimina un motivo, una eliminación rechazada incluida.
- **Como en el diseño**: comparaciones antes y después de `scripts/design/compare.sh` para el formulario de Stock entry, el formulario de retiro, su detalle, Varieties y la página de una Variety, en teléfono y computadora, juzgadas a ojo. Los dibujos de Stock entry y de Take from stock en `docs/product/design-system/pantallas/EntradaStock.dc.html` muestran el Selector con los textos en inglés. Settings → Business → Withdrawal reasons no tiene dibujo: está en el registro de pantallas para el Mobile check, pero no tiene comparación, y se juzga contra este texto y contra el patrón de Expense categories.
- **Medida de negocio**, que lee el Operator solo a partir de los registros existentes y nunca se muestra en la app: la proporción de Businesses con algún motivo además de los dos por defecto.

## Fuera de alcance

- Cómo los resultados (#7) y los márgenes (#8) presentan el Pending cost, el Draw de un Adjustment negativo y el costo de un retiro: results.md y analysis.md.
- Reconstruir los Lots desde la planilla: es tarea del Spreadsheet import (#11).
- Una regla de fechas entre el Opening stock y las ventas.
- Repartir los insumos de cultivo entre las Harvests: son Expenses.
- Actualizaciones en vivo entre socios; historial de ediciones de una Stock entry o de un retiro.
- Notificaciones fuera de la app.
- Una pestaña Stock, o los gramos totales en pantalla.
- Una lista de retiros de todo el Business; un desglose por Variety del costo de cada motivo.
- Retiros planificados o borradores; partir un retiro entre dos motivos.
- Quiénes fueron a una fiesta o cuántos probaron; atar un retiro a ventas posteriores; la plata gastada en una fiesta (es una Expense).
- Registrar una Stock entry o una línea de retiro nueva contra una Archived variety, por cualquier camino; ofrecer Archived varieties en los selectores de Stock entry o de retiro.
- Un estado archivado para los Withdrawal reasons; pasar retiros pasados a otro motivo en bloque; ordenar los motivos arrastrando; agregar un motivo desde el formulario de retiro; roles o permisos sobre la lista.
- Renombrar los términos del glosario Promotion y Own use: queda para las partes dueñas de Promotion y de Applied promotion.
- Excluir en una línea de retiro las Varieties ya elegidas en otras líneas; un motivo por defecto; un texto vacío propio para el caso de todas las Varieties archivadas; crear una Variety desde los formularios de Stock entry o de retiro; cambiar las opciones de origen más allá de declararlas como Fixed set; agregar un control para el signo de un Adjustment, que se sigue tipeando en los gramos; pulido dedicado para la computadora.

## Planificado en GH-318

Todavía no está construido. Hasta que salga la parte indicada, las secciones de arriba son lo que hace la app.

Cada pasaje nombra el ADR que lo decide, la parte que lo va a entregar y la oración actual que va a reemplazar. La parte que entrega un pasaje lo saca de acá y edita Comportamiento y Fuera de alcance en el mismo diff.

### Unidades

Decidido en docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md; lo entrega la parte de unidades.

- Las Stock entries, los retiros, el umbral y cada cifra de stock van a estar en la unidad propia del Product, guardados como un número entero de centésimos. Los totales de retiros y de Gifts van a mostrar un monto por unidad, cada uno con su etiqueta, y nunca se van a sumar entre unidades.
- Va a reemplazar: "una o más líneas de Variety y gramos" y "gramos mayores que cero con dos decimales como máximo".

### El día del negocio

Decidido en docs/adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md; lo entrega la parte de zona horaria.

- Va a reemplazar: "**Fecha**: por defecto, hoy en hora argentina." en la Stock entry y en el retiro.

### Plata

Decidido en docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md; lo entrega la parte de plata.

- El costo de un Lot y las cifras de costo se van a guardar en la escala de plata del Business y van a viajar en unidades de moneda. El redondeo con mitad hacia arriba de la asignación de un costo va a pasar por `round_half_up`, que la parte de plata crea en `app/shared/money.py` (ADR-0058).
- Va a reemplazar: "**Costo total**: en pesos enteros." y "Su costo por gramo es el costo total sobre sus gramos." (la asignación redondea con el único helper).
