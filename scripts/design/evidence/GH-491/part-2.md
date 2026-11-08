# GH-491 parte 2: evidencia de la captura de teléfono por scroll y unión

Sin cambios de código. Esta evidencia compara una corrida nueva de todo el registro, hecha con la rama en su cabeza, contra la corrida `after` de la parte 1.

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

## 2. Comprobación de regresión

Por nombre de pantalla, fila por fila (no sólo por conteo):

- Lado `design`: 219 capturados en las dos corridas.
- Lado `built`: part 1 `after` 172, esta corrida 171. No se ganó ninguna fila.
- **Una fila que capturaba ya no captura: `OnboardingMensajeTexto130` (lado `built`, 320x844, `text_scale` 1.3).** Razón registrada: `shot: the page scrolls inside an element (built)`. En la parte 1 estaba `captured`. **Es un defecto de la ruta de scroll** (la razón es `innerScrollMiss`: un elemento que no es capa se desplaza y el documento no). No se arregló, según lo pedido. No repetí la fila sola, así que no sé si es siempre o intermitente.
- Las 47 filas `not-captured` restantes son todas `shot: no built screen yet (built)`, las mismas de la parte 1. Ninguna fila falla por `did not settle`.
- Escritorio: todas las filas con viewport de 900 px o más (`*Compu*`, `*Compu960*`) siguen capturando y dan AE 0.

## 3. Lista de AE mayor que 0

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

## Criterios de la tarea que esta evidencia muestra sin cumplir

La cabeza no cambió desde la corrida (el código de la ruta de scroll es el mismo), así que estos dos puntos siguen abiertos y son defectos de `take-shot.mjs`, no de esta evidencia:

1. `OnboardingMensajeTexto130` (lado `built`) ya no captura (sección 2).
2. 18 lados `design` de teléfono con recorte salen del ancho del viewport, no del recorte (sección 3). Causa vista en el código: en la ruta de scroll el recorte sólo fija el rango vertical y cada cuadro es una captura del viewport completo, que `stitch` recorta sólo en vertical.

Cuando esos dos defectos se arreglen, hay que repetir la corrida completa y actualizar este archivo.

## Archivos de esta carpeta (parte 2)

- `part2-phone-sizes.json`: el registro de scratch de los tres tamaños (copia de `InicioHoy`, `InicioOscuro`, `Analisis` y `AnalisisOscuro` con `viewport` 320x568, 375x812 y 430x932), regenerado desde `screens.json`. Se usa con `comparisons.mjs --registry`. La corrida de todo el registro es `compare.sh` con la espera de los hechos subida a 600 s (cambiar `seq 1 240` por `seq 1 1200` en una copia): el cambio es sólo ese número.

- `part2-p2.index.json`: índice de la corrida de todo el registro (171 `captured`, 48 `not-captured`), con cada ruta reducida a su basename.
- `part2-p2-sizes.index.json`: índice de las 12 filas a 320x568, 375x812 y 430x932.
- `ae-part1-part2.txt`: salida de `ae` de la parte 1 contra esta corrida.
