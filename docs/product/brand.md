## Jobs

- When I reach for the app on my phone's home screen or in a browser tab, I want to spot it at once and have it look like one finished product, from the icon through Sign in to every screen, so I open it without hesitating, trust it with my customers' data and get on with recording the sale.

# Brand

La identidad del producto Apostrophe: la Yerba mark, el Wordmark, la tipografía Geist y las Tabular figures. Es del producto, nunca de un Business: no reemplaza ni oculta el nombre ni los datos de ningún Business, así que el criterio 4 (Assume nothing) no se ve afectado. La situación principal es la vuelta diaria desde la pantalla de inicio del teléfono (Phone first); el primer encuentro mediante una Invitation viene en segundo lugar.

## Yerba mark

- Su única fuente es `web/public/icons/mark.svg`, un SVG versionado: un cuadrado redondeado #1E6B47 con el apóstrofo en blanco. Es igual en tema claro y oscuro.
- De ese archivo derivan la marca del encabezado, el favicon y cada ícono PNG. `BrandMark` lo carga como imagen (`<img src="/icons/mark.svg">`) y nunca copia su markup dentro de `web/src`.
- `scripts/design/icons.mjs` renderiza con Playwright, sin red, cargando `mark.svg` como imagen sin editar su markup:
  - `icon-192.png` e `icon-512.png`: el cuadrado redondeado sobre transparencia;
  - `icon-maskable-512.png`: #1E6B47 a sangre, con el apóstrofo dentro de la zona segura del 80 %;
  - `apple-touch-icon.png` (180): a sangre y opaco, con la misma zona segura.
- El mismo script escribe `web/public/icons/icons.json` con el SHA-256 de `mark.svg` y el nombre y el tamaño de cada salida. No guarda hashes de los PNG.
- Favicon: `<link rel="icon" type="image/svg+xml" href="/icons/mark.svg">` en `web/index.html`, con `icon-192.png` como alternativa; el link de `apple-touch-icon` se conserva.
- El manifest lista los cuatro PNG: 192 y 512 con `purpose: "any"`, el maskable de 512 con `purpose: "maskable"` (el único) y el apple-touch de 180 con `purpose: "any"`.
- El `id`, el `name` y el `short_name` del manifest nunca cambian. La app instalada sigue siendo la misma app y nadie la reinstala.
- El producto promete lo que la app entrega. Cuándo un teléfono refresca un ícono que tiene en caché lo decide el teléfono, y la app no muestra ningún aviso para volver a agregarla a la pantalla de inicio.

## Wordmark

- "apostrophe" en minúscula, Geist 600, con el ’ (U+2019) en `--acento` (#1E6B47 en claro, #5CC594 en oscuro).
- La Yerba mark junto al Wordmark (el lockup) es una sola imagen con el nombre accesible "apostrophe": la Yerba mark adentro es decorativa y el ’ es `aria-hidden`.
- Sus textos viven en el Copy module (`brand.wordmark`, `brand.mark.label`), los dos con el valor "apostrophe". El ’ no es copy: lo dibuja `BrandMark` como un carácter fijo.
- Los tamaños salen de los tokens `--marca-*`. Con 300 px de ancho o menos, el lockup pasa a sus tamaños angostos para que la acción principal no quede fuera de la pantalla.

## Dónde aparece

| Lugar | Muestra |
|---|---|
| Teléfono: encabezado de Home, en línea al comienzo de su fila actual | Solo la Yerba mark, y solo cuando el nombre del Business entra entero a su lado |
| Sign in, las dos pantallas de aceptación de Invitation (Business nuevo y sumarse a un Business), primer paso del Onboarding | Yerba mark con Wordmark, arriba |
| Barra lateral de la computadora (`InicioCompu`) | Yerba mark y Wordmark arriba, sobre "+ New sale", sin rediseño |

La marca aparece en esos lugares y en ningún otro: ni en los demás Tab roots (Sales, Customers, Varieties, More), ni en tarjetas, detalles, Sheets, los pasos del Onboarding después del primero o Reset.

**Encabezado de Home en el teléfono**

- La Yerba mark va en línea, al comienzo de la fila del nombre del Business, antes del nombre. El título y el avatar que lleva a Settings quedan donde estaban. No es más alta que esa línea, y el encabezado nunca gana altura por ella.
- Lo decide el CSS, sin medir nada: el nombre y la marca comparten una caja de una sola línea. Cuando el nombre y la marca no entran juntos, la marca pasa a la línea recortada y no se ve, así que el nombre del Business nunca pierde un carácter por la marca. Phone first gana sobre mostrar la marca.
- Mientras se ve, es `role=img` con el nombre "apostrophe". Mientras está recortada, o si el navegador no puede saber si se ve, es `aria-hidden`.
- En la computadora la marca del encabezado de Home no se muestra; ahí la marca está en la barra lateral.
- Nunca mueve ni oculta una flecha de regreso ni "Close", y las Sheets nunca la muestran.
- Tocarla no hace nada. Nombra la app y no es un control.

**Sign in, aceptación de Invitation y primer paso del Onboarding**

- Muestran la Yerba mark con el Wordmark arriba, nunca las dos formas a la vez. En Sign in reemplazan al texto "apostrophe’" anterior, en el mismo lugar.
- Las dos pantallas de aceptación de Invitation la muestran: la que abre un Business nuevo y la que suma a una persona a un Business que ya existe. También la muestra el aviso de un link de Invitation que ya no sirve. Las pantallas que solo esperan o fallan (cargando, sin conexión, error) no la muestran.
- En el Onboarding va solo en su primer paso (la Variety), el que abre un Business recién creado, cada vez que se muestra ese paso, también al retomar. Va arriba de la cabecera, y "Atrás" y "Close" siguen en su lugar. Los demás pasos no la muestran, y no hay una pantalla de bienvenida propia.

**Barra lateral de la computadora**

- La Yerba mark y el Wordmark van arriba, sobre "+ New sale". Nada más de la barra lateral se mueve ni se rediseña, y toda capacidad sigue a mano.

**Marca fija**

- La marca es fija para toda la instalación: la misma en cada Business, cada tema y cada idioma. Ninguna configuración la renombra ni la oculta, tampoco la futura Product word (GH-318) ni los Selectable languages (#317). El nombre accesible es "apostrophe" en todo idioma: el Test locale copia `brand.wordmark` y `brand.mark.label` tal cual, sin pseudolocalizarlos.
- La marca aparece solo dentro de la app, ante el vendedor y sus Users. Nunca en el Catalog, el Pinned catalog, los valores por defecto del Catalog header and footer, el Sale bill ni ningún texto de Telegram; esos valores por defecto quedan como están.

## Tipografía

- Geist es la tipografía de todas las pantallas, en pesos 400, 500, 600 y 700, mediante `@fontsource/geist`.
- Vite empaqueta los woff2, así que la app no pide nada fuera de la instalación. Si Geist no carga, se usa la alternativa `system-ui, -apple-system, sans-serif`.
- `--fuente` es `'Geist', system-ui, -apple-system, sans-serif` y coincide en `docs/product/design-system/tokens.css`, `docs/product/design-system/tokens.ts` y `web/src/styles/tokens.css`.
- La copia de docs conserva su `@import` de Google para Geist. Es documentación, y la app nunca la carga.
- En las Design captures, `scripts/design/fonts.mjs` responde el pedido de Plus Jakarta Sans de los dibujos con los archivos de Geist alojados en la instalación (ADR-0042). Por eso el lado del dibujo ya sale en Geist.
- Los dibujos de `pantallas/` no se editan. La Yerba mark y el Wordmark son las diferencias esperadas contra ellos, y no son hallazgos.
- Las Design captures cubren Sign in, las dos pantallas de aceptación de Invitation, el primer paso del Onboarding, Home en el teléfono e `InicioCompu`.

## Tabular figures

- Una sola regla de `app.css` pone `font-variant-numeric: tabular-nums` en las clases de cifra (`cifra*`) y en la clase del componente de dinero. Nunca va en `html`, `body` ni `:root`.
- Toda cifra cubierta que se dibujaba fuera de esas clases pasó a estar dentro de ellas, sin cambiar su valor, su formato ni su posición.
- Cubren:
  - dinero;
  - cantidades (gramos hoy, cualquier Unit más adelante);
  - porcentajes mostrados como cifra (Margin percentage, Average margin, Indica share);
  - Days left.
- No cubren fechas, horas, Phone numbers, conteos dentro de una oración ("3 customers", "and N g without cost") ni texto libre.
- La prueba: un número que está en una columna, en una fila de cifras o en un total que el ojo recorre hacia abajo o de costado es tabular.
- El Mobile check tiene la regla `tabular-figures`: marca todo texto visible cuyo contenido entero es una cifra (dinero, gramos, un porcentaje o Days left) y que no lleva `tabular-nums`. Los patrones viven en `web/src/mobile-standard/figures.ts`. Esa regla no tiene archivo de infractores y el cargador rechaza uno: una cifra que falla se corrige, nunca se lista.

## Teléfono y computadora

- En el teléfono cede la disposición (por ejemplo, un salto a una segunda línea). Nunca se achica una cifra ni un texto por debajo del estándar móvil.
- Ningún cambio de color, de marca o de tipografía suma infractores a las listas de `web/src/mobile-standard/offenders/*.json`. Cada uno saca, en su propio diff, las entradas que deja en verde.
- En la computadora, un cambio no puede perder una capacidad ni dejar un monto ilegible o cortado. Fuera de eso se acepta como queda, y ninguna pantalla de computadora le impone un costo al teléfono.

## Métricas

- **Identidad única.** `web/src/design/icons.test.ts` pasa:
  - los tamaños, iguales a `icons.json`;
  - alpha 0 en (0,0) en 192 y 512;
  - #1E6B47 opaco en las cuatro esquinas y blanco en el centro del maskable y del apple-touch, sin blanco fuera de la zona segura;
  - el hash de `mark.svg` igual a `icons.json`;
  - las entradas de íconos del manifest y su `purpose`.
- **Sin azul anterior.** El azul anterior no aparece en ningún token ni en ningún ícono que la app entrega.
- **Geist sin red.** El e2e no hace ningún pedido de tipografía fuera de la instalación.
- **Cifras alineadas.** La regla `tabular-figures` del Mobile check informa cero infracciones.
- **Teléfono sin problemas nuevos.** El Mobile check imprime cero infractores nuevos, las listas de infractores solo se achican, cada estado de Home o de la barra lateral muestra como mucho un elemento de marca visible, y registrar una Sale desde el teléfono sigue tomando menos de un minuto.
- **Encabezado de Home intacto.** Con un nombre de Business corto, la Yerba mark se ve con el nombre "apostrophe". Con uno que necesita todo el ancho, no se ve y es `aria-hidden`. En los dos casos el encabezado, la caja del nombre y la posición del título quedan iguales que sin la marca, sin scroll horizontal, a 320 px y a 246 px.
- **Misma app instalada.** El `id`, el `name` y el `short_name` del manifest no cambian.

## Reglas fijas

1. La Yerba mark existe como un solo SVG versionado (`web/public/icons/mark.svg`). La marca del encabezado, el favicon y cada ícono PNG derivan de él, y el `id` del manifest nunca cambia.
2. No hay colores hex literales en `web/src` fuera de los dos archivos de tokens.
3. `DESIGN_STANDARDS.md` y el README de `docs/product/design-system/` describen:
   - el logo y su única fuente SVG;
   - el Wordmark;
   - Geist y las Tabular figures.

   Los cuatro criterios del dueño no se editan.
