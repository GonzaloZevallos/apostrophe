---
status: accepted
date: 2026-11-10
---

# Home no muestra avisos de primer uso y `/onboarding` en `finish` termina el Onboarding

GH-560, parte 3. Enmienda docs/adr/0046-the-first-run-facts-live-in-their-own-table-and-a-read-stamps-them-in-a-second-guarded-phase.md
sin reescribirlo. El dueño sacó los avisos de primer uso de Home (`docs/design/redesign/registro-unificado.md`,
"Se sacan los avisos de primer uso"). Hasta ahora el aviso del Onboarding de Home era la única forma de
llegar a "Done" para un Business con todos los pasos hechos o pasados fuera del Onboarding, y de ahí
terminarlo. Sin el aviso, esa forma tiene que vivir en la propia dirección `/onboarding`.

## Decision

1. **El lugar de Home de ADR-0046 ya no existe.** Home no muestra el aviso del Onboarding, la checklist,
   "Start with your products" ni el aviso posterior a la Spreadsheet import. De ADR-0046 siguen, sin
   cambios, la tabla `first_run` y sus tres marcas, `GET /first-run` con su respuesta y sus lectores el
   Shell (la línea de precio faltante de "+ New sale") y Products ("Send catalog" deshabilitado con su
   motivo). `POST /first-run/import-notice/dismissal` y el indicador `import_notice` no tienen lector;
   quitarlos, o adelgazar `/first-run`, es una decisión aparte y este ADR no la toma.
2. **Home no lee `/first-run` ni `/onboarding-progress`.** `OnboardingLayout` es el único que llama
   `useQuery(onboardingProgressQuery)`, con `gcTime: 0`, así que cada visita al Onboarding lee el
   servidor.
3. **`/onboarding` en `finish`** (cada paso hecho o pasado, Onboarding sin terminar) manda
   `POST /onboarding-progress/advance` una sola vez por montaje, protegido con un `useRef` para que
   StrictMode no mande dos, y muestra "Done" reemplazando su entrada del historial. La entrada
   (`OnboardingEntry`) maneja cada respuesta por su cuenta y no depende del argumento de ningún
   llamador:
   - `over: true` abre "Done";
   - sin terminar y con un paso para retomar, va a ese paso;
   - sin terminar y con `finish` o `null`, va a Home;
   - sin red, "No connection"; un `ApiError` de registro inexistente, Home; cualquier otro error, el
     reintento genérico.

   Mientras el pedido vuela, la entrada muestra la forma de carga del layout. Para un Business cuyo
   Onboarding terminó, o que nunca tuvo uno, la dirección sigue llevando a Home. "Done" ya no manda
   `advance` desde ninguna parte.
4. **Enunciado de la sección 8 (CODING_STANDARDS).** Abrir `/onboarding` con la Session puesta ahora
   puede disparar un pedido que ya existe:
   - solo puede terminar el Onboarding del Business de la propia Session, y solo en `finish`, que es
     el fin al que la persona llegaría tocando hasta "Done";
   - el pedido no nombra ningún Business (sección 9): el Business sale de la Session;
   - en cualquier otro estado, `advance` no escribe nada, y sobre un Onboarding ya terminado no
     commitea nada;
   - el `GET` de la página no escribe; el `POST` es un pedido de la propia app, y la cookie de Session
     es `SameSite=Lax`, así que una página de otro sitio no puede mandarlo con una Session;
   - no hay ruta nueva ni entrada nueva.

## Consequences

- La app no tiene ningún aviso, marca ni link a `/onboarding` en Home, Settings o More. Un User que
  deja el Onboarding antes de "Done" lo termina desde Settings y la página del Product, que guardan lo
  mismo que cada paso, o vuelve a abrir `/onboarding`.
- Un Business con la configuración completa fuera del Onboarding termina su Onboarding la primera vez
  que abre `/onboarding`, no al ver Home; un Business que nunca lo abre queda con el Onboarding
  abierto sin efecto visible.
- Las reglas laterales de la checklist siguen leyéndose de `/first-run`; el front deja de dibujarla.
  `api/firstRun.ts` conserva `dismissImportNotice`, que ninguna pantalla llama.
- Se borran del registro de diseño los 9 renglones de los avisos y los 2 dibujos
  (`InicioPrimeraVez`, `InicioPrimeraVezCompu`); no cambia ningún otro dibujo.
