# Pinned catalog

El bot de Telegram propio de cada **Business** entrega el texto del **Catalog** (catalog.md) en el chat del Business, en un solo mensaje que deja fijado, y lo mantiene al día por su cuenta. El vendedor ve primero un **Test send** en su propio chat. Lo ve solo su Business (ADR-0004). El texto sale del único autor del Catalog (ADR-0022). Esta capacidad lo envía y lo mantiene al día. El bot solo publica; nunca toma pedidos.

Dónde viven sus partes (navigation.md):
- los **Bot settings**, Find my chat y Test it están en Settings → Integrations, con un enlace simple a la pantalla del Catalog;
- el estado del **Pinned catalog** y **Publish** están en la pantalla del Catalog (catalog.md);
- Home lleva el aviso de **Out of date**.

## Jobs

**Cuando** algo cambia lo que dice mi Catalog (se registra o se elimina un precio, un producto se agota o vuelve, oculto, archivo, restauro o edito un producto, cambio el header o el footer, activo o desactivo el Bulk price), **quiero** que el Pinned catalog del chat de Telegram de mi negocio se actualice solo, después de haber visto un Test send en mi propio chat antes que los clientes, **para que** mis clientes nunca vean un precio desactualizado ni un producto que no puedo vender, y yo nunca tenga que acordarme de copiarlo, pegarlo y fijarlo de nuevo.

**Cuando** conecto mi bot en Settings → Integrations y toco Test it, **quiero** que, si falla, me diga en una oración qué tengo que arreglar (el token, mi chat sin iniciar o mi número de chat), **para** arreglarlo desde el teléfono, probar de nuevo y llegar a publicar el Catalog sin adivinar ni pedirle ayuda a nadie.

Esto afina el paso de configuración del primer job (el Test send antes de que lo vean los clientes); no es un job nuevo. Se cargó como un bug: Test it le echaba la culpa al canal por fallas del chat propio, y la línea de ayuda del chat propio prometía algo que la pantalla no hacía. Antes del arreglo, el vendedor adivinaba, revisando el token y el número a ciegas, o le pedía ayuda a alguien.

**Cuando** llevo mi negocio desde el teléfono entre pedidos o en medio de un chat con un cliente, varias veces por día, **quiero** cada configuración del negocio en un solo lugar, **para** nunca preguntarme cuál de varias pantallas tiene lo que necesito. (Es el job de navegación, navigation.md: acá lo sirven los Bot settings en Settings → Integrations.)

**Cuando** necesito cambiar cómo está configurado mi negocio (cambiarle el nombre, sumar a un socio, conectar o cambiar el bot de Telegram, editar el Catalog header and footer, manejar mis Expense categories, pasar a oscuro, cambiar mi contraseña o cerrar sesión), **quiero** cada configuración de todo el negocio en un solo lugar, cada una en su propia pantalla corta, **para** cambiarla en pocos toques desde el teléfono y volver al cliente, sin preguntarme qué pantalla la tiene. (Acá lo sirve Integrations: el token del bot, los chats, Find my chat y Test it, y un camino para seguir a publicar.)

**Cuando** un producto que cargué por error, o uno con el que ya no trabajo, sigue apareciendo en mis listas y selectores, **quiero** sacarlo desde el teléfono en pocos toques, eliminándolo si nunca se movió y archivándolo si tiene historial, **para que** mis listas muestren solo lo que todavía vendo, ninguna cifra pasada de ventas, stock, costo o Profit cambie, y pueda volver a tenerlo exactamente como estaba si empiezo a venderlo de nuevo. (Acá lo sirve que archivar y restaurar disparen la Upkeep; se define en varieties.md.)

**Cuando** un rediseño de una pantalla como Integrations está para aprobarse, **quiero** una comparación de antes y después de esa pantalla, capturada de la misma forma desde el código sin el cambio y con el cambio, **para** saber que cambió solo lo que se quería cambiar, y que lo que hace el vendedor ahí (token, chats, Find my chat, Test it, las líneas de ayuda y los motivos, el enlace a la pantalla del Catalog) se sigue leyendo y funcionando como antes, y aprobar con confianza.

Esto afina los criterios "se ve como fue diseñado" (icon-and-text-rule.md criterio 6, la métrica de diseño de navigation.md); no es un job de producto nuevo. Su protagonista es quien aprueba el rediseño (el revisor y, al final, Zeta), no el vendedor. Su propósito es encontrar diferencias no buscadas, no juzgar si la pantalla se ve bien. Salió del rediseño de Integrations de GH-116, cuya aprobación se apoyó solo en una captura del "después".

Criterios de éxito:

1. **Ningún paso propio**: una vez guardado un cambio que afecta al Catalog, el Pinned catalog ya lo muestra la próxima vez que alguien mira Telegram. Esto incluye una Price entry cuya fecha llega sin que nadie guarde nada.
2. **Un mensaje, siempre el mismo**: Publish y la Upkeep editan el Pinned catalog en el lugar. El chat nunca se llena de Catalogs viejos. Cambiar el bot o el canal deja intacto el Pinned catalog del chat anterior, y se le avisa al vendedor.
3. **Lo que leen los clientes es el Catalog**: el mismo texto que la vista previa de la app y que el Test send de Test it, con negrita real a partir del mismo emparejamiento de `**` de izquierda a derecha (ADR-0022).
4. **Nunca sorprendido por una falla**: el guardado que disparó la Upkeep (venta, precio, Stock, retiro, edición del Catalog, archivar o restaurar, Pricing settings) siempre tiene éxito por su cuenta, y la Upkeep ocurre después. Un Pinned catalog trabado se muestra como "Out of date", con un motivo de una línea, en la pantalla del Catalog y en Home.
5. **Los Businesses nunca se mezclan y el token sigue secreto**: un bot, un token, un chat del canal y un chat propio por Business. El token nunca se vuelve a mostrar una vez guardado. Nada de la configuración ni de una Upkeep se filtra entre Businesses (ADR-0004, ADR-0005).
6. **Hecho desde el teléfono**: la configuración, Find my chat y Test it en Integrations, Publish y ver si el Pinned catalog está Out of date en la pantalla del Catalog funcionan todos desde el teléfono, sin llamar a la API a mano. Desde Integrations, un enlace simple lleva a la pantalla del Catalog para publicar.
7. **Cada causa de un Test it fallido tiene su propio motivo fijo**, con una acción concreta.
   - Un token inválido y un chat propio sin iniciar muestran cada uno su propio motivo.
   - El "chat not found" de Telegram no distingue un número equivocado de un chat sin iniciar. Su único motivo nombra los dos arreglos, así que nunca apunta al equivocado.
   - Ningún motivo repite lo tipeado, y todo lo tipeado queda en el formulario.
8. **Test it nunca le echa la culpa al canal**: ninguna falla de Test it dice "The bot cannot post in the channel", porque Test it no toca el canal. Ese motivo queda sin cambios para Publish y la Upkeep, con sus estados y el aviso de Home.
9. **La línea de ayuda dice la verdad**: antes de probar, la ayuda del chat propio dice que hay que tocar Iniciar en el bot y dónde conseguir el número, y la pantalla hace lo que promete.
10. **El vendedor llega solo a una prueba exitosa**: con un token válido, el vendedor pasa de un Test it fallido a uno exitoso desde el teléfono, siguiendo solo los motivos y la ayuda de la pantalla.
11. **Un rediseño de Integrations cambia solo lo que quería cambiar**:
    - un rediseño se aprueba sobre una comparación de antes y después: teléfono y computadora, claro y oscuro, capturados de la misma forma (ADR-0042);
    - cada diferencia se lista como buscada o arreglada;
    - no cambia nada de lo que el vendedor lee o hace ahí.

La configuración (token, chats, Find my chat, primer Test it y Publish) se juzga con los criterios 3, 5, 6, 7, 8, 9 y 10. La Upkeep se juzga con los criterios 1, 2, 4 y 8. La Upkeep empieza solo después del primer Publish exitoso. Un rediseño de Integrations se juzga con el criterio 11.

## Comportamiento

### Bot settings, por negocio (Settings → Integrations)

- Un token, un chat del canal y un chat propio por Business.
- **Dónde**: el grupo Integrations de Settings, un formulario (navigation.md): "Close", y una confirmación al salir con algo tipeado y sin guardar. Es el único lugar donde se ven o se cambian; la pantalla del Catalog ya no los tiene, y los paths viejos que llevaban a ellos redirigen acá.
- **Token**:
  - se guarda cifrado, con una clave derivada de `APOSTROPHE_SECRET_KEY`;
  - una vez guardado, ninguna ruta lo devuelve y nunca se registra en logs;
  - en pantalla: "Saved on dd/mm · not shown again" con **Change**.
- **Chat del canal y chat propio**:
  - texto libre, del que solo se revisa que no esté en blanco;
  - se muestran en texto plano y se editan en el lugar;
  - nunca van a los logs, la consola ni el almacenamiento del navegador;
  - cada campo tiene una línea de ayuda corta y fija.
- **La línea de ayuda del chat propio**: "Tap Start in your bot; find your number with @userinfobot." (80 caracteres como máximo, GH-97; sacó "Open your bot in Telegram" y "or tap Find my chat", que ya dice el botón al lado del campo). Reemplazó a "Open your chat with the bot and write anything to see it here.", que prometía algo que la pantalla no hacía. La línea de ayuda del chat del canal no cambia. El cómo más largo (abrir el bot, tocar Iniciar, después Find my chat completa el número, o buscarlo con @userinfobot) está detrás de More info ("More info") en esa línea, cerrado en cada apertura.
- **Todavía nada guardado**: campos vacíos y ninguna línea "Saved".
- **Se guardan solo con Test it**: la configuración se guarda solo cuando una prueba de los valores tipeados tiene éxito, así que la configuración guardada siempre fue probada.
- **Cambiar cualquiera de los tres** vuelve a exigir un Test send antes de Publish. El Test it exitoso que guarda el cambio vuelve a cumplir ese requisito.
- **Cambiar solo el chat propio** deja el canal y su Pinned catalog como estaban: la Upkeep sigue y el estado no cambia.
- **Enlace para publicar**: un enlace simple a la pantalla del Catalog, donde viven Publish y el estado del Pinned catalog. No lleva estado y siempre abre la pantalla del Catalog. Es el inverso del enlace de la pantalla del Catalog a Integrations que se muestra cuando Publish no está disponible.
- **Acá no hay estado**: Integrations no muestra estado del Pinned catalog ni Publish; un dato, un lugar.

### Find my chat (en Integrations)

- **Dónde**: un botón al lado del campo "Your chat".
- **Token que usa**: el token que usaría Test it.
  - Es el token tipeado, si el vendedor tocó Change y tipeó uno.
  - Si no, es el guardado, que nunca sale del servidor y nunca se muestra, se registra en logs ni se devuelve.
- **Sin token de ningún tipo**: el botón está desactivado y dice "Enter the token first" con palabras, nunca solo por color.
- **Qué lee**: solo los chats privados que le escribieron al bot.
  - Un chat privado cuenta como una persona, sea cual sea la cantidad de mensajes.
  - Los grupos y los canales nunca cuentan.
  - Nunca lee ni toca el campo del chat del canal.
- **Se encuentra exactamente una persona**: el campo se completa con el número de ese chat, reemplazando cualquier número que ya hubiera, sin confirmación.
- **Cualquier otro resultado**: el campo queda como estaba.
- **No guarda nada.** La configuración se sigue guardando solo con un Test it exitoso, y el vendedor puede editar el número a mano después.
- **Completar el campo cuenta como un cambio tipeado**: salir de Integrations sin guardar pregunta antes de descartar, como cualquier otro cambio del grupo.
- **Muestra solo el número**, puesto en el campo: nunca un nombre ni un nombre de usuario de nadie que le haya escrito al bot.
- **Sus motivos** se muestran en línea, en el mismo lugar que los de Test it. Cada uno es un texto fijo que nunca repite lo tipeado, y lo tipeado queda.

| Resultado | Motivo |
|---|---|
| Nadie le escribió al bot | "No messages in your bot yet: open it in Telegram, tap Start and look again." |
| Más de una persona escribió en privado | "Several people wrote to your bot: find your number with @userinfobot, type it." |
| Los mensajes no se pueden leer (por ejemplo, un bot con webhook), o cualquier otra falla | "We cannot read your bot's messages: find your number with @userinfobot, type it." |
| Token inválido | "The token is not valid: copy it again from @BotFather." |
| Telegram caído, 429 o sin conexión | "Telegram did not respond" |

- **La app nunca cambia la configuración del bot.** Ni le pide al vendedor que la cambie en Telegram ni la cambia ella misma. Un bot que no se puede leer es raro, ya que la app nunca configura un webhook, y el camino manual por @userinfobot alcanza.

### Test it (Test send, en Integrations)

- Prueba los valores tipeados en la pantalla, no los guardados.
- Necesita el token y el chat propio. El chat del canal puede estar en blanco, y Test it nunca lo revisa ni lo toca.
- **Si tiene éxito**: los valores tipeados se guardan, la prueba cuenta para el requisito de Publish, y se muestra el toast "Test sent".
- **Si falla**: no se guarda nada. Se muestra un motivo fijo en línea que nunca repite lo tipeado, y todo lo tipeado queda.

| Causa | Motivo |
|---|---|
| Token inválido (401) | "The token is not valid: copy it again from @BotFather." |
| Chat propio sin iniciar, o el vendedor bloqueó el bot (403) | "Open your bot in Telegram and tap Start, then test it again." |
| Chat propio no encontrado (400 "chat not found"): un número equivocado, o un número correcto cuyo chat nunca se inició, que Telegram no distingue | "We could not find your chat: check the number and tap Start in your bot." |
| Telegram caído, 429 o sin conexión | "Telegram did not respond" |
| Texto por encima del límite de Telegram | "It is too long for Telegram: shorten aromas or hide products." |
| Cualquier otra falla | "We could not send you the test: check the token and your chat." |

- **Ninguno de los motivos de Test it menciona el canal.** Los motivos dependen de la acción, no solo de la respuesta de Telegram.
- Envía exactamente lo que se publicaría, incluido el caso del Catalog vacío.

### Publish (enviar y fijar, en la pantalla del Catalog)

- **Qué necesita**: un chat del canal guardado, y un Test it exitoso desde la última vez que cambió el token o cualquiera de los chats. Hasta entonces se muestra desactivado, con su motivo en palabras ("Test it first to see how it looks", o que falta el canal) y un enlace a Settings → Integrations.
- **Enviar y editar**:
  - El primer Publish a un chat del canal envía el mensaje y lo fija.
  - Un Publish posterior edita ese mismo mensaje y lo vuelve a fijar, así que un mensaje que se desfijó a mano vuelve a quedar fijado.
  - Si ese mensaje ya no existe (eliminado a mano), Publish envía y fija uno nuevo en el mismo chat. Después la Upkeep edita el nuevo.
  - Siempre envía, haya cambiado o no el texto.
  - Al tener éxito muestra el toast "Catalog published".
- **Falla**:
  - Un canal equivocado, o un bot que no puede enviar o fijar ahí, falla en línea con un motivo fijo que nunca repite lo tipeado. Un 401, 403 o 400 contra el canal dice "The bot cannot post in the channel", como antes; Publish no tiene un motivo de token propio.
  - Un texto por encima del límite de Telegram falla en línea con "It is too long for Telegram: shorten aromas or hide products." No se envía nada.

### Upkeep (edición automática del Pinned catalog)

- Se aplica a un chat del canal solo después del primer Publish exitoso a él.
- **Disparadores**:
  - Price entries registradas o eliminadas;
  - Catalog attributes, header o footer;
  - un Product renombrado;
  - un Product archivado o restaurado (varieties.md);
  - Stock entries registradas, editadas o eliminadas;
  - Stock withdrawals registradas, editadas o eliminadas;
  - Sales registradas o eliminadas, Undo incluido;
  - un guardado de Settings → Prices que cambia cualquiera de los dos interruptores de Pricing settings (pricing-settings.md), ya que la línea de Bulk price depende de Bulk price;
  - un guardado de Settings → Business → Currency and decimals que cambia el símbolo o los decimales (money.md), ya que el Catalog escribe el dinero con ellos;
  - el comienzo de un nuevo día en hora argentina, para las Price entries que entran en vigencia ese día.
- **Regla**: el texto se vuelve a armar ante un disparador. El Pinned catalog se edita solo si el texto nuevo difiere del **Last published text**. Reponer un Product que ya está en el Catalog, o retirar gramos dejándolo con Stock mayor que cero, no envía nada.
- **Solo edita.** La Upkeep nunca envía un mensaje nuevo, ni siquiera cuando el viejo se eliminó a mano.
- **El guardado que la dispara nunca espera a Telegram**:
  - responde y muestra su propio toast por su cuenta;
  - la Upkeep ocurre después;
  - su toast nunca menciona la Upkeep;
  - una Upkeep fallida nunca hace fallar, demora ni deshace ese guardado.
- **Demasiado largo**: un cambio que hace que el texto supere el límite de Telegram igual se guarda. La edición no se envía, y el Pinned catalog conserva su último texto hasta que un cambio posterior vuelva a dejar el texto por debajo del límite.
- **Después de un cambio de token o de canal**: no se intenta nada en el chat nuevo hasta su primer Publish.

### Estado

- **Solo dos estados**:
  - "Up to date";
  - "Out of date", con un motivo fijo que no lleva datos:
    - "Telegram did not respond": alcanza con reintentar;
    - "The bot cannot post in the channel": sacaron el bot o no es admin, y el vendedor tiene que arreglarlo en Telegram;
    - "The pinned message is gone: publish it again": el mensaje se eliminó a mano;
    - "It still has to be published with the new bot or channel": se probó y se guardó un cambio de token o de canal, pero todavía no se publicó;
    - "It is too long for Telegram: shorten aromas or hide products.": el texto supera el límite de Telegram.
- **"The last one was on dd/mm"**: se muestra siempre que se haya publicado en el chat del canal actual. Después de un cambio de token o de canal, se deja afuera hasta el primer Publish ahí.
- **Qué refleja**: el resultado del último intento, o el cambio de token o de canal sin publicar. No hay estado pendiente: mientras corre una Upkeep, sigue el estado anterior.
- **No lo afectan Test it ni Find my chat**: sus fallas nunca cambian el estado.
- **Antes del primer Publish de todos**: no se muestra ningún estado.
- **Reintentos**: una Upkeep fallida se reintenta automáticamente con el próximo disparador, o con Publish. No hay control de reintento.
- **Dónde se muestra**:
  - en la pantalla del Catalog, junto a Publish (catalog.md);
  - en Home: mientras el estado es "Out of date", la línea fija "Your Telegram catalog is out of date", que abre la pantalla del Catalog. Es un aviso, no una cifra (results.md);
  - nunca en Integrations.

### Cuando nada califica

- El Pinned catalog, Test it y Publish usan: el header, después "Nothing to offer for now.", después el footer. Un header o un footer en blanco se deja afuera.
- Esto cuenta como "Up to date".
- El estado vacío propio de la pantalla del Catalog y Copy no cambian: no hay nada para copiar (catalog.md).
- Cuando un Product vuelve a calificar, la Upkeep restaura el Catalog completo.

### Cambiar el canal o el token

- La app nunca vuelve a editar, desfijar ni eliminar el Pinned catalog anterior.
- Después de la prueba exitosa que guarda el cambio, el estado dice "Out of date · It still has to be published with the new bot or channel".
- El próximo Publish envía y fija un mensaje nuevo, y "The last one was" vuelve a empezar desde él.
- Cambiar cualquiera de los dos muestra, en Integrations: "The previous pinned message stays as it is; unpin it yourself in Telegram."

### El texto

- Exactamente el texto del Catalog del único autor (ADR-0022), que nunca incluye un Archived product, nunca lleva un VIP price y lleva la línea de Bulk price solo mientras Bulk price está activado (catalog.md).
- Los marcadores `**` pasan a ser negrita real de Telegram, emparejados de izquierda a derecha. Un `**` final sin pareja se muestra como se tipeó.
- El Test send y la copia publicada son idénticos para los mismos datos.
- **Largo**: se mide como lo mide Telegram, sobre el mensaje tal como se envía. Por encima del límite de Telegram nunca se parte ni se corta; se rechaza, como se dijo arriba.

### Rediseño de Integrations

- **Comparación**: un rediseño de Integrations se aprueba sobre una comparación de antes y después.
  - El "después" se captura del head que se integra.
  - El "antes" se captura del código sin el rediseño:
    - mientras el rediseño no está integrado, el código justo anterior a él;
    - una vez que entraron cambios posteriores en los mismos archivos, ese mismo head que se integra con solo el cambio propio del rediseño deshecho. El PR muestra ese diff de deshacer.
  - Si deshacer solo el rediseño cambia más de lo que cambió el rediseño (cambios posteriores dependen de él), el PR lo dice y lista las diferencias extra para Zeta. No se deshace nada más.
  - Los dos se toman con el `scripts/design/comparisons.mjs` propio del head, desde una sola instalación, el mismo día de Argentina, con las fuentes fijadas y `--strict` (ADR-0042).
  - El PR registra la versión instalada de `@fontsource/plus-jakarta-sans`.
- **Cobertura**: teléfono y computadora, claro y oscuro. Una pantalla, un lado o un `null` de un solo lado que falta es una falla, nunca AE 0.
- **Medida**: las capturas crudas se comparan por AE exacto con `scripts/design/ae.mjs`, nunca la hoja compuesta.
- **Cada diferencia distinta de cero** se lista en el PR, con su pantalla y su lado, como buscada por el brief del rediseño o arreglada. Una diferencia del lado del diseño se lista con su motivo. Una diferencia que el brief y los docs no pueden resolver va a Zeta en el PR.
- **Un arreglo** es solo CSS, dentro de los tokens existentes; ningún valor de token cambia. Después, los dos lados se vuelven a tomar desde el head arreglado y se comparan de nuevo.
- **No cambia nada de lo que el vendedor lee o hace**: el token, los chats, Find my chat, Test it, sus motivos y líneas de ayuda, la línea "unpin it yourself in Telegram", el enlace a la pantalla del Catalog, la ausencia de estado del Pinned catalog y de Publish, y ningún estado dicho solo por color.

### Restricciones

- Telegram está detrás de un puerto con un adaptador falso en las pruebas. Ninguna prueba llega a la red ni usa un token real.
- Cada tabla de configuración y de Upkeep lleva `business_id`, tomado de la Session.
- Cada ruta, incluida la de Find my chat, entra en el barrido de aislamiento y en la prueba de rutas protegidas, y cada ruta de tabla entra en la prueba de migración de pertenencia.
- Los códigos de negativa van en `contract.json` (ADR-0008), uno por motivo:
  - token inválido, chat propio sin iniciar, chat propio no encontrado y falla genérica de Test it;
  - sin mensajes, varios chats y mensajes que no se pueden leer de Find my chat.
- Ninguna ruta, error, línea de log ni estado revela otro Business o su bot (ADR-0004, ADR-0005).
- El token, los chats, el número encontrado, el texto enviado y cualquier cosa que responda Telegram nunca aparecen en los logs, la consola ni el almacenamiento del navegador. La respuesta de Find my chat tiene solo el número encontrado o un código de negativa: nunca un nombre, un nombre de usuario, el token ni el texto propio de Telegram.

## Métricas

- **Matriz de disparadores (criterio 1)**: para cada disparador, incluidos los Stock withdrawals, el cambio de día, archivar y restaurar un Product y un guardado de Prices, se intenta una edición exactamente cuando el texto armado difiere del Last published text. Un retiro que lleva el Stock de un Product a cero o menos edita el Pinned catalog; uno que deja el texto sin cambios no envía nada. Cambiar Bulk price en un Business con un Bulk price en vigencia edita el Pinned catalog; cambiar solo VIP customers no envía nada, ya que el texto no cambia. 100% de aprobación.
- **Un mensaje por chat (criterio 2)**:
  - un envío por chat del canal, después solo ediciones: 0 envíos nuevos mientras existe ese mensaje;
  - un cambio de canal o de token da exactamente un envío nuevo, y 0 llamadas posteriores contra el mensaje viejo;
  - con el mensaje eliminado en el adaptador falso, la Upkeep no envía nada e informa "The pinned message is gone: publish it again"; el próximo Publish envía y fija exactamente un mensaje nuevo;
  - cada Publish fija el mensaje que edita.
- **Fidelidad del texto (criterio 3)**: en el conjunto de referencia de catalog.md más el caso vacío, 0 diferencias:
  - el texto fuente que recibe el puerto es igual al texto de `GET /catalog`, o al mensaje del Catalog vacío;
  - el mensaje mostrado (marcadores emparejados, después quitados) es igual a la vista previa de la app;
  - el Test send es igual a la copia publicada.
- **Demasiado largo (criterios 3, 4)**: un texto por encima del límite de Telegram nunca se parte ni se corta, y no se envía nada. Test it y Publish lo rechazan en línea. La Upkeep deja el Pinned catalog como estaba e informa el motivo de largo. El guardado que la dispara tiene éxito. 100% de aprobación.
- **Resiliencia (criterio 4)**: con el adaptador falso fallando:
  - cada guardado que dispara la Upkeep, incluido un retiro, tiene éxito y responde normalmente;
  - el estado dice "Out of date" con el motivo correcto en la pantalla del Catalog, y Home muestra su línea, que abre la pantalla del Catalog;
  - el próximo disparador exitoso o Publish lo limpia.

  100% de aprobación.
- **Cambios de configuración (criterios 2, 4)**:
  - cambiar solo el chat propio mantiene la Upkeep andando y el estado sin cambios;
  - un cambio de token o de canal probado dice "It still has to be published with the new bot or channel", sin "The last one was", hasta Publish.
- **Publish no disponible**: sin un canal guardado o sin un Test it exitoso desde el último cambio, la pantalla del Catalog muestra Publish desactivado con su motivo en palabras y un enlace que abre Integrations.
- **Integrations**: una prueba del front muestra:
  - el enlace a la pantalla del Catalog, ningún estado del Pinned catalog y ningún Publish;
  - campos vacíos y ninguna línea "Saved" sin nada guardado;
  - la línea "unpin it yourself in Telegram" después de un cambio de token o de canal.
- **Motivos de Test it (criterio 7)**: 100% de aprobación.
  - Hay una prueba por causa: 401; 403 (tanto "can't initiate conversation" como "blocked by the user"); 400 chat not found, que muestra "We could not find your chat: check the number and tap Start in your bot."; Telegram caído, 429 o sin conexión; demasiado largo; y cualquier otra falla.
  - Cada una muestra su texto fijo, no repite nada de lo tipeado, conserva el formulario y no guarda nada.
- **Test it nunca le echa la culpa al canal (criterio 8)**: en cada falla de Test it, "The bot cannot post in the channel" nunca aparece. Publish y la Upkeep contra el canal lo siguen produciendo, y sus estados y el aviso de Home no cambian. 100% de aprobación.
- **Línea de ayuda (criterio 9)**: una prueba del front muestra la nueva línea de ayuda del chat propio y la línea de ayuda del canal sin cambios.
- **Find my chat**: 100% de aprobación.
  - Exactamente un chat privado (con varios mensajes) completa el campo y reemplaza un número existente.
  - Cada uno de estos muestra su propio motivo y deja el campo como estaba: sin mensajes, más de un chat privado, mensajes que no se pueden leer, otra falla, un token malo y Telegram caído.
  - Los grupos y los canales nunca se cuentan.
  - El token tipeado se usa por sobre el guardado.
  - Sin token, el botón está desactivado con "Enter the token first".
  - La búsqueda no guarda nada.
  - Un campo completado dispara la confirmación de cambios sin guardar.
  - La respuesta tiene solo el número o un código de negativa.
- **Secreto y aislamiento (criterio 5)**:
  - después de una corrida completa del front, el token, el número encontrado y cualquier texto de Telegram no están en ninguna respuesta más allá del número puesto en el campo, ni en ninguna línea de log ni en el almacenamiento del navegador;
  - cada ruta, incluida la de Find my chat, está en el barrido y en la prueba de rutas protegidas, y responde 404 o vacío desde otro Business.

  0 filtraciones.
- **Sin curl (criterios 6, 10)**: una corrida de punta a punta del front, desde una ventana de teléfono:
  - en Settings → Integrations, ingresa el token, corre Test it con un chat sin iniciar y ve su motivo;
  - completa el chat propio con Find my chat e ingresa el chat del canal;
  - corre Test it con éxito;
  - sigue el enlace de Integrations a la pantalla del Catalog, ve Publish activado y lo corre;
  - ve "Up to date" en la pantalla del Catalog y ninguna línea en Home.
- **Integrations se ve como en el diseño (criterio 11)**, leído del PR, sin telemetría:
  - se adjuntan las capturas de antes y después, con el diff de deshacer que define el "antes" cuando el rediseño ya se había integrado; el PR registra el script, la única instalación, la fecha y la versión de fontsource;
  - cuatro lados (teléfono y computadora, claro y oscuro), cada uno con un resultado en `index.json` y en la salida de `ae.mjs`: 0 faltantes;
  - `ae.mjs` sale con 0, o cada línea distinta de cero se corresponde en el PR con "buscada" o con un arreglo: 0 diferencias sin listar ni arreglar en el head que se integra;
  - las suites de pinned-catalog, navigation, icon-and-text y feedback pasan con 0 pruebas editadas.

## Fuera de alcance

- Tomar pedidos por el bot.
- Más de un canal por Business.
- Desfijar o eliminar mensajes viejos.
- Partir un Catalog largo en varios mensajes, o cortarlo.
- Que la Upkeep envíe un mensaje nuevo por su cuenta.
- Un estado pendiente, o un control de reintento.
- El estado del Pinned catalog o Publish en Integrations.
- Revisar el formato de los chats.
- Actualizaciones en vivo mientras una pantalla está abierta.
- Un bot compartido entre Businesses.
- Cambiar los motivos del canal, de Publish o de la Upkeep.
- Cualquier revisión del canal en Test it o Find my chat.
- Distinguir un número de chat propio equivocado de un chat sin iniciar cuando Telegram responde "chat not found" para los dos.
- Cambiar la configuración del bot en Telegram (un webhook, por ejemplo), o pedirle al vendedor que lo haga.
- Guardar un número encontrado por Find my chat sin un Test it exitoso.
- Mostrar los nombres o nombres de usuario de las personas que le escribieron al bot, o dejar que el vendedor elija entre varias.
- Un requisito o una política nueva para rediseños futuros; juzgar si Integrations se ve bien; comparar después del merge o en la revisión de diseño.
