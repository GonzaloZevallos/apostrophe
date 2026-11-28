## Jobs

- Cuando acabo de registrar una Sale, o un Customer me pregunta por una, quiero ver de un vistazo para quién fue, qué se llevó, cuánto dio y si está paga, y mandarle el Sale bill en un toque, para cerrar la conversación sin volver a tipear montos ni sacar de memoria lo que todavía debe. (GH-1116: es el paso de confirmación y entrega del trabajo del Brief "When I hand over an order…"; el Payment state y el Balance del Sale bill lo atan al trabajo de la deuda, pero el detalle no se juzga por ese trabajo).
- Cuando abro una Sale que registré, quiero ver de un vistazo quién la compró, cuándo, si está paga y qué se debe todavía, y exactamente qué Products, cantidades, precios y total tuvo, para poder contestarle al Customer, compartirle la Sale o asignarle el Customer que le faltaba, sin abrir nada más.

# Detalle de una Sale

![VentaDetalle](../assets/screens/VentaDetalle.webp)

(La imagen se vuelve a tomar después del merge de GH-1201. Hasta entonces puede mostrar el detalle de antes, y gana el texto).

El detalle de una Sale (`/sales/:id`, `web/src/screens/ventas/VentaDetalle.tsx`) muestra a quién se le vendió, la fecha, el Payment state, cada Sale line, el Shipping charged cuando lo hay, el total y la Note. Desde ahí el Sale bill se comparte con Share, en la fila del título, o se copia con Copy, en su bloque. A una Sale without a customer se le puede asignar un Customer, una sola vez.

El detalle no ofrece cobrar. Record payment se abre con "Collect" desde una fila de deudor de Customers o de Home, o desde la ficha del Customer, nunca desde una Sale.

GH-1116 rediseñó el detalle según los dibujos `VentaDetalle.dc.html` y `VentaDetalleOscuro.dc.html`, en dos partes. La parte 1 construyó las dos tarjetas y la parte 2 (GH-1201) las conectó a la pantalla. Donde `sales.md` ("En pantalla: Sale #N" y "El botón" del Sale bill) todavía describe el detalle de antes (la fecha dd/mm bajo el título, el total arriba, la línea de resumen, los gramos y el precio "per gram", Assign customer en la fila de acciones, un solo botón Share o Copy), gana esta definición.

## La pantalla, de arriba hacia abajo

Hay una sola disposición para todo ancho: en la computadora se ve la del teléfono, sin pulido dedicado (Phone first). La pantalla llama una sola vez a `useSaleBillShare`, arriba de todo y antes de los estados de error y de carga, con:
- `state`: cargando mientras no hay datos y, si no, listo con `data.bill`;
- `refreshing`: mientras corre una asignación de Customer, o mientras se espera que el detalle leído de nuevo traiga el Customer asignado;
- `onCopied`: muestra el aviso "Bill copied".

1. **La fila del título**: un grupo (`role=group`) cuyo nombre es el h1 "Sale #N" (`sales:detail.title` seguido del Sale number). Contiene un botón redondo de solo ícono con el nombre accesible "Share" (`sales:detail.share`, regla del dueño D-8ecb8c1d).
   - Aparece solo donde el dispositivo puede compartir, mientras ningún Share falló en esta apertura y la Sale tiene Sale bill.
   - Queda deshabilitado y ocupado (`aria-busy`) mientras el Sale bill carga o se vuelve a leer.
   - Es el único Share de la pantalla.
   - El detalle no tiene un control de volver propio (ADR-0049): su camino de vuelta es la flecha del marco.
2. **El aviso "Sale saved" con Undo**: igual que antes, justo debajo de la fila del título.
3. **`SaleCustomerCard`**:
   - el avatar con las iniciales del Customer, o el ícono de persona sin Customer, los dos decorativos;
   - el nombre como texto plano, nunca un link, o "No customer";
   - la fecha en el idioma que se muestra (`formatWeekdayDay`), con el día de la semana y el día, sin hora, sin canal y sin año;
   - el chip de pago (`SalePaymentChip`), que recibe `methodName` = `payment_method?.name ?? null`. Una Sale paga con medio se lee "Paid · <medio>", y el resto de los estados se leen como en `payment-state.md`, "Payment can't be shown" incluido;
   - "Assign customer", solo cuando la Sale no tiene Customer. Queda deshabilitado mientras el Sale bill se vuelve a leer, es decir mientras corre una asignación o mientras se espera el Customer asignado (cambio aceptado por el dueño: un estado que el dibujo no muestra). No lleva texto de motivo.
4. **`SaleDetailCard`**, una región con nombre "Detail":
   - una fila (`listitem`) por Sale line, como "N × Product · precio", con la insignia de la Pricing rule cuando no es list y el total de la línea a la derecha;
   - la cantidad sale de centésimos enteros con `formatQuantity`, sin palabra de unidad;
   - el precio va en el Money format del Business, sin unidad ni "per gram". No hay dato de Unit hasta GH-318 (ADR-0056), así que se aplica la regla del dueño de ocultar lo que no tiene dato. No es una diferencia con el dibujo, que tampoco muestra unidad;
   - "Shipping charged" solo cuando es mayor que 0;
   - "Total" en `cifra-xl`. Hasta 340 px de ancho toma el tamaño de `cifra-l`, y por debajo de 300 px el de `cifra-m`, para que a 320 px con el texto al 130 % no ensanche la página;
   - la Note como párrafo sin etiqueta, solo cuando no está en blanco.
5. **Los avisos y los errores**: "Customer assigned", "Bill copied", sin conexión y el error de asignar, como antes.
6. **El bloque del Sale bill** (`SaleBillButton`, presentacional, con las props `share` y `hasBill`): un grupo con el nombre "Sharing the bill" (`sales:bill.actionsName`), nunca "Sale bill". Su única acción es Copy, con ícono y texto, que nunca ofrece Share. Detalle en `sale-bill.md`.
7. **La fila de Void**: igual que antes, última en la pantalla (ver `sales.md`, Void).

Ya no existen la línea de resumen (gramos · Customer · cómo se pagó), `summaryLine`, `paymentSummary`, la línea de gramos, el precio "per gram", la fecha dd/mm bajo el título ni el bloque del total arriba de las líneas.

### Estados

- **Cargando**: por ahora sigue el estado de carga compartido de antes, con el título vacío, `Loading` y el bloque con Copy deshabilitado y ocupado. Nada se puede tocar, y no aparece ningún dígito ni símbolo de moneda. El estado de carga con la forma de la pantalla cargada llega con #1265.
- **Una Sale que ya no existe** y los **errores de carga**: sin cambios (accounts.md).

### Diferencias con el dibujo aceptadas por el dueño (de #1116, publicadas el 2026-11-27)

1. No hay chip Delivered, porque no existe un estado de entrega.
2. No hay filas de promoción hasta que GH-318 agregue las applied promotions.
3. No hay Edit sale (#561), ni botones por canal, ni recibo en imagen (#1056). Quedan Share y Copy en texto plano.
4. Por ahora, en la computadora se ve la disposición del teléfono.
5. Solo la flecha de volver del marco, y la línea de fecha sin hora ni canal.

También aceptado: Assign customer deshabilitado mientras se vuelve a leer el Sale bill. Share aparece una sola vez.

## Pendiente

- Las Design captures en claro y en oscuro a 320, 375 y 430 px contra `VentaDetalle` y `VentaDetalleOscuro` no llegaron a la revisión. No se compararon la separación entre Copy y Void a 320 px, el relleno del Share redondo ni si la fila del título conserva su alto sin Share.
- #1265: el estado de carga con la forma de la pantalla cargada (`sales:detail.loading`), y comprobar que el paso "No customer" de `statesSales.ts` sigue cayendo en la tarjeta de la lista.
- #1264: borrar las reglas `.venta-detalle__*` muertas de `app.css` y los textos viejos (`SALES_TEXT.paid`, `leftOwing`, `perGram`, `lines` y, si quedan sin lector, `SALE_BILL_TEXT.share` y `copy`), sacar las dos entradas de las tarjetas de `web/scripts/docs/front-exclude.json` (ya están conectadas) y alinear `sales.md` con esta definición.
- Volver a tomar `VentaDetalle.webp`.

## Métricas

- **En un toque**: con un teléfono que puede compartir, desde una Sale abierta, el Sale bill sale hacia el Customer con un toque en el Share de la fila del título, sin desplazarse, desde 320 px de ancho.
- **Orden de lectura**: Sale #N, Customer, chip de pago, líneas, Total.
- **Nunca sin salida**: después de un Share fallido, el Share del título desaparece y Copy sigue a un toque. Si Copy falla, aparece el bloque seleccionable "Sale bill".
- Desde el teléfono, el detalle de una Sale se lee completo (Customer, fecha, Payment state, líneas, envío y total) sin scroll horizontal, con nombres de Product de 60 caracteres y montos de nueve dígitos. Solo el nombre se acorta y ninguna cifra se corta.
- El Payment state que muestra el detalle coincide siempre con el del Settlement y con el chip de la tarjeta en la lista de Sales. Cuando no se puede calcular dice "Payment can't be shown" y nunca adivina.
- Toda Sale without a customer muestra "No customer" y la acción "Assign customer". Ninguna Sale con Customer muestra un link en el nombre ni la acción de asignar.
- Ningún precio ni cantidad del detalle muestra una unidad, "per gram" ni un símbolo de moneda que no sea el del Money format del Business.
