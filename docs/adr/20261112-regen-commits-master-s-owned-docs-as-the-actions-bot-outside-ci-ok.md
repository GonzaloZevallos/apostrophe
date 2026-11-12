---
status: accepted
date: 2026-11-12
summary: "después de cada fusión, el job regen deja que github-actions[bot] confirme los documentos generados de master; queda fuera de ci-ok y la comprobación de documentos viejos se omite solo en un push a master"
---

# `regen` confirma los documentos generados de master como el bot de Actions, fuera de `ci-ok`

Parte 3 de GH-697. Decidido por el Tech Lead. Enmienda la [ADR 0066](0066-technical-docs-are-generated-by-one-command-and-gated-for-staleness.md): la comprobación de documentos viejos sigue igual en un pull request, un push a `agentic-ci/**` y un Dispatch, y cambia solo en un push a master. Las partes 1 y 2 de GH-697 pusieron `scripts/ci/bot-push.sh`, `scripts/docs/regen_pack.py` y `scripts/docs/regen-publish.sh`; esta parte los conecta en `.github/workflows/ci.yml`.

## Decisión

- **Quién confirma.** Después de cada push a master, `github-actions[bot]` confirma los caminos de master que el generador posee (`docs.paths` de `.agentic/stack.yaml`) con el mensaje `chore(docs): regenerate [skip ci]`. El job `docs` empaqueta (`regen_pack`) y sube el artefacto `owned-docs` solo en un push a master; el job nuevo `regen` (`needs: docs`, mismo `if:`) lo baja y corre `regen-publish.sh`, que entrega el push a `bot-push.sh`.
- **La comprobación de documentos viejos.** Se omite solo en un push a master (`github.event_name != 'push' || github.ref != 'refs/heads/master'`): ahí el trabajo del bot es dejar los documentos al día, no rechazarlos. Cubre dos de las tres entradas poseídas (`docs/architecture/generated` y `docs/api`); `docs/architecture/decisiones.md` no tiene esa comprobación en un pull request, así que solo se repara en master.
- **Una omisión no es una garantía.** Que la última ejecución de master regenere solo vale si su `docs` está verde. `bot-push.sh` omite sin error cuando un commit posterior que no es del bot toca caminos fuera de los suyos, y una ejecución pendiente que otra más nueva reemplaza no llega a correr. Lo cubre la ejecución del commit posterior, y es un riesgo conocido, no una propiedad.
- **`regen` está deliberadamente fuera de `ci-ok`.** Confirmar documentos no decide una fusión. `tests/test_stack_ci.py` lo declara en `UNGATED_JOBS` con su motivo y declara su único comando en `UNGATED_RUNS`: ningún job necesita un job sin compuerta, ninguno corre otro comando salvo los de preparación, y el único job con `contents: write` es uno de ellos. Esos comandos nunca entran al conjunto que un job con compuerta puede correr.
- **Un `docs` rojo omite `regen`.** Es un riesgo dicho: la señal es el `ci-ok` rojo de master más la línea que el último paso de `docs` agrega al resumen (`master's owned docs are not regenerated: this run's docs job failed`). Con qué frecuencia fallan `lychee` y el render de Mermaid en master no está medido.
- **La identidad y los caminos.** `bot-push.sh` solo trata como commit del bot uno cuyos correos de autor y de committer son `41898283+github-actions[bot]@users.noreply.github.com`, y un commit del bot con un camino fuera de la lista poseída hace que omita. `regen-publish.sh` rechaza un archivo de caminos o un tar que salga de ella antes de tocar el repositorio.
- **Pruebas antes de fusionar.** El Dispatch ejecuta el `ci.yml` viejo de master, nunca el nuevo, así que lo que prueba que el archivo está bien formado es `tests/test_stack_ci.py`: cada `needs` nombra un job, cada `if:` se analiza con el evaluador y ningún `if:` empieza con `!` o `${{`, cada `uses:` es `owner/name@ref`, y las condiciones se evalúan para un push a master, un push a `agentic-ci/x`, un pull request y un Dispatch en master.

## Consecuencias

- **§8: quién puede cambiar los caminos poseídos.** El código que el job `docs` corre en master (los generadores, `npm --prefix web ci` y `uv sync` con sus árboles de dependencias, y el comando de empaquetado) puede ahora cambiar esos caminos en master sin revisión. En `generated/**` y `docs/api/**` la comprobación de un pull request sigue mostrando esas diferencias al revisar; `decisiones.md` no la tiene. El token de escritura vive solo en `regen`, que no instala nada y corre solo `regen-publish.sh`; esos dos scripts limitan la escritura a los caminos poseídos y comprueban la identidad del bot.
- **Costo.** Nada crece con los datos. El job `docs` paga un empaquetado y una subida más, solo en un push a master.
- **La primera vez se comprueba a mano.** El `ci.yml` nuevo corre por primera vez en el primer push a master tras la fusión. Después de ese push debe aparecer un commit `chore(docs): regenerate [skip ci]` de `github-actions[bot]`, o la línea del resumen de `regen` dice por qué no.
- **Se supone, no se midió,** que master acepta un push hecho con `GITHUB_TOKEN`: `screen-images.yml` ya lo hace.
- **Vuelta atrás.** Revertir el cambio de `ci.yml` de esta parte.
