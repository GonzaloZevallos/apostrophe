---
status: draft
---
## Goal

Registrar en un ADR y en los docs del producto la barra del celular tal como quedó construida en la parte 3 de GH-727, con su + redondo. Es para el próximo agente o PM que toque la barra y para quien la revisa contra los docs: tienen que poder distinguir una regresión del diseño decidido sin leer el código ni el plan de GH-727. Es solo de docs y no cambia nada de lo que ve o hace quien vende.

## Acceptance criteria

- Existe un ADR con forma fecha-slug en `docs/adr/`, en español rioplatense con los términos del glosario y las palabras de pantalla en inglés, que registra cuatro decisiones:
  - el + es el tercer lugar del propio `<nav>` de la barra, un `Link` con `aria-haspopup="dialog"`, y se muestra y se oculta junto con la barra;
  - el Bottom space es un solo token (`--bottom-chrome-height`): barra, más el sobresaliente del +, más las acciones de la Sheet, más el inset;
  - la tabla del marco: un Tab root, una tarjeta o un detalle tienen la barra con su +, y un formulario o una pantalla de entrada no tienen ninguno de los dos;
  - "Vender" es la única excepción con nombre al inglés (decisión 3 del humano), bajo la única clave `common:newSaleFabName`, y nunca es una etiqueta visible.
- El ADR cita ADR-0027, ADR-0028 y ADR-0045 como sin cambios.
- Ningún doc bajo `docs/product/` describe como actual un "+ New sale" flotante en el celular ni su línea de "qué falta". Cada lugar que lo hacía remite al + de la barra en `navigation.md`, y todo "+ New sale" que queda nombra la barra lateral de la computadora.
- En `sales.md`, el job de navegación, el criterio 30, "Cómo se abre el formulario" y "Un formulario" nombran el + de la barra del celular. El aviso de nada para vender se atribuye a la pista del campo de producto de New sale (criterios 44–50), que sigue la fecha de la venta y da el motivo que ya existe, sin una segunda definición.
- En `results.md`, la acción principal de Home y su Fuera de alcance nombran el + de la barra del celular y el "+ New sale" de la barra lateral de la computadora, y no un botón flotante.
- `theme-choice.md` y `expenses.md` dejan de describir como actual el New sale flotante del celular, y `customers.md` coincide con la barra construida, que muestra el + en la ficha del Customer.
- `navigation.md` solo suma la cita del ADR y los anchos medidos de la barra que da `web/e2e/barFit.spec.ts`; ninguna otra oración cambia.
- **Navigation** y **Tab root** de `CONTEXT.md` coinciden con la barra construida: la barra lleva su + en los Tab roots, las tarjetas, los detalles y Expenses, y no hay botón flotante. **Product language** sigue nombrando "Vender" igual que el ADR.
- Nada bajo `docs/architecture/generated/**`, `docs/api/**` ni `docs/architecture/decisiones.md` se edita.
- Los jobs `checks` y `docs` están en verde.

## Out of scope

- El "+ New sale" de la barra lateral de la computadora y su línea de precio faltante, que quedan como están en el código y en los docs.
- Cualquier cambio de código, texto de la app, pantalla o comportamiento.
- Cualquier edición bajo `docs/architecture/generated/**`, `docs/api/**` o `docs/architecture/decisiones.md`.
- Escribir una segunda definición de la pista de precio faltante de New sale.

## Decisions

- La pista de precio faltante ya está definida en `sales.md` (criterios 44–50), así que "agregarla" es remitir a ella desde los lugares que se la atribuían al botón flotante.
  - Reason: dos definiciones de la misma pista se separarían con el tiempo, y el pedido dice que no se invente redacción.
- El criterio de que ningún doc describa el botón flotante abarca toda la carpeta `docs/product/`, no solo `sales.md` y `results.md`; entran `theme-choice.md`, `expenses.md` y `customers.md`.
  - Reason: la aceptación del pedido habla de toda la carpeta, y el PM lo decidió en la entrevista.
- Si el código construido difiere de lo que dicen los docs sobre la pista o la ficha del Customer, los docs siguen al código y la diferencia se informa como hallazgo.
  - Reason: el job es describir la barra tal como está construida, no como estaba planeada.
- La definición de **Tab root** se reescribe para identificar las pantallas principales de las pestañas, porque "muestra la barra con su +" ya también vale para las tarjetas y los detalles.
  - Reason: desde la parte 3 de GH-727 esa frase dejó de distinguir un Tab root.

## Risks

- `customers.md` puede decir que la ficha del Customer no muestra "+ New sale" mientras la barra construida sí muestra el + ahí; si la redacción no se corrige con cuidado, la nueva puede contradecir el criterio 47 de navigation.md.
- Una búsqueda solo por "+ New sale" puede pasar por alto menciones del botón flotante con otra redacción (por ejemplo 'floating "New sale"').
- Los anchos medidos tienen que salir de la última corrida de `web/e2e/barFit.spec.ts`; copiarlos del plan de GH-727 puede dejar cifras viejas.

## Screens

none

## Slices

### record-phone-bar-plus

#### Acceptance criteria

- Existe el ADR fecha-slug con las cuatro decisiones y las citas a ADR-0027, ADR-0028 y ADR-0045 como sin cambios.
- Una búsqueda en `docs/product/` no encuentra ningún New sale flotante del celular, ni su línea de qué falta, descrito como actual.
- `sales.md` remite la pista de precio faltante a sus criterios 44–50, y `results.md` nombra el + de la barra del celular.
- `navigation.md` suma solo la cita del ADR y los anchos medidos de la barra.
- **Navigation** y **Tab root** de `CONTEXT.md` coinciden con la barra construida.
- Nada bajo `docs/architecture/generated/**`, `docs/api/**` ni `docs/architecture/decisiones.md` cambia, y `checks` y `docs` están en verde.

#### Risks

- customers-page-wording
- missed-floating-mentions
- stale-bar-widths
