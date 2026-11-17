# GH-645 — flake de `web-tests` (GH-611, head `10d9b472`)

**Resultado: el rojo de GH-611 se reprodujo con un arnés forzado y se arregló en el test. No cambió ningún archivo fuera de `*.test.*`.**

- Rojo forzado contra el test viejo: 3 de 5 corridas rojas, con el mismo síntoma que GH-611 (`getAllByLabelText` «Unable to find a label with the text of: Name», el toast `Reason saved` en el DOM y ninguna hoja). El arnés es dependiente del orden de eventos, no determinista: 2 de 5 pasaron.
- Verde contra los tres tests nuevos con el mismo arnés (más estricto: `navigate(-1)` retenido durante todo el test): 5 de 5 corridas, 11 tests verdes cada una.
- Estrés (apoyo): 30 corridas del archivo solo, en lotes de 3 en paralelo, con `loadavg` de 1 min de 42 a 32 sobre 16 CPU: 0 rojos. 3 corridas completas con `--sequence.shuffle` (semillas 645001, 645002, 645003): 0 rojos, `Test Files 289 passed | 1 skipped (290)`, `Tests 4558 passed | 4 skipped (4562)`. Un 0 describe la carga de esta máquina en esta ventana, no prueba que el flake no exista.

## 1. Qué falló (GH-611)

Fuente: `.agentic/tasks/GH-611.md`, líneas 1315–1333. Cola de la corrida roja:

```text
                class="aviso-toast__texto"
              >
                Reason saved
              </span>
 ❯ getAllByLabelText node_modules/@testing-library/dom/dist/label-text.js:111:38
 ❯ src/screens/settings/WithdrawalReasons.test.tsx:129:32
    127|   const rows = screen.getAllByRole('button', { name: SETTINGS_TEXT.ren…
    128|   await userEvent.click(rows[1]!)
```

Salida forzada (copia temporaria del test viejo, línea 86 de la copia = línea 129 del original, misma sentencia `userEvent.clear(screen.getByLabelText('Name'))`):

```text
TestingLibraryElementError: Unable to find a label with the text of: Name
 ❯ getAllByLabelText node_modules/@testing-library/dom/dist/queries/label-text.js:111:38
 ❯ src/screens/settings/WithdrawalReasons.forced.test.tsx:86:32
     86|   await userEvent.clear(screen.getByLabelText('Name'))
```

El DOM de las tres corridas rojas tiene el toast `Reason saved` y ningún `role="dialog"`. Salidas completas: `docs/evidence/GH-645/GH-645-forced-red-old-{1..5}.txt` (rojas: 1, 3 y 5).

## 2. Causa

El test viejo toca Rename mientras el cierre de la hoja de alta sigue pendiente: `onSaved` llama a `closeSheet()` (`navigate(-1)`) y a `flash()` en el mismo tick (`WithdrawalReasons.tsx:225-228`). El test usaba el toast como prueba de que la hoja se cerró, y no lo prueba. `push` lee `router.state.location` (`useSheetStack.ts:144`), que todavía puede traer profundidad 1; la hoja de renombrar no aparece y el `getByLabelText('Name')` síncrono falla. Segundo riesgo: `flash()` nunca cancela el timer de 2,5 s anterior, así que el del alta puede borrar el toast del renombrar.

## 3. Arnés temporario (nunca commiteado)

Envuelve `router.navigate` del único router que `renderScreen` pasa a `SheetRouterProvider` y a `RouterProvider`. Retiene un `-1` hasta que el test lo libera, y el test toca Rename con `userEvent` mientras está retenido (hunks relevantes del diff contra el test viejo; el resto del diff solo es que la copia conservó únicamente el test combinado):

```diff
+  const realNavigate = router.navigate.bind(router)
+  const held: { release: (() => void) | null } = { release: null }
+  ;(globalThis as any).__hold = { on: false, held }
+  router.navigate = ((to: any, opts: any) => {
+    if (to === -1 && (globalThis as any).__hold.on) {
+      return new Promise<void>((resolve) => {
+        held.release = () => { held.release = null; resolve(realNavigate(to, opts)) }
+      })
+    }
+    return realNavigate(to, opts)
+  }) as typeof router.navigate
@@ test
   await userEvent.type(screen.getByLabelText('Name'), 'Gift')
+  ;(globalThis as any).__hold.on = true
   await userEvent.click(screen.getByRole('button', { name: 'Save' }))
@@
-  await userEvent.click(rows[1]!)
+  const tap = userEvent.click(rows[1]!)
+  ;(globalThis as any).__hold.on = false
+  ;(globalThis as any).__hold.held.release?.()
+  await tap
```

Una variante que libera el `-1` después de que termina el toque (`await userEvent.click(rows[1]!)` y luego `release`) dio 3 de 3 verdes: ahí el `push` ya ve la profundidad que dejó la hoja y la carrera no aparece; solo reproduce cuando el `-1` se libera mientras el toque está en curso. No se guardó la salida de esa variante.

Contra los tests nuevos el arnés es más estricto: todo `navigate(-1)` queda retenido para siempre.

```diff
+  const realNavigate = router.navigate.bind(router)
+  router.navigate = ((to: any, opts: any) => {
+    if (to === -1) return new Promise<void>(() => {}) // held for the whole test: never released
+    return realNavigate(to, opts)
+  }) as typeof router.navigate
```

Diffs completos: `docs/evidence/GH-645/GH-645-harness-old.diff`, `docs/evidence/GH-645/GH-645-harness-new.diff`. El archivo temporario `WithdrawalReasons.forced.test.tsx` se borró antes de commitear.

## 4. Arreglo

Solo `web/src/screens/settings/WithdrawalReasons.test.tsx`. El test combinado pasa a tres, cada uno con un `renderScreen` nuevo y una acción, con copia por test `const served = [...LIST]` (`LIST` nunca se muta):

1. Alta de «Gift»: el `status` dice exactamente `Reason saved`.
2. Renombrar la fila «Own use» a «Mine» (la fila se toma por nombre con `within`, el PATCH actualiza `served`): toast exacto `Reason saved` y «Mine» visible tras el refetch.
3. Borrar «Own use» (fila por nombre), confirmar en el `alertdialog`: toast `Reason deleted`, y «Own use» desaparece (consulta negativa precedida de la positiva `rowOf`).

Donde se espera la hoja abierta se la busca por nombre accesible (`addReasonTitle` / `renameReasonTitle`, rol `dialog` en jsdom, que no tiene `matchMedia` y dibuja la hoja de teléfono) y los campos con `findBy*`.

Resultado con el arnés estricto: `docs/evidence/GH-645/GH-645-forced-green-new-{1..5}.txt`, `Tests 11 passed (11)` en las cinco.

## 5. Conteos (`npx vitest list`, ordenada)

Base: 3261 líneas; después: 3263 (las líneas de este archivo pasan de 6 a 8). `diff` de las listas ordenadas:

```text
2573c2573
< [unit] src/screens/settings/WithdrawalReasons.test.tsx > adding and renaming toast "Reason saved" with no name, and deleting toasts "Reason deleted"
---
> [unit] src/screens/settings/WithdrawalReasons.test.tsx > adding a reason toasts "Reason saved" with no name
2576a2577
> [unit] src/screens/settings/WithdrawalReasons.test.tsx > deleting a reason toasts "Reason deleted" with no name
2577a2579
> [unit] src/screens/settings/WithdrawalReasons.test.tsx > renaming a reason toasts "Reason saved" with no name and lists the new name
```

Un nombre quitado (el combinado) y tres agregados; el resto de la suite, idéntico.

## 6. Diffs vacíos

Base `5a133e4d`:

- `git diff 5a133e4d -- web/src ':!*.test.*' web/vite.config.ts web/src/test-setup.ts scripts` → vacío (0 bytes).
- Sin reintentos, sin plazos más largos, sin `.skip`/`.todo`.

## 7. Estrés

| Pata | n | rojos |
|---|---|---|
| archivo solo, 3 en paralelo, `loadavg` 42→32 (16 CPU) | 30 | 0 |
| suite completa `--sequence.shuffle`, semillas 645001 / 645002 / 645003 (colas en `docs/evidence/GH-645/GH-645-shuffle-*.txt`) | 3 | 0 |

## 8. Límites

- Tras la división ningún test toca justo después de que se cierra una hoja. Un verde ahora muestra que el test ya no ejercita la carrera, no que la app la maneje: la carrera `push` contra un `navigate(-1)` en vuelo sigue en el producto (`useSheetStack.ts:143-155`) y no se tocó.
- El arnés viejo es dependiente del orden de eventos (3 de 5 rojas), no un rojo determinista.
- Archivos hermanos de la misma familia (GH-501, GH-440) no se barrieron en esta tarea.
