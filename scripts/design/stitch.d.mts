import type { ScrollFrame } from './shot.mjs';
export function stitch(frames: ReadonlyArray<Buffer>, plan: ReadonlyArray<ScrollFrame>, dpr: number): Buffer;
