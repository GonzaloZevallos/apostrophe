/**
 * apostrophe · formatos
 *
 * Las reglas del negocio, en un solo lugar:
 *   plata   → pesos enteros con punto de miles, nunca centavos.  $ 11.000
 *   gramos  → hasta dos decimales con coma.                      3,5 g
 *   fechas  → dd/mm, y dd/mm/aaaa cuando cambia el año.          02/10
 *   semana  → de lunes a domingo.                                28/09 – 04/10
 */

const LOCALE = 'es-AR';

const fmtPlata = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const fmtGramos = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** `11000` → `"$ 11.000"`. Negativos: `"− $ 8.000"` (guión largo, no menos ASCII). */
export function plata(monto: number, opciones?: { signo?: boolean }): string {
  const n = Math.round(monto);
  const abs = fmtPlata.format(Math.abs(n));
  if (n < 0) return `− $ ${abs}`;
  if (opciones?.signo && n > 0) return `+ $ ${abs}`;
  return `$ ${abs}`;
}

/** Sin el símbolo, para cuando la columna ya dice que es plata. */
export function plataSinSimbolo(monto: number): string {
  return fmtPlata.format(Math.round(monto));
}

/** `3.5` → `"3,5 g"` · `10` → `"10 g"`. */
export function gramos(g: number): string {
  return `${fmtGramos.format(redondearGramos(g))} g`;
}

/** Los gramos se guardan con dos decimales como mucho. */
export function redondearGramos(g: number): number {
  return Math.round(g * 100) / 100;
}

/** `"$ 10.000/g"` — el precio unitario que se muestra en cada línea. */
export function precioPorGramo(monto: number): string {
  return `${plata(monto)}/g`;
}

/* ------------------------------------------------------------------ */
/* Fechas                                                              */
/* ------------------------------------------------------------------ */

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** `"02/10"`, o `"14/12/2025"` si no es del año de referencia (hoy por defecto). */
export function fecha(d: Date, referencia: Date = new Date()): string {
  const base = `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}`;
  return d.getFullYear() === referencia.getFullYear()
    ? base
    : `${base}/${d.getFullYear()}`;
}

/** Siempre con año. Para fichas y detalles donde no hay contexto. */
export function fechaLarga(d: Date): string {
  return `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** El lunes de la semana de `d`, a las 00:00. */
export function inicioSemana(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dia = x.getDay(); // 0 domingo … 6 sábado
  const aRestar = dia === 0 ? 6 : dia - 1;
  x.setDate(x.getDate() - aRestar);
  return x;
}

/** El domingo de la semana de `d`, a las 23:59:59.999. */
export function finSemana(d: Date): Date {
  const x = inicioSemana(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** `"28/09 – 04/10"`. */
export function rangoSemana(d: Date, referencia: Date = new Date()): string {
  const a = inicioSemana(d);
  const b = finSemana(d);
  return `${fecha(a, referencia)} – ${fecha(b, referencia)}`;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** `"Septiembre 2026"`. */
export function mesLargo(d: Date): string {
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Días completos entre dos fechas, ignorando la hora. */
export function diasEntre(desde: Date, hasta: Date): number {
  const a = Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** `"desde el 14/09"` para las deudas. */
export function desdeCuando(d: Date, referencia: Date = new Date()): string {
  return `desde el ${fecha(d, referencia)}`;
}

/* ------------------------------------------------------------------ */
/* Teléfonos                                                           */
/* ------------------------------------------------------------------ */

/** Deja sólo dígitos y el `+`, para buscar y comparar. */
export function normalizarTelefono(t: string): string {
  const limpio = t.replace(/[^\d+]/g, '');
  return limpio.startsWith('+') ? limpio : `+${limpio}`;
}

/** `"+5491160337725"` → `"+54 9 11 6033-7725"`. Si no reconoce el formato, lo devuelve igual. */
export function telefono(t: string): string {
  const d = normalizarTelefono(t).replace('+', '');
  const m = d.match(/^54(9)?(11|\d{2,4})(\d{4})(\d{4})$/);
  if (!m) return t;
  const [, nueve, area, a, b] = m;
  return `+54${nueve ? ' 9' : ''} ${area} ${a}-${b}`;
}
