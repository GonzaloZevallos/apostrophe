# GH-679: `web-tests` intermitente por `vi.waitFor`

## El fallo registrado

Gate `delivery`, head `53682ca8`, entrega de GH-677. El log está en `.agentic/tasks/GH-677.md`, en el checkout principal (no en este árbol). Esa corrida tardó 1 083 s, frente a los ~450 s habituales.

```
src/screens/Gastos.test.tsx:498:67
498|   await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBe…
Test Files 1 failed | 304 passed   Tests 1 failed | 4927 passed
```

El DOM impreso es la hoja (Sheet) del gasto, todavía abierta.

## La causa

- `vi.waitFor` es el helper propio de Vitest. Corre con su default de 1 000 ms y **no** lee `configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT })` de Testing Library (10 000 ms, `web/src/test-setup.ts`).
- `test-setup.ts` declara ese valor como el techo de toda espera.
- La guardia `web/src/architecture/asyncTimeouts.ts` solo miraba claves `timeout`, así que ninguna llamada `vi.waitFor` desnuda la veía.
- Bajo carga de CPU la hoja tardó más de 1 s en cerrarse y la espera se rindió. El código de producto no tiene la culpa.

## Qué cambia

- Las 24 llamadas `vi.waitFor` pasan a `waitFor` de `@testing-library/react`. Callback y aserción quedan idénticos; no se agrega `timeout`, reintento, `.skip` ni aserción más débil.
- La guardia ahora prohíbe, a nivel de token, `vi.waitFor`, `vi.waitUntil` y `expect.poll` (con punto, con corchetes `vi['waitFor']` y desestructurados `const { waitFor } = vi`). Queda una sola forma de esperar y un solo techo.
- Ninguno de los 24 sitios corre bajo timers falsos (los tests con `vi.useFakeTimers()` de `GatedLayout.test.tsx`, líneas 236–270, no llamaban `vi.waitFor` y no cambian).

## Los 24 sitios (antes del cambio)

| Archivo | Líneas |
|---|---|
| `web/src/screens/Gastos.test.tsx` (7) | 398, 438, 470, 498, 499, 510, 519 |
| `web/src/screens/Gastos.edit.test.tsx` (8) | 99, 149, 164, 177, 192, 202, 217, 231 |
| `web/src/shell/GatedLayout.test.tsx` (3) | 207, 226, 277 |
| `web/src/screens/settings/CustomerTypes.test.tsx` (3) | 99, 163, 223 |
| `web/src/screens/Entrar.test.tsx` (2) | 124, 274 |
| `web/src/components/Selector.phone.test.tsx` (1) | 339 |

## Pares rojo/verde forzados

Una copia temporal por archivo (`*.forced.test.tsx`, junto al original, **nunca commiteada**, borrada después de correr). En cada copia se retiene 2 000 ms reales (`setTimeout`) lo que espera el primer sitio relevante, y se corre solo ese test con `-t`:

- rojo: copia del archivo original (con `vi.waitFor`) más el retén;
- verde: copia del archivo actual (con `waitFor`) más exactamente el mismo retén.

Los 2 000 ms superan el 1 000 ms de `vi.waitFor` y quedan muy por debajo de los 10 000 ms del techo. Resultado de los seis pares: rojo en las seis copias con `vi.waitFor`, verde en las seis con `waitFor`.

| Archivo | Test | Rojo (`vi.waitFor`) | Verde (`waitFor`) |
|---|---|---|---|
| `Gastos.test.tsx` | `the gone refusal is tied to the field…` | `FAIL … Error: expect(element).toHaveTextContent()` · 1 failed | 1 passed |
| `Gastos.edit.test.tsx` | `phone: back from a dirty edit asks once…` | `FAIL … Error: expect(element).not.toBeInTheDocument()` · 1 failed | 1 passed |
| `GatedLayout.test.tsx` | `a business in another language renders nothing until its chunk is installed, then mounts` | `FAIL … AssertionError: expected [] to deeply equal [ 'de' ]` · 1 failed | 1 passed |
| `CustomerTypes.test.tsx` | `creates a type with the default circle icon and refreshes the list` | `FAIL … Error: expect(element).not.toBeInTheDocument()` · 1 failed | 1 passed |
| `Entrar.test.tsx` | `a successful login clears the whole cache before landing on Inicio` | `FAIL … AssertionError: expected { businessName: 'stale' } to be undefined` · 1 failed | 1 passed |
| `Selector.phone.test.tsx` | `loading turning true while the list is open…` | `FAIL … AssertionError: expected 1 to be +0 // Object.is equality` · 1 failed | 1 passed |

Cada línea `FAIL` completa lleva el prefijo `FAIL  |unit| src/<ruta>.forced.test.tsx > <test>`.

Diferencias del arnés (original → copia forzada; la copia verde lleva el mismo retén sobre el archivo actual):

`Gastos.test.tsx`: se retiene la respuesta del `POST /expense-categories` que espera el sitio 398.

```diff
-        if (url === '/expense-categories' && method === 'POST') return jsonResponse(201, { id: 3, name: 'Insumos' })
+        if (url === '/expense-categories' && method === 'POST') {
+          await new Promise<void>((r) => setTimeout(r, 2000))
+          return jsonResponse(201, { id: 3, name: 'Insumos' })
+        }
```

`Gastos.edit.test.tsx`: el primer sitio (99) no espera un `fetch` sino el cierre de la hoja tras confirmar el descarte; lo retenido es la causa, el clic en «Yes, discard them».

```diff
-  await userEvent.click(await screen.findByRole('button', { name: 'Yes, discard them' }))
+  const discardNow = await screen.findByRole('button', { name: 'Yes, discard them' })
+  setTimeout(() => void userEvent.click(discardNow), 2000)
```

`GatedLayout.test.tsx`: el sitio 207 espera que el cargador de idioma sea pedido, lo que ocurre al llegar la respuesta de `me`; se retiene esa respuesta (no la del chunk de `lateLoader`, que el sitio 207 aún no alcanza).

```diff
-      Promise.resolve(
+      new Promise<Response>((resolve) => setTimeout(() => resolve(
         jsonResponse(200, { email: 'ana@x.com', ... shown_language: language, ... }),
+      ), 2000),
       ),
```

`CustomerTypes.test.tsx`: se retiene la respuesta del `POST`.

```diff
-    if (answered !== undefined) return Promise.resolve(answered)
+    if (answered !== undefined) return method === 'POST' ? new Promise<Response>((r) => setTimeout(() => r(answered), 2000)) : Promise.resolve(answered)
```

`Entrar.test.tsx`: se retiene la respuesta del login.

```diff
-  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { token: 'tok' }))
+  vi.mocked(fetch).mockImplementation(() => new Promise((r) => setTimeout(() => r(jsonResponse(200, { token: 'tok' })), 2000)))
```

`Selector.phone.test.tsx`: el sitio 339 no espera un `fetch` sino que `loading` pase a verdadero; se retiene el clic que lo provoca.

```diff
-    fireEvent.click(screen.getByRole('button', { name: 'Start loading' }))
+    const startNow = screen.getByRole('button', { name: 'Start loading' })
+    setTimeout(() => fireEvent.click(startNow), 2000)
```

En una primera versión de este arnés para `Selector.phone` el retén estaba en `setLoading(true)` dentro de un `setTimeout`, fuera de `act`; eso dejó el diálogo montado y la aserción posterior (`queryByRole('dialog')`) falló aun con `waitFor`. Es un artefacto del arnés (actualización fuera de `act`), no del cambio; se descartó y se usó el retén sobre el clic, que sí pasa por `act`.

## Los otros 18 sitios

Los otros 18 sitios `vi.waitFor` quedan cubiertos por la misma causa (mismo helper, mismo default de 1 000 ms que ignora el techo de 10 000 ms) y **no se reprodujeron uno por uno**. Se reprodujo el primer sitio relevante de cada uno de los seis archivos.

## `npx vitest list` antes y después

Listas ordenadas, tomadas con el árbol del padre del cambio y con el árbol actual (3 487 y 3 490 líneas). La única diferencia son los tres casos nuevos de la guardia:

```
> [unit] src/architecture/asyncTimeouts.test.ts > findShortAsyncTimeouts > accepts Testing Library waits and names that only look alike
> [unit] src/architecture/asyncTimeouts.test.ts > findShortAsyncTimeouts > rejects a Vitest wait, which ignores the ceiling, on the line of its token
> [unit] src/architecture/asyncTimeouts.test.ts > findShortAsyncTimeouts > rejects a Vitest wait written as a bracket access or a destructure
```

## Corrida completa de `npm --prefix web test`

Evidencia de regresión solamente: una corrida verde no prueba ausencia de intermitencia.

`npm --prefix web test` (`vitest run`, todo el suite web) sobre el árbol con el cambio de código (`b069b03b`; el commit posterior solo agrega este documento). La corrida pasó el tope de 600 s de la herramienta, siguió en segundo plano y terminó con salida 0:

```
 Test Files  305 passed | 1 skipped (306)
      Tests  4931 passed | 4 skipped (4935)
   Start at  21:35:07
   Duration  915.06s
```

La duración (915 s, frente a ~450 s habituales) coincide con una máquina cargada por otras corridas en paralelo. No cuenta como prueba de que la intermitencia desapareció; esa prueba son los pares forzados de arriba. Además pasaron `src/architecture` completo (43 archivos, 479 tests), `npm --prefix web run typecheck` y `npm --prefix web run lint`.
