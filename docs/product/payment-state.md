## Jobs

**Cuando** recorro mis ventas (la lista de un día ahora, la historia de un Customer más adelante), **quiero** que cada Sale me diga de entrada si está pagada, pagada en parte y cuánto se debe todavía, o sin pagar, **para** saber qué ventas me quedan por cobrar sin abrir cada una ni sumar Payments de cabeza. (Parte 1 de GH-855, separada de #928: sirve al trabajo del Brief "saber quién me debe qué". El "desde cuándo" es del **Owing since** del Customer, no de este chip. Esta parte construye solo el chip, que ninguna pantalla usa todavía; ponerlo en la tarjeta de Sales es #928).

# Payment state en pantalla

Cómo se muestra el **Payment state** de una Sale: un chip, `SalePaymentChip` (`web/src/screens/ventas/SalePaymentChip.tsx`). La regla que calcula el estado y lo que todavía se debe vive en la API y está definida en sales.md ("Payment state por venta", parte 1 de GH-500). Esta capacidad solo lo muestra: nunca lo vuelve a calcular.

Antes de esta parte, la vendedora no podía saber desde una Sale si estaba pagada en parte ni cuánto quedaba. Para eso abría la venta, miraba el **Balance** del Customer o la marca "owes you" de Sales y lo sacaba a mano. Supuesto: no hay otro atajo que importe. El chip responde esa pregunta para una venta, y el Balance, el **Total owed**, las **Sales still owing** y "Owed to you" quedan exactamente como están.

Hasta que #928 lo ponga en una pantalla, el chip no lo ve nadie. El módulo puede figurar en `web/scripts/docs/front-exclude.json` si `test_front.py` lo pide (D-62e6dc23), y #928 saca esa entrada cuando lo conecta.

## Comportamiento

- **Qué lee**: solo `payment_state` y `still_owed` de la Sale (props `state` y `stillOwed`), más el formateador de dinero del Business. Nunca lee `still_owing`, los Payments ni el Balance del Customer.
- **Estados**:

| Estado | Lo que lee la vendedora | Clase |
|---|---|---|
| `paid` | "Paid" | `.payment-chip--paid` |
| `unpaid` | "Unpaid" | `.payment-chip--unpaid` |
| `part_paid` con `still_owed` mayor que 0 | un círculo lleno a la mitad y "Part-paid · {amount} owed" | `.payment-chip--part-paid` |
| null, un valor desconocido, o `part_paid` con `still_owed` null, 0 o negativo | el **Attention icon** y "Payment can't be shown" | `.payment-chip--unknown` |

- **El monto**: es exactamente `still_owed`, en el **Money format** del Business (su símbolo y sus decimales) y con la clase de cifra (**Tabular figures**). Nunca se saca del total, de los Payments ni del Balance, aunque no coincida con ellos.
- **Nunca un estado adivinado**:
  - Pagada en parte significa que todavía se debe algo. Un `part_paid` con `still_owed` null, 0 o negativo muestra "Payment can't be shown", nunca $0 ni un monto inventado.
  - El `switch` es exhaustivo con `assertNever`, y su rama por defecto muestra la misma línea.
- **Nunca solo por color**: cada estado se lee por su palabra, y pagada en parte también por su círculo.
- **Nombre accesible**: el círculo y el Attention icon (un `Icono` sin etiqueta) son decorativos, con `aria-hidden`. El texto del chip es su nombre accesible, según la **Icon and text rule**. El chip no se toca.
- **Teléfono angosto**: el chip pasa a una segunda línea cuando hace falta. El monto nunca se corta, se acorta ni se oculta (**Phone first**).
- **Colores**:
  - Las reglas `.payment-chip*` de `app.css` usan solo tokens, y solo pares que ya están en la tabla de contraste del README. El verde (`--positivo`) no se usa.
  - Pagada en parte va en `--deuda2` sobre `--deuda-fondo`, con el círculo en `--deuda`.
  - La línea desconocida sigue la regla del Attention icon (Icon and text rule y regla Attention del README): `--critico` sobre `--superficie`. La definición escrita gana sobre el dibujo (**Drawing as guide**).
  - Paid y Unpaid: su color lo decide el dueño, porque el dibujo aprobado de la tarjeta de Sales de GH-855 no está disponible y ningún rol elige un color. Hasta que decida, esas dos clases usan solo los tokens base del chip, sin color de estado.
- **Censo de colores** (`colorCensus.ts`): lleva una entrada por cada clase `.payment-chip--*` cuya regla usa un color de estado, con la palabra o la forma que lleva su significado y citando `SalePaymentChip.test.tsx`. Siempre `--part-paid` (círculo y palabra) y `--unknown` (Attention icon y oración). Una clase dibujada solo con tokens neutros no declara ningún color y no entra al censo.
- **Textos**: viven solo en el **Copy module** (`web/src/copy/sales.ts` y `en.baseline.json`), en inglés: `sales:card.payment.paid` "Paid", `sales:card.payment.unpaid` "Unpaid", `sales:card.payment.partPaid` "Part-paid · {{amount}} owed" y `sales:card.payment.unknown` "Payment can't be shown". Ninguno nombra una unidad, una moneda ni un tipo de producto (**Assume nothing**). "Paid · <método>" es del **On-the-spot payment**, no de este chip.
- **Ayuda de tests**: `saleWith(state, overrides?)` (`web/src/screens/ventas/saleWith.ts`, solo para tests) devuelve una `Sale` tipada con `payment_state` y `still_owed` puestos como par.

## Criterios de éxito

1. **Se lee sin color**: en el teléfono, el estado se lee por la palabra, y pagada en parte también por el círculo; nunca solo por el color.
2. **El monto de la venta, tal cual**: lo que se debe de una venta pagada en parte es exactamente su `still_owed`, en el Money format del Business, también cuando no coincide con el total. Evidencia: el test con un `stillOwed` distinto del total.
3. **Nunca un estado adivinado**: con los hechos de pago sin conciliar (null), un valor desconocido o un `part_paid` con `still_owed` null, 0 o negativo, el chip muestra "Payment can't be shown" con el Attention icon decorativo; nunca un estado adivinado ni $0.
4. **Assume nothing**: ningún texto del chip nombra una unidad, una moneda ni un tipo de producto, y los cuatro viven solo en `web/src/copy/`.
5. **Nada se corta**: el chip pasa a una segunda línea y el monto nunca queda cortado ni oculto. El Mobile check y la **Design capture** lo juzgan en el teléfono cuando #928 lo pone en la tarjeta de Sales.

Pendiente: el color de Paid y Unpaid lo decide el dueño. El círculo, el nombre accesible y el corte de línea todavía no se compararon con el dibujo de GH-855; se comparan antes de que #928 conecte el chip.
