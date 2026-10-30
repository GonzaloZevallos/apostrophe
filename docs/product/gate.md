# Gate

Los controles que todo cambio debe pasar antes de integrarse: pytest, vitest y e2e (ADR-0039, ADR-0040, ADR-0041), corridos como jobs del CI de GitHub y exigidos por `agentic merge` a través de `ci:` en `.agentic/stack.yaml`. El mantenedor y el sistema de desarrollo agéntico se apoyan en ellos. Este archivo guarda lo que el propio Gate tiene que garantizar, incluido cómo pueden cambiar las listas de infractores del estándar móvil y cuándo un pull request puede integrarse. No cambia ningún comportamiento del producto: acá no se define ninguna regla, pantalla, ruta, rechazo ni mensaje de ninguna capacidad. Los vendedores y el Operator no ven nada de esto. El Operator gana solo de forma indirecta, con un Gate en el que puede confiar.

## Jobs

### Mismo resultado cuando sea que corra

**Cuando** el Gate se pone en rojo, **quiero** (como mantenedor o como el agente que lo corre) que eso signifique que algo del producto se rompió, nunca que el calendario pasó un vencimiento o un límite de día, **para poder** arreglar regresiones reales dentro del brief en el que estoy trabajando en lugar de parchar tests a mano en archivos que nadie me pidió tocar.

Antes de esto, un test que dependía de la fecha real (una Invitation pasados sus 7 días, un límite de día en Argentina) fallaba algún día sin motivo de producto. Se parchaba caso por caso fuera de cualquier brief (GH-142, commit e73ecf4).

Criterios de éxito:

1. **Mismo resultado cuando sea que corra.** Cada control del Gate (pytest, vitest, e2e) da el mismo veredicto en cualquier fecha y a cualquier hora del día. Eso incluye más de 7 días después de hoy y a través de una medianoche en Argentina. Un test que pasa hoy no puede fallar la semana que viene porque cambió la fecha.
2. **Las reglas que dependen del tiempo se prueban a propósito en sus bordes.** Estas reglas se prueban fijando la hora que el test necesita, nunca con el reloj de pared:
   - el vencimiento de una Invitation (7 días);
   - los Reset links (24 horas);
   - los Login brakes (15 minutos);
   - el día hábil de Argentina;
   - "se rechaza una fecha futura".
3. **Ningún comportamiento del producto cambia por cómo los tests llevan el tiempo.** Cada archivo de capacidad se lee y se comporta igual.
4. **El Gate sigue siendo rápido y autocontenido.** Nada de esperas, nada de dormir hasta que algo venza y ningún control de cuánto tardó algo (ADR-0038, ADR-0041).
5. **Ningún test conocido depende del reloj real.**

### Una pantalla alcanzable canjea su entrada de inalcanzable

**Cuando** un cambio hace alcanzable para el recorrido móvil una pantalla que figuraba como inalcanzable, **quiero** (como el Developer que hace ese cambio, o el revisor que lo aprueba) una regla escrita para canjear la entrada `unreachable` de esa pantalla por sus celdas infractoras reales en el mismo cambio, **para que** el Gate no lea como regresión celdas reales recién visibles y nadie escriba una excepción puntual.

Antes de esto (GH-293), el invariante 9 del plan de GH-271 prohibía todo crecimiento de las listas de infractores y no preveía este caso. Cada canje necesitaba una excepción registrada con evidencia, tarea por tarea. CobroDesdeInicio fue el caso registrado: una entrada `unreachable` canjeada por siete celdas de 246x437.

Criterios de éxito:

1. Cuando una pantalla se vuelve alcanzable, su entrada `unreachable` se quita y sus celdas reales se agregan a las listas de infractores en el mismo cambio.
2. Las celdas nuevas se registran y se siguen como cualquier otro infractor. Nunca se ocultan y nunca se leen como regresión.
3. La excepción cubre solo esa pantalla. El único crecimiento que permite el canje son las celdas de la pantalla cuya entrada `unreachable` se quita en ese mismo cambio.
4. Un revisor puede verificar el canje solo con los archivos de infractores y el cambio, sin leer las notas de evidencia del Developer.

### Una fila nueva del registro trae sus celdas

**Cuando** un cambio agrega al registro de pantallas una fila que el recorrido móvil siempre recorre, **quiero** (como el Developer que hace ese cambio, o el revisor que lo aprueba) una regla escrita que deje que esa fila traiga todas sus celdas infractoras reales en el mismo cambio, **para que** una regla escrita para un cambio diga lo que de verdad se cumple, el cambio se pueda aprobar y los cambios posteriores se puedan revisar sin volver a discutir la misma contradicción.

Antes de esto (GH-305, continuación de GH-274), el único crecimiento permitido era el canje. GH-274 agregó las filas de teléfono `InicioChecklist` (Home con la First-run checklist) e `InicioImportado` (Home con el aviso posterior al Spreadsheet import). Nunca figuraron como inalcanzables, así que sus celdas reales (56 entradas) no podían ser un canje, y el invariante del plan no podía cumplirse tal como estaba escrito. El hallazgo quedó abierto en el head aprobado de GH-274.

Criterios de éxito:

1. Una fila nueva en el registro de pantallas trae todas sus celdas infractoras reales en el cambio que la agrega. Si el recorrido todavía no la alcanza, trae en su lugar su cobertura `unreachable`.
2. Esas celdas se siguen como cualquier otro infractor. Nunca se ocultan y nunca se leen como regresión.
3. El crecimiento cubre solo la pantalla de la fila nueva, en los tamaños y temas que esa fila cubre, en el cambio que la agrega. Cualquier otro crecimiento sigue rompiendo el invariante 9.
4. Un revisor puede verificarlo solo con el diff del registro y el diff de los archivos de infractores, por nombre de pantalla.
5. No se registra ninguna excepción puntual para una fila nueva. `InicioChecklist` e `InicioImportado` quedan aceptadas por esta regla, sin ninguna.

### Un arreglo renumera un infractor no tocado

**Cuando** un cambio arregla algunos nodos que fallan en una pantalla y, como resultado, un nodo que falla, no tocado y con el mismo texto enmascarado, cambia su ordinal de target, **quiero** (como el Developer que hace ese cambio, o el revisor que lo aprueba) una regla escrita que deje que el mismo cambio reemplace la clave vieja por la nueva, **para que** arreglar infractores nunca quede bloqueado ni escalado porque el conteo renombró un nodo que nadie tocó.

Antes de esto (GH-297 parte 1), el ordinal de un target (por ejemplo `span:$ #.#.#[2]`) contaba solo los nodos que fallan en la pantalla con el mismo texto enmascarado, en orden de página. Arreglar algunos en Analysis podía renumerar un monto por Variety no tocado, y la clave vieja y la nueva se leían como una entrada quitada más una agregada, algo que las reglas no cubrían.

Criterios de éxito:

1. Un target renumerado se reemplaza en el mismo cambio que lo causó. No es crecimiento y no necesita excepción.
2. El reemplazo se permite solo cuando la renumeración viene de un arreglo en ese cambio, y solo para la misma celda bajo un ordinal nuevo.
3. Las listas siguen sin crecer nunca en celdas que fallan. Para esa pantalla, regla y texto enmascarado, nunca hay más entradas después del cambio que antes.
4. Un revisor puede verificarlo con el diff de los archivos de infractores, y que el nodo no se tocó con el diff de código, sin las notas de evidencia del Developer.

### Nada en rojo llega a master

**Cuando** un pull request está listo para integrarse, **quiero** (como dueño; el agente que pide el merge actúa por mí) que `agentic merge` rechace cualquier head que tenga un job del CI de GitHub en rojo, e2e incluido, **para que** lo que llega a master mantenga el Gate en verde y nunca me encuentre un e2e roto después del hecho.

Antes de esto (GH-533), el job `e2e` de `.github/workflows/ci.yml` corría en cada pull request pero no frenaba nada: `ci:` en `.agentic/stack.yaml` listaba solo `test`, `web` y `docs`, y el `web-e2e` local está apagado en esta máquina (dueño, 2026-10-26). Lo único que lo reemplazaba era mirar el job a mano antes de integrar, y nada lo exigía. El 2026-10-29 eso falló dos veces: #523 se integró con `web/e2e/scrollOnNavigate.spec.ts` fallando (revertido en #532) y #525 con `web/e2e/leaveWithBack.spec.ts:20` fallando.

Criterios de éxito:

1. `agentic merge` rechaza un head cuyo job e2e falló, y nombra el job.
2. La corrida de CI de master posterior al merge tiene todos los jobs en verde, e2e incluido. Se encontró la causa de cada rojo, y no se salteó, reintentó ni aflojó nada.
3. Un pull request que agrega o cambia un spec e2e vio pasar ese spec en GitHub antes de pedir el merge.
4. Cada test, doc y ADR que nombra los jobs que frenan el merge coincide con `ci:`, y ninguno sigue diciendo que e2e no frena nada.

## Comportamiento

### El tiempo en los tests

- **Tiempo controlado.** Cada test cuyo resultado depende de la fecha o la hora corre sobre un tiempo que controla el test. Esto cubre:
  - el vencimiento de una Invitation;
  - los Reset links;
  - los Login brakes;
  - el día hábil de Argentina y "hoy": el Current price, una fecha futura rechazada y el cambio de día que dispara el Upkeep.
- **El reloj de las Invitations.** Su separación del reloj inyectado de la app (ADR-0001) no deja ningún test capaz de vencer con el reloj real. El mecanismo es del Tech Lead.
- **Uso permitido del reloj real.** Un test del propio reloj de la app (por ejemplo, que "hoy" es el día hábil de Argentina) puede leer el reloj real solo si su veredicto es el mismo en cualquier fecha y a cualquier hora.
- **El código de producción** que lee legítimamente el reloj real (el "hoy" de la app, el ticker del Upkeep) no se rige por este archivo.
- **Los tests editados conservan su sentido.** Un test puede cambiar cómo fija su tiempo. No se quita, afloja ni cambia de sentido ninguna aserción sobre el comportamiento del producto.

### Mantenerlo arreglado

- Un test nuevo cuyo resultado depende de la fecha o la hora reales se marca cuando se agrega, antes de que pueda quedar en verde.
- El mecanismo es rápido y no controla tiempo transcurrido.

### Excepciones

- Un test que no se puede independizar de la fecha o la hora reales se escala al PM.
- Nunca se elimina, y nunca se conserva como excepción conocida sin una decisión.

### Verificación

- Un control único de que las suites del Gate pasan en una fecha más de 7 días adelante y a través de una medianoche de Argentina.
- Se registra en la evidencia de la tarea que cambia cómo los tests llevan el tiempo.
- No se repite en cada corrida del Gate.

### Cuándo se integra un pull request

- **Todos los jobs de `ci:` en verde.** Un pull request se integra solo con todos los jobs de CI listados en `ci:` de `.agentic/stack.yaml` en verde en su head, e2e incluido (regla del dueño). `agentic merge` lo hace cumplir. Desde GH-476, `ci:` lista solo `ci-ok`, que depende de todos los demás jobs (`changes`, `checks`, `web`, `docs`, `pytest`, `vitest`, `e2e`, `coverage`) y lee las banderas de `changes`: una suite omitida por no afectada cuenta como pasada solo si su bandera es `"false"`, y e2e sigue gateando (ADR-0067).
- **Cualquier estado que no sea éxito frena.** Para cada job de `ci:`, `agentic merge` rechaza un head cuyo job falló, se canceló, se salteó, sigue pendiente o falta, y nombra el job. e2e sigue la misma regla que los demás jobs, sin una regla propia. La prueba de ese rechazo vive fuera de este repo, en el sistema agentic (hallazgo `outside`); si alguno de los jobs existentes no se comportara así, eso se registra como una falla del comportamiento existente.
- **Un spec e2e nuevo o cambiado se ve pasar en GitHub sin pasos extra.** Desde GH-476 el job `e2e` corre en shards solo los specs que el cambio afecta (la suite completa en cada push a master, y en un pull request cuando el cambio es de infraestructura o no coincide con ninguna regla); `ci-ok` lee la bandera `e2e` de `changes` (ADR-0064, reglas 7 y 8; ADR-0067). Así, un pull request que agrega o cambia un spec e2e cumple "ver pasar ese spec en GitHub antes de pedir el merge" con solo cumplir la regla anterior. No es un paso manual aparte.
- **El `web-e2e` vuelve a ser un check declarado (GH-476).** `.agentic/stack.yaml` lo restaura en `checks` y en `affected_checks`, de modo que lo corre el tier completo; no está en `delivery_checks`, así que la entrega de cada subtask no lo corre. El freno del merge sigue siendo el job e2e de GitHub, leído por `ci-ok` (la decisión del dueño del 2026-10-26 de apagarlo en esta máquina queda reemplazada para el tier completo).
- **Nunca verde a la fuerza.** Un rojo se arregla encontrando su causa, en el spec o en el código que atrapó. Nunca se saltea, se pone en cuarentena, se reintenta hasta que pase ni se afloja una aserción. Un spec sigue la definición escrita vigente, nunca al revés.

### Un e2e en rojo que resulta ser un flake

- Volver a correr un job e2e en rojo se permite solo para averiguar si es un flake. Un re-run en verde nunca se registra como prueba de que el spec está bien.
- Un flake es un defecto del Gate, no ruido con el que convivir. Recibe su propio issue que nombra el spec y la falla, como #428.
- Si el spec que falla de forma intermitente es uno que el pull request agrega o cambia, el head no se integra hasta que se arregle el flake.
- Si el pull request no toca ese spec, puede integrarse con el re-run en verde, pero solo después de abrir el issue del flake. El freno de `ci:` se cumple porque todos los jobs están en verde en el head.
- Si el job `e2e` se cancela o llega a su `timeout-minutes` (30), se vuelve a correr una sola vez, solo para distinguir un flake de una regresión. Un flake recibe su propio issue. El workflow no tiene ningún bucle de re-run.

### Listas de infractores del estándar móvil

El estándar móvil guarda listas de infractores en `web/src/mobile-standard/offenders/`:

- `unreachable.json` lista las pantallas que el recorrido móvil todavía no alcanza.
- Las otras listas, como `touch-target.json` y `touch-action.json`, listan las celdas reales que no cumplen una regla.

Este archivo es el único lugar donde está escrita la regla. Los demás textos vigentes nombran en una oración los dos crecimientos permitidos (el canje y una fila nueva del registro) y remiten acá: CODING_STANDARDS.md §10, su gemelo en `docs/product/design-system/README.md`, el ítem 39 de `docs/product/accounts.md` y el encabezado de `web/src/mobile-standard/offenders/index.ts`. Un target renumerado, más abajo, no es crecimiento, así que esos textos no necesitan nombrarlo.

- **Sin crecimiento (invariante 9).** Las listas de infractores nunca crecen, salvo por el canje o por una fila nueva del registro, los dos más abajo. Se escribió primero como el invariante 9 del plan de GH-271.

#### El canje

- **Por celda.** Una celda infractora (pantalla, tamaño, tema) puede agregarse solo cuando el mismo cambio quita la cobertura `unreachable` de esa pantalla en ese tamaño y tema. Las celdas reales van en las listas de infractores que les correspondan.
  - Cada celda agregada nombra la misma pantalla que el `screen` de la entrada quitada. Solo esas celdas cuentan para el canje.
  - Alcance parcial: una entrada que solo achica sus `sizes` o sus `themes` canjea solo las celdas que perdió. Por ejemplo, `VentaAsignarCliente` figura como inalcanzable solo en 246x437.
  - Una pantalla `*Texto130` es un nombre de pantalla propio y canjea por su cuenta.
  - Un cambio puede traer varios canjes.
- **Se empareja por pantalla, no por issue.** Que un canje sea válido depende solo del nombre de pantalla. Una celda canjeada tiene que nombrar un issue de `AREA_ISSUES`, y puede nombrar cualquiera de estos:
  - el issue de la entrada `unreachable` quitada, o
  - el issue que llevan las entradas de infractores existentes de la misma pantalla.
  - Una pantalla sin entradas existentes usa el issue de la entrada quitada. Si sus entradas existentes abarcan dos issues, el revisor acepta cualquiera.
  - Las celdas de CobroDesdeInicio llevan #46, mientras que su entrada quitada llevaba #45. Las dos son válidas.
- **Sin celdas infractoras.** Una pantalla que se vuelve alcanzable sin celdas infractoras solo pierde su cobertura `unreachable`. No se agrega nada.

#### Una fila nueva del registro

- **Por celda.** Una celda infractora (pantalla, tamaño, tema) puede agregarse cuando el mismo cambio agrega la fila de esa pantalla al registro de pantallas en ese tamaño y tema. La fila no estaba en el registro antes del cambio. Las celdas reales van en las listas de infractores que les correspondan.
  - Cada celda agregada nombra la pantalla de la fila nueva. Solo esas celdas cuentan.
  - Una pantalla `*Texto130` es un nombre de pantalla propio y cuenta por su cuenta.
  - Un cambio puede agregar varias filas.
- **Fila nueva inalcanzable.** Si el recorrido todavía no alcanza la fila nueva, el mismo cambio la lista en `unreachable.json` en los tamaños y temas que no alcanza. Sus celdas reales llegan después, por el canje.
- **Issue.** Cada celda agregada nombra un issue de `AREA_ISSUES`.
- **Solo en el mismo cambio.** Las celdas de una fila que ya existía antes del cambio nunca son este tipo de crecimiento, aunque esa fila se haya agregado hace poco.
- **Registrado.** `InicioChecklist` (Home con la First-run checklist) e `InicioImportado`, las filas de teléfono que agregó GH-274, trajeron sus celdas reales en `touch-action.json` en ese cambio. Cada entrada lleva su motivo. Son el primer caso de esta regla y no necesitan excepción.

#### Un target renumerado

El ordinal de un target (`[n]`) cuenta solo los nodos que fallan en la pantalla con el mismo texto enmascarado, en orden de página. Cuando un cambio arregla algunos, uno no tocado puede cambiar de clave sin que nada cambie en él. Es la misma celda con otro nombre, no crecimiento.

- **Se reemplaza en el mismo cambio.** El cambio quita la clave vieja y agrega la nueva cuando se cumple todo esto:
  1. **Misma entrada en lo demás.** Las entradas agregada y quitada tienen el mismo `screen`, `rule`, tamaños, temas e issue. Su `target` difiere solo en el ordinal final: un número distinto, o el ordinal agregado o quitado.
  2. **Lo causó un arreglo.** El mismo cambio también quita al menos una entrada de esa pantalla con la misma regla y el mismo texto enmascarado, un nodo que arregló.
  3. **Sin crecimiento neto.** Para esa pantalla, regla y texto enmascarado, no hay más entradas después del cambio que antes.
  4. **El nodo no se tocó.** El markup propio del nodo renumerado no está en el diff de código del cambio.
- **Si no, es crecimiento.** Un cambio de clave que no cumple alguna de estas condiciones es una entrada agregada como cualquier otra. Se arregla en el mismo cambio o se escala, nunca se lista.
- **Registrado.** GH-297 parte 1 (Analysis) es el primer caso: montos por Variety no tocados podían renumerarse cuando la franja de resumen, las filas de costo y el bloque "since the first record" dejaron de fallar. Esos canjes de clave conservan #48 y se listan en los targets movidos del cambio como `clave vieja → clave nueva`.

#### Común a los tres

- **No permitido.** Cualquier otro crecimiento rompe el invariante 9:
  - celdas de una pantalla cuya entrada `unreachable` se queda;
  - celdas de una fila que ya estaba en el registro antes del cambio, salvo un target renumerado como arriba;
  - celdas que nombran una pantalla distinta de aquella cuya entrada se quitó o cuya fila se agregó;
  - celdas en un tamaño o tema que la entrada quitada o la fila nueva no cubre.
- **Sin tope.** Una pantalla alcanzable o una fila nueva trae todas sus celdas reales, sean cuantas sean.
- **Se siguen como cualquier otro infractor.** Las celdas agregadas y los targets renumerados se siguen desde entonces como cualquier otro infractor. Nunca se ocultan, nunca se marcan exentos y nunca se leen como regresión.
- **Legible desde los archivos.** El crecimiento y la renumeración se pueden verificar por nombre de pantalla con los archivos de infractores de antes y de después, más el diff del registro de pantallas para una fila nueva y el diff de código para un nodo renumerado no tocado. No hacen falta las notas de evidencia del Developer.
- **Se hace cumplir solo en revisión.** `diffOffenders` ya hace que listar y recorrer lleguen juntos. Las celdas reales de una pantalla alcanzable o de una fila nueva quedan `unlisted` hasta que se listan, y las celdas `unreachable` de una pantalla alcanzable pasan a `fixedButListed`. Un target renumerado aparece con su clave nueva `unlisted` y la vieja `fixedButListed` hasta que se hace el canje. Verificar que las celdas agregadas nombran la pantalla quitada o agregada, o que son una renumeración válida, necesitaría la revisión base, o sea git dentro de vitest, en contra de ADR-0038 y ADR-0041. Por eso el revisor empareja nombres de pantalla y claves entre los diffs. Listar una falla nueva no relacionada para quedar en verde se atrapa solo en revisión, como antes.
- **Sin excepciones puntuales.** No se registra ninguna excepción por tarea para una pantalla que se vuelve alcanzable, una fila agregada o un target renumerado. Las reglas aceptan `CobroDesdeInicio` (cobrar desde Home; su entrada `unreachable` quitada en 246x437, #45, canjeada por siete celdas de 246x437 en #46) e `InicioChecklist` e `InicioImportado` (GH-274) sin ninguna. La excepción registrada en GH-271 queda retirada.

#### Ejemplos resueltos

Cada uno muestra los archivos de infractores y, donde importa, el registro de pantallas, antes y después de un cambio, y el veredicto.

**1. Canje válido: pasa.** `Cuenta` se vuelve alcanzable y tiene una celda que falla.

```diff
 unreachable.json
-  { "screen": "Cuenta", "rule": "unreachable", "target": "", "issue": 45 }
 touch-target.json
+  { "screen": "Cuenta", "rule": "touch-target", "target": "button:Save", "issue": 45 }
```

La celda agregada nombra la pantalla de la entrada quitada y nombra un issue.

**2. Entrada conservada, celdas agregadas: falla.** `Cuenta` suma una celda, pero su entrada `unreachable` se queda.

```diff
 unreachable.json
   { "screen": "Cuenta", "rule": "unreachable", "target": "", "issue": 45 }
 touch-target.json
+  { "screen": "Cuenta", "rule": "touch-target", "target": "button:Save", "issue": 45 }
```

No se canjeó nada por la celda nueva, así que la lista creció.

**3. Celdas que nombran otra pantalla: fallan.** `Cuenta` pierde su entrada, pero la celda agregada nombra `Perfil`.

```diff
 unreachable.json
-  { "screen": "Cuenta", "rule": "unreachable", "target": "", "issue": 45 }
 touch-target.json
+  { "screen": "Perfil", "rule": "touch-target", "target": "button:Save", "issue": 45 }
```

La celda no nombra la pantalla de la entrada quitada, así que no es parte del canje.

**4. Alcanzable sin celdas: pasa.** `Cuenta` se vuelve alcanzable y no falla nada.

```diff
 unreachable.json
-  { "screen": "Cuenta", "rule": "unreachable", "target": "", "issue": 45 }
```

Solo se va la entrada. No se agrega nada.

**5. Fila nueva con sus celdas: pasa.** El cambio agrega la fila de teléfono `InicioChecklist`, y tiene celdas que fallan.

```diff
 screens registry
+  InicioChecklist (phone)
 touch-action.json
+  { "screen": "InicioChecklist", "rule": "touch-action", "target": "…", "issue": 46 }
```

Las celdas agregadas nombran solo la fila agregada en el mismo cambio, y nombran un issue.

**6. Celdas de una fila existente: fallan.** No se agrega ninguna fila, y se agrega una celda de `InicioHoy`, que ya estaba en el registro.

```diff
 touch-action.json
+  { "screen": "InicioHoy", "rule": "touch-action", "target": "…", "issue": 46 }
```

La fila estaba antes del cambio, así que la celda nueva es una regresión a arreglar, no un crecimiento a listar.

**7. Fila nueva, celdas que nombran otra pantalla: fallan.** El cambio agrega `InicioImportado`, pero también se agrega una celda de `Perfil`.

```diff
 screens registry
+  InicioImportado (phone)
 touch-action.json
+  { "screen": "InicioImportado", "rule": "touch-action", "target": "…", "issue": 46 }
+  { "screen": "Perfil", "rule": "touch-action", "target": "…", "issue": 46 }
```

La celda de `InicioImportado` es válida. La de `Perfil` rompe el invariante 9.

**8. Renumerado después de un arreglo: pasa.** El cambio arregla el primer monto de `Analisis` con texto enmascarado `$ #.#.#`. El segundo, no tocado, pasa de `[2]` a `[1]`.

```diff
 figure-split.json
-  { "screen": "Analisis", "rule": "figure-split", "target": "span:$ #.#.#[1]", "issue": 48 }
-  { "screen": "Analisis", "rule": "figure-split", "target": "span:$ #.#.#[2]", "issue": 48 }
+  { "screen": "Analisis", "rule": "figure-split", "target": "span:$ #.#.#[1]", "issue": 48 }
```

Se arregló un nodo y el otro conservó su celda bajo un ordinal nuevo. Las entradas de ese texto enmascarado pasaron de dos a una, y el markup del nodo renumerado no está en el diff de código.

**9. Renumerado sin nada arreglado: falla.** No se arregla ninguna entrada de `Analisis` con texto enmascarado `$ #.#.#`, y aun así una clave se mueve.

```diff
 figure-split.json
-  { "screen": "Analisis", "rule": "figure-split", "target": "span:$ #.#.#[2]", "issue": 48 }
+  { "screen": "Analisis", "rule": "figure-split", "target": "span:$ #.#.#[3]", "issue": 48 }
```

No se arregló nada con ese texto enmascarado, así que el corrimiento significa que apareció un nodo nuevo que falla antes que él. Es una regresión a arreglar, no una renumeración.

## Métricas

No hay telemetría. Se leen de la evidencia de la tarea y de la revisión.

- **Pasa con la fecha corrida (job del tiempo, criterio 1):** una corrida más de 7 días adelante y a través de una medianoche de Argentina pasa.
- **Tests con reloj real contabilizados (job del tiempo, criterios 2 y 5):** cada test que dependía del reloj real está listado con cómo se cubre ahora. Ninguno queda sin cubrir y ninguno se elimina.
- **Sin cambio de comportamiento (job del tiempo, criterio 3):** el Gate pasa, y cada test editado conserva sus aserciones de producto. Se verifica en revisión.
- **El Gate sigue rápido (job del tiempo, criterio 4):** ninguna espera nueva y ninguna aserción de tiempo transcurrido. Se verifica en revisión contra ADR-0038 y ADR-0041.
- **Mantenerlo arreglado:** se muestra que el mecanismo de marcado atrapa un test agregado a propósito que depende del reloj real.
- **Canje reconocido (job del canje, criterios 1 y 3):** se muestran cuatro casos, cada uno con el veredicto esperado:
  - un canje válido pasa;
  - una entrada conservada más celdas agregadas falla;
  - celdas que nombran otra pantalla fallan;
  - una pantalla vuelta alcanzable sin celdas pasa.
- **Nada oculto (job del canje, criterio 2):** después de un canje, cada celda de la pantalla recién alcanzable está en las listas de infractores, cada una nombrando un issue.
- **Canje evidente (job del canje, criterio 4):** el revisor confirma el canje solo con el diff de los archivos de infractores.
- **Fila nueva reconocida (job de la fila nueva, criterios 1 y 3):** se muestran tres casos, cada uno con el veredicto esperado:
  - una fila nueva con sus celdas pasa;
  - celdas de una fila existente fallan;
  - celdas que nombran otra pantalla junto a una fila nueva fallan.
- **Nada oculto (job de la fila nueva, criterio 2):** cada celda real de `InicioChecklist` e `InicioImportado` está en las listas de infractores, cada una nombrando un issue y con su motivo.
- **Fila nueva evidente (job de la fila nueva, criterio 4):** el revisor confirma el crecimiento con el diff del registro y el diff de los archivos de infractores solamente. Comparadas con la base de GH-274, las listas crecen exactamente en las entradas de `InicioChecklist` e `InicioImportado`, y no quitan ninguna.
- **Renumeración reconocida (job de la renumeración, criterios 1 a 3):** se muestran dos casos, cada uno con el veredicto esperado:
  - una renumeración después de un arreglo pasa;
  - una renumeración sin nada arreglado falla.
- **Renumeración evidente (job de la renumeración, criterio 4):** para cada clave canjeada, el revisor confirma con el diff de los archivos de infractores que se quitó una entrada del mismo texto y que el conteo no creció, y con el diff de código que el nodo no se tocó.
- **Sin excepciones puntuales (todos los jobs de infractores):** no queda ninguna excepción por tarea para una pantalla vuelta alcanzable, una fila agregada o un target renumerado, incluidas las de CobroDesdeInicio y GH-274.
- **Gemelos alineados:** CODING_STANDARDS.md §10, el README del design system, el ítem 39 de accounts.md y el encabezado de `offenders/index.ts` nombran cada uno los dos crecimientos permitidos en una oración y remiten acá.
- **e2e en rojo rechazado (job "Nada en rojo llega a master", criterio 1):** la evidencia muestra a `agentic merge` rechazando un head cuyo job `e2e` no está en verde y nombrando `e2e`. `tests/test_stack_ci.py` verifica que `ci-ok` depende de `e2e`, que `e2e` solo se omite con su bandera de `changes` y que su comando es un paso de un job que `ci:` gatea (GH-476).
- **Todo estado que no sea éxito rechazado (mismo job, cuándo se integra):** la evidencia o los tests cubren fallado, cancelado, salteado, pendiente y faltante para un job de `ci:`. Cualquier falla encontrada en `test`, `web` o `docs` queda registrada.
- **Master en verde (mismo job, criterio 2):** la primera corrida de CI de master después del merge tiene todos los jobs en verde, e2e incluido. La evidencia nombra la causa de cada rojo arreglado, y la revisión confirma que no se agregó ningún `skip`, `fixme`, reintento ni aserción aflojada.
- **Spec visto pasar (mismo job, criterio 3):** la corrida e2e propia del pull request en GitHub está en verde antes de pedir el merge, con su link en la evidencia.
- **Textos alineados (mismo job, criterio 4):** buscar los textos que dicen que e2e no frena nada y la lista de jobs que frenan el merge no encuentra ningún texto que no coincida con `ci:`, ni ningún ADR que lo contradiga sin un hallazgo `outside`.

## Fuera de alcance

- Cualquier regla de producto, pantalla, ruta, rechazo o texto.
- El código de producción que lee legítimamente el reloj real.
- Repetir las corridas con la fecha corrida en cada corrida del Gate.
- Aserciones de tiempo de cualquier tipo (ADR-0038).
- Un tope a cuántas celdas puede traer una pantalla alcanzable o una fila nueva.
- Cambiar el propio estándar de touch-target o touch-action, o arreglar las celdas que se vuelven visibles.
- Cambiar cómo se calcula el ordinal de un target: la regla de renumeración acepta el ordinal tal como es.
- Dejar crecer las listas de infractores en cualquier caso que no sea el canje o una fila nueva del registro.
- Traducir `docs/product/design-system/README.md`.
- Meter `web-e2e` en `delivery_checks` o dar al e2e un respaldo local distinto del job e2e de GitHub.
- Saltear, poner en cuarentena, reintentar hasta que pase o aflojar una aserción para poner el Gate en verde.
- Una regla de merge propia de e2e distinta de la de los demás jobs de `ci:`.
