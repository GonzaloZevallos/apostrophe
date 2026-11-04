# GH-542 — rojo de `ci-ok` en el intento 1 de `962bffff` (GH-483)

**Resultado: (a1) flake de un test nuevo en el historial, `[mobile-setup] › e2e/mobile.setup.ts:11:1 › seed the mobile server`, shard `e2e (1)`. `ci-ok` no tuvo defecto propio: reportó el rojo de `e2e`. La causa raíz NO está probada: el log muestra que el servidor móvil agotó su pool de conexiones SQLAlchemy (`QueuePool limit of size 5 overflow 10 reached, timeout 30.00`) mientras el seed hacía `PUT /catalog/varieties/2`, pero no muestra quién tenía las conexiones.**

- Ningún job fue `cancelled`; ningún job llegó al `timeout-minutes: 30`. No es defecto de workflow ni de selección (punto 6).
- La corrección no se escribe en esta parte (solo evidencia). El criterio de hecho y los archivos están en el punto 7.
- Ninguna re-ejecución verde se usa como prueba de nada en este archivo. El intento 2 aparece en las tablas solo como dato.

## Fuente

- **Pegado del humano en GH-569** (parte de GH-542), traído de la API de GitHub el 2026-11-04, solo lectura: fila del run, JSON de jobs de los intentos 1 y 2, y el extracto de log de `e2e (1)` (líneas 749–787). Ningún rol corre `gh`; cada dato de GitHub de abajo sale de ese pegado y dice "pegado".
- **Todo lo que se afirma de `.github/workflows/ci.yml`, `scripts/ci_verdict.py` y `scripts/ci_changes.py` sale de `git show 962bffff:<ruta>`, no del árbol de trabajo.** Así se cita abajo.
- En `962bffff`, `ci-ok` está en la **línea 237** (`git show 962bffff:.github/workflows/ci.yml`, líneas 237–238), con ocho `needs`: `needs: [changes, checks, web, docs, pytest, vitest, e2e, coverage]`. El pedido original dice "línea 242": no coincide con ese head y no se repite.
- En ese head, `e2e` es la matriz de shards: `shard: ${{ fromJSON(needs.changes.outputs.e2e_matrix) }}`, `fail-fast: false`, `timeout-minutes: 30` (líneas 153–161).
- En master hoy (`git show HEAD:.github/workflows/ci.yml`), `ci-ok` está en la línea 253 con nueve `needs`: `[changes, checks, web, docs, pytest, vitest, e2e-shard, e2e, coverage]`. `81745086` renombró la matriz a `e2e-shard` y agregó `e2e` como agregador.
- `scripts/ci_verdict.py` (en `962bffff`, docstring): "pytest, vitest and e2e are treated alike"; un job gating en `failure` o `cancelled` falla; `WARN_JOBS = ("coverage",)`; `ALWAYS_JOBS = ("checks", "web", "docs")`.

## 1. Run, evento y los ocho `needs`

Pegado (fila del run): run `41017640964`, workflow `CI`, evento **`pull_request`**, rama `agentic/GH-483`, head `962bffff6a29016e03586d9b3b019aacaba3d071`. Es el único run de CI de ese sha. Intento 1: `failure`, iniciado `2026-10-30T07:02:37Z`, actualizado `07:06:16Z`. Intento 2: `success`. URL: https://github.com/GonzaloZevallos/apostrophe/actions/runs/41017640964

Los ocho `needs` de `ci-ok` (`962bffff:.github/workflows/ci.yml:238`). Fuente de los datos: pegado, `gh api .../runs/41017640964/attempts/N/jobs`.

| `need` | Intento 1: conclusión | Intento 1: inicio → fin (UTC, 2026-10-30) | Intento 2: conclusión | Intento 2: inicio → fin |
|---|---|---|---|---|
| `changes` | success | 07:02:40 → 07:02:50 | success | 07:02:40 → 07:02:50 |
| `checks` | success | 07:02:40 → 07:03:03 | success | 07:02:40 → 07:03:03 |
| `web` | success | 07:02:40 → 07:03:29 | success | 07:02:40 → 07:03:29 |
| `docs` | success | 07:02:40 → 07:06:01 | success | 07:02:40 → 07:06:01 |
| `pytest (always, ...)` | success | 07:02:53 → 07:05:19 | success | 07:02:53 → 07:05:19 |
| `vitest` | success | 07:02:53 → 07:05:04 | success | 07:02:53 → 07:05:04 |
| `e2e (1)` | **failure** | 07:02:53 → 07:04:24 | success | 07:09:36 → 07:21:26 |
| `e2e (2)` | success | 07:02:54 → 07:05:51 | success | 07:02:54 → 07:05:51 |
| `e2e (3)` | success | 07:02:53 → 07:04:40 | success | 07:02:53 → 07:04:40 |
| `e2e (4)` | success | 07:02:53 → 07:05:10 | success | 07:02:53 → 07:05:10 |
| `coverage` | success | 07:05:21 → 07:05:36 | success | 07:05:21 → 07:05:36 |
| `ci-ok` | **failure** | 07:06:04 → 07:06:15 | success | 07:21:30 → 07:21:37 |

- El `need` `e2e` es la matriz de cuatro shards; su resultado agregado es `failure` en el intento 1 porque `e2e (1)` fue `failure` (el pegado dice que `ci-ok` está rojo "because `e2e` was red"). Con `fail-fast: false` los otros tres shards siguieron y terminaron `success`.
- Todos los demás jobs del intento 2 tienen **los mismos `started_at`/`completed_at` que en el intento 1** (solo cambia el `id`). Es un dato del pegado: ahí solo se volvió a ejecutar `e2e (1)` y `ci-ok`. No hay log que lo pruebe más allá de esos timestamps.
- **Ningún job fue `cancelled`**: las 24 filas del pegado son `success` o `failure`. Por eso no hay evidencia de cancelación que citar, y la pregunta de otro run sobre la misma `ref` entre intentos no cambia ningún resultado. Si hubo otro run en la rama `agentic/GH-483` entre 07:06 y 07:09: no probado (el pegado solo trae el run de este sha).
- En `962bffff`, `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` (línea 14): este run es `pull_request`, así que la concurrencia podría haber cancelado el run, y no lo hizo. Un run por `push` nunca se cancela por concurrencia en ese head.
- La duración del intento 2 de `e2e (1)` (07:09:36 → 07:21:26) es un dato, no una prueba.

## 2. El job rojo, paso y resultado

- **Job:** `e2e (1)`, id `123937551974`, intento 1. **Paso 9:** `Run npm --prefix web run e2e -- --shard="$SHARD" $E2E_ARGS`. **Resultado:** `failure`. Es el paso del workflow `962bffff:.github/workflows/ci.yml:176`.
- Los demás jobs del intento 1 son `success` salvo `ci-ok`.

Log citado (pegado, líneas 749–787 de `e2e (1)`, sin marcas de tiempo):

```text
[WebServer] sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached, connection timed out, timeout 30.00 (Background on this error at: https://sqlalche.me/e/21/3o7r)
sample-app: PUT /catalog/varieties/2 -> 500 Internal Server Error
  ✘   1 [mobile-setup] › e2e/mobile.setup.ts:11:1 › seed the mobile server (33.1s)
...
    Error: Command failed: uv run --no-project python scripts/design/mobile_seed.py --base http://127.0.0.1:38971 --state web/e2e/.tmp/mobile-state.json --facts web/e2e/.tmp/mobile-facts.json
    sample-app: PUT /catalog/varieties/2 -> 500 Internal Server Error
...
  1 failed
    [mobile-setup] › e2e/mobile.setup.ts:11:1 › seed the mobile server ─────────────────────────────
  35 did not run
  2 passed (37.6s)
e2e: failed:
mobile.setup.ts › seed the mobile server
e2e: traces in test-results/0303136-20261030T070340Z
##[error]Process completed with exit code 1.
```

- **ID del test:** `[mobile-setup] › e2e/mobile.setup.ts:11:1 › seed the mobile server` (33.1 s).
- **Mensaje de falla:** `Error: Command failed: uv run --no-project python scripts/design/mobile_seed.py ...` y `sample-app: PUT /catalog/varieties/2 -> 500 Internal Server Error`; el servidor móvil (`[WebServer]`) registró `sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached, connection timed out, timeout 30.00`.
- **Qué hace ese test** (`git show 962bffff:web/e2e/mobile.setup.ts`): `execFileSync('uv', ['run', '--no-project', 'python', 'scripts/design/mobile_seed.py', '--base', mobileBaseUrl(), ...])`. El seed (`962bffff:scripts/design/mobile_seed.py`) llama a la API por HTTP en serie (`urllib`, `HttpApi.call`, `962bffff:scripts/design/sample_app.py:445-464`); un `HTTPError` termina en `SystemExit("sample-app: PUT ... -> 500 ...")`, que es la línea del log.
- **De dónde sale el 500:** el servidor móvil es el `webServer` de `962bffff:web/playwright.config.ts`: `uvicorn tests.e2e_app:create_mobile_e2e_app --factory` sobre `sqlite:///<mobileDbPath()>` (`962bffff:web/e2e/env.ts`, `mobileEnv()`). `962bffff:app/db.py:82` hace `create_engine(url, hide_parameters=True, **kwargs)` sin `pool_size` ni `pool_timeout` para un SQLite de archivo, así que rige el pool por defecto de SQLAlchemy (5 + overflow 10, espera de 30 s): coincide con `size 5 overflow 10 ... timeout 30.00` del log.
- **Efecto en el resto del shard:** `35 did not run`, `2 passed`. El proyecto `mobile` declara `dependencies: ['mobile-setup']` (`962bffff:web/playwright.config.ts`), por eso las celdas móviles no corrieron.
- **Historial:** el test **no** aparece en `GH-251-e2e-flake.md` ni en `GH-506-web-tests-flake.md` (`grep -c -i "mobile\|queuepool\|seed the"` da 0 en ambos). `GH-288-e2e-flake.md` menciona "mobile" 3 veces (líneas 186–189), pero se trata del tiempo de las celdas del walk (4,7 min cada una, `withToastRecorder`), no de `mobile.setup.ts` ni de `QueuePool`. Tampoco hay `QueuePool` en ningún archivo de `docs`, `app`, `tests`, `scripts`, `web/e2e` ni `.github` (`grep -rli queuepool`), ni en el historial (`git log -S"QueuePool"` vacío).

## 3. Mismo árbol

- **Mismo `head_sha`: probado con el pegado.** Los 12 jobs de cada intento traen `head_sha` `962bffff6a29016e03586d9b3b019aacaba3d071`.
- `git rev-parse 962bffff^{tree}` = `a13bef49f110ca9dbb88d87eacf1c339989b53d0` (`c879d302^{tree}` da el mismo árbol: `962bffff` es un commit sin cambios de archivo).
- **Commit de merge que cada intento hizo checkout: no probado.** El run es `pull_request`, así que `actions/checkout` dejó en el log el sha de `refs/pull/N/merge`; el pegado no trae esa línea de ninguno de los dos intentos. `mismo árbol (merge): no probado`. No hay base para decir "mismo" ni "distinto".
- Dato del pegado, no una prueba: los jobs que no fallaron tienen idénticos `started_at`/`completed_at` en ambos intentos (punto 1), es decir, esos jobs no se re-ejecutaron en el intento 2.

## 4. El diff del head

`git diff --stat 127774fd^1 962bffff` (`127774fd` = `Merge pull request #541 from GonzaloZevallos/agentic/GH-483`, `127774fd^1` = `439ecd8ecf1dde2ed5c9a89f6d02b5e26ec854e5`):

```
 docs/product/customers.md                      | 326 ++++++++++-----------
 docs/product/payments.md                       | 386 ++++++++++++-------------
 docs/product/product-language.md               |  10 +-
 docs/product/sale-bill.md                      |  88 +++---
 docs/product/sales.md                          | 284 +++++++++---------
 web/e2e/payments.spec.ts                       |   2 +-
 web/src/screens/clientes/ClienteFicha.test.tsx |   2 +-
 web/src/screens/clientes/ClienteFicha.tsx      |   2 +-
 web/src/screens/clientes/Clientes.test.tsx     |   4 +-
 web/src/screens/clientes/TeDeben.test.tsx      |   2 +-
 web/src/screens/clientes/TeDeben.tsx           |   2 +-
 web/src/screens/clientes/accountRows.ts        |   6 +-
 12 files changed, 561 insertions(+), 553 deletions(-)
```

`git diff -U0 127774fd^1 962bffff -- web/`, sin las líneas `index` y `@@`:

```diff
diff --git a/web/e2e/payments.spec.ts b/web/e2e/payments.spec.ts
--- a/web/e2e/payments.spec.ts
+++ b/web/e2e/payments.spec.ts
-  // debiendo", and Te deben's header total is their sum (payments.md, Metrics
+  // debiendo", and Te deben's header total is their sum (payments.md, Métricas
diff --git a/web/src/screens/clientes/ClienteFicha.test.tsx b/web/src/screens/clientes/ClienteFicha.test.tsx
--- a/web/src/screens/clientes/ClienteFicha.test.tsx
+++ b/web/src/screens/clientes/ClienteFicha.test.tsx
- * answer (payments.md, "On screen"): this test fakes `GET /customers/:id` and
+ * answer (payments.md, "En pantalla"): this test fakes `GET /customers/:id` and
diff --git a/web/src/screens/clientes/ClienteFicha.tsx b/web/src/screens/clientes/ClienteFicha.tsx
--- a/web/src/screens/clientes/ClienteFicha.tsx
+++ b/web/src/screens/clientes/ClienteFicha.tsx
- * "Registrar cobro" (`payments.md`, "On screen"). Every figure here —
+ * "Registrar cobro" (`payments.md`, "En pantalla"). Every figure here —
diff --git a/web/src/screens/clientes/Clientes.test.tsx b/web/src/screens/clientes/Clientes.test.tsx
--- a/web/src/screens/clientes/Clientes.test.tsx
+++ b/web/src/screens/clientes/Clientes.test.tsx
- * `standing` (payments.md, "On screen") — `fetchStub` below dispatches on the
+ * `standing` (payments.md, "En pantalla") — `fetchStub` below dispatches on the
-  // resort or add (payments.md, "Who owes and the totals").
+  // resort or add (payments.md, "Quién debe y los totales").
diff --git a/web/src/screens/clientes/TeDeben.test.tsx b/web/src/screens/clientes/TeDeben.test.tsx
--- a/web/src/screens/clientes/TeDeben.test.tsx
+++ b/web/src/screens/clientes/TeDeben.test.tsx
- * `GET /payments/debtors` alone (payments.md, "Who owes and the totals").
+ * `GET /payments/debtors` alone (payments.md, "Quién debe y los totales").
diff --git a/web/src/screens/clientes/TeDeben.tsx b/web/src/screens/clientes/TeDeben.tsx
--- a/web/src/screens/clientes/TeDeben.tsx
+++ b/web/src/screens/clientes/TeDeben.tsx
- * "Te deben" (`payments.md`, "On screen"): the section on top of Clientes. The total, the count
+ * "Te deben" (`payments.md`, "En pantalla"): the section on top of Clientes. The total, the count
diff --git a/web/src/screens/clientes/accountRows.ts b/web/src/screens/clientes/accountRows.ts
--- a/web/src/screens/clientes/accountRows.ts
+++ b/web/src/screens/clientes/accountRows.ts
- * Which of a customer's account rows carries "Delete payment" (`payments.md`, "On
- * screen": it exists on every later payment, once). A later payment can appear as
+ * Which of a customer's account rows carries "Delete payment" (`payments.md`, "En
+ * pantalla": it exists on every later payment, once). A later payment can appear as
- * (`payments.md`, "On screen: the customer's card"). Reads only `kind`, `how_paid`,
+ * (`payments.md`, "En pantalla: la ficha del cliente"). Reads only `kind`, `how_paid`,
```

**Conclusión:** las 7 rutas de `web/` cambian solo texto de comentario (`//` o dentro de `/** ... */`): cada línea `+`/`-` del diff empieza con `//` o con ` *`, y solo renombra una cita de sección de `payments.md` ("On screen" → "En pantalla", etc.). Los 7 archivos:

1. `web/e2e/payments.spec.ts`: **es un spec e2e**; su único cambio es una línea de comentario `//`.
2. `web/src/screens/clientes/ClienteFicha.test.tsx` (comentario)
3. `web/src/screens/clientes/ClienteFicha.tsx` (comentario)
4. `web/src/screens/clientes/Clientes.test.tsx` (comentario)
5. `web/src/screens/clientes/TeDeben.test.tsx` (comentario)
6. `web/src/screens/clientes/TeDeben.tsx` (comentario)
7. `web/src/screens/clientes/accountRows.ts` (comentario)

Los otros 5 archivos son `docs/product/customers.md`, `payments.md`, `product-language.md`, `sale-bill.md` y `sales.md`: ningún código de producción los lee en tiempo de ejecución. Si algún test de pytest los lee (la selección de `ci_changes` mapea qué shards de pytest leen `docs/`): no probado aquí; en cualquier caso no entran en el camino del paso rojo, porque el seed habla por HTTP con un servidor que no lee `docs/product/`.

Nada de este diff toca `web/e2e/mobile.setup.ts`, `scripts/design/mobile_seed.py`, `scripts/design/sample_app.py`, `app/db.py` ni `tests/e2e_app.py` (no están en la lista de arriba). **Nota:** `127774fd^1` es master al momento del merge (después del run); la base que usó el run `pull_request` es el `HEAD^1` del commit de merge que hizo checkout (punto 5), que el pegado no trae.

## 5. Selección

- **Run `pull_request`.** `962bffff:scripts/ci_changes.py` (`diff_argv`, líneas 74–78) arma `["git", "diff", "--name-only", "--no-renames", "HEAD^1", "HEAD"]`: diferencia `HEAD^1..HEAD` del commit de merge que `actions/checkout` dejó en `HEAD`. `962bffff:.github/workflows/ci.yml` hace `fetch-depth: 2` en `changes`. Por esa regla, un job `changes` que se ejecuta de nuevo sobre el mismo commit de merge elige las mismas suites.
- **Lo que muestra el pegado:** las suites elegidas en el intento 1 fueron `changes` (success), `checks`, `web`, `docs`, `pytest`, `vitest`, `coverage` y los cuatro shards `e2e (1..4)`. En el intento 2, `changes` tiene los mismos `started_at`/`completed_at` que en el intento 1 (`07:02:40 → 07:02:50`): **no se volvió a ejecutar**, así que el intento 2 no recalculó la selección; reutilizó la del intento 1. Que el commit de merge fuera el mismo en los dos intentos: no probado (punto 3).
- **No es un run por `push` a `agentic-ci/**`.** En `962bffff`, `on:` es `push: branches: [master]` y `pull_request` (líneas 3–6): el merge-base con `origin/master` de ese caso no aplica. No probado nada más allá de eso.
- La selección no es la causa: el shard rojo ya estaba elegido y el test rojo no se saltó ni se agregó; falló dentro de un shard que corrió.

## 6. Resultado: (a1) test nuevo en el historial

Argumento, de la línea citada y del workflow en `962bffff`:

- **No es Infraestructura.** El paso rojo es el 9 (`npm --prefix web run e2e`), no uno de entradas fijadas (`uv sync --locked`, `npm ci`, `playwright install --with-deps`): la ejecución llegó a él y el proceso terminó con `exit code 1` por una falla de test. El runner no se perdió: el job terminó en 91 s con un resultado.
- **No es (b).** Ningún job `cancelled` (punto 1), ningún job cerca de `timeout-minutes: 30`, el `if:` de `e2e` (`needs.changes.outputs.e2e == 'true'`) dejó correr los cuatro shards, y `ci-ok` aplicó su regla sin desviarse: `e2e` en `failure` falla (`scripts/ci_verdict.py`, `_gating`: "`failure` y `cancelled` fail"). `ci_changes` no cambió de intento a intento (`changes` no se re-ejecutó, punto 5).
- **No es (a2).** El test y el error `QueuePool` no están en `GH-251-e2e-flake.md`, `GH-288-e2e-flake.md` ni `GH-506-web-tests-flake.md`, ni en ningún otro archivo ni commit del repo (punto 2).
- **No es "No reproducido".** GitHub conserva el log: el extracto de arriba lo trae.
- **Por eso (a1)**: el rojo es un test (un test de setup de Playwright) sin antecedente en el historial. **Qué NO está probado:** que el defecto esté en el test y no en la app. La línea citada ubica la falla en el pool de conexiones del servidor móvil (`app/db.py:82`, pool por defecto), con un único cliente secuencial (el seed). Cómo se llegó a 15 conexiones sin devolver durante un `PUT`: no probado (el extracto no trae las peticiones previas del servidor).
- **¿`81745086` (la división de master) quita el mecanismo?** No, y el argumento sale de la línea, no de las fechas: la línea es un `QueuePool ... timeout 30.00` del servidor uvicorn del proyecto `mobile-setup`. `git show 81745086 -- .github/workflows/ci.yml` solo renombra la matriz a `e2e-shard`, agrega el agregador `e2e` y cambia los `needs` de `ci-ok`; el paso 9 del shard no cambia. `app/db.py`, `tests/e2e_app.py`, `web/e2e/mobile.setup.ts` y `web/playwright.config.ts` no cambiaron entre `962bffff` y master (`git diff 962bffff HEAD --stat -- <rutas>` no los lista). Lo único que cambió en ese camino es `scripts/design/mobile_seed.py` (1 línea: `HttpApi(args.base, env.get("APOSTROPHE_DATABASE_URL"))`), que no toca el pool.

## 7. Criterio de hecho y archivos de la corrección

**Criterio:** el test `[mobile-setup] › e2e/mobile.setup.ts › seed the mobile server` (en el shard que lo contenga, paso `npm --prefix web run e2e -- --shard=...`) **ya no depende de que el pool de conexiones por defecto de SQLAlchemy (5 + overflow 10, espera 30 s) del servidor móvil alcance para el tráfico del seed**; es decir, el seed ya no deja conexiones tomadas que agoten el pool.

- No se acepta como corrección: subir `pool_size`/`pool_timeout`, reintentar el `PUT`, reintentar el job, marcarlo `continue-on-error` o saltar el test (ocultan la causa; invariante 1 del pedido).
- Primer paso de la parte 2: reproducir con el pool pequeño (por ejemplo, un `pool_size` bajo en el motor del servidor móvil, solo para la reproducción) para ubicar qué petición no devuelve su conexión (el log de arriba no lo dice). Hasta entonces, la causa raíz: no probada.
- **Archivos candidatos, nombrados contra master** (no es una lista cerrada; la fijará la reproducción): `app/db.py` (`make_engine`, línea 82: el único `create_engine`), `tests/e2e_app.py` (`create_mobile_e2e_app`, línea 148), `scripts/design/sample_app.py` y `scripts/design/mobile_seed.py` (cliente del seed), `web/e2e/mobile.setup.ts` (el test), y el código del endpoint que atiende `PUT /catalog/…`: en master la ruta pasó de `/catalog/varieties/{id}` a `/catalog/products/{product_id}` (commits `2d9345a5`, `6551df97`), así que el router de `app/catalog/adapters/`.
- Un test de la corrección debe nombrar el mismo error: un seed completo contra un servidor con el pool por defecto, sin `TimeoutError`.
- Esto es la parte 2 de GH-542. Esta parte no edita ningún test, workflow ni script.
