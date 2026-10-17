export const TEXT_SCALE: number;
export const TOLERANCE: number;
export interface ScaleRecord {
  tagged: boolean;
  baselineFontPx: number;
  fontPx: number;
  baselineLineHeightPx: number | null;
  lineHeightPx: number | null;
}
export interface ScaleMiss {
  /** Position in the records; -1 when there were no records at all. */
  index: number;
  kind: 'none' | 'untagged' | 'font-size' | 'line-height';
}
/** Runs in the browser: scales `<html>` and every element under `<body>`; returns how many it tagged. */
export function applyInPage(args: { factor: number }): number;
/** Runs in the browser: one record per element of `<html>` and `<body>`'s subtree. */
export function gatherInPage(): ScaleRecord[];
export function unscaled(records: ReadonlyArray<ScaleRecord>, factor: number, tolerance: number): ScaleMiss[];
