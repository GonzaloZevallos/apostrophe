---
status: accepted
date: 2026-11-25
summary: "un Payment guarda las iniciales de quien lo registró, copiadas al registrarlo (cada cluster en mayúsculas y cortado a 16 code points, con ? solo si la parte local es solo U+FEFF); la clave foránea al User se anula sola (SET NULL) y las iniciales quedan, y son ellas, no la clave, las que deciden si se contestan recorded_by y recorded_at"
---

# Un Payment guarda las iniciales de quien lo registró, copiadas al registrarlo

GH-1106, parte 3 de 3 (base de GH-1057). No reemplaza ningún ADR. Se apoya en el ADR
20261120 (`20261120-the-customer-account-is-a-ledger-walk-not-a-settlement-view.md`):
`recorded_at` sigue siendo el reloj de desempate de `ledger_key` y no se agrega ningún
otro. Esta parte entrega solo el `Recorder`, la dependencia `CurrentRecorder` y los
helpers `name_of`, `FALLBACK_INITIALS` y `recorder_initials`; ningún router los usa
todavía. Todo lo que sigue y diga "se decide" lo construyen partes posteriores de GH-1057:
está decidido, no entregado.

## Decisión

1. **Las iniciales se copian al registrar el Payment.** Salen de la parte local del email
   del propio User con `initials_of` (docs/product/initials.md): cada cluster en
   mayúsculas y después cortado a 16 code points. Quedan guardadas como un dato del
   Payment y nunca se recalculan.
2. **El corte a 16 code points también rige para el avatar.** Es el único cambio visible
   (entregado en #1111) y solo se nota con un cluster de más de 16 code points. Como el corte
   va después de pasar a mayúsculas y puede caer dentro de un cluster (un ZWJ colgado o una marca
   suelta al final de una secuencia larga), el valor es válido y se guarda tal cual: no es un
   bug.
3. **El fallback `?`** (`FALLBACK_INITIALS`) se usa solo cuando `initials_of` da `''`. Entre
   los emails que `Email` acepta, eso pasa solo con una parte local hecha únicamente de U+FEFF.
   Un nombre hecho solo de code points invisibles que no son espacio en blanco (U+200B, por
   ejemplo) conserva sus iniciales invisibles: la marca es un dato guardado y no se reescribe
   según una suposición sobre qué se ve. La marca nunca es vacía y nunca supera 32 code points
   (`MAX_INITIALS`, dos clusters de hasta 16).
4. **Los clusters de Python siguen UAX #29, salvo por los caracteres Prepend y los conjuntos
   índicos**, un hueco con nombre y aceptado: da una división menos exacta que la del
   navegador, nunca una marca vacía ni de más de 32 code points.
5. **La clave foránea al User se anula sola** (`ON DELETE SET NULL`) cuando el User se va, y
   las iniciales quedan.
6. **El nombre se lee en el momento**, filtrado por el Business, y es null cuando el User ya
   no está.
7. **Las iniciales, nunca la clave foránea, deciden** si se contestan `recorded_by` y
   `recorded_at`. `recorded_at` sigue siendo el único reloj.
8. **El Business export lleva las iniciales como dato guardado y a quien registró por su
   email.** Los Payments que ya existían no reciben un registrador inventado y exportan los
   dos como null.
9. **El esquema no ata a quien registró con el Business del Payment.** La garantía es el
   camino de escritura (siempre el User de la propia Session) más la lectura filtrada. Una fila
   cruzada entre Businesses hace que el export de ese Business se niegue antes de borrar nada.
10. **Toda futura eliminación de un User debe conservar las iniciales.**

## Quién construye qué, y el test que debe agregar

- **La columna de quien registró en Payment** (capability `payments`): una clave foránea
  nullable con `ON DELETE SET NULL` más las iniciales. Test de migración que verifique la
  clave nullable con `ON DELETE SET NULL`.
- **El Business export** (capability `business_removal`): test de que una fila cruzada entre
  Businesses se niega antes de borrar nada, y de que los Payments existentes exportan
  iniciales y email de quien registró en null.
- **Una futura eliminación de un User** (capability `accounts`): test de que las iniciales
  se conservan.
- **El primer router que use `CurrentRecorder`** debe pasar el barrido de rutas con sesión y el
  de aislamiento entre Businesses.

## Consecuencias

- `app/shared/recorder.py` (`Recorder`, `InvalidRecorder`, `MAX_INITIALS`) es el único lugar
  del límite de 32; no importa ninguna capability. Su mensaje de error nombra la regla, nunca
  el id ni las iniciales.
- `current_recorder` nunca lanza para ningún email que `Email` acepte.
- Una marca guardada puede terminar en un code point suelto; quien la muestre no debe
  suponer que es un grafema completo.
- Sin la clave foránea, un Payment viejo conserva sus iniciales aunque su User ya no exista;
  sin las iniciales, el Payment no contesta quién lo registró.
