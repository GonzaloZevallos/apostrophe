---
status: accepted
date: 2026-11-11
summary: "el servidor agrupa cada número de teléfono para mostrarlo desde la tabla compartida, y el front solo lo muestra"
---

# El servidor agrupa cada número de teléfono para mostrarlo, desde la tabla compartida, y el front solo lo muestra

Parte 1 de GH-682. Decidido por el Tech Lead. Enmienda la ADR 0082: el front ahora muestra ejemplos, y los recibe de la API.

## Decisión

- **Una sola tabla.** `PhoneCountryRule` (`app/shared/phone_country.py`) suma `groupings` (una plantilla por largo nacional, `#` por dígito, solo " " y "-" como separadores) y `example` (la forma local que tipea un vendedor, los antiguos `phoneHint<XX>` del front). El constructor rechaza un largo sin plantilla, una plantilla de otro largo, otro separador y un ejemplo vacío.
- **Se agrupa al leer.** `PhoneNumber.display` busca el país por el código del propio número, quita el código (y el `9` de celular argentino) y aplica la plantilla del largo que queda. Nunca se guarda ni se llama desde una escritura; `CustomerOut.phone_display` lo calcula en cada lectura.
- **Lo que no encaja se devuelve tal cual.** Un código fuera de la lista, o un largo sin plantilla, devuelve el valor guardado. Agrupar solo inserta " " y "-".
- **El front no tiene formateador.** Muestra `phone_display` y lee los ejemplos de `GET /phone-countries`, una ruta con sesión que devuelve la misma constante para todo Business, en el orden de `listed_countries()`. El front sigue sin declarar ninguna regla propia.

## Consecuencias

- Agregar un país es agregar una fila a la tabla; ningún número guardado cambia y no hay migración.
- `/business.phone_countries` y `/phone-countries` salen del mismo `listed_countries()`, así que no pueden diferir en orden.
