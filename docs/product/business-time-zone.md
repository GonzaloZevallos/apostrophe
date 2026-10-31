# Business time zone

## Jobs

- When my business runs on a clock other than Argentina's, I want to set its time zone in Settings, once or again when I move, so that "today" in the app (my sales, my prices, my stock days left, my best days and my pinned catalog) starts and ends at my own midnight, without changing anything I already recorded.

Criterios de éxito:

1. Una Sale registrada a las 23:30 hora local cuenta en ese día local en Home, Sales y Analysis; lo mismo vale para todo otro "today" de la app.
2. El Pinned catalog se edita solo como máximo una vez por día del Business, y solo cuando cambió su texto. Guardar una zona nueva lo pone al día en el momento si el nuevo "today" cambia su texto.
3. Los Businesses existentes no ven ningún cambio: mismos días, mismas cifras, mismo Pinned catalog.
4. Cambiar la zona nunca mueve nada de lo ya registrado.

Sin esta capacidad no hay workaround: todo Business que usa la app está en Argentina, y uno de otro lugar no podría llevar la app en su propio día. La motivación es el criterio 4, Assume nothing. ADR-0057 ya decidió que la Business time zone reemplaza los días de Argentina.

## Qué es

Cada Business tiene exactamente una Business time zone: un nombre IANA (por ejemplo `America/Argentina/Buenos_Aires`), guardado en `business.time_zone`, que nunca está vacío. Decide cuándo empieza y termina el día de ese Business. Todo Business existente queda con `America/Argentina/Buenos_Aires`, sin que la migración cambie ningún valor que ya existía; un Business nuevo recibe ese mismo valor por defecto y lo cambia en Settings. Onboarding no tiene paso de zona; tomar la zona del teléfono para un Business nuevo es una parte posterior de GH-318.

## Un solo reloj por Business

Siguen la zona del Business:

- Home: Today, Week y Month (Panel).
- La fecha por defecto de toda Sale, Payment, Stock entry y Expense nueva.
- El Current price de hoy.
- Days left, Best week y Best weekday, que cuentan días calendario en esa zona.
- La Upkeep diaria del Pinned catalog y la fecha del último envío que muestra su estado.
- El Spreadsheet import en ese Business, que usa la zona del Business de destino.

Ninguna pantalla ni lector sigue la hora de Argentina por su cuenta. Ningún día se calcula sin la zona de su propio Business: el código obtiene el día con `get_today` en `accounts/adapters/deps.py` (que lee el reloj inyectado y la zona del Business de la sesión) o con `business_day(instant, zone)` de `app/shared/calendar.py`, pasándole la zona de ese Business. `BUSINESS_TIMEZONE` deja de existir. Los archivos que pueden llamar a `business_day` forman una lista cerrada que un test de arquitectura hace cumplir; la lista concreta es una decisión técnica. Un caso de uso sigue recibiendo `today` como una fecha simple y nunca lee una zona (ADR-0057).

## Settings → Business → Time zone

- **La fila**: el grupo Business de Settings muestra la fila "Time zone" con la zona que está guardada ahora, en una sola línea en el teléfono. La hora local no se muestra en la fila.
- **Elegir**: una lista con búsqueda de todas las zonas. La búsqueda funciona por lugar (por ejemplo "Mexico" o "Madrid"); la lista muestra el nombre propio de la zona, y ese nombre es lo que se guarda. No hay lista corta (supondría dónde están los Businesses) ni texto libre.
- **Valor inicial**: la zona guardada del Business.
- **Hora local**: debajo de la elección se muestran la fecha y la hora locales actuales del Business en la zona elegida, y se actualizan al elegir otra, para comprobarla antes de guardar.
- **La consecuencia, visible**: una línea corta, visible debajo del campo, dice que los registros pasados conservan sus fechas y que solo cambian "today" y la actualización diaria del catálogo. More info puede ir al final de esa línea, según la Icon and text rule; la línea nunca vive solo detrás de la "i", porque More info nunca es una consecuencia.
- **Guardar**: un toque, sin paso de confirmación.
- **Quién**: cualquier User del Business, porque no hay roles. Los demás Users no reciben aviso; ven el nuevo "today" en su próxima carga.
- **Textos**: todos vienen de los textos del Tech Writer y viven en el Copy module; ningún valor por defecto nuevo lleva una palabra de flor.

## Guardar

- **Una zona distinta**: primero se guarda la zona. Después del commit se dispara la Upkeep una vez: el Pinned catalog se edita solo si su texto cambió, y nunca se envía ni se fija. Si esa edición falla, la zona queda guardada y se muestra el estado Out of date existente con su motivo fijo (ningún motivo nuevo); la pantalla Time zone no muestra ningún error. Un Business que nunca publicó un Pinned catalog no hace nada en Telegram.
- **La misma zona ya guardada**: no cambia nada, no corre la Upkeep y la pantalla se cierra como un éxito normal.
- **Una zona que la app no acepta** (solo posible con un pedido armado a mano o una lista vieja): se rechaza y la zona guardada queda como estaba. La pantalla muestra un único mensaje fijo del Copy module con el Attention icon, y el vendedor vuelve a elegir de la lista. El `detail` de la API nunca se muestra (Product language), y el rechazo no revela nada de ningún otro Business.

## Las fechas registradas no cambian nunca

- Toda Sale, Payment, Stock entry, Expense y Price entry conserva la fecha con que se registró; los instantes guardados siguen en UTC. Solo "today" y las cuentas basadas en días calendario siguen la zona nueva.
- **Atrasar el reloj** (mover la zona al oeste) puede dejar registros con fecha posterior al nuevo "today":
  - conservan su fecha y siguen en toda lista, historial y total; nada se oculta, mueve ni vuelve a fechar;
  - una Price entry con fecha posterior al nuevo "today" no es el Current price hasta que esa fecha llega en la zona del Business;
  - el Today de Home muestra solo el nuevo "today"; Week y Month cubren los períodos que lo contienen;
  - la fecha por defecto de los registros nuevos es el nuevo "today".

## Upkeep

- Reemplaza el disparador "the start of a new day in Argentina time" de pinned-catalog.md: la Upkeep diaria corre al comenzar el día en la zona propia de cada Business.
- Un Pinned catalog publicado está pendiente cuando `last_checked_on` está vacío o es distinto del "today" propio del Business ("distinto", no "anterior", ADR-0057). El ticker de 300 segundos calcula el día de cada Business con su zona, así que uno al oeste de Argentina no se revisa temprano ni uno al este tarde.
- Un Business que movió su zona al oeste se revisa una vez más; esa revisión edita solo si el texto cambió.
- Guardar una zona distinta es un disparador de Upkeep, después del commit; el guardado nunca espera a Telegram ni falla por él.

## Aislamiento y export

- El Business siempre sale de la sesión; ningún pedido nombra un Business, y ninguna respuesta revela la zona de otro ni que existe.
- La ruta que cambia la zona está protegida por la sesión, entra en el barrido de aislamiento y en el test de rutas protegidas.
- La zona guardada forma parte del Business export.

## Métricas

La instalación corre local, sin telemetría. Cada métrica es una cifra que afirman los tests.

- **Día local (criterio 1)**: en un Business con una zona distinta de la de Argentina, una Sale registrada a las 23:30 hora local con el reloj movible cuenta en ese día local en Home (Today, Week, Month), Sales y Analysis; las fechas por defecto, el Current price, Days left, Best week y Best weekday siguen esa zona. 100% en verde.
- **Catálogo quieto (criterio 2)**: zona movida al oeste y al este: exactamente 1 edición cuando el texto cambia, 0 cuando no cambia. Envíos o fijados por un cambio de zona: 0. Ediciones al volver a guardar la misma zona: 0. Ediciones en un Business sin Pinned catalog: 0. Cambios de zona deshechos por una edición fallida: 0.
- **Businesses existentes intactos (criterio 3)**: Businesses con `America/Argentina/Buenos_Aires` después de la migración: 100%. Valores de columnas existentes cambiados (comparador M3 en `tests/migrations/`): 0.
- **Nada se vuelve a fechar (criterio 4)**: fechas guardadas (Sales, Payments, Stock entries, Expenses, Price entries, `last_checked_on`) cambiadas por un cambio de zona: 0.
- **Ningún día sin la zona de su Business**: usos de `BUSINESS_TIMEZONE`: 0; usos de `ZoneInfo` con un nombre de zona literal: 0; usos de `datetime.now` para saber el día: 0; llamadas a `business_day` fuera de la lista cerrada de archivos que hace cumplir el test de arquitectura: 0, y cada una recibe la zona de su propio Business. Un archivo nuevo fuera de la lista hace fallar el test.
- **Cambio en un toque**: acciones desde elegir una zona hasta que queda guardada: 1, sin confirmación.
- **Rechazo**: una zona inválida se rechaza, la zona guardada no cambia y la pantalla muestra el mensaje fijo con el Attention icon, nunca el `detail`. 100% en verde.
- **Aislamiento**: la ruta responde solo por el Business de la sesión y figura en el barrido y en el test de rutas protegidas. Fugas: 0.

## Fuera de alcance

- Tomar la zona del teléfono para un Business nuevo, y cualquier paso de zona en Onboarding.
- Un aviso a los demás Users cuando cambia la zona.
- Un respaldo para una zona guardada que más adelante se retire: si pasa, se trata como un defecto.
- Mover o volver a fechar cualquier dato registrado.
- Roles o permisos dentro de un Business.
