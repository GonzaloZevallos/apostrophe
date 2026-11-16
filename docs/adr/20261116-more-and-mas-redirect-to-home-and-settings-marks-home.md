---
status: accepted
date: 2026-11-16
summary: "/more y /mas redirigen en 308 a Home desde su propia lista, y Settings marca Home en la barra del celular"
---

# /more and /mas redirect to Home and Settings marks Home

GH-495, parte 5 de 7. Reemplaza solo dos viñetas de `20261109-more-is-retired-and-expenses-is-a-card-on-the-phone-and-a-root-on-the-computer.md`.

## Contexto

El ADR del 2026-11-09 retiró More y dejó dos decisiones que esta parte invierte: `/mas` y `/more` caían en Home solo por la regla de dirección desconocida, sin redirección ni test que las nombrara, y Settings no marcaba ninguna pestaña. La petición de esta parte pide una redirección permanente en un solo salto y Home como padre de Settings en el celular.

## Decisión

- **`/more` y `/mas` redirigen con 308 a `/` en un solo salto, sin query**, para cualquier método y cualquier `Accept`, con o sin una barra final. Pasan por `FrontNavigation._redirect`, el único mecanismo de redirección del servidor, desde una lista propia, `RETIRED_FRONT_PATHS` en `app/static_spa.py`. La tabla de paths viejos en español (`legacy_front_paths.json`) conserva su contrato (viejo en español a nuevo en inglés, con su query), y por eso no se mezcla con esta lista.
- **Cualquier otro path bajo ellos no se redirige.** `/more/x` cae en la regla existente de dirección desconocida, que va a Home.
- **`tests/test_static_spa.py` es la única excepción del escaneo de More**, y solo para la regla "the /more or /mas path in Python". Las demás reglas siguen aplicando a ese archivo. El test de arquitectura sigue fallando si cualquier otro archivo de `web/src`, `web/e2e` o `tests` nombra More o `/more`.
- **Settings y sus pantallas marcan Home en la barra del celular**, decidido solo por `placeOf` sobre el registro de `web/src/routes.ts`. La barra lateral de la computadora no cambia.

## Por qué

- Un favorito viejo a `/more` llega a Home en un salto y no depende de que la regla de dirección desconocida siga existiendo.
- Mantener la lista aparte evita que el contrato de la tabla en español se vuelva una excepción.

## Consecuencias

- El servidor responde 308 a `/` para esas dos direcciones, a cualquiera, con o sin sesión. El destino es fijo y no refleja nada de la petición.
- Las viñetas reemplazadas del ADR del 2026-11-09 ya no valen; el resto de ese ADR sigue en pie.

## Descartado

- **Agregar dos filas a `legacy_front_paths.json`.** Rompe su contrato y su fixture fijado de 19 filas.
- **Una redirección en el front.** El servidor es el único mecanismo de redirección.
