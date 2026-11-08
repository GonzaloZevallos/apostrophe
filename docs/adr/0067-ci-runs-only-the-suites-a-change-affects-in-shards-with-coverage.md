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

## Addendum GH-557 (parte 2): `e2e-shard` y el agregador `e2e`

- **La división y por qué.** El job de matriz que se llamaba `e2e` ahora es `e2e-shard`, con el cuerpo
  intacto. Una matriz publica un check-run por shard, `e2e-shard (1)`, `e2e-shard (2)` y así, nunca uno
  llamado `e2e`; antes, `e2e (1)`. GH-453 del sistema agentic compara el nombre del job con los check-runs
  de forma exacta, así que ninguno de esos nombres puede cubrir un check que agotó el tiempo en local. Un
  job nuevo `e2e` agrega ese único check-run.
- **Semántica del agregador.** `e2e` tiene `needs: [changes, e2e-shard]` e
  `if: always() && needs.changes.outputs.e2e == 'true'`. `always()` hace que corra aunque un shard falle
  o se cancele, y la bandera `e2e` lo omite cuando el cambio no selecciona ningún spec. Su único paso lee
  `needs.e2e-shard.result` por `env:` y falla salvo que sea `success`: verde solo si todos los shards lo
  están. No hace checkout, no usa `uv` y no corre ningún check. `ci-ok` depende de ambos y
  `scripts/ci_verdict.py` juzga ambos con la bandera `e2e`, de modo que una matriz cancelada con un
  agregador en rojo se nombra en las dos líneas.
- **`ci_covers`.** `.agentic/stack.yaml` declara, como última clave,
  `ci_covers: {web-e2e: {job: e2e, failed: '✘|^\s*\d+ failed\b'}}`. Si `web-e2e` agota el tiempo en
  local, el sistema difiere a CI cuando el check-run `e2e` está en verde, salvo que la salida local ya
  contenga una línea que cumpla `failed`. Con `retries: 0`, el reporter de lista imprime cada falla final
  al terminar el test, por lo que en un timeout actúa la rama `✘`; el resumen `N failed` puede no
  llegar a imprimirse. La rama `✘` no está anclada a propósito: una coincidencia de más solo rechaza el
  diferimiento y cuesta una nueva corrida, mientras que una que no se detecta es la dirección insegura.
  La regex tiene menos de 200 caracteres y ninguna repetición anidada. `tests/test_stack_ci.py` la lee de
  `stack.yaml`, nunca la copia.
- **Riesgos conocidos.** (1) Un head que solo toca el backend, o cualquiera cuyo diff no seleccione
  ningún spec, omite `e2e`: no queda cubierto. (2) "Cubierto" es la selección que `scripts/ci_changes.py`
  calculó para el diff de ese head, no la suite completa local; es la misma selección que el Gate ya acepta
  para cada merge. (3) Una corrida cancelada no cubre nada. (4) La clave se lee en la base de la tarea:
  solo rige para tareas cuya base sea posterior a este merge.

## Addendum GH-562: dispatch de `ci.yml` en el sha de un head

Cita docs/adr/0072-una-corrida-manual-de-ci-yml-en-un-sha-juzga-el-head-con-el-workflow-de-master.md.

- **La entrada `sha`.** `workflow_dispatch` recibe `sha`, obligatoria y de tipo string. El grupo de
  concurrencia pasa a `ci-<workflow>-<ref>` más `-<sha>` solo si hay `sha`, de modo que dos dispatch de
  heads distintos no se cancelan; la expresión de cancelación no cambia y para un dispatch siempre es
  falsa. `run-name` es `CI at <sha>` para un dispatch y vacío para un push o un pull request, que
  conservan el título por defecto de GitHub. `tests/test_stack_ci.py` evalúa el grupo y el título para los
  cinco casos de siempre y para un dispatch.
- **`api_breaks`.** Sigue siendo una comprobación del pull request: en un dispatch no hay cuerpo de PR ni
  base que comparar, y se omite.
- **Prueba por etapas, después del merge.** El Operator corre estos cuatro pasos y registra los enlaces en
  #562. Si alguno falla, se revierte el pull request.
  1. Un head que toca `.github/` selecciona todo, y `ci-ok` queda en verde.
  2. Un head que toca solo `app/` (no master) obtiene una selección más estrecha, calculada desde el árbol
     del head.
  3. Un dispatch en un ref de rama que no es master queda en rojo.
  4. Un sha corto queda en rojo.

