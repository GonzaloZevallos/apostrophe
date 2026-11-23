---
status: draft
---
## Goal

Agregar la opción "Owes it" al Selector "How they pay" de la Collect Sheet (`web/src/screens/ventas/CollectSheet.tsx`), que sigue sin ruta. Es para la vendedora que le entrega un pedido a un cliente que conoce y se lo lleva sin pagar ahora: guarda la venta como adeudada con los mismos pocos toques que una venta pagada, para que su Balance y su Owing since la muestren y pueda cobrarla después sin perder la fecha. Una venta sin cliente nunca se guarda como adeudada.

## Acceptance criteria

- "Owes it" se ofrece en "How they pay" solo cuando `draft.state.customerId` está puesto, última después de los Payment methods del Business en el orden de su lista, sin importar el total.
- Elegir "Owes it" llama a `draft.setChoice({kind:'owing'})`; elegir un Payment method guarda `{kind:'paid', payment_method_id}`.
- Salir de "Owes it" sin nombrar un medio guarda `{kind:'unset'}` y el campo muestra la propuesta de las New sale suggestions o queda vacío; no se recuerda ninguna elección anterior (test: medio B, después "Owes it", después volver muestra la propuesta).
- Collect con "Owes it" y cliente pasa por `validateSale`/`payStateOf` y `saleBodyOf` como cualquier elección y hace exactamente 1 pedido sin ningún Payment; un borrador que ya trae owing con cliente se muestra como "Owes it" y se guarda.
- `useSaleDraft`: sacar el cliente con owing conserva owing (ya no lo vuelve a unset); cambiar de cliente conserva owing; sacarlo conserva paid(id).
- Con owing y sin cliente, el campo muestra "Owes it" con la marca existente "no longer available", Collect manda 0 pedidos, muestra en el `FieldRefusal` el motivo que da `validateSale` para una venta adeudada sin cliente y enfoca el Selector; no se pone ningún medio en su lugar; volver a poner el cliente o elegir un medio borra el bloqueo.
- La etiqueta "Collect {total}" es la misma con "Owes it" que con un medio; no hay línea extra, ni aviso de Credit, ni vista previa del Balance.
- La clave de "Owes it" vive en el módulo de ventas de `web/src/copy/`, en inglés; se agrega una segunda clave solo si la validación de #918 no tiene en palabras el motivo de owing sin cliente. El baseline se regenera.
- Las ocho invariantes de #918 se cumplen y vitest pasa.

## Out of scope

- Ruta, entrada de navegación, fila de `screens.json` o WalkState para la Sheet (hasta el flip de GH-496).
- Pago parcial en el momento de la venta; un pago parcial es un Payment posterior por Record payment y el Settlement.
- Cambios a los Payment methods, a Settings o al Selector compartido.
- Aviso de Credit o vista previa del Balance en la Sheet, y otra palabra de acción para una venta adeudada.
- Cualquier cambio en el servidor.

## Decisions

- Con owing y sin cliente, "Owes it" se queda con la marca "no longer available" y Collect no guarda, en lugar de volver a unset.
  - Reason: el Selector muestra así una elección que ya no se ofrece, y volver a unset haría que un toque en Collect registre un Payment con el medio propuesto que nadie hizo, falseando el Cash y el Money in.
- Se reemplaza la regla de `useSaleDraft` que volvía owing a unset al sacar el cliente.
  - Reason: sin ese cambio la decisión anterior no se puede cumplir, porque la Sheet recibiría unset con el medio propuesto.
- "Owes it" va última, después de los Payment methods.
  - Reason: no es un Payment method y así el primer medio del Business y la propuesta quedan donde la vendedora los espera.
- La acción y el total de Collect no cambian con "Owes it".
  - Reason: el pedido pide una sola clave de texto y el campo justo arriba ya muestra "Owes it".
- "Owes it" se ofrece con cualquier total, también $0, y una venta de $0 queda pagada según Payment state.
  - Reason: esconderla según el total haría saltar la lista mientras se arma la venta, y las reglas existentes ya deciden el resultado.
- No se dice nada de un Credit existente en el momento de la venta.
  - Reason: el Credit se aplica solo y la cuenta y el Sale bill muestran el resultado; una vista previa sería alcance nuevo.

## Risks

El gesto para salir de "Owes it" sin nombrar un medio depende de lo que el Selector actual permita; si no lo permite sin cambiarlo, el test de "volver muestra la propuesta" solo se alcanza por el borrador.
Cambiar la regla de `useSaleDraft` puede romper tests existentes de la Sale in progress o de la Sheet que fijaban el paso a unset o el rechazo "sin medio" de un borrador owing; se reemplazan por los de esta tarea.
La vara de "menos de un minuto" no se puede juzgar hasta el flip de GH-496.

## Screens

La tarea toca la interfaz; las pantallas salen de la etapa de diseño.

## Slices

### owes-it-option

#### Acceptance criteria

- "Owes it" se ofrece solo con cliente, última, y guarda `{kind:'owing'}`; Collect la manda en 1 pedido sin Payment.
- Medio B, después "Owes it", después volver muestra la propuesta.
- Sacar el cliente con owing conserva owing en `useSaleDraft`; la Sheet muestra la marca "no longer available", manda 0 pedidos y enfoca el Selector; volver a poner el cliente la guarda.
- La clave de "Owes it" está en el módulo de ventas de `web/src/copy/`, en inglés, y las ocho invariantes de #918 se cumplen.

#### Risks

- selector-back-gesture
- draft-rule-change