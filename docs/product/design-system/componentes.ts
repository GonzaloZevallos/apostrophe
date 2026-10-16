/**
 * apostrophe · API de los componentes
 *
 * Los tipos de props de cada componente del sistema, en el mismo orden en que
 * aparecen en el artboard "Componentes". Son sólo los tipos: la implementación
 * va aparte, pero si respetás estas firmas las pantallas se arman solas.
 */

import type { ReactNode } from 'react';
import type {
  Cliente,
  EstadoStock,
  FormaPago,
  Id,
  Periodo,
  RangoFechas,
  ReglaPrecio,
} from './dominio';

/* ------------------------------------------------------------------ */
/* Boton                                                               */
/* ------------------------------------------------------------------ */

export interface BotonProps {
  children: ReactNode;
  /** primario = tinta llena · suave = superficie · enlace = subrayado fino
   *  destructivo = relleno crítico, sólo dentro de una confirmación. */
  variante?: 'primario' | 'suave' | 'enlace' | 'destructivo';
  icono?: NombreIcono;
  onClick?: () => void;
  deshabilitado?: boolean;
  /** Ocupa todo el ancho. Por defecto sí en celular. */
  ancho?: 'completo' | 'contenido';
  type?: 'button' | 'submit';
}

/* ------------------------------------------------------------------ */
/* Campo                                                               */
/* ------------------------------------------------------------------ */

export interface CampoProps {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  /** monto y gramos usan teclado numérico y tipografía de cifra. */
  tipo?: 'texto' | 'monto' | 'gramos' | 'telefono' | 'email' | 'password';
  placeholder?: string;
  /** Texto gris debajo. Si hay error, se reemplaza por el error en ámbar. */
  ayuda?: string;
  error?: string;
  opcional?: boolean;
}

export interface CampoFechaProps {
  rotulo?: string;
  valor: Date;
  onChange: (d: Date) => void;
  /** Muestra "Hoy 02/10" cuando la fecha es hoy. */
  resaltarHoy?: boolean;
}

export interface BuscadorProps {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Se muestra a la derecha: "2 resultados". */
  resultados?: number;
}

/* ------------------------------------------------------------------ */
/* Selectores                                                          */
/* ------------------------------------------------------------------ */

export interface SelectorPeriodoProps {
  valor: Periodo;
  onChange: (p: Periodo, rango?: RangoFechas) => void;
  /** Agrega la opción "Fechas" para elegir un rango a mano. */
  conRango?: boolean;
  /** Se muestra al lado: "28/09 – 04/10". */
  etiquetaRango?: string;
}

export interface SelectorPagoProps {
  valor: FormaPago;
  onChange: (f: FormaPago) => void;
  /** "Queda debiendo" se deshabilita si no hay cliente, con su explicación. */
  hayCliente: boolean;
}

export interface SelectorClienteProps {
  /** null = "Sin cliente". */
  clienteId: Id | null;
  onElegir: (clienteId: Id | null) => void;
  /** Se abre como hoja sin salir de la venta. */
  onCrear: (datos: NuevoCliente) => Promise<Cliente>;
}

export interface NuevoCliente {
  /** El único obligatorio. */
  nombre: string;
  telefono?: string;
  vip?: boolean;
}

/* ------------------------------------------------------------------ */
/* LineaVenta                                                          */
/* ------------------------------------------------------------------ */

export interface LineaVentaProps {
  variedadId: Id | null;
  gramos: number;
  regalo: boolean;
  precioEspecialTotal: number | null;

  onCambiarVariedad: (id: Id) => void;
  onCambiarGramos: (g: number) => void;
  onAlternarRegalo: () => void;
  onPrecioEspecial: (total: number | null) => void;
  onQuitar: () => void;

  /** Lo que devuelve calcularLinea(). Se muestra en vivo. */
  precioPorGramo: number;
  total: number;
  regla: ReglaPrecio;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Números y estados                                                   */
/* ------------------------------------------------------------------ */

export interface TarjetaNumeroProps {
  /** Frase en minúscula, no etiqueta en versalita. */
  rotulo: string;
  /** Ya formateado con formato.ts. */
  valor: string;
  pie?: string;
  /** destacada = cifra XL sin fondo · tarjeta = sobre superficie. */
  variante?: 'destacada' | 'tarjeta';
  /** Pinta la cifra con el acento (ganancia) o con el ámbar (deuda). */
  tono?: 'tinta' | 'acento' | 'deuda';
  onClick?: () => void;
}

export interface InsigniaProps {
  children: ReactNode;
  tono?: 'neutro' | 'acento' | 'deuda' | 'critico';
}

/**
 * La marca que acompaña al estado de stock. Existe para que el estado se
 * distinga sin ver el color: cuadrado = agotada, círculo lleno = baja,
 * círculo vacío = ok. No la uses sin la palabra al lado.
 */
export interface MarcaEstadoProps {
  estado: EstadoStock;
}

/* ------------------------------------------------------------------ */
/* Filas de lista                                                      */
/* ------------------------------------------------------------------ */

export interface FilaVentaProps {
  fecha: string;
  /** null se muestra como "Sin cliente" en gris. */
  cliente: string | null;
  vip?: boolean;
  /** "24K Gold, Golden Cookies · 13 g" */
  detalle: string;
  total: string;
  /** Si debe, el total va en ámbar y abajo dice "te debe". */
  debe?: boolean;
  onClick?: () => void;
}

export interface FilaClienteProps {
  iniciales: string;
  nombre: string;
  /** Opcional (customers.md): sin número, la fila no muestra nada en su lugar. */
  telefono?: string;
  vip?: boolean;
  /** Si debe: monto en ámbar y "te debe desde 14/09". */
  saldo?: { monto: string; desde: string };
  onClick?: () => void;
}

/** La fila de "Te deben" (Clientes, Inicio): además del monto y el "desde", el
 *  botón Cobrar. El nombre accesible del botón es "Cobrar a <nombre>". */
export interface FilaTeDebeProps {
  iniciales: string;
  nombre: string;
  /** Opcional (customers.md): sin número, la fila no muestra nada en su lugar. */
  telefono?: string;
  monto: string;
  desde: string;
  onCobrar: () => void;
  onClick?: () => void;
}

export interface FilaStockProps {
  variedad: string;
  gramos: string;
  estado: EstadoStock;
  /** "21 días", "6 días", "Sin gramos desde el 30/09". */
  detalle: string;
  onClick?: () => void;
}

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

export type Destino = 'inicio' | 'ventas' | 'clientes' | 'variedades' | 'mas';

export interface BarraInferiorProps {
  activo: Destino;
  onIr: (d: Destino) => void;
}

export interface RielLateralProps {
  activo: Destino | 'gastos' | 'analisis' | 'configuracion';
  onIr: (destino: string) => void;
  onNuevaVenta: () => void;
}

/** El botón fijo. Está en toda pantalla de navegación; en los formularios lo
 *  reemplaza la acción de guardar, que ocupa su mismo lugar. */
export interface BotonFijoProps {
  texto?: string;
  onClick: () => void;
}

export interface AvisoProps {
  texto: string;
  /** Si viene, muestra "Deshacer" a la derecha. */
  onDeshacer?: () => void;
  duracionMs?: number;
}

export interface ConfirmacionProps {
  titulo: string;
  /** Decí qué se pierde y qué vuelve atrás. */
  detalle: string;
  textoConfirmar: string;
  textoCancelar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export interface EstadoVacioProps {
  titulo: string;
  detalle: string;
  accion?: { texto: string; onClick: () => void };
}

/* ------------------------------------------------------------------ */
/* Íconos                                                              */
/* ------------------------------------------------------------------ */

/** Trazo de 1,6 y 22px, siempre: el ícono no recibe tamaño ni trazo. Los mismos
 *  nombres los dibuja `web/src/components/Icono.tsx` (`tests/test_design_icons.py`
 *  falla si difieren). Nunca emoji como ícono de interfaz: los emoji sólo
 *  aparecen dentro del texto del catálogo, que lo escribe el vendedor. */
export type NombreIcono =
  | 'inicio'
  | 'ventas'
  | 'clientes'
  | 'variedades'
  | 'mas'
  | 'atras'
  | 'chevron'
  | 'abajo'
  | 'buscar'
  | 'telegram'
  | 'tacho'
  | 'cobro'
  | 'personaMas'
  | 'agregar'
  | 'lapiz'
  | 'cerrar'
  | 'info'
  | 'compartir'
  | 'candado'
  | 'salirSesion'
  | 'archivar'
  | 'restaurar'
  | 'probar'
  | 'salidaStock'
  | 'atencion'
  | 'copiar'
  | 'publicar'
  | 'precio'
  | 'gastos'
  | 'analisis'
  | 'configuracion'
  | 'negocio'
  | 'usuarios'
  | 'integraciones'
  | 'mensaje'
  | 'categorias'
  | 'apariencia'
  | 'cuenta'
  | 'hecho'
  | 'calendario';

/** Más info: una línea corta con una "i" al final que despliega, en su lugar y debajo de la
 *  línea, la explicación larga (el cómo o el porqué, nunca una consecuencia ni la salida de un
 *  rechazo). Nombre accesible fijo "Más info", `aria-expanded`, blanco de 44 px; el estado
 *  abierto es local del componente: nunca en el historial ni en el almacenamiento, nunca un
 *  cambio sin guardar. Siempre nace cerrado. */
export interface MasInfoProps {
  line: string;
  more: string;
}

export interface IconoProps {
  nombre: NombreIcono;
}
