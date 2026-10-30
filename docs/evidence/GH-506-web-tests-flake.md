# GH-506 — flake de `web-tests` (GH-465, head `4c6596b6`)

**Resultado: interrumpido en 2 (0 de 2 en rojo).** No se reprodujo, no se nombró causa y no se escribió ningún arreglo.
El diff de esta tarea son solo estos archivos de evidencia; `git diff <base> -- web/src` queda vacío.

Este resultado NO es "no reproducido": el tope completo de 12 corridas `full-load` no se alcanzó. La línea `summary ... cap=2` del log
es la del sondeo de 2 iteraciones, no la del bucle completo (invariante: "no reproducido" exige el resumen al tope completo).

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

## 2. Sondeo y corridas

Script: `docs/evidence/GH-506/stress.sh` (reanudable; una línea `iter` por iteración; `summary` solo al terminar el bucle).
Log: `docs/evidence/GH-506/stress.log`.

Entorno: copia desechable fuera de la worktree de la tarea (`$TMPDIR/wt-4c6596b6`), hecha con
`git archive 4c6596b6 | tar -x` + `git init` + `git add -A` + `git write-tree`, que da el árbol `8b66b62b71dc241576ead159e9997196665fa406`,
igual al de `4c6596b6`; `npm --prefix web ci` propio. `git worktree add` y `git checkout` están denegados por el sistema, por eso no es un
`git worktree add --detach`. No se commitea nada de ella.

```
start tree=8b66b62b71dc241576ead159e9997196665fa406 mode=full-load cap=2 logged=0 time=2026-10-30T07:30:57Z
iter tree=8b66b62b71dc241576ead159e9997196665fa406 mode=full-load n=1 load_start=29.45 load_end=19.27 seed=- result=green failing=-
iter tree=8b66b62b71dc241576ead159e9997196665fa406 mode=full-load n=2 load_start=19.27 load_end=22.49 seed=- result=green failing=-
summary tree=8b66b62b71dc241576ead159e9997196665fa406 mode=full-load n=2 red=0 cap=2 time=2026-10-30T07:43:30Z
```

- **Sondeo (2 iteraciones `full-load`, en segundo plano): el proceso sobrevivió a los turnos** (cada iteración tardó unos 6 minutos); no hizo falta
  trocear en tandas.
- Antes-tasa observada: 0 rojos en 2 (`full-load`, árbol `8b66b62b`). Con n=2 no hay confianza útil: no sirve para aceptar ni descartar nada.
- Limitación de la carga acompañante: en la copia desechable no hay `.venv`, así que `uv run --no-project pytest -n 8` y `... mypy ...`
  fallaron al instante (`Failed to spawn: pytest`) y solo hicieron carga `npm --prefix web run typecheck` y `... build`, además de la carga
  ambiente de la máquina (loadavg 19 a 29 en 16 CPU, con otras tareas). El script no se corrigió después de la sonda.

**No se corrieron** (el tope de turnos de la tarea se agotó antes): `solo` 0 de 30 (sin test nombrado), `full-load` 2 de 12, `shuffle` 0 de 3,
patas forzadas (a), (b), (c) ninguna. Ninguna cifra de este archivo es una prueba de que el flake no existe.

## 3. Causa, arreglo y pruebas forzadas

- Causa: **no nombrada.** Sin condición forzada no hay par rojo/verde (invariante 4); no se escribió ningún arreglo.
- Cuenta de vitest antes y después: sin cambios, porque no se tocó ningún archivo de test. No se grabaron los conteos de archivos y tests.
- Hermanos (mismo patrón, para el issue de seguimiento): ninguno listado, porque no hay patrón. Precedentes a seguir cuando haya causa:
  GH-501 (`adbdd24e`, esperar el cambio de ruta y no el texto que también pinta el panel de atrás) y GH-440 (`14749282`, el límite de paso del censo).

## 4. Qué haría falta para cerrarlo

1. Reanudar `stress.sh` en una copia desechable con `.venv` accesible (para que pytest y mypy sí carguen) hasta los topes: `full-load` 12, `shuffle` 3.
2. Si una corrida da rojo, el log guarda `stress-red-<mode>-<tree>-<n>.txt` con las últimas 200 líneas y los nombres de los tests que fallaron.
3. Con un test nombrado: pata `solo` (30), condición forzada (`taskset -c 0`, `fetch` retenido o reloj movible) y las tres patas con hash de árbol.
