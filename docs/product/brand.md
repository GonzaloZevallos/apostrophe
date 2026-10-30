## Jobs

- When I reach for the app on my phone's home screen or in a browser tab, I want to spot it at once and have it look like one finished product, from the icon through Sign in to every screen, so I open it without hesitating, trust it with my customers' data and get on with recording the sale.

# Brand

La identidad del producto Apostrophe: la Yerba mark, el Wordmark, la tipografía Geist y las Tabular figures. Es del producto, nunca de un Business: no reemplaza ni oculta el nombre ni los datos de ningún Business, así que el criterio 4 (Assume nothing) no se ve afectado. La situación principal es la vuelta diaria desde la pantalla de inicio del teléfono (Phone first); el primer encuentro mediante una Invitation viene en segundo lugar.

## Yerba mark

- Su única fuente es `web/public/icons/mark.svg`, un SVG versionado: un cuadrado redondeado #1E6B47 con el apóstrofo en blanco. Es igual en tema claro y oscuro.
- De ese archivo derivan la marca del encabezado, el favicon y cada ícono PNG. `BrandMark` carga el archivo y nunca copia su markup dentro de `web/src`.
- `scripts/design/icons.mjs` renderiza con Playwright, sin red:
  - `icon-192.png` e `icon-512.png`: el cuadrado redondeado sobre transparencia;
  - `icon-maskable-512.png`: #1E6B47 a sangre, con el apóstrofo dentro de la zona segura del 80 %;
  - `apple-touch-icon.png` (180): a sangre y opaco.
- El mismo script escribe `web/public/icons/icons.json` con el SHA-256 de `mark.svg` y el tamaño de cada salida.
- Favicon: `<link rel="icon" type="image/svg+xml" href="/icons/mark.svg">` en `web/index.html`, con el PNG como alternativa.
- El `id`, el `name` y el `short_name` del manifest nunca cambian. La app instalada sigue siendo la misma app y nadie la reinstala.
- El producto promete lo que la app entrega. Cuándo un teléfono refresca un ícono que tiene en caché lo decide el teléfono, y la app no muestra ningún aviso para volver a agregarla a la pantalla de inicio.

## Wordmark

- "apostrophe" en minúscula, Geist 600, con el ’ (U+2019) en `--acento` (#1E6B47 en claro, #5CC594 en oscuro).
- Su nombre accesible es "apostrophe", con el ’ `aria-hidden`. Junto al Wordmark, la Yerba mark es decorativa.
- Sus textos viven en el Copy module (`brand.wordmark`, `brand.mark.label`).

## Dónde aparece

| Lugar | Muestra |
|---|---|
| Teléfono: encabezado de Home, en línea al comienzo de su fila actual | Solo la Yerba mark, y solo cuando el nombre del Business entra entero a su lado |
| Sign in, las dos pantallas de aceptación de Invitation (Business nuevo y sumarse a un Business), primer paso del Onboarding | Yerba mark con Wordmark, arriba |
| Barra lateral de la computadora (`InicioCompu`) | Yerba mark y Wordmark arriba, sobre "+ New sale", sin rediseño |

La marca aparece en esos lugares y en ningún otro: ni en los demás Tab roots (Sales, Customers, Varieties, More), ni en tarjetas, detalles o Sheets.

**Encabezado de Home en el teléfono**

- La Yerba mark va en línea, al comienzo de la fila del encabezado que ya existe, antes del nombre del Business y del título. No es más alta que esa fila, y el encabezado nunca gana altura por ella.
- Es `role=img` con el nombre "apostrophe".
- Se dibuja solo cuando el nombre del Business entra entero a su lado. Si el nombre se partiría, se cortaría o se achicaría, la marca no se dibuja y el encabezado queda como sin ella: Phone first gana sobre mostrar la marca, y el nombre del Business nunca pierde un carácter por la marca.
- Nunca mueve ni oculta una flecha de regreso ni "Close", y las Sheets nunca la muestran.
- Tocarla no hace nada. Nombra la app y no es un control.

**Sign in, aceptación de Invitation y primer paso del Onboarding**

- Muestran la Yerba mark con el Wordmark arriba, nunca las dos formas a la vez. En Sign in reemplazan al texto "apostrophe’" actual.
- Las dos pantallas de aceptación de Invitation la muestran: la que abre un Business nuevo y la que suma a una persona a un Business que ya existe.
- En el Onboarding va solo en su primer paso, el que abre un Business recién creado, cada vez que se muestra ese paso, también al retomar. Los demás pasos no la muestran, y no hay una pantalla de bienvenida propia.

**Barra lateral de la computadora**

- La Yerba mark y el Wordmark van arriba, sobre "+ New sale". Nada más de la barra lateral se mueve ni se rediseña.

**Marca fija**

- La marca es fija para toda la instalación: la misma en cada Business, cada tema y cada idioma. Ninguna configuración la renombra ni la oculta, tampoco la futura Product word (GH-318) ni los Selectable languages (#317). El nombre accesible es "apostrophe" en todo idioma, Test locale incluido.
- La marca aparece solo dentro de la app, ante el vendedor y sus Users. Nunca en el Catalog, el Pinned catalog, los valores por defecto del Catalog header and footer, el Sale bill ni ningún texto de Telegram; esos valores por defecto quedan como están.

## Tipografía

- Geist es la tipografía de todas las pantallas, en pesos 400, 500, 600 y 700, mediante `@fontsource/geist`.
- Vite empaqueta los woff2, así que la app no pide nada fuera de la instalación.
- `--fuente` es `'Geist', system-ui, -apple-system, sans-serif` y coincide en `docs/product/design-system/tokens.css`, `docs/product/design-system/tokens.ts` y `web/src/styles/tokens.css`.
- La copia de docs conserva su `@import` de Google para Geist. Es documentación, y la app nunca la carga.
- En las Design captures, `scripts/design/fonts.mjs` responde el pedido de Plus Jakarta Sans de los dibujos con los archivos de Geist alojados en la instalación (ADR-0042). Por eso el lado del dibujo ya sale en Geist.
- Los dibujos de `pantallas/` no se editan. La Yerba mark y el Wordmark son las diferencias esperadas contra ellos, y no son hallazgos.
- Las Design captures cubren Sign in, las dos pantallas de aceptación de Invitation, el primer paso del Onboarding, Home en el teléfono e `InicioCompu`.

## Tabular figures

- Una sola regla de `app.css` pone `font-variant-numeric: tabular-nums` en las clases de cifra (`cifra*`) y en la clase del componente de dinero. Nunca va en `body`.
- Toda cifra cubierta que se dibuje fuera de esas clases pasa a estar dentro de ellas.
- Cubren:
  - dinero;
  - cantidades (gramos hoy, cualquier Unit más adelante);
  - porcentajes mostrados como cifra (Margin percentage, Average margin, Indica share);
  - Days left.
- No cubren fechas, horas, Phone numbers, conteos dentro de una oración ("3 customers", "and N g without cost") ni texto libre.
- La prueba: un número que está en una columna, en una fila de cifras o en un total que el ojo recorre hacia abajo o de costado es tabular.
- Es un cambio solo tipográfico: ninguna cifra cambia de valor, formato ni posición.

## Teléfono y computadora

- En el teléfono cede la disposición (por ejemplo, un salto a una segunda línea). Nunca se achica una cifra ni un texto por debajo del estándar móvil.
- Ningún cambio de color, de marca o de tipografía suma infractores a las listas de `web/src/mobile-standard/offenders/*.json`. Cada uno saca, en su propio diff, las entradas que deja en verde.
- En la computadora, un cambio no puede perder una capacidad ni dejar un monto ilegible o cortado. Fuera de eso se acepta como queda, y ninguna pantalla de computadora le impone un costo al teléfono.

## Métricas

- **Identidad única.** `web/src/design/icons.test.ts` pasa:
  - los tamaños;
  - alpha 0 en (0,0) en 192 y 512;
  - #1E6B47 opaco en las esquinas y blanco en el centro del maskable y del apple-touch;
  - el hash de `mark.svg` igual a `icons.json`;
  - las entradas de íconos del manifest y su `purpose`.
- **Sin azul anterior.** El azul anterior no aparece en ningún token ni en ningún ícono que la app entrega.
- **Geist sin red.** El e2e no hace ningún pedido de tipografía fuera de la instalación.
- **Cifras alineadas.** Toda cifra cubierta lleva `tabular-nums`.
- **Teléfono sin problemas nuevos.** El Mobile check imprime cero infractores nuevos, las listas de infractores solo se achican, y registrar una Sale desde el teléfono sigue tomando menos de un minuto.
- **Encabezado de Home intacto.** Con un nombre de Business corto, la Yerba mark se muestra; con uno que necesita todo el ancho, no se dibuja. En ningún caso el encabezado gana altura ni el nombre se corta.
- **Misma app instalada.** El `id`, el `name` y el `short_name` del manifest no cambian.

## Reglas fijas

1. La Yerba mark existe como un solo SVG versionado (`web/public/icons/mark.svg`). La marca del encabezado, el favicon y cada ícono PNG derivan de él, y el `id` del manifest nunca cambia.
2. No hay colores hex literales en `web/src` fuera de los dos archivos de tokens.
3. `DESIGN_STANDARDS.md` y el README de `docs/product/design-system/` describen:
   - el logo y su única fuente SVG;
   - el Wordmark;
   - Geist y las Tabular figures.

   Los cuatro criterios del dueño no se editan.
