# Undo

## Jobs

- Cuando acabo de guardar una Sale desde New sale y veo que está mal (otro Customer, otros gramos, otro Product, o guardada dos veces), quiero deshacerla con un toque, ahí mismo, para volver a registrarla bien sin buscarla en Sales. Se juzga por: durante 5 segundos después de guardar, un toque en Undo la elimina sin confirmación, y siempre se ve cómo terminó.

## Qué es

Undo es el atajo de 5 segundos para eliminar la Sale recién guardada desde New sale. Es la misma eliminación que se hace desde el detalle de la Sale, solo que más rápida y sin confirmación. No reemplaza esa eliminación: después de los 5 segundos, el detalle de la Sale, con su confirmación, sigue siendo el único camino de vuelta.

## El aviso de guardado

- Después de guardar una Sale desde New sale aparece un aviso corto con una acción: "Sale to {name} saved · Undo" (`common:saleSavedTo` y `common:undo`). Dura 5 segundos (`SALE_SAVED_TOAST_MS`).
- Se muestra en la pantalla a la que vuelve New sale. Se arma antes de salir de New sale (`armAfterLeaving`, justo antes de `leave()`), nunca se levanta al llegar, y a los 5 s ya no está.
- Aparece en toda Sale guardada desde New sale por su salida habitual: con Customer, sin Customer, con deuda, pagada en parte o pagada en el momento con Collect. Una pantalla que abre New sale pasando su propio `onSaved` maneja su propia salida y no recibe el aviso ni Undo.
- Sin Customer, en lugar del nombre se usa el texto "No customer" que ya está en el Copy module (`sales:noCustomer`).
- Solo se guardan el id y el nombre de la Sale, en memoria. Cada aviso guarda su propio id: un guardado más nuevo trae su propio aviso, que reemplaza al anterior al llegar, y nunca hereda el id de una Sale anterior, así que Undo siempre actúa sobre la Sale de su aviso.
- Es el aviso temporizado de una acción que la app ya tiene (`SaleSavedToast` dentro de `.aviso-flotante`), no un elemento nuevo.

## Qué hace Undo

- Un toque elimina la Sale, sin paso de confirmación. Un doble toque manda un solo pedido de eliminación.
- Las consecuencias son las mismas que al eliminarla desde su detalle:
  - La Sale sale de Sales y de la cuenta del Customer.
  - Su On-the-spot payment se va con ella.
  - Sus gramos vuelven al Stock.
  - Deja de influir en las New sale suggestions.
  - Un Credit aparece solo donde el glosario dice que aparece, sin ningún aviso extra.
- Solo elimina: no vuelve a abrir New sale con la Sale cargada, y el vendedor queda en la pantalla en la que estaba.
- Con éxito, se vuelven a pedir las lecturas abiertas de Sales, Stock, la cuenta del Customer y Payments, y las New sale suggestions (`keys.saleFormSuggestionsAll()`).
- Un Home que ya está en pantalla conserva las cifras que mostraba: Undo no las hace saltar. Se actualizan la próxima vez que se abre Home. La consulta del Panel (`keys.panel()`) nunca se borra, invalida ni vuelve a pedir desde Undo.

## Cómo termina

El vendedor siempre ve cómo terminó Undo, aunque New sale ya se haya cerrado, haya cambiado la ruta o hayan pasado los 5 s. "Deleted" se muestra solo cuando el servidor lo confirmó.

Cada resultado es un aviso corto, temporizado, con la duración habitual de la app, sin acción y sin nombre. Ninguno ofrece Retry.

| Final | Qué ve el vendedor | Attention icon |
|---|---|---|
| Eliminada | "Sale deleted · the grams go back to stock" (`common:saleDeletedGramsBack`, `AvisoExito`) | No |
| Ya no estaba (404, `isGone`) | El aviso neutro de algo que ya no está (`Notice` con `GONE_NOTICE`) | No |
| Sin conexión (`NetworkError`) | "No connection. The sale is still saved: delete it from its detail in Sales." (`common:undoSaleOffline`, `AvisoAmbar`) | Sí |
| Falló (cualquier otro rechazo) | "The sale is still saved. Delete it from its detail in Sales." (`common:undoSaleFailed`, `AvisoAmbar`), sin dar el motivo | Sí |
| 401 | Nada propio: se hace cargo el manejo de sesión que ya existe (`MutationCache.onError`) | No |

Un resultado que llega tarde nunca tapa un aviso que todavía importa: si en pantalla hay un aviso con acción (como el aviso de guardado de otra Sale) o un resultado Sin conexión o Falló, el resultado nuevo espera su turno, en orden de llegada, y se muestra con su propia duración cuando ese aviso termina. Por eso un resultado puede verse después de los 5 s de una Sale guardada más tarde; es tardío pero cierto, y no nombra ninguna Sale.

Los textos viven en el Copy module, en inglés, y siguen WRITING_STANDARDS.md y la Icon and text rule.

## Fuera de alcance

- Reabrir New sale con la Sale eliminada para corregirla y volver a guardarla.
- Reintentar un Undo fallido.
- Cualquier cambio en la eliminación desde el detalle de la Sale.
- Cambios en el backend.
- Un estado de "eliminando" mientras el pedido está en curso: un pedido colgado no muestra nada hasta que el navegador lo da por perdido.

## Estado

En el código es `useUndoSale` (`web/src/sales/useUndoSale.ts`), con `undoOutcome` para elegir el resultado y la cola de avisos en `web/src/flash/flashReducer.ts`. Hoy solo se llega a través de NewSaleSheetHost, que todavía no está ruteado, y por eso figura en `web/scripts/docs/front-exclude.json` (D-62e6dc23). La parte que rutea el host saca esa entrada.

## Métricas

- **M1:** después de guardar con host → Collect, el aviso está en la pantalla de destino a los 4,9 s y ya no está a los 5 s. Un toque en Undo manda exactamente un pedido de eliminación, sin ningún paso extra.
- **M2:** tras un Undo exitoso, se vuelven a pedir cada una de las lecturas montadas de Sales, Stock y la cuenta del Customer, y se invalidan las suggestions.
- **M3:** cada uno de los cinco finales (éxito, 404, falla de red, otro rechazo, 401) muestra su propio resultado, incluso después de los 5 s y con el host desmontado. "Deleted" nunca aparece sin una respuesta exitosa.
- **M4:** con la consulta del Panel de Home montada, la cantidad de pedidos del Panel no cambia tras Undo y un nuevo render, y sube en uno cuando Home se vuelve a montar.
