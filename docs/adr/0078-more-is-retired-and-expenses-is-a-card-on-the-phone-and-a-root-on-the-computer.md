---
status: accepted
date: 2026-11-09
---

# More is retired and Expenses is a card on the phone and a root on the computer

GH-651, parte 2 de GH-560.

## Contexto

El 2026-11-02 el dueño retiró la pantalla More (`docs/design/redesign/registro-unificado.md`). En el celular, More era el único camino a cinco lugares: Settings, Analysis, Expenses, Add expense y Take from stock. Los dibujos aprobados ponen cada uno en la pantalla donde ya vive su contexto. La barra lateral de la computadora ya llega directo a Settings, Expenses y Analysis, y no cambia.

## Decisión

- **More desaparece.** La barra del celular es Home, Sales, Customers, Products. No hay pantalla More, ni pestaña More, ni entrada `MORE` en el registro de pantallas. `docs/product/navigation.md` es el enunciado de producto.
- **Cada destino tiene una sola entrada, construida sobre la pantalla que ya existe:**
  - Settings: un botón de avatar en el encabezado de Home, Sales, Customers, Products, Analysis y Expenses en el celular. Su nombre accesible es la palabra fija "Settings". Reemplaza al avatar del Business de Home, así que cada pantalla tiene una sola entrada a Settings. La computadora conserva la fila del Business de la barra lateral y no recibe avatar en el encabezado.
  - Analysis: un segmento Today | Analysis en Home, repetido en Analysis con "Analysis" elegido. En el celular, Analysis es un Tab root que marca Home como pestaña activa.
  - Expenses y Add expense: una tarjeta Expenses en Analysis, con "Add expense" (el formulario de Expense con la fecha de hoy) y "See the expenses".
  - Take from stock: el botón secundario que Products ya muestra junto a "+ Stock entry". Recibe un test en ese punto de entrada y no lleva código nuevo.
- **Expenses es la única pantalla cuyo tipo depende del ancho.** En el celular es una tarjeta con "‹ Analysis" y en la computadora es un Tab root, porque la barra lateral no cambia. El registro del front (`web/src/routes.ts`) lo expresa con el tipo `card-on-phone`, y `scripts/design/screens.json` con `kind: "card"` y `computer_kind: "root"`. El campo del registro es `declaredKind` y se lee solo a través de `kindOf(screen, viewport)`, así que ningún lector puede elegir el ancho equivocado. La regla "un tipo por pantalla" vale por viewport; Expenses es la única excepción con nombre.
- **Una pantalla puede marcar otra pestaña, o ninguna.** `Place.bar` puede ser `null`: Settings (una tarjeta) no marca ninguna pestaña, y Analysis y Expenses en el celular marcan Home.
- **`/mas` y `/more` caen en Home a propósito.** `/mas` sale de las redirecciones viejas del servidor, y las dos direcciones quedan bajo la regla existente de que una dirección desconocida va a Home. Ninguna redirección ni ningún test nombra a una de las dos. Es la única excepción a "cada path viejo en español redirige".
- **`Mas.dc.html` se queda en `docs/product/design-system/pantallas/`, sin editar.** Los dibujos son copias exactas de una fuente aprobada y nunca se editan. Las filas `Mas` y `MasOscuro` salen de `screens.json` con sus infractores, en el diff que quita la pantalla construida. Ningún test falla por un dibujo que ninguna fila usa.
- **Un escaneo la mantiene retirada.** Un test de arquitectura falla si `web/src`, `web/e2e` o `tests` vuelven a nombrar More o `/more`. "More info" (`MasInfo`), un término asentado del glosario, pasa.

## Por qué

- Lo decidió el dueño, y los dibujos ubican cada entrada. La ubicación sigue los dibujos aunque otro lugar ahorrara un toque; el presupuesto de toques de navigation.md se reescribe para coincidir (Expense en 2 toques desde Home y 3 desde los otros roots, Settings en 1, Stock withdrawal en 2).
- Dejar la barra lateral sin cambios obliga al único tipo que depende del ancho. Expresarlo en un solo campo del registro, leído por una sola función, lo mantiene como una excepción visible y no como un condicional repartido por las pantallas.
- Redirigir `/mas` a una pantalla concreta sugeriría que el menú viejo todavía tiene sentido; ninguno de sus destinos es un lugar único.

## Consecuencias

- Nada alcanzable en el celular se pierde: los cinco destinos tienen una entrada y un test de Testing Library en ella. Un destino sin lugar en los dibujos se lista en el PR, nunca se pierde en silencio.
- Un favorito viejo a `/mas` abre Home sin ningún mensaje.
- Los chequeos del registro leen el tipo del celular; el test de cobertura de rutas compara `computer_kind`.

## Descartado

- **Un menú o una pantalla nueva que reúna los destinos.** Es lo que el dueño retiró.
- **Un avatar en el encabezado de la computadora.** La barra lateral ya tiene la fila del Business; la computadora no cambia.
- **Dos pantallas para Expenses, una por ancho.** Mismo contenido, misma ruta; solo cambia el marco.
- **Un destino propio para `/mas`.** Alcanza con Home, y cada destino tiene su propia entrada.
