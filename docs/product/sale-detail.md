# Detalle de una Sale

## Jobs

- Cuando abro una Sale que registré, quiero ver de un vistazo quién la compró, cuándo, si está paga y qué se debe todavía, y exactamente qué Products, cantidades, precios y total tuvo, para poder contestarle al Customer, compartirle la Sale o asignarle el Customer que le faltaba, sin abrir nada más.

## Qué muestra

El detalle de una Sale muestra a quién se le vendió, la fecha, el Payment state, cada Sale line, el Shipping charged cuando lo hay, el total y la Note. Desde ahí se comparte el Sale bill con Share o Copy. Una Sale without a customer ofrece asignarle un Customer, una sola vez.

El detalle no ofrece cobrar. Record payment se abre con "Collect" desde una fila de deudor de Customers o de Home, o desde la ficha del Customer, nunca desde una Sale.

## Planned in GH-1116 (todavía no se ve en pantalla)

GH-1116 rediseña el detalle según los dibujos `VentaDetalle.dc.html` y `VentaDetalleOscuro.dc.html`, en dos partes.

### Parte 1: las tarjetas de presentación

Se agregan dos componentes en `web/src/screens/ventas/`. No piden datos, leen todo texto con `t()` y usan solo tokens de diseño. Ninguna pantalla los usa todavía: figuran en `web/scripts/docs/front-exclude.json` (D-62e6dc23) hasta que la parte 2 los conecte.

**`SaleCustomerCard`**, de arriba hacia abajo:
- El avatar con las iniciales del Customer. Sin Customer, muestra el ícono de persona dentro del mismo círculo. Los dos son decorativos (aria-hidden).
- El nombre como texto plano, nunca un link. Sin Customer dice "No customer".
- Una línea apagada con la fecha, exactamente la que da `formatWeekdayDay(date, language)`: sin hora, sin canal y sin año agregado.
- El chip de pago (`SalePaymentChip`), que muestra el Payment state tal como lo recibe y nunca lo recalcula: Paid (con el Payment method cuando lo hay), Part-paid con lo que se debe, Unpaid, o "Payment can't be shown".
- Un botón secundario "Assign customer", solo cuando no hay Customer y la pantalla ofrece asignar. Se muestra deshabilitado cuando la pantalla dice que ahora no se puede, sin texto de motivo en esta parte.

**`SaleDetailCard`**: una sección con el título "Detail".
- Una fila por Sale line, separadas por líneas finas. Cada fila lleva "N ×" con la cantidad, el nombre del Product, "· precio" en el Money format del Business (sin unidad ni "per gram"), la insignia de la Pricing rule y el total de la línea a la derecha.
- La insignia aparece en toda regla salvo list (bulk, Customer type con su nombre guardado, VIP de las líneas viejas, gift y special).
- Todas las líneas tienen la misma forma, Gifts y Special prices incluidos. Muestran el precio y el total que se registraron, nunca recalculados.
- "Shipping charged" solo cuando es mayor que 0. Después, "Total" en cifra grande.
- La Note como párrafo sin etiqueta, solo cuando no está en blanco.
- Cada cifra es un solo elemento que nunca se corta ni se parte en dos líneas, con el símbolo del Money format y sus dígitos. Solo el nombre del Product puede acortarse con puntos suspensivos, aun con nombres de 60 caracteres y montos de nueve dígitos.

### Parte 2: la pantalla conectada (pendiente)

- Reemplaza el detalle actual por las dos tarjetas y quita sus entradas de `front-exclude.json`.
- Conserva el Sale bill con Share / Copy.
- Decide por qué se deshabilita Assign customer y si hace falta un motivo en palabras al lado.
- No agrega una acción Collect.

## Métricas

- Desde el teléfono, el detalle de una Sale se lee completo (Customer, fecha, Payment state, líneas, envío y total) sin scroll horizontal, con nombres de Product de 60 caracteres y montos de nueve dígitos. Solo el nombre se acorta y ninguna cifra se corta.
- El Payment state que muestra el detalle coincide siempre con el del Settlement y con el chip de la tarjeta en la lista de Sales. Cuando no se puede calcular dice "Payment can't be shown" y nunca adivina.
- Toda Sale without a customer muestra "No customer" y la acción "Assign customer". Ninguna Sale con Customer muestra un link en el nombre ni la acción de asignar.
- Ningún precio del detalle muestra una unidad, "per gram" ni un símbolo de moneda que no sea el del Money format del Business.
