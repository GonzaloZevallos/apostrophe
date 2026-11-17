# GH-491 parte 3: la captura de teléfono, lo que quedó y lo que se juzgó

Esta evidencia reúne, en un solo lugar, lo que las partes 1 y 2 de GH-491 midieron sobre la herramienta de `scripts/design/` y lo que la parte 3 agregó: el censo de elementos fijados y la mirada de cuatro filas. No cambia ningún `.mjs`, ningún test ni ningún archivo de la app. La regla de la herramienta está en [design-capture.md](../product/design-capture.md). Los PNG no están en git: las corridas viven en `~/.cache/apostrophe/GH-491/`, y cada cifra de abajo sale de un archivo commiteado en [`scripts/design/evidence/GH-491/`](../../scripts/design/evidence/GH-491/) o del encabezado de `web/src/design/take-shot.test.ts`; la fuente va al lado de cada una.

## 1. Las corridas en directorio nuevo

Cada corrida se hizo sobre una app de muestra nueva (`scripts/design/sample-app.sh --dir <tmp>/app`) y sobre todo el registro (219 filas). Cifras de [`part-1.md`](../../scripts/design/evidence/GH-491/part-1.md) (sección "Las tres corridas" y "Conjuntos capturados"), [`part-2.md`](../../scripts/design/evidence/GH-491/part-2.md) (sección "Corrida después de los dos arreglos") y de los `*.index.json` de esa carpeta, contados otra vez para esta parte.

| Corrida | Código | Índice | Lado `design` | Lado `built` | Filas con las dos imágenes | `captured` / `not-captured` |
|---|---|---|---|---|---|---|
| Línea base de master, corrida 1 | base `e0d59766` | [`master-1.index.json`](../../scripts/design/evidence/GH-491/master-1.index.json) | 219 | 169 | 169 | sin campo `capture` (código sin cambios) |
| Línea base de master, corrida 2 | base `e0d59766` | [`master-2.index.json`](../../scripts/design/evidence/GH-491/master-2.index.json) | 219 | 171 | 171 | sin campo `capture` |
| Después de la página calma (parte 1) | rama en `349c9b67` | [`after.index.json`](../../scripts/design/evidence/GH-491/after.index.json) | 219 | 172 | 172 | 172 / 47 |
| Después de scroll y unión (parte 2, cabeza `cc24101a`) | rama en `cc24101a` | [`part2-p3.index.json`](../../scripts/design/evidence/GH-491/part2-p3.index.json) | 219 | 172 | 172 | 172 / 47 |

- Las 47 filas `not-captured` de `after` y de `part2-p3` tienen todas la razón `shot: no built screen yet (built)` (conteo de `reasons` en los dos índices).
- Parte 1 (`part-1.md`, "Conjuntos capturados"): el conjunto de `after` es igual a la unión de las dos corridas `master`; el lado `built` de `master` no es estable (`ClienteFichaOscuro`, `InicioHoy`, `Catalogo` y `CatalogoOscuro` capturan en una corrida y en la otra no), y `after` capturó las cuatro.
- Parte 2 (`part-2.md`, "Corrida después de los dos arreglos"): `ae` de la parte 1 contra la corrida nueva da 294 lados con AE 0, 97 con AE mayor que 0 y 47 `not compared`, y ningún `FAIL different dimensions`. La corrida de las doce filas de teléfono a 320x568, 375x812 y 430x932 es [`part2-p3-sizes.index.json`](../../scripts/design/evidence/GH-491/part2-p3-sizes.index.json): las doce `captured`.
- Salida de `ae` por pareja: [`ae-master-1-after.txt`](../../scripts/design/evidence/GH-491/ae-master-1-after.txt), [`ae-master-2-after.txt`](../../scripts/design/evidence/GH-491/ae-master-2-after.txt), [`ae-master-1-master-2.txt`](../../scripts/design/evidence/GH-491/ae-master-1-master-2.txt), [`ae-part1-part2-fixed.txt`](../../scripts/design/evidence/GH-491/ae-part1-part2-fixed.txt) (parte 1 contra parte 2) y [`ae-b4-p3.txt`](../../scripts/design/evidence/GH-491/ae-b4-p3.txt) (el código de la parte 1 el mismo día, `b4`, contra la parte 2).
- [`ae-part1-part2.txt`](../../scripts/design/evidence/GH-491/ae-part1-part2.txt) es de la corrida anterior a los dos arreglos de la ruta de scroll: está superada (`part-2.md` la marca así) y no se juzga acá.

## 2. Filas con AE mayor que 0 entre corridas consecutivas

**Master contra la parte 1 (`after`).** Ninguna fila ni lado da AE mayor que 0 en las tres parejas (`part-1.md`, "Filas y lados con AE mayor que 0": "Ninguno"). Nada que juzgar.

**La parte 1 contra la parte 2.** 97 filas, todas del lado `built` (37 de escritorio, 60 de teléfono), tomadas de `part-2.md` desde la línea 137. Cada una lleva una de tres etiquetas:

- `expected (seen)`: las imágenes se abrieron en esta tarea (parte 3) y la diferencia es la esperada.
- `expected (inferred: <base>)`: esperada por la base que la parte 2 le dio, que se conserva y se nombra; la fila no se abrió en esta tarea.
- `unexpected`: ninguna.

Columnas: fila, lado, viewport, AE de la parte 1 contra la parte 2, AE de `b4` contra la parte 2 (el código de la parte 1 el mismo día) y la línea de `part-2.md` de donde sale la fila.

**Cuentas.** `expected (seen)`: 4. `expected (inferred: …)`: 93. `unexpected`: 0. Total 97. **Sólo las 4 `seen` cumplen "juzgadas a ojo"**; las 93 restantes dependen de la base que dio la parte 2 (la medida de `b4` y, en algunas, un recorte visto de otra fila) y se dicen como tales, no como vistas.

| Fila | Lado | Viewport | AE parte 1 | AE `b4` | Etiqueta | Línea de `part-2.md` |
|---|---|---|---|---|---|---|
| `NegocioNuevo` | built | teléfono | 243 | 0 | expected (inferred: la parte 2 comparó los PNG píxel a píxel y leyó el recorte; `b4` da AE 0; no se reabrió acá) | [143](../../scripts/design/evidence/GH-491/part-2.md#L143) |
| `Invitacion` | built | teléfono | 243 | 0 | expected (seen) | [144](../../scripts/design/evidence/GH-491/part-2.md#L144) |
| `InicioHoy` | built | teléfono | 175497 | 170333 | expected (inferred: la parte 2 vio la imagen de `InicioHoy` (AE `b4` mayor que 0 igual); esta fila no se abrió) | [145](../../scripts/design/evidence/GH-491/part-2.md#L145) |
| `InicioOscuro` | built | teléfono | 175497 | 170333 | expected (inferred: la parte 2 vio la imagen de `InicioHoy` (AE `b4` mayor que 0 igual); esta fila no se abrió) | [146](../../scripts/design/evidence/GH-491/part-2.md#L146) |
| `InicioHoyCompu` | built | escritorio | 5164 | 0 | expected (seen) | [147](../../scripts/design/evidence/GH-491/part-2.md#L147) |
| `InicioHoyCompuOscuro` | built | escritorio | 5164 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [148](../../scripts/design/evidence/GH-491/part-2.md#L148) |
| `InicioPrimeraVez` | built | teléfono | 165030 | 163420 | expected (seen) | [149](../../scripts/design/evidence/GH-491/part-2.md#L149) |
| `InicioPrimeraVezCompu` | built | escritorio | 1610 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `InicioImportado` y el rectángulo es el mismo; esta fila no se abrió) | [150](../../scripts/design/evidence/GH-491/part-2.md#L150) |
| `InicioPrimeraVezOscuro` | built | teléfono | 165030 | 163420 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1336; imagen no abierta) | [151](../../scripts/design/evidence/GH-491/part-2.md#L151) |
| `InicioOnboardingEnCurso` | built | teléfono | 1610 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `InicioImportado` y el rectángulo es el mismo; esta fila no se abrió) | [152](../../scripts/design/evidence/GH-491/part-2.md#L152) |
| `InicioOnboardingEnCursoCompu` | built | escritorio | 1610 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `InicioImportado` y el rectángulo es el mismo; esta fila no se abrió) | [153](../../scripts/design/evidence/GH-491/part-2.md#L153) |
| `InicioOnboardingEnCursoOscuro` | built | teléfono | 1610 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `InicioImportado` y el rectángulo es el mismo; esta fila no se abrió) | [154](../../scripts/design/evidence/GH-491/part-2.md#L154) |
| `InicioOnboardingCompleto` | built | teléfono | 1610 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `InicioImportado` y el rectángulo es el mismo; esta fila no se abrió) | [155](../../scripts/design/evidence/GH-491/part-2.md#L155) |
| `InicioOnboardingCompletoCompu` | built | escritorio | 1610 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `InicioImportado` y el rectángulo es el mismo; esta fila no se abrió) | [156](../../scripts/design/evidence/GH-491/part-2.md#L156) |
| `InicioOnboardingCompletoOscuro` | built | teléfono | 1610 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `InicioImportado` y el rectángulo es el mismo; esta fila no se abrió) | [157](../../scripts/design/evidence/GH-491/part-2.md#L157) |
| `InicioChecklist` | built | teléfono | 172667 | 171057 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1408; imagen no abierta) | [158](../../scripts/design/evidence/GH-491/part-2.md#L158) |
| `InicioChecklistCompu` | built | escritorio | 1610 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `InicioImportado` y el rectángulo es el mismo; esta fila no se abrió) | [159](../../scripts/design/evidence/GH-491/part-2.md#L159) |
| `InicioChecklistOscuro` | built | teléfono | 172667 | 171057 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1408; imagen no abierta) | [160](../../scripts/design/evidence/GH-491/part-2.md#L160) |
| `InicioImportado` | built | teléfono | 1610 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `InicioImportado` y el rectángulo es el mismo; esta fila no se abrió) | [161](../../scripts/design/evidence/GH-491/part-2.md#L161) |
| `InicioImportadoCompu` | built | escritorio | 1610 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `InicioImportado` y el rectángulo es el mismo; esta fila no se abrió) | [162](../../scripts/design/evidence/GH-491/part-2.md#L162) |
| `InicioImportadoOscuro` | built | teléfono | 1610 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `InicioImportado` y el rectángulo es el mismo; esta fila no se abrió) | [163](../../scripts/design/evidence/GH-491/part-2.md#L163) |
| `Ventas` | built | teléfono | 3209 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `Ventas` y el rectángulo es el mismo; esta fila no se abrió) | [164](../../scripts/design/evidence/GH-491/part-2.md#L164) |
| `VentasCompu` | built | escritorio | 3209 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `Ventas` y el rectángulo es el mismo; esta fila no se abrió) | [165](../../scripts/design/evidence/GH-491/part-2.md#L165) |
| `NuevaVenta` | built | teléfono | 2095 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `NuevaVenta` y el rectángulo es el mismo; esta fila no se abrió) | [166](../../scripts/design/evidence/GH-491/part-2.md#L166) |
| `NuevaVentaCliente` | built | teléfono | 2095 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `NuevaVenta` y el rectángulo es el mismo; esta fila no se abrió) | [167](../../scripts/design/evidence/GH-491/part-2.md#L167) |
| `NuevaVentaCompu` | built | escritorio | 2095 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `NuevaVenta` y el rectángulo es el mismo; esta fila no se abrió) | [168](../../scripts/design/evidence/GH-491/part-2.md#L168) |
| `VentaDetalle` | built | teléfono | 1211 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [169](../../scripts/design/evidence/GH-491/part-2.md#L169) |
| `VentaDetalleCompu` | built | escritorio | 1211 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [170](../../scripts/design/evidence/GH-491/part-2.md#L170) |
| `VentasOscuro` | built | teléfono | 3209 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `Ventas` y el rectángulo es el mismo; esta fila no se abrió) | [171](../../scripts/design/evidence/GH-491/part-2.md#L171) |
| `VentasCompuOscuro` | built | escritorio | 3209 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `Ventas` y el rectángulo es el mismo; esta fila no se abrió) | [172](../../scripts/design/evidence/GH-491/part-2.md#L172) |
| `NuevaVentaOscuro` | built | teléfono | 2095 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `NuevaVenta` y el rectángulo es el mismo; esta fila no se abrió) | [173](../../scripts/design/evidence/GH-491/part-2.md#L173) |
| `NuevaVentaClienteOscuro` | built | teléfono | 2095 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `NuevaVenta` y el rectángulo es el mismo; esta fila no se abrió) | [174](../../scripts/design/evidence/GH-491/part-2.md#L174) |
| `NuevaVentaCompuOscuro` | built | escritorio | 2095 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `NuevaVenta` y el rectángulo es el mismo; esta fila no se abrió) | [175](../../scripts/design/evidence/GH-491/part-2.md#L175) |
| `VentaDetalleOscuro` | built | teléfono | 1211 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [176](../../scripts/design/evidence/GH-491/part-2.md#L176) |
| `VentaDetalleCompuOscuro` | built | escritorio | 1211 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [177](../../scripts/design/evidence/GH-491/part-2.md#L177) |
| `VentaGuardada` | built | teléfono | 16703 | 15904 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1544; imagen no abierta) | [178](../../scripts/design/evidence/GH-491/part-2.md#L178) |
| `VentaGuardadaOscuro` | built | teléfono | 16703 | 15904 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1544; imagen no abierta) | [179](../../scripts/design/evidence/GH-491/part-2.md#L179) |
| `Clientes` | built | teléfono | 187919 | 180347 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1408; imagen no abierta) | [180](../../scripts/design/evidence/GH-491/part-2.md#L180) |
| `ClientesCompu` | built | escritorio | 14879 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [181](../../scripts/design/evidence/GH-491/part-2.md#L181) |
| `ClienteFicha` | built | teléfono | 14515 | 9872 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1544; imagen no abierta) | [182](../../scripts/design/evidence/GH-491/part-2.md#L182) |
| `Cobro` | built | teléfono | 4616 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `Cobro` y el rectángulo es el mismo; esta fila no se abrió) | [183](../../scripts/design/evidence/GH-491/part-2.md#L183) |
| `CobroCompu` | built | escritorio | 16120 | 0 | expected (inferred: `b4` da AE 0; mismo texto y mismo alto de recorte que el recorte que la parte 2 vio en `EntradaStock` o `Cobro`) | [184](../../scripts/design/evidence/GH-491/part-2.md#L184) |
| `ClientesOscuro` | built | teléfono | 187919 | 180347 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1408; imagen no abierta) | [185](../../scripts/design/evidence/GH-491/part-2.md#L185) |
| `ClientesCompuOscuro` | built | escritorio | 14879 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [186](../../scripts/design/evidence/GH-491/part-2.md#L186) |
| `ClienteFichaOscuro` | built | teléfono | 14515 | 9872 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1544; imagen no abierta) | [187](../../scripts/design/evidence/GH-491/part-2.md#L187) |
| `CobroOscuro` | built | teléfono | 4616 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `Cobro` y el rectángulo es el mismo; esta fila no se abrió) | [188](../../scripts/design/evidence/GH-491/part-2.md#L188) |
| `CobroCompuOscuro` | built | escritorio | 16120 | 0 | expected (inferred: `b4` da AE 0; mismo texto y mismo alto de recorte que el recorte que la parte 2 vio en `EntradaStock` o `Cobro`) | [189](../../scripts/design/evidence/GH-491/part-2.md#L189) |
| `EntradaStock` | built | teléfono | 2003 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `EntradaStock` y el rectángulo es el mismo; esta fila no se abrió) | [190](../../scripts/design/evidence/GH-491/part-2.md#L190) |
| `EntradaStockEditar` | built | teléfono | 289 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [191](../../scripts/design/evidence/GH-491/part-2.md#L191) |
| `EntradaStockCompu` | built | escritorio | 2212 | 0 | expected (inferred: `b4` da AE 0; mismo texto y mismo alto de recorte que el recorte que la parte 2 vio en `EntradaStock` o `Cobro`) | [192](../../scripts/design/evidence/GH-491/part-2.md#L192) |
| `EntradaStockSinEntradas` | built | teléfono | 2003 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `EntradaStock` y el rectángulo es el mismo; esta fila no se abrió) | [193](../../scripts/design/evidence/GH-491/part-2.md#L193) |
| `EntradaStockSinEntradasOscuro` | built | teléfono | 2003 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `EntradaStock` y el rectángulo es el mismo; esta fila no se abrió) | [194](../../scripts/design/evidence/GH-491/part-2.md#L194) |
| `EntradaStockSinEntradasCompu` | built | escritorio | 2212 | 0 | expected (inferred: `b4` da AE 0; mismo texto y mismo alto de recorte que el recorte que la parte 2 vio en `EntradaStock` o `Cobro`) | [195](../../scripts/design/evidence/GH-491/part-2.md#L195) |
| `EntradaStockSinEntradasCompuOscuro` | built | escritorio | 2212 | 0 | expected (inferred: `b4` da AE 0; mismo texto y mismo alto de recorte que el recorte que la parte 2 vio en `EntradaStock` o `Cobro`) | [196](../../scripts/design/evidence/GH-491/part-2.md#L196) |
| `TodasLasEntradas` | built | teléfono | 9020 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [197](../../scripts/design/evidence/GH-491/part-2.md#L197) |
| `TodasLasEntradasVariedad` | built | teléfono | 11573 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [198](../../scripts/design/evidence/GH-491/part-2.md#L198) |
| `SacarDelStock` | built | teléfono | 2003 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `EntradaStock` y el rectángulo es el mismo; esta fila no se abrió) | [199](../../scripts/design/evidence/GH-491/part-2.md#L199) |
| `SacarDelStockCompu` | built | escritorio | 2212 | 0 | expected (inferred: `b4` da AE 0; mismo texto y mismo alto de recorte que el recorte que la parte 2 vio en `EntradaStock` o `Cobro`) | [200](../../scripts/design/evidence/GH-491/part-2.md#L200) |
| `RetiroDetalle` | built | teléfono | 1158 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [201](../../scripts/design/evidence/GH-491/part-2.md#L201) |
| `VerTodas` | built | teléfono | 316 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [202](../../scripts/design/evidence/GH-491/part-2.md#L202) |
| `PrecioNuevo` | built | teléfono | 1108 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [203](../../scripts/design/evidence/GH-491/part-2.md#L203) |
| `PrecioNuevoCompu` | built | escritorio | 1384 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [204](../../scripts/design/evidence/GH-491/part-2.md#L204) |
| `PrecioNuevoOscuro` | built | teléfono | 1108 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [205](../../scripts/design/evidence/GH-491/part-2.md#L205) |
| `PrecioNuevoCompuOscuro` | built | escritorio | 1384 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [206](../../scripts/design/evidence/GH-491/part-2.md#L206) |
| `Variedades` | built | teléfono | 168857 | 168736 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1408; imagen no abierta) | [207](../../scripts/design/evidence/GH-491/part-2.md#L207) |
| `VariedadesCompu` | built | escritorio | 8583 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [208](../../scripts/design/evidence/GH-491/part-2.md#L208) |
| `VariedadDetalle` | built | teléfono | 33106 | 24799 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1544; imagen no abierta) | [209](../../scripts/design/evidence/GH-491/part-2.md#L209) |
| `ArchivadasCompu` | built | escritorio | 632 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [210](../../scripts/design/evidence/GH-491/part-2.md#L210) |
| `Gastos` | built | teléfono | 879 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [211](../../scripts/design/evidence/GH-491/part-2.md#L211) |
| `GastosCompu` | built | escritorio | 879 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [212](../../scripts/design/evidence/GH-491/part-2.md#L212) |
| `GastoNuevo` | built | teléfono | 2003 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `EntradaStock` y el rectángulo es el mismo; esta fila no se abrió) | [213](../../scripts/design/evidence/GH-491/part-2.md#L213) |
| `GastoNuevoCompu` | built | escritorio | 2212 | 0 | expected (inferred: `b4` da AE 0; mismo texto y mismo alto de recorte que el recorte que la parte 2 vio en `EntradaStock` o `Cobro`) | [214](../../scripts/design/evidence/GH-491/part-2.md#L214) |
| `Catalogo` | built | teléfono | 26922 | 26922 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1544; imagen no abierta) | [215](../../scripts/design/evidence/GH-491/part-2.md#L215) |
| `Analisis` | built | teléfono | 225088 | 167122 | expected (seen) | [216](../../scripts/design/evidence/GH-491/part-2.md#L216) |
| `AnalisisCompu` | built | escritorio | 49948 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [217](../../scripts/design/evidence/GH-491/part-2.md#L217) |
| `AnalisisOscuro` | built | teléfono | 225088 | 167122 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1408; imagen no abierta) | [218](../../scripts/design/evidence/GH-491/part-2.md#L218) |
| `AnalisisCompuOscuro` | built | escritorio | 49948 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [219](../../scripts/design/evidence/GH-491/part-2.md#L219) |
| `EstadosSinConexion` | built | teléfono | 5970 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [220](../../scripts/design/evidence/GH-491/part-2.md#L220) |
| `EstadosSinConexionCompu` | built | escritorio | 3465 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [221](../../scripts/design/evidence/GH-491/part-2.md#L221) |
| `EstadosConfirmar` | built | teléfono | 56203 | 52176 | expected (inferred: la parte 2 vio las imágenes de `EstadosConfirmar`; no se reabrieron acá) | [222](../../scripts/design/evidence/GH-491/part-2.md#L222) |
| `VariedadDetalleOscuro` | built | teléfono | 33106 | 24799 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1544; imagen no abierta) | [223](../../scripts/design/evidence/GH-491/part-2.md#L223) |
| `ArchivadasCompuOscuro` | built | escritorio | 632 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [224](../../scripts/design/evidence/GH-491/part-2.md#L224) |
| `CatalogoOscuro` | built | teléfono | 27551 | 27551 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1544; imagen no abierta) | [225](../../scripts/design/evidence/GH-491/part-2.md#L225) |
| `VerTodasOscuro` | built | teléfono | 316 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [226](../../scripts/design/evidence/GH-491/part-2.md#L226) |
| `TodasLasEntradasOscuro` | built | teléfono | 13973 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [227](../../scripts/design/evidence/GH-491/part-2.md#L227) |
| `TodasLasEntradasVariedadOscuro` | built | teléfono | 11573 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [228](../../scripts/design/evidence/GH-491/part-2.md#L228) |
| `RetiroDetalleOscuro` | built | teléfono | 1158 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [229](../../scripts/design/evidence/GH-491/part-2.md#L229) |
| `EstadosSinConexionOscuro` | built | teléfono | 5970 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [230](../../scripts/design/evidence/GH-491/part-2.md#L230) |
| `EstadosSinConexionCompuOscuro` | built | escritorio | 3465 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [231](../../scripts/design/evidence/GH-491/part-2.md#L231) |
| `VariedadArchivada` | built | teléfono | 107799 | 107167 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1544; imagen no abierta) | [232](../../scripts/design/evidence/GH-491/part-2.md#L232) |
| `VariedadArchivadaOscuro` | built | teléfono | 107799 | 107167 | expected (inferred: AE `b4` mayor que 0, la caja de la diferencia empieza en y 1544; imagen no abierta) | [233](../../scripts/design/evidence/GH-491/part-2.md#L233) |
| `VariedadArchivadaCompu` | built | escritorio | 632 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [234](../../scripts/design/evidence/GH-491/part-2.md#L234) |
| `VariedadArchivadaCompuOscuro` | built | escritorio | 632 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [235](../../scripts/design/evidence/GH-491/part-2.md#L235) |
| `InicioHoyCompu960` | built | escritorio | 5164 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [236](../../scripts/design/evidence/GH-491/part-2.md#L236) |
| `InicioHoyCompu960Texto130` | built | escritorio | 91185 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [237](../../scripts/design/evidence/GH-491/part-2.md#L237) |
| `InicioHoyCompuTexto130` | built | escritorio | 8041 | 0 | expected (inferred: `b4` da AE 0 el mismo día; el recorte no se abrió en la parte 2 ni acá) | [238](../../scripts/design/evidence/GH-491/part-2.md#L238) |
| `GastoNuevoOscuro` | built | teléfono | 2003 | 0 | expected (inferred: `b4` da AE 0; la parte 2 vio el recorte de `EntradaStock` y el rectángulo es el mismo; esta fila no se abrió) | [239](../../scripts/design/evidence/GH-491/part-2.md#L239) |

### Las cuatro filas que se abrieron en esta tarea

Las corridas `a3` (código de la parte 1, 2026-11-07), `b4` (código de la parte 1, 2026-11-08) y `p3` (cabeza `cc24101a`, 2026-11-08) seguían en `~/.cache/apostrophe/GH-491/`. Abrí una imagen por fila, recortada donde los dos PNG difieren (calculado con la diferencia de píxeles de las dos corridas), lado a lado.

- **`InicioPrimeraVez` (built, teléfono)**: `b4` contra `p3`, mismo día, mismas dimensiones 780x1888, la diferencia empieza en y 1336. Vi: en `b4` el botón "+ New sale" y el pie "Add a price to a variety so you can sell" quedan sobre la barra inferior, al final del documento; en `p3` el botón, el pie y la barra están una sola vez en la primera pantalla (la barra arriba de y 1688) y el fin del documento queda con su espacio vacío. El pie del botón se dibuja encima de "What you have left", que es como se ve un teléfono con el contenido detrás de la barra fija. Esperada: **expected (seen)**.
- **`Analisis` (built, teléfono)**: `b4` contra `p3`, 780x9008, la diferencia empieza en y 1408. Vi dos recortes: en y 1408 el botón "+ New sale" y la barra, con "More" marcado, aparecen sobre la tarjeta "Golden Cookies" en `p3`, y en `b4` esa tarjeta se ve entera; al final del documento (y 8500 a 9008) `b4` tiene el botón y la barra y `p3` tiene el mismo contenido arriba y el espacio vacío abajo. El resto de las tarjetas y cifras es idéntico. **expected (seen)**.
- **`InicioHoyCompu` (built, escritorio)**: `a3` contra `p3` (AE 5164; `b4` contra `p3` da AE 0, sin caja de diferencia). Cinco rectángulos de unos 22 px de alto, y los cinco son una fecha: "Today 07/11" y "Today 08/11", "since 19/10" y "since 20/10" (dos veces), "since 06/11" y "since 07/11", "No grams since 07/11" y "No grams since 08/11". Es Día/estado, no una diferencia de código. **expected (seen)**.
- **`Invitacion` (built, teléfono)**: `a3` contra `p3` (AE 243, rectángulo de 16x20 px en y 1613-1632). Vi "This invitation expires on 14/11 and can be used once." contra "…expires on 15/11…". Es Día/estado; `b4` contra `p3` da AE 0. **expected (seen)**.

No encontré ninguna diferencia inesperada. Las imágenes se abrieron de a una; los crops quedaron en el scratch y no se commitean (ningún PNG).

### Reabiertas

Ninguna. Ninguna fila quedó `unexpected`, así que ninguna se reabre.

## 3. Home con la barra de #373, Analysis y Analysis oscuro, por tamaño y tema

Estados y tamaños de [`part2-p3.index.json`](../../scripts/design/evidence/GH-491/part2-p3.index.json) (390x844, el teléfono por defecto `PHONE` de `scripts/design/screens.mjs`) y de [`part2-p3-sizes.index.json`](../../scripts/design/evidence/GH-491/part2-p3-sizes.index.json) (320x568, 375x812 y 430x932). El estado de las 16 celdas es `captured`, lado `design` y lado `built`. Los tamaños `built` en píxeles de dispositivo (dpr 2) son los que `part-2.md` (sección 1, "Las filas de teléfono") copia de esos índices.

| Fila (tema) | 320x568 | 375x812 | 430x932 | 390x844 (registro) |
|---|---|---|---|---|
| Home con la barra de #373 (`InicioHoy`, claro) | captured, built 640x2148 | captured, built 750x2142 | captured, built 860x2172 | captured, built 780x2150 |
| Home oscuro (`InicioOscuro`) | captured, built 640x2148 | captured, built 750x2142 | captured, built 860x2172 | captured, built 780x2150 |
| `Analisis` (claro) | captured, built 640x9310 | captured, built 750x9056 | captured, built 860x9016 | captured, built 780x9008 |
| `AnalisisOscuro` | captured, built 640x9310 | captured, built 750x9056 | captured, built 860x9016 | captured, built 780x9008 |

La parte 2 vio `InicioHoy_375x812.built.png`: la barra inferior y "+ New sale" aparecen una sola vez, dentro de la primera pantalla; las otras once filas se leen sólo por su estado y su medida (`part-2.md`, sección 1). Acá, en la tarea 3, `Analisis` a 390x844 se abrió (sección 2); las demás celdas no.

## 4. Censo de elementos fijados por pantalla

Comando, sobre una app de muestra nueva (`sample-app.sh --dir <tmp>/app`) y su archivo de hechos, en la cabeza `5341ffb6`, 2026-11-08 de 03:04:15 a 03:05:14, un solo intento (de dos permitidos):

```
node scripts/design/comparisons.mjs --facts <facts> --out <directorio nuevo> --census --registry scripts/design/evidence/GH-491/part2-phone-sizes.json
```

El índice, con cada ruta reducida a su basename, es [`part3-census.index.json`](../../scripts/design/evidence/GH-491/part3-census.index.json); salió con exit 0 y las doce filas `captured`. La tabla cubre sólo `InicioHoy`, `InicioOscuro`, `Analisis` y `AnalisisOscuro`, porque son las filas que nombró el criterio de la parte 2; una corrida de `--census` sobre todo el registro (sin `--registry`) la extiende. `--census` nunca cambia un PNG, una falla ni el exit code (`scripts/design/comparisons.mjs`, líneas 41 a 45). Una `pinned` sin `pinned_class`, o un `census_error`, se informa como se leyó, sin adivinar: en esta corrida no hay ninguno de los dos.

`class` es la clase que `census.mjs` le da a la página tal como estaba antes de crecer el viewport (el censo lee eso, no cómo se saca la captura final); `pinnedClass` es la de `shot.mjs`: `chrome` para `position: fixed`, `content` para `sticky`.

| Fila y tamaño | Lado | `class` | Fijados | Elementos |
|---|---|---|---|---|
| `InicioHoy_320x568` | design | grown | 0 | ninguno |
| `InicioHoy_320x568` | built | grown | 2 | `div.nueva-venta-flotante` (`fixed`, `pinnedClass` `chrome`); `nav.bar-inferior` (`fixed`, `pinnedClass` `chrome`) |
| `InicioHoy_375x812` | design | grown | 0 | ninguno |
| `InicioHoy_375x812` | built | grown | 2 | `div.nueva-venta-flotante` (`fixed`, `pinnedClass` `chrome`); `nav.bar-inferior` (`fixed`, `pinnedClass` `chrome`) |
| `InicioHoy_430x932` | design | neither | 0 | ninguno |
| `InicioHoy_430x932` | built | grown | 2 | `div.nueva-venta-flotante` (`fixed`, `pinnedClass` `chrome`); `nav.bar-inferior` (`fixed`, `pinnedClass` `chrome`) |
| `InicioOscuro_320x568` | design | grown | 0 | ninguno |
| `InicioOscuro_320x568` | built | grown | 2 | `div.nueva-venta-flotante` (`fixed`, `pinnedClass` `chrome`); `nav.bar-inferior` (`fixed`, `pinnedClass` `chrome`) |
| `InicioOscuro_375x812` | design | grown | 0 | ninguno |
| `InicioOscuro_375x812` | built | grown | 2 | `div.nueva-venta-flotante` (`fixed`, `pinnedClass` `chrome`); `nav.bar-inferior` (`fixed`, `pinnedClass` `chrome`) |
| `InicioOscuro_430x932` | design | neither | 0 | ninguno |
| `InicioOscuro_430x932` | built | grown | 2 | `div.nueva-venta-flotante` (`fixed`, `pinnedClass` `chrome`); `nav.bar-inferior` (`fixed`, `pinnedClass` `chrome`) |
| `Analisis_320x568` | design | grown | 0 | ninguno |
| `Analisis_320x568` | built | grown | 2 | `div.nueva-venta-flotante` (`fixed`, `pinnedClass` `chrome`); `nav.bar-inferior` (`fixed`, `pinnedClass` `chrome`) |
| `Analisis_375x812` | design | grown | 0 | ninguno |
| `Analisis_375x812` | built | grown | 2 | `div.nueva-venta-flotante` (`fixed`, `pinnedClass` `chrome`); `nav.bar-inferior` (`fixed`, `pinnedClass` `chrome`) |
| `Analisis_430x932` | design | grown | 0 | ninguno |
| `Analisis_430x932` | built | grown | 2 | `div.nueva-venta-flotante` (`fixed`, `pinnedClass` `chrome`); `nav.bar-inferior` (`fixed`, `pinnedClass` `chrome`) |
| `AnalisisOscuro_320x568` | design | grown | 0 | ninguno |
| `AnalisisOscuro_320x568` | built | grown | 2 | `div.nueva-venta-flotante` (`fixed`, `pinnedClass` `chrome`); `nav.bar-inferior` (`fixed`, `pinnedClass` `chrome`) |
| `AnalisisOscuro_375x812` | design | grown | 0 | ninguno |
| `AnalisisOscuro_375x812` | built | grown | 2 | `div.nueva-venta-flotante` (`fixed`, `pinnedClass` `chrome`); `nav.bar-inferior` (`fixed`, `pinnedClass` `chrome`) |
| `AnalisisOscuro_430x932` | design | grown | 0 | ninguno |
| `AnalisisOscuro_430x932` | built | grown | 2 | `div.nueva-venta-flotante` (`fixed`, `pinnedClass` `chrome`); `nav.bar-inferior` (`fixed`, `pinnedClass` `chrome`) |

Las cuatro filas a los tres tamaños dan lo mismo: la barra `nav.bar-inferior` y el botón `div.nueva-venta-flotante` son `fixed`, `chrome`, y ninguna fila trae un elemento `sticky`. El lado `design` no tiene elementos fijados.

## 5. Fixtures de salto rechazadas

Casos que la herramienta rechaza en lugar de capturar mal. Los nombres son los de los tests, copiados de los archivos.

En `web/src/design/take-shot.test.ts` (navegador real, fixtures de `setContent`):

- `refuses a page that jumps on its first scroll` (línea 97)
- `refuses a page that jumps on a repeating timer` (línea 107)
- `refuses a header that collapses when the probe scrolls the page` (línea 157)
- `refuses an IntersectionObserver lazy list` (línea 168)
- `refuses a sticky element that is stuck where the probe read it` (línea 181)
- `refuses a page that fits whose element scrolls inside itself, naming it as the inner scroll` (línea 249)

En `web/src/design/shot.test.ts`, los casos de colocación que dan `REFUSED` (`{ reason: 'shot: a pinned element could not be placed (built)' }`, línea 460):

- `refuses chrome that is not visible on frame 0` (543)
- `refuses a sticky element taller than a frame` (551)
- `refuses a frame boundary that cuts a sticky element` (555)
- `refuses a boundary that cuts a second sticky element, the first being placed` (559)
- `refuses two boundaries that do not meet: a gap or an overlap between frames` (565)
- `refuses a fixed element that is not provably on the viewport` (579)
- `refuses a fixed element with a transform of its own` (584)
- `refuses a sticky element inside a fixed one: no frame can hold it` (588)
- `refuses a sticky element with no natural place read` (593)

## 6. Tiempo del test con navegador

Del encabezado de `web/src/design/take-shot.test.ts` (líneas 17 a 24): medido el 2026-11-07, dos corridas de `vitest run src/design/take-shot.test.ts` junto a `pytest -n 8` y `npm run typecheck` en bucle, con load average de 17 a 20: el caso más lento, 2455 ms (`refuses a page that jumps on a repeating timer`); el archivo entero, de 15,9 a 16,1 s. El tope de cada caso es `TAKE_SHOT_TEST_MS` = 180 000 ms, que fija el piso de 180 s. Esta parte no volvió a medir.
