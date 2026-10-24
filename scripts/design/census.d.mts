import type { Page } from 'playwright';
import type { CensusClass, CountChange, SizeChange, Viewport } from './shot.mjs';

export const ERROR_BEFORE: string;
export const ERROR_AFTER: string;
export const ERROR_SETTLE: string;
export type ScrollContainer = {
  path: string;
  ordinal: number;
  client_height: number;
  scroll_height: number;
  scroll_top: number;
};
export type LayerMetrics = {
  overflows: boolean;
  frame_inside_viewport: boolean;
  scroll_containers: ScrollContainer[];
};
export type CensusRecord = {
  device_scale_factor?: number;
  viewport_before?: Viewport | null;
  viewport_shot?: Viewport | null;
  viewport_after?: Viewport | null;
  document?: { scroll_width: number; scroll_height: number; inner_width: number; inner_height: number };
  layer?: boolean;
  wide?: boolean;
  grown?: boolean;
  fits_viewport?: string | null;
  fits_viewport_after?: string | null;
  class?: CensusClass;
  layer_metrics?: LayerMetrics;
  sizes_changed?: Array<SizeChange | CountChange>;
  census_error?: string;
  census_settle?: 'unsettled' | 'rejected' | 'other';
};
export type Census = {
  record: CensusRecord;
  before(page: Page): Promise<void>;
  atShot(page: Page): void;
  after(page: Page): Promise<void>;
  dispose(): Promise<void>;
};
export function createCensus(options: {
  deviceScaleFactor: number;
  settle: (page: Page) => Promise<string | null>;
}): Census;
