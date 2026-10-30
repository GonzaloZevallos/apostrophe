/**
 * apostrophe · tokens del sistema de diseño
 * Dirección "Fino" · paleta Yerba, en claro y en oscuro.
 *
 * Esta es la única fuente de verdad del color. Si cambiás un valor acá,
 * cambia en toda la app. No pongas hexadecimales sueltos en los componentes.
 *
 * Regla de accesibilidad que no se negocia: ningún estado se cuenta sólo con el
 * color. Cada ganancia, pérdida, deuda o estado lleva un signo, una flecha o una
 * palabra (y donde puede, forma: ver MarcaEstado en componentes.ts), y las series
 * de un gráfico se rotulan directamente.
 */

export type Tema = 'claro' | 'oscuro';

export interface Paleta {
  /** Fondo de pantalla. */
  papel: string;
  /** Paneles suaves, campos, píldoras neutras. */
  superficie: string;
  /** Texto principal y botón primario. */
  tinta: string;
  /** Rótulos, datos secundarios, íconos inactivos. */
  tinta2: string;
  /** Sólo íconos: no es texto, no llega a 4,5:1 (ver la tabla del README). */
  tenue: string;
  /** Línea fina que separa filas y secciones. */
  linea: string;

  /** Única tinta de color: acción, enlaces, regla aplicada. */
  acento: string;
  /** Fondo de las insignias de acento. */
  acentoSuave: string;
  /** Acento más profundo (no es texto). */
  acentoOscuro: string;
  /** Relleno cálido; el único texto encima es acentoCalidoTexto. */
  acentoCalido: string;
  /** La tinta sobre el relleno cálido: la misma en los dos temas (fila par del README). */
  acentoCalidoTexto: string;

  /** Ámbar: deuda y stock bajo, siempre con su palabra. */
  deuda: string;
  /** Fondo del panel de deuda y de sus insignias. */
  deudaFondo: string;
  /** Texto secundario dentro del panel de deuda. */
  deuda2: string;
  /** Línea fina dentro del panel de deuda. */
  deudaLinea: string;

  /** Estado crítico (agotada): se resuelve invirtiendo, siempre con su palabra. */
  critico: string;
  criticoTexto: string;

  /** Ganancia: nunca sola, lleva signo, flecha o palabra. */
  positivo: string;
  /** Pérdida: nunca sola, lleva signo, flecha o palabra. */
  negativo: string;

  /** Botón primario. */
  boton: string;
  botonTexto: string;
  /** Ítem no activo de la barra inferior / riel. */
  navInactivo: string;

  /** Series de gráfico: marcas, siempre rotuladas directamente (ver README). */
  serie1: string;
  serie2: string;
  serie3: string;
  serie4: string;
  serie5: string;
}

export const claro: Paleta = {
  papel: '#f6f7f5',
  superficie: '#ffffff',
  tinta: '#15201a',
  tinta2: '#56645c',
  tenue: '#818e87',
  linea: '#dce3de',

  acento: '#1e6b47',
  acentoSuave: '#e2f1e8',
  acentoOscuro: '#14532f',
  acentoCalido: '#e3a23b',
  acentoCalidoTexto: '#15201a',

  deuda: '#a35706',
  deudaFondo: '#fbf1e3',
  deuda2: '#8a5a1f',
  deudaLinea: '#ecdcc3',

  critico: '#26332b',
  criticoTexto: '#f6f7f5',

  positivo: '#1e7a45',
  negativo: '#c0352b',

  boton: '#1e6b47',
  botonTexto: '#ffffff',
  navInactivo: '#56645c',

  serie1: '#1e6b47',
  serie2: '#e3a23b',
  serie3: '#4c7fd0',
  serie4: '#b8457a',
  serie5: '#b9c2bc',
};

export const oscuro: Paleta = {
  papel: '#0e1411',
  superficie: '#18211c',
  tinta: '#e7eee9',
  tinta2: '#9aaaa1',
  tenue: '#66756c',
  linea: '#2a362f',

  acento: '#5cc594',
  acentoSuave: '#1f3a2c',
  acentoOscuro: '#14532f',
  acentoCalido: '#e3a23b',
  acentoCalidoTexto: '#15201a',

  deuda: '#e8a54b',
  deudaFondo: '#2b2110',
  deuda2: '#c9944a',
  deudaLinea: '#3d2e17',

  critico: '#f0bb68',
  criticoTexto: '#0e1411',

  positivo: '#6bd39a',
  negativo: '#f07a6e',

  boton: '#5cc594',
  botonTexto: '#0e1411',
  navInactivo: '#9aaaa1',

  serie1: '#5cc594',
  serie2: '#f0b95a',
  serie3: '#7fa8e8',
  serie4: '#e07aa8',
  serie5: '#7f8c85',
};

export const paletas: Record<Tema, Paleta> = { claro, oscuro };

/* ------------------------------------------------------------------ */
/* Tipografía                                                          */
/* ------------------------------------------------------------------ */

export const fuente =
  "'Geist', system-ui, -apple-system, sans-serif";

/** Una sola familia, dos pesos. La jerarquía la hace el tamaño, no el peso. */
export interface EstiloTexto {
  size: number;
  weight: 400 | 500 | 600 | 700;
  tracking?: string;
  leading?: number;
}

export const texto = {
  /** Total de venta, hero de Inicio. */
  cifraXl: { size: 54, weight: 600, tracking: '-0.045em', leading: 1.05 },
  /** Deuda, saldo de cliente. */
  cifraL: { size: 38, weight: 600, tracking: '-0.04em', leading: 1.05 },
  /** Tarjetas y subtotales. */
  cifraM: { size: 25, weight: 600, tracking: '-0.035em', leading: 1.1 },
  /** Filas de lista. */
  cifraS: { size: 17, weight: 600 },

  /** Título de pantalla. */
  titulo: { size: 20, weight: 600, tracking: '-0.02em' },
  cuerpo: { size: 16, weight: 400, leading: 1.5 },
  /** Nombres de cliente y de variedad. */
  cuerpoFuerte: { size: 16, weight: 600 },
  /** Rótulo sobre una cifra. Siempre en minúscula, nunca versalita. */
  rotulo: { size: 14, weight: 400 },
  /** Fechas, ayudas, texto al pie. */
  pie: { size: 13, weight: 400 },
  /** Texto de insignia. */
  micro: { size: 12, weight: 600 },
} satisfies Record<string, EstiloTexto>;

/* ------------------------------------------------------------------ */
/* Espacio, radios y medidas                                           */
/* ------------------------------------------------------------------ */

export const espacio = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radio = {
  campo: 16,
  panel: 20,
  panelGrande: 24,
  hoja: 28,
  pildora: 999,
} as const;

export const medida = {
  /** Margen lateral de toda pantalla de celular. */
  margenPantalla: 24,
  /** Alto de una fila de lista. */
  fila: 52,
  /** Mínimo tocable. Nada por debajo de esto. */
  tocable: 44,
  /** Alto del botón primario. */
  boton: 56,
  /** Ancho de referencia del celular. */
  celular: 390,
  /** A partir de acá la barra inferior pasa a riel lateral. */
  quiebreCompu: 900,
  /** Ancho del riel lateral. */
  riel: 232,
} as const;

/** Trazo de los íconos. Finos, sin relleno. */
export const icono = { size: 22, strokeWidth: 1.6 } as const;

/* ------------------------------------------------------------------ */
/* Puente a CSS                                                        */
/* ------------------------------------------------------------------ */

/** Convierte una paleta en variables CSS (ver tokens.css para el uso). */
export function variablesCss(p: Paleta): Record<string, string> {
  return Object.fromEntries(
    Object.entries(p).map(([k, v]) => [
      `--${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}`,
      v,
    ]),
  );
}
