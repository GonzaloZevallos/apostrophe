# GH-694: `web-tests` intermitente, registros fechados de los últimos 14 días

Esta nota no cambia código. Ata cada registro fechado de `web-tests` de la ventana al arreglo que lo explica, o lo nombra como abierto. Cierra con un par forzado en `Gastos.test.tsx:498`, el sitio del fallo que disparó la tarea.

Las notas de los arreglos anteriores están en este directorio: [GH-645](GH-645-web-tests-flake.md), [GH-657](GH-657-web-tests-flake.md) y [GH-679](GH-679-web-tests-flake.md). Los logs citados viven en `.agentic/tasks/*.md` del checkout principal, no en este árbol; se citan como texto plano.

## 1. El fallo registrado

Tarea GH-406, head `6daf51ee`, gate `delivery`, modo `full` en la corrida roja y en la repetición. Log en `.agentic/tasks/GH-406.md`, líneas 7890-7946. La corrida duró 933,9 s. Cola de la corrida roja:

```
</div> instead
 ❯ src/screens/Gastos.test.tsx:498:67
    496|   await screen.findByText('Etiquetas')
    497|   // On a phone the form's sheet still draws Expenses behind it until …
    498|   await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBe…
       |                                                                   ^
    499|   await vi.waitFor(() => expect(subtotalOf('Packaging')).toBe('$ 6.300…
    500|   expect(subtotalOf('Otros')).toBe('$ 700')
```

El DOM impreso es la hoja (Sheet) «Save the expense», todavía abierta.

## 2. La causa

`vi.waitFor` es el helper propio de Vitest: corre con su default de 1 000 ms y no lee `asyncUtilTimeout` de Testing Library (`ASYNC_UTIL_TIMEOUT`, 10 000 ms, `web/src/test-setup.ts`). Con la CPU saturada la hoja tardó más de 1 s en cerrarse tras el guardado y la espera se rindió; el producto no tiene la culpa. [GH-679](GH-679-web-tests-flake.md) reemplazó las 24 llamadas `vi.waitFor` por `waitFor` de `@testing-library/react` y prohibió `vi.waitFor`, `vi.waitUntil` y `expect.poll` en `web/src/architecture/asyncTimeouts.ts`. Hoy las líneas 498 y 499 de `Gastos.test.tsx` usan `waitFor`.

## 3. Registros fechados (8 filas)

Para cada fila se leyó el bloque `### Checks` de la tarea alrededor del head. «Ancestro» es la salida de `git merge-base --is-ancestor <fix> <head>`: exit 1 significa que el head no contiene el arreglo, así que la explicación se sostiene; exit 0 significaría que el head ya lo tenía y la causa seguiría abierta. Todos los heads son alcanzables en este repo y todos los logs se conservaron.

Arreglos y merge commits en master: GH-645 `163f4dc9` (`WithdrawalReasons.test.tsx`), GH-657 `0dc3b19f` (`CobroTree.test.tsx`), GH-679 `76e01879` (`vi.waitFor` desnudo).

| Tarea | Head | Gate | Modo | Segundos | Falla (archivo:línea) | Arreglo que corresponde | Ancestro | Estado |
|---|---|---|---|---|---|---|---|---|
| GH-406 | `6daf51ee` | delivery | full | 933,9 | `src/screens/Gastos.test.tsx:498:67` | GH-679 `76e01879` | exit 1 | explicado |
| GH-677 | `53682ca8` | delivery | full | 1093,9 | `src/screens/Gastos.test.tsx:498:67` | GH-679 `76e01879` | exit 1 | explicado |
| GH-607 | `1995fb19` | delivery | full | 906,9 | `src/screens/clientes/CobroTree.test.tsx:93:20` | GH-657 `0dc3b19f` | exit 1 | explicado |
| GH-590 | `534f1ea7` | delivery | full | 306,6 | `src/screens/ventas/NuevaVenta.test.tsx:377:41` | ninguno de los tres | no aplica | **abierta** |
| GH-590 | `f73f26c9` | delivery | full | 328,7 | `src/screens/ventas/NuevaVenta.test.tsx:646:19` | ninguno de los tres | no aplica | **abierta** |
| GH-611 | `10d9b472` | delivery | full | 712,5 | `src/screens/settings/WithdrawalReasons.test.tsx:129:32` | GH-645 `163f4dc9` | exit 1 | explicado |
| GH-610 | `d104e0d5` | delivery | full | 500,2 | `src/screens/settings/WithdrawalReasons.test.tsx:129:32` | GH-645 `163f4dc9` | exit 1 | explicado |
| GH-399 | `9cbd333a` | delivery | full | 370,7 | `src/screens/clientes/CobroTree.test.tsx:192:27` | GH-657 `0dc3b19f` | exit 1 | explicado |

Notas por fila:

- **GH-406 y GH-677** (`.agentic/tasks/GH-406.md:7940-7946`, `.agentic/tasks/GH-677.md` en el bloque «web-tests, last lines» del head `53682ca8`): el mismo `vi.waitFor` de la línea 498. Los dos heads contienen GH-645 y GH-657 (exit 0) pero no GH-679 (exit 1). Las corridas rojas duraron 933,9 s y 1 093,9 s, frente a 300-700 s de las otras: CPU saturada, la condición que GH-679 describe.
- **GH-607**: `CobroTree.test.tsx:93` es el texto del cliente que se comprueba sin esperar la respuesta de `GET /customers/1`. GH-657 lo envolvió en `waitFor`. El head contiene GH-645 pero no GH-657.
- **GH-611 y GH-610**: ambos fallan en `WithdrawalReasons.test.tsx:129` (`getByLabelText('Name')` con el toast `Reason saved` en el DOM y ninguna hoja), el síntoma que GH-645 reprodujo y arregló. Ningún head contiene GH-645.
- **GH-399**: la línea 192 de `CobroTree.test.tsx` en `9cbd333a` es `expect(within(dialog).getAllByRole('button', { name: 'Close' })).toHaveLength(1)`, del test `on a phone > the sheet holds exactly one Close, and Save inside the form in its pinned actions`. `git diff 0dc3b19f^1 0dc3b19f` muestra que GH-657 envolvió exactamente esa aserción en `waitFor`, y la tabla de GH-657 lo marca rojo con el hold en `GET /customers/1`. El DOM impreso (`cargando__tarjetas`) es el estado «datos todavía sin llegar». El head no contiene GH-657.
- **GH-590, `534f1ea7`**: `NuevaVenta.test.tsx:377` espera `toHaveValue('una nota bien larga')` y recibe `u`. Ninguno de GH-645, GH-657 ni GH-679 toca `NuevaVenta.test.tsx`, y los tres dan exit 1 contra el head. No hay un arreglo aterrizado que lo explique: la causa sigue abierta. El Tech Lead de esa tarea anotó que leyendo el código no encontró una causa determinista (`.agentic/tasks/GH-590.md`, fila «One web-tests flake on "a refused save keeps everything typed"»).
- **GH-590, `f73f26c9`**: la corrida tuvo 3 tests rojos en 2 archivos; el log conservado solo trae la cola, con la tercera falla (`[3/3]`) en `NuevaVenta.test.tsx:646:19`, `expect(gramos1).toHaveFocus()`. Las otras dos no están en el log. Tampoco hay arreglo aterrizado que la cubra: abierta.

Registros sin fecha en el registro, fuera de la ventana verificable, no clasificados: GH-405, GH-408, GH-465, GH-387, GH-569, GH-559, GH-543 y los dos sin fecha de GH-399 (heads `30bd57d5` y `7f8e75e9`). GH-559 y GH-465 ya tienen una nota en GH-573; no se leyeron acá.

## 4. Par forzado en `Gastos.test.tsx:498`

Test: `subtotals and the total stay equal to the sum shown after create, edit and delete`, el que contiene la línea 498. Dos copias temporales junto al original (`Gastos.red.forced.test.tsx`, `Gastos.green.forced.test.tsx`), nunca commiteadas y borradas después de correr. Se corrió con `npx vitest run <copia> -t '<nombre>'` desde `web/`.

- Rojo: el archivo de hoy con solo la línea 498 devuelta al texto anterior a GH-679 (`git show 76e01879^1:web/src/screens/Gastos.test.tsx`), más el retén.
- Verde: el archivo de hoy más exactamente el mismo retén.
- El retén es de 2 000 ms reales (`setTimeout`), por encima del 1 000 ms de `vi.waitFor` y muy por debajo de los 10 000 ms del techo. Ninguna de las dos copias usa timers falsos.

**Primer intento (descartado).** El retén en la respuesta del `POST /expenses` del guardado de «Etiquetas» (línea 78 de la copia). El rojo pasó (`Tests 1 passed | 22 skipped (23)`): la hoja se cierra en cuanto llega la respuesta, así que retener la respuesta no mantiene la hoja abierta durante la espera de la línea 498. No es un rojo y se descartó.

**Retén que dio el rojo: la navegación del guardado.** Lo que cierra la hoja es `leave()` de `ExpenseNewRoute` (`useBackOr`), que llama a `router.navigate(-1)`. El retén demora esa llamada 2 000 ms. Es una sola línea, la 485, para que la línea 498 siga siendo la 498 en las dos copias. Diferencias del arnés:

```diff
--- Gastos.test.tsx (hoy)  →  Gastos.green.forced.test.tsx
-  renderExpenses([EXPENSES], store([...MULTI]))
+  const router = renderExpenses([EXPENSES], store([...MULTI])); const realNavigate = router.navigate.bind(router); router.navigate = ((to: never, opts: never) => to === -1 ? new Promise<void>((r) => setTimeout(() => r(realNavigate(to, opts)), 2000)) : realNavigate(to, opts)) as typeof router.navigate

--- Gastos.green.forced.test.tsx  →  Gastos.red.forced.test.tsx
-  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
+  await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
```

Resultados:

| Copia | Corridas | Resultado |
|---|---|---|
| Rojo (`vi.waitFor`, retén en la navegación) | 3 de 3 rojas, 4 340 / 4 646 / 4 548 ms | `FAIL  \|unit\| src/screens/Gastos.red.forced.test.tsx > subtotals and the total stay equal to the sum shown after create, edit and delete` · `Error: expect(element).not.toBeInTheDocument()` · `expected document not to contain element, found <div aria-label="Add expense" aria-modal="true" … role="dialog"` · `❯ src/screens/Gastos.red.forced.test.tsx:498:67` · `Tests  1 failed \| 22 skipped (23)` |
| Verde (`waitFor`, mismo retén) | 3 de 3 verdes; las dos con duración impresa: 5 947 / 6 102 ms | `Tests  1 passed \| 22 skipped (23)` |
| Control (línea 498 devuelta, sin retén) | 1 de 1 verde, 4 503 ms | `Tests  1 passed \| 22 skipped (23)` |

El rojo es el del log de GH-406 y GH-677: falla en 498:67, en la aserción del diálogo, con la hoja «Add expense» / «Save the expense» en el DOM impreso. La duración del verde supera los 2 000 ms del retén (el control sin retén ya tarda ~4,5 s por el resto del test). Una copia con la línea 498 devuelta pero sin retén pasa: lo que lo vuelve rojo es el retén en la navegación, no el cambio de línea por sí solo.

## 5. Guarda de comportamiento

`git diff 810f1172 -- web scripts` está vacío (`810f1172` es la base de la tarea, sobre master). Este diff es solamente esta nota, y `npx vitest list` es el mismo antes y después porque no cambia ningún archivo bajo `web/` ni `scripts/`. Las copias `*.forced.test.tsx` se borraron; `git status` quedó limpio salvo esta nota.

## 6. Veredicto

**Parcialmente explicado.** Seis de las ocho filas fechadas tienen un head sin el arreglo de su propia falla (`git merge-base --is-ancestor` da exit 1 en cada una), y dos filas siguen abiertas:

- `src/screens/ventas/NuevaVenta.test.tsx:377:41` (GH-590, head `534f1ea7`): ningún arreglo aterrizado la cubre.
- `src/screens/ventas/NuevaVenta.test.tsx:646:19` (GH-590, head `f73f26c9`): ningún arreglo aterrizado la cubre; además de esa falla hubo otras dos de las que el log solo conserva la cola.

Esta tarea no arregla esas dos causas ni dice que el flake esté cerrado. El par forzado de la sección 4 prueba la causa del sitio 498; el de GH-679 en el sitio 398 la prueba para los otros `vi.waitFor`.

**Riesgo conocido.** El detector de flakes pertenece al sistema agéntico, no a este repo, y no se pudo comprobar cómo deduplica. Sus registros quedan en `.agentic/tasks/*.md` y salen de la ventana de 14 días alrededor del 2026-11-25. Hasta entonces, un `web-tests` intermitente nuevo puede contarse junto con estos registros ya explicados y reabrir el mismo aviso sin que haya una causa nueva.
