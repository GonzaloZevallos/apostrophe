# GH-573 — flake de `web-tests` (GH-559, head `81745086`)

**Resultado (b): no se reprodujo, tope alcanzado en las tres patas. La causa del rojo de GH-559 NO está demostrada y sigue sin conocerse. No se cambió ningún test.**

- `shuffle`: 6 seeds (el tope), 0 rojos. `full-load`: 6 iteraciones (el tope), 0 rojos. `census`: 10 iteraciones (el tope), 0 rojos.
- Como no hubo rojo, no hay arreglo ni par forzado. Un 0 en estas corridas describe la carga de esta máquina en esta ventana, no es una prueba de que el flake no exista.
- Reloj: de `2026-11-04T18:16:54Z` a `19:45:52Z`, 1 h 29 min, dentro del tope de 3 h. Ninguna pata fue reaped ni reiniciada: el log tiene 8 líneas `start`, una por invocación (6 de `shuffle`, 1 de `census`, 1 de `full-load`), todas con `logged=` igual a las iteraciones ya hechas.
- Sin cambios fuera de tests: `git diff 5c278d22 -- web/src ':!*.test.*' ':!web/src/test/**'` vacío; `git diff 5c278d22 -- web/vite.config.ts web/src/test-setup.ts` vacío; `git diff 5c278d22 --stat -- web` vacío (no se tocó nada de `web/`).

## 1. Qué falló y qué árbol

Fuente: `.agentic/tasks/GH-559.md`, línea 62: el flake de `web-tests` en el gate `full_checks`, head `81745086`, `tests: []`. Ni el registro ni los logs de GH-559 conservan la salida de vitest: **archivo, test y mensaje que fallaron: no se conservaron.**

| Qué | Hash |
|---|---|
| `git rev-parse 81745086:web` | `de432789e57c4417b7341c93da933c0222946f26` |
| `git rev-parse 5c278d22:web` (base de esta tarea) | `de432789e57c4417b7341c93da933c0222946f26` |
| `git rev-parse HEAD:web` en esta tarea | `de432789e57c4417b7341c93da933c0222946f26` |
| árbol completo de `81745086` | `20ea9c7165e25f5ca58c54725456b5425a4b823d` |
| árbol completo probado por las corridas (base + script de evidencia) | `d895687008f0243014cc1b1ade489f269a72a2f5` |

El `web/` de la base es el mismo árbol que se puso rojo: `81745086` no toca nada bajo `web/` y `git log 81745086..5c278d22 -- web` es vacío. El rojo vino entonces del `web/` de master bajo la carga del gate. El registro guarda un solo head para la corrida roja y la verde (misma salvedad que GH-506). Las corridas se hicieron en el checkout de la tarea; el hash completo difiere del de `81745086` solo por los archivos de evidencia.

## 2. Corridas

Script: `docs/evidence/GH-573/stress.sh`, copia de `docs/evidence/GH-506/stress.sh` con un solo modo nuevo, `census` (`npx vitest run --project census` con las cuatro compañías en bucle), y `shuffle` con la semilla aleatoria como antes. Es reanudable y se niega a correr si el árbol del checkout no es el pedido. Log: `docs/evidence/GH-573/stress.log` (una línea `iter` por iteración terminada). Un `driver` fuera del repo llamó al script con tope 1, 2, ... 6 en `shuffle` para poder parar en el primer rojo; por eso hay una línea `summary` por llamada y no una sola. Sin rojos no se paró antes del tope.

Conteos de `vitest list` en la base (`docs/evidence/GH-573/vitest-list-base.txt` y `vitest-list-files-base.txt`): 263 archivos, 2821 líneas de test. En la cabeza (sin cambios en `web/`): la lista ordenada es idéntica (`diff` sin salida), 263 y 2821. Las corridas completas dan `Test Files 262 passed | 1 skipped (263)`, `Tests 4046 passed | 4 skipped (4050)` en las 12 iteraciones de `shuffle` y `full-load`; `census`: `Test Files 1 passed (1)`, `Tests 6 passed (6)` en las 10.

| Pata | n | rojos | tope | seeds / notas |
|---|---|---|---|---|
| `shuffle` | 6 | 0 | 6 | 405060, 449805, 815770, 346982, 597742, 41928 |
| `census` | 10 | 0 | 10 | bajo pytest `-n 8`, mypy, tsc y build en bucle |
| `full-load` | 6 | 0 | 6 | las mismas compañías |

```
summary tree=d895687008f0243014cc1b1ade489f269a72a2f5 mode=shuffle n=6 red=0 cap=6 time=2026-11-04T18:52:51Z
summary tree=d895687008f0243014cc1b1ade489f269a72a2f5 mode=census n=10 red=0 cap=10 time=2026-11-04T18:58:47Z
summary tree=d895687008f0243014cc1b1ade489f269a72a2f5 mode=full-load n=6 red=0 cap=6 time=2026-11-04T19:45:52Z
```

Carga de la máquina (`loadavg` de 1 min, 16 CPU, con otras tareas ajenas): `shuffle` 8 a 28; `census` y `full-load` 9 a 26. Las compañías corrieron de verdad: p. ej. `full-load` n=3: `pytest` started=2 finished=1, `mypy` started=295 finished=294, `typecheck` started=7 finished=6, `build` started=7 finished=6, todas con `fastfail=0`. Cada iteración de `census` duró unos 35 s, mucho menos que `pytest`, por eso el `pytest` de esa pata apenas termina una corrida; `mypy`, `typecheck` y `build` sí giraron.

Rojos: ninguno, así que no hay archivos `stress-red-*.txt` y no hay seed que reproducir dos veces.

## 3. Arreglo y par forzado

No aplica: ninguna pata dio rojo, no hay comando determinista que reproduzca nada. Los invariantes se cumplen trivialmente: no se añadió ni quitó `test(` ni `it(`, no hay reintento ni plazo más largo ni `skip`.

## 4. Para seguimiento

**Hallazgo para agentic-system (fuera de esta tarea, no bloquea el merge).** Cuando el gate ve un flake, el registro guarda `flakes[].tests: []` y descarta la salida de vitest de la corrida roja. Ya pasó dos veces: GH-465 (`4c6596b6`) y GH-559 (`81745086`). El registro debería conservar las líneas `FAIL <archivo> > <test>` de la corrida roja; sin ellas toda diagnosis posterior parte de cero, como esta.

**Hermanos del defecto de estado filtrado (clase GH-506: singleton `router`, `paymentReturn` sin consumir).** Esta búsqueda no halló ninguno, porque ningún seed dio rojo; no hay lista medida. Sigue valiendo la lista de candidatos de GH-506 §4 (tests que usan el `router` singleton sin reiniciar el historial) para un issue de seguimiento si se quiere cubrir más seeds: 6 seeds sobre 263 archivos son una muestra pequeña.
