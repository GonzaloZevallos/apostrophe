export const GSTATIC_PREFIX: string;
export type FontRoute =
  | { kind: 'stylesheet'; weights: number[] }
  | { kind: 'file'; name: string }
  | { kind: 'unserved' };
export function fontRoute(url: string): FontRoute;
export function fontCss(weights: ReadonlyArray<number>, read: (weight: number) => string): string;
