# Phone first

Los criterios de producto y de diseño del dueño (2026-10-21; el cuarto, Assume nothing, se agregó el 2026-10-23) tal como los aplican los roles. Este archivo registra los jobs y cómo se mide su éxito. Las reglas en sí están escritas una sola vez, en los documentos que se listan más abajo, y este archivo no contiene texto de reglas: donde difieren, ganan esos documentos.

## Jobs

- Cuando un rol construye, revisa o acota una pantalla, quiero que aplique mis criterios (el dibujo es una guía, el flujo en el teléfono va antes que el pulido, el usuario es el dueño de un negocio chico que usa el teléfono con poco tiempo, y no se da nada por sentado sobre el negocio), para que el trabajo se dedique a lo que ese dueño entiende y hace en el teléfono, y nada se pierda en diferencias de píxeles que no cambian ni una cosa ni la otra.
- Cuando acoto, dibujo o reviso algo que nombra qué vende un negocio, cómo lo mide, su moneda, cómo cobra, cómo fija los precios o qué canales usa, quiero una sola prueba que distinga la forma de trabajar de este vendedor de la del producto: "¿esto seguiría siendo correcto para un negocio que vende otra cosa, en otras unidades, de otras maneras?" Si no, es un finding. Entonces conservo la elección como una configuración con un valor por defecto neutro, nunca como una regla fija ni como un preset por tipo de negocio.

Se usa en cuatro momentos:
- Un diseñador o revisor está por abrir un finding o issue de "difiere del dibujo".
- Una tarea tiene que elegir entre dejar andando el flujo en el teléfono y el pulido visual.
- El PM o el Product Analyst decide el alcance o la prioridad de una capacidad y tiene que sopesar el teléfono contra la computadora.
- Un rol está por dejar escrito una palabra, unidad, campo, lista de opciones o valor por defecto para un negocio: una línea de PRD, una etiqueta de pantalla, un comentario de revisión, o el PM decidiendo un valor por defecto.

## Dónde vive cada criterio

- **Drawing as guide** (regla 1): `DESIGN_STANDARDS.md`.
- **Phone first** (regla 2): `DESIGN_STANDARDS.md`.
- El usuario principal (regla 3) y la línea de prioridad: `BRIEF.md`, "Problem and who has it".
- Assume nothing (criterio 4): `DESIGN_STANDARDS.md`, sección "Assume nothing" (la que manda, incluido cómo distingue quien revisa una extensión de la suposición propia del trabajo nuevo), y `BRIEF.md`, junto al usuario principal y la línea de prioridad. Los dos enuncian su prueba con idéntica redacción. El PM decide los findings dudosos con la prueba del criterio 4, igual que con la regla 1. Solo se le pregunta al dueño cuando el PM no puede decidir si una elección pertenece al negocio o al producto.
- **Icon and text rule**, **Attention icon**, **Tappable notice**, **Design capture**: `docs/product/icon-and-text-rule.md` y `docs/product/design-capture.md`, el texto que manda. `DESIGN_STANDARDS.md` tiene una sección breve para cada uno.
- Estándar móvil: `CODING_STANDARDS.md` §10 "Phone", al que remite `DESIGN_STANDARDS.md`.
- **Mobile check** (filas de teléfono, listas de infractores, condiciones de crecimiento): `docs/product/mobile-check.md` y `docs/product/gate.md`.

## Despliegue

- `docs/product/icon-and-text-rule.md` y `docs/product/design-capture.md` son el único hogar de sus reglas, y `DESIGN_STANDARDS.md` tiene solo una sección breve para cada una, que remite a ellos.
  - Un cambio a cualquiera de las dos reglas se hace solo en su archivo de `docs/product/`; la sección breve de `DESIGN_STANDARDS.md` no se edita por eso.
- El criterio 4 se aplica al alcance, el diseño y la revisión nuevos. No reclasifica lo que ya existe: las restricciones actuales del brief describen dónde arrancan los primeros negocios, las suposiciones existentes se barren en #330, y el modelo personalizable es #318.
  - El trabajo nuevo extiende una elección existente cuando reutiliza, sin cambios, una palabra, unidad o lista de opciones que `CONTEXT.md`, `BRIEF.md` o el código ya fijan para todos los negocios (por ejemplo, un campo nuevo en gramos o en pesos enteros, u otra elección de "efectivo o transferencia"). Ese finding se registra como un comentario de revisión que enlaza #330 (y #318 cuando lo que falta es el modelo personalizable), y el cambio se fusiona; no espera al barrido.
  - Todo lo que el trabajo nuevo agrega o cambia en una elección así (una opción fija más, una unidad nueva junto a gramos), o que no aparece en ninguno de `CONTEXT.md`, `BRIEF.md` ni el código, es la suposición propia del trabajo nuevo. Su finding bloquea la fusión como cualquier finding: antes de fusionar, la elección pasa a ser una configuración con un valor por defecto neutro, o el PM la declara dudosa y decide con la prueba del criterio 4.
  - Cuando quien revisa no puede decidir qué caso corresponde, le pregunta al PM antes de fusionar, y el PM decide.

## Criterios de éxito

1. Una diferencia con el dibujo se convierte en un finding o un issue solo cuando cambia lo que la persona entiende o hace. Una diferencia de píxeles o de layout que no cambia ninguna de las dos cosas no abre nada.
2. Cuando una tarea tiene que elegir, primero anda el flujo en el teléfono. El pulido es una tarea aparte, posterior.
3. Cada rol lee estos criterios en el documento que ya usa: `DESIGN_STANDARDS.md` los roles de diseño, `BRIEF.md` / `docs/product/` los de producto.
4. Cada regla de diseño tiene un solo hogar y ninguna copia: los cuatro criterios del dueño y las reglas que quedan están en `DESIGN_STANDARDS.md`, y la Icon and text rule y la Design capture están en sus archivos de `docs/product/`, con solo una sección breve para cada una en `DESIGN_STANDARDS.md`. Las definiciones del glosario se quedan y remiten al hogar.
5. Todo seguimiento abierto de "difiere del dibujo", los seguimientos de revisión de la Design capture incluidos, fue revisado contra la regla 1. Los que la regla deja sin sentido se cierran con una nota que cita la regla 1. El PM decide los dudosos con la misma prueba. El resto queda abierto.
6. Los cuatro criterios se leen juntos, en el mismo orden y con los mismos números, en `BRIEF.md` y `DESIGN_STANDARDS.md`. La prueba del criterio 4 está enunciada en ambos con su veredicto, y un rol puede aplicarla a un caso concreto (tipo de producto, unidades, moneda, medios de pago, reglas de precios, canales, etcétera) sin preguntarle al PM.
7. Quien revisa puede decir, a partir de un solo diff, si un finding del criterio 4 extiende una elección existente (se registra, se fusiona) o es la suposición propia del trabajo nuevo (bloquea), usando la prueba de `DESIGN_STANDARDS.md` "Assume nothing".

## Métricas

- Findings o issues de "difiere del dibujo" abiertos después de que los criterios entren en vigor que no pasan la prueba de la regla 1: objetivo 0.
- Tareas bloqueadas, o flujos de teléfono ya entregados que se reabren, por una brecha de pulido: objetivo 0.
- Tareas de pulido abiertas a partir de un finding en lugar de programadas por el dueño o el PM: objetivo 0.
- Dos chequeos, ambos verdaderos: `BRIEF.md` enuncia el usuario principal y la línea de prioridad que remite a `DESIGN_STANDARDS.md`, y `DESIGN_STANDARDS.md` tiene las reglas 1 y 2.
- Texto de reglas de diseño que está en dos lugares a la vez: 0.
- Definiciones del glosario que todavía llevan texto de reglas que se mudó: 0.
- Proporción de seguimientos abiertos de "difiere del dibujo" revisados: 100%.
- Seguimientos cerrados que llevan una nota que cita la regla 1: 100%.
- Casos dudosos sin decidir: 0.
- La prueba del criterio 4 se lee idéntica en `BRIEF.md` y `DESIGN_STANDARDS.md`: verdadero.
- La prueba de extensión se lee idéntica en `DESIGN_STANDARDS.md` "Assume nothing" y en el "Despliegue" de este archivo: verdadero.
- Redacción en `BRIEF.md`, `DESIGN_STANDARDS.md`, `CONTEXT.md` o este archivo que presente las restricciones actuales del brief como reglas para el trabajo nuevo: 0.
- PRDs, diseños o revisiones nuevos, después de que el criterio 4 entre en vigor, que fijan sin un finding una palabra, unidad, campo, lista de opciones o valor por defecto para todos los negocios: objetivo 0.
- Cambios fusionados con un finding del criterio 4 sin resolver sobre una suposición propia: 0.
- Findings del criterio 4 sobre extensiones de elecciones fijas existentes registrados sin un enlace a #330: 0.
- Presets listos por tipo de negocio introducidos: 0.

## Fuera de alcance

- Reescribir cualquier regla que se mudó.
- Cambiar el contenido de `gate.md`, `navigation.md` o `product-language.md`; solo se actualizan los enlaces a archivos movidos.
- Cambiar el Mobile check, sus listas de infractores o sus condiciones de crecimiento.
- Un chequeo permanente de citas de archivos de `docs/product/` que se quitaron.
- Mudar el estándar móvil fuera de `CODING_STANDARDS.md` §10, o quitar su duplicado en el README del diseño.
- Reabrir o quitar diseños existentes específicos de la computadora (ADR-0044).
- Programar cualquier tarea de pulido.
- Cualquier cambio a lo que la app hace para un vendedor.
- Editar las líneas de restricciones del brief, el barrido de las suposiciones existentes (#330) y el modelo personalizable (#318).
