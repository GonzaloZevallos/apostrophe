---
status: accepted
date: 2026-11-10
---

# ADR-0085: El control de idioma es un Fixed set de los idiomas que el Copy module tiene, acotado por la lista de Selectable languages

Extiende ADR-0074 (no la enmienda).

## Contexto

ADR-0074 dejó una excepción hasta la parte 7 de GH-581: las opciones del control de idioma de `BusinessGroup` eran `selectable_languages` de `GET /business`, es decir, un dato del negocio, y declararlas en `fixedSets.ts` rompía la regla de que lo que se lee de los datos del negocio nunca es un conjunto fijo.

## Decisión

- **El conjunto es fijo: los idiomas que el Copy module tiene.** `LANGUAGES` en `fixedSets.ts` se arma con `SHIPPED_LANGUAGE_TAGS` (`copy/readers/shippedLanguages.ts`), escrita a mano. Un test la compara con las carpetas reales de `copy/locales/` (sin el Test locale). Agregar un idioma es un cambio de código en el Copy module; ningún Business crea uno.
- **La lista de Selectable languages del servidor solo acota ese conjunto.** El control muestra `LANGUAGES` filtrado por la lista, en el orden del registro. Nada que venga del servidor se declara en `fixedSets.ts`.
- **El Stored language siempre se muestra.** Si es un idioma del conjunto pero ya no es Selectable, queda marcado y sin poder tocarse, en su lugar del orden. Si el Copy module no lo conoce, se muestra como texto plano ("Current: xx"), sin rol, sin `aria-pressed` y sin clase de chip, nunca como opción; las demás opciones siguen disponibles.

## Consecuencias

- La guarda no necesita una excepción para el idioma: el sitio crudo mapea `LANGUAGES` o un `.filter` directo de él.
- Si algún día los idiomas de un Business salen de datos (#317), el idioma sale de `fixedSets.ts` y pasa al Selector.
