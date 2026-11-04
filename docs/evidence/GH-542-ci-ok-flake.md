# GH-542: diagnóstico del rojo de `ci-ok` en el intento 1 de 962bffff

Bloqueado: falta el pegado del humano en el issue. Sin él no se escribe ninguno de los siete puntos, porque ninguno puede salir de inferencia y ningún rol puede correr `gh`.

## Qué falta

Reverificado en la devolución del review (2026-11-04): el issue y el documento de la tarea siguen sin el pegado.

Faltan los tres artefactos. Ninguno estaba en el documento de la tarea ni en el issue al momento de escribir este archivo.

1. **Fila de `gh run list`** del run de `962bffff6a29016e03586d9b3b019aacaba3d071`: run id, `event`, `headBranch`, `headSha` y número de intentos.
   - Comando: `gh run list --commit 962bffff6a29016e03586d9b3b019aacaba3d071 --json databaseId,event,headBranch,attempt,conclusion`.
2. **JSON de jobs del intento 1 y de la re-ejecución**, con `conclusion`, `started_at` y `completed_at` de cada job.
   - Comando: `gh api repos/{owner}/{repo}/actions/runs/<id>/attempts/1/jobs` (y lo mismo con el número del último intento).
3. **El `--log-failed` del job que realmente se puso rojo**, o el mensaje propio de GitHub diciendo que el log ya no existe.
   - Comando: `gh run view <id> --attempt 1 --log-failed`.
   - Si el rojo es `ci-ok` mismo, su línea de veredicto (por ejemplo `e2e: failure`) solo nombra al job de arriba; hace falta el log de ese job.

## Qué no se concluye

- No se escribe "no reproducido": esa conclusión solo vale citando el mensaje de GitHub de que el log no existe, y ese mensaje no está.
- No se elige un resultado (a1, a2, b, infraestructura) sin la línea de log citada.
- Ninguna re-ejecución verde se cita como prueba.

## Puntos

Los siete puntos quedan sin escribir hasta que lleguen los tres artefactos:

1. Run id, evento y tabla de los ocho `needs`: pendiente.
2. Job, paso y resultado rojo con la línea citada: pendiente.
3. Mismo árbol: pendiente.
4. Diff del head: pendiente.
5. Selección de suites: pendiente.
6. Resultado único: pendiente.
7. Criterio de hecho y archivos: pendiente.

Cuando el pegado esté, este archivo se reescribe con la forma de `docs/evidence/GH-506-web-tests-flake.md`, y cada afirmación sobre `.github/workflows/ci.yml`, `scripts/ci_verdict.py` o `scripts/ci_changes.py` se toma de `git show 962bffff:<ruta>`, nunca del árbol de trabajo.
