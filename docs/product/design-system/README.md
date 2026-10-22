# Sistema de diseño · apostrophe

> **Language.** The app's language is English (`docs/product/product-language.md`). This contract and the screens in `pantallas/` are written in Spanish: `pantallas/` is the reference for structure, hierarchy and components, not for the words, which live in `web/src/copy/`.

Contrato de diseño para el frontend. Estos archivos son la fuente de verdad del
color, los formatos, los tipos del dominio y las reglas de precio. El diseño
visual completo (celular y compu) ya no vive en un lienzo aparte: el HTML
estático en [`pantallas/`](pantallas/) es la referencia. Abrí cualquiera en el
navegador; [`Componentes.dc.html`](pantallas/Componentes.dc.html) es donde se
define el chrome compartido (barra, riel, encabezados, confirmaciones) y de
donde toda otra pantalla lo copia tal cual.

| Archivo | Qué es |
| --- | --- |
| `tokens.ts` | Paleta clara y oscura, escala tipográfica, espacios, radios, medidas. |
| `tokens.css` | Los mismos valores como variables CSS. Sin atributo en `<html>` el tema es el de luz (Papel y azul); `data-tema="oscuro"` lo pasa a oscuro. El sistema operativo no elige el tema. Las cuatro zonas seguras (`--inset-arriba`, `--inset-abajo`, `--inset-izquierda`, `--inset-derecha`) salen de `env(safe-area-inset-*)`, valen 0 donde no hay muesca y no tienen valor en `tokens.ts`. |
| `formato.ts` | Plata, gramos, fechas, semana y teléfonos. Las reglas del enunciado. |
| `dominio.ts` | Tipos del dominio: negocio, variedades, precios, clientes, ventas, stock, gastos. |
| `precios.ts` | Motor de precios, totales, validación de venta e imputación de cobros. |
| `componentes.ts` | Props de cada componente del sistema. |

## Comparar con lo construido

Las pantallas mandan: lo construido tiene que verse igual a ojo (misma estructura,
jerarquía, tipografía, colores, espaciado y componentes). Para mirarlo lado a lado:

```sh
scripts/design/sample-app.sh --dir /tmp/muestra      # deja /tmp/muestra/sample.json
node scripts/design/comparisons.mjs --facts /tmp/muestra/sample.json --out /tmp/comparaciones
```

`sample-app.sh` sirve hasta que lo cortás; `sample.json` aparece recién cuando terminó de
cargar los datos, así que quien lo corre en segundo plano espera ese archivo. Es lo que el
sistema agéntico pide declarar en el bloque `design` del stack (ADR-0040 de
agentic-system, `docs/adr/` de ese repo).

La app de muestra es la app construida sobre una base descartable con un negocio como el
del diseño ("La Huerta"), cargado por la API y nunca por el front. Cada comparación es una
PNG con el diseño a la izquierda y lo construido a la derecha, del mismo ancho; si un
estado no se alcanza o la página desborda, lo dice arriba. Qué ruta y qué pasos llevan a
cada pantalla está en `scripts/design/screens.json`: quien rehace una pantalla mantiene su
entrada al día. Las cifras de La Huerta que usan las pantallas (saldos, stock, días
restantes, las cifras del panel) están todas en
[`muestra.md`](muestra.md), la única fuente: ninguna pantalla inventa un número propio. Lo genera
`scripts/design/capture_muestra.py` a una fecha fija y un test compara cada pantalla con él
(ADR-0035).

## Dirección de diseño

Minimalista y fino, paleta **Papel y azul**: fondo cálido, tinta marrón-negra y
un solo azul usado con cuentagotas.

- **La jerarquía la hace el tamaño, no el peso.** Rótulo de 14 en gris sobre
  cifra de 54. Nada de versalitas con tracking.
- **Líneas finas antes que tarjetas.** Sin sombras, sin bordes en los paneles.
- **Un solo color de acento**, y sólo para acción, enlace y ganancia.
- Rótulos en minúscula, escritos como frases ("Vendiste esta semana").
- El idioma de la app es el inglés (`docs/product/product-language.md`): "Save", "Owes you", "Choose". Las pantallas de `pantallas/` están dibujadas en castellano y son la referencia de estructura, no de palabras.

## Accesibilidad — no se negocia

La paleta es **apta para deuteranopia**. El eje es **azul ↔ ámbar**, que esa
condición conserva; verde contra rojo cae al mismo tono (medido: ΔE 64 → 4,0).

1. Nunca usar verde para "bien" y rojo para "mal".
2. Ningún estado se distingue sólo por color: siempre lleva la palabra.
3. Donde hay varios estados juntos, además cambia la forma. En la lista de
   stock: cuadrado = agotada, círculo lleno = baja, círculo vacío = ok.
4. "Agotada" no es rojo: es el chip invertido, que se separa por luminosidad.
5. Texto sobre fondo, mínimo 4,5:1.

### Texto sobre fondo: la tabla

La regla 5 se mide acá. `tests/test_design_contrast.py` lee esta tabla, calcula la
relación de contraste (luminancia relativa WCAG 2.x) con los valores de
`web/src/styles/tokens.css` y falla si alguna fila cae bajo 4,5:1 o si el número
impreso no es el calculado. Si cambiás un color, cambiá la fila.

- **superficie**: lista cerrada de las únicas superficies sobre las que se dibuja
  texto general. No lleva ratio.
- **general**: un token de texto que puede ir sobre cualquier superficie. Lleva una
  fila por cada superficie y todas llegan a 4,5:1, en los dos temas.
- **par**: un token de texto que sólo se dibuja sobre su fondo. Lleva una sola fila.
  Una regla de `app.css` que lo usa declara también ese fondo. La única excepción es
  `.bar-inferior__item`, la etiqueta de la barra inferior, con `--nav-inactivo`. Un
  texto que se dibuja sobre el fondo de su contenedor toma su color de la regla que
  declara ese fondo.
- **ícono**: no es texto y no se mide. Sólo puede ser el `color` de los selectores de
  la última columna. `--tenue` es sólo de íconos.

<!-- contraste:inicio -->
| Token | Tipo | Fondo | Claro | Oscuro | Selectores |
|---|---|---|---|---|---|
| `--papel` | superficie | — | — | — | |
| `--superficie` | superficie | — | — | — | |
| `--deuda-fondo` | superficie | — | — | — | |
| `--acento-suave` | superficie | — | — | — | |
| `--tinta` | general | `--papel` | 15,97 | 15,80 |  |
| `--tinta` | general | `--superficie` | 14,29 | 14,06 |  |
| `--tinta` | general | `--deuda-fondo` | 13,38 | 13,39 |  |
| `--tinta` | general | `--acento-suave` | 14,11 | 13,01 |  |
| `--tinta2` | general | `--papel` | 5,44 | 5,99 |  |
| `--tinta2` | general | `--superficie` | 4,86 | 5,33 |  |
| `--tinta2` | general | `--deuda-fondo` | 4,55 | 5,07 |  |
| `--tinta2` | general | `--acento-suave` | 4,80 | 4,93 |  |
| `--acento` | general | `--papel` | 7,43 | 8,61 |  |
| `--acento` | general | `--superficie` | 6,65 | 7,66 |  |
| `--acento` | general | `--deuda-fondo` | 6,22 | 7,30 |  |
| `--acento` | general | `--acento-suave` | 6,56 | 7,09 |  |
| `--deuda` | general | `--papel` | 7,23 | 9,70 |  |
| `--deuda` | general | `--superficie` | 6,47 | 8,63 |  |
| `--deuda` | general | `--deuda-fondo` | 6,05 | 8,21 |  |
| `--deuda` | general | `--acento-suave` | 6,38 | 7,98 |  |
| `--deuda2` | general | `--papel` | 5,80 | 6,39 |  |
| `--deuda2` | general | `--superficie` | 5,19 | 5,68 |  |
| `--deuda2` | general | `--deuda-fondo` | 4,86 | 5,41 |  |
| `--deuda2` | general | `--acento-suave` | 5,12 | 5,26 |  |
| `--critico` | general | `--papel` | 13,91 | 11,80 |  |
| `--critico` | general | `--superficie` | 12,44 | 10,49 |  |
| `--critico` | general | `--deuda-fondo` | 11,64 | 9,99 |  |
| `--critico` | general | `--acento-suave` | 12,28 | 9,71 |  |
| `--boton-texto` | par | `--boton` | 15,97 | 15,80 |  |
| `--critico-texto` | par | `--critico` | 12,59 | 11,13 |  |
| `--nav-inactivo` | par | `--papel` | 4,69 | 4,97 | `.bar-inferior__item` |
| `--tenue` | ícono | — | — | — | `.mas__item-flecha`, `.fila-venta > svg` |
<!-- contraste:fin -->

## En el celular

Qué significa "se siente como una app" por debajo de los 900 px del punto de corte de la
compu (los diseños de compu quedan fuera). La app llega al celular como esta misma web, así
que lo que la web hace en el celular es la app final. Son los mismos ocho requisitos, con
las mismas etiquetas, que la subsección "Phone" de `CODING_STANDARDS.md` §10: los dos textos
son una sola regla.

Cada parte es **chequeada** (`web/e2e/mobile.spec.ts` falla, con la `Rule` que se nombra, de
`web/src/mobile-standard/violation.ts`) o **de revisión** (la hace cumplir quien revisa).
Donde `docs/product/accounts.md` (el shell instalado), ADR-0027, ADR-0028, ADR-0029 o
ADR-0048 ya decidieron un punto, acá se cita y no se repite. El documento de producto de un
área puede registrar una excepción deliberada; sin una, esta regla manda sobre el issue del
área.

1. **Chrome.**
   - Chequeado: la barra inferior, el encabezado y "+ Nueva venta" están dentro de la
     pantalla al cargar y después de scrollear hasta la mitad (`chrome-at-load`,
     `chrome-mid-scroll`).
   - Revisión: la barra y el encabezado son fijos; el contenido tiene relleno para que nada
     quede detrás. Las zonas seguras y `dvh` son las del shell instalado (accounts.md): las
     variables `--inset-*`, y nunca `100vh`.
2. **Toque.**
   - Chequeado: todo botón, enlace e input visible mide al menos 44x44 px CSS, el control de
     fecha nativo incluido, y una acción de texto lleva relleno, no sólo la altura de su
     línea (`touch-target`); la única excepción es un enlace dentro de un texto corrido.
     `user-select: none` y `touch-action: manipulation` en botones, pestañas y barra
     (`user-select`, `touch-action`).
   - Revisión: 8 px entre vecinos; nada depende del hover; todo botón y fila tiene estado
     `:active` y no hay resaltado de toque por defecto (los dos, del shell instalado,
     accounts.md).
3. **Campos.**
   - Chequeado: tamaño de letra de al menos 16 px en todo input, select y fecha
     (`input-font`); un valor de `autocomplete` en todo input visible: `username` en el mail
     del ingreso, `organization` en el nombre del negocio, `current-password`,
     `new-password`, y `off` en el nombre y el teléfono de un cliente (`autocomplete`);
     `inputmode="decimal"` en gramos e `inputmode="numeric"` en pesos (`inputmode`);
     `type="email"` y `type="tel"` (`input-type`).
   - Revisión: `enterkeyhint`, salvo en las líneas de Nueva venta, que ya prueban las
     pruebas de sales.md. El teclado se pide sólo por resultado: el campo con foco queda a la
     vista y el botón de guardar se alcanza scrolleando. El meta viewport es el del shell
     instalado; nadie lo cambia fuera de #77 (ADR-0028).
4. **Formularios y hojas** (revisión en su conjunto; sus controles caen bajo las reglas
   chequeadas de toque, campos y legibilidad).
   - Una hoja con campos o con una lista ocupa toda la pantalla en el celular, con "Cerrar"
     arriba; su acción principal queda fija abajo, al alcance del pulgar, mientras el
     teclado está cerrado (fijarla sobre el teclado lo decide cada pantalla, como Nueva
     venta, ADR-0028).
   - Una hoja es una entrada del historial: el "atrás" del sistema y Escape la cierran, y el
     scroll de fondo está bloqueado (ADR-0027).
   - Una confirmación ("Antes de borrar", "¿Descartás la venta?") es un diálogo corto con dos
     botones de al menos 44 px, no una hoja. Escape y el "atrás" del sistema la descartan
     como su "No".
   - Una pantalla de entrada (Entrar, NegocioNuevo, Invitacion, Reset) es una pantalla, no
     una hoja: mantiene su columna centrada y todas las demás reglas le valen completas.
5. **Disposición.**
   - Chequeado: ningún scroll horizontal de la página a 320 px ni al 130 % (246 px CSS)
     (`h-scroll`); un nombre largo se corta con puntos suspensivos (`name-overflow`); una
     cifra nunca se parte en dos renglones y el "$" nunca queda solo en un renglón
     (`figure-split`), probado con el dato de la revisión: un nombre de 60 caracteres y
     cifras de nueve dígitos.
   - Revisión: listas, no tablas, en el celular.
6. **Gestos.**
   - Chequeado: `overscroll-behavior: none` en `html` y `body` (`overscroll`).
   - Revisión: el "atrás" del sistema sigue el historial (ADR-0027); las regiones con scroll
     usan `contain` (accounts.md).
7. **Carga** (chequeada), con la API retenida:
   - el área de contenido tiene la forma de su diseño final y lleva `aria-busy="true"`
     (`blank-while-loading`, `aria-busy`);
   - ninguna frase fija de estado vacío aparece hasta que llega la respuesta
     (`false-empty`), y el estado de carga no tiene ningún dígito ni símbolo de moneda
     (`data-while-loading`);
   - cuando llegan los datos el chrome se mueve 0 px (`chrome-shift`) y el área de contenido
     como mucho `CONTENT_SHIFT_PX` (`content-shift`);
   - un toque en el guardar de Nueva venta, en el de Registrar cobro y en "Entrá" de Entrar
     muestra su estado pendiente al instante (`pending-state`).

   Revisión: una frase fija nueva de vacío o sin actividad va en
   `web/src/screens/emptyStates.ts`; las pantallas la leen de ahí y el chequeo prohíbe
   cada frase de ese archivo mientras cargan los datos. Una copia literal en una pantalla
   rompe su prueba.
8. **Legibilidad** (chequeada).
   - Todo texto tiene al menos 4,5:1 contra su fondo efectivo, en los dos temas, sin la
     relajación para texto grande (`contrast`); un fondo que la cuenta no puede probar se
     informa, nunca se aprueba (`contrast-unprovable`). Ningún texto mide menos de 12 px,
     sin excepción (`text-size`).
   - La etiqueta de un control deshabilitado queda exenta; un motivo escrito al lado, no.
     Los tokens sólo de ícono (las flechas `--tenue`) no se miden.
   - La tabla de contraste de arriba sigue siendo la guarda de los tokens (ADR-0029); lo que
     manda para lo que una persona lee es el chequeo sobre el DOM (ADR-0048).

**Formularios, hojas y rutas nuevos** (revisión): un formulario, hoja, confirmación o
estado compartido de `Estados` nuevo se suma a los estados que recorre el chequeo
(`WalkState`, en `web/src/mobile-standard/states*.ts`) para que lo visite; una ruta nueva
se registra en `scripts/design/screens.json`, y una ruta del front que falte ahí rompe el
chequeo. Un paso que no llega a su pantalla se informa como `unreachable`, nunca se saltea.

**La lista de infractores.** Lo que la app incumple hoy se lista, nunca se saltea:
`web/src/mobile-standard/offenders/<regla>.json`, un archivo por regla, cada entrada una
pantalla, una regla, un elemento y un issue (uno de área del mapa fijo #45-#49, #59, #60,
#78), con `sizes` y `themes` opcionales. Sólo puede achicarse: la corrida falla ante un
infractor nuevo, ante una entrada cuya celda ya pasa y ante una entrada sin número de issue
válido. No consulta ninguna red; quien revisa comprueba que el número sea un issue de área
real y abierto. Un issue de área no está terminado mientras sus pantallas sigan en la lista.
Vale sólo para el dato y la fecha fijos (ADR-0048); cambiar cualquiera de los dos es
cambiar las listas, en el mismo diff.

**Se adjunta.** Todo PR de un área (#45-#49, #59, #60, #78) adjunta el resultado del
chequeo: el proyecto `mobile` de `npm --prefix web run e2e` y los conteos de infractores
que imprime `scripts/design/compare.sh` (con `COMPARE_MOBILE=1` corre también el chequeo).
El teclado real y la prueba en un celular real siguen siendo a ojo (accounts.md, ADR-0028).

## Íconos y texto

La misma regla que [`docs/product/icon-and-text-rule.md`](../icon-and-text-rule.md),
dicha igual. Decide cómo se rotula cada cosa, nunca qué hace: ninguna acción, ruta,
orden, confirmación ni texto de aviso cambia por ella.

**Qué forma toma cada control.** Las dos listas son cerradas: agregar a una cambia
esta regla, nunca una pantalla suelta.

- **Sólo ícono**: borrar ("Borrar…"), buscar ("Buscar"), cerrar ("Cerrar"), editar
  ("Editar") y compartir ("Compartir") sólo donde no es la acción principal de la
  pantalla.
  - El nombre accesible es la palabra de hoy, exacta, y el blanco mide 44 px como
    mínimo.
  - Estar en la lista permite el ícono solo, no lo exige: la acción principal de una
    pantalla lleva siempre su texto.
  - Cerrar es una sola forma en todo formulario y hoja: el ícono, con el nombre
    "Cerrar". Volver no es cerrar: sigue siendo "‹ <padre>".
  - "Más info" (la "i") es el único ícono solo fuera de esta lista.
- **Sólo texto**: enlaces, las dos respuestas de una confirmación, el envío de un
  formulario u hoja, las opciones entre las que se elige (pestañas de período,
  Efectivo · Transferencia · Debiendo, Claro · Oscuro…) y Deshacer.
- **Ícono + texto**: todo lo demás. El ícono al lado de una palabra es decorativo
  (`aria-hidden`), así que el nombre accesible sigue siendo la palabra.
  - **Crítica**: "Eliminar variedad" (`tacho`) es ícono + texto en contorno de 2 px,
    sin relleno, con texto e ícono en `--critico` (texto general: filas de la tabla de
    arriba). El relleno `--critico` con `--critico-texto` queda sólo para la respuesta
    de una confirmación. Dibujada en `pantallas/VariedadDetalle.dc.html`.
- **Aviso tocable**: un aviso que el vendedor toca para abrir lo que señala, como
  "Seguí con la configuración" en Inicio. No es una fila de acción ni un control de
  ninguna de las dos listas, y no las cambia.
  - Conserva su tarjeta tal como está diseñada: su fondo, sus esquinas redondeadas y
    su propio relleno, sin el espaciado ni el divisor de una fila.
  - Su frase lleva el significado, y su nombre accesible es su texto visible.
  - Su flecha es la marca decorativa de que abre algo; no lleva otro ícono, y el ícono
    de atención sólo si la lista de avisos de la regla lo nombra.
- La barra, la barra lateral, Más y la lista de Configuración llevan siempre ícono +
  texto, y dos entradas de un mismo menú nunca comparten ícono.

**Largo del texto siempre visible.** Ayuda o aviso: una frase de 80 caracteres como
máximo. Estado vacío: título de 40 como máximo, una línea de 80 y su acción. Los
rechazos en línea apuntan a 80 pero conservan lo que hay que corregir, y nunca van
detrás de "Más info". Las consecuencias que el vendedor no esperaría quedan visibles,
en corto. El largo se mide en la copia en español tal como se ve, con los datos de
`SAMPLES` (`web/src/copy/limits.ts`: los peores casos) y lo comprueba
[`copyLimits.test.ts`](../../../web/src/copy/copyLimits.test.ts).

**Qué va detrás de "Más info".** Sólo el cómo o el porqué, en el lugar, bajo la línea
que explica; nunca una consecuencia, el arreglo de un rechazo ni un estado. Siempre
abre cerrado, no se recuerda y no cuenta como cambio sin guardar.

**La familia.** Trazo de 1,6 y 22 px, siempre, dibujado una vez en
`web/src/components/Icono.tsx`; el ícono no recibe tamaño ni trazo, y ningún trazo
propone el suyo. Nunca emoji como ícono de interfaz. Cada ícono se nombra por su
`NombreIcono` (en [`componentes.ts`](componentes.ts)); `Icono.tsx` y `componentes.ts`
nombran el mismo conjunto, y `tests/test_design_icons.py` falla si difieren o si un
trazo se sale de la regla. Un nombre ya dibujado se reutiliza antes de agregar otro,
y uno nuevo entra sólo cuando una pantalla lo usa.

## Reglas de negocio que viven en el código

- **Precios históricos.** Una venta usa el precio que regía el día de la venta,
  aunque después se cambie. Nunca se edita un precio viejo (`precioVigente`).
- **Orden de las reglas de precio**, siempre una sola y siempre visible:
  `regalo → especial → VIP → por cantidad → lista`.
- **Precio especial**: se carga el total de la línea y se deduce el precio por
  gramo, no al revés.
- **Cobros**: se imputan a la venta impaga más vieja (`imputarCobro`).
- **Las compras de flores no son gastos**: son entradas de stock. Los gastos son
  insumos, packaging, envíos y otros.
- **La caja puede dar negativa** en un período con una compra grande. Se muestra,
  no se tapa.
- **Multi-negocio**: todo extiende `DelNegocio`. Ninguna consulta cruza negocios.

**Quién manda.** El backend calcula y guarda el precio de cada línea al
registrar la venta (ADR-0003) y es el que imputa los cobros. `precios.ts` sirve
para mostrar el cálculo en vivo antes de guardar; si alguna vez difiere, vale lo
que devuelve el backend.

## Confirmado con el negocio

**El cliente VIP paga el precio "por cantidad" sin llegar al mínimo de gramos.**
Decidido en el grill del 02/10/2026 (issue #3). Está aislado en la función
`precioVip` de `precios.ts`.

## Verificado

Los cinco `.ts` compilan con `tsc --strict`. Las reglas de precio, los formatos
y la imputación de cobros pasan 24 pruebas de comportamiento.
