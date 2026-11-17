# GH-563: evidencia local del reintento flaky, respuesta de junit y margen de los shards

Cabeza medida: `da3ca7950c9c408f5fa544654304287e55e2fa29`. Es evidencia de una sola corrida local por suite,
sin tasa ni promedio, y ninguna es un paso del gate. Los tests de prueba **no se commitean**: vivieron solo en
una copia de trabajo descartable que se borró al terminar. Este archivo y la línea del ADR-0040 son lo único
que entra al repositorio. Solo nombres de tests; ningún mensaje, salida, stack ni valor tipeado (CODING_STANDARDS §9).

## Método

- Copia fuera del repositorio: `d="$(mktemp -d)"; git archive HEAD | tar -x -C "$d"`. Dentro de `$d`:
  `uv venv --python 3.13`, `uv sync --locked --extra dev`, `npm --prefix web ci --no-fund --no-audit`,
  `npx --prefix web playwright install chromium`. Nunca se usó `git worktree` ni `git stash`, y no se tomó prestado
  ningún `.venv`, `node_modules` ni navegador de otro checkout. La copia no tiene `.git`, por eso el directorio de
  resultados de Playwright se llama `nogit-<sello UTC>`.
- Por suite, un test *flaky-once* y uno *siempre falla*. El flaky-once mira un archivo marcador en
  `$d/.proof-markers/<suite>`, resuelto desde la ubicación del propio archivo de test (nunca `tmp_path`): si no
  existe, lo crea y falla; si existe, pasa. `.proof-markers` se borró antes de cada corrida.
- Todas las corridas con `CI=1`, con las banderas del paso de `ci.yml` de cada suite, más el filtro de ruta.

Banderas que se dejaron afuera, cada una con su razón:

| Suite | Paso de `ci.yml` | Qué cambia en la prueba local |
| --- | --- | --- |
| Playwright | `npm --prefix web run e2e -- --shard="$SHARD" $E2E_ARGS` | Se omiten `--shard` y `$E2E_ARGS` (vacío en CI, ver "Margen de los shards"): se corre un solo archivo, no hay nada que repartir. Se agrega el filtro `e2e/zzProof.spec.ts`. |
| Playwright | `playwright install --with-deps chromium` | Se instaló sin `--with-deps`: instala paquetes del sistema con apt y pide root. Los navegadores bastaron. |
| pytest | `-n auto --reruns 1 --cov --cov-report= -o junit_family=xunit1 --junitxml=... -- $PATHS` | Todas las banderas se conservan. `$PATHS` es `tests/test_zz_proof.py`; `COVERAGE_FILE` queda en su valor por defecto; el `--junitxml` apunta a `$d/rt/pytest-proof.xml`. `--cov` no rompió la prueba (avisa `No data was collected`, que es lo esperado con un test sin código de `app`). |
| vitest | `npm --prefix web test -- --coverage $VITEST_ARGS` | `--coverage` se conserva. `$VITEST_ARGS` (que arma `scripts.ci_vitest` desde `vitest list --changed`) se reemplaza por `src/zzProof.test.ts`; esos dos pasos previos no se corrieron. |

## Playwright

Proyecto `secure-origin`. Comando: `CI=1 npm --prefix web run e2e -- e2e/zzProof.spec.ts` (pasa por
`web/scripts/e2e.sh` y su epílogo). Código de salida: **1** (esperado: hay un test que siempre falla).

Resumen del reporter `list` de Playwright:

```
  1 failed
    [secure-origin] › e2e/zzProof.spec.ts:16:1 › proof always-failing
  1 flaky
    [secure-origin] › e2e/zzProof.spec.ts:8:1 › proof flaky-once
```

Estados en `results.json` (`retry`, `status` de cada intento):

| Test | `status` final | Intentos |
| --- | --- | --- |
| `proof flaky-once` | `flaky` | 0: `failed`, 1: `passed` |
| `proof always-failing` | `unexpected` | 0: `failed`, 1: `failed` |

`stats` del reporte: `expected: 0`, `unexpected: 1`, `flaky: 1`.

`ci_flaky extract playwright web/test-results/*/results.json <out>`:

```json
{"v": 1, "check": "web-e2e", "tests": ["zzProof.spec.ts › proof flaky-once"]}
```

El flaky-once pasó en el reintento y figura; el que siempre falla terminó `failed` y no figura.

## pytest

Comando: `CI=1 uv run --no-project pytest -n auto --reruns 1 --cov --cov-report= -o junit_family=xunit1 --junitxml="$d/rt/pytest-proof.xml" -- tests/test_zz_proof.py`.
Código de salida: **1**. Última línea de pytest: `1 failed, 1 passed, 2 rerun`.

Estado final por test, en el junit (`testcase` en orden de documento, solo nombres de etiqueta):

| Test | `testcase` | Hijos |
| --- | --- | --- |
| `test_proof_always_failing` | 2 | el 1.º sin hijos, el 2.º con `failure` |
| `test_proof_flaky_once` | 2 | ninguno de los dos con hijos |

`ci_flaky extract pytest "$d/rt/pytest-proof.xml" <out>`:

```json
{"v": 1, "check": "tests", "tests": ["tests/test_zz_proof.py::test_proof_flaky_once"]}
```

El flaky-once figura; el que siempre falla terminó con `failure` en su último intento y no figura.

## vitest

Comando: `CI=1 npm --prefix web test -- --coverage src/zzProof.test.ts` (proyecto `unit`).
Código de salida: **1**. Resumen: `Tests  1 failed | 1 passed (2)`.

Estados en `web/test-results/vitest.json` (cantidad de `failureMessages`, solo el conteo):

| Test | `status` | `failureMessages` |
| --- | --- | --- |
| `proof flaky-once` | `passed` | 1 |
| `proof always-failing` | `failed` | 2 |

`ci_flaky extract vitest web/test-results/vitest.json <out>`:

```json
{"v": 1, "check": "web-tests", "tests": ["web/src/zzProof.test.ts › proof flaky-once"]}
```

## Reporte

`ci_flaky report` sobre los tres JSON (un directorio con `flaky-pytest.json`, `flaky-vitest.json`, `flaky-playwright.json`):

```
agentic-flakes: {"v":1,"check":"tests","tests":["tests/test_zz_proof.py::test_proof_flaky_once"]}
agentic-flakes: {"v":1,"check":"web-e2e","tests":["zzProof.spec.ts › proof flaky-once"]}
agentic-flakes: {"v":1,"check":"web-tests","tests":["web/src/zzProof.test.ts › proof flaky-once"]}
```

Los tres tests flaky-once aparecen en su `check`; ninguno de los que siempre fallan.

## Respuesta de junit

Salida del epílogo de `e2e.sh` en la misma corrida de Playwright que tenía los dos tests (nombres solamente):

```
e2e: failed:
zzProof.spec.ts › proof always-failing
e2e: traces in test-results/nogit-20261117T144526Z
```

Extracto del `junit.xml` de esa corrida (nombre, `classname` y etiquetas hijas; sin mensajes):

```
<testsuite name="zzProof.spec.ts" tests="2" failures="1" skipped="0" errors="0">
  <testcase name="proof flaky-once" classname="zzProof.spec.ts">          hijos: system-out
  <testcase name="proof always-failing" classname="zzProof.spec.ts">      hijos: system-out, failure
```

Y el `results.json` de la misma corrida: `proof flaky-once` → `flaky` (`failed`, luego `passed`);
`proof always-failing` → `unexpected` (`failed`, `failed`).

Respuestas:

- (a) **No.** El test flaky-once no tiene hijo `failure` ni `error` en el junit. El reporter `junit` de Playwright
  escribe el resultado final del test, no el de cada intento, así que el epílogo (`scripts/e2e_failures.py`) no lo lista.
- (b) **Un** `testcase` por test, tanto el flaky-once como el que siempre falla (2 `testcase` en total).
  Ningún nombre sale dos veces, así que `failures()` no necesita cambios: `scripts/e2e_failures.py` y
  `tests/test_e2e_failures.py` quedan intactos.

Alcance: la corrida cubre solo el proyecto `secure-origin`. La unicidad de nombres de las celdas de teléfono
(`mobile`) se verificó leyendo `web/e2e/mobile.spec.ts:42-44` (el título es `phone standard at ${size}, ${theme}`,
único por par tamaño/tema), no corriéndolas.

## Margen de los shards

Las últimas 10 corridas verdes de `ci.yml` en `master` que tienen jobs `e2e-shard (N)`
(`gh run list --workflow ci.yml --branch master --status success --limit 30` y `gh run view <id> --json jobs`, solo lectura).
Duración por shard = `completedAt − startedAt` del job, en segundos. Ninguna corrida fue un re-run (`attempt` 1 en todas).
Los 4 shards de cada una terminaron `success`. `e2e_args` estaba vacío en las 10: el paso de `e2e-shard (1)` de cada una
imprime `E2E_ARGS: ` sin valor, y la matriz comparte la salida del job `changes`.

| Corrida | Cabeza | Evento | Intento | Shard 1 | Shard 2 | Shard 3 | Shard 4 | Máx. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 44077600358 | 7515f880 | push | 1 | 859 | 234 | 212 | 178 | 859 |
| 44077447364 | eb3ea112 | push | 1 | 873 | 252 | 196 | 155 | 873 |
| 44069683662 | df8770dc | push | 1 | 990 | 143 | 179 | 150 | 990 |
| 44039639085 | d63dc11d | push | 1 | 979 | 148 | 157 | 151 | 979 |
| 44030852688 | 28d4c199 | push | 1 | 982 | 157 | 157 | 140 | 982 |
| 44026686450 | 9a372239 | push | 1 | 976 | 159 | 148 | 168 | 976 |
| 44016355878 | 54b2df1e | push | 1 | 1047 | 140 | 155 | 153 | 1047 |
| 44012083965 | d1ae27a1 | workflow_dispatch | 1 | 976 | 159 | 172 | 173 | 976 |
| 43919181190 | b6599316 | push | 1 | 1071 | 123 | 191 | 168 | 1071 |
| 43849008456 | e6a06fbb | push | 1 | 1092 | 157 | 136 | 129 | 1092 |

- **M = 1092 s** (corrida 43849008456, shard 1).
- Margen = 1800 − 1092 = **708 s**, es decir ⌊708 / 160⌋ = **4** reintentos de un test de 160 s.
- 708 s ≥ 600 s (un intento de una celda de teléfono, `MOBILE_TEST_TIMEOUT_MS`): **alcanza para un reintento de celda**,
  con 108 s de sobra. `timeout-minutes` queda en 30; `ci.yml` y `gate.md` no cambian.

## Hallazgos

- **El reintento de `mobile` no se probó.** Un reintento del proyecto `mobile` corre en el segundo servidor que
  `mobile-setup` sembró una sola vez (`web/playwright.config.ts:106-122`), no en un backend nuevo. Lo de "worker nuevo con
  backend y base worker-scoped frescos" del addendum de GH-563 está mostrado para `secure-origin` solamente y no se
  ejercitó acá. La oración del ADR no se tocó.
- El shard 1 es de lejos el más largo (859 a 1092 s contra 123 a 252 s de los otros tres) en las 10 corridas, y el margen
  sale entero de él. No se investigó por qué; el reparto de archivos entre shards queda fuera de este issue.
- El margen de 708 s es chico frente a un reintento de celda (600 s): si M subiera más de 108 s, `timeout-minutes: 30` ya no
  cubriría ese reintento y habría que subirlo a ⌈(M + 600) / 60⌉ minutos en `ci.yml`, `gate.md` y el ADR-0040.
- La medida es la duración del job completo (instalación incluida), no la del test: es la que cuenta contra `timeout-minutes`.
- En el junit de pytest (`xunit1`) los intentos fallidos previos al último salen como `testcase` sin hijos, y es el
  nombre repetido lo que hace que `ci_flaky` lo detecte. Los tres JSON extraídos lo confirman; `ci_flaky.py` no se tocó.

## Primer reintento real en CI

Pendiente. Se enlaza acá cuando aparezca el primero después de que GH-563 se integre; no es condición para cerrar este issue.

## Tests de prueba (no commiteados)

Estos son los tres archivos, tal cual corrieron en la copia. Ninguno está en el repositorio.

`web/e2e/zzProof.spec.ts`:

```ts
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from './fixtures.js'

const marker = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.proof-markers', 'playwright')

test('proof flaky-once', () => {
  if (!existsSync(marker)) {
    mkdirSync(path.dirname(marker), { recursive: true })
    writeFileSync(marker, 'x')
    expect(1).toBe(2)
  }
})

test('proof always-failing', () => {
  expect(1).toBe(2)
})
```

`tests/test_zz_proof.py`:

```python
from pathlib import Path

MARKER = Path(__file__).resolve().parent.parent / ".proof-markers" / "pytest"


def test_proof_flaky_once() -> None:
    if not MARKER.exists():
        MARKER.parent.mkdir(parents=True, exist_ok=True)
        MARKER.write_text("x")
        raise AssertionError("first attempt")


def test_proof_always_failing() -> None:
    raise AssertionError("always")
```

`web/src/zzProof.test.ts`:

```ts
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const marker = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.proof-markers', 'vitest')

test('proof flaky-once', () => {
  if (!existsSync(marker)) {
    mkdirSync(path.dirname(marker), { recursive: true })
    writeFileSync(marker, 'x')
    expect(1).toBe(2)
  }
})

test('proof always-failing', () => {
  expect(1).toBe(2)
})
```
