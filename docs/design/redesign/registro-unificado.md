# Registro unificado: una sola forma de anotar

Aprobado por el dueño el 2026-11-02. Completa el rediseño del 2026-10-29 (épica #494) y reemplaza la salida
de gastos y retiros que vivía en "Más". Los dibujos de `fuente/telefono/` son contrato al píxel: cualquier
desvío se consulta antes de construir.

## La regla

Todo lo que se anota tiene **su lugar** junto a lo que cambia. Lo frecuente tiene además un **atajo**:
el + abre Nueva venta, y al pie de esa hoja la fila **"Otras cosas para anotar"** ofrece Gasto,
Le pagaron, Entró mercadería y Sacaste mercadería. Así cualquier carga frecuente queda a 2 toques.
Todas las hojas de carga tienen la forma de Nuevo gasto: radio 22 arriba, agarradera, cerrar de 44 px,
botón principal de 54 px.

## Dónde se anota cada cosa

| Qué anotás | Atajo | Su lugar |
|---|---|---|
| Venta | + (1 toque) | Hoy → Vendiste hoy → Ventas |
| Fecha, nota, envío, regalo, precio especial | Nueva venta → Más datos | — |
| Gasto | Nueva venta → Otras cosas para anotar → Gasto | Hoy → Análisis → Gastos → Anotar gasto |
| Ver, editar y borrar gastos | — | Análisis → tarjeta Gastos → Ver los gastos → fila |
| Le pagaron (pago de un cliente) | Nueva venta → Le pagaron → elegir cliente | Clientes → Le pagaron en la fila (2 toques) · Ficha → Le pagaron |
| Borrar un pago | — | Ficha del cliente → tocar el pago → Borrar este pago |
| Entró mercadería | Nueva venta → Entró mercadería | Productos → Stock → Entró mercadería · Hoy → Por reponer |
| Sacaste mercadería | Nueva venta → Sacaste mercadería | Productos → Stock → Sacaste mercadería |
| Editar y borrar movimientos de stock | — | Productos → Stock → Ver todos los movimientos → fila |
| Pedido nuevo (a mano) | — | Pedidos → + Nuevo → Nuevo pedido |
| Cliente nuevo | Nueva venta → elegir cliente → Agregar | Clientes → + |
| Producto nuevo | — | Productos → + Producto |
| Cambiar precio | — | Producto → Precios de hoy → Cambiar precio |
| Archivar, restaurar, eliminar producto | — | Producto → ⋯ → Archivar · Catálogo → Archivadas |
| Promoción | — | Productos → Promos → Nueva promoción |
| Editar venta (se construye) | — | Venta → Editar venta · Anular · Asignar cliente |
| Ajustes, categorías de gasto, socios | — | Avatar → Ajustes |

## Decisiones del dueño

- **El + no tiene texto.** Su nombre accesible es "Vender", con la descripción "También para anotar un gasto,
  un pago de un cliente, mercadería que entró o que sacaste". Abre una hoja (`aria-haspopup="dialog"`), no un menú.
  No hay pulsación larga ni tercer segmento en Hoy | Análisis.
- **Los gastos viven en Análisis:** tarjeta Gastos con "Anotar gasto" y "Ver los gastos" (lista con editar y borrar).
- **"Le pagaron"** es el único verbo para el pago de un cliente: atajo, fila de Clientes, ficha y título de la hoja.
  Reemplaza "Cobrar" y "Anotar un pago".
- **"Entró mercadería" y "Sacaste mercadería"** nombran las cargas de stock en el atajo, las hojas y Productos → Stock.
  Reemplazan "Cargar entrada" y "Registrar retiro". El motivo "Marketing" pasa a "Regalo o muestra".
- **No se saca plata de la caja:** no hay retiro de dinero de socios.
- **Pedidos "+ Nuevo"** crea un pedido a mano: cliente, productos, entrega, cuándo y pago (PedidoNuevo).
- **"Editar venta" se queda y se construye**, lo que requiere un endpoint nuevo en el servidor (hoy solo hay
  anular y `PUT /sales/{id}/customer`).
- **Se sacan los avisos de primer uso** (lista de primeros pasos y aviso después de importar). No habrá
  importación de planilla al empezar.
- **Venta en curso:** si se abre otra carga con productos elegidos, la hoja muestra "Venta en curso · Volver"
  y al guardar vuelve la venta con sus productos (VentaEnCurso, VentaVuelve).
- **Tamaños aprobados:** el segmento Catálogo | Stock | Promos pasa a 36 px como Hoy | Análisis; "‹ Clientes"
  en la ficha suma un área de toque de 44 px sin cambiar cómo se ve; el ticket promedio dice
  "Ticket promedio $7.800 · cada 9 días"; la cruz y los chips de Nuevo gasto y del pago pasan a 44 px.

## Archivos

Fuente en `fuente/telefono/`, con el nombre que tendrán en `docs/product/design-system/pantallas/`.

| Archivo | Estado | Qué es |
|---|---|---|
| Inicio.dc.html | reemplaza | Hoy con el + sin texto |
| InicioOscuro.dc.html | reemplaza | Hoy oscuro con el + sin texto |
| Analisis.dc.html | reemplaza | Análisis con la tarjeta Gastos y "Anotar gasto" |
| Gastos.dc.html | reemplaza | Lista de gastos del mes dentro de Análisis, con editar y borrar |
| GastoNuevo.dc.html | reemplaza | Nuevo gasto con cerrar y chips de 44 px |
| NuevaVenta.dc.html | reemplaza | Nueva venta con "Más datos" y "Otras cosas para anotar" |
| Cobro.dc.html | reemplaza | Hoja "Le pagaron" (antes "Anotar un pago"), 44 px |
| CobroElegirCliente.dc.html | nuevo | "Le pagaron" desde Nueva venta: primero el cliente |
| Clientes.dc.html | reemplaza | Clientes con "Le pagaron" en cada fila |
| ClienteFicha.dc.html | reemplaza | Ficha con "Le pagaron", volver de 44 px y ticket corto |
| ClienteFichaPago.dc.html | nuevo | Tocar un pago en la ficha: "Borrar este pago" |
| Stock.dc.html | reemplaza | Productos → Stock con los botones renombrados y "Ver todos los movimientos" |
| EntradaStock.dc.html | reemplaza | Hoja "Entró mercadería" |
| RetiroStock.dc.html | nuevo | Hoja "Sacaste mercadería" |
| PedidoNuevo.dc.html | nuevo | Hoja "Nuevo pedido" |
| VentaEnCurso.dc.html | nuevo | Otra carga abierta con una venta en curso |
| VentaVuelve.dc.html | nuevo | Al guardar vuelve la venta |

`registro-unificado-mapa.dc.html` es el mapa de arriba como dibujo; no es una pantalla.

Sin dibujo nuevo todavía: las versiones oscuras y de compu de estas pantallas (salvo InicioOscuro), y el
registro de `scripts/design/screens.json` (sigue nombrando Mas y MasOscuro, que desaparecen).
