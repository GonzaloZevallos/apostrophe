# Rediseño 2026-10-29: fuente de diseño

Capturas y dibujos fuente del diseño consolidado que armó el dueño el 29 de octubre de 2026 (épica #494). **Es el objetivo del desarrollo**: cada parte del rediseño se construye contra estas pantallas, en el teléfono y en la compu, en claro y en oscuro.

- Los dibujos fuente (`.dc.html`) están en `fuente/telefono/` y `fuente/compu/`, con el nombre que van a tener en `docs/product/design-system/pantallas/`. La versión oscura lleva el sufijo `Oscuro`.
- La issue de importación los copia a `pantallas/` y los suma a `scripts/design/screens.json`, para que la captura de diseño compare la app contra ellos.
- El dibujo es una guía, no un contrato (DESIGN_STANDARDS.md, "Drawing as guide"). Los datos son de ejemplo y no atan el producto a ningún rubro ("Assume nothing").
- Lienzos vivos: teléfono https://claude.ai/artifact/4yuwZQXGXeras6NPQhSKAx · compu https://claude.ai/artifact/NXrFg5gFPS3qRgiZhcgGhf · pedidos https://claude.ai/artifact/SX78hYQr72E6vJyDXKcprF

## Teléfono (390 px, capturas a 2×)

| Pantalla | Captura | Oscuro | Dibujo en pantallas/ | Issue |
|---|---|---|---|---|
| Hoy | 01-hoy.png | oscuro/01-hoy.png | Inicio.dc.html | #497 |
| Editar inicio | 02-editar-inicio.png | oscuro/02-editar-inicio.png | InicioEditar.dc.html | #327 |
| Sumar al tablero | 03-catalogo-de-widgets.png | oscuro/03-catalogo-de-widgets.png | WidgetCatalogo.dc.html | #321, #327 |
| Armar widget, paso 2 de 5 | 04-armar-widget-paso-2.png | oscuro/04-armar-widget-paso-2.png | WidgetPaso2.dc.html | #321 |
| Armar widget, paso 5 de 5 | 05-armar-widget-paso-5.png | oscuro/05-armar-widget-paso-5.png | WidgetPaso5.dc.html | #321 |
| Análisis | 06-analisis.png | oscuro/06-analisis.png | Analisis.dc.html | #321, #320 |
| Nueva venta | 07-nueva-venta.png | oscuro/07-nueva-venta.png | NuevaVenta.dc.html | #496 |
| Pedidos (lista por etapa) | 08-pedidos.png | oscuro/08-pedidos.png | Pedidos.dc.html | #500, #326 |
| Clientes · Te deben | 09-clientes-te-deben.png | oscuro/09-clientes-te-deben.png | Clientes.dc.html | #498 |
| Ficha de cliente | 10-ficha-de-cliente.png | oscuro/10-ficha-de-cliente.png | ClienteFicha.dc.html | #498 |
| Productos | 11-productos.png | oscuro/11-productos.png | Productos.dc.html | #499 |
| Ajustes (grupos) | 12-configuracion.png | oscuro/12-configuracion.png | Configuracion.dc.html | #499, #419 |
| Marca Yerba | 16-marca-yerba.png | oscuro/16-marca-yerba.png | Marca.dc.html | #493 |
| Detalle de venta y comprobante | 17-detalle-de-venta.png | oscuro/17-detalle-de-venta.png | VentaDetalle.dc.html | #376, #322, #519 |
| Anotar un pago | 18-registrar-pago.png | oscuro/18-registrar-pago.png | Cobro.dc.html | #498 |
| Ficha de producto | 19-ficha-de-producto.png | oscuro/19-ficha-de-producto.png | ProductoDetalle.dc.html | #499, #323, #522 |
| Nueva promoción | 20-nueva-promocion.png | oscuro/20-nueva-promocion.png | PromocionNueva.dc.html | #411, #412 |
| Stock | 21-stock.png | oscuro/21-stock.png | Stock.dc.html | #499 |
| Nuevo gasto | 22-nuevo-gasto.png | oscuro/22-nuevo-gasto.png | GastoNuevo.dc.html | #520 |
| Tienda en Telegram (cliente) | 23-tienda-telegram-cliente.png | oscuro/23-tienda-telegram-cliente.png | TiendaTelegram.dc.html | #325 |
| Configuración inicial | 24-configuracion-inicial.png | oscuro/24-configuracion-inicial.png | Onboarding.dc.html | #418, #329 |
| Ingreso | 25-ingreso.png | oscuro/25-ingreso.png | Entrar.dc.html | #521, #510 |
| Sumar al tablero · un tema | 26-sumar-al-tablero-tema.png | oscuro/26-sumar-al-tablero-tema.png | WidgetTema.dc.html | #327 |
| Ajustes · buscar | 27-ajustes-buscar.png | oscuro/27-ajustes-buscar.png | ConfiguracionBuscar.dc.html | #499 |
| Ajustes · Cobros y gastos | 28-ajustes-cobros-y-gastos.png | oscuro/28-ajustes-cobros-y-gastos.png | ConfiguracionCobros.dc.html | #499 |
| Pedidos · elegir vista | 29-pedidos-elegir-vista.png | oscuro/29-pedidos-elegir-vista.png | PedidosVista.dc.html | #500 |
| Detalle del pedido | 30-detalle-de-pedido.png | oscuro/30-detalle-de-pedido.png | PedidoDetalle.dc.html | #500, #326, #518 |
| Pedidos · armar una vista | 31-pedidos-armar-vista.png | oscuro/31-pedidos-armar-vista.png | PedidosArmarVista.dc.html | #500, #321 |
| Ajustes · Estados de pedido | 32-estados-de-pedido.png | oscuro/32-estados-de-pedido.png | ConfiguracionEstados.dc.html | #326 |
| Ajustes · Editar un paso | 33-estado-editar-paso.png | oscuro/33-estado-editar-paso.png | ConfiguracionEstadoPaso.dc.html | #326 |

## Compu (1440 px, capturas a 2×)

| Pantalla | Captura | Oscuro | Dibujo en pantallas/ | Issue |
|---|---|---|---|---|
| Hoy | compu/01-hoy.png | compu/oscuro/01-hoy.png | InicioCompu.dc.html | #497, #327 |
| Nueva venta (panel) | compu/02-nueva-venta.png | compu/oscuro/02-nueva-venta.png | NuevaVentaCompu.dc.html | #496 |
| Pedidos con panel de detalle | compu/03-pedidos.png | compu/oscuro/03-pedidos.png | PedidosCompu.dc.html | #500 |
| Clientes con ficha al costado | compu/04-clientes.png | compu/oscuro/04-clientes.png | ClientesCompu.dc.html | #498 |
| Productos (tabla) | compu/05-productos.png | compu/oscuro/05-productos.png | ProductosCompu.dc.html | #499 |
| Análisis | compu/06-analisis.png | compu/oscuro/06-analisis.png | AnalisisCompu.dc.html | #321 |
| Ajustes (grupos + página) | compu/07-ajustes.png | compu/oscuro/07-ajustes.png | ConfiguracionCompu.dc.html | #499, #419 |
| Ajustes · Estados de pedido | compu/08-estados-de-pedido.png | compu/oscuro/08-estados-de-pedido.png | ConfiguracionEstadosCompu.dc.html | #326 |

## Reglas que acompañan al dibujo

- Navegación: Hoy · Pedidos · (+ Vender) · Clientes · Productos; avatar arriba a la derecha en las 4 pestañas abre Ajustes; Hoy | Análisis en el mismo tablero (#495).
- Menús y tableros entran en una pantalla; una lista larga solo con buscador y filtros fijos; índice → detalle, nunca más de 9 filas por nivel (#494).
- Íconos Lucide con texto, salvo volver, cerrar, buscar, más, borrar y avatar (#494).
- Ajustes en dos niveles: 9 grupos por concepto, cada uno con su página corta (#499).
- Pedidos: lista por etapa, vista con un selector con buscador, vistas propias sobre el cubo, estados a medida en Ajustes (#500, #326, #321).
- Aspecto nativo: nada debajo de la barra de estado, la cámara o el indicador de inicio (safe areas, #495, #319).
- Modo oscuro: ningún control con el fondo blanco del navegador (#509).
