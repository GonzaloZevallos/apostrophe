# Drawing as guide

La regla vive en [DESIGN_STANDARDS.md](../../DESIGN_STANDARDS.md), sección "Drawing as guide"; la regla completa de Design capture está en [design-capture.md](design-capture.md). Esta página dice solamente qué garantiza la fuente de diseño que está en master, y cada garantía nombra lo que la hace cumplir.

## Qué garantiza la fuente de diseño

1. **El dibujo es una guía, nunca un contrato.** Donde un dibujo y una definición escrita difieren, manda la definición: `docs/product/` y los ADR ganan. Cuándo una diferencia es un hallazgo lo dice [DESIGN_STANDARDS.md](../../DESIGN_STANDARDS.md); acá no se repite.

2. **Qué versión hay en master.** Los dibujos del rediseño en `pantallas/` son el objetivo de la épica #494; `docs/design/redesign/README.md` los indexa; se copiaron de la rama `design/redesign-2026-10-29` en `25f6cb18`; `fuente/telefono/X.dc.html` y `fuente/compu/X.dc.html` son `pantallas/X.dc.html`. De esa rama master trae el README y las capturas PNG (en la raíz de `docs/design/redesign/`, en `oscuro/`, en `compu/` y en `compu/oscuro/`), sin copia de `fuente/` y sin HTML: los dibujos ya viven en `pantallas/`. La tabla del README da, para cada pantalla, la issue que la construye.

3. **La comparación de una pantalla redibujada muestra lo viejo hasta que aterriza su issue.** Cada fila de `scripts/design/screens.json` pone al dibujo nuevo al lado de la ruta construida hoy, aunque sea una versión vieja; esa diferencia es esperada hasta que la issue de construcción de la pantalla (la del README) entra. La nota `_` de ese archivo lo dice, y la comparación la arma `scripts/design/comparisons.mjs`.

4. **Una fila oscura usa su propio dibujo oscuro cuando existe.** Una fila `…Oscuro` de `scripts/design/screens.json` compara su `…Oscuro.dc.html` si ese archivo está en `docs/product/design-system/pantallas/`, y el archivo claro solo cuando no hay dibujo oscuro. Lo hace cumplir `assertTwinDrawing` en `scripts/design/screens.mjs`, que rechaza la fila con "a dark twin must compare its own dark drawing", y lo fija `web/src/design/screens.test.ts`.

5. **Las pantallas sin construir llevan `route: null`, con tope que solo baja.** Una fila puede tener `route: null` únicamente si está en `NULL_ROUTE_CEILING` de `web/src/routes.test.ts` (`ceilingProblems`), con la issue que la construye; una entrada sale de ahí cuando su pantalla se construye y nunca entra una nueva.

6. **Los chequeos de muestra pausados los reactiva la issue de construcción de cada pantalla.** El acuerdo de cifras de `muestra.md` está en pausa para los dibujos de `PAUSED` en `tests/design/muestra_families.py`, siempre dentro de `PAUSED_CEILING`, un literal propio que puede achicarse y nunca crecer; cada entrada lleva la issue que da el README del rediseño (#497 para Hoy, #321 para Análisis). `pause_problems`, que corre `tests/design/test_muestra_screens.py`, rechaza un dibujo pausado que no está en el tope, uno repetido, uno que no es de `PAUSEABLE` y una issue que no es un entero positivo. Cuando la issue de una pantalla la construye, su nombre sale de `PAUSED` y de `PAUSED_CEILING` y la comprobación de cifras vuelve a correr. Se saltea solo el acuerdo de cifras: la fecha, la lista de prohibidos y todos los demás chequeos siguen.
