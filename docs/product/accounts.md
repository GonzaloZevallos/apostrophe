# Accounts

Los Businesses, sus Users, y cómo las personas entran y salen:
- la única forma de entrar: una Invitation y un login;
- la forma de volver a entrar: un Password change y un Reset link emitido por el Operator;
- la única forma de salir: un comando del Operator que exporta un Business y lo elimina.

Toda otra capacidad lee una sola cosa de acá, el Business del User que pide, y sirve solo a ese Business (ADR-0004). También guarda la app como un todo:

- cómo se sirve, se instala y se tematiza, incluida la Theme choice que recuerda cada dispositivo, y cómo el shell instalado llena la pantalla del teléfono;
- el estándar del teléfono que cumple cada pantalla en anchos de teléfono, y el control que lo mantiene cierto;
- cómo se publica la instalación en internet y cómo se respalda (ADR-0016);
- las reglas de feedback que sigue cada pantalla, y los estados compartidos (`Estados`) que las dibujan;
- los grupos Business, Users, Appearance y Your account de Settings.

Dónde está cada pantalla (pestañas, barra lateral, More, Settings, el marco y la regla de vuelta, las rutas, el primer uso) es navigation.md. Home, donde abre la app, es el Panel definido en results.md. El grupo Prices es pricing-settings.md.

## Jobs

**Cuando** un amigo quiere usar la app para su propio Business, **quiero** darle un link que le abra un Business propio, **para** sumarlo sin ver ni tocar nada de lo que va a registrar.

**Cuando** vendo junto con un socio, **quiero** invitarlo a mi Business, **para que** los dos registremos ventas en los mismos libros.

**Cuando** abro la app en el teléfono, **quiero** iniciar sesión una vez y quedarme adentro, **para** registrar una Sale en segundos, mientras nadie más en la red ni nadie que adivine contraseñas entra.

**Cuando** sé mi contraseña pero ya no la quiero (se la dije a alguien, la tipeé en un dispositivo compartido o creo que se filtró), **quiero** poner una nueva yo mismo desde el teléfono en pocos toques, **para que** quien conocía la anterior quede afuera de mi Business al instante y yo siga trabajando en este dispositivo sin pedirle nada a nadie.

**Cuando** me olvidé la contraseña y no puedo entrar a mi Business, **quiero** que el Operator me dé un link que me deje elegir una contraseña nueva yo mismo, una sola vez y dentro del día, **para** volver a mis libros el mismo día, mientras nadie más (el Operator incluido) conoce ni elige mi contraseña y cada dispositivo que tenía mi sesión iniciada queda afuera.

Estos dos refinan el job de "iniciar sesión una vez y quedarme adentro". El comando del Operator es el mecanismo del job de reseteo, no un job propio.

**Cuando** abro la app en el teléfono y tengo que iniciar sesión, **quiero** estar adentro de mi Business en una sola pasada; si no me acuerdo la contraseña, **quiero** saber ahí mismo quién me da un Reset link y qué pedirle, **para** volver a registrar ventas en vez de sentirme bloqueado o volver a la planilla. (GH-521)

Este refina el job de "iniciar sesión una vez y quedarme adentro" y el de la contraseña olvidada; no es un job nuevo. Su protagonista es el vendedor que vuelve; quien no tiene cuenta es un público secundario, al que solo se le dice que se entra con una Invitation.

**Cuando** manejo mi Business desde el teléfono (entregando un pedido, contestándole a un Customer por Telegram, pagando algo o poniéndome al día al final del día), **quiero** entrar con el link que me mandaron y mantener al día desde el teléfono mis Customers, mis precios, mi Stock y mis Expenses, **para** dejar de llevarlos en la planilla y tener datos reales cuando llegan las ventas. La computadora es el mismo job en una pantalla más grande.

**Cuando** abro la app desde un link de Invitation por primera vez, vuelvo con un Reset link después de olvidarme la contraseña, inicio sesión de nuevo en el teléfono, o caigo en una pantalla vacía, cargando o fallando, **quiero** una sola pantalla clara en el teléfono que me haga entrar o me diga en palabras simples qué pasó y qué hacer, **para** volver a mis libros sin preguntarle a nadie, sin adivinar y sin enterarme de nada sobre otros Businesses o Users.

Este refina los jobs de "iniciar sesión una vez y quedarme adentro", "entrar con el link que me mandaron" y de la contraseña olvidada; no es un job nuevo. Su protagonista es el vendedor; los comandos del Operator quedan fuera de la app.

**Cuando** abro la app en el teléfono o la computadora, a cualquier hora, **quiero** verla con el look Yerba (papel verdoso y tinta verde negra con un solo verde, o su contraparte oscura) siguiendo el modo claro u oscuro de mi teléfono sin tocar nada, y poder forzar Light o Dark (en Settings → Appearance, navigation.md) y que quede en ese dispositivo, **para** trabajar con un look diseñado y revisado para leer cifras, estados y montos en ambos temas, sin que ningún estado se diga solo con color.

**Cuando** necesito cambiar cómo está configurado mi Business (renombrarlo, sumar un socio, conectar o cambiar el bot de Telegram, editar el Catalog header and footer, manejar mis Expense categories, pasar a oscuro, cambiar la contraseña o cerrar sesión), **quiero** cada configuración de todo el Business en un solo lugar, cada una en su propia pantalla corta, **para** cambiarla en pocos toques desde el teléfono y volver al Customer, sin preguntarme qué pantalla la tiene. (Lo sirven acá los grupos Business, Users, Appearance y Your account de Settings; la estructura es navigation.md.)

**Cuando** abro la app instalada en el teléfono entre pedidos o en medio de un chat con un Customer, **quiero** que llene la pantalla y responda como una app de teléfono (nada escondido bajo el notch ni la barra de inicio, una barra de estado del color de la app, sin rebote de página ni pull-to-refresh, sin destello azul ni selección de texto suelta al tocar, y el campo en el que escribo nunca tapado por el teclado), **para** tocar, escribir y leer cifras rápido y volver al Customer, sin que la app se sienta como una página web dentro de un marco.

Este refina el job de "iniciar sesión una vez y quedarme adentro" y el criterio 5; no es un job nuevo. Su protagonista es el vendedor; el Operator y Capacitor no son parte de él.

**Cuando** manejo un pedido, un Payment, una Stock entry o una Expense en el teléfono, con una mano y en medio de un chat con un Customer, **quiero** que cada pantalla se comporte como una app de teléfono (la barra y el encabezado siempre a mano, controles que alcanzo con el pulgar, el teclado nunca tapando lo que escribo, nunca una pantalla en blanco mientras carga, texto que puedo leer en ambos temas), **para** terminar y volver al Customer sin hacer zoom, sin tocar mal y sin preguntarme si se colgó.

Este refina el criterio 5 y el job del shell instalado, extendiéndolos del shell a cada pantalla; no es un job nuevo. Su protagonista es el vendedor. La mitad del que construye (una regla escrita del teléfono y un control que falla cuando una pantalla la rompe) es cómo se entrega el job, no un segundo job. El Operator y Capacitor no son parte de él.

**Cuando** un amigo deja de usar la app, o pide que lo saquen, **quiero** darle en un solo archivo todo lo que la app tiene de su Business y después eliminar ese Business de la instalación por completo, **para que** conserve sus libros y los nombres, teléfonos y Balances de sus Customers ya no los tenga yo ni nadie más en la instalación.
- Un Business abierto por error se cubre con el mismo comando.
- El Business se va entero, con todos sus Users.
- El Operator lo acordó antes con cada User del Business; el comando no lo verifica.

**Cuando** un vendedor necesita la app lejos de mi red de casa, **quiero** la instalación publicada en internet por HTTPS, con los datos de cada Business copiados fuera del servidor de forma continua, cifrados y con restauración probada, **para** dejar que los vendedores trabajen desde cualquier lado sin que un servidor, un disco perdido o un backup filtrado le cueste a nadie sus libros ni exponga a sus Customers.

- El protagonista de este job es el Operator de la instalación, no un User de la app.
- Para un vendedor cambian solo dos cosas: desde dónde puede llegar a la app, y que está en HTTPS.

**Cuando** un control del backend se pone en rojo en un diff que no toca código del backend, **quiero** que el test de seguridad de la cookie dé el mismo resultado cualquier día, usando solo una hora fija que se le pasa y nunca la fecha real ni nada fuera del test, **para** confiar en que un control en rojo significa una regresión real y mergear uno en verde sin volver a correrlo.

- Este refina el job de "iniciar sesión una vez y quedarme adentro" y el criterio 14 para quienes mergean a través del Gate (los mantenedores agénticos y el PM); no es un job del vendedor.
- No cambia ningún comportamiento del producto: la regla de `Secure` y la Session de 30 días quedan como están.

**Cuando** mergeo un cambio y la suite de tests vuelve a correr otro día, **quiero** que el Gate dé el mismo veredicto cualquiera sea la fecha, y que el registro del cambio diga exactamente qué prueba su evidencia y qué no, **para** confiar en un Gate en verde, actuar ante uno en rojo sin adivinar y nunca tomar una evidencia como prueba de algo que nunca cubrió.

- El protagonista de este job es el mantenedor de la instalación, o el revisor que actúa por él. Al vendedor lo afecta solo indirectamente: un Gate que se pone en rojo porque cambió la fecha frena cada arreglo que está esperando.
- Lo sirven acá los tests de la Business removal. Cada instante en ellos viene del reloj movible (ADR-0001), así que su veredicto nunca depende del día en que corren. No cambia ningún comportamiento de la app.

El job de navegación (navigation.md) decide desde dónde se llega a Business, Users, Appearance y Your account: Settings.

Criterios de éxito:

1. Nada de un Business se alcanza desde otro, por ninguna ruta: por id no existe (404), en una lista no está.
2. Nadie entra sin una Invitation; cada Invitation deja entrar a una persona, una vez, dentro de siete días.
3. Las contraseñas equivocadas repetidas dejan de funcionar por un rato, y nada en las respuestas dice qué emails tienen un User.
4. Ningún `curl` en ningún momento. Desde el teléfono solo, un vendedor puede hacer todo lo que hace el backend, empezando por abrir o sumarse a un Business desde el link de Invitation.
5. Se siente como una app de teléfono.
   - Está en la pantalla de inicio con su propio nombre e ícono. En iOS se instala por la red de casa. En Android ahí es un acceso directo en la pantalla de inicio, y una instalación completa en la instalación publicada con TLS.
   - Sigue el modo claro u oscuro del teléfono por defecto; un Light o Dark elegido en ese dispositivo gana sobre el teléfono.
   - Dice "No connection" cuando se cae la red.
   - Ningún estado dicho solo con color: un signo, flecha o palabra en cada ganancia, pérdida, deuda o estado; las series de los gráficos rotuladas directamente.
   - Instalada, llena la pantalla y responde como una app de teléfono (criterios 33–36).
   - Cada pantalla en anchos de teléfono (por debajo del corte de 900 px de la computadora) cumple el estándar del teléfono, escrito en CODING_STANDARDS §10 "Phone" y en el "En el celular" del README de diseño, y controlado por `web/e2e/mobile.spec.ts` (criterios 37–41).
6. Los Businesses siguen invisibles entre sí también en el navegador.
   - Ningún Business en una URL.
   - Ningún dato personal ni dinero en la consola ni en el almacenamiento del navegador. Lo único que guarda el navegador es la Theme choice del dispositivo.
   - La Session vive solo en la cookie del backend.
   - Servir el front no alcanza nada fuera de la app construida.
7. Nada inventado: ninguna cifra de relleno, y ninguna entrada de navegación para algo que todavía no existe.
14. **Nada se debilita en internet.**
   - Un vendedor inicia sesión y trabaja desde cualquier red con las mismas garantías que en la red de casa: ADR-0002, ADR-0004 y ADR-0005.
   - Por HTTPS la cookie de Session es `Secure`. Se fija en la configuración, nunca se adivina a partir del pedido.
   - El http plano en la red de casa sigue funcionando sin cambios.
15. **El adivinado se frena por email y por dirección.**
   - Una dirección que prueba muchos emails queda bloqueada.
   - Un email probado desde muchas direcciones queda bloqueado.
   - Ambos bloqueos responden igual, con los mismos tiempos.
   - Ninguna dirección de cliente va a un log.
16. **Perder el servidor se recupera.**
    - En el peor caso se pierde menos de 1 minuto de trabajo reciente (Sales, Payments, Stock entries), gracias al log de escrituras de 24 horas de Turso.
    - Más allá de esas 24 horas, la copia diaria cifrada es el respaldo, y su pérdida máxima es un día.
    - Un Restore drill restaura el backup en un destino de prueba y lo prueba íntegro (integridad, conteos de filas, recencia), sin efecto en la app en marcha.
17. **Reconstruible desde el repositorio.**
    - `deploy/README.md` documenta cada paso para levantar la instalación desde cero.
    - Ningún secreto está en el repositorio.

Criterios de éxito, el tema:

23. **Automático salvo que se elija en el dispositivo**: un dispositivo sin elección guardada sigue el modo claro u oscuro del teléfono en cada pantalla, en vivo, y se vuelve a revisar cuando el vendedor vuelve a la app. La decisión del dueño del 2026-10-29 reemplaza a ADR-0026 en este punto (el ADR no se edita). Un dispositivo que no puede informar su modo se lee claro. Se acepta un cuadro claro en un teléfono oscuro sin nada guardado antes de que se aplique el tema.
24. **Light o Dark a pedido, y queda**: el tema oscuro (`InicioOscuro`) se muestra cuando `data-tema="oscuro"` está puesto en `<html>`, que es el tema resuelto, no la elección. La elección se hace solo en Settings → Appearance (Theme: Automatic, Light, Dark; navigation.md) y se guarda en el dispositivo como `tema` = `claro` u `oscuro`. Automatic es no tener clave guardada; cualquier otro valor o un error de almacenamiento también se lee como Automatic. Una elección guardada gana sobre el teléfono, sobrevive a cerrar la app, a recargar y a cerrar sesión, y se muestra en cada pantalla de ese dispositivo, la pantalla de Sign in, la de Invitation y la de reseteo incluidas. Un Dark viejo sigue abriendo oscuro; un Light viejo (nada guardado) ahora sigue al teléfono. Otra pestaña o ventana toma un cambio la próxima vez que carga.
25. **Los temas conservan la paleta Yerba**: ambos temas llevan los mismos tokens con sus propios valores (DESIGN_STANDARDS.md "Palette"); lo que elige el tema es la regla de arriba. Toda regla sobre estados (ningún estado dicho solo con color: un signo, flecha o palabra en cada ganancia, pérdida, deuda o estado; las series de los gráficos rotuladas directamente) vale en ambos.
26. **Una regla, escrita igual en todos lados**: el comentario al principio de `web/src/styles/tokens.css`, `docs/product/design-system/tokens.css`, el README del design system y este archivo dicen la misma regla.

Criterios de éxito, cambiar y resetear una contraseña:

18. **Change, rápido y definitivo.**
    - Desde Settings → Your account en el teléfono, un User con la contraseña actual correcta pone una nueva (de al menos 10 caracteres) en menos de un minuto.
    - Toda otra Session de ese User se cierra al instante.
    - El dispositivo que la cambió sigue con la sesión iniciada.
    - Las Sessions de los socios no se tocan.
19. **Reseteo, un comando, un link.**
    - El Operator obtiene un link que funciona con un solo comando, sin editar la base de datos.
    - El vendedor lo abre dentro de 24 horas, pone una contraseña nueva y cae en Home con la sesión iniciada, con cada Session anterior suya cerrada.
    - El link funciona una sola vez.
    - Los links desconocidos, usados, vencidos y retirados responden todos el mismo 404, como las Invitations.
20. **Nadie más la conoce.**
    - El Operator nunca ve ni elige la contraseña nueva.
    - Ninguna contraseña, token ni link aparece en un log, una respuesta, la consola ni el almacenamiento del navegador.
    - Solo se guardan un hash scrypt y un digest del token (ADR-0002, ADR-0005).
21. **El freno no es una puerta lateral.**
    - Una contraseña actual incorrecta cuenta como un login rechazado para los dos Login brakes.
    - Mientras cualquiera de los bloqueos está activo, Change se rechaza con el mismo mensaje del freno.
    - Nada en ninguno de los dos flujos dice si un email tiene un User. La terminal del Operator es la excepción, porque el Operator no es un User.
22. **Ningún curl.** Los dos flujos corren enteros desde el teléfono. El comando del Operator es la única excepción, y queda fuera de la app como `invite-business.sh`.

Criterios de éxito, las pantallas de entrada y los estados compartidos rediseñados (GH-49):

27. **Entrar es rápido.** Desde el teléfono, un vendedor abre un link de Invitation, o un Reset link, y cae en Home con la sesión iniciada en menos de un minuto, e inicia sesión desde la pantalla de Sign in en pocos segundos. No aparece ningún paso que el diseño no dibuje.
28. **Cada estado se dice con palabra y forma, nunca solo con color**: el mensaje del freno, "This invitation no longer works", "This link no longer works. Ask whoever sent it for a new one.", "No connection", vacío, cargando, el reintento genérico de error del servidor y "That is gone.". Todos los textos siguen el Product language (inglés, desde el Copy module); el español es solo el Documentation language. (Corregido en GH-521: decía "Rioplatense Spanish with vos", un resto de antes de la decisión del Product language.)
29. **Teléfono y computadora coinciden con el diseño.** La pantalla de Sign in (`Entrar`), la de Business nuevo (`NegocioNuevo`), la de Invitation (`Invitacion`), la de reseteo y los estados compartidos (`Estados`) coinciden con `docs/product/design-system/pantallas/` en ambos, revisado a ojo; `scripts/design/compare.sh` corre antes y después.
30. **El look no revela nada nuevo.**
    - Ninguna pantalla ni estado dice si un email tiene un User, qué freno saltó ni cuántos intentos quedan.
    - Un link muerto nunca dice por qué.
    - "That is gone." no lleva id, nombre ni fecha.
    - Ningún dato personal ni dinero llega a la consola ni al almacenamiento del navegador.
31. **Ambos temas.** Estas pantallas siguen la regla del tema (criterios 23–25), sin cambiar ningún token.
32. **Ningún comportamiento retrocede.** Cada test de accounts, navegación y feedback pasa sin cambios.

Criterios de éxito, Sign in con el nuevo estilo y "Forgot your password?" (GH-521):

42. **Una sola pasada.** Un vendedor que vuelve inicia sesión desde el teléfono en una pasada: email, contraseña, un toque. No hay que hacer scroll ni buscar nada, y el teclado ya está abierto.
43. **A un toque de saber qué hacer.** Quien se olvidó la contraseña llega a la explicación con un toque y la cierra sabiendo el próximo paso: pedir un Reset link de un solo uso, diciendo con qué email inicia sesión.
44. **No revela nada.** Nada en la pantalla ni en la Sheet revela si existe un email, un User o un Business. La Sheet es igual para todos y no depende de lo que se tipeó.
45. **Coincide con el dibujo 25-ingreso** (`Entrar` y `EntrarOscuro`) en la Design capture, claro y oscuro, según el Drawing as guide: no falta ni cambia ningún control, rótulo o ícono que el dibujo muestra. Las líneas en español del dibujo se construyen como su equivalente en inglés (Product language), y eso no cuenta como diferencia.

Criterios de éxito, el shell instalado:

33. **Nada bajo las áreas del sistema.**
    - En un teléfono instalado con notch y barra de inicio, en vertical, el contenido de cada pantalla se ve entero y se puede tocar: la barra de pestañas, el encabezado, "+ New sale", las Sheets y los toasts incluidos.
    - La altura de una pantalla sigue a la pantalla visible, así que nada salta ni se corta cuando aparecen o se van las barras propias del navegador.
    - Con el teclado abierto, el campo con foco queda a la vista.
34. **La barra de estado es del color de la app.**
    - En Android coincide con el papel del tema vigente: `--papel` claro sin `data-tema`, el token de papel propio del tema oscuro con `data-tema="oscuro"`. Cambia en cuanto cambia el atributo.
    - En Automatic sigue el modo del teléfono en vivo, porque el atributo lo sigue. No hay franja azul en ningún tema.
    - El splash y los colores del manifest son `--papel` claro.
    - En iOS la barra de estado queda clara en ambos temas, porque iOS fija su estilo al arrancar. Es una limitación aceptada, no un defecto.
35. **Los toques se sienten como en una app de teléfono.**
    - Cada botón, fila y elemento de la barra muestra un estado presionado al instante.
    - Sin resaltado de toque de Android; tocar nunca selecciona texto en botones, pestañas ni la barra.
    - Sin rebote de overscroll ni pull-to-refresh en la página entera.
    - El texto dentro de listas y campos sigue seleccionable donde lo es hoy.
    - El manifest pasa el control de instalabilidad del navegador.
36. **Nada retrocede.**
    - Cada test de accounts, navegación y feedback pasa sin cambios.
    - La barra sigue entrando en 320 px con texto al 130%.
    - Ningún estado se dice solo con color, en ningún tema; el estado presionado usa solo tokens, en ambos temas.
    - No cambia ningún valor de token existente; solo se agregan los cuatro tokens nuevos de insets.

Criterios de éxito, el estándar del teléfono:

37. **Escrito una vez, leído desde los dos lados.**
    - CODING_STANDARDS §10 "Phone" y el "En el celular" del README de diseño dicen los mismos ocho requisitos: marco, toque, entradas, formularios y Sheets, disposición, gestos, carga y legibilidad.
    - Cada requisito lleva la misma etiqueta "checked" o "review" en ambos.
    - Ninguno contradice al otro, a las reglas del shell instalado de este archivo, a ADR-0027, ADR-0028 ni ADR-0029.
    - Donde uno de esos ya decide un punto, el estándar lo cita y no lo repite.
38. **Controlado, no confiado.** `web/e2e/mobile.spec.ts` cubre cada ruta de `scripts/design/screens.json`, cada formulario y Sheet, y los estados compartidos de `Estados`.
    - Corre en 320×568, 375×812, 430×932 y 246×437 (130 %), en ambos temas.
    - Falla ante cada defecto controlado.
39. **La lista de infractores conocidos solo puede achicarse.**
    - Cada falla esperada nombra el issue que la saca.
    - Un infractor nuevo hace fallar la corrida, y también uno arreglado que quedó en la lista.
    - Crece solo por un canje, o por las celdas reales de una fila nueva en el registro de pantallas (las condiciones están en `docs/product/gate.md`).
40. **Cada PR de área lo muestra.** El PR de cada issue de área (#45–#49, #59, #60, #78) y `scripts/design/compare.sh` adjuntan el resultado del control. Un issue de área no está terminado mientras sus propias pantallas sigan en la lista de infractores.
41. **Nada retrocede para el vendedor.**
    - Una Sale, un Payment, una Stock entry y una Expense se siguen registrando cada uno desde el teléfono en menos de 60 s.
    - Las suites existentes de accounts, navegación, ventas y feedback pasan sin editar.

Criterios de éxito, eliminar un Business:

8. **El archivo es sus libros y se sostiene solo**:
   - un archivo JSON guarda cada dato registrado del Business y se abre sin la app;
   - identifica al Business por su nombre;
   - nombra aquello a lo que se refiere cada registro además de su id;
   - no guarda ningún hash de contraseña, secreto guardado, Invitation ni Reset link.
9. **Nombrado antes de perder nada**: la corrida de prueba nombra al Business y cuenta por tipo lo que se iría, sin escribir nada. La corrida real pide el nombre del Business tipeado exacto antes de tocar nada.
10. **Nada se borra hasta que el export está a salvo**: el borrado corre solo después de que el archivo se escribió y se releyó en la misma corrida, y los conteos exportados son iguales a los borrados. Cualquier falla o diferencia no borra nada.
11. **Nada sobrevive**:
    - no queda ninguna fila con el id del Business en ninguna tabla, incluidas las tablas agregadas después;
    - sus Invitations y los Reset links de sus Users, de cualquier estado, también se van, y lo mismo el historial de intentos de login de sus Users;
    - el export se arma a partir de las mismas tablas que el borrado; las Invitations y los Reset links se borran, nunca se exportan.
12. **Todo otro Business queda intacto**: sus conteos de registros son los mismos antes y después, y siguen funcionando, nunca se los frena a propósito y nunca se les avisa nada.
13. **Ningún dato personal fuera del archivo, y borrón y cuenta nueva**: la terminal y los logs muestran solo el nombre del Business, la ruta del archivo y conteos. Después, el mismo email puede abrir un Business nuevo sin nada arrastrado.
37. **Los tests de la Business removal dan el mismo veredicto cualquier día.**
    - Cada instante en `tests/business_removal/`, las Invitations incluidas, viene del reloj movible (ADR-0001). Ningún test ahí lee el reloj real.
    - La suite da el mismo resultado cuando el reloj se mueve a distintos días de Argentina, cruzando un límite de mes y uno de año incluidos.

Criterios de éxito, el test de seguridad de la cookie (seguimiento de GH-130):

37. **Mismo resultado cualquier día.** El test de seguridad de la cookie usa solo una hora fija que se le pasa por el reloj inyectado (ADR-0001) y da el mismo resultado cualquiera sea la fecha real, anterior o posterior, sin editar su hora fija. Nada en él lee el reloj real.
38. **La regla sigue probada.** Sigue afirmando que `Secure` está presente cuando HTTPS está configurado, ausente si no, y nunca se infiere del esquema ni de los encabezados del pedido (criterio 14). No se saca ni se afloja ninguna afirmación.
39. **No cambia ningún comportamiento del producto.** La Session sigue durando 30 días, como una cookie y un token. Código del producto que lea mal la fecha real es un ítem de bug aparte.
40. **El Gate significa algo.** El control completo de tests del backend está en verde.

## Comportamiento

### Invitations y login

- **Invitation de Business nuevo**: la imprime `scripts/invite-business.sh`. Aceptarla toma un nombre de Business, un email y una contraseña, y abre el Business con ese User adentro.
- **Invitation para sumarse**: cualquier User crea una desde la app (`POST /invitations`). Aceptarla toma un email y una contraseña y suma al User al Business que invita; un nombre de Business mandado junto se ignora.
- **Aceptar cualquiera de las dos** inicia la sesión de la persona, como un login. Aceptar una Invitation de Business nuevo cae en el Onboarding de ese Business (onboarding.md); aceptar una para sumarse cae en Home de ese Business.
- **Consultar una Invitation** dice su tipo, el Business al que lleva (solo para sumarse) y cuándo vence. Una Invitation desconocida, usada o vencida no se encuentra.
- **Email**: sin espacios al borde y en minúsculas; un User por email en toda la instalación.
- **Contraseña**: al menos 10 caracteres; se guarda solo como hash.
- **Login**: email y contraseña responden una Session que dura 30 días, como una cookie y un token. Una contraseña equivocada y un email desconocido reciben la misma respuesta.
- **Cookie de Session**:
  - Es `Secure` solo cuando HTTPS está configurado para el deploy, y nunca se infiere del esquema ni de los encabezados del pedido.
  - En el http plano de la red de casa no es `Secure`, como antes.
- **Login brakes**: dos, en `/auth/login` y en un Password change. Las rutas de Invitation y de reseteo no tienen ninguno.
  - **Por email**: cinco fallos seguidos de un email lo bloquean por 15 minutos, incluso con la contraseña correcta. Un login, un Password change o un reseteo exitosos reinician el conteo de ese email.
  - **Por dirección**: 20 logins fallidos desde una dirección de cliente dentro de 15 minutos bloquean los logins de esa dirección por 15 minutos. Un éxito nunca reinicia este conteo.
  - **Conteo cruzado**: cada intento rechazado cuenta para el email y para la dirección, sea cual sea el bloqueo ya activo. Eso incluye la contraseña correcta rechazada bajo un bloqueo, y una contraseña actual incorrecta en un Password change.
  - **Misma respuesta**:
    - Ambos bloqueos responden 429 con los mismos tiempos, y la pantalla muestra el mismo mensaje del freno.
    - Nada revela un conteo, la dirección ni qué freno saltó.
  - **Origen de la dirección**:
    - Por defecto es la dirección de la conexión.
    - Se toma del encabezado de dirección reenviada solo cuando el pedido viene del proxy de confianza (el de Render, ADR-0016).
    - El proxy de confianza se fija en la configuración, nunca se adivina.
    - La misma regla vale en la red de casa y en la instalación publicada.
  - **Logs**: no se registra ninguna dirección de cliente, email ni token.
  - **Direcciones compartidas**: personas que comparten una dirección pueden hacer saltar juntas el bloqueo por dirección. Se acepta, con 20 fallos en 15 minutos.
- `GET /auth/me` responde el email del User y el nombre de su Business.
- Cerrar sesión borra la cookie y va al login. No borra la Theme choice del dispositivo.

### Cambiar una contraseña

- **Una ruta protegida.** El User sale de la Session. Toma la contraseña actual y una nueva.
- **Contraseña nueva**: al menos 10 caracteres, la única regla. Una contraseña nueva igual a la actual se acepta, y cuenta igual como cambio.
- **Si sale bien**:
  - el hash de la contraseña cambia, así que toda otra Session del User se cierra sola (ADR-0002);
  - el dispositivo que actúa recibe una cookie y un token de Session nuevos en la misma respuesta y sigue con la sesión iniciada;
  - las Sessions de los socios no se tocan;
  - todo Reset link sin usar del User se retira;
  - el conteo del freno del email se reinicia y su bloqueo se levanta. El conteo de la dirección nunca se toca.
- **Una contraseña actual incorrecta** se rechaza y cuenta como login rechazado para los dos frenos.
- **Bajo cualquiera de los bloqueos**: Change se rechaza con el 429 del login, los mismos tiempos y el mismo mensaje del freno, incluso con la contraseña actual correcta.

### Resetear una contraseña olvidada

- **El comando**: `scripts/reset-password.sh <email>`, que corre el Operator, como `scripts/invite-business.sh`. Sin editar la base de datos a mano.
  - El email se recorta y se pasa a minúsculas, como en el login.
  - **Un email que no coincide con ningún User**: imprime un simple "no user for that email", no escribe nada y no retira nada.
  - **Si no**: crea un Reset link para ese User y retira el anterior sin usar. Imprime el link solo en la terminal, nunca en un log.
  - No dice nada de links anteriores, y no registra nada personal.
  - El Operator nunca ve ni elige la contraseña nueva.
- **Reset link**:
  - funciona una sola vez y vence 24 horas después de emitido;
  - solo se guarda un digest de su token.
- **Un solo link vivo por User**:
  - un link nuevo retira cualquier anterior sin usar;
  - cualquier cambio de contraseña, por Change o por un reseteo, retira todo link sin usar del User;
  - un link retirado responde exactamente como uno desconocido, usado o vencido: 404.
- **Abrir el link** (consultarlo) no lo gasta. Solo un envío exitoso lo usa. El vencimiento y el retiro valen igual mientras solo se lo mira.
- **Enviar** toma solo la contraseña nueva.
  - La regla es al menos 10 caracteres, y se acepta una contraseña usada antes.
  - Si sale bien, pasa todo esto:
    - se pone la contraseña;
    - el link queda usado;
    - se retiran los otros links sin usar del User;
    - se cierra cada Session del User;
    - este dispositivo inicia sesión y cae en Home;
    - el conteo del freno del email se reinicia y su bloqueo se levanta, nunca el de la dirección.
  - Un link que quedó viejo entre abrirlo y enviarlo responde 404.
- **Sin freno en las rutas de reseteo**: son abiertas y sin freno, como las rutas de Invitation. Un email bloqueado es justamente para quien es el link.
- **Cómo se entera el vendedor** de que existe el reseteo: desde "Forgot your password?" en Sign in (ver "Entrar" en La app). La app solo lo explica; pedirlo y emitirlo pasan fuera de la app.

### Business

- **Leer el Business** responde su nombre y sus Users. Los Users se muestran solo por email, ordenados por email.
- **Renombrar el Business**:
  - El nombre se recorta, los espacios internos se colapsan, tiene hasta 60 caracteres y no puede estar en blanco.
  - No hay control de unicidad en la instalación, porque un rechazo revelaría otro Business.
- Ambas rutas toman el Business solo de la Session. Están en `tests/test_gated_routes.py` y en el barrido de aislamiento.
- **Pricing settings**: cada Business también guarda sus dos interruptores de precios, definidos en pricing-settings.md.

### Eliminar un Business (comando del Operator)

- **El comando**: un comando del servidor que corre el Operator, como `scripts/invite-business.sh`. Sin administrador y sin entrada para él en la app (ADR-0002).
  - Nombra al Business por el email de cualquiera de sus Users, recortado y en minúsculas como en el login.
  - Un email que no coincide con ningún User imprime un simple "no business for that email" y no hace nada, en ninguno de los dos modos.
- **Corrida de prueba**:
  - nombra al Business encontrado;
  - imprime conteos por tipo: users, customers, products, price entries, stock entries, sales, sale lines, payments, expenses, expense categories, catalog settings, e invitations y reset links (solo borrados);
  - no escribe ningún archivo, no cambia ninguna fila, nunca pide confirmación.
- **Corrida real**:
  1. Nombra al Business y le pide al Operator que tipee su nombre exacto; no se puede saltear. Un nombre equivocado, una cancelación o ninguna respuesta no escriben ni borran nada.
  2. Escribe el archivo de export y después lo relee.
  3. En una sola transacción, borra cada fila del Business en cada tabla descubierta a partir del esquema (no una lista mantenida a mano). Eso incluye:
     - el Business y sus Users;
     - cada Invitation y cada Reset link de sus Users, sea cual sea su estado;
     - el historial de intentos de login de los emails de los Users eliminados.
  4. Hace commit e informa éxito solo si los conteos exportados son iguales a los borrados para cada tipo exportado.
  5. Informa el nombre del Business, la ruta del archivo y los conteos exportados y borrados.
- **Cualquier falla antes del commit** no borra nada: escribir o releer el archivo, una diferencia de conteos, o una base de datos ocupada con escrituras de otros Businesses. El Operator la vuelve a correr.
  - También elimina el archivo de export que creó la corrida, se haya escrito entero o en parte, así que no queda ningún archivo (ADR-0015). Esto incluye una escritura que falla después de que el archivo ya se creó en disco, y una corrida interrumpida.
  - Un registro creado por los propios Users del Business que se va entre el export y el borrado hace que los conteos difieran, y el borrado se bloquea en vez de perderlo.
- **Resultado del commit desconocido**: el commit mismo falla de una forma que deja sin saber si se aplicó (por ejemplo, se cae la conexión con la base durante el commit).
  - El commit es una transacción: o no queda ninguna fila del Business o siguen estando todas. No hay eliminación parcial.
  - El comando conserva el archivo de export, porque puede ser la única copia que queda de los libros del Business. Nunca dice "nothing deleted" y nunca informa éxito. Termina con un estado de falla.
  - Imprime: "Commit outcome unknown; export kept at <path>. Run with --dry-run and the same email before anything else." Junto con eso: el nombre del Business y los conteos exportados, nunca conteos borrados.
  - **Verificar y volver a correr**: se permite volver a correr, sin bloqueo ni marca guardada. La corrida de prueba con el mismo email dice para qué lado fue:
    - "no business for that email": la eliminación se hizo. El archivo conservado es el export para entregar.
    - Se nombra el Business con sus conteos: no se borró nada. Una corrida real es entonces una corrida común.
      - Escribe un archivo nuevo con un nombre nuevo, sin pisar nunca el conservado. Solo se entrega el archivo más nuevo.
      - El Operator borra a mano el archivo conservado y desactualizado, porque tiene datos personales. El comando nunca toca un archivo que no creó en la misma corrida.
- **Los otros Businesses** siguen usando la app durante la corrida, nunca se los frena a propósito y nunca se les avisa nada.
- **El archivo de export**:
  - un archivo JSON por corrida real, con permisos solo para el dueño, escrito en el sistema de archivos del servidor y nunca donde la app sirve;
  - su nombre lleva el nombre del Business (como slug) y la fecha y hora de la corrida; nunca se pisa un archivo existente;
  - valores simples: fechas ISO 8601, pesos enteros, gramos como decimales de hasta dos lugares;
  - cada registro nombra aquello a lo que se refiere (customer, product, category) además de su id;
  - guarda cada dato registrado tal como está:
    - el nombre del Business y sus Pricing settings (Bulk price y VIP customers);
    - users (email y fecha en que se sumaron);
    - customers (nombre, Phone number, VIP);
    - products con su Low-stock threshold y sus Catalog attributes;
    - price entries, con su VIP price;
    - stock entries (fecha, product, gramos, origen, costo total, nota; un Lot es su Stock entry, no un registro aparte);
    - sales (fecha, customer, Shipping charged, Note, cómo se pagó);
    - sale lines (product, gramos, precio por gramo guardado, Pricing rule, total de la línea);
    - payments (fecha, monto, método, customer, y su Sale en el caso de un On-the-spot payment);
    - expense categories y expenses;
    - el Catalog header and footer;
  - deja afuera:
    - cifras calculadas (Balances, Owing since, Settlement, Stock, costo por gramo, Cost of goods sold);
    - hashes de contraseñas;
    - cualquier secreto guardado, como un token de bot de Telegram;
    - Invitations y Reset links;
    - el historial de intentos de login.
- **Después de la eliminación**:
  - una Session que dejó abierta un User eliminado recibe 401 y va al login;
  - una Invitation nueva al mismo email abre un Business nuevo como cualquier otro, con un conteo de intentos de login limpio y nada del Business anterior.
- **Privacidad** (ADR-0005): no se imprime ni se registra nada personal (ni emails, nombres, Phone numbers, montos ni contenido del archivo). El nombre del Business no es un dato personal y se puede imprimir.
- **Sus tests y el reloj** (criterio 37): cada instante que usan los tests de la eliminación, incluida la hora de emisión de una Invitation, viene del reloj movible (ADR-0001), nunca del real. Las corridas comunes fijan un día de Argentina, y un control mueve el reloj cruzando un límite de mes y uno de año.

### La app

- **Servir**: el backend sirve el front construido desde `web/dist` en el origen y el puerto de la API.
  - Las rutas del front nunca chocan con las de la API.
  - Nada fuera de `web/dist` se alcanza.
  - Las rutas del front son archivos estáticos públicos, fuera de la lista de rutas de la API. Sus paths están en inglés, con redirecciones desde los viejos en español (navigation.md).
- **Instalable, sin modo offline**:
  - un manifest con nombre, colores e íconos para Android e iOS (sus campos están en "El shell instalado" abajo);
  - un service worker que no cachea nada.
- **Instalar en la red de casa**, servida por http plano (ADR-0002):
  - iOS se instala con "Add to Home Screen", sin instructivo;
  - Android recibe un acceso directo en la pantalla de inicio, porque los navegadores permiten un service worker y el aviso de instalación solo en un origen seguro;
  - la app no muestra ningún banner ni explicación de la diferencia.
- **Instalar en la instalación publicada**, sobre el TLS de Render: se ofrece el aviso de instalación propio de Android cuando el navegador lo habilita. El manifest y el service worker que ya están no necesitan más trabajo para eso.
- **Sin red**: cuando un pedido falla porque se cayó la red, la app abierta muestra "No connection" en cualquier origen. No depende del service worker.
- **Tema**: la app es Automatic por defecto: sin nada guardado sigue el modo claro u oscuro del teléfono en vivo, y lo vuelve a revisar cuando la persona vuelve a la app. Un Light o Dark guardado en ese dispositivo gana sobre el teléfono. El único lugar donde se elige es Settings → Appearance, Theme: Automatic, Light o Dark (navigation.md).
  - La regla es una: el atributo en `<html>` lleva el tema resuelto. Sin atributo es claro, `data-tema="oscuro"` es oscuro. No hay excepción por pantalla, ruta ni Session. El valor guardado es `claro` u `oscuro`; sin clave, cualquier otro valor o un error de almacenamiento es Automatic.
  - **La Theme choice se recuerda por dispositivo**:
    - tocar Automatic, Light o Dark la aplica y la recuerda al instante, sin guardar, sin toast y sin aviso de cambios sin guardar;
    - el dispositivo guarda solo la elección: nada personal, nada de dinero, ninguna Session y nada sobre un Business;
    - es del dispositivo, no del User ni del Business; el dispositivo de un socio y los otros dispositivos del User no se ven afectados;
    - cerrar sesión no la borra;
    - un Dark guardado se muestra en cada pantalla de ese dispositivo, la pantalla de Sign in, la de Invitation y la de reseteo incluidas; un dispositivo sin nada guardado sigue al teléfono;
    - las pantallas anteriores al login no tienen control de tema.
  - Los controles nativos y las barras de scroll siguen el tema resuelto: claros sin atributo y oscuros con `data-tema="oscuro"`.
  - Ambos temas llevan los tokens Yerba, y toda regla de estados vale en ambos.
  - Los colores del manifest y el splash son estáticos y claros. La barra de estado sigue el tema resuelto que muestra la app (`data-tema`, que en Automatic ya sigue al teléfono), no directamente el modo del sistema; en iOS queda clara, porque iOS fija su estilo al arrancar.
  - La fuente está alojada en la propia app.
- **Idioma y formatos**: cada palabra en pantalla en inglés (product-language.md, que reemplaza la regla anterior en español). Dinero `$ 11.000`, un monto negativo `−$ 4.500`, gramos `3,5 g`, fechas `dd/mm`. El texto del Catalog conserva su propio formato de Telegram (`$11.000`, catalog.md).
- **Entrar** (`Go to sign in`, la pantalla de Business nuevo (`NegocioNuevo`), la de Invitation (`Invitacion`), la de reseteo):
  - **Dibujadas a partir del diseño** en `docs/product/design-system/pantallas/` (GH-49; Sign in rediseñada en GH-521 sobre 25-ingreso). Las líneas en español de los dibujos son una guía de significado; la app las construye como su equivalente en inglés (Product language), desde el Copy module.
  - **Una sola disposición centrada, de ancho de teléfono**, en todo viewport, el de la computadora incluido; no hay disposición solo para computadora para estas pantallas, ni pulido dedicado para la computadora.
  - **La pantalla de Sign in** (`Entrar`, claro; `EntrarOscuro`, oscuro), de arriba hacia abajo:
    - la Yerba mark con el Wordmark (brand.md);
    - el equivalente en inglés de "Hola de nuevo. Tu negocio, anotado.";
    - los campos "Email address" y "Password" y el botón "Sign in"; al abrir, el foco está en "Email address", así que en el teléfono el teclado ya está abierto, y todo se ve sin hacer scroll;
    - un aviso fijo bajo el botón de que cinco intentos fallidos bloquean el email por 15 minutos, sin ningún conteo de intentos restantes;
    - "Forgot your password?", siempre visible, también después de que el Login brake bloqueó el email; abre la Forgot sheet;
    - bajo el formulario, una línea de texto plano que dice que se entra con una Invitation de tu Business. No es un link, no hace nada y no es un camino para registrarse.
    - Una contraseña equivocada y un email desconocido muestran el mismo rechazo; los rechazos se muestran en el lugar y conservan lo tipeado.
  - **La Forgot sheet**, que abre "Forgot your password?":
    - es una Sheet: a pantalla completa en el teléfono, con "Close" (o el gesto de volver) como única salida; en la computadora conserva su propio marco;
    - es texto fijo, igual para todos: sin campos, sin botón de envío, sin datos de contacto y sin mensaje armado para copiar o compartir;
    - no lee, no muestra y no envía nada de lo tipeado en Sign in; al cerrarla se vuelve a Sign in con lo tipeado intacto, y abrirla o cerrarla no hace ningún pedido;
    - dice que el Reset link lo da la persona que maneja la app para tu Business (la que te mandó la Invitation), y no llega por email;
    - dice que le pidas a esa persona un Reset link y le digas con qué email iniciás sesión;
    - dice que el link funciona una sola vez, por 24 horas, y te deja elegir una contraseña nueva sin la actual;
    - no usa la palabra "operator" ni nombra ningún canal (WhatsApp, Telegram, un número de teléfono), y no guarda ningún contacto: así sirve a cualquier instalación (Assume nothing);
    - no dice que un reseteo levanta el bloqueo: un reseteo reinicia solo el conteo del email, nunca el de la dirección, así que esa línea engañaría a quien acaba de quedar bloqueado.
  - Cualquiera de los bloqueos muestra el mensaje del freno, sin cambios y sin mención de "Forgot your password?". Ningún texto nombra el freno por dirección, y ambos bloqueos se ven y se leen igual.
  - Un pedido respondido con 401 va al login.
  - Una Invitation desconocida, usada o vencida muestra "This invitation no longer works".
  - Abrir `/invitation/{token}` o `/reset/{token}` con la sesión iniciada cierra la sesión primero, por el backend, y después muestra la pantalla de Invitation o de reseteo como si no hubiera sesión. Eso incluye el link para sumarse al propio Business del User, y un Reset link del mismo User.
  - **La pantalla de reseteo** (`/reset/{token}`) reusa la disposición de la pantalla de Invitation (`Invitacion`); no tiene archivo de diseño propio y está registrada en `scripts/design/screens.json` como pantalla de teléfono sin sesión:
    - "Choose your new password", un campo "New password" (oculto por defecto, con un botón para mostrarlo) y el botón "Save and sign in";
    - una contraseña de menos de 10 caracteres muestra el mismo rechazo que al aceptar una Invitation y conserva lo tipeado;
    - si sale bien va a Home, sin toast.
  - **Un Reset link muerto**: un link desconocido, usado, vencido o retirado muestra "This link no longer works. Ask whoever sent it for a new one."
    - Se muestra tanto al abrir el link como cuando un envío responde 404.
    - No conserva nada de lo tipeado y nunca dice por qué el link está muerto.
    - Su único botón va a la pantalla de Sign in.
- **Dónde están las pantallas**: la barra, la barra lateral, More, Settings, el marco y la regla de vuelta y el primer uso son navigation.md. Home es el Panel (results.md).

### El shell instalado

Cómo la app llena la pantalla de un teléfono y responde al toque una vez instalada (criterios 33–36). No cambia la disposición propia de ninguna pantalla ni el comportamiento de la barra o el encabezado (#59), y no construye ninguna Theme choice: la barra de estado sigue a lo que ponga `data-tema`.

- **Documento y viewport**:
  - el viewport dice `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`;
  - no hay `maximum-scale` ni `user-scalable=no`: el zoom con dos dedos sigue permitido;
  - `mobile-web-app-capable` está puesto; `apple-mobile-web-app-status-bar-style` es `default`;
  - en iOS se maneja el inset de arriba, así que el contenido nunca queda bajo el notch;
  - `-webkit-text-size-adjust: 100%`.
- **Barra de estado**:
  - exactamente un meta `theme-color`, sin atributo `media`, con `--papel` claro en el HTML estático;
  - un solo lugar pone o saca `data-tema` y actualiza `theme-color` con él, también al arrancar la app, a partir del token de papel del tema, nunca de un valor copiado;
  - no hay un par de metas con `prefers-color-scheme`: el modo del sistema llega a la página solo a través del módulo de tema;
  - solo Android lo sigue en vivo; iOS mantiene la franja `default` clara en ambos temas.
- **Insets**: cuatro tokens, `--inset-arriba`, `--inset-abajo`, `--inset-izquierda` y `--inset-derecha`, armados con `env(safe-area-inset-*)`.
  - Arriba y abajo los usan la barra, el encabezado, el "+ New sale" fijo, las Sheets y los toasts.
  - Izquierda y derecha mantienen el contenido, la barra, las Sheets y los toasts lejos de un recorte lateral, así que el horizontal es seguro pero no está diseñado.
- **Altura**: toda altura atada a la pantalla usa `dvh`, `.pantalla`, `.disposicion` y las Sheets incluidas.
- **Gestos y presión**:
  - `overscroll-behavior: none` en `html` y `body`, `contain` en las regiones con scroll;
  - `-webkit-tap-highlight-color` transparente; `touch-action: manipulation`;
  - `user-select: none` en botones, pestañas y la barra; el texto dentro de listas y campos sigue seleccionable;
  - `.boton*`, las filas y los elementos de la barra tienen un estado `:active` armado con tokens, en ambos temas.
- **Teclado**: en iOS y Android, cuando se abre el teclado, la página y cada Sheet mantienen el campo con foco a la vista y pueden hacer scroll, así que "Save" o "Record payment" se alcanzan haciendo scroll.
  - No se promete una acción de guardar fijada sobre el teclado; es una decisión propia de cada pantalla.
  - La barra de pestañas y "+ New sale" no tienen que quedar sobre el teclado, porque los formularios y las Sheets no los muestran (navigation.md).
- **Manifest**:
  - `id` `"/"` (nunca cambia una vez publicado), `scope` `"/"`, `lang` `"en"`, `display` `"standalone"`;
  - `theme_color` y `background_color` en `--papel` claro, y sin `orientation`;
  - íconos: el 192 y el 512 existentes conservan `"purpose": "any"` sin cambios;
  - un 512 maskable conserva el look de hoy (los mismos colores de fondo y de marca, a sangre, la marca dentro de la zona segura), dibujado por diseño.
- **Splash**: sin `apple-touch-startup-image`; iOS muestra su propia pantalla de arranque en blanco, aceptado. El splash de Android sale del `background_color` y el ícono del manifest.
- **Limitaciones aceptadas**: en iOS la franja de estado queda clara con texto oscuro sobre el papel oscuro en el tema oscuro; en iOS la pantalla de arranque está en blanco hasta que la app pinta.

### El estándar del teléfono (todas las pantallas)

La regla que cumple cada pantalla en anchos de teléfono (criterios 37–41). Se escribe una sola vez, con los mismos ocho requisitos y las mismas etiquetas "checked" o "review", en dos lugares:

- CODING_STANDARDS §10 "Phone";
- el "En el celular" del README de diseño.

Este archivo solo dice dónde se aplica y cómo se mantiene cierta. No repite los requisitos.

- **Dónde se aplica**: solo por debajo del corte de 900 px de la computadora. Las disposiciones de computadora quedan fuera de su alcance.
  - Las pantallas de entrada son pantallas, no Sheets, y toda regla se les aplica. La Forgot sheet es una Sheet y se le aplica la regla de las Sheets.
  - Las confirmaciones son diálogos cortos, no Sheets.
- **Qué cita, sin repetir**:
  - el shell instalado de este archivo: el meta viewport, `dvh`, los tokens de inset, el estado `:active`, el resaltado de toque y `contain` en las regiones con scroll;
  - ADR-0027: una Sheet es una entrada del historial;
  - ADR-0028: New sale fijado al viewport visual;
  - ADR-0029: la tabla de contraste.
- **Meta viewport**: el estándar dice solo el resultado. El campo con foco queda a la vista y el envío se alcanza haciendo scroll. Nadie cambia el meta fuera de #77, que lo entrega con la comparación en teléfono de cada pantalla de ADR-0028. Hasta entonces, vale el hook de ADR-0028.
- **Excepciones**: el doc de producto de un área puede registrar una excepción deliberada. Sin una, el estándar gana sobre un issue de área. Los ADRs deciden cómo se implementa una regla.
- **El control, `web/e2e/mobile.spec.ts`**:
  - **Preparación**: Playwright con isMobile y hasTouch, en 320×568, 375×812, 430×932 y 246×437 (130 %), en claro y oscuro.
  - **Cobertura**:
    - cada ruta de `scripts/design/screens.json`;
    - cada formulario y Sheet, la Forgot sheet incluida;
    - los estados compartidos de `Estados`: el mensaje del freno, los dos textos de link muerto, "No connection", el reintento genérico, las dos formas de "That is gone." y cargando.

    Una ruta del front que falte en `screens.json` lo hace fallar.
  - **Datos de prueba**: un nombre de 60 caracteres, y cifras de nueve dígitos ("$ 999.999.999", y "−$ 999.999.999" en Profit y Cash).
  - **Estados vacíos**: las redacciones de estado vacío prohibidas mientras cargan los datos se leen de una sola lista en el spec.
  - **No automatizado**: el teclado real y la pasada en un dispositivo real siguen a ojo, como piden el shell instalado y ADR-0028.
- **Lista de infractores**:
  - Una entrada es una pantalla, una regla y un número de issue.
  - La corrida falla ante un infractor nuevo, ante una entrada cuya pantalla ahora pasa y ante una entrada sin número de issue.
  - No hay consulta por red; la revisión verifica que el número sea un issue de área real y abierto.
  - Las afirmaciones sobre el marco salen activadas, con las pantallas que hoy fallan listadas contra #59.
- **Adjunto**: la salida de `scripts/design/compare.sh` y cada PR de área adjuntan el resultado del control.

### En Settings: Business, Users, Appearance, Your account

Estos grupos de Settings (navigation.md) reemplazan la vieja pantalla de Business, que ya no existe; `/negocio` redirige a Settings. Cada uno es su propia subpantalla, un formulario: "Close", y una confirmación al salir con cambios sin guardar; uno sin tocar se cierra al instante. (Prices, entre Users e Integrations, es pricing-settings.md.)

- **Business**: renombrar el Business. Toast "Business renamed"; rechazos en el lugar, conservando lo tipeado.
- **Users**:
  - los Users por email, ordenados por email, el que tiene la sesión iniciada marcado "you"; siempre lista al menos al User con la sesión iniciada;
  - "Invite a partner": cada toque crea un link nuevo para sumarse, para copiar o compartir con el menú de compartir del teléfono.
  - **Compartir el link para sumarse** sigue la misma regla de resultado que el Share del Catalog (catalog.md):
    - un éxito, o cerrar el menú de compartir sin enviar, no muestra nada ni cambia nada;
    - un menú de compartir que espera terminar nunca retiene la pantalla: "Invite a partner", volver a compartir y copiar el link nunca se desactivan ni quedan ocupados por él, y un compartir que nunca termina cuenta como cerrar el menú, sin límite de tiempo;
    - una falla real, un segundo compartir rechazado incluido, muestra el mensaje fijo de falla que ya tiene la pantalla y deja disponible copiar el link; no se agrega ningún mensaje nuevo;
    - se muestra solo el resultado del último compartir; uno anterior que termina tarde no muestra nada;
    - no se copia nada solo, y ningún mensaje lleva el link.
- **Appearance**: Light y Dark, el actual marcado con palabra o forma y `aria-checked` o equivalente, nunca solo con color. Un toque aplica y recuerda la elección en el dispositivo (ver Tema). Nunca tiene cambios sin guardar, así que "Close" siempre cierra al instante.
- **Your account**:
  - "Change password", arriba de "Sign out", abre una Sheet:
    - los campos son "Current password" y "New password";
    - "New password" se pide una sola vez, oculta por defecto con un botón para mostrarla, acá y en la pantalla de reseteo;
    - si sale bien, el toast "Password changed · we signed out your other sessions";
    - una contraseña actual incorrecta dice "That is not the current password.". "Current password" se vacía y "New password" conserva lo tipeado;
    - una contraseña de menos de 10 caracteres muestra el mismo rechazo que al aceptar una Invitation, y un bloqueo muestra el mensaje del Login brake, conservando lo tipeado;
  - cerrar sesión ("Sign out"), que va al login.

### La instalación publicada (ADR-0016)

- **Hosting**:
  - Render aloja la app y hace deploy automático en cada merge a `master`.
  - Turso (libSQL, `aws-us-east-1`) guarda la base de datos, con restauración a un punto en el tiempo sobre las últimas 24 horas. El SQLite de ADR-0001 sigue en pie.
- **Disponibilidad**: UptimeRobot consulta el endpoint de salud cada 5 minutos. El endpoint de salud no responde nada sobre ningún Business, ni siquiera que existe uno: ni nombre, ni id, ni conteo.
- **Backup diario**: un workflow de GitHub Actions copia la base de datos cada día y cifra la copia con `age`.
  - La copia se guarda fuera de Render y de Turso.
  - La identidad para descifrar se guarda fuera del repositorio y de ambos proveedores.
- **Secretos**: ninguno en el repositorio.
- **`deploy/README.md`** da cada paso desde cero: el servicio de Render, la configuración de Turso, el workflow de backup y el monitor de UptimeRobot.
  - El límite de red y el TLS de Render reemplazan el escuchar en `127.0.0.1` detrás de un reverse proxy.
- **Restore drill**: un script que el Operator corre a mano, sin temporizador y sin canal de notificación.
  - Restaura desde la restauración a un punto en el tiempo de Turso y desde la copia diaria cifrada en un destino de prueba, sin efecto en la app en marcha.
  - Cada corrida informa el resultado del chequeo de integridad, los conteos de filas y la hora del último cambio de la copia restaurada.
  - Su frecuencia está fijada en `deploy/README.md`: una vez antes de salir en vivo, después de cualquier cambio en cómo se configuran la app o su backup, y mensualmente.
- **Publicar es un portón**:
  - A nadie se le da la dirección pública hasta que se cumplan los criterios 14–17.
  - Mientras tanto se puede seguir invitando vendedores en la red de casa.
  - Publicar es de la instalación entera: cada Business se vuelve alcanzable a la vez, separado solo por el aislamiento de la Session (ADR-0004).
- **Sin superficie de administración** (ADR-0002):
  - El estado del freno, la salud del backup y los resultados del drill se leen desde fuera de la app: los logs, la salida del drill y la corrida de GitHub Actions.
  - Nada se ve ni se hace desde una Session iniciada, y la app no gana ninguna pantalla, ruta ni entrada de navegación para eso. Settings no tiene ninguna configuración del Operator.

### Restricciones

- **Ruta de Change**: protegida. Toma el User y el Business solo de la Session, y se suma a `tests/test_gated_routes.py` y al barrido de aislamiento.
- **Rutas de reseteo** (consultar un link, enviar una contraseña nueva): abiertas, como las rutas de Invitation.
- **Códigos de rechazo**: cada rechazo lleva un código en `contract.json` (ADR-0008) y nunca repite lo ingresado (ADR-0005). Los códigos son:
  - contraseña actual incorrecta;
  - contraseña nueva demasiado corta;
  - bloqueo del freno;
  - Reset link que ya no está (un solo código para desconocido, usado, vencido y retirado).
- **Secretos**: las contraseñas se guardan solo como hashes scrypt y los tokens de reseteo solo como digests (ADR-0002). Ninguna contraseña, hash, token, digest ni link aparece en logs, respuestas, la consola ni el almacenamiento del navegador.
- **El almacenamiento del navegador** guarda solo la Theme choice del dispositivo.
- **Los tests de esta capacidad son autocontenidos**: todo tiempo del que dependen viene del reloj inyectado (ADR-0001), nunca de la fecha real, así que un control da el mismo resultado cualquier día.

### Feedback, en cada pantalla

Estos estados los dibuja `Estados` (GH-49), con el estilo del diseño y su redacción sin cambios. Cada uno se revisa en el teléfono y dentro de la disposición de computadora propia de cada pantalla (`InicioCompu`, la disposición de computadora de Home; `VentasCompu`, la de Sales; los dos paneles de Customers y Products), con las mismas palabras y formas. `Estados` no dibuja nada para un estado que ninguna capacidad define.

- **Los toasts de éxito** son cortos, fijos y no llevan datos, con una excepción deliberada.
  - Los toasts de esta capacidad:
    - "Business renamed";
    - "Invitation ready", salvo que el link se muestre en la pantalla;
    - "Password changed · we signed out your other sessions".
  - Elegir un tema no muestra toast.
  - La excepción es "Payment saved · still owing $ X" (payments.md). Nombra lo que el Customer todavía debe, porque ver eso es el sentido de registrar un Payment. Cuando no queda nada adeudado dice "Payment saved".
- **Sin "Undo" en los toasts de éxito, con una excepción deliberada**: "Sale saved" (sales.md) lleva Undo, porque registrar una Sale es la carga más rápida y frecuente. Igual no lleva datos. Ningún otro aviso de éxito tiene uno.
- **Cargando**: mientras una pantalla espera al servidor, muestra un estado de carga cuya redacción y forma siguen el diseño. No muestra ninguna cifra, ningún monto de relleno ni texto que pueda leerse como dato (criterio 7). En anchos de teléfono también cumple la regla de carga del estándar del teléfono: con la forma del contenido, `aria-busy`, sin un falso estado vacío.
- **Los estados vacíos** conservan la redacción fija de cada capacidad.
- **Salir de un formulario o Sheet** con cambios sin guardar pregunta antes de descartar, y uno sin tocar se cierra al instante (navigation.md). La pregunta de New sale es "Discard the sale?" (sales.md). La Forgot sheet no tiene nada que guardar, así que siempre se cierra al instante.
- **Los rechazos** se muestran en el lugar y conservan lo tipeado. La única excepción: una contraseña actual incorrecta vacía "Current password".
- **Sin red** muestra "No connection"; un error del servidor muestra un reintento genérico.
- **Un registro que ya no está** responde 404 tanto si se borró, como si nunca existió o es de otro Business (ADR-0004). La app nunca dice quién lo borró ni que alguna vez existió.
  - **Guardar una edición, confirmar un borrado o deshacer** sobre un registro que ya no está:
    - el formulario o diálogo se cierra y lo tipeado se descarta;
    - la lista de la que vino se refresca;
    - se muestra un aviso fijo: "That is gone. The list is up to date."
  - El aviso no es un toast de éxito. No tiene datos, ni "Undo", ni acción de reintento, y se anuncia como un toast.
  - Confirmar el borrado de un registro que ya no está da el mismo aviso, no el toast de éxito del borrado.
  - **Abrir el detalle de un registro que ya no está** (una Product, un Customer, una Expense, una Sale o una Stock entry) muestra "That is gone." con un botón de vuelta a su lista:
    - "Back to Products" (una Product o una Stock entry);
    - "Back to Customers";
    - "Back to Expenses" (el mes actual);
    - "Back to Sales".

    No lleva id, nombre ni fecha.
- Ningún estado dicho solo con color: un signo, flecha o palabra en cada ganancia, pérdida, deuda o estado; las series de los gráficos rotuladas directamente, en cualquier tema.

## Métricas

- **Ningún curl (criterio 4)**: pasa una corrida de punta a punta solo por el front. Acepta una Invitation de Business nuevo, renombra el Business desde Settings → Business, crea un link para sumarse desde Users y lo acepta como un segundo User.
- **Compartir el link para sumarse**: con un menú de compartir simulado, en Settings → Users, 100% pasando:
  - un resolve y un cancel no muestran nada;
  - una falla forzada muestra el mensaje de falla existente y deja copiar el link;
  - un compartir que nunca se resuelve no muestra nada y deja usables "Invite a partner", compartir y copiar, y un segundo compartir vuelve a llamar al menú;
  - un segundo compartir rechazado muestra el mensaje de falla existente;
  - un compartir anterior que se resuelve después de uno más nuevo no muestra nada;
  - compartir no escribe nada en el portapapeles, y ningún mensaje lleva el link.
- **Aislamiento (criterios 1, 6)**:
  - las rutas del Business están en el barrido de aislamiento y en el test de rutas protegidas;
  - los tests de servir prueban que ningún path alcanza algo fuera de `web/dist`;
  - después de una corrida completa, el almacenamiento del navegador guarda solo la Theme choice, y la consola y el almacenamiento no tienen nada personal ni dinero;
  - ninguna URL del front lleva un id de Business;
  - un registro de otro Business, abierto por id, muestra el mismo "That is gone." que uno borrado.
- **App de teléfono (criterio 5)**:
  - el manifest pasa el control de instalabilidad del navegador, corrido en `localhost`;
  - instalar en un teléfono no se controla automáticamente;
  - ambos temas se dibujan a partir de los tokens;
  - un control sin red muestra "No connection";
  - ningún estado se dice solo con color.
- **Tema (criterios 23–26)**:
  - Automatic sigue al teléfono: una corrida e2e con el sistema emulado en oscuro (`emulateMedia({ colorScheme: 'dark' })`) y nada guardado pone `data-tema="oscuro"` y `theme-color` igual al `--papel` oscuro; un cambio de `emulateMedia` a claro saca el atributo y devuelve el meta a #f6f7f5, en vivo;
  - una elección guardada gana: `tema=claro` en un teléfono oscuro sigue claro después de recargar; `tema=oscuro` abre oscuro; un valor desconocido se lee como Automatic;
  - Settings → Appearance ofrece Automatic, Light y Dark, en ese orden; elegir aplica al instante, sin toast, sin botón de guardar ni aviso de cambios sin guardar, y la opción activa se marca con un tilde más su palabra, no con color;
  - la elección sobrevive a una recarga y a cerrar sesión; con Dark guardado, la pantalla de Sign in, la de Invitation y la de reseteo se ven oscuras;
  - el almacenamiento del navegador guarda solo la Theme choice;
  - los controles nativos y las barras de scroll se revisan a ojo en un dispositivo con el sistema oscuro, claros sin atributo y oscuros con él; ningún test rápido los lee;
  - los cuatro lugares que dicen la regla dicen lo mismo, y ninguno nombra `claro` como valor del atributo.
- **Shell instalado (criterios 33–36)**:
  - metas, test rápido: el viewport tiene sus cuatro partes y ninguna restricción de zoom; `mobile-web-app-capable` y el estilo de barra de estado de iOS `default` están presentes; exactamente un `theme-color`, sin `media`;
  - manifest, test rápido: `id: "/"`, `scope: "/"`, `lang: "en"`, `display: "standalone"`, `theme_color` y `background_color` iguales a `--papel`, sin `orientation`; íconos 192 y 512 `any` y un 512 `maskable` presentes;
  - instalabilidad: el manifest sigue pasando el control de instalabilidad del navegador en `localhost` con sus campos nuevos;
  - barra de estado, test de front que maneja `data-tema` directamente: `theme-color` es `--papel` claro sin atributo, el token de papel oscuro con `oscuro`, y claro de nuevo cuando se saca el atributo (la lectura del sistema llega al atributo solo a través del módulo de tema);
  - controles estáticos: no queda ningún `vh` atado a la pantalla en `app.css` (en su lugar `dvh`); los cuatro tokens de inset existen, y la barra, el encabezado, "+ New sale", las Sheets y los toasts los usan; ningún valor de token existente cambió salvo la paleta Yerba;
  - regresión: las suites de accounts, navegación y feedback pasan sin cambios; la barra entra en 320 px con texto al 130 %; el estado presionado usa solo tokens, en ambos temas;
  - a ojo, en vertical, en un iPhone real instalado por la red de casa y un Android real en la instalación publicada:
    - el criterio 33, con New sale, Record payment y el formulario de Expense abiertos con el teclado;
    - el criterio 35, con el estado presionado visible en ambos temas;
    - la barra de estado de Android en ambos temas;
    - la franja clara de iOS, con el inset de arriba manejado;
    - el ícono maskable en el launcher de Android.
- **Estándar del teléfono (criterios 37–41)**: sin telemetría; las medidas salen del control y de la revisión.
  - infractores: la cantidad de entradas en la lista de infractores, por regla y por issue. Arranca en el conteo de hoy y solo baja, informada en cada PR de área y en la salida de `compare.sh`. Meta: 0 cuando cierren #45–#49, #59, #60 y #78;
  - control adjunto: la proporción de PRs de área que adjuntan el resultado del control móvil. Meta: 100%;
  - escrito una vez: una revisión de que CODING_STANDARDS §10 y el README de diseño listan los mismos ocho requisitos con las mismas etiquetas, y no contradicen nada de este archivo, ADR-0027, ADR-0028 ni ADR-0029;
  - cobertura: el spec falla con una ruta que falta en `screens.json`, y un test muestra que una redacción agregada a la lista de estados vacíos se hace cumplir;
  - reglas de infractores: tests muestran que la corrida falla ante un infractor nuevo, ante una entrada arreglada que quedó listada y ante una entrada sin número de issue;
  - sin regresión: los tiempos de carga de menos de 60 s (Sale, Payment, Stock entry, Expense) y las suites existentes de accounts, navegación, ventas y feedback pasan sin editar;
  - a ojo: la pasada en dispositivo real, como para el shell instalado y ADR-0028.
- **Nada inventado (criterio 7)**:
  - la barra, la barra lateral, More y Settings muestran exactamente las entradas que lista navigation.md;
  - cada cifra en Home es igual a la respuesta de la API, con ceros reales para un período sin actividad (results.md);
  - Home no muestra otros avisos que la First-run checklist, "Start with your products", el del Pinned catalog y el aviso de después de la importación.
- **Password change (criterio 18)**:
  - después de un Change, cada token anterior del User responde 401;
  - el token nuevo del dispositivo que actúa funciona, y el token de un socio en el mismo Business sigue funcionando;
  - por el front, desde un viewport de teléfono, un Change se completa (`web/e2e/passwords.spec.ts`); ningún test mide su duración.
- **Matriz de reseteo (criterio 19)**, 100% pasando:
  - un link funciona una sola vez;
  - está muerto después de 24 horas (reloj falso);
  - lo retira un link más nuevo;
  - lo retiran un Change y otro reseteo completado;
  - abrirlo dos veces no lo gasta;
  - abrir y enviar responden el mismo 404 sea cual sea la causa;
  - un reseteo exitoso cierra cada Session anterior.
- **Secreto de la contraseña (criterio 20)**:
  - ninguna contraseña, token, digest ni link aparece en ninguna respuesta, rechazo ni línea de log;
  - después de una corrida completa por el front de ambos flujos, ninguno está en la consola ni en el almacenamiento del navegador;
  - el link del comando va solo a la terminal.
- **Frenos de contraseña (criterio 21)**, con un reloj falso:
  - una contraseña actual incorrecta cuenta para los dos frenos;
  - cualquiera de los bloqueos rechaza Change con el mismo 429 y los mismos tiempos que el login;
  - un Change o un reseteo exitosos reinician solo el conteo del email;
  - las rutas de reseteo nunca se frenan.
- **Comando de reseteo (criterios 20, 22)**: un email sin User escribe 0 filas y retira 0 links.
- **Ningún curl para contraseñas (criterio 22)**: la corrida de punta a punta por el front:
  - cambia una contraseña desde Settings → Your account, después de lo cual una Session vieja queda afuera y esta sigue adentro;
  - completa un reseteo desde un link impreso hasta Home;
  - ve el estado de link muerto para un link usado.
- **Entrar, rediseñado (criterios 27–32)**:
  - rápido: desde un viewport de teléfono, la corrida de punta a punta por el front acepta una Invitation, completa un reseteo desde un link impreso e inicia sesión en la pantalla de Sign in, cayendo cada vez en Home con la sesión iniciada (`web/e2e/passwords.spec.ts`); ningún test mide la duración de los links;
  - estados: tests de front muestran cada texto fijo (mensaje del freno, los dos textos de link muerto, "No connection", el reintento, las dos formas de "That is gone.", cargando); forma y color revisados a ojo en ambos temas;
  - cargar no es un dato: un test de front muestra que el estado de carga no tiene ningún dígito, símbolo de moneda ni cifra de relleno;
  - diseño:
    - `scripts/design/compare.sh` corre antes y después para la pantalla de Sign in (`Entrar`), la de Business nuevo (`NegocioNuevo`), la de Invitation (`Invitacion`), `/reset/{token}` y los estados compartidos (`Estados`), con las comparaciones adjuntas al PR;
    - una pasada a ojo en viewports de teléfono y de computadora cubre las pantallas de entrada y los estados compartidos (`Estados`) dentro de las disposiciones de computadora;
    - cada diferencia de redacción entre el diseño y los docs se lista en el PR;
  - nada revelado: el mismo rechazo para una contraseña equivocada y un email desconocido, ningún conteo de intentos, ningún detalle del freno; el link muerto y "That is gone." no llevan id, nombre, fecha ni motivo;
  - registro: `scripts/design/screens.json` tiene `/reset/{token}` y `compare.sh` lo mide;
  - sin regresión: la suite existente pasa sin editar ningún test para que encaje con el nuevo look.
- **Sign in con el nuevo estilo y la Forgot sheet (criterios 42–45, GH-521)**:
  - una sola pasada (42): un e2e en viewports de teléfono (320×568 y 375×812, claro y oscuro) verifica que al abrir Sign in el foco está en "Email address", que "Email address", "Password" y "Sign in" se ven sin scroll, y que la corrida cae en Home con la sesión iniciada;
  - a un toque (43): un e2e verifica que "Forgot your password?" abre la Forgot sheet con un toque, también con el mensaje del freno visible; un test de front verifica que su texto fijo dice la persona que te mandó la Invitation, el email con el que iniciás sesión, una sola vez, 24 horas y sin la contraseña actual, y que "Close" vuelve a Sign in con lo tipeado intacto;
  - no revela nada (44): un test de front verifica que el texto de la Forgot sheet es idéntico con el formulario vacío, con un email registrado y con uno desconocido; que abrirla o cerrarla no hace ningún pedido; y que el texto no contiene "operator" ni ningún canal;
  - diseño (45): una Design capture de `Entrar` y `EntrarOscuro` contra la pantalla construida, en teléfono y computadora, adjunta al PR y juzgada a ojo según el Drawing as guide; `web/e2e/mobile.spec.ts` pasa para Sign in y la Forgot sheet en ambos temas;
  - sin regresión: las suites existentes de accounts y de los frenos pasan sin editar, y el mensaje del freno no cambia.
- **Nada sobrevive (criterio 11)**:
  - después de una corrida real sobre uno de dos Businesses sembrados con uno de cada cosa, 0 filas llevan su id en cualquier tabla descubierta a partir del esquema;
  - se van las Invitations pendientes, usadas y vencidas;
  - se van los Reset links de cualquier estado de sus Users;
  - `login_guard` no guarda nada para los emails eliminados;
  - una tabla agregada después al esquema queda cubierta sin cambiar el comando, probado por un test.
- **Export = borrado (criterios 8, 11)**:
  - para cada tipo exportado, el conteo en el archivo es igual al conteo borrado;
  - cada campo guardado listado arriba está presente, las Pricing settings y los VIP prices incluidos, y cada referencia lleva un nombre y un id;
  - no hay ningún hash de contraseña, digest de Invitation, digest de Reset link ni secreto en el archivo;
  - la corrida de prueba cuenta los Reset links solo entre lo que se borra.
- **Los otros intactos (criterio 12)**: el conteo de filas de cada tabla del otro Business es idéntico antes y después, y lee todos sus datos después.
- **Resguardos (criterios 9, 10)**: 0 filas cambiadas después de cada uno de:
  - una corrida de prueba (y ningún archivo);
  - un email desconocido;
  - un nombre equivocado, una cancelación o ninguna respuesta en el pedido (y ningún archivo);
  - una falla forzada al escribir el archivo, al releerlo, en el control de conteos o durante el borrado.
  - Después de cada falla forzada antes del commit, no queda ningún archivo de export en el directorio de exports. Esto incluye una falla del adaptador de archivos real después de que el archivo se creó en disco, a mitad de escribirlo o sincronizarlo.
- **Resultado del commit desconocido**: una falla forzada del commit cuyo resultado se desconoce:
  - conserva el archivo de export, imprime la línea fija "Commit outcome unknown" con la ruta, nunca imprime "nothing deleted" ni éxito, y termina con un estado de falla;
  - una corrida de prueba después responde "no business for that email" cuando el commit se aplicó, y nombra el Business con los conteos sin cambios cuando no.
- **Archivo (criterio 8)**: permisos solo para el dueño; un archivo existente con el mismo nombre nunca se pisa; el nombre lleva el nombre del Business, la fecha y la hora.
- **Sin eco (criterio 13)**: la salida capturada de la terminal y los logs de ambos modos no tienen ningún email, nombre de Customer, Phone number ni monto, solo el nombre del Business, la ruta y conteos.
- **Borrón y cuenta nueva (criterio 13)**: después de la eliminación, el token de un User eliminado responde 401, y una Invitation de Business nuevo aceptada con el mismo email abre un Business vacío con un conteo de freno limpio.
- Las métricas de eliminación y de contraseñas corren como tests rápidos y autocontenidos.
- **Los tests de eliminación y la fecha (criterio 37)**:
  - la suite de eliminación pasa en su día de Argentina fijado;
  - un control mueve el reloj cruzando un límite de mes y uno de año y da el mismo veredicto en cada día. Nunca se saltea ni se afloja;
  - el escaneo (`tests/architecture/test_no_real_clock.py`) cubre cada archivo bajo `tests/` y `app/` y resuelve imports, así que también encuentra un alias o un valor por defecto que resuelve a `datetime.now`, `utcnow`, `date.today` o `time.time`. Sus únicas excepciones son el reloj de producción (`app/clock.py::system_clock`), las raíces de composición que conectan el reloj (`app/main.py` y los tres CLIs) y el backend de e2e (`tests/e2e_app.py`, ADR-0040);
  - no se agrega ninguna afirmación sobre tiempo transcurrido (ADR-0038).
- **Publicación (criterios 14–17)**: ningún test sale a la red, a Render, a Turso ni a GitHub.
  - **Frenos (criterios 3, 15)**: probados en la costura HTTP con un reloj falso, 100% pasando. Cubren:
    - el freno por email (5 seguidos, 15 minutos);
    - el freno por dirección (20 dentro de 15 minutos, 15 minutos);
    - el conteo cruzado, rechazos bajo bloqueo incluidos;
    - un éxito que reinicia solo el conteo del email;
    - la misma respuesta 429 y los mismos tiempos de ambos bloqueos, sin revelar nada.
  - **Origen de la dirección (criterio 15)**: el encabezado reenviado se usa solo desde el proxy de confianza configurado y se ignora desde cualquier otro lado.
  - **Cookie (criterios 14, 37–38)**: `Secure` está presente cuando HTTPS está configurado y ausente si no, y nunca sigue al esquema ni a los encabezados del pedido. El test usa solo la hora fija que se le pasa y da el mismo resultado con la fecha real movida antes y después, su propia hora fija sin cambios; sus afirmaciones nunca son menos.
  - **Sin filtraciones (criterios 14, 15)**:
    - ninguna línea de log del camino del login contiene una dirección de cliente, un email ni un token;
    - el endpoint de salud no responde ningún nombre, id ni conteo de Business.
  - **Reconstruible (criterio 17)**: un control de que el repositorio no guarda ninguna credencial de Turso, identidad de `age` ni otro secreto.
  - **Drill (criterio 16)**:
    - Automatizado: contra una copia de prueba local, el drill produce integridad, conteos de filas y el último cambio.
    - A mano: la corrida antes de salir en vivo muestra, por el campo de recencia, que la restauración está dentro del límite de menos de 1 minuto.
- **Gate en verde (criterios 39–40)**: el control completo de tests del backend (`uv run --no-project pytest -n auto`) está en verde, con pasados igual a recolectados y 0 errores; los tests existentes de duración de la Session pasan sin cambios. El PR nombra la causa del rojo, y lista cualquier otro test que compare una fecha fija con la fecha real (o dice que no se encontró ninguno).

## Fuera de alcance

- Eliminar un User mientras el Business sigue.
- Enviar cualquier email, el Reset link incluido; un reseteo autoservicio por email (necesita un proveedor de email fuera del presupuesto de hosting gratuito).
- Una forma dentro de la app de pedir un reseteo; el Operator siempre lo emite. La Forgot sheet solo explica: no envía nada a nadie.
- Una configuración del contacto del Operator, o nombrar un canal de contacto en pantalla.
- Cualquier forma nueva de entrar que no sea una Invitation, y cualquier camino de registro.
- Un mensaje armado para copiar o compartir con el pedido de reseteo.
- Que el mensaje del freno apunte a "Forgot your password?".
- Decirle al User qué Sessions se cerraron; cerrar una sola Session.
- Tipear la contraseña nueva dos veces.
- Reglas de contraseña más allá de 10 caracteres.
- Frenar las rutas de reseteo o las de Invitation.
- Que el comando de reseteo informe links anteriores o retirados.
- Listar Invitations pasadas o pendientes; revocar una Invitation.
- Un límite de tiempo para compartir el link para sumarse, o copiarlo solo cuando compartir falla o no termina.
- Exportar un Business sin eliminarlo (un backup de uno activo).
- Volver a importar un export.
- Eliminar un Business desde la app.
- Verificar que cada User estuvo de acuerdo con la eliminación.
- Eliminar el archivo de export del servidor después de entregarlo.
- Bloquear o marcar una nueva corrida después de un commit con resultado desconocido; la corrida de prueba es el control.
- Roles dentro de un Business.
- Uso offline; un instructivo de instalación en iOS o Android; Capacitor.
- Un control de tema antes del login; sincronizar la Theme choice por User, por Business o entre dispositivos.
- Una disposición solo para computadora para las pantallas de entrada; un archivo de diseño propio para la pantalla de reseteo.
- Cualquier estado dibujado en Estados que ninguna capacidad defina.
- TLS en la red de casa, certificados locales incluidos: la instalación publicada recibe TLS de Render (ADR-0016).
- Actualizaciones en vivo entre socios: una lista se refresca cuando se abre o después de guardar, no cuando el otro socio cambia algo.
- Frenar una serie de intentos repartida entre muchas direcciones y muchos emails a la vez.
- Un Restore drill programado; cualquier canal de notificación al Operator.
- Una pantalla, ruta o entrada de navegación de administración, o cualquier cosa operada desde una Session iniciada.
- Una marca de publicación por Business o una salida escalonada.
- El comportamiento propio de la barra y el encabezado (#59), y la disposición propia de cada pantalla, incluida una acción de guardar fijada sobre el teclado.
- Construir Settings → Appearance, y si o dónde se guarda la Theme choice: su propio issue.
- Un splash oscuro, e imágenes de splash `apple-touch-startup-image` de iOS.
- Una barra de estado de iOS que siga al tema en vivo.
- Un diseño específico para horizontal; bloquear la orientación o desactivar el zoom.
- Un look nuevo del ícono (un cambio de marca).
- Arreglar las pantallas de cada área para que cumplan el estándar del teléfono (#45–#49, #59, #60, #78): cada issue de área hace lo suyo.
- El estándar del teléfono en las disposiciones de computadora; una relajación del contraste 3:1 para texto grande; una consulta por red de si el issue de un infractor está abierto.
- Controles automáticos del espacio de 8 px, el estado `:active`, la dependencia del hover y `enterkeyhint` fuera de las líneas de New sale: solo revisión.
- Cambiar el meta viewport fuera de #77.
- Arreglar código del producto que lee mal la fecha real (su propio ítem de bug), y arreglar tests que comparan una fecha fija con la fecha real pero no están en rojo.
- Un resguardo general, en todo el producto, contra tests dependientes de la fecha o evidencia faltante.
- Un par antes/después del cambio de #107 medido sobre el árbol viejo 90320f8 (opcional, nunca requerido).
