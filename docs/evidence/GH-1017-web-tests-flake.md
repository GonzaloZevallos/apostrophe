# GH-1017: `web-tests` intermitente en `Clientes.test.tsx`, registros fechados y par forzado

Esta nota acompaña un cambio de un solo test: `web/src/screens/clientes/Clientes.test.tsx`, el test «while the full list is pending on a failed debtors read, the list section is not drawn at all». No cambia código de producto. Ata cada registro fechado de `web-tests` de la ventana (2026-11-11 a 2026-11-25) a este sitio, o lo deja como abierto, y registra el par rojo/verde forzado.

Las notas anteriores del mismo tipo están en este directorio: [GH-694](GH-694-web-tests-flake.md) y las que ella cita. Los logs citados viven en `.agentic/tasks/*.md` del checkout principal, no en este árbol; se citan como texto plano.

## 1. El fallo registrado (GH-915)

Tarea GH-915, head `88eb7296`, gate `delivery`. Log en `.agentic/tasks/GH-915.md`, bloque «`web-tests`, last lines», líneas 1967-1999. Cola de la corrida roja (en ese head el test estaba en la línea 1138):

```
</div> instead
 ❯ src/screens/clientes/Clientes.test.tsx:1138:76
    1136|   await act(async () => {})
    1137|
    1138|   expect(screen.queryByRole('radiogroup', { name: 'Customers view' }))…
       |                                                                            ^
    1139|   expect(document.querySelector('.lista-clientes')).toBeNull()
    1140|   expect(screen.queryByText(EMPTY_CUSTOMERS)).not.toBeInTheDocument()

 Test Files  1 failed | 376 passed | 1 skipped (378)
      Tests  1 failed | 6563 passed | 6 skipped (6570)
   Duration  1312.21s
```

El DOM impreso es el radiogroup `Customers view` con «Owed to you» marcado: la pantalla todavía está en el estado pendiente.

## 2. La causa

El stub responde 500 a `/payments/debtors` y deja sin respuesta a `/customers`. El test esperaba la llamada a `fetch`, vaciaba una sola vez con `await act(async () => {})` y entonces afirmaba que el radiogroup no existe. Pero el radiogroup solo desaparece cuando `useDebtors` informa `failed`: `customersView` (`web/src/screens/clientes/CustomerSearch.ts`) devuelve `flat` y `Clientes.tsx` deja de dibujar `CustomerSegments`. Leer el 500 y propagarlo al estado necesita más de un ciclo; con la CPU saturada ese estado no ha llegado cuando corre la aserción. El producto es correcto: el test afirmaba una ausencia antes de que existiera el estado que la explica.

El arreglo (solo el cuerpo del test; nombre y stubs iguales):

1. `renderClientes()`.
2. Sin ningún `await` antes, `expect(screen.getByRole('radiogroup', { name: 'Customers view' })).toBeInTheDocument()`: el estado pendiente. `render` corre dentro de un `act` síncrono y leer el 500 necesita al menos una microtarea, así que un host rápido no puede adelantarse a esta línea. Es también lo que vuelve el paso 3 un cambio de estado real y no un pase vacío.
3. `await waitFor(() => expect(screen.queryByRole('radiogroup', { name: 'Customers view' })).not.toBeInTheDocument())`.
4. Se conservan la aserción nula de `.lista-clientes` y la ausencia de `EMPTY_CUSTOMERS`.

Se quitaron el `act` vacío y el `waitFor` sobre `fetch`. El cliente de prueba ya trae `retry: false` (`Clientes.test.tsx:79`) y no se tocó.

## 3. Registros fechados (23 filas, 2026-11-11 a 2026-11-25)

Fuente: las líneas `flakes:` con `at` y `check: web-tests` de `.agentic/tasks/*.md`. Las filas con `tests: [...]` nombran este test en el propio registro. Las filas con `tests: []` se clasificaron leyendo el bloque «`web-tests`, last lines» de la tarea: «explicado» solo cuando ese log nombra `Clientes.test.tsx` en la aserción de este test (líneas 1138 o, tras un desplazamiento posterior, 1206). Una fila cuyo log nombra otro sitio es «abierta»; una sin sitio en su log sería «sin atribuir» (no hubo ninguna).

| # | Tarea | Fecha | Head | Gate | Fuente de la atribución | Estado |
|---|---|---|---|---|---|---|
| 1 | GH-406 | 2026-11-11 | `6daf51ee` | delivery | log: `Gastos.test.tsx:498` (otro sitio; ver [GH-694](GH-694-web-tests-flake.md)) | **abierta** (otro sitio) |
| 2 | GH-915 | 2026-11-23 | `88eb7296` | delivery | log: `Clientes.test.tsx:1138:76` (`GH-915.md:1967-1999`) | explicada por log |
| 3 | GH-935 | 2026-11-23 | `077a4817` | delivery | log: `Clientes.test.tsx:1138:76` | explicada por log |
| 4 | GH-1009 | 2026-11-23 | `27735396` | merge | registro: `tests` nombra el test | explicada por registro |
| 5 | GH-939 | 2026-11-23 | `28479c72` | merge | registro: `tests` nombra el test | explicada por registro |
| 6 | GH-928 | 2026-11-23 | `94b13151` | delivery | log: `Clientes.test.tsx:1138:76` (`GH-928.md:5125`) | explicada por log |
| 7 | GH-928 | 2026-11-23 | `283f5bb2` | full_checks | registro: `tests` nombra el test | explicada por registro |
| 8 | GH-1010 | 2026-11-23 | `87f7e323` | delivery | log: `Clientes.test.tsx:1138:76` | explicada por log |
| 9 | GH-902 | 2026-11-23 | `68002452` | delivery | log: `Clientes.test.tsx:1138:76` | explicada por log |
| 10 | GH-986 | 2026-11-24 | `e6ccf612` | full_checks | registro: `tests` nombra el test | explicada por registro |
| 11 | GH-1023 | 2026-11-24 | `c9dda495` | delivery | log: `Clientes.test.tsx:1138:76` | explicada por log |
| 12 | GH-1038 | 2026-11-24 | `f9005291` | delivery | log: `Clientes.test.tsx:1138:76` | explicada por log |
| 13 | GH-1038 | 2026-11-24 | `f9005291` | merge | registro: `tests` nombra el test | explicada por registro |
| 14 | GH-840 | 2026-11-25 | `1a0e1548` | full_checks | registro: `tests` nombra el test | explicada por registro |
| 15 | GH-1045 | 2026-11-25 | `e0843a4d` | full_checks | registro: `tests` nombra el test | explicada por registro |
| 16 | GH-1102 | 2026-11-25 | `8f8435c3` | delivery | log: `Clientes.test.tsx:1138:76` | explicada por log |
| 17 | GH-1091 | 2026-11-25 | `77dcb368` | delivery | log: `Clientes.test.tsx:1138:76` | explicada por log |
| 18 | GH-898 | 2026-11-25 | `942cd542` | delivery | log: `Clientes.test.tsx:1138:76` (hay dos corridas rojas con log, ambas en este test; no se pudo emparejar cada log con cada head) | explicada por log |
| 19 | GH-1029 | 2026-11-25 | `02da4de5` | full_checks | registro: `tests` nombra el test | explicada por registro |
| 20 | GH-1110 | 2026-11-25 | `acda9855` | delivery | log: `Clientes.test.tsx:1206:76` | explicada por log |
| 21 | GH-1110 | 2026-11-25 | `acda9855` | full_checks | registro: `tests` nombra el test | explicada por registro |
| 22 | GH-1114 | 2026-11-25 | `3591b2df` | full_checks | registro: `tests` nombra el test | explicada por registro |
| 23 | GH-898 | 2026-11-25 | `004529e4` | delivery | log: `Clientes.test.tsx:1138:76` (ver fila 18) | explicada por log |

Resumen: 22 filas atribuidas a este test y 1 abierta (fila 1, otro sitio, ya tratada en GH-694). «Explicada» significa que el sitio de la falla es este test; no que el flake esté ya arreglado en esas tareas: ninguno de esos heads contiene el cambio de GH-1017.

Quedan fuera de la ventana y no se clasifican aquí: GH-677 (2026-11-10), GH-607 y GH-590 (2026-11-09), GH-610 y GH-611 (2026-11-08), GH-399 (2026-11-07/08) y los registros sin fecha; los cubre la nota de GH-694.

## 4. Par forzado en el sitio de GH-1017

Test: `while the full list is pending on a failed debtors read, the list section is not drawn at all`. Cinco copias temporales junto al original (`Clientes.today0.forced.test.tsx`, `Clientes.today2000.forced.test.tsx`, `Clientes.fixed0.forced.test.tsx`, `Clientes.fixed2000.forced.test.tsx`, `Clientes.control.forced.test.tsx`), nunca commiteadas y borradas después de correr. Se corrió con `npx vitest run src/screens/clientes/<copia> -t '<nombre>'` desde `web/`. Ninguna copia usa timers falsos.

- «today» es el test de `HEAD` antes del cambio (`git show 9c9029e9:web/src/screens/clientes/Clientes.test.tsx`); «fixed» es el test de este cambio.
- El retén sustituye solo el stub del 500 de `/payments/debtors` por una promesa que lo entrega tras un `setTimeout` real de 0 ms o de 2 000 ms. El stub de `/customers` sigue sin responder.
- 2 000 ms es la cota que reproduce lo que pasa en un host cargado: el 500 llega después de la aserción.

Resultados (3 corridas por copia salvo el control):

| Copia | Retén | Corridas | Resultado |
|---|---|---|---|
| today | 0 ms | 3 de 3 verdes | `Tests  1 passed \| 77 skipped (78)` |
| today | 2 000 ms | 3 de 3 rojas | `FAIL  \|unit\| src/screens/clientes/Clientes.today2000.forced.test.tsx > while the full list is pending on a failed debtors read…` · `Error: expect(element).not.toBeInTheDocument()` · `expected document not to contain element, found <div aria-label="Customers view"` · `❯ …Clientes.today2000.forced.test.tsx:1206:76` · `Tests  1 failed \| 77 skipped (78)` |
| fixed | 0 ms | 3 de 3 verdes | `Tests  1 passed \| 77 skipped (78)` |
| fixed | 2 000 ms | 3 de 3 verdes | `Tests  1 passed \| 77 skipped (78)` |
| today, sin retén (control) | ninguno | 1 verde y 5 rojas en 6 corridas | rojo en `Clientes.control.forced.test.tsx:1206:76`, con el mismo DOM que GH-915: radiogroup `Customers view` con «Owed to you» marcado |
| fixed, sin retén (archivo real) | ninguno | 5 de 5 verdes | `Tests  1 passed \| 77 skipped (78)` |
| fixed, `customersView` sin devolver `flat` en `failed` | ninguno | 1 de 1 roja | `× while the full list is pending on a failed debtors read… 10306ms` · `Error: expect(element).not.toBeInTheDocument()` · `❯ src/screens/clientes/Clientes.test.tsx:1206:96` · `Tests  1 failed \| 77 skipped (78)`; el archivo se restauró (`git diff` de `CustomerSearch.ts` vacío) |

Lectura:

- El rojo de `today` con 2 000 ms es el de GH-915: misma aserción (`:1206:76` en el archivo de hoy, `:1138:76` entonces), mismo `Customers view` con «Owed to you» marcado. `fixed` con el mismo retén pasa: espera el estado `failed`.
- El control sin retén **no** salió verde como se esperaba: falló 5 de 6 veces. En esta máquina, corriendo el test aislado (con arranque y transformación en frío), el flake ya se reproduce sin ningún retén. Lo registro tal cual; no cambia la conclusión, la refuerza. Lo que sí quedó inesperado: `today` con 0 ms pasó 3 de 3 aunque el control falla casi siempre; no se investigó por qué el `setTimeout` de 0 ms acomoda ese orden.
- El rojo de regresión confirma que la aserción final no es vacía: si el producto no pasara a la lista plana tras el fallo, el `waitFor` agota los 10 000 ms de `asyncUtilTimeout` y falla.

## 5. Los otros `act` desnudos que se quedan

- `web/src/screens/clientes/CustomersBehind.test.tsx:100` (`await act(async () => {})` en «while the debtors read is pending it draws no card and no skeleton»): el stub no responde nunca, así que el estado afirmado (sin tarjeta, sin esqueleto) no cambia nunca; la ausencia es cierta antes y después del `act`. No hay estado que esperar.
- `web/src/screens/clientes/Clientes.test.tsx:195`: tras el `act` se afirma una presencia (`getByText('Nico Parra')`), que falla en claro si el estado aún no llegó y no puede pasar en falso.

Antes del cambio eran 3 usos de `act` desnudo en 2 archivos; ahora quedan 2 (los de arriba), por debajo del umbral del ratchet; no se añade ratchet.

## 6. Los sitios de `NuevaVenta` de GH-694, todavía abiertos

`web/src/screens/ventas/NuevaVenta.test.tsx` en las líneas 377 y 646 según [GH-694](GH-694-web-tests-flake.md) (GH-590, heads `534f1ea7` y `f73f26c9`; hoy el archivo se desplazó unas líneas). Ningún arreglo aterrizado los cubre, siguen abiertos y están fuera de esta ventana (2026-11-09). Esta tarea no los toca ni los da por explicados.

## 7. Guarda de comportamiento

`git diff 9c9029e9 --stat -- web/src ':!*.test.tsx'` (`9c9029e9` es la base de la tarea) está vacío: ningún archivo de producto cambió. El diff de la tarea es `web/src/screens/clientes/Clientes.test.tsx` y esta nota. Las copias `*.forced.test.tsx` se borraron y `CustomerSearch.ts` se restauró tras la regresión.

## 8. Veredicto

**Sitio arreglado, con prueba.** El test de `Clientes.test.tsx` (`while the full list is pending on a failed debtors read…`) ya no afirma la ausencia antes del estado: comprueba primero el estado pendiente, espera con `waitFor` y recién entonces afirma. Rojo forzado (`today`, 2 000 ms, 3 de 3) y verde forzado (`fixed`, 0 y 2 000 ms, 6 de 6) registrados arriba, más un rojo de regresión.

De las 23 filas fechadas de la ventana, 22 son este sitio; la fila 1 (GH-406, `Gastos.test.tsx:498`) es otro sitio y queda abierta aquí (la trata GH-694). Los sitios de `NuevaVenta` de la sección 6 siguen abiertos.

**Riesgo conocido.** El detector de flakes pertenece al sistema agéntico, no a este repo. Sus registros quedan en `.agentic/tasks/*.md` hasta salir de la ventana de 14 días alrededor del 2026-11-25; mientras tanto puede volver a levantar el aviso con filas ya explicadas aquí, sin una causa nueva.
