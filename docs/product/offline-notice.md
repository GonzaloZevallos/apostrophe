## Jobs

- Cuando estoy trabajando en el teléfono y la app no puede llegar al servidor, sea al abrirla o al guardar algo como una Sale, un Customer o una configuración, quiero que el aviso me diga claramente que estoy sin conexión y que la app necesita conexión, así sé que el problema es mi señal y no la app, y no pienso que algo que guardé se perdió sin enterarme.

## Qué es

El Offline notice es el único aviso que la app muestra cuando una solicitud falla porque se cayó la red. Es un solo componente, `web/src/components/SinConexion.tsx`, y se usa en dos lugares:

- **Banner global**: arriba de la pantalla, cuando la app abierta pierde la red.
- **Aviso en línea**: dentro de un formulario o una pantalla, después de una solicitud que falló por falta de red, por ejemplo al guardar en Settings → Business.

En los dos lugares dice exactamente lo mismo.

## Qué dice

- **Título**: "You're offline" (`common:offline`).
- **Detalle**: "apostrophe needs a connection." (`common:offlineDetail`).

"apostrophe" va en minúscula porque es el Wordmark: ninguna configuración ni ningún idioma lo renombra ni lo pone en mayúscula. La constante deprecada `SIN_CONEXION_MENSAJE` de `web/src/copy/common.ts` repite el título.

La frase vieja "Offline: check your internet and try again." ya no aparece en ningún lado.

## Cómo se ve

- Es un aviso de atención: se dibuja dentro de `AvisoAmbar`, con el Attention icon, `role=status`, el título en `span.aviso-ambar__titulo` y el detalle en `span.aviso-ambar__detalle`.
- Usa solo tokens y se lee igual en claro y en oscuro.
- En el teléfono cumple el estándar móvil sin ningún infractor nuevo en el Mobile check; un hallazgo sobre la línea de detalle se corrige en los tokens, nunca se agrega a una lista.
- Se juzga contra el estado 'Sin conexión' de `docs/product/design-system/pantallas/Estados.dc.html` según el Drawing as guide.

## Lo que no hace

- No reintenta. El dibujo agrega que la app reintenta sola; esa mitad se deja afuera porque la app no reintenta sola, y prometerlo sería falso (decisión del dueño en GH-1073, Dibujo 1). Si algún día la app reintenta sola, devolver esa mitad es un trabajo aparte.
- No tiene acción de reintentar ni botón.
- No cambia la única excepción que ya existe: la lista de Products de New sale vuelve a leer sola al reconectar o al volver a la app tras un fallo (`sale-in-progress.md`).
- No depende del service worker ni del origen (accounts.md, Sin red).

## Métricas

- **Mismas dos líneas en todos lados**: en el banner global y en el aviso en línea se leen "You're offline" y "apostrophe needs a connection.", con 0 apariciones de la frase vieja en `web/` y `scripts/design/`.
- **Aviso de atención en ambos temas**: Attention icon, `role=status` y solo tokens en claro y oscuro; 0 infractores nuevos en el proyecto e2e móvil.
- **Fiel al dibujo**: las Design captures en claro y oscuro de `EstadosSinConexion` y de Settings → Business tras un guardado fallido muestran lo que dice el estado 'Sin conexión', salvo la mitad aceptada como fuera.
