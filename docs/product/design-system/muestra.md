# Muestra · La Huerta

Una sola captura de la app de muestra (`scripts/design/sample-app.sh`, ADR-0040), para que
Inicio, Clientes y Variedades coincidan entre sí por construcción. Cada pantalla que dibuja
una cifra de La Huerta usa los valores de acá, no otros.

**Capturada el 05/10/2026**, pidiendo `/stock`, `/payments/debtors`, `/panel`, `/varieties`
y `/customers` a la app de muestra recién sembrada. Las cifras que dependen de "hoy" quedan
desactualizadas con el tiempo (lo dice el plan): quien redibuje una pantalla más adelante
puede volver a correr `scripts/design/sample-app.sh` y actualizar esta tabla, no inventar un
número nuevo.

## Variedades

| Variedad | Gramos | Estado | Agotada desde | Días restantes | Precio de lista hoy |
| --- | --- | --- | --- | --- | --- |
| 24K Gold | 135 g | ok | — | 270 días | $ 12.000 x g |
| Golden Cookies | 18 g | baja (umbral 20 g) | — | 24 días | $ 14.000 x g |
| Sir Jack | 0 g | agotada | 05/10 | — | $ 11.000 x g |
| Mango Bomb | 0 g | sin entradas | — | — | $ 15.000 x g |

## Clientes

| Cliente | Saldo | Debe desde | Estado |
| --- | --- | --- | --- |
| Nico Parra | $ 20.000 | 16/09 | debe |
| Tincho Aguirre | $ 12.000 | 04/10 | debe |
| Mica Solano (VIP) | $ 0 | — | al día |
| Lu Fernández | $ 0 | — | al día |

## Te deben

- Total: **$ 32.000**.
- 2 ventas todavía impagas.
- Fila del resumen (las dos, es toda la lista): Nico Parra $ 20.000 (desde 16/09) · Tincho
  Aguirre $ 12.000 (desde 04/10).

## Panel

| Período | Rango | Ventas | # ventas | Promedio | Gramos vendidos | Regalados | Costo de lo vendido | Gastos | Compras | Ganancia | Caja |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hoy | 05/10 – 05/10 | $ 194.000 | 3 | $ 64.667 | 17 g | 1 g | $ 93.000 | $ 8.000 | $ 150.000 | $ 93.000 | $ 36.000 |
| Semana | 05/10 – 11/10 | $ 194.000 | 3 | $ 64.667 | 17 g | 1 g | $ 93.000 | $ 8.000 | $ 150.000 | $ 93.000 | $ 36.000 |
| Mes | 01/10 – 31/10 | $ 314.000 | 5 | $ 62.800 | 27 g | 1 g | $ 156.000 | $ 12.500 | $ 150.000 | $ 145.500 | $ 144.500 |

Ninguno de los tres períodos tiene costo pendiente (`pending_cost: false`).

## Cómo se obtuvo

```sh
scripts/design/sample-app.sh --dir /tmp/muestra   # deja /tmp/muestra/sample.json
# con sesión iniciada (vos@lahuerta.com / muestra-de-la-huerta):
curl -b cookies.txt http://127.0.0.1:<puerto>/stock
curl -b cookies.txt http://127.0.0.1:<puerto>/payments/debtors
curl -b cookies.txt http://127.0.0.1:<puerto>/panel
curl -b cookies.txt http://127.0.0.1:<puerto>/varieties
curl -b cookies.txt http://127.0.0.1:<puerto>/customers
```
