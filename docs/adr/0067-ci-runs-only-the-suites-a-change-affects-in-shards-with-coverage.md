---
status: accepted
date: 2026-10-30
---

# CI corre solo las suites que un cambio afecta, en shards y con cobertura

GH-448 (parte 2, GH-476). `ci.yml` conecta los scripts de la parte 1 y vuelve a poner e2e como condición
de merge, a través de un único job agregador, `ci-ok`. La selección (unión de reglas de ruta que falla
cerrado, cierre de áreas por imports, mapa de pantallas con el par móvil) es la de ADR-0064; aquí solo se
decide lo que el workflow agrega. El número 0062 que pedía el pedido estaba tomado; este es el siguiente
libre al rebasar.

## Decision

- **`ci-ok` es la única condición de merge.** `stack.yaml` declara `ci: [ci-ok]`. `ci-ok` corre
  `if: always()`, depende de todos los demás jobs y alimenta `scripts/ci_verdict.py` con `toJSON(needs)`.
  Solo `ci-ok` puede ser un check requerido en la protección de rama; `test`, `web` y `e2e` ya no reportan.
- **El veredicto lee los flags.** Una suite omitida pasa solo cuando el flag de `changes` es `"false"`;
  pytest, vitest y e2e se tratan igual, ninguna está aparcada. `coverage` es el único job que solo advierte.
- **Un cambio solo de backend no corre e2e.** El push a master corre todo (cada flag es `true`) y es la red
  de seguridad: una rotura de e2e causada por `app/` se ve después del merge.
- **Cobertura reportada, no exigida,** hasta que exista el piso de la Decision 1 del dueño. Una corrida
  parcial de vitest muestra `partial (N files)` y nunca se compara con la línea base.
- **La lista de vitest sigue dentro de ADR-0064 §6.** `render()` solo mira rutas; el workflow corre
  `vitest list --changed=HEAD^1 --filesOnly` en su propio paso y `scripts/ci_vitest.py` (función pura)
  combina esa lista con los flags. Ningún `scripts/ci_*.py` corre una herramienta de node.
- **Valores que un fork puede influir** (rutas de specs, tests y shards) llegan a `run:` solo por `env:`,
  nunca con `${{ }}` dentro de `run:`, y cada productor cae a la corrida completa si alguna ruta falla
  `is_safe_path`.
- **Cada subida de datos de cobertura lleva `include-hidden-files: true`:** `.coverage.<shard>` es un
  dotfile y, sin eso, no se subiría.
- **Concurrencia.** Una pull request cancela su corrida anterior; un push a master nunca cancela.
- **Las pull requests desde forks no reciben comentario:** su token no puede escribir. El comentario se
  actualiza en el lugar por su marcador y su fallo no rompe el job.
- **Cuándo agregar shards.** En una corrida completa, cuando el shard más lento de una suite tarda más de
  1,5 veces la mediana de los shards de esa suite (por ejemplo, si el par móvil domina el shard de e2e).

## Rejected

- **Reintentos o `.first()` para tapar flakes de e2e.** Se arreglan en su causa.
- **Exigir cobertura ya.** Sin línea base medida un piso sería inventado.
- **Dejar `test`, `web` y `e2e` como checks requeridos.** Con selección, un job omitido no reporta y la
  pull request esperaría para siempre.

## Consequences

- La protección de rama de master debe pasar a requerir solo `ci-ok`, después de que el `ci-ok` de esta
  pull request haya reportado una vez.
- `scripts/ci_vitest.py` es un input del selector: está en `SELECTOR_INPUTS` y en `affected_fallback`.

## Addendum GH-557: CI corre también en `agentic-ci/**`

- **El disparador.** `ci.yml` corre en un push a `master`, en un push a una rama `agentic-ci/**` y en
  `pull_request`. El tier completo del sistema agentic empuja el head integrado a `agentic-ci/GH-<n>` y
  espera `ci-ok`; antes, nada corría ahí. Una rama `agentic-ci/**` selecciona sus suites igual que un
  pull request, no como un push a master.
- **La cancelación.** Una corrida más nueva cancela la anterior en un pull request y en un push a una
  rama `agentic-ci/**`; un push a master nunca cancela. Esto reemplaza la regla anterior, "una pull
  request cancela su corrida anterior; un push a master nunca cancela". El grupo no cambia. La condición
  es `github.event_name == 'pull_request' || (github.event_name == 'push' && startsWith(github.ref,
  'refs/heads/agentic-ci/'))`, y `tests/test_stack_ci.py` evalúa esa misma expresión del workflow para
  cinco casos (master, pull request, `agentic-ci/GH-1`, `agentic-ci-x` y un tag).
- **`base_ref`.** `changes` imprime `base_ref`, el punto desde el que se hizo el diff. Un pull request
  usa `HEAD^1`. Un push a `agentic-ci/**` usa `git merge-base origin/master HEAD`, porque la rama lleva
  varios commits y `HEAD^1` vería solo el último. `vitest` recibe `base_ref` por `env:` y corre
  `vitest list --changed="$BASE_REF"`; con `base_ref` vacío escribe un listado vacío. Por eso ambos
  checkouts usan `fetch-depth: 0`.
- **Cuándo `base_ref` es vacío.** Solo se imprime no vacío cuando salió un diff usable desde él. Es
  vacío, y se selecciona todo (`vitest_all` es `true`, así que el listado vacío no importa), cuando el
  evento no es un pull request ni un push a `agentic-ci/**`, cuando falta la referencia, cuando el
  merge-base falla, sale vacío o no es un id hexadecimal completo (40 o 64 caracteres), y cuando el diff
  falla o sale vacío. Un push a `master` y un tag `agentic-ci/x` o una rama `agentic-ci-x` no llaman a
  git. Fallar cerrado es lo que pide el Gate: una selección equivocada llega ahora al merge.
- **Lo que no corre en `agentic-ci/**`.** El job `docs` omite la comprobación de rupturas de la API,
  que sigue siendo del pull request (no hay cuerpo de PR ni base que comparar). El job `coverage` no
  publica comentario, porque su paso exige un evento `pull_request`; el resumen del job sí se escribe.
- **Verificación.** Nada en el pull request puede ejercer el patrón de rama de GitHub. Después del merge,
  el Operator empuja un head a `agentic-ci/<x>` y comprueba que el CI arranca y que `ci-ok` reporta sobre
  ese head.
