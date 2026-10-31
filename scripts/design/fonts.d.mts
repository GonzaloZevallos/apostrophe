export interface FontFamily {
  readonly package: string;
  readonly prefix: string;
}
export type FontFamilyName = 'Plus Jakarta Sans' | 'Geist';
export const FONT_FAMILIES: Readonly<Record<FontFamilyName, FontFamily>>;
export type FontRoute =
  | { kind: 'stylesheet'; family: FontFamilyName; weights: number[] }
  | { kind: 'file'; family: FontFamilyName; name: string }
  | { kind: 'unserved' };
export function fontRoute(url: string): FontRoute;
export function fontCss(
  family: FontFamilyName,
  weights: ReadonlyArray<number>,
  read: (weight: number) => string,
): string;
