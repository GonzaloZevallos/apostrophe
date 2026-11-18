# Writing standards

Las reglas de redacción del texto que la app muestra en pantalla: cuánto puede medir cada tipo de texto, cómo suena en inglés, qué palabras se evitan, qué no puede dar por hecho un texto y cómo se ve un buen texto de cada tipo. Está escrito en español rioplatense (el **Documentation language**); las palabras de pantalla y los ejemplos en inglés quedan en inglés. Los ejemplos de la sección "Español neutro" son texto de producto en español neutro, escrito con tú. La capacidad que lo define, y que manda sobre el sentido de este archivo, es `docs/product/writing-standards.md`.

Lo usan quien mantiene el producto, los roles agénticos y quien revisa, para decidir un texto en una sola pasada. Es para el vendedor, que lo lee en el teléfono entre pedido y pedido.

## Fuentes

Este documento apunta a sus fuentes y no copia ninguna. Si una fuente cambia, cambia ahí y no acá.

- **Cómo se rotula cada cosa, los límites que ya existían y cómo se cuentan los caracteres**: [`docs/product/icon-and-text-rule.md`](docs/product/icon-and-text-rule.md), secciones "Largo del texto siempre visible" y "More info".
- **El registro** (inglés llano, en segunda persona, sin voseo): [`docs/product/product-language.md`](docs/product/product-language.md).
- **El vocabulario** (un concepto, una palabra): el glosario, [`CONTEXT.md`](CONTEXT.md), con la palabra `_In the app_` de cada término. Donde el glosario ya muestra dos palabras para dos pantallas, quedan las dos.
- **Assume nothing**: [`DESIGN_STANDARDS.md`](DESIGN_STANDARDS.md), sección "Assume nothing".

## Alcance

- **Cubre** todo el texto que se muestra en pantalla, incluidos los mensajes de la API cuando se muestran.
- Los nombres accesibles siguen las reglas de voz y la lista de palabras a evitar, pero no el sentence case.
- Los límites valen solo para el texto visible.
- **No cubre** la salida de los scripts del Operator, las líneas fijas del Catalog, el `detail` de la API ni los datos del vendedor (nombres de Products y de Customers, Notes, el Catalog header and footer).

## Límites de largo por tipo de texto

Solo tres límites se escriben acá como números. Cada uno tiene un único dueño: este archivo.

| Tipo | Límite | Qué cuenta |
|---|---|---|
| Botón | Como máximo 20 caracteres y 3 palabras | Solo la etiqueta visible. Un botón de solo ícono y un nombre accesible distinto de la etiqueta quedan afuera. |
| Título (de pantalla o de sección) | Como máximo 30 caracteres | Los títulos que escribe el producto, con sus palabras fijas más el nombre de `SAMPLES`. Un título que solo muestra datos del vendedor, como el nombre de un Product, queda afuera. |
| Toast | Una oración o una frase de resultado, como máximo 60 caracteres, sin punto final | Una consecuencia puede seguir después de "·" dentro de los mismos 60. Dos oraciones completas no pasan. |

Para los demás tipos no se escribe ninguna cifra; se enlaza a la regla que las tiene:

- **Líneas de ayuda y avisos**: una oración, con el límite de "Largo del texto siempre visible" en [`docs/product/icon-and-text-rule.md`](docs/product/icon-and-text-rule.md).
- **More info**: el límite y lo que puede guardar están en la sección "More info" de [`docs/product/icon-and-text-rule.md`](docs/product/icon-and-text-rule.md).
- **Estados vacíos**: el título y la línea tienen su límite en "Largo del texto siempre visible" de ese mismo archivo.
- **Errores**: siguen esa misma regla. Apuntan al objetivo de los rechazos (`REFUSAL_AIM` en [`web/src/copy/limits.ts`](web/src/copy/limits.ts)), conservan la solución y, si son más largos, figuran en `LONG_REFUSALS`. Lo que la persona puede corregir nunca se corta ni va detrás de More info. Solo un porqué más largo puede ir ahí.

**Cómo se cuentan los caracteres.** Como los cuenta `measure()`, con los placeholders llenos con `SAMPLES`, los dos en [`web/src/copy/limits.ts`](web/src/copy/limits.ts). Este documento no repite el método ni ningún valor de `SAMPLES`.

**Qué controla cada límite.**

- [`web/src/copy/copyLimits.test.ts`](web/src/copy/copyLimits.test.ts) controla las líneas de ayuda, los avisos, More info, el título y la línea de un estado vacío, el objetivo de los rechazos y la lista `LONG_REFUSALS`.
- Se controlan solo en revisión: los tres límites nuevos (botón, título y toast), la voz, la lista de palabras a evitar y las tres reglas del español neutro (tú, infinitivo en los botones, sin regionalismos).

**En todos los idiomas.** Los límites valen en cada idioma. Un texto que no entra se reescribe; el límite nunca se sube.

**Textos existentes.** Los que rompen un límite o una regla de este documento van a #328. Este documento no los arregla.

## Voz en inglés

Cada regla que no se puede contar lleva una prueba que se corre sobre el texto solo. Quien escribe y quien revisa tienen que llegar a la misma respuesta.

Cada ejemplo lleva una marca: **real** (citado carácter por carácter de `web/src/copy/`, con su pantalla), **escrito para el documento** (un mal ejemplo inventado para mostrar la regla) o **patrón** (una forma con un marcador, no un texto real). Hay una cuarta marca, que llevan todos los ejemplos en español, buenos o malos, y ningún otro: `Texto de producto en español, todavía no está en la app`.

### Voz activa

**Prueba:** ¿quién es el sujeto de la oración? Pasa si el sujeto es la cosa o la persona que actúa; falla si lo que actúa aparece solo como agente de un "was" o un "is used by".

- Bien (real, ayuda de Price history): "Each sale uses the price in force that day, even if you change it later."
- Mal (escrito para el documento): "The price is used by each sale, even if it is changed later."

### Sentence case

En pantalla se escribe con mayúscula solo la primera palabra. Una mayúscula dentro de una oración pasa únicamente en uno de estos casos:

- **(a)** un nombre propio o un handle: Telegram, @BotFather.
- **(b1)** una etiqueta que la persona puede encontrar en pantalla con exactamente ese texto conserva sus mayúsculas: "Look for it in Archived".
- **(b2)** la misma palabra, cuando nombra la cosa y no la etiqueta, va en minúscula: "archived product", "payment methods", "test it again".
- **(c)** el control de otro sistema, nombrado como ese control: "tap Start".

**Prueba:** ¿la persona puede tocar o encontrar algo rotulado exactamente así? Si sí, va como está rotulado; si no, va en minúscula. Una palabra del glosario sigue la misma prueba, no una regla aparte.

- Bien (real, error de Rename product): "That name belongs to an archived product. Look for it in Archived." Aplica (b2) a "archived product" y (b1) a "Archived", que es el título de una pantalla.
- Bien (real, error de Test it): "Open your bot in Telegram and tap Start, then test it again." Aplica (a) a "Telegram", (c) a "Start" y (b2) a "test it".
- Mal (escrito para el documento): "Copy The Token Again". Capitaliza cada palabra y ninguna es una etiqueta.
- Mal (escrito para el documento): "Look for it in archived". Nombra una etiqueta que existe en pantalla y la escribe en minúscula.

Los nombres accesibles quedan afuera de esta regla.

### Sin signos de exclamación

**Prueba:** ¿el texto tiene un "!"? Si lo tiene, se reescribe. No hay excepciones.

### Contracciones

Una contracción es una de estas terminaciones: `n't`, `'re`, `'ll`, `'ve`, `'d`, `'m`, o `'s` cuando significa "is" o "has". Un posesivo no es una contracción.

- Se permiten solo en líneas de ayuda, toasts, More info y estados vacíos.
- Un error, un aviso, un botón o un título va en la forma completa.

**Prueba:** ¿el texto es una de esas cuatro clases? Si no lo es, ¿alguna palabra del texto termina con una de esas terminaciones? Esa palabra se expande a la forma completa; si el resultado dice lo mismo, era una contracción y se escribe completa. Si el `'s` solo marca de quién es algo, no hay nada que expandir.

- Bien (real, error de Find my chat): "We cannot read your bot's messages: find your number with @userinfobot, type it." El `'s` de "bot's" es un posesivo, no una contracción.
- Mal (real, error del idioma en Settings → Business, va a #328): "That language isn't available for your business." `isn't` es una contracción en un error.

### Un error nunca culpa a la persona

**Prueba:** ¿"you" es la causa de lo que falló? Se mira el sujeto de la primera oración: si es "you", o si la oración dice que la persona hizo algo mal, se reescribe con lo que falló como sujeto.

- Bien (real): "That name belongs to an archived product. Look for it in Archived." El sujeto es "That name".
- Mal (escrito para el documento): "You entered a name that is already taken."

### Una confirmación dice el resultado

Una confirmación es el texto que aparece después de la acción: el toast o una línea de "hecho" en la pantalla. La pregunta que se hace antes de la acción, y su par de respuestas, no son una confirmación: siguen en [`docs/product/icon-and-text-rule.md`](docs/product/icon-and-text-rule.md).

**Prueba:** ¿dice un resultado o describe una acción? Pasa solo el resultado.

- Bien (real, toast al borrar una venta): "Sale deleted"
- Bien (real, línea de "hecho" de Sale detail): "Sale saved"
- Mal (escrito para el documento): "You saved the sale". Describe una acción y el sujeto es la persona.

## Palabras a evitar

Es una lista cerrada: Oops, Please, successfully, simply, just, Invalid, error code, null.

- Se busca por palabra entera, sin distinguir mayúsculas. "error code" se busca como frase.
- No tiene excepciones escritas. Un acierto con un sentido legítimo igual se reescribe.
- Se controla en revisión y con una búsqueda. Nunca la controla `copyLimits.test.ts`.
- La lista cambia solo por decisión del dueño.

**Prueba para un caso nuevo:** ¿la palabra agrega algo que la oración no tiene, o suaviza, culpa o rellena? Si no agrega nada, se saca.

- Mal (escrito para el documento): "Oops, the token is invalid. Please try again." Tiene tres palabras de la lista y un "Please" que solo suaviza.

## Regla neutral para cualquier Business

Un texto nunca nombra un tipo de producto, y nunca fija una unidad, una moneda o una forma de trabajar de un Business en particular. El punto de partida es "Assume nothing" en [`DESIGN_STANDARDS.md`](DESIGN_STANDARDS.md).

- **El dinero** es siempre un marcador que llena el Money format. Un texto nunca tiene un símbolo, el nombre de una moneda ni una cantidad fija de decimales.
- **Las palabras del glosario** son neutrales, así que se pueden usar.

**Prueba:** cambiá en el texto el tipo de producto, la unidad, la moneda y la forma de cobrar por otros. Si hay que cambiar una palabra para que siga siendo cierto, el texto está dando algo por hecho y se reescribe.

- Mal (real, toast al deshacer en Sales, va a #328): "Sale deleted · the grams go back to stock". Nombra una unidad.

## Patrones

Hay uno por tipo de texto. Cada uno tiene su forma, un ejemplo bueno y uno malo. En los patrones en inglés, un ejemplo bueno es un texto real, citado carácter por carácter de `web/src/copy/`, con su pantalla; respeta su propio límite. Los patrones en español no tienen texto real hasta #317. Los avisos, More info y los estados vacíos no son patrones: siguen [`docs/product/icon-and-text-rule.md`](docs/product/icon-and-text-rule.md).

### Botón

**Forma:** un verbo en imperativo, solo o con su objeto. Sin artículo ni relleno.

- Bien (real, la fila de un deudor en Customers y en Home): "Collect"
- Mal (escrito para el documento): "Collect the payment now". Es más largo que el límite de botón en caracteres y en palabras, y "now" no agrega nada.

### Título

**Forma:** una frase nominal en sentence case, sin punto, que nombra la pantalla o la sección.

- Bien (real, título de Settings → Payment methods → Archived): "Archived payment methods"
- Mal (escrito para el documento): "Look At Your Archived Payment Methods Here". Capitaliza cada palabra y pasa el límite de título.

### Línea de ayuda

**Forma:** una oración en voz activa que dice cómo funciona o por qué, con la cosa como sujeto. Admite contracciones. No lleva una consecuencia que la persona no esperaría ni la solución de un rechazo: esas siguen las reglas de [`docs/product/icon-and-text-rule.md`](docs/product/icon-and-text-rule.md).

- Bien (real, ayuda de Price history en un Product): "Each sale uses the price in force that day, even if you change it later."
- Mal (escrito para el documento): "The price is used by each sale, even if it is changed later." Está en voz pasiva.

### Toast

**Forma:** el resultado, sin punto final. Una consecuencia puede seguir después de "·" dentro del mismo límite.

- Bien (real, toast al borrar una venta en Sale detail): "Sale deleted"
- Patrón con consecuencia (no es un texto real): `<result> · <quantity> back in stock`. El único texto real con consecuencia nombra una unidad, y por eso va como mal ejemplo.
- Mal (real, va a #328): "Sale deleted · the grams go back to stock". Nombra una unidad.
- Mal (escrito para el documento): "You deleted the sale". Describe una acción, no un resultado.

### Error

**Forma:** primero lo que está mal o lo que no pasó, y después qué hacer. El sujeto es lo que falló, nunca la persona. Cuando no hay nada que la persona pueda arreglar, el error dice qué es cierto sobre los datos y ofrece reintentar. Conserva la solución aunque se pase del objetivo; en ese caso figura en `LONG_REFUSALS`.

- Bien (real, error de Rename product): "That name belongs to an archived product. Look for it in Archived."
- Mal (real, error del idioma en Settings → Business, va a #328): "That language isn't available for your business." Tiene una contracción.
- Mal (escrito para el documento): "You entered an invalid name." Culpa a la persona y usa una palabra de la lista.

## Español neutro

Ningún ejemplo de esta sección fija una palabra de pantalla en español: esas palabras las decide #317, una palabra por concepto, y cada ejemplo lleva la marca de que todavía no está en la app.

**Criterios.** Los tres valen para todo el texto de producto en español.

- **Tú en los mensajes.** El texto le habla a la persona de tú.
- **Infinitivo en los botones.** La etiqueta es un verbo en infinitivo.
- **Sin regionalismos.** Ni voseo ni jerga local.

**Largo.** Los límites son los mismos que en inglés: están en la tabla de "Límites de largo por tipo de texto" y en "En todos los idiomas". Acá no se escribe ninguna cifra. Un texto en español que no entra se reescribe; el límite no se sube.

**Qué muestran los ejemplos.** Solo la forma: persona, modo y largo. Sus verbos salen de un conjunto cerrado (guardar, cancelar, intentar y poder) y no fijan ninguna palabra de pantalla.

**Línea de ayuda.** En español la línea de ayuda mantiene la cosa como sujeto, acá con la forma con "se". Esa es la forma española de "la cosa como sujeto", así que la prueba de voz activa del inglés no se le aplica.

### Pruebas de decisión

- **Voseo.** Reescribí cada verbo en tú, en el mismo tiempo y modo (presente, subjuntivo e imperativo). Si la forma en tú difiere de la escrita, es voseo. Pasan porque son iguales en los dos sistemas: *estás*, el futuro (*podrás*) y las palabras que no son verbos, como *más*, *además*, *después* y *café*.
- **Palabras a evitar.** Buscá en las líneas `_Avoid_` de [`CONTEXT.md`](CONTEXT.md), tal como están hoy, por palabra entera y sin distinguir mayúsculas. Las palabras no se copian en esta sección.
- **Jerga.** Es la única prueba que necesita una fuente externa: el DLE. Cuenta una marca que nombra un solo país. Una marca regional (Am.) no cuenta, salvo que el dueño decida otra cosa. Un caso que la prueba resuelve mal va a una decisión del dueño.
- **Botón.** ¿La etiqueta es un verbo en infinitivo? Se mira como verbo, no solo por la terminación.

Estas pruebas cambian solo por decisión del dueño.

### Ejemplos

Cada ejemplo va en su propio bloque, debajo de una línea con "Bien" o "Mal" y la marca. Una línea "Mal" nombra también la única prueba que falla.

#### Botón

Bien. Texto de producto en español, todavía no está en la app

```
Guardar
```

Bien. Texto de producto en español, todavía no está en la app

```
Cancelar
```

Mal (falla la prueba del botón: no es un infinitivo). Texto de producto en español, todavía no está en la app

```
Guarda
```

#### Título

Bien. Texto de producto en español, todavía no está en la app

```
Últimos cambios
```

Mal (falla el sentence case). Texto de producto en español, todavía no está en la app

```
Últimos Cambios
```

#### Línea de ayuda

Bien. Texto de producto en español, todavía no está en la app

```
Cada cambio se guarda aunque canceles después.
```

Mal (falla la prueba de voseo). Texto de producto en español, todavía no está en la app

```
Cada cambio se guarda aunque cancelés después.
```

#### Toast

Bien. Texto de producto en español, todavía no está en la app

```
Cambios guardados
```

Mal (falla la prueba de resultado, no acción). Texto de producto en español, todavía no está en la app

```
Guardaste los cambios
```

#### Error

Bien. Texto de producto en español, todavía no está en la app

```
No se pudo guardar. Inténtalo de nuevo.
```

Mal (falla la prueba de voseo). Texto de producto en español, todavía no está en la app

```
No se pudo guardar. Intentá de nuevo.
```

Mal (falla la prueba de no culpar a la persona). Texto de producto en español, todavía no está en la app

```
No pudiste guardar. Inténtalo de nuevo.
```
