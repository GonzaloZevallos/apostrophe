/** The shell words that are not a named message. */

import type { LimitedCopy } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'es'

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const SHELL_TEXT = {
  navegacion: 'Navegación',
  inicio: 'Inicio',
  mas: 'Más',
  ventas: 'Ventas',
  nuevaVenta: 'Nueva venta',
  venta: 'Venta',
  clientes: 'Clientes',
  nuevoCliente: 'Nuevo cliente',
  cliente: 'Cliente',
  editarCliente: 'Editar cliente',
  variedad: 'Variedad',
  nuevaVariedad: 'Nueva variedad',
  nuevoPrecio: 'Nuevo precio',
  entradas: 'Entradas',
  catalogo: 'Catálogo',
  todasLasEntradas: 'Todas las entradas',
  entradaDeStock: 'Entrada de stock',
  archivadas: 'Archivadas',
  retiro: 'Retiro',
  gastoNuevo: 'Gasto nuevo',
  onboarding: 'Onboarding',
  listo: 'Listo',
} as const
