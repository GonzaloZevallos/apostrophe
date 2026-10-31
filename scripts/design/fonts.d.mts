export interface FontFamily {
  readonly package: string;
  readonly prefix: string;
}
export const FONT_FAMILIES: Readonly<Record<'Plus Jakarta Sans' | 'Geist', FontFamily>>;
export type FontRoute =
  | { kind: 'stylesheet'; family: string; weights: number[] }
  | { kind: 'file'; family: string; name: string }
  | { kind: 'unserved' };
export function fontRoute(url: string): FontRoute;
export function fontCss(
  family: string,
  weights: ReadonlyArray<number>,
  read: (weight: number) => string,
): string;
