# Sistema de diseño · apostrophe

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
| `tokens.css` | Los mismos valores como variables CSS. Sin atributo en `<html>` el tema es el de luz (Papel y azul); `data-tema="oscuro"` lo pasa a oscuro. El sistema operativo no elige el tema. |
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
[`muestra.md`](muestra.md), la única fuente: ninguna pantalla inventa un número propio.

## Dirección de diseño

Minimalista y fino, paleta **Papel y azul**: fondo cálido, tinta marrón-negra y
un solo azul usado con cuentagotas.

- **La jerarquía la hace el tamaño, no el peso.** Rótulo de 14 en gris sobre
  cifra de 54. Nada de versalitas con tracking.
- **Líneas finas antes que tarjetas.** Sin sombras, sin bordes en los paneles.
- **Un solo color de acento**, y sólo para acción, enlace y ganancia.
- Rótulos en minúscula, escritos como frases ("Vendiste esta semana").
- Castellano rioplatense con vos: Cargá, Guardá, Te debe, Elegí.

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
  Una regla de `app.css` que lo usa declara también ese fondo, salvo los selectores
  de la última columna, que dibujan sobre el fondo de su contenedor.
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
| `--boton-texto` | par | `--boton` | 15,97 | 15,80 | `.toast__texto`, `.venta-guardada__deshacer` |
| `--critico-texto` | par | `--critico` | 12,59 | 11,13 |  |
| `--nav-inactivo` | par | `--papel` | 4,69 | 4,97 | `.bar-inferior__item` |
| `--tenue` | ícono | — | — | — | `.mas__item-flecha`, `.fila-venta > svg` |
<!-- contraste:fin -->

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
