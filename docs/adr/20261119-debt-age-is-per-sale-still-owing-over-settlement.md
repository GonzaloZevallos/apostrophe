---
status: accepted
date: 2026-11-19
summary: "los tramos de antigüedad son por Sale que todavía se debe sobre el Settlement y la antigüedad de un Customer sale del owing_since que ya produjo settle(); los límites (7 y 30 días) y age_in_days viven solo en app/shared/debt_age.py; un Credit nunca entra y los tramos suman el Total owed"
---

# Debt age is per Sale still owing over Settlement

GH-498 (rediseño de Customers), parte 1 de la API de deudores (GH-828). Es solo el dominio de `payments`: no cambia ningún comportamiento y todavía no tiene consumidor; la API de deudores de la parte 2 es el primero.

## Contexto

La pantalla de deudores necesita decir hace cuánto se debe. Un Customer puede deber varias Sales de fechas distintas, y un pago posterior cubre las más viejas primero (ADR-0012), así que la edad de "la deuda del Customer" no existe: lo que tiene edad es cada Sale que todavía se debe.

## Decisión

- **Los tramos son por Sale still owing sobre el Settlement; la antigüedad de un Customer sale de su `owing_since`.** Sale que todavía se debe es la que queda con `still_owed > 0` después de `settle()`. Sale con fecha futura cuenta como edad 0.
- **Solo sale de `settle()`, con los límites y `age_in_days` únicamente en `app/shared/debt_age.py`.** `SaleSettlement` lleva `sale_date` y `sale_number`, que solo `settle()` completa a partir del `OwedSale` (que ahora trae `number`, el número de Sale por Business de ADR-0073, no el id). `app/payments/domain/debt_age.py` importa solo la biblioteca estándar, el propio dominio y `app.shared.debt_age`, y no lee ningún reloj. Ningún adaptador, router o schema recorre Sales contra Payments ni agrupa una fecha.
- **Tramos fijos: 0-7, 8-30 y 31+ días** (`this_week`, `days_8_30`, `over_30`). `age_in_days(on, today) = max(0, (today - on).days)`; `bucket_of` rechaza una edad negativa y `DebtAgeBuckets` rechaza un tramo negativo.
- **Un Credit nunca entra.** `buckets` suma solo remanentes mayores que cero, por lo que los tres tramos suman el Total owed.
- **Las líneas por Sale de un deudor no tienen tope** y suman su Balance.
- **`today` es siempre un parámetro.** Hoy su única fuente es `get_today` (`app/clock.py`, el día del Business en `BUSINESS_TIMEZONE`); pasa a ser la zona horaria del Business cuando llegue ADR-0057. Probar que un instante se convierte en el día correcto al cruzar la medianoche en Buenos Aires corresponde a los tests HTTP de la parte 2, no al dominio.

## Supuesto conocido (Assume nothing)

Los límites fijos de 7, 30 y 31 días suponen una única manera de llevar un negocio. Queda registrado como supuesto conocido para #330; cualquier ajuste configurable de esos límites pertenece a #318.

## Consecuencias

- La parte 2 arma las líneas `still_owing` y los tramos a partir de los mismos `SaleSettlement` que devolvió `settle()`, sin una segunda consulta.
- Cambiar los límites hoy es un cambio de código y de este ADR.

## Enmienda GH-497 parte 3

- La Debt age de un Customer (la del glosario: los días desde su Owing since, con los niveles `none`, `warning` y `overdue`) se calcula en `results` a partir del `owing_since` que `settle()` ya produjo. Las Sales nunca se recorren contra los Payments una segunda vez.
- `age_in_days` y los límites (`RECENT_UP_TO_DAYS = 7` y `WARNING_UP_TO_DAYS = 30`) viven solo en `app/shared/debt_age.py`; `payments` (`bucket_of`) y `results` (`age_level`) los importan y no escriben ningún umbral propio.
- El supuesto conocido (Assume nothing) para #330 y #318 ahora apunta a `app/shared/debt_age.py`.
