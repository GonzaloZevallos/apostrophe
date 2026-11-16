# GH-563: prueba del reintento único en CI (pendiente, no ejecutada)

Estado: **la prueba en CI real no se corrió.** Este archivo no contiene corridas, duraciones ni reportes, porque ninguno existe todavía.

## Qué falta y por qué

La prueba exige empujar la rama `agentic-ci/GH-563-proof` (un commit encima de la cabeza de la tarea que agrega, por suite, un test que falla solo en su primer intento y uno que siempre falla) y leer dos corridas de CI. El sandbox del Developer rechaza `git push` (el sistema empuja solo la rama de la tarea al entregar), así que el paso quedó bloqueado. La rama no existe en el remoto (`git ls-remote --heads origin 'agentic-ci/GH-563*'` no devuelve nada).

## Pendiente, con lo que cada punto debe mostrar

1. **Corrida 1** (tests que fallan una vez y tests que siempre fallan): `ci-ok` en rojo; el reporte `agentic-flakes:` lista los tres tests sueltos (Playwright, vitest, pytest) y solo el segundo test del grupo `describe.serial`.
2. **Corrida 2** (solo los que fallan una vez): `ci-ok` en verde y el mismo reporte.
3. Por cada test de prueba: shard, rutas seleccionadas y la línea del log que muestra que corrió.
4. Qué entrega el reporter `json` de Playwright para los otros tests del grupo serial.
5. Si el `junit.xml` real de un test flaky de Playwright lista un elemento `failure`. Si lo lista, `scripts/e2e_failures.py` debe saltar los tests que `results.json` marca como flaky (con su caso en `tests/test_e2e_failures.py` y los docs regenerados). Si no, ambos archivos quedan intactos.
6. Duración del `e2e-shard` más lento en cada corrida y el margen contra `timeout-minutes: 30`, contado en reintentos de 160 s; con eso se reemplaza la línea `Shard headroom: measured in GH-563 (c).` de ADR-0040, que sigue sin llenar.

## Nota

La declaración de `rerun_checks` con ids fallidos salió de esta tarea (decisión humana, opción c) y pasa a #602, que espera el token de ids fallidos de agentic-system #530.

Revisado de nuevo el 2026-11-16: la rama `agentic-ci/GH-563-proof` sigue sin existir en el remoto y `git push` sigue rechazado en el sandbox, así que nada de lo anterior cambió.

Revisado por tercera vez el 2026-11-16: `git push --dry-run origin HEAD:refs/heads/agentic-ci/GH-563-proof` lo rechaza el hook del sandbox («the system pushes the task branch when it delivers»); `git ls-remote` funciona, pero la rama sigue sin existir. No se inventó ninguna cifra, y la línea `Shard headroom: measured in GH-563 (c).` de ADR-0040 sigue sin llenar por esa razón.

Revisado por cuarta vez el 2026-11-16, tras la devolución de la revisión: `git ls-remote --heads origin 'agentic-ci/GH-563*'` sigue sin devolver nada. Se necesita que una persona empuje `agentic-ci/GH-563-proof` o que la prueba pase a otra tarea.
