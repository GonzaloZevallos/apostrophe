## Jobs

- Cuando leo cómo funciona una capacidad en la documentación funcional, quiero ver la pantalla del teléfono que describe, la misma imagen cada vez, para entender lo que el dueño tiene en el teléfono sin correr la app ni abrir un archivo de diseño. Lo lee sobre todo el dueño o quien mantiene el producto; quienes revisan y el sistema agéntico que escribe y controla la documentación se benefician en segundo lugar.
- Cuando leo la definición escrita de una pantalla del teléfono en `docs/product/` (como dueño, como PM o como agente del sistema), quiero la imagen de la pantalla construida al lado, para entender la definición más rápido sin levantar la app. Cuando actualizo las imágenes, quiero que cambien solo las pantallas que de verdad cambiaron, para que una actualización nunca me haga revisar ruido.
- Cuando un cambio llega a master, yo, el dueño que mantiene el producto mediante el sistema agéntico, quiero que el workflow de Screen images corra solo y refresque las imágenes que están junto a las definiciones escritas en `docs/product/`, para que una corrida en rojo me diga algo sobre las pantallas o la captura, nunca que al runner le faltaba una herramienta.
- Cuando un workflow del bot ya hizo su commit y master se movió mientras corría, quiero (como quien integra a master y lee la página de la corrida) que publique igual si el movimiento fue solo de archivos del bot o de archivos que ese workflow ignora, para que master lleve la última salida generada sin que nadie vuelva a correrlo ni persiga al bot.

## Qué es una Screen image

Una Screen image es la imagen de una pantalla del teléfono, tomada de la app construida sobre el negocio de muestra el 16/09/2026, que acompaña a la definición escrita en `docs/product/`. Es la misma en cada corrida. Ayuda a leer y nunca es una especificación, un paso del Gate ni evidencia de revisión.

No es una Design capture: la Design capture compara la app construida con el dibujo para revisar un PR y nunca se guarda en la documentación; la Screen image es una imagen permanente y repetible de la pantalla construida que vive en la documentación funcional.

Si el texto y la imagen difieren, gana el texto (Drawing as guide): una diferencia es un motivo para volver a mirar, nunca un defecto que decide la imagen.

## Qué pantallas tienen imagen

Tiene imagen cada fila del registro de pantallas en tema claro, con ancho de teléfono, con el tamaño de texto normal y con una ruta. La autoridad es `screenImageRows` en `scripts/design/screens.mjs`: las filas sin `tema`, con un `viewport` ausente o de ancho menor que 900, sin `text_scale` y con `route !== null`, en el orden del archivo. Esta definición no lista las pantallas que quedan afuera.

Para capturarlas, `captureSelection` suma a esas filas cada fila que necesitan (`needs`), de forma transitiva, en el orden del archivo y sin repetir. Una fila que está solo en `captureSelection` se captura pero nunca se publica.

Una pantalla sin imagen (tema oscuro, computadora, texto agrandado o sin ruta) se describe solo con su texto, que de todos modos gana.

## Nombres y lugar

- El nombre de cada imagen es el nombre de su fila en el registro de pantallas, los nombres en español incluidos.
- Un nombre de fila solo admite letras, dígitos y guiones (`^[A-Za-z0-9-]+$`), y dos filas nunca tienen nombres iguales sin importar mayúsculas y minúsculas; `assertScreens` rechaza el registro si no se cumple.
- Las imágenes viven en `docs/assets/screens/<screen>.webp`.
- `docs/assets/screens/` es una carpeta solo generada: todo archivo cuyo nombre no sea un nombre actual de `screenImageRows` se borra al publicar, uno puesto a mano incluido. Una imagen hecha a mano va en otro lugar dentro de `docs/assets/`.
- Una capacidad enlaza la imagen de una pantalla solo cuando esa imagen existe.

## Qué muestra

- Solo el negocio de muestra sembrado el 16/09/2026, con los estados de Telegram del bot falso. Ningún dato real, ningún otro Business ni ningún Customer real aparece.
- La app de muestra corre con `--pinned`: siembra con la fecha de `PINNED_INSTANT`, los comandos del Operator (token de Business nuevo, token para sumarse, Reset link y el Spreadsheet import que carga el Business importado de la muestra) corren en ese mismo instante, y ninguna imagen depende del día en que se tomó.
- El negocio de muestra es una ilustración con datos inventados. Su tipo de producto, sus unidades, sus precios y sus canales son los de la muestra, nunca lo que la app exige (Assume nothing); donde el texto describe configuración, el texto gana sobre la imagen.

## Cómo se toman y se publican

Lo decide `docs/adr/0079-screen-images-are-built-only-lossless-webp-at-dpr-1-on-the-pinned-instant-in-the-pinned-playwright-container.md`.

- **Captura.** `scripts/design/comparisons.mjs --built-only` captura solo la app construida, sin el lado del diseño ni la hoja, con `deviceScaleFactor: 1`, y escribe solo `<screen>.built.png` e `index.json`. El navegador de esa corrida arranca con `--disable-partial-raster` (`BUILT_ONLY_LAUNCH_ARGS` en `scripts/design/shot.mjs`): sin él, el borde de una curva o de una letra salía de una de dos formas de una corrida a otra. Sin la marca, la Design capture corre igual que antes.
- **Contenedor.** La captura corre siempre en el contenedor de Playwright fijado al lockfile, así las imágenes tomadas en máquinas distintas son iguales píxel a píxel; correr el script exige Docker en esa máquina. Nunca se captura fuera del contenedor: sin Docker, la corrida cuenta como una app que no arrancó (`plan.json` con `appStarted: false`, el motivo nombrado en `summary.md`, nada cambia en `docs/assets/screens/` y termina con error).
- **Codificación.** Cada PNG se codifica a webp sin pérdida con `sharp` (versión fija exacta en `web/`), con un `effort` fijo y sin metadatos; el mismo PNG da siempre los mismos bytes. Solo `effort` se puede ajustar para el tamaño; cualquier cambio a la codificación sin pérdida, al DPR o al viewport es una pregunta al dueño.
- **"Cambiada" se decide por píxeles.** Una fila cuenta como cambiada solo cuando sus píxeles decodificados (RGBA y dimensiones) difieren de la imagen guardada; si son iguales, la imagen guardada se conserva tal cual.
- **Plan.** `planPublish` decide qué se escribe, qué se borra y qué se conserva:
  - solo se escriben nombres de `screenImageRows`;
  - un nombre guardado fuera de ellos se borra;
  - una fila sin entrada en el índice, sin PNG construido o con una nota de falla queda fallida y conserva su imagen;
  - sin índice, toda fila queda fallida y no cambia nada;
  - si la app no arrancó, no cambia nada, ni siquiera se borra.
- **Script.** `scripts/design/screen-images.sh` levanta `sample-app.sh --pinned`, captura `captureSelection`, codifica y planifica contra `docs/assets/screens/`, y escribe `plan.json` (siempre con `appStarted` y las fallas), `summary.md` y los webp en una carpeta de salida. Con `--apply` aplica el plan (crea la carpeta si falta): escribe cada fila que salió bien y cambió, borra los nombres viejos y conserva la imagen de cada fila fallida. Con `--twice` captura dos veces e informa cuántas filas difieren en píxeles decodificados. Termina con error cuando falló una fila o no arrancó la app, después de escribir todo.
- **`--apply` captura dos veces.** Una fila cuyas dos capturas difieren en píxeles decodificados queda fallida (`unstable between two captures`) y conserva su imagen guardada; `--twice` solo informa cuántas filas difieren, por nombre, y cuánto tardó.
- **Resumen.** `summary.md` lista las filas nuevas, cambiadas, borradas y fallidas (cada fallida por nombre), el tamaño total de `docs/assets/screens/` y el de cada imagen. En modo `pr` agrega el SHA base y la advertencia de que un cambio listado puede venir de un merge cuyas imágenes todavía no se guardaron.
- **Quién lo corre hasta la parte 3.** La tarea que entrega esta herramienta corre `--apply` una vez y guarda el primer conjunto completo. Después, hasta que la parte 3 lo lleve al CI, lo corre a mano quien mantiene la documentación (el dueño o un agente del sistema al que se le pida) cuando quiere refrescar las imágenes. No es una obligación de cada tarea que cambia una pantalla: una imagen desactualizada nunca bloquea.

## Los workflows de Screen images

`.github/workflows/screen-images.yml` (en cada commit de master) y `.github/workflows/screen-images-pr.yml` (en los pull requests) corren la captura en el CI. No son jobs del Gate: una corrida en rojo no bloquea nada.

- **Una corrida en rojo tiene que decir algo.** Debe hablar de las pantallas o de la captura, nunca de una herramienta que le faltaba al runner. Es la misma regla que el glosario fija para el Gate, aplicada a estos workflows aunque estén fuera de él.
- **Python fijado antes de usarlo.** Cada workflow de `.github/workflows/` instala la versión de Python que fija el proyecto antes de cualquier paso que la use, incluido `uv python find`. El runner no trae esa versión. Todos los workflows la instalan de la misma forma que `ci.yml` y `backup.yml` (`uv venv --python`). El pin del proyecto es `[tool.mypy] python_version` de `pyproject.toml`; cada workflow conserva el literal de esa versión en `uv venv --python`, y el test lo compara con el pin, así que subir el pin hace fallar al test en cada workflow que quedó atrás en lugar de dejarlo pasar.
- **Control.** Un test de pytest del Gate recorre cada archivo de `.github/workflows/` y falla cuando un workflow usa Python antes de instalar la versión fijada, así que la falla aparece en el pull request que la introduce. El test solo lee los archivos de los workflows. El Gate nunca corre la captura.
- **Una falla de la captura es un hallazgo, no un arreglo de herramientas.** Una corrida que pasa el control de herramientas y después falla por la app de muestra, Playwright, Docker o el control de dos capturas está en rojo con sentido: se informa como hallazgo con un issue propio que cita la corrida, y no se arregla cambiando qué se captura, cuándo ni qué se publica dentro de la tarea que arregla las herramientas. Una falla causada por cómo se instala Python (versión, dependencias o el entorno que usa la captura) sí es de las herramientas y se arregla ahí.

## Publicar en master: `bot-push.sh`

El job `push` de `screen-images.yml` publica las imágenes en master como `github-actions[bot]` mediante `scripts/design/screen-images-publish.sh`, que después de hacer su commit llama al ayudante compartido `scripts/ci/bot-push.sh` (GH-697 parte 1). El ayudante es genérico, para cualquier workflow que haga commits en master como el bot; en esta parte solo lo usa Screen images.

- **`screen-images-publish.sh` no cambia para quien lo llama.** Conserva su interfaz, su control de archivos sueltos en el árbol de trabajo (con su stderr) y su línea `no image changed`. Llama al ayudante con `--label 'Screen images' --skip-note 'the next master run updates the images.' --ignore 'docs/assets/screens/**'`.
- **Interfaz.** `bot-push.sh --sha SHA --commit REV --summary FILE --label TEXT --skip-note TEXT [--ignore PATH]... [--remote origin] [--branch master]`. Un uso incorrecto (una marca obligatoria faltante incluida) termina con 2, imprime solo una línea de uso en stderr y no escribe ninguna línea de resumen.
- **Checkout completo.** Todo checkout que corre `bot-push.sh` usa `fetch-depth: 0`; hoy es solo el del job `push` de `screen-images.yml`.
- **Rutas del bot.** La lista es un arreglo literal en el script: `docs/architecture/generated/**`, `docs/api/**`, `docs/architecture/decisiones.md` y `docs/assets/screens/**`. Su parte de docs es igual a `docs.paths` de `.agentic/stack.yaml` (un test de `tests/docs/test_owned_paths.py` lo compara con `owned_paths(REPO_ROOT)` más la entrada de las imágenes); la entrada de las imágenes nunca se agrega a `stack.yaml`.
- **Un solo comparador.** Sirve para la lista del bot y para `--ignore`: una entrada que termina en `/**` coincide solo con rutas estrictamente debajo de esa carpeta, y cualquier otra coincide solo con esa ruta exacta. Así, `docs/assets/screens-old/x` o un archivo llamado exactamente `docs/assets/screens` nunca son imágenes.
- **Qué tocó un commit.** Se decide por su diff contra su primer padre, así que un merge cuenta como que toca todo lo que trae. Un commit es del bot solo cuando su email de autor y su email de committer son ambos `41898283+github-actions[bot]@users.noreply.github.com`.
- **En orden.**
  1. Un clon superficial termina con 1.
  2. El commit entregado debe tocar solo rutas del bot; si toca otra, o no tiene primer padre, termina con 1.
  3. Trae la rama; si master no se movió, empuja el commit.
  4. Si se movió, revisa cada commit de `SHA..punta`: uno del bot debe tocar solo rutas del bot y cualquier otro solo rutas de `--ignore`. Si alguno no cumple, escribe `<label>: not pushed, <branch> moved from <sha> to <tip> during the run; <skip-note>` y termina con 0. Un commit del rango sin primer padre termina con 1: nunca se adivina un diff contra un árbol vacío.
  5. Si todos cumplen, se pone sobre la punta nueva, aplica el commit con cherry-pick y empuja. Si el cherry-pick queda vacío porque master ya tiene exactamente ese cambio (por ejemplo, otra corrida ya publicó las mismas imágenes), no empuja nada, no deja ningún cherry-pick a medias, escribe `<label>: nothing to push, <branch> at <tip> already has <rev>'s changes.` y termina con 0. No es un conflicto ni un salteo: master ya lleva la salida al día. Si queda parte del cambio, se empuja lo que queda como siempre.
  6. Un push rechazado (también en el paso 3) vuelve a traer la rama, se pone sobre la punta nueva, revisa todo el rango otra vez y vuelve a aplicar el commit, como máximo 3 veces, escribiendo solo en stderr; la punta nueva que ya tiene el cambio se trata igual que en el paso 5. Si sigue rechazado, termina con 1.
  7. Un conflicto de cherry-pick lo aborta y termina con 1.
  8. Al empujar escribe `<label>: pushed <head> to <branch>.`
- **Saltear, ya estaba o fallar.** Termina con 0 sin empujar cuando un commit que no es del bot toca una ruta fuera de `--ignore`, o cuando un commit del bot trae una ruta ajena (la próxima corrida de master se pone al día, así que fallar sería ruido), y cuando master ya tiene exactamente el cambio del commit entregado. Termina con 1 cuando no puede juzgar o no puede terminar: clon superficial, ruta ajena en el commit entregado, conflicto de cherry-pick, commit sin primer padre o push rechazado después de 3 reintentos. Nunca une cambios ajenos por su cuenta.
- **Una línea por resultado.** Cada resultado (empujado, salteado, ya estaba, fallido) escribe exactamente una línea de resumen que empieza con la etiqueta, agregada al archivo de `--summary` (el workflow pasa `$GITHUB_STEP_SUMMARY`); si ese archivo viene vacío, la línea va a stdout. Los reintentos escriben solo en stderr.
- **Nunca encima de un humano.** El bot nunca empuja sobre un cambio de código de una persona, un merge de una persona ni una ruta parecida, y nunca empuja un commit que toca una ruta fuera de su lista.
- **Cómo se prueba.** `tests/ci/test_bot_push.py` cubre cada caso contra un remoto desnudo de prueba y verifica el código de salida, la cabeza del remoto y la única línea de resumen: master sin moverse; movida por un commit del bot en una ruta propia; por una persona en código; por una persona solo en rutas ignoradas; por un commit del bot con una ruta ajena; un merge de una persona con código; una persona en `docs/assets/screens-old/x`; una persona en un archivo llamado exactamente `docs/assets/screens`; un conflicto entre dos commits del bot; un clon `--depth 1`; un hook que siempre rechaza; un hook que rechaza una vez mientras entra un commit del bot (se recupera, encima de ese commit); un hook que rechaza una vez mientras entra código de una persona (saltea); y master movida por un commit del bot con el mismo cambio de imágenes que el commit entregado (no empuja nada, termina con 0, la cabeza queda en ese commit). El cambio toca `.github/`, así que lo juzga un Dispatch (ADR-0072).

## La misma imagen en cada corrida

- Una fila que difiere entre dos corridas se arregla primero en la semilla fijada o en el camino fijado de la app.
- Solo cuando el valor de un elemento cambia por corrida y no se puede fijar, se tapa ese único elemento con `mask` de Playwright. Nunca se tapa más que el elemento que varía ni una pantalla entera para que quede quieta.
- Una fila que sigue difiriendo después de eso no se publica: es una pregunta al dueño, y no sale de `screenImageRows` sin su decisión.
- Filas con un elemento tapado y su motivo: ninguna.

## Qué promete y qué no

- Una Screen image nunca es un paso del Gate, nunca se controla píxel a píxel y queda afuera de todo control de documentación desactualizada. `screen-images.sh` es una herramienta de mantenimiento, nunca un job requerido del CI; en el Gate corren solo los tests unitarios del plan y del resumen, y el test que controla que los workflows instalen el Python fijado.
- Una fila fallida o una app que no arrancó nunca borran ni reemplazan una imagen guardada.
- Las imágenes de master pueden ir una corrida de master detrás del código de master: pasa cuando master se movió durante la corrida por un cambio de una persona fuera de las imágenes. Cuando se movió solo por commits del bot en sus rutas o solo por cambios de imágenes, la corrida publica igual.
- Los artefactos de un PR se conservan 7 días.
- La documentación solo advierte sobre la antigüedad: ninguna imagen ni ningún doc lleva sello de fecha o de commit, porque un sello rompería "la misma imagen en cada corrida".

## Métricas

- Cobertura: cada fila que devuelve `screenImageRows` sobre el registro real tiene exactamente una imagen con su nombre de fila (se mide a partir de la parte 2).
- Repetibilidad: `--twice` sobre el conjunto completo da 0 filas distintas en píxeles decodificados de N; ninguna imagen depende del día en que se tomó.
- Sin ruido: una fila figura como cambiada solo cuando difieren sus píxeles decodificados; un cambio que no toca ninguna pantalla no agrega cambios de imágenes.
- Ninguna pérdida: cero imágenes guardadas borradas o reemplazadas por una fila fallida o por una corrida en la que no arrancó la app; cada falla figura por nombre.
- Tamaño visible: el resumen informa el total de `docs/assets/screens/` y el tamaño de cada imagen, sin tope; la entrega informa cantidad, total, mediana, la más grande y la más chica.
- Nunca bloquea: cero corridas del Gate en rojo por una imagen desactualizada o faltante.
- Selección verificable: la entrega informa la cantidad de filas incluidas, la cantidad de filas extra que suma `captureSelection` y las filas incluidas que necesitan una fila fuera del conjunto (se espera ninguna).
- Corrida de master sin falla de herramientas: la corrida de `Screen images` sobre el commit de merge de la tarea que agregó la instalación del Python fijado pasa el control de herramientas y ningún paso falla por falta de Python, y lo mismo vale para `screen-images-pr.yml`. Se espera verde; si queda en rojo más adelante por una causa ajena a Python, la entrega nombra el paso y su error y abre un issue propio.
- Rojo con sentido: cero corridas de los workflows de Screen images en rojo porque al runner le faltaba la versión de Python fijada.
- Sin brecha nueva: el test de workflows cubre el 100 % de los archivos de `.github/workflows/`. Falla ante cualquier workflow que use Python antes de instalar la versión fijada, `backup.yml` lo pasa tal como está, y dos jobs de `ci.yml` (`changes` y `ci-ok`, que corren `uv run --no-project python` sin instalar) pasan solo por la lista declarada de brechas conocidas del test, que solo puede achicarse.
- Un solo pin: la versión sale de un único lugar, `[tool.mypy] python_version`; subir ese pin hace fallar al test en cada literal de workflow que quedó atrás, así que ninguno se desactualiza sin que se vea.
- Publica en vez de saltear (`bot-push.sh`): los casos "commit del bot en ruta propia", "persona solo en rutas ignoradas" y "hook que rechaza una vez mientras entra un commit del bot" terminan con la cabeza del remoto en el commit aplicado sobre la punta nueva; en las primeras corridas de master posteriores al merge en que master se movió solo por commits del bot o de imágenes, cero líneas `not pushed`.
- Una línea por resultado: en el 100 % de los tests con uso válido, el resumen tiene exactamente una línea que empieza con la etiqueta; los reintentos aparecen solo en stderr.
- Nada empujado encima de otros: en todo caso de salteo, de cambio que ya estaba o de falla, la cabeza del remoto queda igual que antes de la corrida; las rutas parecidas, el merge de una persona y el commit del bot con ruta ajena saltean.
- Sin rojo cuando ya estaba: el caso de master que ya tiene el mismo cambio termina con 0 y la línea `nothing to push`, nunca como conflicto.
- Sin cambio para quien llama: `tests/design/test_screen_images_publish.py` pasa sin ningún diff en el archivo.
- Casos cubiertos: los 14 casos de `tests/ci/test_bot_push.py` tienen su propio test, y el test de rutas propias compara el arreglo con `owned_paths(REPO_ROOT)` más `docs/assets/screens/**`.
