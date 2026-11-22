## Jobs

**Cuando** necesito cambiar cómo está configurado mi negocio (renombrarlo, sumar un socio, conectar o cambiar el bot de Telegram, editar el **Catalog header and footer**, manejar mis **Expense category**s y mis **Payment method**s, pasar a oscuro, cambiar mi contraseña o cerrar sesión), **quiero** cada configuración de todo el negocio en un solo lugar, cada una en su propia pantalla corta, **para poder** cambiarla en pocos toques desde el celular y volver con el cliente, sin preguntarme qué pantalla la tiene.

- Es el job de Settings de navigation.md. **Settings** es poco frecuente y deliberado, y los jobs diarios nunca lo necesitan. Las configuraciones de un solo Product viven en su página y quedan fuera de este job.

**Cuando** cambia algo de cómo manejo mi negocio (un precio, una forma en que me pagan, el bot de Telegram, quién trabaja conmigo) y solo tengo el celular, **quiero** abrir Settings, ver que estoy en el negocio correcto y llegar a esa configuración en un toque, **para poder** cambiarla y volver a vender.

- Afina el job de arriba para la pantalla de inicio de Settings en el celular (parte 3 de GH-843). No es un job nuevo de producto. Su protagonista es quien vende, con el celular en la mano y poco tiempo (BRIEF).
- Casi siempre se entra por una de unas pocas configuraciones frecuentes. Las demás se visitan poco, y se buscan por tema en vez de recordarlas de memoria.
- Antes: el celular mostraba una sola lista plana. No se veía qué Business se estaba editando, no había atajos a las configuraciones que más cambian, y los Payment methods quedaban a 3 toques de una pantalla principal (avatar → Payments and expenses → Payment methods). Quien vendía recorría la lista buscando la fila.

# Settings

**Settings** es el único lugar que reúne cada configuración de todo el **Business**. Cada configuración vive en su propia pantalla, y sus filas, sus atajos y sus direcciones salen de un solo registro tipado, `web/src/screens/settings/settingsRows.ts`. Ninguna pantalla declara una etiqueta, una segunda línea, un ícono ni una dirección propia (ADR [20261119-settings-rows-live-in-one-registry-read-by-the-list-the-shortcuts-and-the-search](../adr/20261119-settings-rows-live-in-one-registry-read-by-the-list-the-shortcuts-and-the-search.md)). Desde dónde se llega a Settings y el marco de cada pantalla se definen en navigation.md. Lo que hace cada grupo se define en el archivo de su capacidad: pricing-settings.md, payment-methods.md, catalog.md, accounts.md, theme-choice.md, money.md y stored-language.md.

En una computadora (900 px o más), Settings conserva su lista de siempre, sin ningún cambio (**Phone first**). Esta capacidad define la pantalla de inicio de Settings en el celular.

![Settings en el celular](../assets/screens/Configuracion.webp)

## Criterios de éxito

1. **Cada configuración a un toque.** En el celular, cada fila que muestra el registro se abre en 1 toque desde la pantalla de inicio de Settings. Su pantalla muestra "‹ Settings", que vuelve a esa pantalla de inicio. Lo prueba un recorrido de vitest con la tabla de rutas real.
2. **Lo frecuente, en la primera pantalla.** Los tres atajos (Prices, Payment methods, Integrations) quedan enteros en la primera pantalla, sin scroll, a 320, 375 y 430 px, en claro y en oscuro. Desde la pantalla de inicio de Settings, los Payment methods quedan a 1 toque; desde un Tab root, a 2 (el avatar y el atajo). Antes eran 3.
3. **Nada cortado, todo tocable.** A 320 px no hay nada recortado ni superpuesto. El nombre del Business y las segundas líneas terminan en puntos suspensivos sin partirse. La etiqueta de un atajo ocupa como máximo dos líneas y nunca se corta. Cada fila y cada atajo mide al menos 44 px y tiene un estado presionado.
4. **Se sabe en qué negocio se está.** El nombre del Business se ve sin tocar nada. Mientras la lectura no llegó, o si falló, no se muestra ninguna cantidad de Users, ni equivocada ni rota: el lugar queda vacío.
5. **La computadora no cambia.** El marcado, los localizadores (`data-menu`, `ajustes__*`) y el texto de Settings en la computadora quedan byte por byte iguales. Lo prueba la captura de ConfiguracionCompu antes y después.

## Comportamiento

### Pantalla de inicio de Settings (celular)

Solo por debajo de 900 px. De arriba abajo:

1. el título;
2. la tarjeta del Business;
3. los tres atajos;
4. los cinco grupos en el orden de `SETTINGS_GROUPS`, cada uno con su encabezado y sus filas visibles.

No hay campo de búsqueda: puede ser una parte posterior. Los estilos usan su propia raíz de clases, `ajustes-inicio__*`, y solo tokens de diseño.

### Tarjeta del Business

- Muestra:
  - la inicial: el primer carácter del nombre sin espacios al inicio ni al final, así que un emoji cuenta como uno solo (`Array.from(name.trim())[0]`);
  - el nombre del Business, que termina en puntos suspensivos cuando no entra;
  - la cantidad de Users, "1 user" o "N users" (`settings:card.users`).
- La cantidad sale de la misma lectura de `/business` que usa el grupo Users y que alimenta los idiomas seleccionables. No agrega ninguna ruta de API.
- El lugar de la cantidad tiene una altura fija, así que nada se corre cuando se llena.
- Mientras la lectura está pendiente, la cantidad queda vacía y el contenido se marca ocupado (`aria-busy`). Si la lectura falla, la cantidad queda vacía y no se muestra ningún error.
- Es de solo lectura: no tiene link, botón ni chevron. Para entrar a esas pantallas están las filas Business y Users.
- No muestra ningún rol, porque los roles dentro de un Business quedan fuera de alcance (BRIEF).

### Atajos

- Son los tres que declara `SHORTCUTS` en el registro, en este orden: Prices, Payment methods, Integrations. Cada uno abre la pantalla de su fila.
- Se eligieron por el job (un precio, una forma de cobrar, el bot de Telegram). Customer types es opcional y viene desactivado en un Business nuevo, y Users y Appearance cambian poco, así que ninguno de ellos es atajo.
- La etiqueta puede ocupar hasta dos líneas y nunca se corta con puntos suspensivos. Cada tile mide al menos 44 px de alto y los tres tienen la misma altura.

### Grupos y filas

- Hay cinco encabezados, en el orden del registro: Business, Catalog, Payments and stock, Channels, Team and app.
- Cada fila visible es un solo link con un ícono, una etiqueta y una segunda línea. La segunda línea no se parte: termina en puntos suspensivos, y su bloque de texto tiene `min-width: 0`.
- Language se muestra solo cuando el Business tiene 2 o más idiomas seleccionables. Customer types se muestra solo con ese interruptor activado. Ninguna de las dos aparece antes de que se conozcan sus datos. Hay 11 filas con las dos ocultas, 12 con una sola visible y 13 con las dos.
- Cada fila y cada atajo es un `InAppLink` a la dirección de su fila, con el estado `{enteredFrom: 'settings'}`. Su pantalla vuelve con "‹ Settings" a la pantalla de inicio de Settings.
- Cada fila y cada atajo mide al menos 44 px y tiene un estado `:active`.

### Texto e idioma

Todo el texto está en inglés, en el **Copy module**, bajo `settings:*`. No sale ningún texto en español de un dibujo.

### Diferencias con el dibujo aceptadas por el dueño

El dibujo es `Configuracion.dc.html` y su gemelo oscuro. Las cuatro diferencias se aceptaron en GH-843, decisión 1 del humano:

1. Hay tres atajos entre la tarjeta y los grupos, y el dibujo no tiene ninguno.
2. La tarjeta es de solo lectura y no muestra rol. En el dibujo es un link con chevron y dice "Vos sos dueño · 2 personas".
3. No hay campo de búsqueda, aunque el dibujo trae uno.
4. Las nueve filas sin encabezados del dibujo se reemplazan por los cinco grupos con encabezado del registro. Varias de esas filas del dibujo no tienen ninguna capacidad detrás.

## Métricas

- Toques desde la pantalla de inicio de Settings hasta la pantalla de cualquier fila: 1, para cada fila del registro, según el recorrido de vitest con la tabla de rutas real.
- Toques desde un Tab root del celular hasta los Payment methods: 2 (antes eran 3), según `tapBudget.spec.ts`.
- Atajos enteros en la primera pantalla, sin scroll, a 320, 375 y 430 px: 3 de 3, según el e2e del proyecto de celular y la Design capture.
- Objetivos táctiles de la pantalla de inicio de Settings por debajo de 44 px: 0, según el Mobile check, sin que crezca ninguna lista de infractores.
- Cantidades de Users equivocadas o rotas mostradas durante una lectura pendiente o fallida: 0, según los tests de Testing Library.
- Cambios en la Settings de computadora: 0, según la captura de ConfiguracionCompu antes y después y los tests de Settings existentes contra la vista de computadora.
