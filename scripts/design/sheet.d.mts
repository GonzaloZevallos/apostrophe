export function pngCssWidth(png: Buffer, deviceScaleFactor: number): number;
export function sheetHtml(sheet: {
  screen: string;
  designFile: string;
  section?: string | undefined;
  route: string | null;
  notes: ReadonlyArray<string>;
  designPng: Buffer | null;
  builtPng: Buffer | null;
  designWidth: number;
  builtWidth: number;
}): string;
