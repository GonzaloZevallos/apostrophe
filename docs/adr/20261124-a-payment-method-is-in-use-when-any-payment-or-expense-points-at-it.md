---
status: accepted
date: 2026-11-24
summary: "un medio de pago está en uso cuando algún Payment o alguna Expense del Business lo usa: `AnyUsage` junta las fuentes y cada una filtra por su `business_id`"
---

# Un medio de pago está en uso cuando algún Payment o alguna Expense lo usa

GH-1010, parte 3 (GH-837). Extiende [Los medios de pago se identifican por id](20261111-payment-methods-by-id.md):
reemplaza solo la descripción de `PaymentMethodUsage` como "¿tiene Payments?". No lo reemplaza entero, y
ese ADR lleva una nota de enmienda que apunta de vuelta a este.

## Decisión

- **Una sola regla.** Un Payment method está en uso cuando al menos un Payment o al menos una Expense del
  mismo Business apunta a él, esté archivado o no. Una Expense sin medio no cuenta para ninguno. Es un sí o
  un no: ninguna respuesta dice cuántos registros lo usan.
- **La unión vive en `AnyUsage`.** `app/payment_methods/adapters/any_usage.py` junta las respuestas de las
  fuentes que recibe; `app/main.py` las cablea (`PaymentsUsingAMethod` y `ExpensesUsingAMethod`) y deja la
  fábrica en `app.state.payment_method_usage`. `app/payment_methods` no importa `app.payments` ni
  `app.expenses`, y un test lo vigila.
- **Cada fuente filtra por su `business_id`.** Cada adaptador pregunta solo por los registros de su Business
  y por los ids pedidos; un test con las claves foráneas apagadas pone en otro Business una fila que apunta
  al medio y falla si el filtro se saca.
- **Toda tabla con una clave foránea a `payment_method` se cuenta y es `RESTRICT`.**
  `tests/architecture/test_payment_method_references.py` refleja `app.tables.metadata`, exige una fuente
  que la cuente (un seeder que deja el medio en uso y con el `DELETE` rechazado) por cada tabla, y que cada
  una de esas claves sea `ondelete="RESTRICT"`. Una tabla nueva que apunte al medio y no se cuente rompe ese test.
- **`delete` es la red de seguridad de una carrera.** Si un registro se escribe entre la comprobación de
  `in_use` y el `DELETE`, la clave foránea rechaza la sentencia; `SqlPaymentMethods.delete` corre el `DELETE`
  dentro de un savepoint y traduce su `IntegrityError` a `InUse`: 409 `payment_method.in_use`, con el mismo
  cuerpo que la comprobación del caso de uso, nunca un 500. Solo las claves que apuntan a la fila borrada
  pueden hacer fallar un `DELETE`, y son las de `payment` y `expense`; un error de bloqueo es otra
  excepción y sigue siendo 500. Nunca se lee el mensaje del driver.

## Consecuencias
- Un medio que solo usan Expenses se archiva y no se elimina, y cada Expense sigue mostrando su nombre actual.
- Cada llamada de listado o de borrado hace dos consultas indexadas, acotadas a los ids de un Business.
- Ninguna pantalla, texto ni migración cambia: Settings ya decide Archivar o Eliminar con el `in_use` de la API.
