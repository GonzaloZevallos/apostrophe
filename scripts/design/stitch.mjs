// Joins the screenshots of a scrolled shot into one PNG (GH-491). It only copies rows: the plan
// (`scrollPlan` in `shot.mjs`) is the only place a value is rounded, so every value that arrives
// here is a whole number or this throws. Nothing here reads page text.

import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const { PNG } = createRequire(join(REPO, 'web', 'package.json'))('pngjs')

// `frames` are the PNG files of the screenshots, one per entry of `plan` (`{ offset, cropTop,
// cropHeight }`, the crop in device px of that screenshot's rows, and when the plan has a section
// `cropLeft` and `cropWidth`, its columns, the same on every frame); returns the stitched PNG.
export function stitch(frames, plan, dpr) {
  if (!Number.isInteger(dpr)) throw new Error('stitch: the device scale factor is not a whole number')
  for (const frame of plan) {
    if (!Number.isInteger(frame.offset)) throw new Error('stitch: an offset is not a whole number')
    if (!Number.isInteger(frame.cropTop)) throw new Error('stitch: a crop top is not a whole number')
    if (!Number.isInteger(frame.cropHeight)) throw new Error('stitch: a crop height is not a whole number')
  }
  const columned = plan.filter((frame) => frame.cropLeft !== undefined || frame.cropWidth !== undefined)
  if (columned.length !== 0 && columned.length !== plan.length) throw new Error('stitch: only some frames have columns')
  for (const frame of columned) {
    if (!Number.isInteger(frame.cropLeft)) throw new Error('stitch: a crop left is not a whole number')
    if (!Number.isInteger(frame.cropWidth)) throw new Error('stitch: a crop width is not a whole number')
  }
  if (frames.length !== plan.length) throw new Error('stitch: the frames and the plan differ in count')
  const images = frames.map((frame) => PNG.sync.read(frame))
  const sourceWidth = images[0].width
  if (images.some((image) => image.width !== sourceWidth)) throw new Error('stitch: the frames differ in width')
  const left = columned.length === 0 ? 0 : columned[0].cropLeft
  const width = columned.length === 0 ? sourceWidth : columned[0].cropWidth
  if (columned.some((frame) => frame.cropLeft !== left || frame.cropWidth !== width)) {
    throw new Error('stitch: the frames differ in columns')
  }
  plan.forEach((frame, at) => {
    const outside = frame.cropTop < 0 || frame.cropHeight < 0 || frame.cropTop + frame.cropHeight > images[at].height
    if (outside) throw new Error('stitch: a crop lies outside its frame')
  })
  if (left < 0 || width < 0 || left + width > sourceWidth) throw new Error('stitch: the columns lie outside the frames')
  const rowBytes = width * 4
  const out = new PNG({ width, height: plan.reduce((total, frame) => total + frame.cropHeight, 0) })
  let written = 0
  plan.forEach((frame, at) => {
    for (let row = 0; row < frame.cropHeight; row += 1) {
      const from = ((frame.cropTop + row) * sourceWidth + left) * 4
      images[at].data.copy(out.data, (written + row) * rowBytes, from, from + rowBytes)
    }
    written += frame.cropHeight
  })
  return PNG.sync.write(out)
}
