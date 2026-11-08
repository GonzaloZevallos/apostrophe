# Idiomas

Cómo elige el producto en qué idioma se muestran sus textos, y qué mantiene los textos completos y al día con el inglés. El inglés es el texto fuente y, hasta que salga un segundo idioma (#317), el único **Selectable language**. Las reglas del inglés en sí están en docs/product/product-language.md. Decisión: ADR-0050, que modifica a ADR-0049.

## Jobs

- **Mantenedores y el sistema agéntico:** Cuando agregamos un idioma al producto, queremos que el runtime de los textos, la configuración de idioma, el **Test locale** y los controles que detectan textos desactualizados o incompletos ya estén en su lugar, así un idioma nuevo sale agregando textos y eligiéndolo, sin rehacer el servidor.
- **Quien vende (protegido, no servido):** Cuando abro la app antes de iniciar sesión, o sigo un link de **Invitation** o un **Reset link**, quiero que el idioma de la página dependa solo del idioma de mi teléfono, así la página nunca me dice a mí ni a nadie si existe un link, un **User** o un **Business**.

## Decisión (ADR-0050)

- El front usa i18next con react-i18next. El back usa Babel/gettext.
- Los textos se identifican por clave, y el inglés es el texto fuente.
- El árbol de claves del front (JSON) y el del back (`.po`) son disjuntos. Ningún nombre de clave existe en los dos.
- El contrato de rechazos de la API sigue siendo de códigos. `detail` es un diagnóstico en inglés sin traducir y nunca se muestra. El texto de un rechazo en pantalla sale solo del **Copy module**, por código.
- El Test locale `en-XA` se genera a partir del inglés, se selecciona solo con `APOSTROPHE_FORCED_LANGUAGE` y se juzga solo por la disposición, nunca por límites de caracteres.
- Se tachan de ADR-0049 su "no translation library and no language switch" y su exención de `SuccessToast`.

## Idioma de la página antes de iniciar sesión

- El **Pre-sign-in language** sale de `Accept-Language` comparado con los Selectable languages, por idioma. Una etiqueta regional como `en-GB` o `de-AT` coincide con su idioma base cuando ese idioma es seleccionable, y se aplica el orden q de la cabecera.
- Una cabecera ausente, vacía, `*`, mal formada, muy larga o sin coincidencia da `en`. Una cabecera mala nunca produce una página de error y da exactamente la página sin cabecera.
- Ningún valor de la cabecera puede producir `en-XA`, un idioma fuera de la lista de Selectable languages ni uno sin textos completos. Hasta #317, todo teléfono real recibe `lang="en"`.
- El resultado depende solo de la cabecera (y del **Forced language**). No se lee ninguna cookie, ruta, token, Invitation ni Reset link. Para un mismo `Accept-Language`, la página servida es idéntica byte a byte en las rutas de Invitations desconocidas, usadas y vencidas y en cada estado de Reset link.
- El `index.html` servido lleva el idioma en el `lang` de su elemento raíz, mantiene `Cache-Control: no-cache` y envía `Vary: Accept-Language`.

## Forced language

- `APOSTROPHE_FORCED_LANGUAGE` acepta solo `en-XA`. Cualquier otro valor frena el arranque.
- Cuando está puesta, reemplaza al Pre-sign-in language y al **Shown language** de todo lo que lee un User con la sesión iniciada. Nunca cambia un **Stored language**. Se aplica solo en el resolvedor del idioma del Business.
- La salida de los scripts del **Operator** y el reporte del **Spreadsheet import** se quedan en el idioma del Operator. Se arman a partir de `operator_translator(settings)`, nunca del Stored language de un Business.
- Es un interruptor de toda la instalación que el Operator activa para juzgar la disposición. No está pensado para producción, y ningún dato de una solicitud puede activarlo.

## Configuración y arranque

- Los Selectable languages son por defecto solo inglés, y el idioma del Operator es inglés por defecto. Ninguno de los dos se lee del entorno; #317 decide cómo elige el Operator.
- Un **Language** está completo solo cuando cada mensaje en inglés tiene una traducción no vacía. Un mensaje marcado como pendiente de revisión cuenta como faltante.
- Un idioma seleccionable o del Operator que sea `en-XA` o esté incompleto se rechaza al arrancar. El rechazo es un diagnóstico en inglés para el Operator, que nombra el idioma y las primeras claves faltantes, y nunca llega a la pantalla de quien vende.

## Idioma del Business

- Todavía no se guarda ningún idioma del Business: ninguna columna, carga retroactiva, ruta, control en **Settings** ni pantalla. Hasta #317 el Shown language de todo Business es inglés, más el reemplazo forzado.
- Configurar un Business en un idioma que no es seleccionable, o en `en-XA`, se rechaza con el código `business.language_not_selectable`.
- El código que decide qué textos mostrar lee el Shown language. El código que edita o muestra el Stored language lee el guardado. Nunca uno por otro.
- Un hexágono que no sea accounts lee el idioma de un Business solo a través de un puerto en su propia capa de aplicación, implementado por su propio adaptador.

## Controles de los textos

- Los textos del back viven en `locales/<lang>/LC_MESSAGES/apostrophe.po`, con el inglés como respaldo de gettext. Los archivos `.mo` compilados se suben al repositorio, y uno desactualizado hace fallar el **Gate**.
- Los textos del Test locale se generan a partir del inglés. Cada valor va envuelto en `⟦…⟧`, con acentos y cerca de un 35 % más largo, conservando los marcadores de posición. Un archivo subido que difiere de la salida del generador hace fallar el Gate.
- Un reporte de claves faltantes para los idiomas reales lista las claves sin traducir y nunca hace fallar el Gate.
- Los scripts de shell del Operator (`scripts/*.sh`, salvo `scripts/design/`) no pueden hacer `echo` ni `printf` de texto literal.
- El dominio no importa ninguna biblioteca de traducción. Los textos le llegan como valores simples a través de puertos declarados en la capa de aplicación.
- Ningún módulo bajo `web/src/` llama a `t()` ni lee un valor de recurso en el nivel superior del módulo. Las constantes y las uniones guardan claves, nunca palabras.
- Una parte del front agrega claves solo a los archivos de idioma de sus propias áreas.
- Cada texto en inglés movido es igual a su valor en `en.baseline.json`, salvo los que figuran en el archivo de excepciones razonadas, que solo puede achicarse.
- Las listas de infractores del **Mobile check** nunca crecen. El Test locale se juzga solo por las reglas de disposición, nunca por límites de texto.

## Sin cambios

Los formatos (`$ 11.000`, `$11.000`, dd/mm, `3,5 g`), las rutas, los nombres de campos de la API, los códigos de error y los nombres de la base de datos. Los datos propios de quien vende nunca se traducen.

## Métricas

1. El inglés sin cambios en todas partes (pantallas, mensajes de la API, salida del Operator, líneas del **Catalog**), con el Gate en verde.
2. Para un mismo `Accept-Language`, la página servida es idéntica byte a byte en las rutas de Invitations desconocidas, usadas y vencidas y en cada estado de Reset link.
3. Con `APOSTROPHE_FORCED_LANGUAGE=en-XA`, se muestra el Test locale. Sin ella, `Accept-Language: en-XA` da `lang="en"`. Ningún dato de una solicitud selecciona `en-XA`.
4. El arranque se rechaza con un idioma seleccionable o del Operator que sea `en-XA` o esté incompleto, y con cualquier valor forzado que no sea `en-XA`.
5. Las diferencias de textos hacen fallar el Gate: un `.mo` desactualizado, o un archivo `en-XA` distinto de la salida del generador. El reporte de claves faltantes nunca falla.
