## Jobs

- When I write or review a text the seller reads on the phone (a button, title, toast, error, help line or notice), I want one document that gives me the limits, the voice, the words to avoid and a good and bad example for that kind of text, so I can settle it in one pass without asking the owner or comparing screens, and the seller can read it at a glance between orders, in any business and in any language.

## Qué es

Los Writing standards son las reglas de redacción del texto que la app muestra en pantalla. Su texto completo vive en `WRITING_STANDARDS.md`, en la raíz del repo, junto a `DESIGN_STANDARDS.md`. Está escrito en español rioplatense (el Documentation language). Las palabras de pantalla y los ejemplos en inglés quedan en inglés.

Lo usan quien mantiene el producto, los roles agénticos y quien revisa. Es para el vendedor, que lee ese texto en el teléfono entre pedido y pedido (criterios Phone first y Assume nothing).

Este archivo define la capacidad y no escribe ninguna de sus cifras: los tres límites nuevos tienen un solo dueño, `WRITING_STANDARDS.md`.

## Fuentes

El documento apunta a sus fuentes y no copia ninguna:

- `docs/product/icon-and-text-rule.md`: cómo se rotula cada cosa, los límites que ya existían y cómo se cuentan los caracteres.
- `docs/product/product-language.md`: el registro (inglés llano, en segunda persona, sin voseo). Su sección "Criterios de redacción" y su línea 9 remiten a `WRITING_STANDARDS.md`.
- El glosario (`CONTEXT.md`): el vocabulario, un concepto con una palabra. Donde el glosario ya muestra dos palabras para dos pantallas, quedan las dos.
- `DESIGN_STANDARDS.md`, "Assume nothing".

## Qué cubre

- **Límites de largo por tipo de texto.**
  - Botón, título de pantalla o de sección y toast tienen límites nuevos, escritos solo en `WRITING_STANDARDS.md` y controlados solo en revisión.
    - En el botón cuenta solo la etiqueta visible. Los botones de solo ícono y los nombres accesibles distintos de la etiqueta quedan afuera.
    - En el título cuentan las palabras fijas más el nombre de `SAMPLES`. Un título que solo muestra datos del vendedor queda afuera.
    - El toast es una sola oración o frase de resultado, sin punto final. Puede sumar una consecuencia unida con "·" dentro del mismo límite.
  - Las líneas de ayuda, los avisos, More info y los estados vacíos siguen los límites de `icon-and-text-rule.md`. El documento enlaza esos límites y no escribe sus cifras.
  - Los errores siguen esa misma regla: apuntan al objetivo de los rechazos, conservan la solución y, si son más largos, figuran en `LONG_REFUSALS`. Lo que la persona puede corregir nunca se corta ni va detrás de More info; solo un porqué más largo puede ir ahí.
  - Los caracteres se cuentan como lo hace `measure()`, con `SAMPLES` (`web/src/copy/limits.ts`).
  - `copyLimits.test.ts` controla los límites que ya existían. Los de botón, título y toast se controlan en revisión.
  - Los límites valen en todos los idiomas. Un texto que no entra se reescribe; el límite nunca se sube.
- **Voz en inglés.**
  - Voz activa.
  - Mayúscula solo en la primera palabra en pantalla (sentence case). Un término del glosario se escribe como su palabra `_In the app_`.
  - Sin signos de exclamación.
  - Contracciones solo en líneas de ayuda, toasts, More info y estados vacíos. Errores, avisos, botones y títulos van en la forma completa.
  - Un error nunca culpa a la persona.
  - Una confirmación (el texto que aparece después de la acción) dice el resultado. La pregunta previa y su par de respuestas siguen en `icon-and-text-rule.md`.
- **Palabras a evitar.**
  - Es una lista cerrada que se busca por palabra entera, sin distinguir mayúsculas.
  - No tiene excepciones escritas.
  - Se controla en revisión y con una búsqueda, nunca con `copyLimits.test.ts`.
  - Solo cambia por decisión del dueño.
- **Regla neutral para cualquier Business.**
  - Un texto nunca nombra un tipo de producto ni fija una unidad, una moneda o una forma de trabajar.
  - El dinero es siempre un marcador que llena el Money format.
  - Las palabras del glosario son neutrales.
  - El documento no dice que las unidades sean, ni que vayan a ser, configurables.
- **Patrones.**
  - Hay uno por tipo de texto (botón, título, línea de ayuda, toast y error), cada uno con un ejemplo bueno y uno malo en inglés.
  - Un ejemplo bueno es un texto real y ya neutral, citado carácter por carácter de `web/src/copy/`, con su pantalla nombrada, y respeta su propio límite.
  - Donde el único ejemplo real menciona gramos, el patrón usa `<quantity>` y queda marcado como patrón.
  - Un texto real que da por hecho gramos o flor aparece solo como ejemplo malo, con su pantalla nombrada.
- **Pruebas de decisión.** Cada regla que no se puede contar lleva una prueba que se corre sobre el texto solo, y quien escribe y quien revisa llegan a la misma respuesta.

## Qué no cubre

- La salida de los scripts del Operator, las líneas fijas del Catalog, el `detail` de la API y los datos del vendedor (nombres de Products y de Customers, Notes, Catalog header and footer).
- Los criterios para el español neutral, que llegan en una sección posterior (GH-786, parte 2).
- Corregir textos existentes que rompen una regla: van a #328.
- Cualquier control automático de botones, títulos, toasts o de la lista de palabras.

Nada de esta capacidad cambia lo que muestra la app.

## Métricas

| Métrica | Objetivo |
|---|---|
| Textos citados con un resultado de `grep -rF` en `web/src/copy/` (evidencia en el cuerpo del PR, no se commitea) | 100 % |
| Ejemplos buenos dentro de su propio límite, medidos con `measure()` (evidencia en el cuerpo del PR) | 100 % |
| Cifras de `icon-and-text-rule.md` o `limits.ts` repetidas en `WRITING_STANDARDS.md` | 0 |
| Reglas que no son ni una cuenta ni una prueba de decisión | 0 |
| Ejemplos buenos o reglas que nombran un tipo de producto, una unidad, una moneda o una forma de trabajar fija | 0 |
| Archivos cambiados bajo `web/`, `app/`, `tests/` o `scripts/` | 0 |
| Aprobación del dueño en el PR antes del merge | Sí |
