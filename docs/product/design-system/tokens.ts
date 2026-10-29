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
  papel: '#F6F7F5',
  superficie: '#FFFFFF',
  tinta: '#15201A',
  tinta2: '#56645C',
  tenue: '#818E87',
  linea: '#DCE3DE',

  acento: '#1E6B47',
  acentoSuave: '#E2F1E8',
  acentoOscuro: '#14532F',
  acentoCalido: '#E3A23B',
  acentoCalidoTexto: '#15201A',

  deuda: '#A35706',
  deudaFondo: '#FBF1E3',
  deuda2: '#8A5A1F',
  deudaLinea: '#ECDCC3',

  critico: '#26332B',
  criticoTexto: '#F6F7F5',

  positivo: '#1E7A45',
  negativo: '#C0352B',

  boton: '#1E6B47',
  botonTexto: '#FFFFFF',
  navInactivo: '#56645C',

  serie1: '#1E6B47',
  serie2: '#E3A23B',
  serie3: '#4C7FD0',
  serie4: '#B8457A',
  serie5: '#B9C2BC',
};

export const oscuro: Paleta = {
  papel: '#0E1411',
  superficie: '#18211C',
  tinta: '#E7EEE9',
  tinta2: '#9AAAA1',
  tenue: '#66756C',
  linea: '#2A362F',

  acento: '#5CC594',
  acentoSuave: '#1F3A2C',
  acentoOscuro: '#14532F',
  acentoCalido: '#E3A23B',
  acentoCalidoTexto: '#15201A',

  deuda: '#E8A54B',
  deudaFondo: '#2B2110',
  deuda2: '#C9944A',
  deudaLinea: '#3D2E17',

  critico: '#F0BB68',
  criticoTexto: '#0E1411',

  positivo: '#6BD39A',
  negativo: '#F07A6E',

  boton: '#5CC594',
  botonTexto: '#0E1411',
  navInactivo: '#9AAAA1',

  serie1: '#5CC594',
  serie2: '#F0B95A',
  serie3: '#7FA8E8',
  serie4: '#E07AA8',
  serie5: '#7F8C85',
};

export const paletas: Record<Tema, Paleta> = { claro, oscuro };

/* ------------------------------------------------------------------ */
/* Tipografía                                                          */
/* ------------------------------------------------------------------ */

export const fuente =
  "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

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
