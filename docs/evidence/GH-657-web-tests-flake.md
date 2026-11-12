# GH-657: flake de `web-tests` en `CobroTree.test.tsx`

## El fallo en GH-607

Gate `delivery`, head `1995fb19` (`.agentic/tasks/GH-607.md:3148-3181` del checkout principal). Esa corrida tardó 903 s contra 326-465 s de las demás, es decir, CPU saturada:

```
FAIL |unit| src/screens/clientes/CobroTree.test.tsx > on a computer > a direct link opens the dialog with the customer chosen, over a list and a card that are inert and aria-hidden
Expected element to have text content: Ana Pérez · owes you $ 11.000 since 14/09   Received: ""
```

## Causa

- El test espera el dialog con `findByRole('dialog', { name: 'Record payment' })` (línea 95), que resuelve apenas se pinta el marco y el título.
- La línea 97 comprueba enseguida el texto del cliente. Ese texto sale solo de `GET /customers/1`: la query de `CobroRoute.tsx:68-71` alimenta la prop `customer` de `Cobro`, y `owesLine` (`Cobro.tsx:51-60`) arma la línea.
- Con CPU saturada la respuesta aún no llegó y el texto es `""`.
- El producto hace bien en pintar el dialog antes que los datos: el defecto está en el test. No cambia ningún archivo de producción.

## Método: holds forzados

Una copia temporal del archivo sin arreglar (`CobroTree.forced.test.tsx`, nunca commiteada, borrada al terminar) cambia el stub de `fetch` dentro de `renderApp`. Una clave `HELD` (const, leída de la variable de entorno `HELD` en la copia) espera 1 000 ms con un `setTimeout` real antes de llamar a `answer()`; las demás responden al instante.

```diff
-      const answer = table[`${init?.method ?? 'GET'} ${url}`]
-      return answer === undefined ? Promise.resolve(jsonResponse(404, {})) : Promise.resolve(answer())
+      const key = `${init?.method ?? 'GET'} ${url}`
+      const answer = table[key]
+      if (answer === undefined) return Promise.resolve(jsonResponse(404, {}))
+      if (key === HELD) return new Promise<Response>((resolve) => setTimeout(() => resolve(answer()), 1000))
+      return Promise.resolve(answer())
```

Valor del hold: 1 000 ms. Regla: muy por encima de lo que tarda el dialog en pintarse y muy por debajo de `asyncUtilTimeout` (10 000 ms), para que un test bien esperado pase y uno sin espera falle de forma determinista.

Ni la copia, ni `src/test-setup.ts`, ni `test-viewport`, ni `selectorTestKit` usan fake timers (`grep useFakeTimers` sin resultados): el hold es aplicable a todas las filas.

Corridas (cada una sobre las 47 instancias de test del archivo):

1. Sin hold, copia sin arreglar: 47 verdes. El ancla se sostiene.
2. `GET /customers/1`: 4 rojos. `GET /customers/1/account`: 2 rojos (las dos instancias de un mismo nombre). `GET /customers` y `GET /payments/debtors`: 47 verdes.
3. Con el arreglo, de nuevo sin hold (47 verdes) y con los holds que tenían rojos: `GET /customers/1/account` 47 verdes; `GET /customers/1` 1 rojo, la fila "not a race" de abajo.

## Tabla

`vitest list` da nombres de tests, no instancias: los `describe.each` / `test.each` con `%s` aparecen una vez (35 nombres, 47 instancias). Una celda roja significa que alguna instancia del nombre falló.

| test | sin hold | /customers/1 | /customers/1/account | /customers | /payments/debtors | después del arreglo |
|---|---|---|---|---|---|---|
| a customer answered as settled opens without an error, and the save is refused inline | green | green | green | green | green | green |
| a customer that is gone shows \"That is gone.\" with a way back to Clientes | green | red | green | green | green | red (not a race) |
| on a computer > a direct link opens the dialog with the customer chosen, over a list and a card that are inert and aria-hidden | green | red | green | green | green | green |
| on a computer > Escape and the backdrop leave like Cerrar does: to Clientes when nothing is behind | green | green | green | green | green | green |
| on a computer > the backdrop ends in the same leave | green | green | green | green | green | green |
| on a computer > with something typed, Escape asks first and does not leave | green | green | green | green | green | green |
| on a phone > a Back sent right after the choice, before any scheduled effect has run, still asks | green | green | green | green | green | green |
| on a phone > a flip across 900 px and back keeps the amount typed, with the form kept mounted | green | green | green | green | green | green |
| on a phone > a flip to the computer leaves focus on the field being typed in, and the computer form has no actions wrapper | green | green | green | green | green | green |
| on a phone > focus goes to the first field and Escape leaves like Close does | green | green | green | green | green | green |
| on a phone > Record payment is a modal dialog named by its title, with Close on top | green | red | green | green | green | green |
| on a phone > the Amount and Date fields say autocomplete off on the phone, and carry no attribute on a computer | green | green | green | green | green | green |
| on a phone > the card alone is behind the form: no list beside it | green | green | green | green | green | green |
| on a phone > the sheet holds exactly one Close, and Save inside the form in its pinned actions | green | red | green | green | green | green |
| on a phone > with something typed, Escape asks first and does not leave | green | green | green | green | green | green |
| opened from a list, on a %s > from Clientes: a save lands on Clientes with the toast, and one back afterwards leaves | green | green | green | green | green | green |
| opened from a list, on a %s > from Inicio: a save lands on Inicio | green | green | green | green | green | green |
| the form as drawn > a future-date refusal shows beside the date, and the date input points at it | green | green | green | green | green | green |
| the form as drawn > an untouched form is not dirty: Close leaves without asking | green | green | green | green | green | green |
| the form as drawn > a typed amount shows with dot thousands and the POST carries the number | green | green | green | green | green | green |
| the form as drawn > a zero amount is refused on save, an emptied one shows empty, and \"All\" brings the balance back | green | green | green | green | green | green |
| the form as drawn > one Backspace on the shown figure removes one digit, not the thousands | green | green | green | green | green | green |
| the form as drawn > opens showing the balance as whole pesos with dot thousands | green | green | green | green | green | green |
| the form as drawn > saving without a method shows the sentence with a hidden icon at the field, focuses it and sends nothing | green | green | green | green | green | green |
| the form as drawn > the API refusing a missing method shows the same sentence at the field | green | green | green | green | green | green |
| the form as drawn > the date is today with max = today, described as \"Today dd/mm\", then \"dd/mm\" for an earlier day | green | green | green | green | green | green |
| the form as drawn > the form always opens with the method empty | green | green | green | green | green | green |
| the form as drawn > the method is a Selector holding Cash and Transfer, none chosen, with no radio or pressed button | green | green | green | green | green | green |
| the link each screen follows to Record payment > %s carries its own screen name | green | green | green | green | green | green |
| what sits behind Record payment, on a %s > a customer that is gone, opened from %s: the host says so and the background does not navigate | green | green | green | green | green | green |
| what sits behind Record payment, on a %s > a state naming a screen outside the set puts the card behind | green | green | green | green | green | green |
| what sits behind Record payment, on a %s > opened from Customers: the live list is behind, inert and aria-hidden | green | green | green | green | green | green |
| what sits behind Record payment, on a %s > opened from Home: the Today figures are behind, inert and aria-hidden | green | green | green | green | green | green |
| what sits behind Record payment, on a %s > opened from the card: the card is behind, and it shows no message of the entry before | green | green | red | green | green | green |
| what sits behind Record payment, on a %s > with no state (a direct link or a reload) the card is behind | green | green | green | green | green | green |

- auditados: 35 (igual a la cantidad de nombres del `vitest list` base).
- cambiados: 4.

## Filas "not a race"

- `a customer that is gone shows "That is gone." with a way back to Clientes`: con el hold en `GET /customers/1`, el host y la tarjeta de fondo reciben el 404 al mismo tiempo y aparecen dos "That is gone." a la vez, así que `findByText` ve múltiples nodos hasta agotar el tiempo. No es una espera de datos: el hold cambia la forma del DOM sobre la que el test afirma (en el test hermano de la línea 327 el selector `:not([inert] *)` resuelve justo eso). Envolver la aserción en `waitFor` no puede arreglarlo sin cambiarla, lo que el plan prohíbe. Queda sin cambios.

## Líneas FAIL de las corridas rojas (copia sin arreglar)

```
FAIL  |unit| src/screens/clientes/CobroTree.forced.test.tsx > on a computer > a direct link opens the dialog with the customer chosen, over a list and a card that are inert and aria-hidden
FAIL  |unit| src/screens/clientes/CobroTree.forced.test.tsx > on a phone > Record payment is a modal dialog named by its title, with Close on top
FAIL  |unit| src/screens/clientes/CobroTree.forced.test.tsx > on a phone > the sheet holds exactly one Close, and Save inside the form in its pinned actions
FAIL  |unit| src/screens/clientes/CobroTree.forced.test.tsx > a customer that is gone shows "That is gone." with a way back to Clientes
FAIL  |unit| src/screens/clientes/CobroTree.forced.test.tsx > what sits behind Record payment, on a phone > opened from the card: the card is behind, and it shows no message of the entry before
FAIL  |unit| src/screens/clientes/CobroTree.forced.test.tsx > what sits behind Record payment, on a computer > opened from the card: the card is behind, and it shows no message of the entry before
```

## `vitest list` antes y después

Idénticos (`diff` vacío). Orden alfabético:

```
[unit] src/screens/clientes/CobroTree.test.tsx > a customer answered as settled opens without an error, and the save is refused inline
[unit] src/screens/clientes/CobroTree.test.tsx > a customer that is gone shows \"That is gone.\" with a way back to Clientes
[unit] src/screens/clientes/CobroTree.test.tsx > on a computer > a direct link opens the dialog with the customer chosen, over a list and a card that are inert and aria-hidden
[unit] src/screens/clientes/CobroTree.test.tsx > on a computer > Escape and the backdrop leave like Cerrar does: to Clientes when nothing is behind
[unit] src/screens/clientes/CobroTree.test.tsx > on a computer > the backdrop ends in the same leave
[unit] src/screens/clientes/CobroTree.test.tsx > on a computer > with something typed, Escape asks first and does not leave
[unit] src/screens/clientes/CobroTree.test.tsx > on a phone > a Back sent right after the choice, before any scheduled effect has run, still asks
[unit] src/screens/clientes/CobroTree.test.tsx > on a phone > a flip across 900 px and back keeps the amount typed, with the form kept mounted
[unit] src/screens/clientes/CobroTree.test.tsx > on a phone > a flip to the computer leaves focus on the field being typed in, and the computer form has no actions wrapper
[unit] src/screens/clientes/CobroTree.test.tsx > on a phone > focus goes to the first field and Escape leaves like Close does
[unit] src/screens/clientes/CobroTree.test.tsx > on a phone > Record payment is a modal dialog named by its title, with Close on top
[unit] src/screens/clientes/CobroTree.test.tsx > on a phone > the Amount and Date fields say autocomplete off on the phone, and carry no attribute on a computer
[unit] src/screens/clientes/CobroTree.test.tsx > on a phone > the card alone is behind the form: no list beside it
[unit] src/screens/clientes/CobroTree.test.tsx > on a phone > the sheet holds exactly one Close, and Save inside the form in its pinned actions
[unit] src/screens/clientes/CobroTree.test.tsx > on a phone > with something typed, Escape asks first and does not leave
[unit] src/screens/clientes/CobroTree.test.tsx > opened from a list, on a %s > from Clientes: a save lands on Clientes with the toast, and one back afterwards leaves
[unit] src/screens/clientes/CobroTree.test.tsx > opened from a list, on a %s > from Inicio: a save lands on Inicio
[unit] src/screens/clientes/CobroTree.test.tsx > the form as drawn > a future-date refusal shows beside the date, and the date input points at it
[unit] src/screens/clientes/CobroTree.test.tsx > the form as drawn > an untouched form is not dirty: Close leaves without asking
[unit] src/screens/clientes/CobroTree.test.tsx > the form as drawn > a typed amount shows with dot thousands and the POST carries the number
[unit] src/screens/clientes/CobroTree.test.tsx > the form as drawn > a zero amount is refused on save, an emptied one shows empty, and \"All\" brings the balance back
[unit] src/screens/clientes/CobroTree.test.tsx > the form as drawn > one Backspace on the shown figure removes one digit, not the thousands
[unit] src/screens/clientes/CobroTree.test.tsx > the form as drawn > opens showing the balance as whole pesos with dot thousands
[unit] src/screens/clientes/CobroTree.test.tsx > the form as drawn > saving without a method shows the sentence with a hidden icon at the field, focuses it and sends nothing
[unit] src/screens/clientes/CobroTree.test.tsx > the form as drawn > the API refusing a missing method shows the same sentence at the field
[unit] src/screens/clientes/CobroTree.test.tsx > the form as drawn > the date is today with max = today, described as \"Today dd/mm\", then \"dd/mm\" for an earlier day
[unit] src/screens/clientes/CobroTree.test.tsx > the form as drawn > the form always opens with the method empty
[unit] src/screens/clientes/CobroTree.test.tsx > the form as drawn > the method is a Selector holding Cash and Transfer, none chosen, with no radio or pressed button
[unit] src/screens/clientes/CobroTree.test.tsx > the link each screen follows to Record payment > %s carries its own screen name
[unit] src/screens/clientes/CobroTree.test.tsx > what sits behind Record payment, on a %s > a customer that is gone, opened from %s: the host says so and the background does not navigate
[unit] src/screens/clientes/CobroTree.test.tsx > what sits behind Record payment, on a %s > a state naming a screen outside the set puts the card behind
[unit] src/screens/clientes/CobroTree.test.tsx > what sits behind Record payment, on a %s > opened from Customers: the live list is behind, inert and aria-hidden
[unit] src/screens/clientes/CobroTree.test.tsx > what sits behind Record payment, on a %s > opened from Home: the Today figures are behind, inert and aria-hidden
[unit] src/screens/clientes/CobroTree.test.tsx > what sits behind Record payment, on a %s > opened from the card: the card is behind, and it shows no message of the entry before
[unit] src/screens/clientes/CobroTree.test.tsx > what sits behind Record payment, on a %s > with no state (a direct link or a reload) the card is behind
```

## Alcance

Otros archivos de test pueden tener el mismo patrón ("marco hallado con `findBy*`, contenido traído afirmado en síncrono"). No se barren aquí: quedan para un issue de seguimiento que cita esta nota como método.
