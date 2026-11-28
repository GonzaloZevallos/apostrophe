---
status: draft
---
## Goal

El formulario del Customer (`ClienteForm`) sirve para dar de alta un Customer desde Customers (`/customers/new`) y para editarlo (`/customers/{id}/edit`). En los dos casos el botón de guardar pasa a decir "Save" en lugar de "Save and use", porque ninguno de los dos modos pone al Customer en una Sale. El cambio es para el vendedor, que da de alta o corrige a una persona desde el celular: el botón dice solo lo que hace. El creador de "Pick a customer" de New sale conserva su propio rótulo. Todo test que buscaba el rótulo viejo se migra en el mismo cambio (D-69509906).

## Acceptance criteria

- En `/customers/new`, el botón de guardar dice "Save" y usa el texto `common:save`, leído como lo leen los usos no deprecados, nunca `COMMON_TEXT.save`.
- En `/customers/{id}/edit`, el botón de guardar dice "Save" y usa el mismo texto `common:save`.
- El creador de "Pick a customer" de New sale (`NuevaVentaCliente`) sigue mostrando su rótulo `SALES_TEXT.createCustomer`, y ese archivo no cambia.
- `saveAndUse` ya no está en `web/src/copy/customers.ts` ni en `web/src/copy/en.baseline.json`, y el chequeo del baseline de textos pasa.
- `grep -rn "Save and use\|saveAndUse" web/src web/e2e` no encuentra nada.
- Cada "Save and use" de `ClienteForm.test.tsx` y `ClienteSheet.test.tsx` pasa a ser "Save".
- Cada `getByRole('button', { name: 'Save and use' })` del e2e (los helpers `seed.ts` y `ledger.ts`, y todo spec que lo usaba) pasa a ser `getByRole('button', { name: 'Save', exact: true })`, y en `phoneCountry.spec.ts` el `saveAndUse()` local pasa a llamarse `save()`.
- Ningún elemento ni rótulo se vuelve a poner, visible u oculto, para que un locator lo encuentre.
- Tests de Testing Library con fetch simulado muestran "Save" al editar un Customer y en `/customers/new`, y el rótulo `createCustomer` en el creador de New sale.
- tsc, oxlint, vitest y e2e pasan.
- El PR lista en una línea la diferencia con `ClienteNuevo.dc.html`: "Guárdá y usá" en el dibujo, "Save" en la app, desvío #1.

## Out of scope

- Cualquier cambio en `NuevaVentaCliente` o en `SALES_TEXT.createCustomer`.
- Cualquier cambio de disposición, de comportamiento o de la vista de computadora del formulario del Customer.
- Cualquier otro cambio de texto.
- Cambios de backend.

## Decisions

- El alcance de la migración del e2e lo fija el `grep`, no la cantidad de specs que da el pedido.
  - Reason: el pedido dice "18 specs" pero nombra 17, y D-69509906 exige migrar cada uso del elemento cambiado.
- Si un locator `name: 'Save', exact: true` encuentra más de un botón, se acota al formulario o a su diálogo.
  - Reason: D-69509906 prohíbe volver a poner un elemento para satisfacer un locator, así que la ambigüedad se resuelve en el test.
- El desvío respecto de `ClienteNuevo.dc.html` se trata como aceptado por el humano, no como decisión de PM.
  - Reason: solo el dueño aprueba un desvío de un dibujo aprobado, y el humano respondió "Drawing 1: accept (flag)" con la regla del dueño del 2026-11-19 (un control nunca promete una acción que no hace).

## Risks

Un "Save" con `exact: true` puede encontrar otro botón "Save" visible al mismo tiempo, por ejemplo en una Sheet de Settings, y dejar un locator ambiguo en algún spec.
Si un spec usa el rótulo viejo y la lista del pedido no lo nombra, la migración debe encontrarlo con el `grep`.
Las Screen images `ClienteNuevo` y `ClienteEditar` siguen mostrando el rótulo viejo hasta que se regeneren; si difieren, gana el texto.

## Screens

Las pantallas salen de la etapa de diseño.

## Slices

### customer-form-save-label

#### Acceptance criteria

- `/customers/new` y `/customers/{id}/edit` muestran el botón "Save" con el texto `common:save`, y el creador de New sale conserva `createCustomer`.
- `saveAndUse` se quita de `customers.ts` y de `en.baseline.json`, y `grep -rn "Save and use\|saveAndUse" web/src web/e2e` no encuentra nada.
- Los tests unitarios y cada locator del e2e se migran a "Save" sin volver a poner ningún elemento, y tsc, oxlint, vitest y e2e pasan.
- El PR lista la diferencia con `ClienteNuevo.dc.html`.

#### Risks

- ambiguous-save-locator
- unlisted-e2e-use
