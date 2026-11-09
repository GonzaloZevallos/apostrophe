# Mobile check

## Jobs

- Cuando una regla escrita para un cambio resulta imposible para pantallas que los chequeos recorren siempre, quiero que la regla y sus tests digan lo que de verdad se cumple, con el motivo al lado, para que el cambio se pueda aprobar, y los cambios posteriores se puedan revisar, sin volver a discutir la misma contradicción. (Job del mantenedor, GH-305, seguimiento de GH-274.)

## Qué es

El **Mobile check** es parte del **Gate**. Recorre las filas de teléfono del registro de pantallas y falla ante cualquier infracción del estándar móvil que no figure en las listas de infractores de `web/src/mobile-standard/offenders/`. Los vendedores nunca lo ven. Cómo pueden cambiar las listas de infractores está escrito en un solo lugar, `docs/product/gate.md` ("Listas de infractores del estándar móvil"), y este archivo no repite esa regla.

## Invariantes que se cumplen

1. **Listas de infractores.** Crecen solo como lo permite gate.md. Las entradas `InicioChecklist` (Home con la **First-run checklist**) e `InicioImportado` (Home con el aviso posterior a la **Spreadsheet import**) de `touch-action.json` son un crecimiento por fila nueva del registro de GH-274, y cada una lleva su motivo. GH-305 no agregó ninguna otra entrada y no quitó ninguna. GH-650 (parte 1 de GH-560) retiró esas dos filas del registro junto con sus dibujos, y sus entradas de `touch-action.json` salieron en el mismo cambio.
2. **Aserciones del registro.** En `web/src/design/screens.test.ts`, toda aserción queda como estaba antes de GH-274 salvo estas dos, cada una marcada como deliberada con su motivo:
   - la sección `InicioHoyCompuOscuro` es `HOY_PHONE`, ya no undefined;
   - la llamada `assertSelectedAccounts` del mapa real corre sobre el mapa completo extendido.

   Cada una de las dos sigue fallando si la pantalla o el mapa que protege retrocede.
3. **Nada oculto ni aflojado.** No se oculta ni se afloja nada para que una regla escrita se cumpla. Un Gate en verde significa que no hay regresión, y uno en rojo significa una regresión del producto.
4. **Dónde viven las reglas corregidas.** Están junto al código que gobiernan: en las entradas de las listas de infractores, en los tests y en gate.md. Un plan pasado queda como registro cerrado y no se enmienda.

## Fuera de alcance

- Cualquier pantalla, copy o comportamiento que vea el vendedor.
- Las **Design capture**s. Son evidencia de revisión y nunca un paso del Gate.

## Métricas

- **Gate:** en verde con el cambio, sin ningún infractor oculto.
- **Crecimiento de las listas de infractores:** comparadas con la base de GH-274, las listas crecen exactamente por las entradas de `InicioChecklist` e `InicioImportado`, cada una con su motivo. Quitadas: 0.
- **Aserciones del registro reescritas:** exactamente 2. Las dos están marcadas como deliberadas con su motivo, y a cada una se la muestra fallando sobre una entrada con regresión.
- **Findings abiertos:** 0 findings `important` abiertos en GH-274 sobre estos dos invariantes.
- **Cambios visibles al vendedor:** 0 (pantallas, copy, comportamiento).
