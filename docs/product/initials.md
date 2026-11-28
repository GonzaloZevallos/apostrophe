# Iniciales

## Jobs

- Cuando varios Users trabajan en el mismo Business y miro lo que se registró, quiero una marca corta y estable de quién registró cada cosa, para saber de un vistazo de quién es sin abrirla, sea como sea su nombre o su email.
- Cuando una socia y yo registramos Payments para los mismos Customers, quiero que cada Payment muestre quién lo registró y cuándo, para poder confiar en la cuenta y aclarar cualquier diferencia con un Customer o con mi socia. (Parte 3 de GH-1106: acá lo sirven el `Recorder`, la dependencia `CurrentRecorder`, la marca de quien registró y el ADR que decide cómo se guarda; ningún router la usa todavía y ninguna pantalla la muestra hasta partes posteriores de GH-1057. Hoy el vendedor le pregunta a la socia por mensaje o confía en su memoria: ni la planilla ni la app registran quién cargó un Payment.)

## Qué es

Una sola regla que convierte un nombre en sus iniciales, escrita dos veces, en TypeScript (`web/src/format/initials.ts`, `initialsOf`) y en Python (`app/accounts/domain/recorder.py`, `initials_of`), y mantenida igual por un único fixture compartido, `web/src/format/initials.cases.json`. Las dos versiones dan lo mismo en cada fila del fixture; fuera de él pueden diferir solo en las limitaciones aceptadas (ver Clusters), y aun así las dos dan una marca no vacía de hasta 32 code points. Sobre esa regla, el servidor arma la marca de quien registró, con su propio fallback, y el `Recorder` que la lleva junto con el User. Qué pantallas y qué registros muestran esa marca lo deciden otras partes de GH-1057; hasta entonces no se expone ningún campo nuevo en la API ni en pantalla.

## Regla de palabras

- Las palabras se separan por tramos de espacio en blanco, exactamente el conjunto `\s` de JavaScript: tab, LF, VT, FF, CR, espacio, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, U+3000 y U+FEFF. Las palabras vacías se descartan. En Python nunca se usa `str.split()`.
- Dos o más palabras dan el primer cluster de cada una de las dos primeras.
- Una sola palabra da sus dos primeros clusters.
- Ninguna palabra da `''`.
- Un carácter invisible que no está en `\s` (como U+200B) cuenta como palabra para esta regla: U+200B solo da U+200B.

## Clusters

- En el front, cada grafema de `Intl.Segmenter` se pasa a mayúsculas y se corta a sus primeros 16 code points: `Array.from(segment.toUpperCase()).slice(0, 16).join('')`.
- En el back, solo con la biblioteca estándar: un code point se une al anterior cuando es de categoría Mn, Mc o Me, o es U+200C, FE00–FE0F, 1F3FB–1F3FF o E0020–E007F; un ZWJ se une junto con el code point que lo sigue; los indicadores regionales van de a pares; las secuencias Hangul L/V/T/LV/LVT se unen por rangos de code points. Cada cluster se pasa a mayúsculas y después se corta a 16 code points.
- Los clusters de Python siguen UAX #29 salvo por los caracteres Prepend y los conjuntos índicos, un hueco con nombre.
- Limitaciones aceptadas del back frente al front, que nunca son hallazgos: los caracteres Prepend; los conjuntos índicos; un ZWJ entre letras comunes (`a` + ZWJ + `bc` da un primer cluster más largo en el servidor que en el teléfono); y los caracteres cuyas propiedades Unicode cambiaron entre la versión de `unicodedata` y la de `Intl.Segmenter`. Dan una división menos exacta, nunca una marca vacía ni de más de 32 code points, y ninguna fila del fixture cae en ellas.
- El paso a mayúsculas sigue Unicode para cualquier idioma: `ß` da `SS`, así que `ßeta` da `SSE` y `ßa` da `SSA`.

## Marca de quien registró

- `name_of(email: Email)` da la parte local del email.
- `FALLBACK_INITIALS = "?"`.
- `recorder_initials(email)` da `initials_of(name_of(email))`, o `?` solo cuando eso da `''`. Entre los emails que `Email` acepta, eso pasa solo con una parte local hecha únicamente de U+FEFF.
- Un nombre hecho solo de code points invisibles que no son espacio en blanco (por ejemplo U+200B) conserva sus iniciales invisibles: la marca es un dato guardado y nunca se reescribe según una suposición sobre qué se ve. Las iniciales que el front dibuja para ese nombre ya se veían en blanco antes de esta parte.
- Nunca es vacía y nunca supera 32 code points para ningún email que `Email` acepte.
- Sale solo de la parte local del email del propio User, así que no revela nada de ningún otro Business.

## Recorder y CurrentRecorder

- `Recorder` (`app/shared/recorder.py`) es una dataclass congelada de `app_user_id: int` e `initials: str`. Su `__post_init__` lanza `InvalidRecorder` (un `ValueError`) salvo que el id sea positivo y las iniciales no estén vacías y tengan como máximo 32 code points. El mensaje nombra solo la regla, sin el id ni las iniciales.
- `current_recorder(session: CurrentSession) -> Recorder` (`app/accounts/adapters/deps.py`) afirma `user.id is not None`, con el mismo patrón que `SignedIn.business_id`, y devuelve `Recorder(user.id, recorder_initials(user.email))`. Nunca lanza para ningún email que `Email` acepte.
- `CurrentRecorder = Annotated[Recorder, Depends(current_recorder)]`. Ningún router lo usa todavía: lo usan partes posteriores de GH-1057.

## Quién registró un Payment (decidido en el ADR, lo construyen partes posteriores de GH-1057)

Lo decide el ADR [20261125-un-payment-guarda-las-iniciales-de-quien-lo-registro-copiadas-al-registrarlo](../adr/20261125-un-payment-guarda-las-iniciales-de-quien-lo-registro-copiadas-al-registrarlo.md), que no reemplaza ningún ADR y cita el ADR 20261120. Nada de esto está todavía en la base ni en la API.

- Las iniciales se copian al registrar el Payment, con la regla de esta página, y quedan como dato guardado.
- La clave foránea al User se anula sola (SET NULL) cuando el User se va, y las iniciales quedan. Toda futura eliminación de un User debe conservarlas.
- El nombre de quien registró se lee en el momento, filtrado por el Business, y es null una vez que el User ya no está.
- Las iniciales, nunca la clave foránea, deciden si se contestan `recorded_by` y `recorded_at`. `recorded_at` sigue siendo el único reloj.
- Los Payments que ya existían no reciben un registrador inventado: no muestran ninguno.
- El Business export lleva las iniciales como dato guardado y a quien registró por su email; los Payments que ya existían exportan los dos como null.
- El esquema no ata a quien registró con el Business del Payment. La garantía es el camino de escritura (siempre el User de la propia Session) más la lectura filtrada; una fila cruzada entre Businesses hace que el Business export de ese Business se niegue antes de borrar nada.
- Ningún User, link ni export muestra nunca a quien registró desde otro Business.

## Qué cambia en pantalla

Las iniciales que el front ya dibuja se ven igual que antes para todo nombre común (`zeta` → `ZE`, `la huerta` → `LH`, `a` → `A`). El único cambio, entregado en #1111, es que un cluster de más de 16 code points (un nombre estilo Zalgo) muestra sus primeros 16 también en el avatar. No hay texto nuevo. La parte 3 de GH-1106 no cambia ninguna pantalla.

## Fixture compartido

`web/src/format/initials.cases.json` es un arreglo de `{name, initials}`, con sangría de dos espacios y salto de línea final, con los code points invisibles y combinantes escritos como escapes `\uXXXX` y sin surrogates sueltos. Describe la regla de iniciales, no la marca de quien registró. Cubre como mínimo: `zeta`, `a`, `la huerta`; una bandera seguida de `ana`; una marca combinante, un emoji con tono de piel y una familia con ZWJ (el ZWJ entre emojis); `a` con 16 y con 40 marcas combinantes, cortadas a 16 code points, y dos palabras así; `ßeta` → `SSE` y `ß` → `SS`; U+FEFF antes de `zeta` → `ZE` y U+FEFF solo → `''`; dos palabras separadas por U+0085; un keycap, un ZWNJ dentro de una palabra, una secuencia de jamo Hangul L+V+T y una consonante devanagari con un signo vocálico Mc; U+200B → U+200B; blancos → `''`. Si una fila y la regla difieren, gana la regla.

## Tests

- Vitest (`initials.test.ts`): importa el JSON tipado como `readonly InitialsCase[]`, sin `any`, y para cada fila verifica que no haya surrogates sueltos, que las iniciales tengan como máximo 32 code points y que `initialsOf(name)` las dé.
- Pytest (`tests/accounts/test_initials_cases.py`): lee el fixture con la constante `Path(__file__).resolve().parents[2] / 'web/src/format/initials.cases.json'`, para que un cambio del fixture seleccione pytest en el CI, y para cada fila verifica que el nombre se codifique en UTF-8, el máximo de 32 code points y que `initials_of` coincida.
- Pytest (`tests/accounts/test_recorder.py`): `name_of`; U+FEFF y U+FEFF dos veces dan `?`; U+200B da U+200B, nunca `?`; emails válidos pero raros (`.@x.co`, una marca combinante sola, una parte local de 60 caracteres de emoji, `a` con 40 marcas) dan un resultado no vacío de hasta 32 code points, igual al fallback o a `initials_of` de la parte local; y las filas más largas del fixture.
- Pytest (`tests/shared/test_recorder.py`): un `Recorder` válido; id 0 o negativo rechazado; iniciales vacías rechazadas; 33 code points rechazados; 32 aceptados.
- Pytest (`tests/accounts/test_current_recorder.py`): llama a `current_recorder` directamente con un `SignedIn` armado con valores de dominio, para emails válidos pero raros (una parte local de U+FEFF da `?`, `.@x.co`, una marca combinante sola, una parte local de 60 caracteres de emoji).

## Métricas

- Filas del fixture que difieren entre Python y TypeScript: 0 (cada fila pasa en vitest y en pytest).
- Marcas de quien registró vacías o de más de 32 code points, para cualquier email que `Email` acepte: 0.
- Emails que `Email` acepta para los que `current_recorder` lanza: 0.
- Filas existentes de `test.each` del front que cambian: 0.
- Un cambio en `web/src/format/initials.cases.json` selecciona pytest y vitest en el CI: siempre.
- Cuando partes posteriores de GH-1057 guarden a quien registró: Payments nuevos sin iniciales, 0; iniciales que cambian al eliminar o renombrar a su User, 0; Payments anteriores con un registrador inventado, 0; registradores de otro Business visibles en una cuenta, un link o un export, 0.
