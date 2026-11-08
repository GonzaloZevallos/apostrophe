# Cuentas

Los **Businesses**, sus **Users** y cómo entra y sale la gente:
- la única forma de entrar: una **Invitation** y un inicio de sesión;
- la forma de volver a entrar: un **Password change** y un **Reset link** que emite el **Operator**;
- la única forma de salir: un comando del Operator que exporta un Business y lo elimina.

Toda otra capacidad lee una sola cosa de acá, el Business del User que pide, y sirve solo a ese Business (ADR-0004). También contiene la app en su conjunto:

- cómo se sirve, se instala y toma su tema, incluida la **Theme choice** que recuerda cada dispositivo, y cómo la app instalada llena la pantalla del teléfono;
- el estándar del teléfono que cumple cada pantalla en anchos de teléfono, y el control que lo mantiene;
- cómo se publica la instalación en internet y cómo se hace su backup (ADR-0016);
- las reglas de aviso que sigue cada pantalla, y los estados compartidos (`Estados`) que las dibujan;
- los grupos Business, Users, Appearance y Your account de **Settings**.

Dónde está cada pantalla (pestañas, barra lateral, More, Settings, el marco y la regla de regreso, rutas, primer uso) es navigation.md. Home, donde abre la app, es el **Panel** definido en results.md. El grupo Prices es pricing-settings.md.

## Jobs

**Cuando** un amigo quiere usar la app para su propio negocio, **quiero** darle un link que le abra un negocio propio, **para poder** sumarlo sin ver ni tocar nada de lo que vaya a registrar.

**Cuando** vendo junto con un socio, **quiero** invitarlo a mi negocio, **para que** los dos registremos las ventas en los mismos números.

**Cuando** abro la app en el teléfono, **quiero** iniciar sesión una vez y quedarme adentro, **para poder** registrar una venta en segundos, mientras nadie más en la red ni quien adivine contraseñas entra.

**Cuando** sé mi contraseña pero ya no la quiero (se la dije a alguien, la tipeé en un dispositivo compartido o creo que se filtró), **quiero** definir una nueva yo mismo desde el teléfono en pocos toques, **para que** quien conocía la anterior quede afuera de mi negocio al instante y yo siga trabajando en este dispositivo sin pedirle nada a nadie.

**Cuando** me olvidé la contraseña y no puedo entrar a mi negocio, **quiero** que el Operator me dé un link que me deje elegir yo mismo una contraseña nueva, una sola vez y dentro de un día, **para poder** volver a mis números el mismo día, mientras nadie más (el Operator incluido) conoce ni elige mi contraseña y se cierra la sesión de cada dispositivo que la tenía iniciada como yo.

Estos dos refinan el trabajo "iniciar sesión una vez y quedarme adentro" de arriba. El comando del Operator es el mecanismo del trabajo de reseteo, no un trabajo propio.

**Cuando** abro la app en el teléfono y tengo que iniciar sesión, **quiero** estar adentro de mi negocio en una sola pasada; si no me acuerdo la contraseña, **quiero** saber ahí mismo quién me da un Reset link y qué pedirle, **para** volver a registrar ventas en vez de sentirme bloqueado o volver a la planilla. (GH-521)

Este refina el trabajo de "iniciar sesión una vez y quedarme adentro" y el de la contraseña olvidada; no es un trabajo nuevo. Su protagonista es el vendedor que vuelve; quien no tiene cuenta es un público secundario, al que solo se le dice que se entra con una Invitation.

**Cuando** manejo mi negocio desde el teléfono (entregando lo que me compraron, respondiéndole a un cliente por Telegram, pagando algo o poniéndome al día al final del día), **quiero** entrar con el link que me mandaron y mantener al día desde el teléfono mis clientes, mis precios, mi stock y mis **Expenses**, **para poder** dejar de llevarlos en la planilla y tener datos reales cuando lleguen las ventas. La computadora es el mismo trabajo en una pantalla más grande.

**Cuando** abro la app desde un link de Invitation por primera vez, vuelvo con un Reset link después de olvidarme la contraseña, inicio sesión de nuevo en el teléfono o caigo en una pantalla vacía, que todavía carga o que falla, **quiero** una sola pantalla clara en el teléfono que me haga entrar o me diga en palabras simples qué pasó y qué hacer después, **para poder** volver a mis números sin pedirle nada a nadie, sin adivinar y sin enterarme de nada sobre otros negocios o Users.

Esto refina los trabajos "iniciar sesión una vez y quedarme adentro", "entrar con el link que me mandaron" y el de la contraseña olvidada de arriba; no es un trabajo nuevo. Su protagonista es quien vende; los comandos del Operator quedan fuera de la app.

**Cuando** abro la app en el teléfono o la computadora, a cualquier hora, **quiero** verla con el aspecto Yerba (papel verdoso y tinta verde-negra con un solo verde, o su contraparte oscura) acorde a la configuración clara u oscura del teléfono sin tocar nada, y poder forzar Light o Dark (en Settings → Appearance, navigation.md) y que eso quede en ese dispositivo, **para** trabajar con un aspecto diseñado y revisado para leer cifras, estados y montos en ambos temas, y que ningún estado se distinga nunca solo por color.

**Cuando** necesito cambiar cómo está configurado mi negocio (renombrarlo, sumar a un socio, conectar o cambiar el bot de Telegram, editar el **Catalog header and footer**, administrar mis **Expense categories**, pasar a oscuro, cambiar la contraseña o cerrar sesión), **quiero** cada configuración de todo el negocio en un solo lugar, cada una en su propia pantalla corta, **para poder** cambiarla en pocos toques desde el teléfono y volver al cliente, sin preguntarme qué pantalla la tiene. (Lo sirven acá Business, Users, Appearance y Your account de Settings; la estructura es navigation.md.)

**Cuando** abro la app instalada en el teléfono entre ventas o en medio de un chat con un cliente, **quiero** que llene la pantalla y responda como responde una app de teléfono (nada oculto bajo el notch ni la barra de inicio, una barra de estado del color de la app, sin rebote de página ni deslizar para recargar, sin destello azul ni texto seleccionado por error al tocar, y el campo en que escribo nunca tapado por el teclado), **para poder** tocar, escribir y leer cifras rápido y volver al cliente, sin que la app se sienta como una página web dentro de un marco.

Esto refina el trabajo "iniciar sesión una vez y quedarme adentro" de arriba y el criterio 5; no es un trabajo nuevo. Su protagonista es quien vende; el Operator y Capacitor no forman parte de él.

**Cuando** manejo una venta, un pago, una **Stock entry** o una Expense en el teléfono, con una mano y en medio de un chat con un cliente, **quiero** que cada pantalla se comporte como una app de teléfono (la barra y la cabecera siempre a mano, controles que puedo tocar con el pulgar, el teclado que nunca tapa lo que escribo, nunca una pantalla en blanco mientras carga, texto legible en ambos temas), **para poder** terminar y volver al cliente sin hacer zoom, sin tocar mal y sin preguntarme si se colgó.

Esto refina el criterio 5 y el trabajo de la app instalada de arriba, extendiéndolos de la app instalada a cada pantalla; no es un trabajo nuevo. Su protagonista es quien vende. La mitad de quien construye (una regla escrita del teléfono y un control que falla cuando una pantalla la rompe) es cómo se entrega el trabajo, no un segundo trabajo. El Operator y Capacitor no forman parte de él.

**Cuando** un amigo deja de usar la app, o pide que lo saquen, **quiero** darle en un solo archivo todo lo que la app guarda de su negocio y después eliminar ese negocio de la instalación por completo, **para que** conserve sus números y que los nombres, los **Phone numbers** y los **Balances** de sus clientes ya no los tenga yo ni nadie más en la instalación.
- Un Business abierto por error queda cubierto por el mismo comando.
- El Business se va entero, con todos sus Users.
- El Operator acordó antes con cada User del Business; el comando no lo verifica.

**Cuando** alguien que vende necesita la app fuera de mi red de casa, **quiero** la instalación publicada en internet por HTTPS, con los datos de cada Business copiados fuera del servidor de forma continua, cifrados y con la restauración comprobada, **para poder** dejar que se trabaje desde cualquier lugar sin que la pérdida de un servidor o de un disco, o un backup filtrado, le cueste a nadie sus números ni exponga a sus clientes.

- El protagonista de este trabajo es el Operator de la instalación, no un User dentro de la app.
- Para quien vende cambian solo dos cosas: desde dónde puede llegar a la app, y que está en HTTPS.

**Cuando** un control del backend se pone en rojo en un diff que no toca código del backend, **quiero** que el test de seguridad de la cookie dé el mismo resultado cualquier día, usando solo una hora fija que se le entrega y nunca la fecha real ni nada más fuera del test, **para poder** confiar en que un control en rojo significa una regresión real y hacer merge de uno en verde sin volver a correrlo.

- Esto refina el trabajo "iniciar sesión una vez y quedarme adentro" y el criterio 14 para quienes hacen merge a través del **Gate** (los mantenedores agénticos y el PM); no es un trabajo de quien vende.
- Ningún comportamiento del producto cambia por esto: la regla `Secure` y la **Session** de 30 días quedan como están.

**Cuando** hago merge de un cambio y la suite de tests vuelve a correr otro día, **quiero** que el Gate dé el mismo veredicto sea cual sea la fecha, y que el registro del cambio diga exactamente qué prueba su evidencia y qué no, **para poder** confiar en un Gate en verde, actuar ante uno en rojo sin adivinar y nunca tomar una evidencia como prueba de algo que nunca cubrió.

- El protagonista de este trabajo es quien mantiene la instalación, o quien revisa en su nombre. A quien vende lo afecta solo de forma indirecta: un Gate que se pone en rojo porque cambió la fecha frena cada arreglo que está esperando.
- Lo sirven acá los tests de la **Business removal**. Cada instante en ellos viene del reloj movible (ADR-0001), así que su veredicto nunca depende del día en que corren. No cambia ningún comportamiento de la app.

El trabajo de **Navigation** (navigation.md) decide desde dónde se llega a Business, Users, Appearance y Your account: Settings.

Criterios de éxito:

1. Nada de un Business es alcanzable desde otro, por ninguna ruta: por id no existe (404), en una lista no aparece.
2. Nadie entra sin una Invitation; cada Invitation deja entrar a una persona, una sola vez, dentro de siete días.
3. Las contraseñas incorrectas repetidas dejan de funcionar por un tiempo, y nada en las respuestas dice qué emails tienen un User.
4. Ningún `curl` en ningún momento. Solo desde el teléfono, quien vende puede hacer todo lo que hace el backend, empezando por abrir un Business o sumarse a uno desde el link de la Invitation.
5. Se siente como una app de teléfono.
   - Está en la pantalla de inicio con su propio nombre e ícono. En iOS se instala por la red de casa. En Android es un acceso directo en la pantalla de inicio ahí, y una instalación completa en la instalación publicada con TLS.
   - Sigue por defecto la configuración clara u oscura del teléfono; un Light o Dark elegido en ese dispositivo gana sobre el teléfono.
   - Dice "No connection" cuando se cae la red.
   - Ningún estado se distingue solo por color: un signo, una flecha o una palabra en cada suba, pérdida, deuda o estado; las series de los gráficos rotuladas directamente.
   - Instalada, llena la pantalla y responde como una app de teléfono (criterios 33–36).
   - Cada pantalla en anchos de teléfono (por debajo del corte de computadora de 900 px) cumple el estándar del teléfono, escrito en CODING_STANDARDS §10 "Phone" y en "En el celular" del README de diseño, y verificado por `web/e2e/mobile.spec.ts` (criterios 37–41).
6. Los Businesses siguen invisibles entre sí también en el navegador.
   - Ningún Business en una URL.
   - Ningún dato personal ni dinero en la consola ni en el almacenamiento del navegador. Lo único que guarda el navegador es la Theme choice del dispositivo.
   - La Session vive solo en la cookie del backend.
   - Servir el front no llega a nada fuera de la app compilada.
7. Nada inventado: ninguna cifra de relleno, y ningún acceso de navegación a algo que todavía no existe.
14. **Nada se debilita en internet.**
   - Quien vende inicia sesión y trabaja desde cualquier red con las mismas garantías que en la red de casa: ADR-0002, ADR-0004 y ADR-0005.
   - Por HTTPS la cookie de la Session es `Secure`. Esto se fija en la configuración, nunca se deduce de la solicitud.
   - El http plano en la red de casa sigue funcionando sin cambios.
15. **Se frena el adivinado por email y por dirección.**
   - Una dirección que prueba muchos emails queda bloqueada.
   - Un email probado desde muchas direcciones queda bloqueado.
   - Ambos bloqueos responden igual, con la misma demora.
   - Ninguna dirección de origen va a un log.
16. **Perder el servidor es recuperable.**
    - En el peor caso se pierde menos de 1 minuto de trabajo reciente (Sales, Payments, Stock entries), gracias al registro de escrituras de 24 horas de Turso.
    - Más allá de esas 24 horas, la copia diaria cifrada es el respaldo, y su límite de pérdida es un día.
    - Un **Restore drill** restaura el backup en un destino de prueba y comprueba que está intacto (integridad, conteos de filas, actualidad), sin efecto sobre la app en marcha.
17. **Reconstruible desde el repositorio.**
    - `deploy/README.md` documenta cada paso para levantar la instalación desde cero.
    - No hay ningún secreto en el repositorio.

Criterios de éxito, el tema:

23. **Automatic salvo que se elija en el dispositivo**: un dispositivo sin elección guardada sigue la configuración clara u oscura del teléfono en cada pantalla, en vivo, y la vuelve a revisar cuando quien vende vuelve a la app. La decisión del dueño del 2026-10-29 reemplaza a ADR-0026 en este punto (el ADR no se edita). Un dispositivo que no puede informar su configuración se lee claro. Se acepta un cuadro claro en un teléfono oscuro sin nada guardado antes de que se aplique el tema.
24. **Light o Dark a pedido, y se queda**: el tema oscuro (`InicioOscuro`) se muestra cuando `data-tema="oscuro"` está puesto en `<html>`, que es el tema resuelto, no la elección. La elección se hace solo en Settings → Appearance (Theme: Automatic, Light, Dark; navigation.md) y se guarda en el dispositivo como `tema` = `claro` u `oscuro`. Automatic es no tener ninguna clave guardada; cualquier otro valor o un error de almacenamiento también se lee como Automatic. Una elección guardada gana sobre el teléfono, sobrevive al cierre de la app, a las recargas y al cierre de sesión, y se ve en cada pantalla de ese dispositivo, la de inicio de sesión, la de la Invitation y las de reseteo incluidas. Un Dark viejo sigue abriendo oscuro; un Light viejo (nada guardado) ahora sigue al teléfono. Otra pestaña o ventana toma un cambio la próxima vez que carga.
25. **Los temas conservan la paleta Yerba**: ambos temas llevan los mismos tokens con sus propios valores (DESIGN_STANDARDS.md "Palette"); lo que elige el tema es la regla de arriba. Cada regla sobre estados (ningún estado se distingue solo por color: un signo, una flecha o una palabra en cada suba, pérdida, deuda o estado; las series de los gráficos rotuladas directamente) vale en ambos.
26. **Una regla, escrita igual en todas partes**: el comentario al principio de `web/src/styles/tokens.css`, `docs/product/design-system/tokens.css`, el README del design system y este archivo dicen la misma regla.

Criterios de éxito, cambiar y resetear una contraseña:

18. **Cambio, rápido y definitivo.**
    - Desde Settings → Your account en el teléfono, un User con la contraseña actual correcta define una nueva (de al menos 10 caracteres) en menos de un minuto.
    - Toda otra Session de ese User se cierra al instante.
    - El dispositivo que la cambió sigue con la sesión iniciada.
    - Las Sessions de los socios no se tocan.
19. **Reseteo, un comando, un link.**
    - El Operator obtiene un link que funciona con un solo comando, sin editar la base de datos.
    - Quien vende lo abre dentro de 24 horas, define una contraseña nueva y llega a Home con la sesión iniciada, con cada Session anterior suya cerrada.
    - El link funciona una sola vez.
    - Los links desconocidos, usados, vencidos y retirados responden todos el mismo 404, como las Invitations.
20. **Nadie más la conoce.**
    - El Operator nunca ve ni elige la contraseña nueva.
    - Ninguna contraseña, token ni link aparece en un log, una respuesta, la consola ni el almacenamiento del navegador.
    - Solo se guardan un hash scrypt y un digest del token (ADR-0002, ADR-0005).
21. **El freno no es una puerta lateral.**
    - Una contraseña actual incorrecta cuenta como un inicio de sesión rechazado para los dos **Login brakes**.
    - Mientras cualquiera de los bloqueos está activo, Change se rechaza con el mismo mensaje del freno.
    - Nada en ninguno de los dos flujos dice si un email tiene un User. La terminal del Operator es la excepción, porque el Operator no es un User.
22. **Sin curl.** Ambos flujos corren enteros desde el teléfono. El comando del Operator es la única excepción, y queda fuera de la app como `invite-business.sh`.

Criterios de éxito, las pantallas para entrar y los estados compartidos rediseñados (GH-49):

27. **Entrar es rápido.** Desde el teléfono, quien vende abre un link de Invitation, o un Reset link, y llega a Home con la sesión iniciada en menos de un minuto, e inicia sesión desde la pantalla de inicio de sesión en pocos segundos. No aparece ningún paso que el diseño no dibuje.
28. **Cada estado se distingue por palabra y forma, nunca solo por color**: el mensaje del freno, "This invitation no longer works", "This link no longer works. Ask whoever sent it for a new one.", "No connection", vacío, cargando, el reintento genérico ante un error del servidor y "That is gone.". Todos los textos siguen el Product language (inglés, desde el Copy module); el español es solo el Documentation language. (Corregido en GH-521: decía "Rioplatense Spanish with vos", un resto de antes de la decisión del Product language.)
29. **El teléfono y la computadora coinciden con el diseño.** La pantalla de inicio de sesión (`Entrar`), la de Business nuevo (`NegocioNuevo`), la de Invitation (`Invitacion`), la de reseteo y los estados compartidos (`Estados`) coinciden con `docs/product/design-system/pantallas/` en ambos, revisado a ojo; `scripts/design/compare.sh` corre antes y después.
30. **El aspecto no revela nada nuevo.**
    - Ninguna pantalla ni estado dice si un email tiene un User, qué freno saltó ni cuántos intentos quedan.
    - Un link muerto nunca dice por qué.
    - "That is gone." no lleva id, nombre ni fecha.
    - Ningún dato personal ni dinero llega a la consola ni al almacenamiento del navegador.
31. **Ambos temas.** Estas pantallas siguen la regla del tema (criterios 23–25), sin cambiar ningún token.
32. **Nada retrocede.** Cada test de cuentas, Navigation y avisos pasa sin cambios.

Criterios de éxito, Sign in con el nuevo estilo y "Forgot your password?" (GH-521):

42. **Una sola pasada.** Un vendedor que vuelve inicia sesión desde el teléfono en una pasada: email, contraseña, un toque. No hay que hacer scroll ni buscar nada, y el teclado ya está abierto.
43. **A un toque de saber qué hacer.** Quien se olvidó la contraseña llega a la explicación con un toque y la cierra sabiendo el próximo paso: pedir un Reset link de un solo uso, diciendo con qué email inicia sesión.
44. **No revela nada.** Nada en la pantalla ni en la Sheet revela si existe un email, un User o un Business. La Sheet es igual para todos y no depende de lo que se tipeó.
45. **Coincide con el dibujo 25-ingreso** (`Entrar` y `EntrarOscuro`) en la Design capture, claro y oscuro, según el Drawing as guide: no falta ni cambia ningún control, rótulo o ícono que el dibujo muestra. Las líneas en español del dibujo se construyen como su equivalente en inglés (Product language), y eso no cuenta como diferencia.

Criterios de éxito, la app instalada:

33. **Nada bajo las áreas del sistema.**
    - En un teléfono con la app instalada, con notch y barra de inicio, en vertical, el contenido de cada pantalla se ve entero y se puede tocar: la barra de pestañas, la cabecera, "+ New sale", las **Sheets** y los toasts incluidos.
    - La altura de una pantalla sigue a la pantalla visible, así que nada salta ni se corta cuando aparecen o desaparecen las barras propias del navegador.
    - Con el teclado abierto, el campo con foco queda a la vista.
34. **La barra de estado es del color de la app.**
    - En Android coincide con el papel del tema vigente: el `--papel` claro sin `data-tema`, el token de papel propio del tema oscuro con `data-tema="oscuro"`. Cambia en cuanto cambia el atributo.
    - En Automatic sigue en vivo la configuración del teléfono, porque el atributo la sigue. No hay franja azul en ningún tema.
    - La pantalla de carga y los colores del manifest son el `--papel` claro.
    - En iOS la barra de estado queda clara en ambos temas, porque iOS fija su estilo al arrancar. Es una limitación aceptada, no un defecto.
35. **Los toques se sienten como los de una app de teléfono.**
    - Cada botón, fila e ítem de la barra muestra un estado presionado al instante.
    - Sin el resaltado de toque de Android; tocar nunca selecciona texto en botones, pestañas ni la barra.
    - Sin rebote de overscroll ni deslizar para recargar en la página entera.
    - El texto dentro de listas y campos sigue siendo seleccionable donde lo es hoy.
    - El manifest pasa el control de instalabilidad del navegador.
36. **Nada retrocede.**
    - Cada test de cuentas, Navigation y avisos pasa sin cambios.
    - La barra sigue entrando en 320 px con el texto al 130%.
    - Ningún estado se distingue solo por color, en ningún tema; el estado presionado usa solo tokens, en ambos temas.
    - Ningún valor de token existente cambia; solo se agregan los cuatro tokens nuevos de inset.

Criterios de éxito, el estándar del teléfono:

37. **Escrito una vez, leído desde los dos lados.**
    - CODING_STANDARDS §10 "Phone" y "En el celular" del README de diseño dicen los mismos ocho requisitos: marco, toque, campos, formularios y Sheets, disposición, gestos, carga y legibilidad.
    - Cada requisito lleva la misma etiqueta "checked" o "review" en ambos.
    - Ninguno contradice al otro, a las reglas de la app instalada de este archivo, a ADR-0027, ADR-0028 ni ADR-0029.
    - Donde uno de ellos ya decide un punto, el estándar lo cita y no lo repite.
38. **Verificado, no supuesto.** `web/e2e/mobile.spec.ts` cubre cada ruta de `scripts/design/screens.json`, cada formulario y Sheet, y los estados compartidos de `Estados`.
    - Corre en 320×568, 375×812, 430×932 y 246×437 (130 %), en ambos temas.
    - Falla ante cada defecto verificado.
39. **La lista de infractores conocidos solo puede achicarse.**
    - Cada falla esperada nombra el issue que la elimina.
    - Un infractor nuevo hace fallar la corrida, y también uno arreglado que quedó en la lista.
    - Crece solo por un intercambio, o por las celdas reales de una fila nueva en el registro de pantallas (las condiciones están en `docs/product/gate.md`).
40. **Cada PR de área lo muestra.** El PR de cada issue de área (#45–#49, #59, #60, #78) y `scripts/design/compare.sh` adjuntan el resultado del control. Un issue de área no está terminado mientras sus propias pantallas sigan en la lista de infractores.
41. **Nada retrocede para quien vende.**
    - Una Sale, un Payment, una Stock entry y una Expense se siguen registrando cada uno desde el teléfono en menos de 60 s.
    - Las suites existentes de cuentas, Navigation, Sales y avisos pasan sin editarse.

Criterios de éxito, eliminar un Business:

8. **El archivo son sus números y se sostiene solo**:
   - un solo archivo JSON guarda cada hecho registrado del Business y se abre sin la app;
   - identifica al Business por su nombre;
   - nombra aquello a lo que se refiere cada registro además de su id;
   - no guarda ningún hash de contraseña, ningún secreto guardado, ninguna Invitation ni ningún Reset link.
9. **Nombrado antes de perder nada**: la corrida de prueba nombra el Business y cuenta por tipo lo que se iría, sin escribir nada. La corrida real pide el nombre del Business tipeado exactamente antes de tocar nada.
10. **Nada se borra hasta que el **Business export** está a salvo**: el borrado corre solo después de que el archivo se escribió y se releyó en la misma corrida, y los conteos exportados igualan a los borrados. Cualquier falla o diferencia no borra nada.
11. **No sobrevive nada**:
    - no queda ninguna fila con el id del Business en ninguna tabla, incluidas las tablas que se agreguen después;
    - sus Invitations y los Reset links de sus Users, de cualquier estado, también se van, y lo mismo el historial de intentos de inicio de sesión de sus Users;
    - el Business export se arma a partir de las mismas tablas que el borrado; las Invitations y los Reset links se borran, nunca se exportan.
12. **Todo otro Business queda intacto**: sus conteos de registros son los mismos antes y después, y siguen funcionando, nunca se los frena a propósito y nunca se les avisa nada.
13. **Ningún dato personal fuera del archivo, y un comienzo limpio**: la terminal y los logs muestran solo el nombre del Business, la ruta del archivo y los conteos. Después, el mismo email puede abrir un Business nuevo sin arrastrar nada.
37. **Los tests de eliminación dan el mismo veredicto cualquier día.**
    - Cada instante en `tests/business_removal/`, Invitations incluidas, viene del reloj movible (ADR-0001). Ningún test ahí lee el reloj real.
    - La suite da el mismo resultado cuando el reloj se mueve a distintos días de Argentina, incluido el paso de un mes a otro y de un año a otro.

Criterios de éxito, el test de seguridad de la cookie (seguimiento de GH-130):

37. **Mismo resultado cualquier día.** El test de seguridad de la cookie usa solo una hora fija que se le entrega mediante el reloj inyectado (ADR-0001) y da el mismo resultado sea cual sea la fecha real, anterior o posterior, sin editar su hora fija. Nada en él lee el reloj real.
38. **La regla sigue probada.** Sigue afirmando que `Secure` está presente cuando HTTPS está configurado, ausente si no, y nunca se deduce del esquema ni de las cabeceras de la solicitud (criterio 14). No se quita ni se afloja ninguna aserción.
39. **No cambia ningún comportamiento del producto.** La Session sigue durando 30 días, como una cookie y un token. El código del producto que lea mal la fecha real es un ítem de bug aparte.
40. **El Gate significa algo.** El control completo de tests del backend está en verde.

## Comportamiento

### Invitations e inicio de sesión

- **Invitation de Business nuevo**: la imprime `scripts/invite-business.sh`. Aceptarla pide un nombre de Business, un email y una contraseña, y abre el Business con ese User adentro.
- **Invitation para sumarse**: cualquier User crea una desde la app (`POST /invitations`). Aceptarla pide un email y una contraseña y suma al User al Business que invita; un nombre de Business enviado junto se ignora.
- **Aceptar cualquiera de las dos Invitations** inicia la sesión de la persona, como un inicio de sesión. Aceptar una Invitation de Business nuevo lleva al **Onboarding** de ese Business (onboarding.md); aceptar una para sumarse lleva a Home de ese Business.
- **Consultar una Invitation** dice su tipo, el Business al que lleva (solo para sumarse) y cuándo vence. Una Invitation desconocida, usada o vencida no se encuentra.
- **Email**: sin espacios al principio ni al final y en minúsculas; un User por email en toda la instalación.
- **Contraseña**: de al menos 10 caracteres; se guarda solo como hash.
- **Inicio de sesión**: el email y la contraseña devuelven una Session que dura 30 días, como una cookie y un token. Una contraseña incorrecta y un email desconocido reciben la misma respuesta.
- **Cookie de la Session**:
  - Es `Secure` solo cuando HTTPS está configurado para el deploy, y nunca se deduce del esquema ni de las cabeceras de la solicitud.
  - En el http plano de la red de casa no es `Secure`, como antes.
- **Login brakes**: dos, en `/auth/login` y en un Password change. Las rutas de Invitation y de reseteo no tienen ninguno.
  - **Por email**: cinco fallos seguidos de un email lo bloquean por 15 minutos, incluso con la contraseña correcta. Un inicio de sesión, un Password change o un reseteo exitosos reinician el conteo de ese email.
  - **Por dirección**: 20 inicios de sesión fallidos desde una misma dirección de origen en 15 minutos bloquean los inicios de sesión de esa dirección por 15 minutos. Un éxito nunca reinicia este conteo.
  - **Conteo cruzado**: cada intento rechazado cuenta para el email y para la dirección, sea cual sea el bloqueo ya activo. Eso incluye la contraseña correcta rechazada bajo un bloqueo, y una contraseña actual incorrecta en un Password change.
  - **Misma respuesta**:
    - Ambos bloqueos responden 429 con la misma demora, y la pantalla muestra el mismo mensaje del freno.
    - Nada revela un conteo, la dirección ni qué freno saltó.
  - **Origen de la dirección**:
    - Por defecto es la dirección de la conexión.
    - Se toma de la cabecera de dirección reenviada solo cuando la solicitud viene del proxy de confianza (el de Render, ADR-0016).
    - El proxy de confianza se fija en la configuración, nunca se adivina.
    - La misma regla vale en la red de casa y en la instalación publicada.
  - **Logs**: no se registra ninguna dirección de origen, email ni token.
  - **Direcciones compartidas**: quienes comparten una dirección pueden, entre todos, disparar el bloqueo de la dirección. Se acepta con 20 fallos en 15 minutos.
- `GET /auth/me` responde el email del User y el nombre de su Business.
- Cerrar sesión descarta la cookie y va al inicio de sesión. No borra la Theme choice del dispositivo.

### Cambiar la contraseña

- **Una ruta protegida.** El User sale de la Session. Recibe la contraseña actual y una nueva.
- **Contraseña nueva**: de al menos 10 caracteres, la única regla. Se acepta una contraseña nueva igual a la actual, y igual cuenta como cambio.
- **Si sale bien**:
  - cambia el hash de la contraseña, así que toda otra Session del User se cierra sola (ADR-0002);
  - el dispositivo que actúa recibe una cookie de Session y un token nuevos en la misma respuesta y sigue con la sesión iniciada;
  - las Sessions de los socios no se tocan;
  - se retira cada Reset link sin usar del User;
  - se reinicia el conteo del freno del email y se levanta su bloqueo. El conteo de la dirección nunca se toca.
- **Una contraseña actual incorrecta** se rechaza y cuenta como un inicio de sesión rechazado para los dos frenos.
- **Bajo cualquiera de los bloqueos**: Change se rechaza con el 429 del inicio de sesión, la misma demora y el mismo mensaje del freno, incluso con la contraseña actual correcta.

### Resetear una contraseña olvidada

- **El comando**: `scripts/reset-password.sh <email>`, que corre el Operator, como `scripts/invite-business.sh`. Sin editar la base de datos a mano.
  - El email queda sin espacios al principio ni al final y en minúsculas, como en el inicio de sesión.
  - **Un email que no coincide con ningún User**: imprime un simple "no user for that email", no escribe nada y no retira nada.
  - **Si no**: crea un Reset link para ese User y retira el anterior sin usar del User. Imprime el link solo en la terminal, nunca en un log.
  - No dice nada sobre links anteriores, y no registra nada personal.
  - El Operator nunca ve ni elige la contraseña nueva.
- **Reset link**:
  - funciona una sola vez y vence 24 horas después de emitido;
  - solo se guarda un digest de su token.
- **Un link vigente por User**:
  - un link nuevo retira cualquier anterior sin usar;
  - cualquier cambio de contraseña, por Change o por un reseteo, retira cada link sin usar del User;
  - un link retirado responde exactamente igual que uno desconocido, usado o vencido: 404.
- **Abrir el link** (consultarlo) no lo gasta. Solo un envío exitoso lo usa. El vencimiento y el retiro siguen valiendo mientras solo se lo mira.
- **Enviarlo** pide solo la contraseña nueva.
  - La regla es de al menos 10 caracteres, y se acepta una contraseña usada antes.
  - Si sale bien, pasa todo esto:
    - se fija la contraseña;
    - el link queda usado;
    - se retiran los otros links sin usar del User;
    - se cierra cada Session del User;
    - este dispositivo inicia sesión y llega a Home;
    - se reinicia el conteo del freno del email y se levanta su bloqueo, nunca los de la dirección.
  - Un link que quedó viejo entre abrirlo y enviarlo responde 404.
- **Sin freno en las rutas de reseteo**: son abiertas y sin freno, como las rutas de Invitation. Un email bloqueado es justamente para quien es el link.
- **Cómo se entera el vendedor** de que existe el reseteo: desde "Forgot your password?" en Sign in (ver "Entrar" en La app). La app solo lo explica; pedirlo y emitirlo pasan fuera de la app.

### Business

- **Leer el Business** responde su nombre y sus Users. Los Users se muestran solo por email, ordenados por email.
- **Renombrar el Business**:
  - El nombre queda sin espacios al principio ni al final, los espacios internos se reducen a uno, tiene hasta 60 caracteres y no puede quedar en blanco.
  - No hay ningún control de unicidad en la instalación, porque un rechazo revelaría otro Business.
- Ambas rutas toman el Business solo de la Session. Están en `tests/test_gated_routes.py` y en el barrido de aislamiento.
- **Pricing settings**: cada Business también guarda sus dos interruptores de precios, definidos en pricing-settings.md.

### Removing a business (comando del Operator)

- **El comando**: un comando del servidor que corre el Operator, como `scripts/invite-business.sh`. Sin administrador y sin ningún acceso a él en la app (ADR-0002).
  - Nombra al Business por el email de cualquiera de sus Users, sin espacios al principio ni al final y en minúsculas, como en el inicio de sesión.
  - Un email que no coincide con ningún User imprime un simple "no business for that email" y no hace nada, en ninguno de los dos modos.
- **Corrida de prueba**:
  - nombra el Business encontrado;
  - imprime conteos por tipo: Users, **Customers**, **Products**, **Price entries**, Stock entries, **Sales**, **Sale lines**, **Payments**, Expenses, Expense categories, configuración del **Catalog**, e Invitations y Reset links (solo borrados);
  - no escribe ningún archivo, no cambia ninguna fila, nunca pide confirmación.
- **Corrida real**:
  1. Nombra el Business y le pide al Operator que tipee su nombre exactamente; no puede saltearse. Un nombre incorrecto, una cancelación o la falta de respuesta no escriben ni borran nada.
  2. Escribe el archivo del export y después lo relee.
  3. En una sola transacción, borra cada fila del Business en cada tabla descubierta a partir del esquema (no una lista mantenida a mano). Eso incluye:
     - el Business y sus Users;
     - cada Invitation y cada Reset link de sus Users, sea cual sea su estado;
     - el historial de intentos de inicio de sesión de los emails de los Users eliminados.
  4. Hace commit e informa éxito solo si los conteos exportados igualan a los borrados para cada tipo exportado.
  5. Informa el nombre del Business, la ruta del archivo y los conteos exportados y borrados.
- **Cualquier falla antes del commit** no borra nada: escribir o releer el archivo, una diferencia de conteos, o una base de datos ocupada con escrituras de otros Businesses. El Operator lo vuelve a correr.
  - También elimina el archivo de export que creó la corrida, se haya escrito entero o solo en parte, así que no queda ningún archivo (ADR-0015). Esto incluye una escritura que falla después de que el archivo ya se creó en disco, y una corrida interrumpida.
  - Un registro creado por los propios Users del Business que se va entre el export y el borrado hace que los conteos difieran, y el borrado se bloquea en lugar de perderlo.
- **Resultado del commit desconocido**: el propio commit falla de una forma que deja sin saber si se aplicó (por ejemplo, se cae la conexión a la base de datos durante el commit).
  - El commit es una sola transacción: o no queda ninguna fila del Business o siguen todas. No hay eliminación parcial.
  - El comando conserva el archivo del export, porque puede ser la única copia que queda de los números del Business. Nunca dice "nothing deleted" y nunca informa éxito. Sale con un estado de falla.
  - Imprime: "Commit outcome unknown; export kept at <path>. Run with --dry-run and the same email before anything else." Junto con eso: el nombre del Business y los conteos exportados, nunca conteos borrados.
  - **Revisar, después volver a correr**: se permite volver a correrlo, sin bloqueo ni marca guardada. La corrida de prueba con el mismo email dice cómo salió:
    - "no business for that email": la eliminación ocurrió. El archivo conservado es el export para entregar.
    - El Business aparece nombrado con sus conteos: no se borró nada. Una corrida real es entonces una corrida común.
      - Escribe un archivo nuevo con un nombre nuevo, nunca sobrescribe el conservado. Solo se entrega el archivo más nuevo.
      - El Operator borra a mano el archivo conservado y desactualizado, porque guarda datos personales. El comando nunca toca un archivo que no creó en la misma corrida.
- **Los otros Businesses** siguen usando la app durante la corrida, nunca se los frena a propósito y nunca se les avisa nada.
- **El archivo del export**:
  - un archivo JSON por corrida real, con permisos solo para el dueño, escrito en el sistema de archivos del servidor y nunca en un lugar que sirva la app;
  - su nombre lleva el nombre del Business (en forma de slug) y la fecha y hora de la corrida; un archivo existente nunca se sobrescribe;
  - valores simples: fechas ISO 8601, pesos enteros, gramos como decimales de hasta dos posiciones;
  - cada registro nombra aquello a lo que se refiere (Customer, Product, categoría) además de su id;
  - guarda cada hecho registrado tal como está guardado:
    - el nombre del Business y sus Pricing settings (Bulk price y VIP customers);
    - Users (email y fecha de ingreso);
    - Customers (nombre, Phone number, VIP);
    - Products con su **Low-stock threshold** y sus **Catalog attributes**;
    - Price entries, con su **VIP price**;
    - Stock entries (fecha, Product, gramos, origen, costo total, nota; un **Lot** es su Stock entry, no un registro aparte);
    - Sales (fecha, Customer, **Shipping charged**, **Note**, cómo se pagó);
    - Sale lines (Product, gramos, precio por gramo guardado, **Pricing rule**, total de la línea);
    - Payments (fecha, monto, método, Customer, y su Sale en un **On-the-spot payment**);
    - Expense categories y Expenses;
    - el Catalog header and footer;
  - deja afuera:
    - las cifras calculadas (Balances, **Owing since**, **Settlement**, **Stock**, costo por gramo, **Cost of goods sold**);
    - los hashes de contraseña;
    - cualquier secreto guardado, como el token de un bot de Telegram;
    - las Invitations y los Reset links;
    - el historial de intentos de inicio de sesión.
- **Después de la eliminación**:
  - una Session que dejó abierta un User eliminado recibe 401 y va al inicio de sesión;
  - una Invitation nueva al mismo email abre un Business nuevo como cualquier otro, con un conteo de intentos de inicio de sesión limpio y nada del Business viejo.
- **Privacidad** (ADR-0005): no se imprime ni se registra nada personal (ni emails, nombres, Phone numbers, montos ni contenidos del archivo). El nombre del Business no es un dato personal y se puede imprimir.
- **Sus tests y el reloj** (criterio 37): cada instante que usan los tests de eliminación, incluida la hora de emisión de una Invitation, viene del reloj movible (ADR-0001), nunca del real. Las corridas comunes fijan un día de Argentina, y un control mueve el reloj por el paso de un mes a otro y de un año a otro.

### La app

- **Cómo se sirve**: el backend sirve el front compilado desde `web/dist` en el mismo origen y puerto de la API.
  - Las rutas del front nunca chocan con las de la API.
  - No se puede llegar a nada fuera de `web/dist`.
  - Las rutas del front son archivos estáticos públicos, fuera de la lista de rutas de la API. Sus rutas están en inglés, con redirecciones desde las viejas en español (navigation.md).
- **Instalable, sin modo offline**:
  - un manifest con nombre, colores e íconos para Android e iOS (sus campos están en "La app instalada", más abajo);
  - un service worker que no guarda nada en caché.
- **Instalación en la red de casa**, servida por http plano (ADR-0002):
  - iOS se instala con "Add to Home Screen", sin guía paso a paso;
  - Android recibe un acceso directo en la pantalla de inicio, porque los navegadores permiten un service worker y el aviso de instalación solo en un origen seguro;
  - la app no muestra ningún banner ni explicación de la diferencia.
- **Instalación en la instalación publicada**, con el TLS de Render: se ofrece el aviso de instalación propio de Android cuando el navegador lo hace disponible. El manifest y el service worker que ya existen no necesitan más trabajo para eso.
- **Sin red**: cuando una solicitud falla porque se cayó la red, la app abierta muestra "No connection" en cualquier origen. Esto no depende del service worker.
- **Tema**: la app está en Automatic por defecto: sin nada guardado sigue en vivo la configuración clara u oscura del teléfono, y la vuelve a revisar cuando la persona vuelve a la app. Un Light o Dark guardado en ese dispositivo gana sobre el teléfono. El único lugar donde una persona elige es Settings → Appearance, Theme: Automatic, Light o Dark (navigation.md).
  - La regla es una: el atributo en `<html>` lleva el tema resuelto. Sin atributo significa claro, `data-tema="oscuro"` significa oscuro. No hay excepción por pantalla, ruta ni Session. El valor guardado es `claro` u `oscuro`; sin clave, cualquier otro valor o un error de almacenamiento es Automatic.
  - **La Theme choice se recuerda por dispositivo**:
    - tocar Automatic, Light o Dark la aplica y la recuerda al instante, sin guardar, sin toast y sin aviso de cambios sin guardar;
    - el dispositivo guarda solo la elección: nada personal, nada de dinero, ninguna Session y nada sobre un Business;
    - pertenece al dispositivo, no al User ni al Business; el dispositivo de un socio y los otros dispositivos del User no se ven afectados;
    - cerrar sesión no la borra;
    - un Dark guardado se ve en cada pantalla de ese dispositivo, la de inicio de sesión, la de la Invitation y las de reseteo incluidas; un dispositivo sin nada guardado sigue al teléfono;
    - las pantallas anteriores al inicio de sesión no tienen control de tema.
  - Los controles nativos y las barras de desplazamiento siguen al tema resuelto: claros sin atributo y oscuros con `data-tema="oscuro"`.
  - Ambos temas llevan los tokens Yerba, y cada regla sobre estados vale en ambos.
  - Los colores del manifest y la pantalla de carga son estáticos y claros. La barra de estado sigue al tema resuelto que muestra la app (`data-tema`, que en Automatic ya sigue al teléfono), no directamente a la configuración del sistema; en iOS queda clara, porque iOS fija su estilo al arrancar.
  - La fuente se sirve desde la propia app.
- **Idioma y formatos**: cada palabra en pantalla en inglés (product-language.md, que reemplaza la regla anterior en español). El dinero `$ 11.000`, un monto negativo `−$ 4.500`, los gramos `3,5 g`, las fechas `dd/mm`. El texto del Catalog conserva su propio formato de Telegram (`$11.000`, catalog.md).
- **Entrar** (la pantalla de inicio de sesión (`Entrar`), la de Business nuevo (`NegocioNuevo`), la de Invitation (`Invitacion`), la de reseteo):
  - **Dibujadas a partir del diseño** en `docs/product/design-system/pantallas/` (GH-49; Sign in rediseñada en GH-521 sobre 25-ingreso). Los dibujos llevan el texto del producto en inglés de la app; las líneas en español de los dibujos son una guía de significado.
  - **Una sola disposición centrada, del ancho de un teléfono**, en todo viewport, el de la computadora incluido; no hay una disposición solo para computadora en estas pantallas.
  - **La pantalla de Sign in** (`Entrar`, claro; `EntrarOscuro`, oscuro), de arriba hacia abajo:
    - la Yerba mark con el Wordmark, el lockup compartido de las pantallas de entrada (brand.md);
    - "Welcome back. Your business, noted.", el equivalente en inglés de "Hola de nuevo. Tu negocio, anotado.";
    - el campo "Email address"; al abrir, el foco está ahí, en todo ancho, así que en el teléfono el teclado ya está abierto;
    - el campo "Password", oculto por defecto y con su botón Show (ADR-0025); su lugar de rechazo debajo;
    - "Forgot your password?", alineado a la derecha justo debajo de "Password" y arriba del botón, como en el dibujo; siempre visible, también después de que el Login brake bloqueó el email; abre la Forgot sheet. Es un botón con forma de link y un blanco de toque de al menos 44 px;
    - el botón "Sign in", a todo el ancho; mientras envía queda desactivado y no envía dos veces;
    - el aviso fijo "After 5 failed attempts, the email is blocked for 15 minutes", sin ningún conteo de intentos restantes; con un bloqueo activo, el mensaje del freno ocupa su mismo lugar;
    - al pie de la pantalla, la línea de texto plano "You can only get in with an invitation from your business.". No es un link, no hace nada y no es un camino para registrarse.
    - Email, Password, "Forgot your password?" y "Sign in" se ven sin hacer scroll en un teléfono.
    - Una contraseña equivocada y un email desconocido muestran el mismo rechazo ("Wrong email or password"), en el lugar, conservando lo tipeado.
    - Diferencias con el dibujo, declaradas en el PR y aceptadas: el blanco de toque de 44 px de "Forgot your password?" en lugar del link de 13 px dibujado, el botón Show de "Password" y el aviso fijo del freno, que el dibujo no muestra. También se aceptan, porque se siguen leyendo como el dibujo 25-ingreso: el lockup compartido en una sola fila (marca al lado del Wordmark) en lugar de la marca apilada sobre el Wordmark, la columna que arranca arriba en lugar de centrada en vertical, y la línea de la Invitation al pie de la pantalla en lugar de justo debajo del botón.
  - **La Forgot sheet**, que abre "Forgot your password?":
    - es una Sheet, dibujada por el componente compartido: a pantalla completa en el teléfono, con "Close" arriba como única salida, igual que el gesto de volver (es una entrada del historial, ADR-0027); en la computadora conserva su propio marco de diálogo, donde Escape también la cierra; no tiene acción principal abajo;
    - su título es "Forgot your password?"; al abrirse, el foco va a "Close";
    - es texto fijo, igual para todos: sin campos, sin botón de envío, sin datos de contacto y sin mensaje armado para copiar o compartir;
    - no lee, no muestra y no envía nada de lo tipeado en Sign in; abrirla o cerrarla no hace ningún pedido;
    - mientras está abierta, Sign in queda inerte; al cerrarla se vuelve a Sign in con lo tipeado, el rechazo o el mensaje del freno intactos, y el foco vuelve a "Forgot your password?";
    - dice, en este orden, tres párrafos:
      - que el Reset link lo da la persona que maneja la app para tu Business (la que te mandó la Invitation), y no llega por email;
      - que le pidas a esa persona un Reset link y le digas con qué email inicias sesión;
      - que el link funciona una sola vez, por 24 horas, y te deja elegir una contraseña nueva sin saber la actual;
    - no usa la palabra "operator" ni nombra ningún canal (WhatsApp, Telegram, un número de teléfono), y no guarda ningún contacto: así sirve a cualquier instalación (Assume nothing);
    - no dice que un reseteo levanta el bloqueo: un reseteo reinicia solo el conteo del email, nunca el de la dirección, así que esa línea engañaría a quien acaba de quedar bloqueado;
    - no tiene dibujo propio, así que la Design capture no la compara.
  - Cualquiera de los bloqueos muestra el mensaje del freno, sin cambios y sin mención de "Forgot your password?". Ningún texto nombra el freno por dirección, y ambos bloqueos se ven y se leen igual.
  - Una solicitud respondida con 401 va al inicio de sesión.
  - Una Invitation desconocida, usada o vencida muestra "This invitation no longer works".
  - Abrir `/invitation/{token}` o `/reset/{token}` con la sesión iniciada primero cierra la sesión, a través del backend, y después muestra la pantalla de la Invitation o la de reseteo como sin sesión. Eso incluye el link para sumarse al propio Business del User, y un Reset link para el mismo User.
  - **La pantalla de reseteo** (`/reset/{token}`) reutiliza la disposición de la pantalla de Invitation (`Invitacion`); no tiene archivo de diseño propio y está registrada en `scripts/design/screens.json` como pantalla de teléfono sin sesión:
    - "Choose your new password", un campo "New password" (oculto por defecto, con opción para mostrarlo) y el botón "Save and sign in";
    - una contraseña de menos de 10 caracteres muestra el mismo rechazo que al aceptar una Invitation y conserva lo tipeado;
    - si sale bien va a Home, sin toast.
  - **Un Reset link muerto**: un link desconocido, usado, vencido o retirado muestra "This link no longer works. Ask whoever sent it for a new one."
    - Se muestra tanto al abrir el link como cuando un envío responde 404.
    - No conserva nada tipeado y nunca dice por qué el link está muerto.
    - Su único botón va a la pantalla de inicio de sesión.
- **Dónde está cada pantalla**: la barra, la barra lateral, More, Settings, el marco, la regla de regreso y el primer uso son navigation.md. Home es el Panel (results.md).

### La app instalada

Cómo la app llena la pantalla de un teléfono y responde al toque una vez instalada (criterios 33–36). No cambia la disposición propia de ninguna pantalla ni el comportamiento de la barra o de la cabecera (#59), y no construye ninguna Theme choice: la barra de estado sigue a lo que sea que fije `data-tema`.

- **Documento y viewport**:
  - el viewport dice `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`;
  - no hay `maximum-scale` ni `user-scalable=no`: el zoom con dos dedos sigue permitido;
  - `mobile-web-app-capable` está puesto; `apple-mobile-web-app-status-bar-style` es `default`;
  - en iOS se maneja el inset superior, así que el contenido nunca queda bajo el notch;
  - `-webkit-text-size-adjust: 100%`.
- **Barra de estado**:
  - exactamente un meta `theme-color`, sin atributo `media`, con el `--papel` claro en el HTML estático;
  - un solo lugar pone o quita `data-tema` y actualiza `theme-color` junto con él, también al arrancar la app, a partir del token de papel del tema, nunca de un valor copiado;
  - no hay ningún par de metas con `prefers-color-scheme`: la configuración del sistema llega a la página solo a través del módulo del tema;
  - solo Android lo sigue en vivo; iOS mantiene la franja clara `default` en ambos temas.
- **Insets**: cuatro tokens, `--inset-arriba`, `--inset-abajo`, `--inset-izquierda` y `--inset-derecha`, armados a partir de `env(safe-area-inset-*)`.
  - Los de arriba y abajo los usan la barra, la cabecera, el "+ New sale" fijo, las Sheets y los toasts.
  - Los de izquierda y derecha mantienen el contenido, la barra, las Sheets y los toasts lejos de un recorte lateral, así que la horizontal es segura pero no está diseñada.
- **Altura**: toda altura atada a la pantalla usa `dvh`, `.pantalla`, `.disposicion` y las Sheets incluidas.
- **Gestos y toque**:
  - `overscroll-behavior: none` en `html` y `body`, `contain` en las regiones con desplazamiento;
  - `-webkit-tap-highlight-color` transparente; `touch-action: manipulation`;
  - `user-select: none` en botones, pestañas y la barra; el texto dentro de listas y campos sigue siendo seleccionable;
  - `.boton*`, las filas y los ítems de la barra reciben un estado `:active` armado con tokens, en ambos temas.
- **Teclado**: en iOS y Android, cuando se abre el teclado, la página y cada Sheet mantienen a la vista el campo con foco y se pueden desplazar, así que "Save" o "Record payment" se alcanzan desplazándose.
  - No se promete una acción de guardar fija sobre el teclado; esa es una decisión propia de cada pantalla.
  - La barra de pestañas y "+ New sale" no necesitan quedar sobre el teclado, porque los formularios y las Sheets no los muestran (navigation.md).
- **Manifest**:
  - `id` `"/"` (nunca cambia una vez publicado), `scope` `"/"`, `lang` `"en"`, `display` `"standalone"`;
  - `theme_color` y `background_color` con el `--papel` claro, y sin `orientation`;
  - íconos: los 192 y 512 existentes conservan `"purpose": "any"` sin cambios;
  - un 512 maskable conserva el aspecto de hoy (el mismo fondo y los mismos colores de la marca, a sangre completa, la marca dentro de la zona segura), dibujado por diseño.
- **Pantalla de carga**: sin `apple-touch-startup-image`; iOS muestra su propia pantalla de arranque en blanco, aceptada. La pantalla de carga de Android sale del `background_color` y del ícono del manifest.
- **Limitaciones aceptadas**: en iOS la franja de estado queda clara con texto oscuro sobre el papel oscuro en el tema oscuro; en iOS la pantalla de arranque queda en blanco hasta que la app se dibuja.

### El estándar del teléfono (todas las pantallas)

La regla que cumple cada pantalla en anchos de teléfono (criterios 37–41). Está escrita una sola vez, con los mismos ocho requisitos y las mismas etiquetas "checked" o "review", en dos lugares:

- CODING_STANDARDS §10 "Phone";
- "En el celular" del README de diseño.

Este archivo solo dice dónde se aplica y cómo se mantiene. No repite los requisitos.

- **Dónde se aplica**: solo por debajo del corte de computadora de 900 px. Las disposiciones de computadora quedan fuera de su alcance.
  - Las pantallas para entrar son pantallas, no Sheets, y se les aplica cada regla. La Forgot sheet es una Sheet y se le aplica la regla de las Sheets.
  - Las confirmaciones son diálogos cortos, no Sheets.
- **Qué cita, sin repetir**:
  - la app instalada de este archivo: el meta del viewport, `dvh`, los tokens de inset, el estado `:active`, el resaltado de toque y `contain` en las regiones con desplazamiento;
  - ADR-0027: una Sheet es un elemento del historial;
  - ADR-0028: New sale fijado al viewport visual;
  - ADR-0029: la tabla de contraste.
- **Meta del viewport**: el estándar dice solo el resultado. El campo con foco queda a la vista y el envío se alcanza desplazándose. Nadie cambia el meta fuera de #77, que lo entrega con la comparación en el teléfono de cada pantalla de ADR-0028. Hasta entonces vale el hook de ADR-0028.
- **Excepciones**: el doc de producto de un área puede registrar una excepción deliberada. Sin una, el estándar gana sobre un issue de área. Los ADRs deciden cómo se implementa una regla.
- **El control, `web/e2e/mobile.spec.ts`**:
  - **Preparación**: Playwright con isMobile y hasTouch, en 320×568, 375×812, 430×932 y 246×437 (130 %), en claro y oscuro.
  - **Cobertura**:
    - cada ruta de `scripts/design/screens.json`;
    - cada formulario y Sheet, la Forgot sheet incluida, recorrida sin bloqueo (`EntrarOlvido`) y con el mensaje del freno visible (`EntrarFrenoOlvido`);
    - los estados compartidos de `Estados`: el mensaje del freno, los dos textos de link muerto, "No connection", el reintento genérico, las dos formas de "That is gone." y la carga.

    Una ruta del front que falta en `screens.json` lo hace fallar.
  - **Datos de prueba**: un nombre de 60 caracteres, y cifras de nueve dígitos ("$ 999.999.999", y "−$ 999.999.999" en **Profit** y **Cash**).
  - **Estados vacíos**: las redacciones de estado vacío prohibidas mientras cargan los datos se leen de una sola lista en el spec.
  - **Sin automatizar**: el teclado real y la pasada en un dispositivo real quedan a ojo, como exigen la app instalada y ADR-0028.
- **Lista de infractores**:
  - Cada elemento es una pantalla, una regla y un número de issue.
  - La corrida falla ante un infractor nuevo, ante un elemento cuya pantalla ahora pasa y ante un elemento sin número de issue.
  - No hay consulta por la red; la revisión verifica que el número sea un issue de área real y abierto.
  - Las aserciones del marco salen activadas, con las pantallas que hoy fallan listadas contra #59.
- **Adjunto**: la salida de `scripts/design/compare.sh` y cada PR de área adjuntan el resultado del control.

### En Settings: Business, Users, Appearance, Your account

Estos grupos de Settings (navigation.md) reemplazan a la antigua pantalla Business, que ya no existe; `/negocio` redirige a Settings. Cada uno es su propia subpantalla, un formulario: "Close", y una confirmación al salir con cambios sin guardar; uno sin tocar se cierra al instante. (Prices, entre Users e Integrations, es pricing-settings.md.)

- **Business**: renombrar el Business. Toast "Business renamed"; rechazos en línea, conservando lo tipeado.
- **Users**:
  - los Users por email, ordenados por email, con el que tiene la sesión iniciada marcado "you"; siempre lista al menos al User con la sesión iniciada;
  - "Invite a partner": cada toque crea un link nuevo para sumarse, para copiar o compartir con el menú de compartir del teléfono.
  - **Compartir el link para sumarse** sigue la misma regla de resultado que el Share del Catalog (catalog.md):
    - el éxito, o cerrar el menú de compartir sin enviar, no muestra nada y no cambia nada;
    - un menú de compartir que espera terminar nunca retiene la pantalla: "Invite a partner", volver a compartir y copiar el link nunca quedan desactivados ni ocupados por él, y un compartir que nunca termina cuenta como cerrar el menú, sin límite de tiempo;
    - una falla real, incluido un segundo compartir rechazado, muestra el mensaje de falla fijo que ya tiene la pantalla y deja disponible copiar el link; no se agrega ningún mensaje nuevo;
    - solo se muestra el resultado del último compartir; uno anterior que termina tarde no muestra nada;
    - no se copia nada por sí solo, y ningún mensaje lleva el link.
- **Appearance**: Light y Dark, con el actual marcado por palabra o forma y `aria-checked` o equivalente, nunca solo por color. Un toque aplica y recuerda la elección en el dispositivo (ver Tema). Nunca tiene cambios sin guardar, así que "Close" siempre cierra al instante.
- **Your account**:
  - "Change password", arriba de "Sign out", abre una Sheet:
    - los campos son "Current password" y "New password";
    - "New password" se pide una vez, oculta por defecto con opción para mostrarla, acá y en la pantalla de reseteo;
    - si sale bien, el toast "Password changed · we signed out your other sessions";
    - una contraseña actual incorrecta dice "That is not the current password.". "Current password" se vacía y "New password" conserva lo tipeado;
    - una contraseña de menos de 10 caracteres muestra el mismo rechazo que al aceptar una Invitation, y un bloqueo muestra el mensaje del Login brake, conservando lo tipeado;
  - cerrar sesión ("Sign out"), que va al inicio de sesión.

### La instalación publicada (ADR-0016)

- **Alojamiento**:
  - Render aloja la app y hace el deploy automático en cada merge a `master`.
  - Turso (libSQL, `aws-us-east-1`) guarda la base de datos, con restauración a un punto en el tiempo sobre las últimas 24 horas. Sigue en pie el SQLite de ADR-0001.
- **Disponibilidad**: UptimeRobot consulta el endpoint de salud cada 5 minutos. El endpoint de salud no responde nada sobre ningún Business, ni siquiera que existe uno: ningún nombre, id ni conteo.
- **Backup diario**: un workflow de GitHub Actions copia la base de datos todos los días y cifra la copia con `age`.
  - La copia se guarda fuera de Render y de Turso.
  - La identidad que descifra se guarda fuera del repositorio y de ambos proveedores.
- **Secretos**: ninguno en el repositorio.
- **`deploy/README.md`** da cada paso desde cero: el servicio de Render, la configuración de Turso, el workflow de backup y el monitor de UptimeRobot.
  - El límite de red y el TLS de Render reemplazan el escuchar en `127.0.0.1` detrás de un proxy inverso.
- **Restore drill**: un script que el Operator corre a mano, sin temporizador y sin canal de notificación.
  - Restaura desde la restauración a un punto en el tiempo de Turso y desde la copia diaria cifrada en un destino de prueba, sin efecto sobre la app en marcha.
  - Cada corrida informa el resultado del chequeo de integridad, los conteos de filas y la hora del último cambio de la copia restaurada.
  - Su frecuencia está fijada en `deploy/README.md`: una vez antes de salir en vivo, después de cualquier cambio en cómo se configuran la app o su backup, y una vez por mes.
- **Publicar tiene una condición previa**:
  - A nadie se le da la dirección pública hasta que se cumplan los criterios 14–17.
  - Mientras tanto se puede seguir invitando a quienes venden en la red de casa.
  - Publicar es cosa de la instalación entera: cada Business pasa a ser alcanzable a la vez, separado solo por el aislamiento de Sessions (ADR-0004).
- **Sin superficie de administración** (ADR-0002):
  - El estado de los frenos, la salud del backup y los resultados del Restore drill se leen desde fuera de la app: los logs, la salida del Restore drill y la corrida de GitHub Actions.
  - No se ve ni se hace nada desde una Session iniciada, y la app no suma ninguna pantalla, ruta ni acceso de navegación para eso. Settings no guarda ninguna configuración del Operator.

### Restricciones

- **Ruta de Change**: protegida. Toma el User y el Business solo de la Session, y se suma a `tests/test_gated_routes.py` y al barrido de aislamiento.
- **Rutas de reseteo** (consultar un link, enviar una contraseña nueva): abiertas, como las rutas de Invitation.
- **Códigos de rechazo**: cada rechazo lleva un código en `contract.json` (ADR-0008) y nunca repite lo ingresado (ADR-0005). Los códigos son:
  - contraseña actual incorrecta;
  - contraseña nueva demasiado corta;
  - bloqueo del freno;
  - Reset link inexistente (un solo código para desconocido, usado, vencido y retirado).
- **Secretos**: las contraseñas se guardan solo como hashes scrypt y los tokens de reseteo solo como digests (ADR-0002). Ninguna contraseña, hash, token, digest ni link aparece en logs, respuestas, la consola ni el almacenamiento del navegador.
- **El almacenamiento del navegador** guarda solo la Theme choice del dispositivo.
- **Los tests de esta capacidad son autónomos**: cada hora de la que dependen viene del reloj inyectado (ADR-0001), nunca de la fecha real, así que un control da el mismo resultado cualquier día.

### Avisos en cada pantalla

Estos estados los dibuja `Estados` (GH-49), con el estilo renovado a partir del diseño y su redacción sin cambios. Cada uno se revisa en el teléfono y dentro de la disposición de computadora propia de cada pantalla (`InicioCompu`, la disposición de computadora de Home; `VentasCompu`, la disposición de computadora de Sales; los dos paneles de Customers y Products), con las mismas palabras y formas. `Estados` no dibuja nada para un estado que ninguna capacidad define.

- **Los toasts de éxito** son cortos, fijos y no llevan datos, con una excepción deliberada.
  - Los toasts de esta capacidad:
    - "Business renamed";
    - "Invitation ready", salvo que el link se muestre en la pantalla;
    - "Password changed · we signed out your other sessions".
  - Elegir un tema no muestra ningún toast.
  - La excepción es "Payment saved · still owing $ X" (payments.md). Nombra lo que el Customer todavía debe, porque ver eso es el sentido de registrar un Payment. Cuando no queda nada adeudado dice "Payment saved".
- **Sin "Undo" en los toasts de éxito, con una excepción deliberada**: "Sale saved" (sales.md) lleva Undo, porque registrar una Sale es la carga más rápida y frecuente. Igual no lleva datos. Ningún otro aviso de éxito lo lleva.
- **Carga**: mientras una pantalla espera al servidor, muestra un estado de carga cuya redacción y forma siguen al diseño. No muestra ninguna cifra, ningún monto de relleno ni ningún texto que pueda leerse como dato (criterio 7). En anchos de teléfono también cumple la regla de carga del estándar del teléfono: con la forma del contenido, `aria-busy`, sin falso estado vacío.
- **Los estados vacíos** conservan la redacción fija propia de cada capacidad.
- **Salir de un formulario o una Sheet** con cambios sin guardar pregunta antes de descartar, y uno sin tocar se cierra al instante (navigation.md). La pregunta de New sale es "Discard the sale?" (sales.md). La Forgot sheet no tiene nada que guardar, así que siempre se cierra al instante.
- **Los rechazos** se muestran en línea y conservan lo tipeado. La única excepción: una contraseña actual incorrecta vacía "Current password".
- **Sin red** muestra "No connection"; un error del servidor muestra un reintento genérico.
- **Un registro que ya no está** responde 404 tanto si se borró, como si nunca existió o si pertenece a otro Business (ADR-0004). La app nunca dice quién lo borró ni que alguna vez existió.
  - **Guardar una edición, confirmar un borrado o deshacer** sobre un registro que ya no está:
    - el formulario o el diálogo se cierra y lo tipeado se descarta;
    - la lista de la que vino se actualiza;
    - se muestra un aviso fijo: "That is gone. The list is up to date."
  - El aviso no es un toast de éxito. No tiene datos, ni "Undo" ni acción de reintentar, y se anuncia como un toast.
  - Confirmar el borrado de un registro que ya no está da el mismo aviso, no el toast de éxito del borrado.
  - **Abrir el detalle de un registro que ya no está** (un Product, un Customer, una Expense, una Sale o una Stock entry) muestra "That is gone." con un solo botón de vuelta a su lista:
    - "Back to Products" (un Product o una Stock entry);
    - "Back to Customers";
    - "Back to Expenses" (el mes actual);
    - "Back to Sales".

    No lleva id, nombre ni fecha.
- Ningún estado se distingue solo por color: un signo, una flecha o una palabra en cada suba, pérdida, deuda o estado; las series de los gráficos rotuladas directamente, en cualquiera de los temas.

## Métricas

- **Sin curl (criterio 4)**: pasa una corrida de punta a punta solo por el front. Acepta una Invitation de Business nuevo, renombra el Business desde Settings → Business, crea un link para sumarse desde Users y lo acepta como segundo User.
- **Compartir el link para sumarse**: con un menú de compartir simulado, en Settings → Users, 100% pasando:
  - una resolución y una cancelación no muestran nada;
  - una falla forzada muestra el mensaje de falla existente y deja copiar el link;
  - un compartir que nunca se resuelve no muestra nada y deja usables "Invite a partner", compartir y copiar, y un segundo compartir vuelve a llamar al menú de compartir;
  - un segundo compartir rechazado muestra el mensaje de falla existente;
  - un compartir anterior que se resuelve después de uno más nuevo no muestra nada;
  - compartir no escribe nada en el portapapeles, y ningún mensaje lleva el link.
- **Aislamiento (criterios 1, 6)**:
  - las rutas del Business están en el barrido de aislamiento y en el test de rutas protegidas;
  - los tests de servicio prueban que ninguna ruta llega fuera de `web/dist`;
  - después de una corrida completa, el almacenamiento del navegador guarda solo la Theme choice, y la consola y el almacenamiento del navegador no guardan nada personal ni dinero;
  - ninguna URL del front lleva un id de Business;
  - un registro de otro Business, abierto por id, muestra el mismo "That is gone." que uno borrado.
- **App de teléfono (criterio 5)**:
  - el manifest pasa el control de instalabilidad del navegador, corrido en `localhost`;
  - la instalación en un teléfono no se verifica automáticamente;
  - ambos temas se dibujan a partir de los tokens;
  - un control sin conexión muestra "No connection";
  - ningún estado se distingue solo por color.
- **Tema (criterios 23–26)**:
  - Automatic sigue al teléfono: una corrida e2e con el sistema emulado en oscuro (`emulateMedia({ colorScheme: 'dark' })`) y nada guardado pone `data-tema="oscuro"` y `theme-color` igual al `--papel` oscuro; un cambio de `emulateMedia` a claro quita el atributo y devuelve el meta a #f6f7f5, en vivo;
  - una elección guardada gana: `tema=claro` en un teléfono oscuro sigue claro después de recargar; `tema=oscuro` abre oscuro; un valor desconocido se lee como Automatic;
  - Settings → Appearance ofrece Automatic, Light y Dark, en ese orden; elegir aplica al instante, sin toast, sin botón de guardar y sin aviso de cambios sin guardar, y la opción activa se marca con un tilde más su palabra, no con color;
  - la elección sobrevive a una recarga y a un cierre de sesión; con Dark guardado, la pantalla de inicio de sesión, la de la Invitation y las de reseteo se ven oscuras;
  - el almacenamiento del navegador guarda solo la Theme choice;
  - los controles nativos y las barras de desplazamiento se revisan a ojo en un dispositivo con el sistema oscuro, claros sin atributo y oscuros con él; ningún test rápido los lee;
  - los cuatro lugares que dicen la regla dicen lo mismo, y ninguno nombra `claro` como valor de atributo.
- **App instalada (criterios 33–36)**:
  - etiquetas meta, test rápido: el viewport tiene sus cuatro partes y ninguna restricción de zoom; están `mobile-web-app-capable` y el estilo de barra de estado de iOS `default`; exactamente un `theme-color`, sin `media`;
  - manifest, test rápido: `id: "/"`, `scope: "/"`, `lang: "en"`, `display: "standalone"`, `theme_color` y `background_color` iguales a `--papel`, sin `orientation`; íconos 192 y 512 `any` y un 512 `maskable` presentes;
  - instalabilidad: el manifest sigue pasando el control de instalabilidad del navegador en `localhost` con sus campos nuevos;
  - barra de estado, test del front que maneja `data-tema` directamente: `theme-color` es el `--papel` claro sin atributo, el token de papel oscuro con `oscuro`, y claro otra vez una vez que se quita el atributo (la lectura del sistema llega al atributo solo a través del módulo del tema);
  - controles estáticos: no queda ningún `vh` atado a la pantalla en `app.css` (en su lugar `dvh`); los cuatro tokens de inset existen, y la barra, la cabecera, "+ New sale", las Sheets y los toasts los usan; ningún valor de token existente cambió salvo la paleta Yerba;
  - regresión: las suites de cuentas, Navigation y avisos pasan sin cambios; la barra entra en 320 px con el texto al 130 %; el estado presionado usa solo tokens, en ambos temas;
  - a ojo, en vertical, en un iPhone real instalado por la red de casa y en un teléfono Android real en la instalación publicada:
    - el criterio 33, con New sale, Record payment y el formulario de Expense abiertos con el teclado;
    - el criterio 35, con el estado presionado visible en ambos temas;
    - la barra de estado de Android en ambos temas;
    - la franja clara de iOS, con el inset superior manejado;
    - el ícono maskable en el launcher de Android.
- **Estándar del teléfono (criterios 37–41)**: sin telemetría; las medidas salen del control y de la revisión.
  - infractores: la cantidad de elementos en la lista de infractores, por regla y por issue. Empieza en la cantidad de hoy y solo baja, informada en cada PR de área y en la salida de `compare.sh`. Meta: 0 una vez que cierren #45–#49, #59, #60 y #78;
  - control adjunto: la proporción de PRs de área que adjuntan el resultado del **Mobile check**. Meta: 100%;
  - escrito una vez: un control de revisión de que CODING_STANDARDS §10 y el README de diseño listan los mismos ocho requisitos con las mismas etiquetas, y no contradicen nada de este archivo, ADR-0027, ADR-0028 ni ADR-0029;
  - cobertura: el spec falla ante una ruta que falta en `screens.json`, y un test muestra que se hace cumplir una redacción agregada a la lista de estados vacíos;
  - reglas de infractores: los tests muestran que la corrida falla ante un infractor nuevo, ante un elemento arreglado que quedó listado y ante un elemento sin número de issue;
  - sin regresión: los tiempos de registro de menos de 60 s (Sale, Payment, Stock entry, Expense) y las suites existentes de cuentas, Navigation, Sales y avisos pasan sin editarse;
  - a ojo: la pasada en dispositivo real, como para la app instalada y ADR-0028.
- **Nada inventado (criterio 7)**:
  - la barra, la barra lateral, More y Settings muestran exactamente los accesos que lista navigation.md;
  - cada cifra de Home es igual a la respuesta de la API, con ceros reales para un período sin actividad (results.md);
  - Home no muestra otros avisos que la **First-run checklist**, "Start with your products", el del **Pinned catalog** y el aviso posterior al **Spreadsheet import**.
- **Password change (criterio 18)**:
  - después de un Change, cada token anterior del User responde 401;
  - el token nuevo del dispositivo que actuó funciona, y el token de un socio en el mismo Business sigue funcionando;
  - a través del front, desde un viewport de teléfono, un Change se completa (`web/e2e/passwords.spec.ts`); ningún test mide su duración.
- **Matriz de reseteo (criterio 19)**, 100% pasando:
  - un link funciona una sola vez;
  - está muerto después de 24 horas (reloj falso);
  - lo retira un link más nuevo;
  - lo retiran un Change y otro reseteo completado;
  - abrirlo dos veces no gasta nada;
  - abrir y enviar responden el mismo 404 sea cual sea la causa;
  - un reseteo exitoso cierra cada Session anterior.
- **Secreto de la contraseña (criterio 20)**:
  - ninguna contraseña, token, digest ni link aparece en ninguna respuesta, rechazo ni línea de log;
  - después de una corrida completa del front por ambos flujos, ninguno está en la consola ni en el almacenamiento del navegador;
  - el link del comando va solo a la terminal.
- **Frenos de contraseña (criterio 21)**, con un reloj falso:
  - una contraseña actual incorrecta cuenta para los dos frenos;
  - cualquiera de los bloqueos rechaza Change con el mismo 429 y la misma demora que el inicio de sesión;
  - un Change o un reseteo exitosos reinician solo el conteo del email;
  - las rutas de reseteo nunca se frenan.
- **Comando de reseteo (criterios 20, 22)**: un email sin User escribe 0 filas y retira 0 links.
- **Sin curl para las contraseñas (criterio 22)**: la corrida de punta a punta por el front:
  - cambia una contraseña desde Settings → Your account, después de lo cual una Session vieja queda cerrada y esta sigue adentro;
  - completa un reseteo desde un link impreso hasta Home;
  - ve el estado de link muerto para un link usado.
- **Entrar, rediseñado (criterios 27–32)**:
  - rápido: desde un viewport de teléfono, la corrida de punta a punta por el front acepta una Invitation, completa un reseteo desde un link impreso e inicia sesión en la pantalla de inicio de sesión, y en cada caso llega a Home con la sesión iniciada (`web/e2e/passwords.spec.ts`); ningún test mide la duración de los links;
  - estados: los tests del front muestran cada texto fijo (mensaje del freno, los dos textos de link muerto, "No connection", el reintento, las dos formas de "That is gone.", la carga); la forma y el color se revisan a ojo en ambos temas;
  - la carga no es un dato: un test del front muestra que el estado de carga no tiene ningún dígito, símbolo de moneda ni cifra de relleno;
  - diseño:
    - `scripts/design/compare.sh` corre antes y después para la pantalla de inicio de sesión (`Entrar`), la de Business nuevo (`NegocioNuevo`), la de Invitation (`Invitacion`), `/reset/{token}` y los estados compartidos (`Estados`), con las comparaciones adjuntas al PR;
    - una pasada a ojo en viewports de teléfono y de computadora cubre las pantallas para entrar y los estados compartidos (`Estados`) dentro de las disposiciones de computadora;
    - cada diferencia de redacción entre el diseño y los docs se lista en el PR;
  - nada revelado: el mismo rechazo para una contraseña incorrecta y un email desconocido, ningún conteo de intentos, ningún detalle del freno; el link muerto y "That is gone." no llevan id, nombre, fecha ni motivo;
  - registro: `scripts/design/screens.json` tiene `/reset/{token}` y `compare.sh` la mide;
  - sin regresión: la suite existente pasa sin editar ningún test para que se ajuste al aspecto nuevo.
- **Sign in con el nuevo estilo y la Forgot sheet (criterios 42–45, GH-521)**:
  - una sola pasada (42): un e2e en viewports de teléfono (320×568 y 375×812, claro y oscuro) verifica que al abrir Sign in el foco está en "Email address", que "Email address", "Password", "Forgot your password?" y "Sign in" se ven sin scroll, y que la corrida cae en Home con la sesión iniciada;
  - a un toque (43): un e2e verifica que "Forgot your password?" abre la Forgot sheet con un toque, también con el mensaje del freno visible, y que volver la cierra con lo tipeado intacto; un test de front verifica que su texto fijo dice la persona que te mandó la Invitation, el email con el que inicias sesión, una sola vez, 24 horas y sin la contraseña actual, y que "Close", Escape y volver regresan a Sign in con lo tipeado intacto y el foco en "Forgot your password?";
  - no revela nada (44): un test de front verifica que el texto de la Forgot sheet es idéntico con el formulario vacío, con un email registrado, con uno desconocido y con el bloqueo activo; que abrirla o cerrarla no hace ningún pedido; y que el texto no contiene "operator" ni ningún canal;
  - diseño (45): una Design capture de `Entrar` y `EntrarOscuro` contra la pantalla construida, en teléfono y computadora, adjunta al PR y juzgada a ojo según el Drawing as guide; `web/e2e/mobile.spec.ts` pasa para Sign in, `EntrarOlvido` y `EntrarFrenoOlvido` en ambos temas, sin infractores nuevos;
  - sin regresión: las suites existentes de accounts y de los frenos pasan sin editar, y el mensaje del freno no cambia.
- **No sobrevive nada (criterio 11)**:
  - después de una corrida real sobre uno de dos Businesses sembrados con uno de cada cosa, 0 filas llevan su id en ninguna tabla descubierta a partir del esquema;
  - se van las Invitations pendientes, usadas y vencidas;
  - se van los Reset links de cualquier estado de sus Users;
  - `login_guard` no guarda nada para los emails eliminados;
  - una tabla agregada al esquema más adelante queda cubierta sin cambiar el comando, comprobado por un test.
- **Export = borrado (criterios 8, 11)**:
  - para cada tipo exportado, el conteo en el archivo es igual al conteo borrado;
  - cada campo guardado listado arriba está presente, las Pricing settings y los VIP prices incluidos, y cada referencia lleva un nombre y un id;
  - en el archivo no hay ningún hash de contraseña, digest de Invitation, digest de Reset link ni secreto;
  - la corrida de prueba cuenta los Reset links solo entre lo que se borra.
- **Los demás intactos (criterio 12)**: el conteo de filas de cada tabla del otro Business es idéntico antes y después, y lee todos sus datos después.
- **Resguardos (criterios 9, 10)**: 0 filas cambiadas después de cada uno de estos:
  - una corrida de prueba (y ningún archivo);
  - un email desconocido;
  - un nombre incorrecto, una cancelación o la falta de respuesta en el pedido de confirmación (y ningún archivo);
  - una falla forzada al escribir el archivo, al releerlo, en el control de conteos o durante el borrado.
  - Después de cada falla forzada antes del commit, no queda ningún archivo de export en el directorio de exports. Esto incluye una falla del adaptador de archivos real después de que el archivo se creó en disco, a mitad de su escritura o de su sincronización.
- **Resultado del commit desconocido**: una falla forzada del commit cuyo resultado se desconoce:
  - conserva el archivo del export, imprime la línea fija "Commit outcome unknown" con la ruta, nunca imprime "nothing deleted" ni éxito, y sale con un estado de falla;
  - una corrida de prueba posterior responde "no business for that email" cuando el commit se aplicó, y nombra el Business con los conteos sin cambios cuando no.
- **Archivo (criterio 8)**: permisos solo para el dueño; un archivo existente con el mismo nombre nunca se sobrescribe; el nombre lleva el nombre del Business, la fecha y la hora.
- **Sin eco (criterio 13)**: la salida capturada de la terminal y los logs de ambos modos no tienen ningún email, nombre de Customer, Phone number ni monto, solo el nombre del Business, la ruta y los conteos.
- **Comienzo limpio (criterio 13)**: después de la eliminación, el token de un User eliminado responde 401, y una Invitation de Business nuevo aceptada con el mismo email abre un Business vacío con un conteo del freno limpio.
- Las métricas de eliminación y de contraseñas corren como tests rápidos y autónomos.
- **Los tests de eliminación y la fecha (criterio 37)**:
  - la suite de eliminación pasa en su día de Argentina fijado;
  - un control mueve el reloj por el paso de un mes a otro y de un año a otro y da el mismo veredicto en cada día. Nunca se saltea ni se afloja;
  - el escaneo (`tests/architecture/test_no_real_clock.py`) cubre cada archivo bajo `tests/` y `app/` y resuelve los imports, así que también encuentra un alias o un valor por defecto que se resuelva a `datetime.now`, `utcnow`, `date.today` o `time.time`. Sus únicas excepciones son el reloj de producción (`app/clock.py::system_clock`), las raíces de composición que conectan el reloj (`app/main.py` y las tres CLIs) y el backend de e2e (`tests/e2e_app.py`, ADR-0040);
  - no se agrega ninguna aserción sobre tiempo transcurrido (ADR-0038).
- **Publicación (criterios 14–17)**: ningún test llega a la red, a Render, a Turso ni a GitHub.
  - **Frenos (criterios 3, 15)**: probados en la costura HTTP con un reloj falso, 100% pasando. Cubren:
    - el freno por email (5 seguidos, 15 minutos);
    - el freno por dirección (20 en 15 minutos, 15 minutos);
    - el conteo cruzado, incluidos los rechazos por bloqueo;
    - un éxito que reinicia solo el conteo del email;
    - la misma respuesta 429 y la misma demora de ambos bloqueos, sin revelar nada.
  - **Origen de la dirección (criterio 15)**: la cabecera reenviada se usa solo desde el proxy de confianza configurado y se ignora desde cualquier otro lugar.
  - **Cookie (criterios 14, 37–38)**: `Secure` está presente cuando HTTPS está configurado y ausente si no, y nunca sigue al esquema ni a las cabeceras de la solicitud. El test usa solo la hora fija que se le entrega y da el mismo resultado con la fecha real movida antes y después, sin cambiar su propia hora fija; sus aserciones nunca son menos.
  - **Sin filtraciones (criterios 14, 15)**:
    - ninguna línea de log del camino de inicio de sesión contiene una dirección de origen, un email ni un token;
    - el endpoint de salud no responde ningún nombre, id ni conteo de Business.
  - **Reconstruible (criterio 17)**: un control de que el repositorio no tiene ninguna credencial de Turso, identidad `age` ni otro secreto.
  - **Restore drill (criterio 16)**:
    - Automatizado: contra una copia de prueba local, el Restore drill produce la integridad, los conteos de filas y el último cambio.
    - A mano: la corrida antes de salir en vivo muestra, a partir del campo de actualidad, que la restauración está dentro del límite de menos de 1 minuto.
- **Gate en verde (criterios 39–40)**: el control completo de tests del backend (`uv run --no-project pytest -n auto`) está en verde, con los pasados iguales a los recolectados y 0 errores; los tests existentes de duración de la Session pasan sin cambios. El PR nombra la causa del rojo, y lista cualquier otro test que compare una fecha fija con la fecha real (o dice que no se encontró ninguno).

## Fuera de alcance

- Eliminar a un User mientras el Business sigue.
- Enviar cualquier email, incluido el Reset link.
- Una forma dentro de la app de pedir un reseteo; siempre lo emite el Operator. La Forgot sheet solo explica: no envía nada a nadie.
- Una configuración del contacto del Operator, o nombrar un canal de contacto en pantalla.
- Decirle al User qué Sessions se cerraron; cerrar una sola Session.
- Tipear la contraseña nueva dos veces.
- Reglas de contraseña más allá de 10 caracteres.
- Un mensaje armado para copiar o compartir con el pedido de reseteo.
- Que el mensaje del freno apunte a "Forgot your password?".
- Frenar las rutas de reseteo o las de Invitation.
- Que el comando de reseteo informe links anteriores o retirados.
- Listar Invitations pasadas o pendientes; revocar una Invitation.
- Un límite de tiempo para compartir el link para sumarse, o copiarlo por sí solo cuando compartir falla o no termina.
- Exportar un Business sin eliminarlo (un backup de uno activo).
- Volver a cargar un export.
- Eliminar un Business desde la app.
- Verificar que cada User haya aceptado la eliminación.
- Borrar el archivo del export del servidor después de entregarlo.
- Bloquear o marcar una nueva corrida después de un commit cuyo resultado se desconoce; la corrida de prueba es el control.
- Roles dentro de un Business.
- El uso offline; una guía de instalación en iOS o Android; Capacitor.
- Un control de tema antes del inicio de sesión; sincronizar la Theme choice por User, por Business o entre dispositivos.
- Una disposición solo para computadora de las pantallas para entrar; un archivo de diseño propio para la pantalla de reseteo o para la Forgot sheet.
- Cualquier estado dibujado en Estados que ninguna capacidad defina.
- TLS en la red de casa, incluidos los certificados locales: la instalación publicada recibe TLS de Render (ADR-0016).
- Actualizaciones en vivo entre socios: una lista se actualiza cuando se abre o después de guardar, no cuando el otro socio cambia algo.
- Frenar una racha de adivinado repartida entre muchas direcciones y muchos emails a la vez.
- Un Restore drill programado; cualquier canal de notificación al Operator.
- Una pantalla, ruta o acceso de navegación de administración, o cualquier cosa operada desde una Session iniciada.
- Un indicador de publicación por Business o una salida escalonada.
- El comportamiento propio de la barra y de la cabecera (#59), y la disposición propia de cada pantalla, incluida una acción de guardar fija sobre el teclado.
- Construir Settings → Appearance, y si la Theme choice se guarda y dónde: su propio issue.
- Una pantalla de carga oscura, y las imágenes de carga `apple-touch-startup-image` de iOS.
- Una barra de estado de iOS que siga al tema en vivo.
- Un diseño específico para horizontal; bloquear la orientación o desactivar el zoom.
- Un aspecto nuevo del ícono (un cambio de marca).
- Arreglar las pantallas de cada área para que cumplan el estándar del teléfono (#45–#49, #59, #60, #78): cada issue de área hace lo suyo.
- El estándar del teléfono en las disposiciones de computadora; una relajación del contraste a 3:1 para texto grande; una consulta por la red de si el issue de un infractor está abierto.
- Controles automáticos del espacio de 8 px, el estado `:active`, la dependencia del hover y `enterkeyhint` fuera de las líneas de New sale: solo revisión.
- Cambiar el meta del viewport fuera de #77.
- Arreglar código del producto que lee mal la fecha real (su propio ítem de bug), y arreglar tests que comparan una fecha fija con la fecha real pero no están en rojo.
- Un resguardo general, en todo el producto, contra tests que dependen de la fecha o contra evidencia faltante.
- Un par antes/después para el cambio de #107 medido sobre el árbol viejo 90320f8 (opcional, nunca exigido).
