## Jobs

**Cuando** entregué una venta, o un cliente me pregunta cuánto me debe, **quiero** mandarle las líneas de esa venta, el total, cómo se pagó y cómo está su cuenta, sacados de la venta que ya registré, **para** compartirlo sin volver a tipear ni equivocarme en las cuentas.

**Cuando** registré una venta, o un cliente me pregunta después qué se llevó o cuánto me debe, **quiero** mandarle en un toque el comprobante de esa venta en texto plano y corto (sus líneas, el envío, el total, cómo pagó, lo que todavía debe de esa venta y su saldo de ahora), **para** contestarle en nuestro chat sin volver a tipear ni sacar cuentas, y que el cliente vea los mismos números que veo yo. (La historia dice "el chat" y no nombra ningún canal, por Assume nothing; está también en `sales.md`).

El avance principal es que el cliente vea exactamente las cifras que ve la vendedora, para que nadie discuta el monto. La velocidad viene después. Recordarles a los deudores no es un trabajo propio: un comprobante puede llevar un saldo debido, pero el producto no manda recordatorios, no programa nada y no escribe ningún texto que presione para pagar. Antes de esto la vendedora copiaba las cifras a mano en Telegram o WhatsApp, sobre todo para deudores y pedidos entregados. Los clientes también piden una confirmación de una venta pagada en el momento, así que toda venta tiene comprobante.

# Comprobante de venta (Sale bill)

Los hechos de una venta registrada que la vendedora puede compartir con el cliente de esa venta. Se calculan en vivo a partir de la imputación cuando se lee el detalle de la venta, y nunca se guardan ni se loguean. El servidor manda solo hechos, en una estructura cerrada y sin texto, y el front arma el texto para compartir (ADR-0053). La venta y sus líneas están definidas en `sales.md`; la imputación, los pagos y los saldos, en `payments.md`. La parte 1 de GH-322 entregó los hechos; la parte 2 (GH-376) entregó el texto, la entrada de unidad y las acciones Share y Copy en el detalle de la venta. El texto exacto, sus líneas que pueden faltar y el botón están en `sales.md`, "Comprobante de venta (en el detalle de la venta)".

## Comportamiento

`GET /sales/{sale_id}` responde un campo `bill`, con un comprobante o null. La lista de ventas no lo trae.

### Cifras en vivo

- El estado de pago, lo que todavía se debe y el saldo se leen cuando se lee el detalle. Salen de la misma única pasada de imputación (`OwingSales.settlement_of`) que el "still owing" del detalle.
- El saldo es la cuenta entera actual del cliente, nunca el saldo en la fecha de la venta.
- Una venta que se debía la semana pasada y se pagó después hoy se lee "paid".
- Nada en ventas ni en el front vuelve a calcular la imputación.

### Contenido

- **Nombre del negocio**: siempre el nombre actual del negocio de la sesión, así que un cambio de nombre se ve en la siguiente lectura.
- **Fecha**: la fecha propia de la venta.
- **Envío cobrado**: aparte de las líneas.
- **Total**: el total de la venta, envío incluido.
- **Líneas**: en el orden en que se registraron. Cada línea tiene el nombre de la variedad, su cantidad (al centésimo, como se registró) y su monto.
  - Una línea por cantidad agrega su precio unitario y la regla "bulk".
  - Una línea de regalo lleva la regla "gift" y un monto de $0.
  - Las líneas de lista, VIP y precio especial llevan solo el monto, sin regla ni precio unitario.
  - Una variedad archivada conserva su nombre tal cual.
- **Estado de pago**: gana el primer chequeo que encaja.
  1. Total $0 (solo regalos): none.
  2. Pagada en el momento: cash o transfer, según el medio registrado. Si la imputación igual informa algo debido para ella, la venta es inconsistente.
  3. Sin cliente y nada de lo anterior: inconsistente.
  4. Algo todavía debido: owed, con lo que todavía se debe.
  5. Nada debido (saldada por un pago posterior o un crédito): paid.
  6. Una venta de un cliente por encima de $0, no pagada en el momento y ausente de la imputación: inconsistente.
- **Lo que todavía se debe**: solo cuando el estado es owed.
- **Saldo**:
  - Ninguno cuando la venta no tiene cliente o el saldo es exactamente $0.
  - Si no, con signo. Un crédito es negativo ("In your favor").
  - También aparece en ventas en efectivo, por transferencia y de $0 cuando el cliente debe por otro lado o tiene un crédito.
- **Forma cerrada**: nombre del negocio, fecha, envío cobrado, total, líneas (producto, cantidad, monto, regla, precio unitario), pago (estado, lo que todavía se debe) y saldo. Nada más puede aparecer.

### Alcance

- Toda venta tiene comprobante, sea cual sea su antigüedad o su estado.
- Una venta sin cliente lo tiene cuando se pagó en el momento o es una venta de $0 solo de regalos, y nunca lleva saldo.
- Un cliente asignado después la convierte en una venta común de cliente, saldo incluido. Después de asignar, el detalle se vuelve a leer del servidor para traer ese saldo.
- La venta de otro negocio sigue respondiendo 404.
- No hay configuración ni fecha de corte. Nada depende de las unidades, la moneda o los medios de pago de un negocio: el comprobante informa el medio que registró la venta. Los medios de pago configurables son de #330 y #318.

### Cuando los hechos no coinciden

- En los casos inconsistentes (2, 3 y 6 de arriba), `bill` es null.
- El resto del detalle responde 200 sin cambios, sin error y sin aviso.
- Un comprobante nunca sale equivocado ni a medias.
- El error nombra solo la regla incumplida, nunca una venta, un cliente, un monto ni un nombre. No se loguea nada.
- En pantalla, el botón Share/Copy no aparece para esa venta y el resto del detalle se ve igual.

### El texto y las acciones (en el detalle de la venta)

- **El texto** lo arma el front a partir del último detalle que tiene la pantalla, con `renderSaleBill` (`web/src/sales/saleBill.ts`): el encabezado (nombre del negocio y dd/mm, sin año), una línea por línea de la venta, el envío solo por encima de $0, el total, la línea de pago (ninguna para none) y la línea de saldo ("Your balance" por encima de $0, "In your favor" para un crédito como su valor absoluto, ninguna en $0 o sin cliente). El detalle está en `sales.md`.
- **Las cantidades** se formatean a partir de centésimos enteros con `formatQuantity`, nunca de un float. La plata se lee `$ 11.000`, nunca con el formato del catálogo.
- **Las palabras fijas y la unidad** viven en el módulo de textos, en el grupo `saleBill`. La unidad es una sola entrada, "g", hasta #318.
- **Los nombres que tipeó la vendedora** (el del negocio y los de las variedades) salen exactamente como están guardados; el comprobante no agrega formato propio.
- **El botón** Share o Copy es el primer elemento de la fila de acciones del detalle, nunca dentro del aviso "Sale saved". Si compartir sale bien o se cancela, no muestra nada. Si compartir falla, muestra su línea con el ícono de atención y la etiqueta pasa a Copy. Si copiar sale bien, muestra el aviso "Bill copied". Si copiar falla, muestra su línea con el ícono de atención y debajo el bloque seleccionable "Sale bill". Con `bill: null` el botón no aparece. Mientras carga, conserva la etiqueta, queda deshabilitado y ocupado, y no muestra cifras.

### Lo que el comprobante nunca lleva

La nota, el nombre o el id del cliente, el id de la venta o de cualquier línea, la marca VIP, ninguna regla de precio que no sea bulk o gift, costo, costo pendiente ni margen, ningún link, ni nada de otro cliente u otro negocio.

### Invariantes

1. El estado de pago, lo que todavía se debe y el saldo salen de la única pasada de imputación, en la misma respuesta que el "still owing" del detalle.
2. La forma del comprobante es cerrada. El negocio sale solo del negocio actual de la sesión.
3. Si no se puede calcular un comprobante, queda null y nunca hace fallar el resto del detalle.
4. Ninguna palabra fija del comprobante es un literal fuera del módulo de textos. La unidad se lee de su única entrada con clave, y ningún módulo del comprobante tiene un literal "g" ni llama a `formatGrams`.
5. Una cantidad del comprobante se formatea a partir de centésimos enteros, nunca de un float.
6. Los textos esperados del comprobante se escriben a mano contra esta definición, nunca los genera el renderizador.
7. Nada del comprobante se guarda, se loguea, ni se escribe en la consola o en el almacenamiento del navegador. La llamada de compartir o copiar corre de forma sincrónica dentro del clic (ADR-0002).

### Fuera de alcance

Recordatorios o textos que presionen para pagar, tomar pedidos o mandar mensajes por un bot, facturas, impuestos y exportaciones contables, medios de pago configurables, un año en la fecha, una vista previa, un estado de "ya compartido", un recibo de pago, elegir un canal o enviar desde la app, hacer configurable la unidad (#318) y cualquier otro idioma (#317).

## Criterios de éxito y métricas

1. **Alcance**: en el teléfono, desde el detalle de una venta registrada, compartir o copiar está a un toque, sin tipear (criterio 20 de `sales.md`).
2. **Mismas cifras**: cada cifra del comprobante es igual a lo que muestran en el mismo momento el detalle de la venta y el saldo del cliente: total, estado de pago, lo que todavía se debe y el saldo (un crédito cuenta). Se mide con:
   - cada fila de la tabla de estados coincidiendo entre el test puro de dominio y el test de API con imputación real;
   - una sola lectura de imputación por pedido de detalle, y ninguna para una venta sin cliente;
   - el juego de referencia `saleBill.cases.json`, con textos escritos a mano, en 0 diferencias.

   Si los hechos no coinciden, no hay comprobante.
3. **Nada interno**: el test de filtraciones (una venta con nota, un cliente VIP, líneas especiales y VIP, y costo pendiente) encuentra exactamente la forma cerrada y ni la nota, ni el nombre o id del cliente, ni el id de la venta, ni "vip", "special" o "list". En el texto tampoco aparecen "http", `*`, `_` ni comillas invertidas propias. La venta de otro negocio sigue en 404.
4. **Nada guardado**: nada del comprobante se guarda ni se loguea. Una inconsistencia forzada responde 200 con `bill` null y todos los demás campos sin cambios.
5. **Contrato cumplido**: un vitest lee los esquemas `SaleBillOut` de `tests/fixtures/openapi_snapshot.json` y verifica que sus nombres de propiedad y sus enums son iguales a las listas de claves del front.
6. **Assume nothing**: con la entrada de unidad puesta en "u", el texto dice "3,5 u" y "/u".
