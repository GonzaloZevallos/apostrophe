/**
 * apostrophe · tokens del sistema de diseño
 * Dirección "Fino" · paleta Papel y azul · apta para deuteranopia.
 *
 * Esta es la única fuente de verdad del color. Si cambiás un valor acá,
 * cambia en toda la app. No pongas hexadecimales sueltos en los componentes.
 *
 * Regla de accesibilidad que no se negocia: el eje de color es azul ↔ ámbar,
 * nunca verde ↔ rojo. Y ningún estado se distingue sólo por color: siempre
 * lleva palabra, y donde puede, forma (ver MarcaEstado en componentes.ts).
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
  /** Texto deshabilitado y placeholders. */
  tenue: string;
  /** Línea fina que separa filas y secciones. */
  linea: string;

  /** Única tinta de color: acción, enlaces, ganancia, regla aplicada. */
  acento: string;
  /** Fondo de las insignias de acento. */
  acentoSuave: string;

  /** Ámbar: deuda y stock bajo. */
  deuda: string;
  /** Fondo del panel de deuda y de sus insignias. */
  deudaFondo: string;
  /** Texto secundario dentro del panel de deuda. */
  deuda2: string;
  /** Línea fina dentro del panel de deuda. */
  deudaLinea: string;

  /** Estado crítico (agotada): se resuelve invirtiendo, no con rojo. */
  critico: string;
  criticoTexto: string;

  /** Botón primario. */
  boton: string;
  botonTexto: string;
  /** Ítem no activo de la barra inferior / riel. */
  navInactivo: string;
}

export const claro: Paleta = {
  papel: '#FCFBF8',
  superficie: '#F2EEE6',
  tinta: '#231E18',
  tinta2: '#7A7065',
  tenue: '#9A9085',
  linea: '#EBE5DA',

  acento: '#1B4FA8',
  acentoSuave: '#E9EDF7',

  deuda: '#7A4A00',
  deudaFondo: '#F3E6CB',
  deuda2: '#8A6530',
  deudaLinea: '#E6D5B4',

  critico: '#33281A',
  criticoTexto: '#F7EFE0',

  boton: '#231E18',
  botonTexto: '#FCFBF8',
  navInactivo: '#A79C8D',
};

export const oscuro: Paleta = {
  papel: '#10131A',
  superficie: '#1A1F28',
  tinta: '#E9EDF2',
  tinta2: '#8A93A1',
  tenue: '#5E6872',
  linea: '#262C36',

  acento: '#8AB0FF',
  acentoSuave: '#1B2440',

  deuda: '#EDB05A',
  deudaFondo: '#2C2113',
  deuda2: '#C08E4E',
  deudaLinea: '#3A2C19',

  // En oscuro el crítico se invierte al revés: relleno ámbar claro, texto oscuro.
  critico: '#F5C77A',
  criticoTexto: '#231708',

  boton: '#E9EDF2',
  botonTexto: '#10131A',
  navInactivo: '#6E7A73',
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
