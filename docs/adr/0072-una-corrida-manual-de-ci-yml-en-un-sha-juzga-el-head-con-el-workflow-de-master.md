---
status: accepted
date: 2026-11-04
---

# Una corrida manual de `ci.yml` en un sha juzga el head con el workflow de master

GH-562. Extiende docs/adr/0067-ci-runs-only-the-suites-a-change-affects-in-shards-with-coverage.md sin
enmendarlo (su addendum GH-562 cita este ADR). Cuando un cambio toca `.github/`, el CI del propio
cambio no es de fiar: el head puede reescribir el workflow que lo juzga. Hasta ahora el sistema corría
entonces el Gate completo en la máquina del dueño. Este ADR da una vía para que ese head lo juzgue el
workflow de master, sin saltarse ningún control; solo cambia dónde corre.

## Decision

- **`ci.yml` se dispara también con `workflow_dispatch`**, con una entrada `sha` obligatoria. Una
  corrida así es el `ci.yml` de master (su workflow y sus scripts) juzgando el árbol de ese head.
- **El veredicto y el selector vienen de master.** `changes` y `ci-ok` hacen su checkout sin `ref`, así
  que corren `scripts/ci_changes.py` y `scripts/ci_verdict.py` de master. `changes` lee el árbol del head
  por un segundo checkout en `head/`, que existe solo en un dispatch, y le pasa esa ruta a
  `ci_changes.py` como `root`: el script lee el árbol y corre git solo a través de `root`. Selecciona
  como un pull request, contra el merge-base del head con `origin/master`.
- **Cada suite corre el head.** `checks`, `web`, `pytest`, `vitest`, `docs`, `e2e-shard` y `coverage`
  hacen checkout de `inputs.sha`. En un push o un pull request esa entrada está vacía y cada checkout
  resuelve al mismo ref de siempre.
- **Dos guardas en `changes`, antes de cualquier suite.** Un dispatch solo vale en `refs/heads/master`,
  y el sha debe ser un id completo en hexadecimal minúsculo (40 o 64 caracteres) antes de nombrar un
  ref. Detienen un dispatch equivocado; no son la frontera de confianza.
- **Fallar cerrado.** Si el sha falta o es corto, si el HEAD de `root` no es el sha, o si el merge-base o
  el diff fallan, `ci_changes.py` selecciona todo e imprime un `base_ref` vacío. Nunca sale con error por
  eso.

- **La clave `ci_dispatch` de `.agentic/stack.yaml`.** Declara `workflow: ci.yml` y `sha_input: sha`, el
  texto literal que define el sistema agentic (commit `0ca8e14c`, PR #476, GH-462; exige `ci:`). Le dice
  al sistema qué workflow de la base despachar y con qué entrada llevar el sha del head. Va antes de
  `ci_covers`, que sigue siendo la última clave (`ci_covers` was removed by GH-699; see ADR-0054.) `tests/test_stack_ci.py` la fija y comprueba que
  `ci.yml` tiene esa entrada.

## Hallazgos fuera de este repositorio (`outside`)

- **`outside`: la regla del lector.** La frontera de confianza real es el sistema agentic: una corrida
  cuenta solo si es `ci.yml`, evento `workflow_dispatch`, `refs/heads/master`, con el sha del head en su
  título (`run-name`: `CI at <sha>`). Nada en este repositorio puede hacerlo cumplir.
- **`outside`: la corrida local completa.** Mantener la corrida local completa hasta que el paso 1 de la
  prueba por etapas del addendum GH-562 de ADR-0067 esté en verde es una decisión del sistema agentic
  (#462), no de este repositorio.

## Consequences

- Un head que toca `.github/` puede juzgarse en GitHub con la selección de siempre, y `ci-ok` reporta
  sobre ese head. Los pushes y los pull requests quedan idénticos: mismo grupo de concurrencia, mismo
  título (vacío) y mismos checkouts.
- **Residual.** Las suites, `scripts/ci_vitest.py` y `scripts/ci_coverage.py` siguen corriendo código del
  head, porque se ejecutan en el checkout del head. El head no puede cambiar la selección ni el veredicto,
  pero sí lo que cada suite hace. La cobertura nunca es una condición del Gate.
- El job `docs` sigue omitiendo la comprobación de rupturas de la API fuera de un pull request.
