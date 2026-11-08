# GH-491 parte 2: evidencia de la captura de teléfono por scroll y unión

Esta evidencia compara una corrida nueva de todo el registro contra la corrida `after` de la parte 1. La primera versión no tocó código; después, por la decisión humana de este task, se arreglaron dos defectos de la ruta de scroll y se repitió la corrida. **El estado vigente está en la última sección ("Corrida después de los dos arreglos"); las secciones 2 y 3 y la de criterios sin cumplir describen la corrida anterior y están superadas.**

## Comandos, fecha y cabeza

- Cabeza: `1f94db75dd1903ac8999ceff1136b5c61ca21c4b` (árbol limpio). Fecha: 2026-11-07 (AR).
- Corrida de la parte 1: la corrida `after` de `part-1.md` (`349c9b67`), en `~/.cache/apostrophe/GH-491/a3`. Los PNG no están en git.
- Primer intento: `scripts/design/compare.sh --out ~/.cache/apostrophe/GH-491/p2`. Salió con `compare: the sample app was not ready in 120 s`: la máquina estaba cargada por otras tareas y el `npm run build` de `sample-app.sh` pasó de los 120 s de espera de `compare.sh`. No llegó a capturar nada.
- Corrida usada: los mismos pasos que `compare.sh`, con una sola diferencia: la espera de los hechos es de 600 s. Una sola app de muestra para las dos corridas:
  1. `sample-app.sh --dir <tmp>/app`, luego `node scripts/design/comparisons.mjs --facts <facts> --out ~/.cache/apostrophe/GH-491/p2`. Todo el registro, 219 filas. Inicio 23:37:16, fin 23:48:30 (11 min 14 s).
  2. `node scripts/design/comparisons.mjs --facts <facts> --out ~/.cache/apostrophe/GH-491/p2-sizes --registry <scratch>/phone-sizes.json`. El registro de scratch (fuera del repo) copia las filas `InicioHoy`, `InicioOscuro`, `Analisis` y `AnalisisOscuro` con `viewport` 320x568, 375x812 y 430x932. Fin 23:49:29. `screens.json` no se tocó.
- Comparación: `node scripts/design/ae.mjs ~/.cache/apostrophe/GH-491/a3 ~/.cache/apostrophe/GH-491/p2` (exit 1, por lo que sigue).

## 1. Las filas de teléfono

El registro sólo le da a estas filas el teléfono 390x844 (`PHONE`); ninguna trae 320x568, 375x812 ni 430x932. Esos tres tamaños salieron del registro de scratch. Todas las filas quedaron `captured`, lado `design` y lado `built`, en las dos temas.

| Fila (tema) | 320x568 | 375x812 | 430x932 | 390x844 (registro) |
|---|---|---|---|---|
| Home con la barra de #373 (`InicioHoy`, claro) | captured, built 640x2148 | captured, built 750x2142 | captured, built 860x2172 | captured, built 780x2150 |
| `InicioOscuro` | captured, built 640x2148 | captured, built 750x2142 | captured, built 860x2172 | captured, built 780x2150 |
| `Analisis` (claro) | captured, built 640x9310 | captured, built 750x9056 | captured, built 860x9016 | captured, built 780x9008 |
| `AnalisisOscuro` | captured, built 640x9310 | captured, built 750x9056 | captured, built 860x9016 | captured, built 780x9008 |

Los lados `design` miden 640x1688, 750x1688 y 860x1864 en Home, y 640x2000, 750x2000 y 860x2000 en Analysis (tamaños en píxeles de dispositivo, dpr 2). Los índices están en `part2-p2.index.json` y `part2-p2-sizes.index.json`.

Vista una imagen: `InicioHoy_375x812.built.png`. La barra inferior y "+ New sale" aparecen una sola vez, dentro de la primera pantalla del teléfono (y de 1370 a 1600 px de 2142), sin hueco ni doble dibujo; el contenido de abajo sigue después. No miré una por una las otras once filas de este cuadro: sus resultados son el estado `captured` y las medidas del índice.

## 2. Comprobación de regresión (SUPERADA: corrida anterior a los arreglos; ver la última sección)

Por nombre de pantalla, fila por fila (no sólo por conteo):

- Lado `design`: 219 capturados en las dos corridas.
- Lado `built`: part 1 `after` 172, esta corrida 171. No se ganó ninguna fila.
- **Una fila que capturaba ya no captura: `OnboardingMensajeTexto130` (lado `built`, 320x844, `text_scale` 1.3).** Razón registrada: `shot: the page scrolls inside an element (built)`. En la parte 1 estaba `captured`. **Es un defecto de la ruta de scroll** (la razón es `innerScrollMiss`: un elemento que no es capa se desplaza y el documento no). No se arregló, según lo pedido. No repetí la fila sola, así que no sé si es siempre o intermitente.
- Las 47 filas `not-captured` restantes son todas `shot: no built screen yet (built)`, las mismas de la parte 1. Ninguna fila falla por `did not settle`.
- Escritorio: todas las filas con viewport de 900 px o más (`*Compu*`, `*Compu960*`) siguen capturando y dan AE 0.

## 3. Lista de AE mayor que 0 (SUPERADA: corrida anterior a los arreglos; la lista vigente de 97 filas está en la última sección)

`ae` de la parte 1 contra esta corrida: 348 lados con AE 0, 24 con AE mayor que 0, 18 `FAIL different dimensions`, 48 `not compared` (47 por `no built screen yet` y la regresión de arriba). Salida completa en `ae-part1-part2.txt`. Ninguna fila de escritorio aparece.

### Lados `built` con AE mayor que 0 (24)

En todos, el tamaño del PNG es igual al de la parte 1 (el alto no cambió). Por eso la razón de la mayoría es la esperada: en una página más alta que el teléfono, la barra fija y "+ New sale" quedan en la primera pantalla y no al final del documento. Lo deduje de las medidas y de la imagen de Home; no abrí cada una de las 24.

| Fila(s) | AE | Alto (px) | Razón para la parte 3 |
|---|---|---|---|
| `InicioHoy`, `InicioOscuro` | 170333 | 2150 | La barra y "+ New sale" pasan del final del documento a la primera pantalla (vista). |
| `InicioPrimeraVez`, `InicioPrimeraVezOscuro` | 163420 | 1888 | Lo mismo. |
| `InicioChecklist`, `InicioChecklistOscuro` | 171057 | 1974 | Lo mismo. |
| `Clientes`, `ClientesOscuro` | 180347 | 1944 | Lo mismo. |
| `Variedades` | 168736 | 2196 | Lo mismo. |
| `Analisis`, `AnalisisOscuro` | 167122 | 9008 | Lo mismo; el alto no cambia. |
| `VariedadArchivada`, `VariedadArchivadaOscuro` | 107167 | 1900 | Lo mismo. |
| `EstadosConfirmar` | 52176 | 1740 | La barra fija pasa a la primera pantalla y tapa el pie de la tarjeta (imágenes comparadas, ver abajo). |
| `Catalogo`, `CatalogoOscuro` | 26922, 27551 | 1988, 2114 | Lo mismo. |
| `VariedadDetalle`, `VariedadDetalleOscuro` | 24799 | 2610 | Lo mismo. |
| `VentaGuardada`, `VentaGuardadaOscuro` | 15904 | 1734 | Lo mismo. |
| `ClienteFicha`, `ClienteFichaOscuro` | 9872 | 1886 | Lo mismo. |

**`NegocioNuevo` y `Invitacion`, lado `built`, AE 243 con 780x1688** (844 px CSS, exactamente un teléfono: la página cabe). Se esperaba AE 0, pero la causa no es la ruta de scroll. Comparé los dos PNG píxel a píxel: los 243 píxeles distintos están en un rectángulo de 16x20 px de dispositivo, en y 1613-1632 (x 647-662 en `NegocioNuevo`, x 384-399 en `Invitacion`), y al recortar esa franja en las dos corridas se lee "The invitation can be used once and expires on 14/11." en la parte 1 y "...expires on 15/11." en esta corrida. Es un dato de los hechos de la app de muestra que depende del día en que corre: la parte 1 corrió el 2026-11-07 a las 20:xx (AR) y esta a las 23:37 (AR), que ya es 2026-11-08 en UTC. La parte 3 no debe contar estas dos filas como cambio de la ruta de scroll.

**`EstadosConfirmar`** (AE 52176): comparé las dos imágenes. En la parte 1 la tarjeta de confirmación ("No, keep it" / "Yes, delete it") termina y la barra inferior viene después, al final del documento. En esta corrida la barra fija está en la primera pantalla (desde y 1544) y tapa la parte de abajo de la tarjeta. Es la razón esperada, ahora verificada.

La razón "el alto cambia donde una caja `100dvh` se estiraba" **no aparece**: ninguna imagen `built` cambió de tamaño.

### Lados `design` con `FAIL different dimensions` (18) — no esperado

Se esperaba AE 0 en los lados `design` de teléfono. `ae` no puede comparar estos 18 porque el ancho (y en cinco casos 1 px de alto) cambió:

| Filas | Parte 1 | Esta corrida |
|---|---|---|
| `InicioPrimeraVez`, `InicioPrimeraVezOscuro` | 780x2142 | 828x2142 |
| `InicioOnboardingEnCurso`, `…Oscuro` | 780x1098, 780x1096 | 828x1097, 828x1096 |
| `InicioOnboardingCompleto`, `…Oscuro` | 780x1044 | 828x1043, 828x1044 |
| `InicioChecklist`, `InicioChecklistOscuro` | 780x798 | 828x798 |
| `InicioImportado`, `InicioImportadoOscuro` | 780x300 | 828x300 |
| `OnboardingListoOscuro` | 780x1698 | 828x1697 |
| `VentaGuardada`, `VentaGuardadaOscuro` | 684x98 | 780x98 |
| `ClienteNuevo`, `ClienteEditar` | 684x442 | 780x442 |
| `EstadosSinConexion`, `…Oscuro` | 684x248 | 780x247 |
| `EstadosConfirmar` | 684x456 | 780x456 |

Lectura: son filas con un recorte de sección (`clip`). La parte 1 daba un PNG del ancho del recorte; esta corrida da uno del ancho del viewport completo (por ejemplo 828 = 414 CSS, el `design_viewport`; 780 = 390 CSS). Lo vi en `InicioImportado.design.png`: sale con el margen de la página a los lados del recorte. Los pocos casos de 1 px menos de alto (1098 a 1097, 1044 a 1043, 1698 a 1697, 248 a 247) parecen venir de redondear el borde del recorte. Es una lectura, no una comprobación del código. Esto es un cambio de comportamiento en el lado `design` de teléfono con recorte, y la parte 3 debe saberlo antes de comparar.

## Criterios de la tarea que esta evidencia mostraba sin cumplir (SUPERADO: los dos defectos están arreglados y repetida la corrida; ver la última sección)

La cabeza no cambió desde la corrida (el código de la ruta de scroll es el mismo), así que estos dos puntos siguen abiertos y son defectos de `take-shot.mjs`, no de esta evidencia:

1. `OnboardingMensajeTexto130` (lado `built`) ya no captura (sección 2).
2. 18 lados `design` de teléfono con recorte salen del ancho del viewport, no del recorte (sección 3). Causa vista en el código: en la ruta de scroll el recorte sólo fija el rango vertical y cada cuadro es una captura del viewport completo, que `stitch` recorta sólo en vertical.

Cuando esos dos defectos se arreglen, hay que repetir la corrida completa y actualizar este archivo.

## Archivos de esta carpeta (parte 2)

- `part2-phone-sizes.json`: el registro de scratch de los tres tamaños (copia de `InicioHoy`, `InicioOscuro`, `Analisis` y `AnalisisOscuro` con `viewport` 320x568, 375x812 y 430x932), regenerado desde `screens.json`. Se usa con `comparisons.mjs --registry`. La corrida de todo el registro es `compare.sh` con la espera de los hechos subida a 600 s (cambiar `seq 1 240` por `seq 1 1200` en una copia): el cambio es sólo ese número.

- `part2-p2.index.json`: índice de la corrida de todo el registro (171 `captured`, 48 `not-captured`), con cada ruta reducida a su basename.
- `part2-p2-sizes.index.json`: índice de las 12 filas a 320x568, 375x812 y 430x932.
- `ae-part1-part2.txt`: salida de `ae` de la parte 1 contra esta corrida (anterior a los arreglos).
- `part2-p3.index.json`, `part2-p3-sizes.index.json`: índices de la corrida después de los arreglos (cabeza `cc24101a`).
- `ae-part1-part2-fixed.txt`: `ae` de la parte 1 contra esa corrida (las 97 filas de la última sección).
- `ae-b4-p3.txt`: `ae` del código de la parte 1 el mismo día (`b4`) contra esa corrida.

## Estado en `0f96db32`

Revisado de nuevo sobre `0f96db32`: `take-shot.mjs` no cambió desde la corrida (`git diff 1f94db75 HEAD -- scripts/design/take-shot.mjs scripts/design/shot.mjs scripts/design/stitch.mjs` vacío), así que los dos criterios abiertos de arriba siguen abiertos y los números de esta corrida siguen siendo los vigentes. Esta evidencia no se puede cerrar sin el arreglo de la ruta de scroll.

## Corrida después de los dos arreglos (cabeza `cc24101a`)

Los dos defectos de la ruta de scroll se arreglaron en esta tarea (commits `62bfa248` y `cc24101a`):

- **Columnas del recorte.** `scrollPlan` ahora da a cada cuadro `cropLeft` y `cropWidth` (px de dispositivo, redondeados hacia afuera a px CSS enteros) y `stitch` los recorta; el final del recorte también sube a px CSS enteros, como `sectionClip` en `grow`. Así el lado sale del mismo tamaño que antes.
- **`textarea`.** `scrollersInPage` ya no cuenta un `textarea`: `OnboardingMensajeTexto130` (built, 320x844) tenía uno con texto de 87 px en una caja de 56 px en una página que cabe, y `innerScrollMiss` la rechazaba. Antes de este cambio, la ruta `grow` la capturaba. Un `div` con `overflow: auto` sigue rechazado (fixture nuevo).

Corrida nueva de todo el registro sobre `cc24101a` (una app de muestra, `comparisons.mjs --facts … --out …/p3`, 2026-11-08 00:42:04 a 00:58:18), más las 12 filas de los tres tamaños (`--registry part2-phone-sizes.json`, fin 00:59:17). `ae` de la parte 1 (`a3`) contra ella: `ae-part1-part2-fixed.txt`.

- Lado `built`: 172 capturados, como en la parte 1; ninguna fila perdida. `OnboardingMensajeTexto130` está `captured`. Lado `design`: 219.
- **Ningún `FAIL different dimensions`** (eran 18). Las 12 filas de 320x568, 375x812 y 430x932 quedaron `captured` (índices `part2-p3.index.json` y `part2-p3-sizes.index.json`).
- `ae`: 294 lados con AE 0, 97 con AE mayor que 0, 47 `not compared` (todos `no built screen yet`).
- Lados `design`: **todos en AE 0** contra la parte 1, incluidos los 18 que antes daban `FAIL different dimensions`. Las 97 filas con AE mayor que 0 son todas del lado `built`.

### Línea base del mismo día, para separar el día del código

La lista de 97 mezcla dos cosas: la parte 1 corrió el 2026-11-07 y esta corrida el 2026-11-08, y los hechos de la app de muestra dependen del día. Para separarlas corrí el código de la parte 1 el mismo día sobre una app nueva:

- Código: `git archive 1525bf65` (la cabeza de la parte 1 ya fusionada, ancestro de esta rama) extraído en un directorio de scratch, con `web/node_modules` enlazado.
- App: `sample-app.sh --dir <tmp>/app`, una app nueva, que no se había usado en otra captura. Corrida: `node scripts/design/comparisons.mjs --facts <facts> --out ~/.cache/apostrophe/GH-491/b4`, de ese directorio. 2026-11-08 01:18:49 a 01:31:23.
- Comparación: `node scripts/design/ae.mjs ~/.cache/apostrophe/GH-491/b4 ~/.cache/apostrophe/GH-491/p3`, salida en `ae-b4-p3.txt`. Resultado: de las 97 filas, **75 dan AE 0** (el código de la parte 1 y el nuevo dan la misma imagen el mismo día: la diferencia contra la parte 1 es del día) y **22 siguen con AE mayor que 0** (diferencia de código). En `ae-b4-p3.txt`: 219 lados `design` con AE 0, 150 `built` con AE 0, 22 `built` con AE mayor que 0, 47 `not compared` (`no built screen yet`, las mismas de siempre), ningún `FAIL`.
- Las 37 filas de escritorio de la lista (todas `*Compu*`) dan AE 0 contra `b4`: **ninguna cambia por el código**. La ruta `grow` y la de capa no se tocaron y la evidencia lo confirma.

Para los recortes: tomé el rectángulo donde difieren la parte 1 y esta corrida (`a3` contra `p3`) y lo recorté en las dos. Los que abrí: `InicioImportado` (1610), `Ventas` (3209), `NuevaVenta` (2095), `EntradaStock` (2003), `Cobro` (4616) y `NegocioNuevo`. En todos, la diferencia es una fecha: "Today 07/11" y "Today 08/11", "07/11" y "08/11", "…/07/2026" y "…/08/2026", "since 19/10" y "since 20/10". En las demás filas con `b4` en AE 0 no abrí el recorte: sólo digo que el código no lo causa.

### Las 97 filas con AE mayor que 0 (parte 1 contra esta corrida)

Cada fila: lado, viewport, AE de la parte 1 contra esta corrida, AE del código de la parte 1 el mismo día contra esta corrida (`b4`) y la razón. Todas son del lado `built`. 37 de escritorio, 60 de teléfono.

| Fila | Lado | Viewport | AE parte 1 | AE `b4` | Razón para la parte 3 |
|---|---|---|---|---|---|
| `NegocioNuevo` | built | teléfono | 243 | 0 | Día/estado: El vencimiento de la invitación pasa de 14/11 a 15/11 (comparado antes píxel a píxel) |
| `Invitacion` | built | teléfono | 243 | 0 | Día/estado: El vencimiento de la invitación pasa de 14/11 a 15/11 (comparado antes píxel a píxel) |
| `InicioHoy` | built | teléfono | 175497 | 170333 | Código: la barra fija y "+ New sale" pasan del final del documento a la primera pantalla (imagen vista). La diferencia empieza en y 1408 (el botón sobre la barra) |
| `InicioOscuro` | built | teléfono | 175497 | 170333 | Código: la barra fija y "+ New sale" pasan del final del documento a la primera pantalla (imagen vista). La diferencia empieza en y 1408 (el botón sobre la barra) |
| `InicioHoyCompu` | built | escritorio | 5164 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `InicioHoyCompuOscuro` | built | escritorio | 5164 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `InicioPrimeraVez` | built | teléfono | 165030 | 163420 | Código (por la diferencia de `b4`, no abierta): la barra y el botón en la primera pantalla; la diferencia empieza en y 1336 |
| `InicioPrimeraVezCompu` | built | escritorio | 1610 | 0 | Día/estado: La fecha "Today 07/11" pasa a "Today 08/11" (recorte visto en `InicioImportado`; mismo rectángulo en todas las filas con este AE) |
| `InicioPrimeraVezOscuro` | built | teléfono | 165030 | 163420 | Código (por la diferencia de `b4`, no abierta): la barra y el botón en la primera pantalla; la diferencia empieza en y 1336 |
| `InicioOnboardingEnCurso` | built | teléfono | 1610 | 0 | Día/estado: La fecha "Today 07/11" pasa a "Today 08/11" (recorte visto en `InicioImportado`; mismo rectángulo en todas las filas con este AE) |
| `InicioOnboardingEnCursoCompu` | built | escritorio | 1610 | 0 | Día/estado: La fecha "Today 07/11" pasa a "Today 08/11" (recorte visto en `InicioImportado`; mismo rectángulo en todas las filas con este AE) |
| `InicioOnboardingEnCursoOscuro` | built | teléfono | 1610 | 0 | Día/estado: La fecha "Today 07/11" pasa a "Today 08/11" (recorte visto en `InicioImportado`; mismo rectángulo en todas las filas con este AE) |
| `InicioOnboardingCompleto` | built | teléfono | 1610 | 0 | Día/estado: La fecha "Today 07/11" pasa a "Today 08/11" (recorte visto en `InicioImportado`; mismo rectángulo en todas las filas con este AE) |
| `InicioOnboardingCompletoCompu` | built | escritorio | 1610 | 0 | Día/estado: La fecha "Today 07/11" pasa a "Today 08/11" (recorte visto en `InicioImportado`; mismo rectángulo en todas las filas con este AE) |
| `InicioOnboardingCompletoOscuro` | built | teléfono | 1610 | 0 | Día/estado: La fecha "Today 07/11" pasa a "Today 08/11" (recorte visto en `InicioImportado`; mismo rectángulo en todas las filas con este AE) |
| `InicioChecklist` | built | teléfono | 172667 | 171057 | Código (por la diferencia de `b4`, no abierta): la barra y el botón en la primera pantalla; la diferencia empieza en y 1408 |
| `InicioChecklistCompu` | built | escritorio | 1610 | 0 | Día/estado: La fecha "Today 07/11" pasa a "Today 08/11" (recorte visto en `InicioImportado`; mismo rectángulo en todas las filas con este AE) |
| `InicioChecklistOscuro` | built | teléfono | 172667 | 171057 | Código (por la diferencia de `b4`, no abierta): la barra y el botón en la primera pantalla; la diferencia empieza en y 1408 |
| `InicioImportado` | built | teléfono | 1610 | 0 | Día/estado: La fecha "Today 07/11" pasa a "Today 08/11" (recorte visto en `InicioImportado`; mismo rectángulo en todas las filas con este AE) |
| `InicioImportadoCompu` | built | escritorio | 1610 | 0 | Día/estado: La fecha "Today 07/11" pasa a "Today 08/11" (recorte visto en `InicioImportado`; mismo rectángulo en todas las filas con este AE) |
| `InicioImportadoOscuro` | built | teléfono | 1610 | 0 | Día/estado: La fecha "Today 07/11" pasa a "Today 08/11" (recorte visto en `InicioImportado`; mismo rectángulo en todas las filas con este AE) |
| `Ventas` | built | teléfono | 3209 | 0 | Día/estado: La fecha de la lista pasa de "07/11" a "08/11" (recorte visto en `Ventas`) |
| `VentasCompu` | built | escritorio | 3209 | 0 | Día/estado: La fecha de la lista pasa de "07/11" a "08/11" (recorte visto en `Ventas`) |
| `NuevaVenta` | built | teléfono | 2095 | 0 | Día/estado: "Today 07/11" pasa a "Today 08/11" (recorte visto en `NuevaVenta`) |
| `NuevaVentaCliente` | built | teléfono | 2095 | 0 | Día/estado: "Today 07/11" pasa a "Today 08/11" (recorte visto en `NuevaVenta`) |
| `NuevaVentaCompu` | built | escritorio | 2095 | 0 | Día/estado: "Today 07/11" pasa a "Today 08/11" (recorte visto en `NuevaVenta`) |
| `VentaDetalle` | built | teléfono | 1211 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `VentaDetalleCompu` | built | escritorio | 1211 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `VentasOscuro` | built | teléfono | 3209 | 0 | Día/estado: La fecha de la lista pasa de "07/11" a "08/11" (recorte visto en `Ventas`) |
| `VentasCompuOscuro` | built | escritorio | 3209 | 0 | Día/estado: La fecha de la lista pasa de "07/11" a "08/11" (recorte visto en `Ventas`) |
| `NuevaVentaOscuro` | built | teléfono | 2095 | 0 | Día/estado: "Today 07/11" pasa a "Today 08/11" (recorte visto en `NuevaVenta`) |
| `NuevaVentaClienteOscuro` | built | teléfono | 2095 | 0 | Día/estado: "Today 07/11" pasa a "Today 08/11" (recorte visto en `NuevaVenta`) |
| `NuevaVentaCompuOscuro` | built | escritorio | 2095 | 0 | Día/estado: "Today 07/11" pasa a "Today 08/11" (recorte visto en `NuevaVenta`) |
| `VentaDetalleOscuro` | built | teléfono | 1211 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `VentaDetalleCompuOscuro` | built | escritorio | 1211 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `VentaGuardada` | built | teléfono | 16703 | 15904 | Código (por la diferencia de `b4`, no abierta): la barra fija en la primera pantalla; la diferencia empieza en y 1544 (= 1688 − 144) y termina donde estaba la barra al final del documento |
| `VentaGuardadaOscuro` | built | teléfono | 16703 | 15904 | Código (por la diferencia de `b4`, no abierta): la barra fija en la primera pantalla; la diferencia empieza en y 1544 (= 1688 − 144) y termina donde estaba la barra al final del documento |
| `Clientes` | built | teléfono | 187919 | 180347 | Código (por la diferencia de `b4`, no abierta): la barra y el botón en la primera pantalla; la diferencia empieza en y 1408 |
| `ClientesCompu` | built | escritorio | 14879 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `ClienteFicha` | built | teléfono | 14515 | 9872 | Código (por la diferencia de `b4`, no abierta): la barra fija en la primera pantalla; la diferencia empieza en y 1544 (= 1688 − 144) y termina donde estaba la barra al final del documento |
| `Cobro` | built | teléfono | 4616 | 0 | Día/estado: "since 19/10" pasa a "since 20/10" (recorte visto en `Cobro`) |
| `CobroCompu` | built | escritorio | 16120 | 0 | Día/estado: Lo mismo en escritorio (fecha relativa de `Cobro`) |
| `ClientesOscuro` | built | teléfono | 187919 | 180347 | Código (por la diferencia de `b4`, no abierta): la barra y el botón en la primera pantalla; la diferencia empieza en y 1408 |
| `ClientesCompuOscuro` | built | escritorio | 14879 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `ClienteFichaOscuro` | built | teléfono | 14515 | 9872 | Código (por la diferencia de `b4`, no abierta): la barra fija en la primera pantalla; la diferencia empieza en y 1544 (= 1688 − 144) y termina donde estaba la barra al final del documento |
| `CobroOscuro` | built | teléfono | 4616 | 0 | Día/estado: "since 19/10" pasa a "since 20/10" (recorte visto en `Cobro`) |
| `CobroCompuOscuro` | built | escritorio | 16120 | 0 | Día/estado: Lo mismo en escritorio (fecha relativa de `Cobro`) |
| `EntradaStock` | built | teléfono | 2003 | 0 | Día/estado: La fecha "…/07/2026" pasa a "…/08/2026" (recorte visto en `EntradaStock`) |
| `EntradaStockEditar` | built | teléfono | 289 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `EntradaStockCompu` | built | escritorio | 2212 | 0 | Día/estado: Lo mismo que 2003 en escritorio (mismo texto, mismo alto de recorte) |
| `EntradaStockSinEntradas` | built | teléfono | 2003 | 0 | Día/estado: La fecha "…/07/2026" pasa a "…/08/2026" (recorte visto en `EntradaStock`) |
| `EntradaStockSinEntradasOscuro` | built | teléfono | 2003 | 0 | Día/estado: La fecha "…/07/2026" pasa a "…/08/2026" (recorte visto en `EntradaStock`) |
| `EntradaStockSinEntradasCompu` | built | escritorio | 2212 | 0 | Día/estado: Lo mismo que 2003 en escritorio (mismo texto, mismo alto de recorte) |
| `EntradaStockSinEntradasCompuOscuro` | built | escritorio | 2212 | 0 | Día/estado: Lo mismo que 2003 en escritorio (mismo texto, mismo alto de recorte) |
| `TodasLasEntradas` | built | teléfono | 9020 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `TodasLasEntradasVariedad` | built | teléfono | 11573 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `SacarDelStock` | built | teléfono | 2003 | 0 | Día/estado: La fecha "…/07/2026" pasa a "…/08/2026" (recorte visto en `EntradaStock`) |
| `SacarDelStockCompu` | built | escritorio | 2212 | 0 | Día/estado: Lo mismo que 2003 en escritorio (mismo texto, mismo alto de recorte) |
| `RetiroDetalle` | built | teléfono | 1158 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `VerTodas` | built | teléfono | 316 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `PrecioNuevo` | built | teléfono | 1108 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `PrecioNuevoCompu` | built | escritorio | 1384 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `PrecioNuevoOscuro` | built | teléfono | 1108 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `PrecioNuevoCompuOscuro` | built | escritorio | 1384 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `Variedades` | built | teléfono | 168857 | 168736 | Código (por la diferencia de `b4`, no abierta): la barra y el botón en la primera pantalla; la diferencia empieza en y 1408 |
| `VariedadesCompu` | built | escritorio | 8583 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `VariedadDetalle` | built | teléfono | 33106 | 24799 | Código (por la diferencia de `b4`, no abierta): la barra fija en la primera pantalla; la diferencia empieza en y 1544 (= 1688 − 144) y termina donde estaba la barra al final del documento |
| `ArchivadasCompu` | built | escritorio | 632 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `Gastos` | built | teléfono | 879 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `GastosCompu` | built | escritorio | 879 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `GastoNuevo` | built | teléfono | 2003 | 0 | Día/estado: La fecha "…/07/2026" pasa a "…/08/2026" (recorte visto en `EntradaStock`) |
| `GastoNuevoCompu` | built | escritorio | 2212 | 0 | Día/estado: Lo mismo que 2003 en escritorio (mismo texto, mismo alto de recorte) |
| `Catalogo` | built | teléfono | 26922 | 26922 | Código (por la diferencia de `b4`, no abierta): la barra fija en la primera pantalla; la diferencia empieza en y 1544 (= 1688 − 144) y termina donde estaba la barra al final del documento |
| `Analisis` | built | teléfono | 225088 | 167122 | Código (por la diferencia de `b4`, no abierta): la barra y el botón en la primera pantalla; la diferencia empieza en y 1408 |
| `AnalisisCompu` | built | escritorio | 49948 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `AnalisisOscuro` | built | teléfono | 225088 | 167122 | Código (por la diferencia de `b4`, no abierta): la barra y el botón en la primera pantalla; la diferencia empieza en y 1408 |
| `AnalisisCompuOscuro` | built | escritorio | 49948 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `EstadosSinConexion` | built | teléfono | 5970 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `EstadosSinConexionCompu` | built | escritorio | 3465 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `EstadosConfirmar` | built | teléfono | 56203 | 52176 | Código: la barra fija pasa a la primera pantalla (y 1544 = 1688 − 144) y tapa el pie de la tarjeta (imágenes vistas) |
| `VariedadDetalleOscuro` | built | teléfono | 33106 | 24799 | Código (por la diferencia de `b4`, no abierta): la barra fija en la primera pantalla; la diferencia empieza en y 1544 (= 1688 − 144) y termina donde estaba la barra al final del documento |
| `ArchivadasCompuOscuro` | built | escritorio | 632 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `CatalogoOscuro` | built | teléfono | 27551 | 27551 | Código (por la diferencia de `b4`, no abierta): la barra fija en la primera pantalla; la diferencia empieza en y 1544 (= 1688 − 144) y termina donde estaba la barra al final del documento |
| `VerTodasOscuro` | built | teléfono | 316 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `TodasLasEntradasOscuro` | built | teléfono | 13973 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `TodasLasEntradasVariedadOscuro` | built | teléfono | 11573 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `RetiroDetalleOscuro` | built | teléfono | 1158 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `EstadosSinConexionOscuro` | built | teléfono | 5970 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `EstadosSinConexionCompuOscuro` | built | escritorio | 3465 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `VariedadArchivada` | built | teléfono | 107799 | 107167 | Código (por la diferencia de `b4`, no abierta): la barra fija en la primera pantalla; la diferencia empieza en y 1544 (= 1688 − 144) y termina donde estaba la barra al final del documento |
| `VariedadArchivadaOscuro` | built | teléfono | 107799 | 107167 | Código (por la diferencia de `b4`, no abierta): la barra fija en la primera pantalla; la diferencia empieza en y 1544 (= 1688 − 144) y termina donde estaba la barra al final del documento |
| `VariedadArchivadaCompu` | built | escritorio | 632 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `VariedadArchivadaCompuOscuro` | built | escritorio | 632 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `InicioHoyCompu960` | built | escritorio | 5164 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `InicioHoyCompu960Texto130` | built | escritorio | 91185 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `InicioHoyCompuTexto130` | built | escritorio | 8041 | 0 | Día/estado: con el código de la parte 1 en una app nueva del mismo día (`b4`) esta fila da AE 0 contra la corrida nueva; el recorte no lo abrí |
| `GastoNuevoOscuro` | built | teléfono | 2003 | 0 | Día/estado: La fecha "…/07/2026" pasa a "…/08/2026" (recorte visto en `EntradaStock`) |

Las 22 filas de código, de teléfono, tienen el mismo tamaño que en la parte 1 y la diferencia empieza en y 1544 (= 1688 − 144, el alto del teléfono menos la barra) o en y 1408 (el botón "+ New sale" sobre la barra). Sólo abrí `InicioHoy` y `EstadosConfirmar`. Las otras 20 las explico por la caja de la diferencia, no por la imagen. `Catalogo` y `CatalogoOscuro` dan el mismo AE contra la parte 1 y contra `b4`: son código puro, sin fecha. `NegocioNuevo` e `Invitacion` quedan en AE 243 por el vencimiento de la invitación.
