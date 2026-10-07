# Muestra · La Huerta

Una sola captura de la app de muestra (`scripts/design/sample-app.sh`, ADR-0040), para que
Inicio, Clientes, Variedades y Análisis coincidan entre sí por construcción. Cada pantalla que
dibuja una cifra de La Huerta usa los valores de acá, no otros.

Las cifras se generan a una fecha fija, la que dice la línea `Capturada:`, con
`scripts/design/capture_muestra.py`, que lee cada valor de las respuestas de la API y sólo les
da formato. Este archivo se regenera con ese script, nunca se edita a mano: un test
(`tests/design/test_muestra_seed.py`) compara las tablas con lo que el script imprime, byte
por byte.

## Cifras capturadas

Capturada: 2026-10-07

### Variedades

| Variedad | Gramos | Estado | Detalle | Días restantes | Precio hoy |
| --- | --- | --- | --- | --- | --- |
| 24K Gold | 133 g | ok | Al ritmo de los últimos 30 días | 266 días | $ 12.000 x g |
| Golden Cookies | 11 g | baja | Avisás abajo de 20 g | 11 días | $ 14.000 x g |
| Sir Jack | −1 g | agotada | Sin gramos desde el 07/10 | — | $ 11.000 x g |
| Mango Bomb | 0 g | sin entradas | Cargale la primera entrada | — | $ 15.000 x g |

### Movimientos

| Variedad | Fecha | Tipo | Gramos |
| --- | --- | --- | --- |
| 24K Gold | 07/10 | Ajuste | −2 g |
| 24K Gold | 07/10 | Compra | 30 g |
| 24K Gold | 28/08 | Compra | 120 g |
| Golden Cookies | 07/10 | Consumo propio | −2 g |
| Golden Cookies | 07/10 | Promoción | −3 g |
| Golden Cookies | 05/10 | Promoción | −2 g |
| Sir Jack | 07/10 | Consumo propio | −1 g |
| Sir Jack | 28/08 | Cosecha | 10 g |

### Clientes

| Cliente | Saldo | Desde | Estado |
| --- | --- | --- | --- |
| Lu Fernández | $ 0 | — | al día |
| Mica Solano (VIP) | $ 0 | — | al día |
| Nico Parra | $ 20.000 | 18/09 | debe |
| Tincho Aguirre | $ 12.000 | 06/10 | debe |

### Te deben

Total: $ 32.000
2 ventas debiendo

| Cliente | Saldo | Desde |
| --- | --- | --- |
| Nico Parra | $ 20.000 | 18/09 |
| Tincho Aguirre | $ 12.000 | 06/10 |

### Periodos

| Período | Rango | Etiqueta | Valor | Pendiente |
| --- | --- | --- | --- | --- |
| Hoy | Hoy 07/10 | Vendiste | $ 194.000 | no |
| Hoy | Hoy 07/10 | Ventas | 3 | no |
| Hoy | Hoy 07/10 | Promedio | $ 64.667 | no |
| Hoy | Hoy 07/10 | Gramos vendidos | 17 g | no |
| Semana | 05/10 – 11/10 | Vendiste | $ 206.000 | no |
| Semana | 05/10 – 11/10 | Ventas | 4 | no |
| Semana | 05/10 – 11/10 | Promedio | $ 51.500 | no |
| Semana | 05/10 – 11/10 | Gramos vendidos | 18 g | no |
| Semana | 05/10 – 11/10 | Regalaste | 1 g | no |
| Semana | 05/10 – 11/10 | Costo de lo vendido | $ 93.000 | no |
| Semana | 05/10 – 11/10 | Faltante de stock | $ 10.000 | no |
| Semana | 05/10 – 11/10 | Promoción | $ 35.000 | no |
| Semana | 05/10 – 11/10 | Consumo propio | $ 14.000 | sí |
| Semana | 05/10 – 11/10 | Gastos | $ 12.500 | no |
| Semana | 05/10 – 11/10 | Compras de flores | $ 150.000 | no |
| Semana | 05/10 – 11/10 | Ganancia | $ 41.500 | sí |
| Semana | 05/10 – 11/10 | Caja | $ 36.500 | no |
| Mes | 01/10 – 31/10 | Vendiste | $ 369.000 | no |
| Mes | 01/10 – 31/10 | Ventas | 6 | no |
| Mes | 01/10 – 31/10 | Promedio | $ 61.500 | no |
| Mes | 01/10 – 31/10 | Gramos vendidos | 32 g | no |
| Mes | 01/10 – 31/10 | Regalaste | 1 g | no |
| Mes | 01/10 – 31/10 | Costo de lo vendido | $ 156.000 | no |
| Mes | 01/10 – 31/10 | Faltante de stock | $ 10.000 | no |
| Mes | 01/10 – 31/10 | Promoción | $ 35.000 | no |
| Mes | 01/10 – 31/10 | Consumo propio | $ 14.000 | sí |
| Mes | 01/10 – 31/10 | Gastos | $ 12.500 | no |
| Mes | 01/10 – 31/10 | Compras de flores | $ 150.000 | no |
| Mes | 01/10 – 31/10 | Ganancia | $ 141.500 | sí |
| Mes | 01/10 – 31/10 | Caja | $ 199.500 | no |

### Ventas

| Fecha | Cliente | Total | Te debe | Cómo se pagó |
| --- | --- | --- | --- | --- |
| 07/10 | Lu Fernández | $ 28.000 | no | Efectivo |
| 07/10 | — | $ 36.000 | no | Efectivo |
| 07/10 | Mica Solano | $ 130.000 | no | Transferencia |
| 06/10 | Tincho Aguirre | $ 12.000 | sí | Debiendo |
| 04/10 | — | $ 108.000 | no | Efectivo |
| 02/10 | — | $ 55.000 | no | Efectivo |
| 27/09 | Lu Fernández | $ 33.000 | no | Transferencia |
| 25/09 | Tincho Aguirre | $ 96.000 | no | Efectivo |
| 18/09 | Nico Parra | $ 14.000 | no | Efectivo |
| 18/09 | Nico Parra | $ 25.000 | sí | Debiendo |

### Líneas de venta

| Venta | Variedad | Gramos | Precio x g | Regla | Total |
| --- | --- | --- | --- | --- | --- |
| 07/10 · Lu Fernández · $ 28.000 | Golden Cookies | 2 g | $ 14.000 x g | Lista | $ 28.000 |
| 07/10 · — · $ 36.000 | 24K Gold | 3 g | $ 12.000 x g | Lista | $ 36.000 |
| 07/10 · Mica Solano · $ 130.000 | 24K Gold | 10 g | $ 10.000 x g | VIP | $ 100.000 |
| 07/10 · Mica Solano · $ 130.000 | Golden Cookies | 2 g | $ 12.000 x g | VIP | $ 24.000 |
| 07/10 · Mica Solano · $ 130.000 | Sir Jack | 1 g | $ 0 x g | Regalo | $ 0 |
| 06/10 · Tincho Aguirre · $ 12.000 | Sir Jack | 1 g | $ 11.000 x g | Lista | $ 11.000 |
| 04/10 · — · $ 108.000 | Golden Cookies | 9 g | $ 12.000 x g | Por mayor | $ 108.000 |
| 02/10 · — · $ 55.000 | Sir Jack | 5 g | $ 11.000 x g | Lista | $ 55.000 |
| 27/09 · Lu Fernández · $ 33.000 | Sir Jack | 3 g | $ 11.000 x g | Lista | $ 33.000 |
| 25/09 · Tincho Aguirre · $ 96.000 | Golden Cookies | 8 g | $ 12.000 x g | Por mayor | $ 96.000 |
| 18/09 · Nico Parra · $ 14.000 | Golden Cookies | 1 g | $ 14.000 x g | Lista | $ 14.000 |
| 18/09 · Nico Parra · $ 25.000 | 24K Gold | 2 g | $ 12.000 x g | Lista | $ 24.000 |

### Cuentas

| Cliente | Fecha | Concepto | Monto | Detalle | Saldo |
| --- | --- | --- | --- | --- | --- |
| Lu Fernández | 27/09 | Venta | $ 33.000 | Transferencia | $ 0 |
| Lu Fernández | 07/10 | Venta | $ 28.000 | Efectivo | $ 0 |
| Mica Solano | 07/10 | Venta | $ 130.000 | Transferencia | $ 0 |
| Nico Parra | 18/09 | Venta | $ 25.000 | Debiendo | $ 25.000 |
| Nico Parra | 18/09 | Venta | $ 14.000 | Efectivo | $ 25.000 |
| Nico Parra | 05/10 | Pago | $ 5.000 | Efectivo, a la venta del 18/09 | $ 20.000 |
| Tincho Aguirre | 25/09 | Venta | $ 96.000 | Efectivo | $ 0 |
| Tincho Aguirre | 06/10 | Venta | $ 12.000 | Debiendo | $ 12.000 |

### Análisis · Octubre 2026

| Etiqueta | Valor | Pendiente |
| --- | --- | --- |
| Vendiste en el mes | $ 369.000 | no |
| Gramos vendidos | 32 g | no |
| Regalados | 1 g | no |
| Margen promedio | 57% | no |
| Faltante de stock | $ 10.000 | no |
| Promoción | $ 35.000 | no |
| Consumo propio | $ 14.000 | y 1 g sin costo |

### Análisis · variedades del mes

| Variedad | Ventas | Gramos vendidos | Regalados | Costo | Margen | Margen % | Sin costo | % del mes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 24K Gold | $ 136.000 | 13 g | 0 g | $ 65.000 | $ 71.000 | 52% | no | 38% |
| Golden Cookies | $ 160.000 | 13 g | 0 g | $ 91.000 | $ 69.000 | 43% | no | 44% |
| Sir Jack | $ 66.000 | 6 g | 1 g | $ 0 | $ 66.000 | 100% | no | 18% |

### Análisis · gastos del mes

| Categoría | Total |
| --- | --- |
| Envíos | $ 4.500 |
| Packaging | $ 8.000 |
| Total gastos | $ 12.500 |
| Compras de flores | $ 150.000 |

### Análisis · gastos desde el primer registro

| Categoría | Total |
| --- | --- |
| Envíos | $ 4.500 |
| Packaging | $ 8.000 |
| Total gastos | $ 12.500 |
| Compras de flores | $ 1.030.000 |

### Análisis · semanas

| Período | Rango | Etiqueta | Valor | Pendiente |
| --- | --- | --- | --- | --- |
| Semana | 24/08 – 30/08 | Ventas | $ 0 | no |
| Semana | 24/08 – 30/08 | Gramos | 0 g | no |
| Semana | 24/08 – 30/08 | Gastos | $ 0 | no |
| Semana | 24/08 – 30/08 | Ganancia | $ 0 | no |
| Semana | 24/08 – 30/08 | Caja | −$ 880.000 | no |
| Semana | 31/08 – 06/09 | Ventas | $ 0 | no |
| Semana | 31/08 – 06/09 | Gramos | 0 g | no |
| Semana | 31/08 – 06/09 | Gastos | $ 0 | no |
| Semana | 31/08 – 06/09 | Ganancia | $ 0 | no |
| Semana | 31/08 – 06/09 | Caja | $ 0 | no |
| Semana | 07/09 – 13/09 | Ventas | $ 0 | no |
| Semana | 07/09 – 13/09 | Gramos | 0 g | no |
| Semana | 07/09 – 13/09 | Gastos | $ 0 | no |
| Semana | 07/09 – 13/09 | Ganancia | $ 0 | no |
| Semana | 07/09 – 13/09 | Caja | $ 0 | no |
| Semana | 14/09 – 20/09 | Ventas | $ 39.000 | no |
| Semana | 14/09 – 20/09 | Gramos | 3 g | no |
| Semana | 14/09 – 20/09 | Gastos | $ 0 | no |
| Semana | 14/09 – 20/09 | Ganancia | $ 22.000 | no |
| Semana | 14/09 – 20/09 | Caja | $ 14.000 | no |
| Semana | 21/09 – 27/09 | Ventas | $ 129.000 | no |
| Semana | 21/09 – 27/09 | Gramos | 11 g | no |
| Semana | 21/09 – 27/09 | Gastos | $ 0 | no |
| Semana | 21/09 – 27/09 | Ganancia | $ 73.000 | no |
| Semana | 21/09 – 27/09 | Caja | $ 129.000 | no |
| Semana | 28/09 – 04/10 | Ventas | $ 163.000 | no |
| Semana | 28/09 – 04/10 | Gramos | 14 g | no |
| Semana | 28/09 – 04/10 | Gastos | $ 0 | no |
| Semana | 28/09 – 04/10 | Ganancia | $ 100.000 | no |
| Semana | 28/09 – 04/10 | Caja | $ 163.000 | no |
| Semana | 05/10 – 11/10 | Ventas | $ 206.000 | no |
| Semana | 05/10 – 11/10 | Gramos | 19 g | no |
| Semana | 05/10 – 11/10 | Promoción | $ 35.000 | no |
| Semana | 05/10 – 11/10 | Consumo propio | $ 14.000 | y 1 g sin costo |
| Semana | 05/10 – 11/10 | Gastos | $ 12.500 | no |
| Semana | 05/10 – 11/10 | Ganancia | $ 41.500 | y 1 g sin costo |
| Semana | 05/10 – 11/10 | Caja | $ 36.500 | no |
| Semana | 05/10 – 11/10 | Mejor semana | sí | no |

### Análisis · meses

| Período | Rango | Etiqueta | Valor | Pendiente |
| --- | --- | --- | --- | --- |
| Mes | 01/08 – 31/08 | Ventas | $ 0 | no |
| Mes | 01/08 – 31/08 | Gramos | 0 g | no |
| Mes | 01/08 – 31/08 | Gastos | $ 0 | no |
| Mes | 01/08 – 31/08 | Ganancia | $ 0 | no |
| Mes | 01/08 – 31/08 | Caja | −$ 880.000 | no |
| Mes | 01/09 – 30/09 | Ventas | $ 168.000 | no |
| Mes | 01/09 – 30/09 | Gramos | 14 g | no |
| Mes | 01/09 – 30/09 | Gastos | $ 0 | no |
| Mes | 01/09 – 30/09 | Ganancia | $ 95.000 | no |
| Mes | 01/09 – 30/09 | Caja | $ 143.000 | no |
| Mes | 01/10 – 31/10 | Ventas | $ 369.000 | no |
| Mes | 01/10 – 31/10 | Gramos | 33 g | no |
| Mes | 01/10 – 31/10 | Promoción | $ 35.000 | no |
| Mes | 01/10 – 31/10 | Consumo propio | $ 14.000 | y 1 g sin costo |
| Mes | 01/10 – 31/10 | Gastos | $ 12.500 | no |
| Mes | 01/10 – 31/10 | Ganancia | $ 141.500 | y 1 g sin costo |
| Mes | 01/10 – 31/10 | Caja | $ 199.500 | no |

### Análisis · días de la semana

| Día | Ventas | # ventas | Mejor |
| --- | --- | --- | --- |
| Lun | $ 0 | 0 | no |
| Mar | $ 12.000 | 1 | no |
| Mié | $ 194.000 | 3 | sí |
| Jue | $ 0 | 0 | no |
| Vie | $ 190.000 | 4 | no |
| Sáb | $ 0 | 0 | no |
| Dom | $ 141.000 | 2 | no |

### Análisis · desde el primer registro

| Período | Rango | Etiqueta | Valor | Pendiente |
| --- | --- | --- | --- | --- |
| Desde el primer registro | 28/08 – 07/10 | Ventas | $ 537.000 | no |
| Desde el primer registro | 28/08 – 07/10 | Faltante de stock | $ 10.000 | no |
| Desde el primer registro | 28/08 – 07/10 | Promoción | $ 35.000 | no |
| Desde el primer registro | 28/08 – 07/10 | Consumo propio | $ 14.000 | y 1 g sin costo |
| Desde el primer registro | 28/08 – 07/10 | Gastos | $ 12.500 | no |
| Desde el primer registro | 28/08 – 07/10 | Ganancia | $ 236.500 | y 1 g sin costo |
| Desde el primer registro | 28/08 – 07/10 | Caja | −$ 537.500 | no |

## Cómo se obtuvo

```sh
uv run --no-project python scripts/design/capture_muestra.py --date 2026-10-07
```

El script arma la app sobre una base SQLite en memoria con el reloj fijado en esa fecha, abre
un negocio, lo siembra con `scripts/design/sample_app.py` (sin cambios) y pide a la API
`/stock`, `/varieties`, `/payments/debtors`, `/customers`, `/panel`, `/analysis`, `/sales`, las
cuentas de cada cliente y los movimientos de cada variedad. Para actualizar la captura, pegá su
salida entre las líneas `## Cifras capturadas` y `## Cómo se obtuvo`.
