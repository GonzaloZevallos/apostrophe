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
export type Capture = 'captured' | 'not-captured';
export type SideRecord = { path: string | null; reason?: string | null };
export type RowCapture = { capture: Capture; reasons?: { design?: string; built?: string } };
export const CALM_CONTEXT: Readonly<{ reducedMotion: 'reduce' }>;
export const CAPTURE_SCALE: 2;
export const CALM_CSS: string;
export const PROBE_CSS: string;
export function captureContextOptions(row: { width: number; height: number; url: string }): {
  viewport: Viewport;
  deviceScaleFactor: 2;
  colorScheme: 'light';
  baseURL: string;
  reducedMotion: 'reduce';
};
export function named(what: string, side: Side): string;
export function shotReason(failure: string, side: Side): string;
export function rowCapture(sides: { design: SideRecord; built: SideRecord }): RowCapture;
