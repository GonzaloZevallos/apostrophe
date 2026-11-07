// The contact sheet's markup (agentic-system ADR-0040, ADR-0042): the design column next to the
// built one, each at its own side's width. Pure: the browser that turns it into a PNG stays in
// `comparisons.mjs`. With equal widths the markup is the one the sheet had before `design_viewport`.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

// The width of a PNG in CSS pixels: its IHDR width over the device scale factor it was shot at.
/**
 * @param {Buffer} png
 * @param {number} deviceScaleFactor
 * @returns {number}
 */
export function pngCssWidth(png, deviceScaleFactor) {
  if (png.length < 24 || !PNG_SIGNATURE.every((byte, at) => png[at] === byte)) throw new Error('sheet: not a PNG')
  return png.readUInt32BE(16) / deviceScaleFactor
}

/**
 * @param {{
 *   screen: string,
 *   designFile: string,
 *   section?: string,
 *   route: string | null,
 *   notes: ReadonlyArray<string>,
 *   designPng: Buffer | null,
 *   builtPng: Buffer | null,
 *   designWidth: number,
 *   builtWidth: number,
 * }} sheet
 * @returns {string}
 */
export function sheetHtml({ screen, designFile, section, route, notes, designPng, builtPng, designWidth, builtWidth }) {
  const img = (/** @type {Buffer} */ png) => `data:image/png;base64,${png.toString('base64')}`
  const column = (/** @type {string} */ label, /** @type {Buffer | null} */ png) =>
    `<figure><figcaption>${label}</figcaption>${png ? `<img src="${img(png)}">` : '<div class="none">—</div>'}</figure>`
  // The built column has its own rule only when its width is not the design column's.
  const builtRule =
    builtWidth === designWidth ? '' : `\n    .row figure:nth-child(2) img,.row figure:nth-child(2) .none{width:${builtWidth}px}`
  return `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;font:14px system-ui,sans-serif;background:#e7e5e1;color:#231e18;display:inline-block}
    h1{font-size:18px;margin:0 0 6px} p{margin:0 0 12px;color:#7a4a00;font-weight:600}
    .row{display:flex;gap:24px;align-items:flex-start} figure{margin:0}
    figcaption{font-weight:600;margin-bottom:8px} img{display:block;width:${designWidth}px;border:1px solid #9a9085}
    .none{width:${designWidth}px;height:200px;border:1px dashed #9a9085;display:grid;place-items:center}${builtRule}
    </style><h1>${screen}</h1>${notes.map((n) => `<p>${n}</p>`).join('')}
    <div class="row">${column(`Diseño · ${designFile}.dc.html${section ? ` · ${section}` : ''}`, designPng)}${column(`Construido · ${route ?? 'sin ruta'}`, builtPng)}</div>`
}
