/**
 * The stylesheet's pressed block (from its marker comment) exactly as it stands at `bdc2945` (#102's approved
 * head), where `.opcion-interruptor` sits in the scaling `--superficie` group: the input
 * stretched over the label then stops receiving the click. A fixture for the `pressedOn`
 * check in `touch.test.ts`, which must reject it.
 */
export const PRESSED_BLOCK_AT_BDC2945 = `/* pressed */
/* The pressed state (GH-77, GH-102): of every control a finger can tap, from tokens only.
 * Two cues, neither colour alone: the control shrinks a little (\`transform\`), and its
 * fill changes. \`transition: none\` so it shows the moment the finger lands. Never a
 * bare \`button\`, \`a\` or \`*\` rule: \`PasswordField\`'s reveal and the auth screens keep
 * the browser's own behaviour unless they wear one of these classes.
 * \`src/architecture/touch.test.ts\` finds every tappable control in the markup and fails
 * on one with no class in this block, so a new control lands here, or in its EXEMPT table.
 *
 * Controls rendered on a <button>, <a> or <Link> (each checked against its component):
 *   filled, so a --papel ring is the fill cue (it differs from the resting fill in both
 *   themes): .boton (with .boton--suave, .boton--destructivo and .boton-nueva-venta),
 *   .boton-icono, .periodos__boton, .pildora, .gastos__cargar, .aviso-ambar,
 *   .venta-guardada__deshacer, .cobrar, .interruptor;
 *   transparent, so --superficie is the fill cue: .boton-enlace, .boton--enlace,
 *   .boton--fila, .enlace-texto, .bar-inferior__item, .riel-lateral__item,
 *   .riel-lateral__negocio, .mas__item, .ajustes__item, .opcion-interruptor, .fila-venta,
 *   .fila-gasto, .fila-entrada, .fila-entrada__enlace, .lista-clientes__fila,
 *   .bloque-deben__titulo, .bloque-deben__fila, .bloque-deben__datos, .variedad-item,
 *   .variedad-fila, .variedades__todas, .catalogo__fila-nombre, .pestanas__opcion,
 *   .selector-pago__opcion, .gastos__mes-boton, .encabezado__volver, .historial-fila__borrar;
 *   resting on --superficie or --papel itself, so --linea is the fill cue (these come after
 *   the --superficie group): .inicio__avatar and .ajustes-tema__opcion, plain and --activa (the track is
 *   --superficie, the selected option --papel), and the selected variants
 *   .riel-lateral__item--activo, .riel-lateral__negocio--activo, .bar-inferior__item--activo,
 *   .pestanas__opcion--activa, .variedad-fila--activa and .selector-pago__opcion--activa.
 * Display-only rows (.encabezado-fila, .historial-fila and its other children, the
 * children of .fila-gasto) are left out: nothing happens when they are touched. */
:is(
    .boton,
    .boton-icono,
    .periodos__boton,
    .pildora,
    .gastos__cargar,
    .aviso-ambar,
    .venta-guardada__deshacer,
    .cobrar,
    .interruptor
  ):active:not(:disabled):not([aria-disabled='true']) {
  transform: scale(0.98);
  box-shadow: inset 0 0 0 3px var(--papel);
  transition: none;
}

:is(
    .boton-enlace,
    .boton--enlace,
    .boton--fila,
    .enlace-texto,
    .bar-inferior__item,
    .riel-lateral__item,
    .riel-lateral__negocio,
    .mas__item,
    .ajustes__item,
    .opcion-interruptor,
    .fila-venta,
    .fila-gasto,
    .fila-entrada,
    .fila-entrada__enlace,
    .lista-clientes__fila,
    .bloque-deben__titulo,
    .bloque-deben__fila,
    .bloque-deben__datos,
    .variedad-item,
    .variedad-fila,
    .variedades__todas,
    .catalogo__fila-nombre,
    .pestanas__opcion,
    .selector-pago__opcion,
    .gastos__mes-boton,
    .encabezado__volver,
    .historial-fila__borrar
  ):active:not(:disabled):not([aria-disabled='true']) {
  transform: scale(0.98);
  background-color: var(--superficie);
  transition: none;
}

/* These rest on --superficie or --papel (or paint nothing and sit on --superficie), so
 * their fill cue is --linea instead: it differs from the resting fill in both themes. The
 * rule comes after the --superficie group, which would otherwise win on source order. */
:is(.ajustes-tema__opcion, .ajustes-tema__opcion--activa, .inicio__avatar):active:not(:disabled):not([aria-disabled='true']) {
  transform: scale(0.98);
  background-color: var(--linea);
  transition: none;
}

:is(
    .riel-lateral__item--activo,
    .riel-lateral__negocio--activo,
    .bar-inferior__item--activo,
    .pestanas__opcion--activa,
    .variedad-fila--activa,
    .selector-pago__opcion--activa
  ):active:not(:disabled):not([aria-disabled='true']) {
  background-color: var(--linea);
}

/* A tap on a button, tab or the bar selects no text; text in lists and fields stays
 * selectable, since only these classes opt out. Rows whose text is the business's data
 * (.fila-venta, .variedad-fila and the like) are in the test's SELECTABLE table instead. */
:is(
    .boton,
    .boton-icono,
    .periodos__boton,
    .pildora,
    .gastos__cargar,
    .aviso-ambar,
    .venta-guardada__deshacer,
    .cobrar,
    .interruptor,
    .boton-enlace,
    .boton--enlace,
    .boton--fila,
    .enlace-texto,
    .bloque-deben__titulo,
    .bar-inferior,
    .riel-lateral,
    .riel-lateral__negocio,
    .mas__item,
    .ajustes__item,
    .ajustes-tema__opcion,
    .opcion-interruptor,
    .inicio__avatar,
    .variedades__todas,
    .pestanas,
    .selector-pago__opcion,
    .gastos__mes-boton,
    .encabezado__volver,
    .historial-fila__borrar
  ) {
  -webkit-user-select: none;
  user-select: none;
}

/* \`RetiroDetalle\`: a stock withdrawal's detail — its facts, lines and actions. */
.retiro__datos,
.retiro__lineas {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.retiro__dato {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.retiro__dato dd {
  margin: 0;
  font-size: 17px;
}

.retiro__linea {
  display: flex;
  justify-content: space-between;
  gap: var(--espacio-md);
  padding: var(--espacio-md) 0;
  border-bottom: 1px solid var(--linea);
  font-size: 17px;
}

.retiro__acciones {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-md);
}
`
