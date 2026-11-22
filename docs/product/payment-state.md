## Jobs

**Cuando** recorro mis ventas (la lista de un día ahora, la historia de un Customer más adelante), **quiero** que cada Sale me diga de entrada si está pagada, pagada en parte y cuánto se debe todavía, o sin pagar, **para** saber qué ventas me quedan por cobrar sin abrir cada una ni sumar Payments de cabeza. (Parte 1 de GH-855, separada de #928: sirve al trabajo del Brief "saber quién me debe qué". El "desde cuándo" es del **Owing since** del Customer, no de este chip. Esta parte construye solo el chip, que ninguna pantalla usa todavía; ponerlo en la tarjeta de Sales es #928).

# Payment state en pantalla

Cómo se muestra el **Payment state** de una Sale: un chip, `SalePaymentChip` (`web/src/screens/ventas/SalePaymentChip.tsx`). La regla que calcula el estado y lo que todavía se debe vive en la API y está definida en sales.md ("Payment state por venta", parte 1 de GH-500). Esta capacidad solo lo muestra: nunca lo vuelve a calcular.

Antes de esta parte, la vendedora no podía saber desde una Sale si estaba pagada en parte ni cuánto quedaba. Para eso abría la venta, miraba el **Balance** del Customer o la marca "owes you" de Sales y lo sacaba a mano. Supuesto: no hay otro atajo que importe. El chip responde esa pregunta para una venta, y el Balance, el **Total owed**, las **Sales still owing** y "Owed to you" quedan exactamente como están.

Hasta que #928 lo ponga en una pantalla, el chip no lo ve nadie y no tiene **Screen image**. Por eso `web/scripts/docs/front-exclude.json` lista `^src/screens/ventas/SalePaymentChip\.tsx$` (D-62e6dc23), y #928 saca esa entrada cuando lo conecta. También lista `^src/screens/ventas/saleWith\.ts$`, que queda para siempre porque solo lo importan los tests.

## Comportamiento

- **Qué lee**: solo `payment_state` y `still_owed` de la Sale (props `state` y `stillOwed`). El formateador de dinero del Business sale de `useMoney()`. Nunca lee `still_owing`, los Payments ni el Balance del Customer.
- **Estados**:

| Estado | Lo que lee la vendedora | Clase |
|---|---|---|
| `paid` | "Paid" | `.payment-chip--paid` |
| `unpaid` | "Unpaid" | `.payment-chip--unpaid` |
| `part_paid` con `still_owed` mayor que 0 | un círculo lleno a la mitad y "Part-paid · {amount} owed" | `.payment-chip--part-paid` |
| null, un valor desconocido, o `part_paid` con `still_owed` null, no finito, 0 o negativo, o que en el Money format queda en $0 | el **Attention icon** y "Payment can't be shown" | `.payment-chip--unknown` |

- **El monto**: es exactamente `still_owed`, en el **Money format** del Business (su símbolo y sus decimales). Va en su propio elemento con la clase de cifra `.cifra-n` (**Tabular figures**) dentro de la oración. Nunca se saca del total, de los Payments ni del Balance, aunque no coincida con ellos.
- **Nunca un estado adivinado**:
  - Pagada en parte significa que todavía se debe algo. Un `part_paid` cuyo `still_owed` es null, no finito o menor o igual a 0, o que formateado da lo mismo que $0 (por ejemplo, 0,4 en un Business sin decimales), muestra "Payment can't be shown". Nunca muestra $0 ni un monto inventado.
  - El `switch` es exhaustivo con un `assertNever` propio que no tira error. Su rama por defecto muestra la misma línea, así que un valor que mande un servidor más nuevo no rompe la pantalla.
- **Nunca solo por color**: cada estado se lee por su palabra, y pagada en parte también por su círculo. Unpaid y Part-paid comparten el tono de deuda y se distinguen por la palabra y el círculo.
- **Nombre accesible**: el círculo y el Attention icon (un `Icono` sin etiqueta) son decorativos, con `aria-hidden`. El texto del chip es su nombre accesible, según la **Icon and text rule**. El chip no se toca y no tiene estado de presión.
- **Teléfono angosto**: el chip (`inline-flex` con `flex-wrap: wrap`) pasa a una segunda línea cuando hace falta. Sin `nowrap`, sin elipsis y sin `overflow: hidden`, el monto nunca se corta, se acorta ni se oculta (**Phone first**).
- **Aspecto**: una píldora chica (`border-radius: 999px`, `padding: 2px 8px`) con la letra de `.rotulo` y sin borde, el mismo lenguaje de la marca "te debe" y de la píldora de VentaDetalle. El círculo mide 0,8em, así que crece con el texto.
- **Colores**: las reglas `.payment-chip*` de `app.css` usan solo tokens, y solo pares que ya están en la tabla de contraste del README. Cada color está en una regla de una sola clase. No se usa verde (`--positivo`) ni ningún hex.
  - Paid es neutro: `--tinta2` sobre `--superficie`, por decisión del dueño (estilo limpio: solo resalta lo que pide atención). Sobre una tarjeta blanca se lee como texto apagado, sin píldora visible.
  - Unpaid va en el tono de deuda que la app ya usa para lo que se debe: `--deuda` sobre `--deuda-fondo`, por decisión del dueño.
  - Pagada en parte va en `--deuda2` sobre `--deuda-fondo`, con el círculo (`.payment-chip__half`) en `--deuda`: borde de 1px y mitad rellena.
  - La línea desconocida sigue la regla del Attention icon (Icon and text rule y regla Attention del README): `--critico` sobre `--superficie`, y el ícono toma ese color por `currentColor`.
- **Censo de colores** (`colorCensus.ts`): lleva una entrada por cada selector del chip cuya regla usa un color de estado. Cada una nombra la palabra o la forma que lleva su significado y cita `SalePaymentChip.test.tsx`:
  - `.payment-chip--unpaid`: la palabra "Unpaid".
  - `.payment-chip--part-paid`: la palabra "Part-paid" y el círculo.
  - `.payment-chip--unknown`: el Attention icon y la oración.
  - `.payment-chip__half`: el círculo junto a la palabra "Part-paid".

  `.payment-chip--paid` no entra, porque es neutro y el control del censo rechaza una entrada sin color de estado.
- **Textos**: viven solo en el **Copy module**, en inglés: en `web/src/copy/locales/en/sales.json` (con su `en-XA` generado), en `en.baseline.json` y en `baselineKeys/sales.json`.
  - `sales:card.payment.paid`: "Paid".
  - `sales:card.payment.unpaid`: "Unpaid".
  - `sales:card.payment.partPaid`: "Part-paid · {{amount}} owed".
  - `sales:card.payment.unknown`: "Payment can't be shown".

  Ninguno nombra una unidad, una moneda ni un tipo de producto (**Assume nothing**). "Paid · <método>" es del **On-the-spot payment**, no de este chip.
- **Ayuda de tests**: `saleWith(state, overrides?)` (`web/src/screens/ventas/saleWith.ts`, solo para tests) devuelve una `Sale` tipada con `payment_state` y `still_owed` puestos como par. Los `overrides` se aplican al final.

## Criterios de éxito

1. **Se lee sin color**: en el teléfono, el estado se lee por la palabra, y pagada en parte también por el círculo; nunca solo por el color.
2. **El monto de la venta, tal cual**: lo que se debe de una venta pagada en parte es exactamente su `still_owed`, en el Money format del Business, también cuando no coincide con el total. Evidencia: el test con un `stillOwed` distinto del total.
3. **Nunca un estado adivinado**: el chip muestra "Payment can't be shown" con el Attention icon decorativo cuando los hechos de pago no se concilian (null), cuando llega un valor desconocido o cuando un `part_paid` trae un `still_owed` inservible. Nunca muestra un estado adivinado ni $0.
4. **Assume nothing**: ningún texto del chip nombra una unidad, una moneda ni un tipo de producto, y los cuatro viven solo en `web/src/copy/`.
5. **Nada se corta**: el chip pasa a una segunda línea y el monto nunca queda cortado ni oculto. El Mobile check y la **Design capture** lo juzgan en el teléfono cuando #928 lo pone en la tarjeta de Sales.

Pendiente para #928:
- Conciliar el chip con la marca "te debe" de las filas de Sales, para que una Sale no muestre dos señales de deuda.
- Confirmar en la pantalla real que Paid, neutro, se sigue leyendo como parte de la misma familia de chips.
- Comparar el chip con el dibujo de GH-855.
- Decidir si "Payment can't be shown" necesita una forma de resolverlo ahí mismo; hoy la salida es abrir la Sale.
