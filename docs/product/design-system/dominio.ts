/**
 * apostrophe · tipos del dominio
 *
 * Todo cuelga de un negocio: ninguna consulta cruza de un negocio a otro.
 * Los montos son enteros en pesos. Los gramos son number con dos decimales
 * como mucho (ver redondearGramos en formato.ts).
 */

export type Id = string;

/** Toda entidad pertenece a un negocio y nunca se consulta sin él. */
export interface DelNegocio {
  negocioId: Id;
}

/* ------------------------------------------------------------------ */
/* Negocio y usuarios                                                  */
/* ------------------------------------------------------------------ */

export interface Negocio {
  id: Id;
  nombre: string;
  creadoEl: Date;
}

export interface Usuario extends DelNegocio {
  id: Id;
  email: string;
  desdeEl: Date;
}

export interface Invitacion extends DelNegocio {
  id: Id;
  token: string;
  venceEl: Date;
  usadaEl: Date | null;
  /** Una invitación sirve para crear un negocio nuevo o para sumarse a uno. */
  tipo: 'negocioNuevo' | 'sumarse';
}

/* ------------------------------------------------------------------ */
/* Variedades y precios                                                */
/* ------------------------------------------------------------------ */

export interface Variedad extends DelNegocio {
  id: Id;
  nombre: string;
  /** Avisar cuando el stock baje de esto. null = aviso apagado. */
  avisoStockBajo: number | null;
  /** Lo que sale en el catálogo. */
  catalogo: {
    visible: boolean;
    emoji: string | null;
    porcentajeIndica: number | null;
    aroma: string | null;
  };
}

/**
 * Los precios son históricos: una venta usa el precio que regía el día de la
 * venta, aunque después se cambie. Nunca se edita un precio viejo.
 */
export interface Precio extends DelNegocio {
  id: Id;
  variedadId: Id;
  rigeDesde: Date;
  /** Precio por gramo de lista. */
  lista: number;
  /** Precio por gramo a partir de `minimoGramos`. null = no hay precio por cantidad. */
  porCantidad: number | null;
  minimoGramos: number | null;
}

/* ------------------------------------------------------------------ */
/* Clientes                                                            */
/* ------------------------------------------------------------------ */

export interface Cliente extends DelNegocio {
  id: Id;
  /** Opcional (customers.md): la lista y la ficha no muestran nada en su lugar. */
  telefono?: string;
  /** Obligatorio: a quien se registra se lo conoce (Zeta, 02/10/2026). */
  nombre: string;
  vip: boolean;
  creadoEl: Date;
}

/** Lo que se muestra en la lista y en la ficha, ya calculado. */
export interface ClienteConSaldo extends Cliente {
  /** 0 si no debe nada. */
  saldo: number;
  /** Fecha de la venta impaga más vieja. null si no debe. */
  debeDesde: Date | null;
}

/* ------------------------------------------------------------------ */
/* Ventas                                                              */
/* ------------------------------------------------------------------ */

export type FormaPago = 'efectivo' | 'transferencia' | 'debiendo';

/** Qué regla ganó al calcular el precio de la línea. Se muestra siempre. */
export type ReglaPrecio =
  | 'regalo'
  | 'especial'
  | 'vip'
  | 'porCantidad'
  | 'lista';

export interface LineaVenta {
  id: Id;
  variedadId: Id;
  gramos: number;
  /** Si es regalo, el total es 0 y los gramos suman a "regalados". */
  regalo: boolean;
  /** Total de la línea fijado a mano. El precio por gramo se deduce. */
  precioEspecialTotal: number | null;

  /* Se guardan calculados, para que la venta no cambie si cambia el precio. */
  precioPorGramo: number;
  total: number;
  regla: ReglaPrecio;
}

export interface Venta extends DelNegocio {
  id: Id;
  fecha: Date;
  /** null = "Sin cliente". Obligatorio si la forma de pago es "debiendo". */
  clienteId: Id | null;
  lineas: LineaVenta[];
  envioCobrado: number;
  nota: string | null;
  formaPago: FormaPago;
  creadaEl: Date;
}

/** Un pago a cuenta. Se imputa siempre a la deuda más vieja. */
export interface Cobro extends DelNegocio {
  id: Id;
  clienteId: Id;
  fecha: Date;
  monto: number;
  forma: Exclude<FormaPago, 'debiendo'>;
}

/* ------------------------------------------------------------------ */
/* Stock                                                               */
/* ------------------------------------------------------------------ */

export type OrigenEntrada = 'compra' | 'cosecha' | 'stockInicial' | 'ajuste';

export interface EntradaStock extends DelNegocio {
  id: Id;
  fecha: Date;
  variedadId: Id;
  gramos: number;
  origen: OrigenEntrada;
  /** Obligatorio cuando el origen es "compra". */
  costoTotal: number | null;
  nota: string | null;
}

export type EstadoStock = 'sinEntradas' | 'agotada' | 'baja' | 'ok';

/** Lo que muestra la pantalla de Stock, ya calculado. */
export interface StockVariedad {
  variedadId: Id;
  gramos: number;
  estado: EstadoStock;
  /** Días que quedan al ritmo de los últimos 30 días. null si no se puede estimar. */
  diasRestantes: number | null;
}

/* ------------------------------------------------------------------ */
/* Gastos                                                              */
/* ------------------------------------------------------------------ */

export interface CategoriaGasto extends DelNegocio {
  id: Id;
  nombre: string;
}

/** Ojo: las compras de flores NO son gastos, son entradas de stock. */
export interface Gasto extends DelNegocio {
  id: Id;
  fecha: Date;
  categoriaId: Id;
  monto: number;
  /** Obligatorio: hasta 200 caracteres, sin espacios de más. */
  detalle: string;
}

export const CATEGORIAS_POR_DEFECTO = [
  'Insumos de cultivo',
  'Packaging',
  'Envíos y traslados',
  'Otros',
] as const;

/* ------------------------------------------------------------------ */
/* Resúmenes                                                           */
/* ------------------------------------------------------------------ */

export type Periodo = 'hoy' | 'semana' | 'mes' | 'rango';

export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

/** Lo que muestra Inicio. Las definiciones viven acá y en ningún otro lado. */
export interface Resumen {
  rango: RangoFechas;
  /** Suma de los totales de venta, envío incluido. */
  ventas: number;
  /** ventas − costo de lo vendido − gastos. */
  ganancia: number;
  /** cobrado − gastos − compras de stock. Puede dar negativo. */
  caja: number;
  gastos: number;
  gramosVendidos: number;
  gramosRegalados: number;
  cantidadVentas: number;
  ventaPromedio: number;
}

export interface ResumenDeuda {
  total: number;
  cantidadVentas: number;
  masVieja: Date | null;
  /** Ordenados de mayor a menor saldo. */
  clientes: Array<{ clienteId: Id; nombre: string; saldo: number; desde: Date }>;
}
