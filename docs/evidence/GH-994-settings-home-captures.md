# GH-994: capturas de la pantalla de inicio de Settings

Evidencia de Design para `Configuracion`, `ConfiguracionOscuro` y `ConfiguracionCompu`. Los PNG se adjuntan al pull request y no se versionan.

## Qué se corrió

- Head: la rama de este pull request, sobre la base `6a0b0e8c` con #927 (`9ecb43d7`).
- Comando: `scripts/design/compare.sh --strict --out <dir>`, sobre el registro completo, sin `--only`, en una muestra nueva.
- `scripts/design/screens.json` no cambia: la fila `ConfiguracionOscuro` (`tema "oscuro"`) ya está en la línea 221.

## Celdas

| Fila | Ancho | Resultado en head |
| --- | --- | --- |
| `Configuracion` | 375 (el de la fila del registro) | ok |
| `ConfiguracionOscuro` | 375 | ok |
| `ConfiguracionCompu` | 1280 | ok |

Las filas `--strict` que no llegaron a ok en la corrida de head son `ClientesAvisoDeudores` (el estado no se alcanzó en 8 s tras 3 intentos) y `VariedadesCompu` (la página cambió al crecer el viewport), más las filas sin pantalla construida. Ninguna es una pantalla de Settings; van al dueño en el informe de cierre.

## Lo visto

- `Configuracion`: el dibujo (Hoy / Ajustes, búsqueda, tarjeta con chevron, nueve filas) y lo construido (Home / Settings, tarjeta de solo lectura "La Huerta · 1 user", tres atajos, cinco encabezados) difieren en las cuatro cosas que settings.md acepta (atajos, tarjeta sin chevron ni rol, sin búsqueda, cinco grupos). La tarjeta lee "1 user", que es el `SAMPLE_USER_COUNT` del estado `ConfiguracionTarjeta`. La barra inferior se dibuja sobre la fila Payment methods por ser una captura de página entera.
- `ConfiguracionOscuro`: lo mismo en oscuro; tokens oscuros en tarjeta, atajos y filas, sin texto ilegible.
- `ConfiguracionCompu`: lista de siempre de la computadora (Business, Users, Prices, Payments and expenses, Integrations, Catalog message, Appearance, Your account), sin cambios respecto de #927.

## Mobile check (proyecto `mobile` de e2e, head `ad494d9a`)

`npm run e2e -- --project=mobile --workers=4 --timeout=1800000`: 57 pasaron, 1 falló.

- Primera corrida (`386e959c`): `ConfiguracionTarjeta` se alcanzó; `ConfiguracionTarjetaSinConteo` quedó `unreachable` en 320 y 375. Causa: el estado esperaba el texto exacto "Settings" y la espera toma el primer elemento con ese texto, que no es visible. Se cambió su `visible` a la etiqueta de la primera fila (`settings:rows.businessName.label`, "Business name"), y una sonda a 375 px dio ambos estados sin `unreachable`.
- Segunda corrida: las celdas de 320, 375 y 430 px, en claro y en oscuro, pasaron con los dos estados alcanzados y ningún infractor nuevo (`unlisted: []`). Eso cubre `Configuracion` y `ConfiguracionOscuro` a 320, 375 y 430.
- La única falla es la celda 246x437 oscuro: un infractor ya listado, `data-while-loading` en `VariedadNueva` (issue 47), no apareció esta vez (`fixedButListed`). No es una pantalla de Settings ni un infractor agregado; depende de los tiempos bajo carga (la primera corrida, con 600 s de tope por celda, venció en 430 y 246). Ninguna lista de infractores se tocó.

## Razonamiento del estado sin conteo

`settle` espera `networkidle` tras cada paso, y el stub de `/business` se responde dentro del navegador, así que la medición no ocurre antes de que llegue el 500. `GatedLayout` falla solo con `me`, de modo que la página sobrevive. El estado prueba solo que la página dibuja tras un 500 asentado; el lugar vacío lo prueban `SettingsHome.test.tsx:136` y la corrida a mano. Un `networkidle` vencido lo traga `settle`.
