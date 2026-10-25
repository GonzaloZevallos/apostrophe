export type Viewport = { width: number; height: number };
export type Clip = { x: number; y: number; width: number; height: number };
export type FixedElement = {
  display: string;
  visibility: string;
  opacity: number;
  rect: { left: number; top: number; right: number; bottom: number };
};
export type SizeEntry = {
  path: string;
  ordinal: number;
  width: number;
  height: number;
  [flag: string]: string | number | boolean | null;
};
export type Snapshot = { entries: ReadonlyArray<SizeEntry>; counts: Readonly<Record<string, number>> };
export type Size = { width: number; height: number };
export type SizeChange = {
  path: string;
  ordinal: number;
  before: Size | null;
  after: Size | null;
  [flag: string]: string | number | boolean | Size | null;
};
export type CountChange = { path: string; kind: 'count'; before: number; after: number };
export type ShotOptions = {
  clip?: Clip;
  fullPage: boolean;
  animations: 'disabled';
  caret: 'initial';
};
export type CensusClass = 'layer' | 'grown' | 'wide' | 'neither';
export function grownHeight(metrics: { scrollHeight: number }, viewport: Viewport): number | null;
export function shotOptions(
  metrics: { scrollWidth: number; innerWidth: number },
  clip?: Clip,
): ShotOptions;
export function coversScreen(fixedElements: ReadonlyArray<FixedElement>, viewport: Viewport): boolean;
export function sizesChanged(before: Snapshot, after: Snapshot): Array<SizeChange | CountChange>;
export function fitsViewport(metrics: {
  scrollWidth: number;
  innerWidth: number;
  scrollHeight: number;
  innerHeight: number;
}): string | null;
export function censusClass(flags: { layer: boolean; grown: boolean; wide: boolean }): CensusClass;
