---
status: accepted
date: 2026-11-11
summary: "los ADR nuevos se nombran por fecha y slug, y solo chocan si el slug que sigue a la fecha es igual"
---

# Los ADR nuevos se nombran por fecha y slug, y solo chocan si el slug es igual

GH-693. Decidido por el Tech Lead. Los ADR se numeraban en secuencia (`docs/adr/NNNN-slug.md`): dos PR en paralelo tomaban el mismo número, y el segundo en llegar pasaba por `adr_number_taken`, una renumeración, una escalación, una decisión humana, otro chequeo y otra revisión. El 10 y 11 de noviembre de 2026 eso frenó GH-401, GH-403, GH-407, GH-409, GH-592, GH-651, GH-652 y GH-685, algunos más de una vez. log4brains usa fecha más slug por la misma razón, y las migraciones de Rails usan una marca de tiempo UTC.

## Decisión

- **Nombre y id.** Un ADR nuevo es `docs/adr/AAAAMMDD-slug.md` y su id es el nombre entero sin `.md` (`ADR-AAAAMMDD-slug`). La fecha es un día real del calendario, y el slug usa minúsculas, dígitos y guiones. La fecha no se compara nunca con hoy.
- **Citas.** Se cita `ADR-AAAAMMDD-slug`, `docs/adr/AAAAMMDD-slug` o `docs/adr/AAAAMMDD-slug.md`, y una cita nombra el id entero, nunca un prefijo: se escribe «el enfoque del ADR-…-foo», no «ADR-…-foo-style», que se lee como otro id más largo y queda colgando. Este mismo ADR es `ADR-20261111-new-adrs-are-named-by-date-and-slug-and-collide-only-on-an-equal-slug`.
- **Los `NNNN-` quedan como están.** Los 83 ADR con número conservan su nombre y sus citas; nada ya fusionado se renombra ni se reescribe. Los nombres `NNNN-` están cerrados al conjunto `LEGACY_ADR_NAMES` de `scripts/docs/adr_ids.py`, que se decide contra los nombres de master y no contra un diff de git, así que da el mismo veredicto en un PR, en un push a `agentic-ci/**`, en un Dispatch y en master. Un `NNNN-` fuera del conjunto falla con el nombre que corresponde, y ninguna tarea posterior agrega nombres al conjunto.
- **Una sola lectura.** `scripts/docs/adr_ids.py` es el único lugar con el patrón de un id, de una cita y de una marca de reemplazo; los tests lo usan y no compilan patrones propios.
- **Cuándo chocan.** Dos ADR fechados chocan solo si el slug que sigue a la fecha es igual (`20261111-foo` y `20261112-foo`). Un nombre `NNNN-` nunca choca con uno fechado. El chequeo es una función pura sobre nombres y no necesita git.
- **El índice.** `docs/architecture/decisiones.md` se fusiona con `merge=union` (en `.gitattributes`), así que dos ramas que agregan cada una una fila al final se fusionan sin conflicto. Es aceptable porque la tabla solo crece por el final y porque dos chequeos cubren lo que `union` puede estropear: una fila duplicada (el índice se lee como una lista de filas `(archivo, marca)`, y un archivo enlazado en más de una fila se reporta) y una línea de prosa duplicada (ninguna línea no vacía fuera de la tabla puede repetirse). `merge=union` vale solo para esta página.

## Consecuencias

- **El aterrizaje fusiona master en la rama.** `merge=union` protege el índice solo si el aterrizaje fusiona master en la cabeza antes de fusionar el PR cuando `decisiones.md` entra en conflicto. Los commits `c47fff61`, `0c7cc2f9` y `ffa9dc3b` lo muestran haciéndolo, pero es una observación y no una regla escrita de agentic-system. Si deja de hacerlo, `merge=union` deja de proteger el índice, porque la fusión del lado del servidor de GitHub ignora el atributo.
- **`adr_number_taken` de agentic-system.** Ese camino (GH-579/582/585) debe tratar los nombres fechados como los que no toman ningún número, y señalar solo dos ADR fechados con el mismo slug tras la fecha, pidiendo un renombrado. Si lee `name[:4]`, dos ADR del mismo año parecerían el número `2026` tomado dos veces. Es un pedido a agentic-system, fuera de este repositorio.
- **Una carrera con el conjunto cerrado.** Si un `NNNN-` aterriza en master entre la última fusión de master en este PR y su aterrizaje, master queda en rojo una vez, hasta que ese nombre se agregue al conjunto.
- **Una cita que es prefijo de un id** se lee como el id más largo y se reporta colgando; el límite es este y se acepta.
- **Ramas abiertas.** Quien tenga una rama con un ADR `NNNN-` nuevo sin fusionar lo renombra a `AAAAMMDD-slug.md`, con sus citas, cuando esto aterrice.
