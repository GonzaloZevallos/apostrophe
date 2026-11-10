## Jobs

- Cuando leo cómo funciona una capacidad en la documentación funcional, quiero ver la pantalla del teléfono que describe, la misma imagen cada vez, para entender lo que el dueño tiene en el teléfono sin correr la app ni abrir un archivo de diseño. Lo lee sobre todo el dueño o quien mantiene el producto; quienes revisan y el sistema agéntico que escribe y controla la documentación se benefician en segundo lugar.
- Cuando leo la definición escrita de una pantalla del teléfono en `docs/product/` (como dueño, como PM o como agente del sistema), quiero la imagen de la pantalla construida al lado, para entender la definición más rápido sin levantar la app. Cuando actualizo las imágenes, quiero que cambien solo las pantallas que de verdad cambiaron, para que una actualización nunca me haga revisar ruido.
- Cuando un cambio llega a master, yo, el dueño que mantiene el producto mediante el sistema agéntico, quiero que el workflow de Screen images corra solo y refresque las imágenes que están junto a las definiciones escritas en `docs/product/`, para que una corrida en rojo me diga algo sobre las pantallas o la captura, nunca que al runner le faltaba una herramienta.

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
- **Python fijado antes de usarlo.** Cada workflow de `.github/workflows/` instala la versión de Python que fija el proyecto antes de cualquier paso que la use, incluido `uv python find`. El runner no trae esa versión. Todos los workflows obtienen la versión de la misma forma que `ci.yml` y `backup.yml`. La versión sale del pin del proyecto y no se vuelve a tipear en otro lugar, así que subir el pin no deja atrás a ningún workflow.
- **Control.** Un test de pytest del Gate recorre cada archivo de `.github/workflows/` y falla cuando un workflow usa Python antes de instalar la versión fijada, así que la falla aparece en el pull request que la introduce. El test solo lee los archivos de los workflows. El Gate nunca corre la captura.

## La misma imagen en cada corrida

- Una fila que difiere entre dos corridas se arregla primero en la semilla fijada o en el camino fijado de la app.
- Solo cuando el valor de un elemento cambia por corrida y no se puede fijar, se tapa ese único elemento con `mask` de Playwright. Nunca se tapa más que el elemento que varía ni una pantalla entera para que quede quieta.
- Una fila que sigue difiriendo después de eso no se publica: es una pregunta al dueño, y no sale de `screenImageRows` sin su decisión.
- Filas con un elemento tapado y su motivo: ninguna.

## Qué promete y qué no

- Una Screen image nunca es un paso del Gate, nunca se controla píxel a píxel y queda afuera de todo control de documentación desactualizada. `screen-images.sh` es una herramienta de mantenimiento, nunca un job requerido del CI; en el Gate corren solo los tests unitarios del plan y del resumen, y el test que controla que los workflows instalen el Python fijado.
- Una fila fallida o una app que no arrancó nunca borran ni reemplazan una imagen guardada.
- Las imágenes de master pueden ir una corrida de master detrás del código de master.
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
- Corrida de master en verde: la corrida de `Screen images` sobre el commit de merge de la tarea que agregó la instalación del Python fijado está en verde, y `screen-images-pr.yml` deja de fallar por la misma causa.
- Rojo con sentido: cero corridas de los workflows de Screen images en rojo porque al runner le faltaba la versión de Python fijada.
- Sin brecha nueva: el test de workflows cubre el 100 % de los archivos de `.github/workflows/`. Falla ante cualquier workflow que use Python antes de instalar la versión fijada, y `ci.yml` y `backup.yml` lo pasan tal como están.
- Un solo pin: subir la versión fijada del proyecto no exige tocar la versión en ningún workflow por separado.
