/**
 * apostrophe · motor de precios
 *
 * Una línea de venta se resuelve con una sola regla, y la app siempre muestra
 * cuál ganó. El orden es fijo:
 *
 *   regalo → especial → VIP → por cantidad → lista
 *
 * Confirmado con el negocio (grill del 02/10/2026): un cliente VIP paga el
 * precio "por cantidad" sin tener que llegar al mínimo de gramos. Ver
 * `precioVip`. El backend calcula y guarda el precio real de cada línea; esto
 * es para mostrarlo en vivo antes de guardar.
 */

import type {
  Cliente,
  LineaVenta,
  Precio,
  ReglaPrecio,
  Variedad,
} from './dominio';
import { redondearGramos } from './formato';

export interface EntradaCalculo {
  gramos: number;
  regalo: boolean;
  precioEspecialTotal: number | null;
  /** El precio que regía el día de la venta. */
  precio: Precio | null;
  /** null = venta sin cliente. */
  cliente: Pick<Cliente, 'vip'> | null;
}

export interface ResultadoLinea {
  precioPorGramo: number;
  total: number;
  regla: ReglaPrecio;
}

export class SinPrecioError extends Error {
  constructor(public readonly variedad?: Variedad['nombre']) {
    super(
      variedad
        ? `${variedad} no tiene precio para esa fecha`
        : 'La variedad no tiene precio para esa fecha',
    );
    this.name = 'SinPrecioError';
  }
}

/** El VIP paga el precio por cantidad, sin exigirle el mínimo de gramos. */
function precioVip(precio: Precio): number | null {
  return precio.porCantidad;
}

/**
 * Resuelve una línea. Tira SinPrecioError si no hay precio vigente y la línea
 * no es regalo ni tiene precio especial (ese es el error que muestra la UI).
 */
export function calcularLinea(e: EntradaCalculo): ResultadoLinea {
  const gramos = redondearGramos(e.gramos);

  // 1 · regalo
  if (e.regalo) {
    return { precioPorGramo: 0, total: 0, regla: 'regalo' };
  }

  // 2 · precio especial: se carga el total y se deduce el precio por gramo
  if (e.precioEspecialTotal !== null) {
    const total = Math.round(e.precioEspecialTotal);
    return {
      precioPorGramo: gramos > 0 ? Math.round(total / gramos) : 0,
      total,
      regla: 'especial',
    };
  }

  if (!e.precio) throw new SinPrecioError();

  // 3 · VIP
  if (e.cliente?.vip) {
    const ppg = precioVip(e.precio);
    if (ppg !== null) return conPrecio(ppg, gramos, 'vip');
  }

  // 4 · por cantidad
  const { porCantidad, minimoGramos } = e.precio;
  if (
    porCantidad !== null &&
    minimoGramos !== null &&
    gramos >= minimoGramos
  ) {
    return conPrecio(porCantidad, gramos, 'porCantidad');
  }

  // 5 · lista
  return conPrecio(e.precio.lista, gramos, 'lista');
}

function conPrecio(
  precioPorGramo: number,
  gramos: number,
  regla: ReglaPrecio,
): ResultadoLinea {
  return {
    precioPorGramo,
    total: Math.round(precioPorGramo * gramos),
    regla,
  };
}

/** Cómo se nombra cada regla en la interfaz. */
export const nombreRegla: Record<ReglaPrecio, string> = {
  regalo: 'regalo',
  especial: 'especial',
  vip: 'VIP',
  porCantidad: 'por cantidad',
  lista: 'lista',
};

/** El precio que regía una fecha: el más reciente con rigeDesde <= fecha. */
export function precioVigente(
  precios: Precio[],
  variedadId: string,
  fecha: Date,
): Precio | null {
  const candidatos = precios
    .filter((p) => p.variedadId === variedadId && p.rigeDesde <= fecha)
    .sort((a, b) => b.rigeDesde.getTime() - a.rigeDesde.getTime());
  return candidatos[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Totales de la venta                                                 */
/* ------------------------------------------------------------------ */

export interface TotalesVenta {
  mercaderia: number;
  envio: number;
  total: number;
  gramosVendidos: number;
  gramosRegalados: number;
}

export function totalesVenta(
  lineas: Pick<LineaVenta, 'total' | 'gramos' | 'regalo'>[],
  envioCobrado: number,
): TotalesVenta {
  const mercaderia = lineas.reduce((s, l) => s + l.total, 0);
  const envio = Math.round(envioCobrado);
  return {
    mercaderia,
    envio,
    total: mercaderia + envio,
    gramosVendidos: redondearGramos(
      lineas.filter((l) => !l.regalo).reduce((s, l) => s + l.gramos, 0),
    ),
    gramosRegalados: redondearGramos(
      lineas.filter((l) => l.regalo).reduce((s, l) => s + l.gramos, 0),
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Validación antes de guardar                                         */
/* ------------------------------------------------------------------ */

export type ErrorVenta =
  | { campo: 'lineas'; mensaje: string }
  | { campo: 'cliente'; mensaje: string }
  | { campo: `linea:${string}`; mensaje: string };

/** Los dos errores que la pantalla de Nueva venta tiene que poder mostrar. */
export function validarVenta(v: {
  clienteId: string | null;
  formaPago: 'efectivo' | 'transferencia' | 'debiendo';
  lineas: Array<{
    id: string;
    variedadNombre: string;
    regalo: boolean;
    precioEspecialTotal: number | null;
    precio: Precio | null;
  }>;
}): ErrorVenta[] {
  const errores: ErrorVenta[] = [];

  if (v.lineas.length === 0) {
    errores.push({ campo: 'lineas', mensaje: 'Agregá al menos una variedad' });
  }

  for (const l of v.lineas) {
    const necesitaPrecio = !l.regalo && l.precioEspecialTotal === null;
    if (necesitaPrecio && !l.precio) {
      errores.push({
        campo: `linea:${l.id}`,
        mensaje: `${l.variedadNombre} no tiene precio para esa fecha`,
      });
    }
  }

  if (v.formaPago === 'debiendo' && !v.clienteId) {
    errores.push({
      campo: 'cliente',
      mensaje: 'Para dejar debiendo elegí un cliente',
    });
  }

  return errores;
}

/* ------------------------------------------------------------------ */
/* Cobros                                                              */
/* ------------------------------------------------------------------ */

export interface ImputacionCobro {
  ventaId: string;
  fecha: Date;
  aplicado: number;
  saldoAnterior: number;
  saldoNuevo: number;
}

/**
 * Imputa un cobro a las ventas impagas, de la más vieja a la más nueva.
 * Devuelve el detalle para poder mostrar "cómo queda el saldo".
 */
export function imputarCobro(
  deudas: Array<{ ventaId: string; fecha: Date; saldo: number }>,
  monto: number,
): { imputaciones: ImputacionCobro[]; sobrante: number; saldoFinal: number } {
  const orden = [...deudas].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  let restante = Math.round(monto);
  const imputaciones: ImputacionCobro[] = [];

  for (const d of orden) {
    if (restante <= 0) break;
    const aplicado = Math.min(restante, d.saldo);
    if (aplicado <= 0) continue;
    imputaciones.push({
      ventaId: d.ventaId,
      fecha: d.fecha,
      aplicado,
      saldoAnterior: d.saldo,
      saldoNuevo: d.saldo - aplicado,
    });
    restante -= aplicado;
  }

  const saldoTotal = orden.reduce((s, d) => s + d.saldo, 0);
  return {
    imputaciones,
    sobrante: restante,
    saldoFinal: Math.max(0, saldoTotal - (Math.round(monto) - restante)),
  };
}
