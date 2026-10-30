export const GSTATIC_PREFIX: string;
/** The family the drawings ask for; its faces are filled with the self-hosted Geist files. */
export const REQUESTED_FAMILY: string;
export type FontRoute =
  | { kind: 'stylesheet'; weights: number[] }
  | { kind: 'file'; name: string }
  | { kind: 'unserved' };
export function fontRoute(url: string): FontRoute;
export function fontCss(weights: ReadonlyArray<number>, read: (weight: number) => string): string;
