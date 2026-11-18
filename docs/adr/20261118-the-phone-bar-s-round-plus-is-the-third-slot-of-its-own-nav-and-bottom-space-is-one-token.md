---
status: accepted
date: 2026-11-18
summary: "el + redondo es el tercer lugar del <nav> de la barra del celular, el Bottom space es un solo token (--bottom-chrome-height) y \"Vender\" es la única excepción con nombre al inglés"
---

# The phone bar's round + is the third slot of its own nav, and Bottom space is one token

GH-727, parte 4 de 4. Es un delta sobre ADR-0045: registra lo que la parte 3 construyó en la barra del celular y retira del marco el botón flotante. ADR-0027, ADR-0028 y ADR-0045 quedan sin cambios.

## Contexto

Hasta la parte 3, quien vendía desde el celular tocaba un "+ New sale" flotante, solo en los **Tab root**, que se apoyaba sobre el contenido y traía arriba de la barra una línea de "qué falta". La barra pasó a Home · Sales · + · Customers · Products, con el + redondo en el centro. Esas decisiones vivían solo en el plan de la tarea; este ADR las deja donde las encuentra quien toque la barra.

## Decisión

- **El + es el tercer lugar del propio `<nav>` de la barra.** Es un `Link` a New sale con `aria-haspopup="dialog"` (New sale se abre como formulario a pantalla completa), nunca un botón ni una pestaña, y nunca queda marcado. Se muestra y se oculta junto con la barra, porque es hijo de ella (`web/src/shell/Shell.tsx`). Qué lugar queda marcado sale solo de `placeOf` en `routes.ts`.
- **El Bottom space es un solo token: `--bottom-chrome-height`** (`web/src/styles/app.css`). Suma exactamente cuatro términos: `--bar-height` + `--plus-overhang` + `--sheet-actions-height` + `--inset-abajo`. El sobresaliente del + (`--plus-overhang`) se enciende en el mismo selector que fija `--bar-height` (`html:has(.bar-inferior)`), así que existe solo donde existe la barra; las acciones fijas de la Sheet (`--sheet-actions-height`) solo bajo `.sheet`. Todo elemento fijo dibujado arriba de la barra toma su borde inferior de este token, y ninguna regla repite el alto de la barra ni del +.
- **La tabla del marco, en una línea:** un Tab root, una tarjeta o un detalle tienen la barra con su +; un formulario o una pantalla de entrada no tienen ninguno de los dos. El resto está en **Tab root** (`CONTEXT.md`) y en `docs/product/navigation.md`. La barra lateral de la computadora no cambia y conserva su "+ New sale".
- **"Vender" es la única excepción con nombre al inglés** (decisión 3 del humano en GH-727). Es el nombre accesible del +, vive bajo una sola clave del Copy module, `common:newSaleFabName`, y nunca es una etiqueta visible: el + muestra un ícono y ningún texto. `Shell.language.test.tsx` y `web/e2e/barFit.spec.ts` lo hacen cumplir.

## Por qué

- Con el + dentro del `<nav>`, la barra y el + comparten visibilidad, lectura de teclado y marca de lugar sin que ningún componente las repita.
- Un solo token para el Bottom space evita que la barra, el sobresaliente del +, el toast y el pie fijo de una tarjeta discrepen sobre cuánto mide lo de abajo.
- Una sola excepción, con una sola clave, hace que la regla "toda palabra de pantalla va en inglés" siga siendo comprobable.

## Consecuencias

- Ya no existe un "+ New sale" flotante ni su línea de "qué falta" en el celular; la entrada a New sale es el + de la barra. La pista de precio faltante vive en el campo de producto de New sale (`docs/product/sales.md`).
- Cambiar el alto de la barra, del + o de las acciones de la Sheet es cambiar un término del token, no una regla suelta.
- ADR-0027 (el estado abierto de una Sheet vive en el historial), ADR-0028 (el formulario de ventas se ancla al viewport visual) y ADR-0045 (el Shell dibuja el marco y un padre varía solo por su registro) siguen valiendo tal cual.
