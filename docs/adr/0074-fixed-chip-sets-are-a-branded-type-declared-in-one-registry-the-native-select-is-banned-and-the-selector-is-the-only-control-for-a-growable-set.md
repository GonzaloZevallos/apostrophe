---
status: accepted
date: 2026-11-07
---

# Fixed chip sets are a branded type declared in one registry. The native select is banned, and the Selector is the only control for a growable set.

Extends docs/adr/0062-on-the-phone-a-form-is-drawn-by-one-sheet.md sin enmendarlo.

Épica GH-581, parte 2. El plan padre, con la entrevista y el diseño del Selector, está en
`.agentic/tasks/GH-581.md`. Una pantalla que dibuja chips, pills o botones segmentados con un
conjunto que puede crecer (idiomas que el negocio ofrece, Payment methods, Customer types,
motivos, categorías) deja de poder elegirlo: hoy cualquiera puede mapear un arreglo a chips. Este
ADR fija cómo se declara un conjunto que de verdad es fijo; el Selector es el control de todo lo
demás.

## Decision

- **Un conjunto fijo es un tipo con marca.** `FixedSet<T>` es un `readonly FixedOption<T>[]` que
  lleva una marca `unique symbol` que el módulo no exporta. Un arreglo mapeado o un objeto escrito
  a mano no compila, y nadie construye uno con un cast.
- **Un solo constructor, que no se exporta.** `fixedSet(reason, options)`, dentro de
  `web/src/components/fixedSets.ts`, es lo único que arma un conjunto. Rechaza un `reason` vacío:
  todo conjunto dice por qué es fijo. `FIXED_SETS` lista cada nombre con su motivo para leerlos en
  un solo lugar.
- **Una opción guarda solo lo fijo.** `FixedOption` tiene `value`, un getter `label: () => string`
  y un `icon` opcional. `NombreIcono`, el tipo de nombres de `components/Icono.tsx`, es el
  `IconName` del pedido; no se renombra. El estado de ejecución (`apply`, `disabled`,
  `describedBy`) vive en un overlay indexado por `value` en el sitio que usa el conjunto, nunca en
  el registro.
- **Regla del lector de etiquetas.** Un getter lee la misma fuente de copy que su sitio leía antes
  (constantes planas para períodos y tema). Una lectura por clave pasa por un lector de `copy/`
  respaldado por `i18n/instanceText.ts`, que corre en el render. Nunca un hook, y nunca se importa
  `i18next` dentro de `fixedSets.ts`. Un getter se evalúa solo en el render, jamás al cargar el
  módulo, así el cambio de idioma lo recoge el render siguiente.
- **Regla de imports, comprobada.** `fixedSets.ts` importa solo módulos bajo `web/src/copy/` y
  `import type { NombreIcono } from './Icono'`. `web/src/architecture/choiceControls.ts`
  (`fixedSetImportViolations`) lee el archivo como texto, con las mismas utilidades de
  `controlScan.ts` (máscara de comentarios y resolución de rutas), cubre cada forma de import
  (estática, `import type`, de efecto lateral, `export … from`, `import()`, `require()`), resuelve
  `../copy/../api/x` a `src/api/x` y falla cerrado con `archivo:línea` ante cualquier otra cosa o
  ante lo que no pueda leer. Mira solo imports directos, a propósito: un módulo de `copy/` que
  llegara a la red lo atrapan las guardas de copy.
- **Lo que se lee de los datos del negocio nunca es un conjunto fijo**, ni siquiera de forma
  temporal: ni Payment methods, ni Customer types, ni motivos, ni categorías, ni los idiomas que el
  negocio ofrece.
- **Excepción hasta la parte 7 de GH-581: el control de idioma de `BusinessGroup`.** Sus opciones
  son `selectable_languages` de `GET /business`, así que declararlas rompería la regla anterior o
  cambiaría lo que se muestra. No se toca en esta parte; la parte 7 lo resuelve, como excepción
  listada con ese motivo o pasándolo al Selector.
- **El Selector es el único control de un conjunto que puede crecer, y el `select` nativo queda
  prohibido.** Esta parte solo deja el registro y la regla de imports. Las reglas de sitio de
  llamada (qué controles toman un `FixedSet`) y la prohibición del `select` nativo se hacen
  cumplir en una parte posterior de GH-581.

## Consequences

- Agregar un conjunto fijo es editar un archivo, con su motivo a la vista en la revisión.
- Un conjunto cuyo contenido puede crecer no tiene dónde declararse como fijo; la salida es el
  Selector.
- La guarda no ve imports transitivos. Un `copy/` que importara una query no la dispararía.
