# Business time zone

## Jobs

- When my business runs on a clock other than Argentina's, I want to set its time zone in Settings, once or again when I move, so that "today" in the app (my sales, my prices, my stock days left, my best days and my pinned catalog) starts and ends at my own midnight, without changing anything I already recorded.

Criterios de éxito:

1. Una Sale registrada a las 23:30 hora local cuenta en ese día local en Home, Sales y Analysis; lo mismo vale para todo otro "today" de la app.
2. El Pinned catalog se edita solo como máximo una vez por día del Business, y solo cuando cambió su texto. Guardar una zona nueva lo pone al día en el momento si el nuevo "today" cambia su texto.
3. Los Businesses existentes no ven ningún cambio: mismos días, mismas cifras, mismo Pinned catalog.
4. Cambiar la zona nunca mueve nada de lo ya registrado.

Sin esta capacidad no hay workaround: todo Business que usa la app está en Argentina, y uno de otro lugar no podría llevar la app en su propio día. La motivación es el criterio 4, Assume nothing. ADR-0057 ya decidió que la Business time zone reemplaza los días de Argentina. Entregado en GH-389 (parte 6 de GH-318).

## Qué es

Cada Business tiene exactamente una Business time zone: un nombre IANA (por ejemplo `America/Argentina/Buenos_Aires`), guardado en `business.time_zone`, que nunca está vacío. Decide cuándo empieza y termina el día de ese Business. Todo Business existente queda con `America/Argentina/Buenos_Aires` (valor por defecto del servidor en la migración `0020_business_time_zone`, que no cambia ningún valor que ya existía); un Business nuevo, abierto con una Invitation, recibe ese mismo valor por defecto y lo cambia en Settings. Onboarding no tiene paso de zona; tomar la zona del teléfono para un Business nuevo es una parte posterior de GH-318.

### Qué nombres se aceptan

- **Al guardar** solo se acepta un nombre de la lista de zonas por región de los datos IANA instalados: los que empiezan con `Africa/`, `America/`, `Antarctica/`, `Asia/`, `Atlantic/`, `Australia/`, `Europe/`, `Indian/` o `Pacific/`. Quedan afuera `Etc/*`, los alias tipo `US/*` y los nombres sueltos (`UTC`, `GMT`, `EST`), porque ninguno dice un lugar. La comparación distingue mayúsculas: `america/mexico_city` se rechaza. Esa misma lista es la que muestra la pantalla.
- **Al leer** un nombre ya guardado, alcanza con que exista en los datos IANA instalados, así que una zona guardada que la lista ya no ofrece sigue funcionando y la pantalla la sigue mostrando al final de la lista.
- **Una zona guardada que no carga** (solo posible con un cambio fuera de la app): no hay respaldo a Argentina ni a ninguna otra zona. Los pedidos que necesitan "today" responden 500 con el código `time_zone_unavailable`, y la app muestra su texto genérico de error; la Upkeep saltea ese Business sin escribir nada, y el Spreadsheet import se detiene con un mensaje fijo para el Operator que no nombra ningún dato.

## Un solo reloj por Business

Siguen la zona del Business:

- Home: Today, Week y Month (Panel).
- La fecha por defecto de toda Sale, Payment, Stock entry, Stock withdrawal y Expense nueva.
- El Current price de hoy, en Varieties, New sale y el Catalog.
- Days left, Best week y Best weekday, que cuentan días calendario en esa zona.
- Los períodos de Sales y el mes de Analysis y Expenses.
- La Upkeep diaria del Pinned catalog y la fecha del último envío que muestra su estado Out of date, calculada con la zona actual.
- El Spreadsheet import en ese Business, que usa la zona del Business de destino.

Ninguna pantalla ni lector sigue la hora de Argentina por su cuenta. Ningún día se calcula sin la zona de su propio Business: el código obtiene el día con `get_today` en `accounts/adapters/deps.py` (que lee el reloj inyectado y la zona del Business de la sesión, sin consulta extra) o con `business_day(instant, zone)` de `app/shared/calendar.py`, pasándole la zona de ese Business. `BUSINESS_TIMEZONE` dejó de existir. Los archivos que pueden llamar a `business_day` forman una lista cerrada que el test de arquitectura `tests/architecture/test_business_day.py` hace cumplir; la lista concreta es una decisión técnica. Un caso de uso sigue recibiendo `today` como una fecha simple y nunca lee una zona (ADR-0057).

### Reemplaza en otras capacidades

Esta capacidad reemplaza toda mención a "hora de Argentina" / "Argentina time" como reloj del día de un Business, y cumple los bloques planificados de la parte time-zone (ADR-0057) en sales.md, payments.md, varieties.md, analysis.md, stock.md, expenses.md, results.md, catalog.md y pinned-catalog.md ("the start of a new day in Argentina time"). Mientras esos archivos no se reescriban, vale lo que dice acá. Las menciones al "día de Argentina" en las reglas de captura y del Gate (design-capture.md, gate.md) hablan del día en que corren las herramientas, no del día de un Business, y no cambian.

## Settings → Business → Time zone

La pantalla está registrada como `/settings/business/time-zone` (un formulario cuya madre es `/settings/business`). No hay imagen de pantalla todavía, así que esta capacidad no enlaza ninguna.

- **La fila**: el grupo Business de Settings muestra, debajo del formulario del nombre, la fila "Time zone" con la zona que está guardada ahora, en una sola línea cortada con puntos suspensivos en el teléfono, y una flecha. La hora local no se muestra en la fila. En la computadora la fila muestra el nombre completo.
- **Nombre sin guardar**: si el vendedor escribió un nombre de Business y no lo guardó, tocar la fila pide la confirmación de descartar el nombre del grupo Business; puede seguir editando, guardar o descartar.
- **Búsqueda de Settings**: la fila no tiene todavía una entrada propia en la búsqueda de Settings; se llega por el grupo Business.
- **Marco**: en el teléfono es una Sheet con el título "Time zone" y "Close" arriba, y "Save time zone" fijo abajo. "Close" y el gesto de volver son la misma salida y no guardan nada.
- **Elegir**: un campo "Search by place" siempre visible y una lista de todas las zonas aceptadas por su nombre propio. La búsqueda no distingue mayúsculas y lee `_` como espacio, así que "Mexico" encuentra `America/Mexico_City` y "Madrid" `Europe/Madrid`. Ese nombre es lo que se guarda. No hay lista corta (supondría dónde están los Businesses) ni texto libre.
- **Valor inicial**: la zona guardada del Business, marcada con un ícono de check cuyo nombre accesible es "Selected", nunca solo por color. La lista no se desplaza sola hasta la zona guardada.
- **Búsqueda sin resultados**: una línea apagada, sin ícono: "No time zone matches "{query}". Try another place." El vendedor edita o borra la búsqueda.
- **Hora local**: debajo de la lista se lee "It is {datetime} there now", la fecha y la hora actuales (dd/mm HH:MM) en la zona elegida, a partir del instante del reloj del servidor; se actualiza al elegir otra zona. Si no se conoce el desfase de esa zona, la línea no se muestra.
- **La consecuencia, visible**: debajo de la hora local, la línea "Past records keep their dates. Only "today" and the daily catalog refresh change." siempre visible, con More info al final que explica que Sales, Payments, Stock entries, Expenses y prices quedan en el día en que se registraron. More info se abre cerrado y nunca se recuerda. La línea nunca vive solo detrás de la "i", porque More info nunca es una consecuencia. Sin búsqueda, la hora local y esta línea quedan debajo de la lista completa.
- **Guardar**: un toque, sin paso de confirmación. Mientras guarda, el botón dice "Saving…" y no se puede volver a tocar. El éxito cierra la Sheet y vuelve al grupo Business, donde la fila muestra la zona nueva; no hay aviso extra. El nuevo "today" respondido se aplica de inmediato a las pantallas que lo usan.
- **Quién**: cualquier User del Business, porque no hay roles. Los demás Users no reciben aviso; ven el nuevo "today" en su próxima carga.
- **Otras fallas**: sin conexión o cualquier otro error muestran los textos compartidos de "No connection" y de error genérico.
- **Textos**: todos vienen de los textos del Tech Writer y viven en el Copy module (`timeZone`, y `refusals.timeZoneInvalid`); ningún valor por defecto nuevo lleva una palabra de flor.

## Guardar

- **Una zona distinta**: se guarda con un solo cambio que solo escribe si la zona guardada es otra, y la respuesta trae la zona y el nuevo `today`. Después del commit se dispara la Upkeep una vez: el Pinned catalog se edita solo si su texto cambió, y nunca se envía ni se fija. Si esa edición falla, la zona queda guardada y se muestra el estado Out of date existente con su motivo fijo (ningún motivo nuevo); la pantalla Time zone no muestra ningún error. Un Business que nunca publicó un Pinned catalog no hace nada en Telegram.
- **La misma zona ya guardada**: no cambia nada, no corre la Upkeep y la pantalla se cierra como un éxito normal.
- **Una zona que la app no acepta** (solo posible con un pedido armado a mano o una lista vieja): se rechaza con el código `unknown_time_zone` y la zona guardada queda como estaba. La pantalla muestra, junto a la acción, el único mensaje fijo "That time zone can't be used. Pick another one from the list." con el Attention icon; la selección queda en la zona rechazada, y el mensaje se borra al elegir otra. El vendedor vuelve a elegir de la lista. El `detail` de la API nunca se muestra (Product language), y el rechazo no revela nada de ningún otro Business.

## Las fechas registradas no cambian nunca

- Toda Sale, Payment, Stock entry, Stock withdrawal, Expense y Price entry conserva la fecha con que se registró; los instantes guardados siguen en UTC. Solo "today" y las cuentas basadas en días calendario siguen la zona nueva.
- **Atrasar el reloj** (mover la zona al oeste) puede dejar registros con fecha posterior al nuevo "today":
  - conservan su fecha y siguen en toda lista, historial y total, sin marca; nada se oculta, mueve ni vuelve a fechar;
  - una Price entry con fecha posterior al nuevo "today" no es el Current price hasta que esa fecha llega en la zona del Business;
  - el Today de Home muestra solo el nuevo "today"; Week y Month cubren los períodos que lo contienen;
  - la fecha por defecto de los registros nuevos es el nuevo "today".

## Upkeep

- Reemplaza el disparador "the start of a new day in Argentina time" de pinned-catalog.md: la Upkeep diaria corre al comenzar el día en la zona propia de cada Business.
- Un Pinned catalog publicado está pendiente cuando `last_checked_on` está vacío o es distinto del "today" propio del Business ("distinto", no "anterior", ADR-0057). El ticker de 300 segundos calcula el día de cada Business con su zona, así que uno al oeste de Argentina no se revisa temprano ni uno al este tarde. Un Business cuya zona no carga se saltea sin frenar a los demás.
- Cada revisión hecha escribe el "today" del Business en `last_checked_on`, salvo cuando Telegram no responde, que conserva el valor guardado para reintentar (ADR-0014).
- Un Business que movió su zona al oeste se revisa una vez más; esa revisión edita solo si el texto cambió.
- Guardar una zona distinta es un disparador de Upkeep, después del commit; el guardado nunca espera a Telegram ni falla por él.

## Aislamiento y export

- `GET /api/business/time-zone` responde la zona guardada, la lista de zonas para elegir y el instante actual del reloj; `PUT /api/business/time-zone` recibe `{time_zone}` y responde `{time_zone, today}`.
- El Business siempre sale de la sesión; ningún pedido nombra un Business, y ninguna respuesta revela la zona de otro ni que existe.
- Las dos rutas están protegidas por la sesión y entran en el barrido de aislamiento y en el test de rutas protegidas.
- La zona guardada forma parte del Business export, junto al idioma.

## Métricas

La instalación corre local, sin telemetría. Cada métrica es una cifra que afirman los tests.

- **Día local (criterio 1)**: en un Business con una zona distinta de la de Argentina, una Sale registrada a las 23:30 hora local con el reloj movible cuenta en ese día local en Home (Today, Week, Month), Sales y Analysis; las fechas por defecto, el Current price, Days left, Best week y Best weekday siguen esa zona. 100% en verde.
- **Catálogo quieto (criterio 2)**: zona movida al oeste y al este: exactamente 1 edición cuando el texto cambia, 0 cuando no cambia, y 0 llamadas a Telegram en un segundo tick del mismo instante. Envíos o fijados por un cambio de zona: 0. Ediciones al volver a guardar la misma zona: 0. Ediciones en un Business sin Pinned catalog: 0. Cambios de zona deshechos por una edición fallida: 0.
- **Businesses existentes intactos (criterio 3)**: Businesses con `America/Argentina/Buenos_Aires` después de la migración: 100%. Valores de columnas existentes cambiados (comparador M3 en `tests/migrations/`): 0.
- **Nada se vuelve a fechar (criterio 4)**: fechas guardadas (Sales, Payments, Stock entries, Expenses, Price entries, `last_checked_on`) cambiadas por un cambio de zona: 0.
- **Ningún día sin la zona de su Business**: usos de `BUSINESS_TIMEZONE`: 0; usos de `ZoneInfo` con un nombre de zona literal en `app` o `scripts`: 0; usos de `datetime.now` para saber el día: 0; llamadas a `business_day` fuera de la lista cerrada de archivos que hace cumplir el test de arquitectura: 0, y cada una recibe la zona de su propio Business. Un archivo nuevo fuera de la lista hace fallar el test.
- **Sin respaldo silencioso**: una zona guardada que no carga responde `time_zone_unavailable` y nunca un día de Argentina: 100% en verde.
- **Cambio en un toque**: acciones desde elegir una zona hasta que queda guardada: 1, sin confirmación. Camino completo desde un Tab root: 6 toques.
- **Rechazo**: `US/Eastern`, `america/mexico_city` y `Etc/GMT+5` se rechazan, la zona guardada no cambia y la pantalla muestra el mensaje fijo con el Attention icon, nunca el `detail`. 100% en verde.
- **Aislamiento**: las rutas responden solo por el Business de la sesión y figuran en el barrido y en el test de rutas protegidas. Fugas: 0.

## Pendientes conocidos (observaciones, no bloquean)

- La hora local y la línea de la consecuencia quedan debajo de la lista completa; sin búsqueda hay que desplazarse para verlas.
- La lista no se desplaza sola hasta la zona guardada.
- Tras un rechazo, la selección queda en la zona rechazada en lugar de volver a la guardada.
- La búsqueda de Settings no ofrece todavía una entrada "Time zone".

## Fuera de alcance

- Tomar la zona del teléfono para un Business nuevo, y cualquier paso de zona en Onboarding.
- Un aviso a los demás Users cuando cambia la zona.
- Un respaldo para una zona guardada que más adelante se retire: si pasa, se trata como un defecto.
- Mover o volver a fechar cualquier dato registrado.
- Roles o permisos dentro de un Business.
