# Iniciales

## Jobs

- Cuando varios Users trabajan en el mismo Business y miro lo que se registró, quiero una marca corta y estable de quién registró cada cosa, para saber de un vistazo de quién es sin abrirla, sea como sea su nombre o su email.

## Qué es

Una sola regla que convierte un nombre en sus iniciales, escrita dos veces, en TypeScript (`web/src/format/initials.ts`, `initialsOf`) y en Python (`app/accounts/domain/recorder.py`, `initials_of`), y mantenida igual por un único fixture compartido, `web/src/format/initials.cases.json`. Qué pantallas y qué registros muestran la marca de quien registró lo deciden otras partes de GH-1057; en esta parte no se expone ningún campo nuevo en la API ni en pantalla.

## Regla de palabras

- Las palabras se separan por tramos de espacio en blanco, exactamente el conjunto `\s` de JavaScript: tab, LF, VT, FF, CR, espacio, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, U+3000 y U+FEFF. Las palabras vacías se descartan. En Python nunca se usa `str.split()`.
- Dos o más palabras dan el primer cluster de cada una de las dos primeras.
- Una sola palabra da sus dos primeros clusters.
- Ninguna palabra da `''`.

## Clusters

- En el front, cada grafema de `Intl.Segmenter` se pasa a mayúsculas y se corta a sus primeros 16 code points: `Array.from(segment.toUpperCase()).slice(0, 16).join('')`.
- En el back, solo con la biblioteca estándar: un code point se une al anterior cuando es de categoría Mn, Mc o Me, o es U+200C, FE00–FE0F, 1F3FB–1F3FF o E0020–E007F; un ZWJ se une junto con el code point que lo sigue; los indicadores regionales van de a pares; las secuencias Hangul L/V/T/LV/LVT se unen por rangos de code points. Cada cluster se pasa a mayúsculas y después se corta a 16 code points.
- Los caracteres Prepend y los conjuntos índicos no se tratan: es una limitación aceptada que da una división menos exacta, nunca una marca vacía ni demasiado larga.
- El paso a mayúsculas sigue Unicode para cualquier idioma: `ß` da `SS`, así que `ßeta` da `SSE` y `ßa` da `SSA`.

## Marca de quien registró

- `name_of(email: Email)` da la parte local del email.
- `FALLBACK_INITIALS = "?"`.
- `recorder_initials(email)` da `initials_of(name_of(email))`, o `?` cuando eso da `''` (por ejemplo, una parte local hecha solo de U+FEFF).
- Nunca es vacía y nunca supera 32 code points para ningún email que `Email` acepte.
- Sale solo de la parte local del email del propio User, así que no revela nada de ningún otro Business.

## Qué cambia en pantalla

Las iniciales que el front ya dibuja se ven igual que antes para todo nombre común (`zeta` → `ZE`, `la huerta` → `LH`, `a` → `A`). El único cambio es que un cluster de más de 16 code points (un nombre estilo Zalgo) muestra sus primeros 16. No hay texto nuevo.

## Fixture compartido

`web/src/format/initials.cases.json` es un arreglo de `{name, initials}`, con sangría de dos espacios y salto de línea final, con los code points invisibles y combinantes escritos como escapes `\uXXXX` y sin surrogates sueltos. Cubre como mínimo: `zeta`, `a`, `la huerta`; una bandera seguida de `ana`; una marca combinante, un emoji con tono de piel y una familia con ZWJ; `a` con 16 y con 40 marcas combinantes, cortadas a 16 code points, y dos palabras así; `ßeta` → `SSE` y `ß` → `SS`; U+FEFF antes de `zeta` → `ZE` y U+FEFF solo → `''`; dos palabras separadas por U+0085; un keycap, un ZWNJ dentro de una palabra, una secuencia de jamo Hangul L+V+T y una consonante devanagari con un signo vocálico Mc; U+200B → U+200B; blancos → `''`. Si una fila y la regla difieren, gana la regla.

## Tests

- Vitest (`initials.test.ts`): importa el JSON tipado como `readonly InitialsCase[]`, sin `any`, y para cada fila verifica que no haya surrogates sueltos, que las iniciales tengan como máximo 32 code points y que `initialsOf(name)` las dé.
- Pytest (`tests/accounts/test_initials_cases.py`): lee el fixture con la constante `Path(__file__).resolve().parents[2] / 'web/src/format/initials.cases.json'`, para que un cambio del fixture seleccione pytest en el CI, y para cada fila verifica que el nombre se codifique en UTF-8, el máximo de 32 code points y que `initials_of` coincida.
- Pytest (`tests/accounts/test_recorder.py`): `name_of`; U+FEFF y U+FEFF dos veces dan `?`; emails válidos pero raros (`.@x.co`, una marca combinante sola, una parte local de 60 caracteres de emoji, `a` con 40 marcas) dan un resultado no vacío de hasta 32 code points, igual al fallback o a `initials_of` de la parte local; y las filas más largas del fixture.

## Métricas

- Filas del fixture que difieren entre Python y TypeScript: 0 (cada fila pasa en vitest y en pytest).
- Marcas de quien registró vacías o de más de 32 code points, para cualquier email que `Email` acepte: 0.
- Filas existentes de `test.each` del front que cambian: 0.
- Un cambio en `web/src/format/initials.cases.json` selecciona pytest y vitest en el CI: siempre.
