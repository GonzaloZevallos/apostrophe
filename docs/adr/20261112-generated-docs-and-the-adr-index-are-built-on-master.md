---
status: accepted
date: 2026-11-12
summary: "los documentos generados y el índice de ADR se construyen en master: un driver de fusión git (merge=regen) toma la copia que entra en los caminos de docs.paths, así que dos ramas con endpoint y ADR se fusionan sin conflicto, y el generador corre en master"
---

# Los documentos generados y el índice de ADR se construyen en master

Parte 4 de GH-692. Decidido por el Tech Lead. Enmienda la [ADR 0066](0066-technical-docs-are-generated-by-one-command-and-gated-for-staleness.md) (su decisión 3: un conflicto en los caminos poseídos se resuelve corriendo el generador, ahora lo resuelve un driver y después se corre el generador) y reemplaza el `merge=union` de `docs/architecture/decisiones.md` de la [ADR 20261111](20261111-new-adrs-are-named-by-date-and-slug-and-collide-only-on-an-equal-slug.md). Dos ramas en paralelo que cambian cada una un endpoint y agregan un ADR chocaban en los caminos generados al fusionar master en ellas. La parte con `regen` que corre en master es la [ADR 20261112](20261112-regen-commits-master-s-owned-docs-as-the-actions-bot-outside-ci-ok.md); no se repite aquí.

## Decisión

- **El atributo.** `.gitattributes` da `merge=regen` a cada patrón que imprime `python -m scripts.docs.owned_paths` (`docs.paths` de `.agentic/stack.yaml`): `docs/api/**`, `docs/architecture/generated/**` y `docs/architecture/decisiones.md`. Cada línea tiene un solo `merge=`, y `merge=union` no se usa en un camino generado. `tests/docs/test_owned_paths.py` exige que el conjunto con `merge=regen` sea igual a `docs.paths`.
- **El driver.** El paso `setup.merge-driver` de `.agentic/stack.yaml` corre `git config merge.regen.driver "cp %B %A"`. Esa cadena se escribe solo ahí. El driver toma el lado que se fusiona (`%B`) y **nunca corre el generador**: master regenera después de cada fusión.
- **Qué lado gana.** Lo afirma `tests/docs/test_parallel_branches.py`, y todos los documentos dicen lo mismo:
  - **master fusionado en una rama** (un pase de integración): gana la copia de master. La cabeza fusionada queda vieja respecto de los cambios propios de la rama, y la rama corre `generate` y confirma.
  - **una rama fusionada en master, en local:** gana la copia de la rama, y `regen` escribe encima en master.
- **Done.** Dos ramas que cambian cada una un endpoint y agregan un ADR se fusionan en master una tras otra sin conflicto en ningún archivo poseído que ambos lados modificaron o agregaron, y el generador real de `adr_index`, corrido sobre el resultado, lista los dos ADR.

## Límites

- **El job `regen` y `bot-push.sh`.** Lo que garantiza que master quede al día es la [ADR 20261112](20261112-regen-commits-master-s-owned-docs-as-the-actions-bot-outside-ci-ok.md), con sus omisiones y su riesgo dicho. El driver no la reemplaza.
- **Un clon sin `setup:` sigue en conflicto**, porque `merge.regen.driver` es configuración local y no viaja con el repositorio. También entran en conflicto la fusión del lado del servidor de GitHub y «Update branch», que no leen esa configuración.
- **Un rebase invierte los lados.** En un rebase, `%B` es el commit de la rama que se reaplica y `%A` es master: el driver deja la copia de la rama y no la de master.
- **Modificar contra borrar sigue en conflicto.** Un archivo generado borrado en un lado y editado en el otro no llama al driver, y se resuelve regenerando. Agregado en ambos lados se fusiona sin conflicto (verificado en git 2.53.0 en local; la versión de git del corredor de CI queda en el registro de su primera ejecución).
- **Después de un pase de integración la cabeza está vieja por diseño.** La comprobación reservada `docs` y el paso de documentos viejos de CI fallan con DOCS_STALE hasta que el Developer corre `generate` y confirma. Ese rojo significa «regenera», nunca una regresión del producto. Las ramas siguen confirmando la salida regenerada hasta que la comprobación `docs` reservada del sistema agéntico gane un modo que no falle con DOCS_STALE; ese seguimiento espera esa capacidad y no tiene número de issue.
- **Una edición a mano.** `cp %B %A` descarta en silencio una edición a mano del lado que pierde. Una edición a mano del lado que gana sobrevive a la fusión, y solo la detecta la diferencia de documentos viejos: la comprobación reservada `docs` (que cubre los tres caminos) y el paso de CI. El job `docs` de `ci.yml` no tiene `if:` ni `needs:`, así que el filtro `changes` no lo decide y corre también para un cambio que toca solo caminos poseídos. El hueco que queda es otro: ese paso de CI cubre `docs/architecture/generated` y `docs/api`, no `docs/architecture/decisiones.md`, y una edición a mano de esa página solo la detecta la comprobación reservada, hasta que `regen` la repara en master.

## Consecuencias

- Las ramas en paralelo con endpoint y ADR dejan de bloquearse en los caminos generados. El costo es que cada pase de integración deja un paso más: `generate` y confirmar.
- El driver es solo configuración local de git; no cambia código del producto.
- **Vuelta atrás.** Quitar `merge=regen` de `.gitattributes` y el paso `merge-driver` de `.agentic/stack.yaml`, y volver a resolver los conflictos corriendo el generador.
