---
status: accepted
date: 2026-11-17
summary: "las direcciones retiradas responden como una dirección desconocida: se borran las redirecciones heredadas y las de /more y /mas, y la única 308 de un path del front es la de una barra final"
---

# Retired addresses answer as unknown and the legacy redirects are deleted

GH-780, parte 2 de 3. Registra la decisión cuya implementación en el servidor hizo la parte 1.

## Contexto

El dueño fijó el 2026-11-16 una regla, que el glosario define como **Retired address**: una dirección que la app dejó de usar no se redirige a la nueva ni a Home. Responde exactamente igual que cualquier dirección que nunca existió. `docs/architecture/navigation.md`, sección «Direcciones retiradas», ya la lleva.

La parte 1 de GH-780 ya borró las redirecciones en `app/static_spa.py` y quitó `app/legacy_front_paths.json`. Esta parte deja por escrito la decisión y marca qué decisiones anteriores deja atrás.

## Decisión

- **Las filas heredadas en español y `/more` y `/mas` se borran.** Cada una responde exactamente como cualquier dirección desconocida.
- **La 308 de un path actual más una barra final es la única redirección de un path del front.** Conserva el query string.
- **Lo que muestra una dirección desconocida no cambia.**
- **Es una regla permanente para toda dirección retirada futura.** Se borra, nunca se redirige, y no se guarda ninguna lista de direcciones viejas.

## Revierte

- **Las partes de redirección heredada de ADR-0024, ADR-0030 y ADR-0033:**
  - ADR-0024: la tabla de paths viejos en español con su 308 hacia el path nuevo, y su enmienda de GH-59 en lo que toca a esas filas.
  - ADR-0030: el patrón anclado `LEGACY_FRONT_PATTERNS` y la redirección de los paths viejos de `/variedades`.
  - ADR-0033: las filas heredadas, su único lugar en la app y el fixture de paths viejos fijados. Las plantillas de id y el cruce con `screens.json` siguen en pie.
- **En ADR-20261116-more-and-mas-redirect-to-home-and-settings-marks-home, las viñetas 1 a 3 de Decisión:** la 308 a `/` desde `RETIRED_FRONT_PATHS`, el «cualquier otro path bajo ellos no se redirige» y la excepción de `tests/test_static_spa.py` en el escaneo de More. La viñeta 4, Settings marca Home en la barra del celular, sigue en pie.
- **La enmienda 2026-11-16 de ADR-20261109-more-is-retired-and-expenses-is-a-card-on-the-phone-and-a-root-on-the-computer** (la del #726), solo en la mitad que pasó a ese ADR la viñeta «`/mas` y `/more` caen en Home a propósito». Vuelve a valer la lectura simple de dirección desconocida para esa viñeta. La mitad de Settings de la enmienda sigue en pie.

## Por qué

- Una lista de direcciones viejas crece sin límite y cada fila es una promesa que hay que mantener, probar y revisar.
- Una dirección retirada que responde distinto de una desconocida obliga a explicar por qué existe esa diferencia.
- Con una sola redirección posible, la de la barra final, el servidor no tiene ninguna tabla que leer.

## Consecuencias

- Un favorito viejo, en español o a `/more`, cae donde cae cualquier dirección desconocida.
- No quedan en `app/`, `tests/` ni `web/` listas de paths viejos ni fixture que las pine.
- Las enmiendas de ADR-0033 y de ADR-20261116-more-and-mas-redirect-to-home-and-settings-marks-home dicen qué parte de cada uno queda atrás; los estados de ambos siguen `accepted` porque conservan partes en vigor.

## Descartado

- **Dejar las filas heredadas «por compatibilidad».** Es la lista sin límite que esta regla evita.
- **Redirigir `/more` y `/mas` a Home y borrar solo las filas en español.** Mantiene dos clases de dirección retirada.
