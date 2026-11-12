---
status: accepted
date: 2026-11-11
summary: "un número de teléfono lleva su propio país, elegido por número y detectado en el dispositivo; el país ya no es una configuración del Business"
---

# Un número de teléfono lleva su propio país, elegido por número y detectado en el dispositivo

Parte 2 de GH-682. Decidido por el Tech Lead, con la regla del dueño del 2026-11-11: el país es de cada número. Reemplaza a la [ADR 0082](0082-a-phone-number-with-a-listed-country-code-follows-that-country-s-rule-and-the-rules-live-in-one-shared-table.md) en lo que decía del país del Business; la tabla de reglas y las demás decisiones de la 0082 y la 0084 siguen. No reabre la ADR 0066: el cambio de la API lleva su línea `Breaking-API:`.

## Decisión

- **El país no se guarda.** La forma internacional del número ya lo lleva (`+598…`). `register_customer` y `edit_customer` reciben el código pedido (`phone_country: str | None`, un string plano) y lo usan solo para leer un número tipeado sin `+`. El puerto `PhoneCountryReader` y su adaptador SQL desaparecen. `register_imported_customer` sigue pasando Argentina, así que la importación de la planilla no cambia.
- **Nada se siembra desde la configuración vieja.** Ningún país del Business se copia a un Customer ni al formulario. La columna `business.default_phone_country` se queda hasta la parte 3 de GH-682, y desde este cambio ningún código la lee ni la escribe. `PUT /business/phone-country` y los campos `phone_country` y `phone_countries` de `GET /business` se quitan, igual que el control de Settings → Business.
- **La detección es del dispositivo.** `detectCountry(languages, timeZone, listed)` toma el primer idioma de `navigator.languages` con región listada (los que no tienen región se saltan), si no el país de la zona horaria según `zoneCountries.json`, y si no Other. No hace ninguna llamada de red y no escribe en el almacenamiento del navegador ni en el servidor: el país detectado nunca se guarda ni se envía por sí solo. Solo `web/src/phone/device.ts` lee el idioma y la zona. `zoneCountries.json` lo genera `scripts/phone/zone_countries.py` desde `tzdata`, con una lista fija de alias, y un test falla si falta una zona de los ocho países.
- **Una sola tabla.** Los códigos, los largos, las reglas y los ejemplos viven en `app/shared/phone_country.py` y el front los recibe de `GET /phone-countries`. Ningún otro módulo, archivo del front ni string del Copy declara un código, un largo ni un ejemplo; el Copy guarda solo el nombre y el adjetivo de cada país, por su código ISO.
- **Reglas de escritura, en este orden.** (1) En una edición, un teléfono sin cambios o igual al guardado se conserva y su país no se lee, no se parsea ni se valida; el formulario además omite el teléfono si no cambió. (2) Un teléfono en blanco es ninguno y el país se ignora. (3) Un teléfono que empieza con `+` sigue su código y el país enviado se ignora, aunque sea inválido. (4) Si no, un país `null` da `customer.phone_needs_country_code` y un string fuera de la lista da 422 `customer.phone_country_unknown` (el código pasa desde `business.phone_country_unknown`). Un PATCH con solo `phone_country` no cambia nada. Un único `_phone_for` decide las reglas 2 a 4 para el alta y la edición.
- **Estado bloqueado del Selector.** Cuando el texto empieza con `+`, el Selector de "Phone country" muestra el país de ese código (Other si el código no está en la lista o está incompleto), bloqueado, con el motivo visible "The + and the code set the country". Al borrar el `+` se desbloquea y conserva el último país mostrado; el texto tipeado nunca se reescribe. `locked` es un estado genérico del Selector: exige `lockedReason`, no abre la lista ni agrega historial, y no es `loading`.

## Consecuencias

- Un vendedor fuera de Argentina guarda un número local sin tocar el Selector; uno de otro país elige el país una vez. Una misma persona no se vuelve dos Customers, porque dos escrituras de un número caen en la misma forma internacional.
- Un vendedor argentino con el teléfono en `en-US` ve Estados Unidos por defecto y lo cambia con un toque.
- Agregar un país sigue siendo una fila de la tabla compartida y un alias de zona; no hay migración.
- Los clientes de la API que mandaban un número local ahora mandan también `phone_country`: es un cambio incompatible, declarado en el cuerpo del PR.
