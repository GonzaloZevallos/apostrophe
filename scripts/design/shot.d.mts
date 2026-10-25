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
  top?: number;
  pinned?: boolean;
  same_node?: boolean;
  [flag: string]: string | number | boolean | null | undefined;
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
export type Side = 'design' | 'built';
export type Frame = { left: number; top: number; right: number; bottom: number };
export type Metrics = { scrollWidth: number; scrollHeight: number; innerWidth: number; innerHeight: number };
export type ShotPlan = { mode: 'layer' } | { mode: 'grow'; height: number };
export type CensusClass = 'layer' | 'grown' | 'wide' | 'neither';
export function grownHeight(metrics: { scrollHeight: number }, viewport: Viewport): number | null;
export function coversScreen(fixedElements: ReadonlyArray<FixedElement>, viewport: Viewport): boolean;
export function sizesChanged(before: Snapshot, after: Snapshot): Array<SizeChange | CountChange>;
export function fitsViewport(metrics: {
  scrollWidth: number;
  innerWidth: number;
  scrollHeight: number;
  innerHeight: number;
}): string | null;
export function censusClass(flags: { layer: boolean; grown: boolean; wide: boolean }): CensusClass;
export function planShot(
  metrics: { scrollHeight: number },
  fixedElements: ReadonlyArray<FixedElement>,
  viewport: Viewport,
): ShotPlan;
export function layerMiss(
  frame: Frame,
  viewport: Viewport,
  containers: ReadonlyArray<{ scrollTop: number }>,
  side: Side,
): string | null;
export function regionMiss(
  metrics: Metrics,
  clip: Clip | null | undefined,
  side: Side,
  options?: { layer?: boolean },
): string | null;
export function sizeRecordMiss(before: Snapshot, after: Snapshot, side: Side): string | null;
export function viewportUnchanged(atSettle: Viewport, afterShot: Viewport): boolean;
export function viewportMovedReason(side: Side): string;
export function staleFiles(existing: ReadonlyArray<string>, rows: ReadonlyArray<string>): string[];
export function shotStepReason(kind: string, side: Side): string;
