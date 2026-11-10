## Jobs

- Cuando leo cómo funciona una capacidad en la documentación funcional, quiero ver la pantalla del teléfono que describe, la misma imagen cada vez, para entender lo que el dueño tiene en el teléfono sin correr la app ni abrir un archivo de diseño. Lo lee sobre todo el dueño o quien mantiene el producto; quienes revisan y el sistema agéntico que escribe y controla la documentación se benefician en segundo lugar.

## Qué es una Screen image

Una Screen image es la imagen de una pantalla del teléfono, tomada de la app construida sobre el negocio de muestra el 16/09/2026, que acompaña a la definición escrita en `docs/product/`. Es la misma en cada corrida. Ayuda a leer y nunca es una especificación, un paso del Gate ni evidencia de revisión.

No es una Design capture: la Design capture compara la app construida con el dibujo para revisar un PR y nunca se guarda en la documentación; la Screen image es una imagen permanente y repetible de la pantalla construida que vive en la documentación funcional.

Si el texto y la imagen difieren, gana el texto (Drawing as guide): una diferencia es un motivo para volver a mirar, nunca un defecto que decide la imagen.

## Qué pantallas tienen imagen

Tiene imagen cada fila del registro de pantallas en tema claro, con ancho de teléfono, con el tamaño de texto normal y con una ruta. La autoridad es `screenImageRows` en `scripts/design/screens.mjs`: las filas sin `tema`, con un `viewport` ausente o de ancho menor que 900, sin `text_scale` y con `route !== null`, en el orden del archivo. Esta definición no lista las pantallas que quedan afuera.

Para capturarlas, `captureSelection` suma a esas filas cada fila que necesitan (`needs`), de forma transitiva, en el orden del archivo y sin repetir.

Una pantalla sin imagen (tema oscuro, computadora, texto agrandado o sin ruta) se describe solo con su texto, que de todos modos gana.

## Nombres y lugar

- El nombre de cada imagen es el nombre de su fila en el registro de pantallas, los nombres en español incluidos.
- Un nombre de fila solo admite letras, dígitos y guiones (`^[A-Za-z0-9-]+$`), y dos filas nunca tienen nombres iguales sin importar mayúsculas y minúsculas; `assertScreens` rechaza el registro si no se cumple.
- Las imágenes viven en `docs/assets/screens/<screen>.webp`.
- Una capacidad enlaza la imagen de una pantalla solo cuando esa imagen existe.

## Qué muestra

- Solo el negocio de muestra sembrado el 16/09/2026, con los estados de Telegram del bot falso. Ningún dato real, ningún otro Business ni ningún Customer real aparece.
- La app de muestra corre con `--pinned`: siembra con la fecha de `PINNED_INSTANT`, los comandos del Operator (token de Business nuevo, token para sumarse, Reset link y el Spreadsheet import que carga el Business importado de la muestra) corren en ese mismo instante, y ninguna imagen depende del día en que se tomó.
- El negocio de muestra es una ilustración con datos inventados. Su tipo de producto, sus unidades, sus precios y sus canales son los de la muestra, nunca lo que la app exige (Assume nothing); donde el texto describe configuración, el texto gana sobre la imagen.

## Qué promete y qué no

- Una Screen image nunca es un paso del Gate, nunca se controla píxel a píxel y queda afuera de todo control de documentación desactualizada.
- Las imágenes de master pueden ir una corrida de master detrás del código de master.
- Los artefactos de un PR se conservan 7 días.
- La documentación solo advierte sobre la antigüedad: ninguna imagen ni ningún doc lleva sello de fecha o de commit, porque un sello rompería "la misma imagen en cada corrida".

## Métricas

- Cobertura: cada fila que devuelve `screenImageRows` sobre el registro real tiene exactamente una imagen con su nombre de fila (se mide a partir de la parte 2).
- Repetibilidad: dos corridas sobre el mismo código producen las mismas imágenes; ninguna depende del día en que se tomó.
- Nunca bloquea: cero corridas del Gate en rojo por una imagen desactualizada o faltante.
- Selección verificable: la entrega informa la cantidad de filas incluidas, la cantidad de filas extra que suma `captureSelection` y las filas incluidas que necesitan una fila fuera del conjunto (se espera ninguna).
