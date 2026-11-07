# Selector

## Jobs

- Cuando estoy cargando un registro en el teléfono y un campo necesita una opción de mi propia lista, que sigue creciendo, quiero encontrar la opción y elegirla en dos toques sin perder lo que ya cargué, para terminar el registro en menos de un minuto y nunca elegir algo equivocado.

La computadora también es una situación: el mismo campo se usa con teclado, conserva la capacidad y no recibe pulido dedicado (Phone first).

## Qué es

El Selector es el único control para elegir una opción de un Growable set: un conjunto que puede tener una opción con la que la app no vino, hoy o por una decisión ya tomada (Varieties, Expense categories, Withdrawal reasons, Customer types; y con GH-318, units, time zone, Money format, Product word y Payment methods). Lo opuesto es un Fixed set, declarado en `web/src/components/fixedSets.ts` con un motivo, que puede mostrarse como chips. El componente vive en `web/src/components/Selector.tsx`.

En esta parte ninguna pantalla lo usa todavía; las partes siguientes de GH-581 pasan las pantallas al Selector.

## El campo

- Tiene una etiqueta visible (`label`) y muestra la opción elegida.
- Cada opción (`options`: `value`, `label`, `glyph` opcional) puede llevar un glifo antes del nombre, decorativo (`aria-hidden`) y que nunca se busca.
- Campo obligatorio (`required`): no tiene fila para borrar la elección.
- Campo opcional (`emptyWording`): sin elección muestra su propio texto vacío, y la primera fila de la lista usa el mismo texto y borra la elección.
- Cargando (`loading`): el campo queda deshabilitado, con `aria-busy="true"` y un esqueleto en lugar del valor, sin texto ni dígitos; la lista no se puede abrir.

## Una elección que no está entre las opciones

- Si quien usa el Selector pasa la elección actual con su nombre (`selected`), el campo muestra ese nombre con la marca "no longer available": la palabra más el Attention icon, nunca solo color. La lista nunca la ofrece. Pasar el nombre es tarea de quien usa el Selector.
- `selected` se usa solo cuando `selected.value` es igual a `value`; si no coincide, se ignora (un `selected` viejo no se muestra) y el campo sigue las reglas de arriba y de abajo según `options`.
- Si la elección no está ni en `options` ni en `selected`, el campo muestra la marca sin nombre. Nunca muestra el texto vacío ni un blanco, porque diría que no hay elección cuando el registro tiene una. Es una red de seguridad, no el caso normal.
- Elegir una opción vigente la reemplaza.

## Teléfono (menos de 900 px)

- El campo abre la lista en el marco compartido de la Sheet: "Close" arriba y sin barra de acciones. El nombre accesible de la lista es "{label} options".
- Filas de 44 px; la opción actual lleva un check y la palabra accesible "Selected". Los nombres largos se cortan con puntos suspensivos. No hay scroll horizontal.
- Tocar una opción la elige y cierra la lista: elegir lleva exactamente 2 toques.
- Con más de 8 opciones, arriba hay un campo de búsqueda fijo que recibe el foco al abrir la lista: `type="search"`, `inputmode="search"`, `autocomplete="off"`, `enterkeyhint="search"`, texto de 16 px y 44 px de alto. Enter nunca envía el formulario de abajo.
- Solo las filas hacen scroll (`overflow-y:auto`, `overscroll-behavior:contain`), con el alto tomado del viewport visible, así que toda fila queda alcanzable por encima del teclado.
- Cada lista abierta es su propia entrada del historial, en el nivel de arriba del formulario desde el que se abrió: el contexto `SheetLevel` de `useSheetStack.ts` (0 por defecto) da el nivel, el Selector llama a `useSheet(level + 1)` y envuelve su lista en `SheetLevel` en `level + 1`; nunca recibe un nivel por prop. Volver y "Close" son la misma acción y cierran exactamente una entrada, nunca el formulario de abajo, también cuando ese formulario está abierto sobre otro.

## Historial

- El nivel de una lista es el `SheetLevel` que la rodea más uno: sin envoltorio es 0, así que la lista es el nivel 1; dentro de un formulario en el nivel 1 es el nivel 2. `NuevaVentaCliente` provee los niveles 1 y 2 alrededor de su selector de cliente y de su creador.
- Volver y "Close" cierran exactamente una entrada, nunca el formulario de abajo. Un doble toque tampoco saca el formulario: un solo abrir emite a lo sumo un cierre.
- Límite conocido: una Sheet hermana que use el mismo número de nivel también se lee como abierta junto con la lista. Una prueba lo fija; quien revisa cada cambio de pantalla comprueba el nivel de cada Sheet hermana.
- Quien usa el Selector no lo re-keya ni lo desmonta mientras su lista está abierta: lo pasa a `loading`. El costo de hacerlo mal es una entrada muerta en el historial: el primer volver no muestra nada.

## Computadora (900 px o más)

- El campo abre un desplegable: las flechas se mueven, Enter elige y Tab sale. Un clic fuera también lo cierra.
- Escape cierra solo el desplegable; el Escape del formulario no se dispara.
- La búsqueda funciona igual que en el teléfono. El desplegable nunca toca el historial.

## Orden, búsqueda y fila para borrar

- El Selector nunca reordena: muestra el orden que recibe, así que el orden propio de un Business (por ejemplo el de sus Withdrawal reasons) es el que ve el vendedor. No fija ninguna regla de orden (Assume nothing).
- La búsqueda compara solo el nombre (`label`), sin importar mayúsculas ni acentos (`ñ` coincide con `n`: en la búsqueda la ñ no es una letra aparte, es una `n` con tilde), solo filtra y conserva el orden. Cuando nada coincide dice "No results".
- La fila para borrar va siempre primera y no se filtra con la búsqueda.

## Reapertura y foco

- La búsqueda empieza vacía cada vez que se abre la lista.
- El foco vuelve al campo después de elegir, de "Close", de volver o de Escape.

## Conjunto vacío

- Sin opciones, la lista muestra el mensaje de conjunto vacío (`emptySetMessage`): una sola línea de texto plano, no un link, que nombra el lugar real donde se crean esas opciones.
- Campo opcional con una elección puesta (por `selected` o por un valor que no está en ninguna lista): primero la fila para borrar y debajo el mensaje.
- Campo opcional sin elección: el mensaje solo.
- Campo obligatorio: el mensaje solo, nunca una fila para borrar.

## Carga y cargas fallidas

- El Selector no tiene estado de error. Mientras las opciones de un campo no se cargaron con éxito (pendiente, fallida o reintentando), quien lo usa mantiene `loading`: el campo sigue deshabilitado con su esqueleto, y el manejo de errores de la propia pantalla dice qué falló y ofrece reintentar.
- El mensaje de conjunto vacío aparece solo después de una carga exitosa que no trajo opciones. Una carga fallida nunca parece un conjunto vacío.

## Textos

Todo texto sale del Copy module (`web/src/copy/`), en inglés, con el en-XA generado; se reusan las claves existentes (`close`, `loading`).

- `common`: Search, No results, no longer available, Selected, `{{label}} options`, Paid, Owing, Payment method, No type. Las últimas cuatro no las muestra el control: sirven a la nota de prueba de Payment methods y a los cambios de pantalla posteriores.
- `emptyStates`:
  - "No varieties yet. Add them in the Varieties tab."
  - "No categories yet. Add them in Settings → Expense categories."
  - "No reasons yet. Add them in Settings → Business → Withdrawal reasons."

La palabra "varieties" es la palabra de pantalla de hoy; cambia con la parte Product word de GH-318 y el barrido de #330.

## Reglas

- Un conjunto que puede tener una opción con la que la app no vino, hoy o por una decisión ya tomada, se elige con el Selector, nunca con chips. Solo los Fixed sets pueden ser chips. Ejemplos: Expense categories → Selector; Today · Week · Month → chips.
- Chips, pills, Pestanas y controles `role="radio"` toman sus opciones solo de un Fixed set declarado en `fixedSets.ts`, con un motivo no vacío. `fixedSets.ts` importa solo de `web/src/copy/` y del tipo `IconName`. Una `FixedOption` tiene solo `value`, un getter de copy `label` y un `IconName` opcional; el estado en tiempo de ejecución vive en una capa aparte por `value`.
- Ningún conjunto leído de los datos o la configuración de un Business, Payment methods incluidos, se declara nunca en `fixedSets.ts`, ni siquiera temporalmente.
- Cualquier selector posterior sobre datos o configuración del Business (GH-318: units, time zone, Money format, Product word, Payment methods) se construye sobre el Selector.
- Nota de prueba de Payment methods, hasta GH-318: los Payment methods todavía no existen. Las pruebas y los dibujos del Selector pueden usar un conjunto de Payment method armado dentro de la prueba o del dibujo, con las claves `Payment method`, `Paid` y `Owing`; ese conjunto nunca se declara en `fixedSets.ts` ni lo lee ninguna pantalla.
- Una parte que pasa una pantalla al Selector, y solo ella, agrega la entrada de WalkState de esa pantalla, borra las entradas de las listas de infractores que el cambio deja obsoletas y actualiza el dibujo de la pantalla en `pantallas/`. Nunca le quita una capacidad que la pantalla tenía (creación en el lugar, líneas de ayuda, el rechazo ante una línea que ya no existe), los Fixed sets conservan su aspecto y su comportamiento, y le pasa al campo el estado de carga de la consulta que lo alimenta.

## WalkState y chequeo en el teléfono

- El componente no tiene una ruta a la que el recorrido llegue, así que esta parte no agrega ninguna entrada de WalkState ni toca las listas de infractores ni los dibujos de `pantallas/` de ninguna pantalla. Cada pantalla recibe su entrada, su limpieza de infractores y su dibujo en la parte que la pasa al Selector.
- Hasta que el primer cambio de pantalla (parte 2) corra el chequeo `mobile`, se miran a ojo: las filas y el campo de búsqueda de 44 px, el texto de 16 px, la ausencia de scroll horizontal y que toda fila quede alcanzable por encima del teclado. El PR de la parte 2 adjunta su corrida `mobile`.

## Dueños de `fixedSets.ts`

`fixedSets.ts` y su guarda son de las partes 3 y 5 de GH-581. Nada de lo que entrega el Selector (componente, auxiliar, pruebas, dibujo) importa de ese archivo.

## Diseño

El Selector está dibujado en `docs/product/design-system/pantallas/Componentes.dc.html`: el campo cerrado, el campo con "no longer available", el campo cargando, la lista de teléfono con búsqueda y sin ella, No results, el conjunto vacío y el desplegable de computadora. La regla y sus dos ejemplos están en `docs/product/design-system/README.md`.

## Métricas

Cada criterio de éxito se mide con una prueba de vitest y Testing Library, a través de lo que ve el usuario; están todos en verde en el Gate:

1. Con 20 opciones, elegir lleva 2 toques: abrir el campo y elegir la opción.
2. La búsqueda aparece con más de 8 opciones y no con 8, no distingue mayúsculas ni acentos y muestra "No results".
3. Una elección que no está entre las opciones muestra la marca, con su nombre y sin él, y nunca se ofrece.
4. Volver cierra solo la lista sobre un formulario en el nivel 0 y en el nivel 1.
5. Cargando: `aria-busy`, sin texto, y la lista no se abre; nunca hay texto de conjunto vacío.
6. Conjunto vacío: el mensaje, y la fila para borrar arriba cuando hay una elección en un campo opcional; ninguna fila para borrar en un campo obligatorio.
7. Teclado de computadora: flechas, Enter y un Escape que no llega al formulario.
8. Se conserva el orden recibido, la búsqueda empieza vacía al reabrir y el foco vuelve al campo.

El resultado del trabajo (una Sale registrada desde el teléfono en menos de un minuto) se mide en las partes que pasan cada pantalla al Selector, no en esta.
