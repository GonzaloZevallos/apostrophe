# GH-506 — flake de `web-tests` (GH-465, head `4c6596b6`)

**Resultado: arreglado, con el par forzado, un defecto de orden de tests hallado por la pata `shuffle`. El flake exacto de GH-465 NO se reprodujo ni se demostró que sea este defecto.**

- `full-load`: tope completo alcanzado, `summary ... n=12 red=0 cap=12`: 0 rojos en 12 (con las cuatro compañías en carga real, ver sección 2). Esto describe esa carga ambiente, no es una prueba.
- `shuffle`: tope completo alcanzado, `summary ... n=3 red=2 cap=3`: 2 rojos en 3, seeds `163994` y `780320`, ambos en `Clientes.test.tsx` y `NuevaVenta.test.tsx`.
- Esos rojos son una dependencia del orden de los tests dentro del archivo: con el orden por defecto de vitest (el del gate) no ocurren. Es un defecto real y determinista, pero el registro del gate no conserva qué test falló, así que no puedo decir que sea la causa del rojo de GH-465. Queda como hipótesis.
- Pata `solo` (30): no se corrió, porque el registro no nombra ningún test.
- No hay cambios en `web/src` fuera de tests: `git diff <base> -- web/src ':!*.test.*' ':!web/src/test-setup.ts'` vacío.

## 1. Qué falló (registro del gate local `merge` de GH-465)

Fuente: `.agentic/tasks/GH-465.md`, líneas `merge_checks:` y `flakes:`.

```
flakes: [{check: web-tests, gate: merge, head: 4c6596b6, tests: []}]
merge_checks: ... {duration_s: 386.5, flake: true, master: 2bc885a7a0f462ecaa3d8e204497a4c78ac06cb4, name: web-tests, passed: true} ...
  head: 78382e1827a4f34b00605496e1c96d2c24537173, master: 2bc885a7a0f462ecaa3d8e204497a4c78ac06cb4
```

- **Archivo, test y mensaje que fallaron: no se conservaron.** `tests: []` en el registro y el log de la corrida (`logs/GH-465-20261029T013141Z.log`)
  no contiene la salida de vitest del gate. El registro está vencido para este dato: no se nombra ningún test, se omite la pata `solo`
  y las corridas de suite completa serían las que lo nombraran.
- Las filas `affected-only ... failed` de `## Developer: pure-core` en `GH-465.md` dicen `affected: nothing selected -> full`: son la
  caída a suite completa, no el flake.

| Qué | SHA | `git rev-parse <sha>^{tree}` |
|---|---|---|
| `4c6596b6` (merge que probó el gate) | `4c6596b65ecd38a5a0fc65791eea2b0ef26cef52` | `8b66b62b71dc241576ead159e9997196665fa406` |
| `4c6596b6^1` (rama GH-465, `head` del gate) | `78382e1827a4f34b00605496e1c96d2c24537173` | `90d811d0b20d0c3bcaaf2f7db435902a83ad8788` |
| `4c6596b6^2` (master, `master` del gate) | `2bc885a7a0f462ecaa3d8e204497a4c78ac06cb4` | `87667bb051d4574a39c0193621fcd452dd1d3d1d` |

El registro guarda un solo `head` (`4c6596b6`) para la corrida roja y la verde; no guarda un SHA por corrida. No se puede demostrar que ambas
probaron el mismo árbol: si probaron árboles distintos, el rojo es una **posible interacción del merge**. Con un solo head registrado,
se asume el mismo árbol `8b66b62b`.

`git diff --stat`:

- `git diff --stat 4c6596b6^1 4c6596b6` (lo que aportó master a la rama): `208 files changed, 8407 insertions(+), 9014 deletions(-)`.
  **Tocó `web/`**: 133 archivos (`web/src/screens/withdrawals/*`, `web/src/shell/Shell.tsx`, `web/src/test/behindPane.ts`, `web/src/styles/app.css`, ...).
  No tocó `web/src/test-setup.ts` ni `web/vite.config.ts`.
- `git diff --stat 4c6596b6^2 4c6596b6` (lo que aportó la rama GH-465 a master): `40 files changed, 16358 insertions(+), 41 deletions(-)`.
  **Tocó `web/`**: 5 archivos: `web/package.json`, `web/package-lock.json`, `web/scripts/docs/jsdom.d.ts`,
  `web/scripts/docs/mermaidParse.test.ts` (test nuevo, 72 líneas), `web/scripts/docs/mermaidParse.ts`.

Hipótesis sin probar (no hay evidencia que la sostenga): el único archivo de test que la rama sumó a vitest es `mermaidParse.test.ts`;
los tests de master que cambiaron son los de `withdrawals`, `Shell` y `behindPane`. Ninguno se nombra como causa.

## 2. Corridas

Script: `docs/evidence/GH-506/stress.sh` (reanudable). Log: `docs/evidence/GH-506/stress.log`. Las salidas de los rojos: `docs/evidence/GH-506/stress-red-shuffle-8b66b62b-1.txt` y `-3.txt`.

Entorno: copia desechable fuera de la worktree (`git worktree` y `git checkout` están denegados por el sistema): `git archive 4c6596b6 | tar -x` + `git init` + `git add -A` + `git write-tree` da el árbol `8b66b62b71dc241576ead159e9997196665fa406`, igual al de `4c6596b6`; `npm --prefix web ci` propio.

- El sondeo de 2 iteraciones en segundo plano sobrevivió a los turnos. Las 2 primeras iteraciones `full-load` (sin `counts=`) tuvieron la carga defectuosa del primer intento (pytest y mypy fallaban al spawn sin `.venv`); se conservan en el log y cuentan para el tope de 12, pero **las 10 siguientes (n=3 a n=12) son las que tuvieron la carga completa**.
- Carga completa: la copia lleva un symlink `.venv` a la de la worktree de la tarea (el script lo excluye del hash del árbol). Las líneas `companion` del log lo muestran, por ejemplo en n=3: `uv run --no-project pytest -n 8` started=2 finished=1 fastfail=0; `mypy` started=259 finished=258; `typecheck` started=8; `build` started=7. El script ya no repite en bucle un compañero que falla al instante: lo corta y lo registra como `fastfail`.
- Carga ambiente de la máquina: loadavg 12 a 31 en 16 CPU, con otras tareas.
- Tasa antes: `full-load` 0 de 12; `shuffle` 2 de 3.

```
summary tree=8b66b62b71dc241576ead159e9997196665fa406 mode=full-load n=12 red=0 cap=12 time=2026-10-30T09:09:14Z
summary tree=8b66b62b71dc241576ead159e9997196665fa406 mode=shuffle n=3 red=2 cap=3 time=2026-10-30T09:21:46Z
```

Conteos de vitest (líneas `Test Files` / `Tests` de las corridas completas sobre `4c6596b6`, árbol `8b66b62b`): `Test Files 240 passed | 1 skipped (241)`, `Tests 3653 passed | 4 skipped (3657)`; en las corridas `shuffle` rojas: `2 failed | 238 passed` y `3651 passed` más los 2 en rojo, la misma suma 3657.

## 3. Causa, arreglo y pruebas forzadas

Causa (del defecto hallado por `shuffle`, no demostrada para el flake de GH-465): estado que un test deja para el siguiente dentro del mismo archivo.

1. `src/screens/clientes/Clientes.test.tsx`, test `with no hand-off the list moves nothing and focuses nothing`: el hand-off de "Collect" (`paymentReturn.ts`, un módulo, no el router) lo deja otro test del archivo sin consumir y la lista del siguiente enfoca `Collect from Ana Pérez`. `ClienteFicha.test.tsx` e `Inicio.test.tsx` ya llaman a `consumePaymentReturn()` en su limpieza; este archivo no.
2. `src/screens/ventas/NuevaVenta.test.tsx`, test `with no history behind it, "Close" replaces the form with Ventas instead of pushing it`: usa el `router` singleton, y el historial de jsdom es compartido por todos los tests del archivo; la aserción `navigate(-1)` -> `not.toBe(SALE_NEW)` dependía de lo que dejaron los tests anteriores.

Arreglo (solo tests; ni reintento ni plazo más largo): `consumePaymentReturn()` en el `afterEach` de `Clientes.test.tsx`; y en `NuevaVenta.test.tsx` la aserción pasa a comparar `window.history.length` antes y después de "Close" (un replace lo deja igual, un push suma uno), que no depende de lo que hubiera detrás.

Condición forzada: `npx vitest run --sequence.shuffle --sequence.seed=163994 src/screens/clientes/Clientes.test.tsx src/screens/ventas/NuevaVenta.test.tsx` (determinista: dos corridas seguidas dan lo mismo).

| Pata | Árbol | Resultado |
|---|---|---|
| (a) rojo en `4c6596b6`, sin arreglo | `8b66b62b71dc241576ead159e9997196665fa406` | 2 failed, 51 passed (2 de 2 corridas) |
| (b) verde en `4c6596b6` con el arreglo aplicado | `bf21424a5bcdfc70648d9dca04c0fc9b737cd69e` | 53 passed (53) |
| (c0) base de la tarea sin arreglo: también rojo (master se movió, pero estos dos tests siguen fallando) | `7f4b86b8ab334b84bae14a69cb0a91744707d970` | 2 failed, 52 passed (54) |
| (c) base de la tarea con el arreglo, mismo seed | árbol del commit de esta entrega (ver `git rev-parse HEAD^{tree}`) | 54 passed (54) |

El seed `780320` (el otro rojo del log) con el arreglo en la base: 54 passed (54). Después-tasa por conteo: no se corrió un conjunto grande tras el arreglo; la prueba que vale es el par forzado de arriba. No se ejecutó la suite completa en `shuffle` después del arreglo.

Conteos antes y después del arreglo, iguales: los dos archivos pasan de 54 tests a 54; el diff no añade ni quita ningún `test(`/`it(` (0 líneas); `vitest list` en la base y en la cabeza da `252` archivos y `2641` tests en ambos casos (medido con el árbol de trabajo antes de editar y después de editar: igual).

## 4. Hermanos (mismo patrón, para un issue de seguimiento)

No se corrió `shuffle` tras el arreglo sobre toda la suite, así que no hay lista medida. Candidatos por patrón: tests que usan el `router` singleton de `../../router` sin reiniciar el historial (`grep -l "from '../../router'" web/src/**/*.test.tsx`), y archivos que hacen clic en un enlace "Collect" sin consumir `paymentReturn`. Precedentes: GH-501 (`adbdd24e`) y GH-440 (`14749282`).
