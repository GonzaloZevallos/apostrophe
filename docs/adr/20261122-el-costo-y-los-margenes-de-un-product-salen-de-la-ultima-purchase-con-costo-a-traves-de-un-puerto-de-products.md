---
status: accepted
date: 2026-11-22
summary: "el margen por precio de un Product sale de su última Purchase con costo, leída por un puerto de products que implementa stock; es un costo de reposición (no el orden de los Lots ni el Cost of goods sold), va en la unidad de los decimales del Business, filtra total_cost > 0 y quantity > 0 al leer, comparte el redondeo en app/shared/ratio.py y no guarda nada"
---

# El costo y los márgenes de un Product salen de la última Purchase con costo

Parte 2 de 2 de GH-968, dentro de GH-522. Expone en `GET /api/products/{id}` lo que la parte anterior (GH-972) dejó construido: el caso de uso `cost_and_margins_of`, el puerto `LatestCostedPurchase` y `app/shared/ratio.py`.

## Contexto

Quien vende no veía cuánto le costó su última Purchase de un Product ni qué margen deja cada precio vigente. El costo vive en las entradas de stock, que pertenecen a `app.stock`; `app/products/` no debe importarlo (CODING_STANDARDS, sección 1).

## Decisión

- **De dónde sale.** El margen por precio (list, bulk y vip, en ese orden) se calcula con la última Purchase con costo del Product, leída a través del puerto `LatestCostedPurchase` que declara products. Lo implementa `SqlLatestCostedPurchase` en `app/stock/adapters/latest_costed_purchase.py`, y `app/main.py` lo cuelga de `app.state.products_latest_costed_purchase` como una fábrica `(Session, business_id)`. El router de products lo lee con un `cast`, igual que `get_leaving`.
- **Qué es.** Un costo de reposición: lo que cuesta comprar más ahora. No es el orden de los Lots ni el Cost of goods sold, y no cambia Profit, Margin ni ninguna cifra de Home o Analysis. Las respuestas de `/analysis` y `/panel` quedan idénticas byte a byte.
- **Unidad del monto.** `amount` va en la unidad de los decimales del Business, redondeado half up con la regla compartida, y se envía en unidades de moneda (ADR-0058). El porcentaje sale del costo exacto, no del redondeado, así que es el mismo con 0 y con 2 decimales.
- **Filtros al leer.** Se filtran `total_cost > 0` y `quantity > 0` al leer, sobre el monto escalado con `scaled` (la verificación de adaptadores de dinero no admite la columna guardada fuera de `scaled`, y escalar conserva el NULL y el signo) y sobre `grams_hundredths`; una Purchase sin costo o con cantidad cero nunca fija el costo. Solo cuentan las Purchases fechadas hasta hoy, la más reciente por fecha, luego por orden de registro (`recorded_at`) y por `id`. Una Harvest, un Opening stock o un Adjustment nunca lo fijan.
- **Redondeo compartido.** El redondeo half up de la razón vive en `app/shared/ratio.py`, y el adaptador no divide ni redondea: el cálculo está solo en el caso de uso y su dominio.
- **Nada se guarda.** El costo y los márgenes se calculan en cada lectura. Cambiar o borrar la Purchase, mover el reloj, cambiar los decimales o un switch se refleja en la lectura siguiente.
- **Contrato.** Solo `ProductDetailOut` gana `cost`: `null` para un Product Archived y `{amount: null, margins: []}` mientras el costo está pendiente. El cambio es aditivo y `GET /api/products` no cambia.
- **El precio VIP.** Llega al caso de uso solo por los precios del tipo VIP (`SqlVipTypePrices.prices_of`), y `test_frozen_columns` impide leer o escribir `PriceEntryRow.vip_price`. Un tipo llamado «VIP» creado por la API no da margen vip: solo cuenta el tipo VIP de la mejora o de la importación.
- **Una arista que ya existía.** `app/products/adapters/sql_products.py` lee las tablas de stock para el historial de un Product. Queda fijada por `tests/architecture/test_products_stock_direction.py`, que prohíbe cualquier otra, y queda pendiente convertirla en un puerto que implemente stock.

## Consecuencias

- Cada lectura del detalle suma un select con `LIMIT 1`, filtrado por Business.
- El aislamiento entre Businesses lo da el filtro por `business_id` de la sesión; una prueba con dos Businesses lo fija.
