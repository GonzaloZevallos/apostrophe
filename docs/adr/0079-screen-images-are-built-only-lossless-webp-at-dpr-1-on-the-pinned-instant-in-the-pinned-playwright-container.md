---
status: accepted
date: 2026-11-10
---

# ADR-0079: Las imágenes de pantalla son solo de lo construido, webp sin pérdida a DPR 1, en el instante fijo, dentro del contenedor fijo de Playwright

Extiende ADR-0040 y ADR-0042 (no las enmienda).

## Contexto

`docs/product/screen-images.md` pide una imagen de cada pantalla construida junto a su definición, que cambie solo cuando la pantalla cambia. Un refresco que reescribe imágenes por ruido le pide al revisor mirar nada. Las capturas de Diseño (ADR-0040) comparan contra el archivo de diseño y se hacen a la escala del dispositivo del navegador de comparación; no sirven como están: llevan el lado del diseño, la hoja, y un tamaño pensado para mirarse y no para quedar versionado.

## Decisión

1. **Solo lo construido, a DPR 1.** `comparisons.mjs --built-only` salta el lado del diseño y la hoja, y escribe solo `<pantalla>.built.png` e `index.json`. La escala del dispositivo viene únicamente del argumento `scale` de `captureContextOptions`, que por defecto es `CAPTURE_SCALE`; solo la corrida con `--built-only` pasa 1. Sin la bandera, la salida es byte a byte la de siempre.
2. **Webp sin pérdida con sharp, a un `effort` fijo.** `encodeWebp` escribe webp lossless sin metadatos con `EFFORT` constante. El `effort` es la única palanca de tamaño: cambiar el modo sin pérdida, el DPR o el viewport necesita una decisión del dueño. `sharp` es una devDependency de `web/` con versión exacta.
3. **El instante fijo.** La captura corre contra la app de muestra con `--pinned`: el reloj y el adaptador de Telegram quedan fijos en `PINNED_INSTANT`, así dos corridas muestran el mismo negocio el mismo día.
4. **"Cambió" se decide por píxeles decodificados.** `samePixels` compara dimensiones y bytes RGBA tras decodificar la imagen nueva y la guardada. Nunca se comparan bytes de webp ni hashes: una versión nueva del codificador que escriba otros bytes para el mismo dibujo no debe tocar una imagen guardada. Una imagen guardada que falta o no se decodifica cuenta como distinta; un PNG nuevo que no se decodifica falla la fila y deja la imagen guardada como está.
5. **El plan es puro y es el único que decide.** `planPublish` devuelve `{ write, remove, keep, failures }`. Solo se escriben filas de `screenImageRows`; todo nombre guardado que no sea `<fila>.webp` de una fila vigente se quita (`.gitkeep`, `.png` sueltos y `.tmp` sobrantes incluidos); una fila sin entrada en el índice, sin PNG, con nota de falla o inestable queda en `failures` y conserva su imagen; sin índice, o con la app sin arrancar, nada cambia. `applyPlan` escribe `.<nombre>.webp.tmp`, lo renombra y quita al final; `screen-images.sh` no decide nada de eso ni el código de salida.
6. **El contenedor de Playwright fijado al lockfile.** La captura corre en `mcr.microsoft.com/playwright:v<versión de node_modules/playwright en web/package-lock.json>-noble`; `playwrightImage` deriva la etiqueta y `containerArgs` arma los argumentos de `docker run`. Montajes: el checkout de solo lectura en `/work/repo`, `web/node_modules` de solo lectura en `/work/node_modules`, el archivo de datos de solo lectura, y la carpeta de salida en `/out`, el único montaje de escritura. Ningún destino de montaje queda dentro del checkout. Una máquina sin Docker, o sin poder bajar la imagen, es una corrida fallida que no cambia nada; no hay captura de respaldo en el anfitrión.
7. **`--apply` captura dos veces.** Una fila cuyas dos capturas decodificadas difieren falla como `unstable between two captures` y conserva su imagen guardada. `--twice` solo informa cuántas filas difieren.

## Consecuencias

- Lo que sigue corriendo en el anfitrión es la app de muestra, `vite build` y sharp. Sharp no puede causar cambios: decodifica los dos lados con el mismo decodificador y compara píxeles, así que otro binario de sharp puede cambiar los bytes del webp pero no lo que se considera cambiado.
- La igualdad de píxeles entre máquinas se verifica en la máquina que corrió `--twice`; que sea igual entre máquinas se espera y se comprueba por primera vez en la parte 3 (CI).
- Unas ~150 imágenes sin pérdida crecen el historial; no hay tope de tamaño, solo se informa el tamaño por imagen y el total.
- El script es una herramienta de mantenimiento: nunca es un trabajo requerido de CI ni bloquea una unión.
