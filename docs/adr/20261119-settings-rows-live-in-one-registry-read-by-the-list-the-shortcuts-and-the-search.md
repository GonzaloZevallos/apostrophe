---
status: accepted
date: 2026-11-19
summary: "las filas de Settings viven en un solo registro, settingsRows.ts, que leen la lista del teléfono, los tres shortcuts y la búsqueda futura; toda ruta /settings/* es el `to` de al menos una fila o está en NON_ROW_ROUTES con un motivo, nunca las dos cosas, y no se agrega ni se mueve ninguna dirección"
---

# Settings rows live in one registry read by the list, the shortcuts and the search

GH-843 (rediseño de Settings), partes 1 y 2 (#925 y esta). Es solo el registro tipado y su copy: ninguna pantalla lo lee todavía, así que no cambia nada visible.

## Contexto

La lista de Settings del teléfono, los shortcuts de arriba y la búsqueda que viene después necesitan los mismos datos de cada fila: etiqueta, segunda línea, ícono y dirección. Si cada pantalla los declara por su cuenta, se desincronizan: una fila que existe en la lista y no en la búsqueda, o un shortcut que abre una dirección que la fila ya cambió.

## Decisión

- **`web/src/screens/settings/settingsRows.ts` es la única fuente** de la lista del teléfono, los shortcuts y la búsqueda futura. Las etiquetas, las segundas líneas, los íconos, las direcciones y las etiquetas de los shortcuts viven solo ahí (el texto, en `web/src/copy/` bajo `settings:*`, en inglés).
- **Regla de rutas.** Toda ruta `/settings/*` de `ROUTE_REGISTRY` es el `to` de al menos una fila, o está en `NON_ROW_ROUTES` con un motivo, nunca las dos cosas. `unaccountedSettingsRoutes` informa cuatro clases de problema: `unlisted` (una ruta que nadie nombra), `both` (un `to` que también está en `NON_ROW_ROUTES`), `notAPath` (un `to` que no es una ruta registrada) y `sharedUnnamed` (un `to` repetido que `SHARED_TO` no nombra).
- **Un solo `to` compartido:** `SETTINGS_BUSINESS` para `businessName` y `language` (`SHARED_TO`). Ningún otro `to` se repite.
- **Íconos más cercanos, no nuevos.** `monedas` para Currency, `salidaStock` para Withdrawal reasons, `etiqueta` para Customer types y `bandera` para Language. El shortcut del Telegram catalog usa `telegram` porque su etiqueta nombra Telegram, mientras que la fila Integrations conserva `integraciones`. "Telegram catalog" es solo la etiqueta del shortcut; no renombra la fila.
- **Shortcuts: exactamente tres** (`prices`, `paymentMethods`, `integrations`), que referencian la fila por su clave (`SettingsRowKey`) y toman el destino del `to` de esa fila con `shortcutTarget`, sin dirección propia. La etiqueta de un shortcut se deriva de la clave de la fila (`settings:shortcuts.<fila>`). Un shortcut solo nombra una fila que siempre se muestra: un test lo comprueba en todos los contextos, y si una parte posterior vuelve condicional esa fila, el test falla y esa parte lo decide a la vista.
- **Etiqueta del shortcut.** Una celda de shortcut es un solo link cuyo nombre accesible es su etiqueta visible, así que cuenta como Botón en `WRITING_STANDARDS.md`: como máximo 20 caracteres y 3 palabras. El límite se afirma en `settingsRows.test.ts`.
- **Etiqueta de vuelta del padre de entrada.** Sigue ADR-0045 y `useBackParent`; este ADR no la repite.
- **No se agrega, mueve ni redirige ninguna dirección del front.** Se respeta lo dicho en Retired address ([ADR-20261117](20261117-retired-addresses-answer-as-unknown-and-the-legacy-redirects-are-deleted.md)).
- **La lista de Settings de la computadora no cambia.**
- **La fila Customer types se muestra solo mientras el interruptor de Customer types está activado** (decisión en #925). Con el interruptor sin conocer todavía (`undefined`), no se muestra.

## Consecuencias

- La pantalla del teléfono, los shortcuts y la búsqueda de las partes siguientes leen el registro; ninguna declara una etiqueta, un ícono o una dirección propios.
- Una ruta `/settings/*` nueva rompe un test hasta que alguien la pone como fila o en `NON_ROW_ROUTES` con su motivo.
- `settingsRows.ts` sigue en `web/scripts/docs/front-exclude.json` hasta que la parte que conecta una pantalla lo saque.
