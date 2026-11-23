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

## No hecho en esta entrega

- Las dos corridas en la base `6a0b0e8c`: se intentaron desde un `git archive` de la base y la muestra no arrancó (`sample-app: the server exited before answering /health`), así que no hay AE base contra base ni head contra base de `ConfiguracionCompu`. "Sin cambios" de ConfiguracionCompu queda sin medir; va al dueño.
- Las capturas a 320 y 430 px, el proyecto `mobile` de e2e y la corrida a mano del caso sin conteo con `/business` bloqueado no se corrieron por el tope de turnos.

## Razonamiento del estado sin conteo

`settle` espera `networkidle` tras cada paso, y el stub de `/business` se responde dentro del navegador, así que la medición no ocurre antes de que llegue el 500. `GatedLayout` falla solo con `me`, de modo que la página sobrevive. El estado prueba solo que la página dibuja tras un 500 asentado; el lugar vacío lo prueban `SettingsHome.test.tsx:136` y la corrida a mano. Un `networkidle` vencido lo traga `settle`.
