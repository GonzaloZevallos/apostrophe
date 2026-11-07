import { describe, expect, it } from 'vitest'
import { pngCssWidth, sheetHtml } from '../../../scripts/design/sheet.mjs'

// The markup `composeSheet` built before the sheet moved out of it, copied from that code's own
// output for this input (GH-548): a row with no override must keep it byte for byte.
const BEFORE =
  '<!doctype html><meta charset="utf-8"><style>\n' +
  '    body{margin:0;padding:24px;font:14px system-ui,sans-serif;background:#e7e5e1;color:#231e18;display:inline-block}\n' +
  '    h1{font-size:18px;margin:0 0 6px} p{margin:0 0 12px;color:#7a4a00;font-weight:600}\n' +
  '    .row{display:flex;gap:24px;align-items:flex-start} figure{margin:0}\n' +
  '    figcaption{font-weight:600;margin-bottom:8px} img{display:block;width:390px;border:1px solid #9a9085}\n' +
  '    .none{width:390px;height:200px;border:1px dashed #9a9085;display:grid;place-items:center}\n' +
  '    </style><h1>Demo</h1><p>una nota</p><p>otra</p>\n' +
  '    <div class="row"><figure><figcaption>Diseño · DemoBase.dc.html · Bloque</figcaption><img src="data:image/png;base64,ZA=="></figure>' +
  '<figure><figcaption>Construido · /demo</figcaption><div class="none">—</div></figure></div>'

const input = {
  screen: 'Demo',
  designFile: 'DemoBase',
  section: 'Bloque',
  route: '/demo',
  notes: ['una nota', 'otra'],
  designPng: Buffer.from('d'),
  builtPng: null,
}

describe('sheetHtml', () => {
  it('with equal widths gives the markup the sheet always had', () => {
    expect(sheetHtml({ ...input, designWidth: 390, builtWidth: 390 })).toBe(BEFORE)
  })

  it('with different widths gives each column its own width', () => {
    const html = sheetHtml({ ...input, builtPng: Buffer.from('b'), designWidth: 414, builtWidth: 320 })
    expect(html).toContain('img{display:block;width:414px;border:1px solid #9a9085}')
    expect(html).toContain('.none{width:414px;height:200px;')
    expect(html).toContain('.row figure:nth-child(2) img,.row figure:nth-child(2) .none{width:320px}')
    expect(html).toContain('<img src="data:image/png;base64,Yg==">')
  })

  it('says "sin ruta" for a row with no route and shows no section when it has none', () => {
    const html = sheetHtml({ ...input, section: undefined, route: null, designWidth: 390, builtWidth: 390 })
    expect(html).toContain('<figcaption>Diseño · DemoBase.dc.html</figcaption>')
    expect(html).toContain('<figcaption>Construido · sin ruta</figcaption>')
  })
})

describe('pngCssWidth', () => {
  const png = (width: number): Buffer => {
    const header = Buffer.alloc(24)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header)
    header.writeUInt32BE(width, 16)
    return header
  }

  it('reads the width in CSS pixels from the header and the device scale factor', () => {
    expect(pngCssWidth(png(780), 2)).toBe(390)
    expect(pngCssWidth(png(828), 2)).toBe(414)
  })

  it('refuses bytes that are not a PNG', () => {
    expect(() => pngCssWidth(Buffer.from('not a png at all, just text'), 2)).toThrow(/^sheet: not a PNG$/)
  })
})
