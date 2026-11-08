// What a shot reads from the page (GH-301), shared by `comparisons.mjs` and `census.mjs`. Every
// function here is self-contained: it is sent to the page with `evaluate`, and the elements are held
// by a handle (`evaluateHandle(allElements)`), never attached to `window` or the DOM. Nothing here
// returns page text: only tag-and-class paths, ordinals, counts, sizes, coordinates and booleans.

// Every element of the document, in document order. Held by a handle: nothing is attached to the page.
export const allElements = () => [...document.querySelectorAll('*')]

// The size of the document against its window.
export const readMetrics = () => ({
  scrollWidth: document.documentElement.scrollWidth,
  scrollHeight: document.documentElement.scrollHeight,
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
})

// The fixed elements, each as the layer predicate reads it, with its index among all the elements.
export function fixedInPage(elements) {
  const found = []
  elements.forEach((element, index) => {
    const style = getComputedStyle(element)
    if (style.position !== 'fixed') return
    const rect = element.getBoundingClientRect()
    found.push({
      index,
      display: style.display,
      visibility: style.visibility,
      opacity: Number(style.opacity),
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
    })
  })
  return found
}

// One entry per drawn element (width and height above 0): its index among all the elements, its
// tag-and-class path, its ordinal among the drawn elements of that path in document order, its top in
// document coordinates, its size, whether it is pinned (computed `position` fixed or sticky, or
// inside such an element), and whether it is `.pantalla` or holds one. Also the count per path,
// whether the 900 px query matches, and the inline `--vv-alto`.
export function snapshotInPage(elements) {
  const seen = {}
  const pinnedSet = new Set()
  let vvAlto = null
  const entries = []
  elements.forEach((element, index) => {
    if (vvAlto === null) {
      const value = element.style?.getPropertyValue('--vv-alto') ?? ''
      if (value !== '') vvAlto = value
    }
    const { position } = getComputedStyle(element)
    const pinned =
      position === 'fixed' || position === 'sticky' || (element.parentElement !== null && pinnedSet.has(element.parentElement))
    if (pinned) pinnedSet.add(element)
    const rect = element.getBoundingClientRect()
    if (!(rect.width > 0 && rect.height > 0)) return
    const classes = (element.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean)
    const path = element.localName + classes.map((name) => `.${name}`).join('')
    const ordinal = seen[path] ?? 0
    seen[path] = ordinal + 1
    entries.push({
      index,
      path,
      ordinal,
      top: Math.round((rect.top + window.scrollY) * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
      pinned,
      pantalla: element.classList.contains('pantalla') || element.querySelector('.pantalla') !== null,
    })
  })
  return { entries, counts: seen, query900: window.matchMedia('(min-width: 900px)').matches, vvAlto }
}

// The layer's own frame and the scroll offset of every element inside it, whatever its overflow.
export function layerReadInPage([elements, index]) {
  const layer = elements[index]
  const rect = layer.getBoundingClientRect()
  return {
    frame: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
    containers: elements.filter((element) => layer.contains(element)).map((element) => ({ scrollTop: element.scrollTop })),
  }
}

// The layer's own box, its inner scroll containers and whether its frame lies inside the viewport
// (census mode). `ordinals` and `paths` are the snapshot's, by element index.
export function layerInPage([elements, index, ordinals, paths]) {
  const layer = elements[index]
  const rect = layer.getBoundingClientRect()
  const containers = []
  elements.forEach((element, at) => {
    if (!layer.contains(element) || paths[at] === undefined) return
    const { overflowY } = getComputedStyle(element)
    if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') return
    containers.push({
      path: paths[at],
      ordinal: ordinals[at],
      client_height: element.clientHeight,
      scroll_height: element.scrollHeight,
      scroll_top: element.scrollTop,
    })
  })
  return {
    overflows: layer.scrollHeight > layer.clientHeight || layer.scrollWidth > layer.clientWidth,
    frame_inside_viewport:
      rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
    scroll_containers: containers,
  }
}

// Which elements before are the very same node after, for the pairs of indexes given.
export function sameNodesInPage([before, after, pairs]) {
  return pairs.map(([was, now]) => before[was] === after[now])
}

// The fixed and the sticky elements of a page (GH-491), read without changing anything: `{ index, path,
// chain, position, insetTop, insetBottom, marginTop, marginBottom, transform, rect, container }`. `chain` is
// the `:nth-child` selector path from `html`, which `hiddenRule` (`shot.mjs`) turns into a stylesheet; `path`
// is the tag-and-class path of the snapshot; an inset or a margin is a px number or `auto`; `rect` is the
// viewport rect now; `container` is the parent's content box (its rect minus border and padding) in page
// px. `position` is only reported: `pinnedClass` (`shot.mjs`) is the one place that classifies.
export function pinnedInPage(elements) {
  const px = (value) => (value === 'auto' ? 'auto' : Number.parseFloat(value))
  const chainOf = (element) => {
    const parts = []
    for (let node = element; node !== null && node !== document.documentElement; node = node.parentElement) {
      const at = [...node.parentElement.children].indexOf(node) + 1
      parts.unshift(`${node.localName}:nth-child(${at})`)
    }
    return ['html', ...parts].join(' > ')
  }
  const pathOf = (element) => {
    const classes = (element.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean)
    return element.localName + classes.map((name) => `.${name}`).join('')
  }
  const found = []
  elements.forEach((element, index) => {
    const style = getComputedStyle(element)
    if (style.position !== 'fixed' && style.position !== 'sticky') return
    if (element === document.documentElement) return
    const rect = element.getBoundingClientRect()
    const parent = element.parentElement
    const parentRect = parent.getBoundingClientRect()
    const parentStyle = getComputedStyle(parent)
    found.push({
      index,
      path: pathOf(element),
      chain: chainOf(element),
      position: style.position,
      insetTop: px(style.top),
      insetBottom: px(style.bottom),
      marginTop: px(style.marginTop),
      marginBottom: px(style.marginBottom),
      transform: style.transform,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      container: {
        contentTop: parentRect.top + window.scrollY + Number.parseFloat(parentStyle.borderTopWidth) + Number.parseFloat(parentStyle.paddingTop),
        contentBottom:
          parentRect.bottom + window.scrollY - Number.parseFloat(parentStyle.borderBottomWidth) - Number.parseFloat(parentStyle.paddingBottom),
      },
    })
  })
  return found
}

// An element's viewport rect now, by its index among all the elements.
export function rectInPage([elements, index]) {
  const rect = elements[index].getBoundingClientRect()
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
}

// Where the document is scrolled and how big it and the window are: what a frame reports.
export const readScroll = () => ({
  scrollTop: document.scrollingElement.scrollTop,
  scrollHeight: document.documentElement.scrollHeight,
  viewport: { width: window.innerWidth, height: window.innerHeight },
})

// The elements other than the document's own that scroll their content, as `innerScrollMiss` reads them.
export function scrollersInPage(elements) {
  return elements
    .filter((element) => element !== document.documentElement && element !== document.body)
    .filter((element) => ['auto', 'scroll', 'overlay'].includes(getComputedStyle(element).overflowY))
    .map((element) => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }))
}

// Moves the document to a scroll offset at once, whatever its own `scroll-behavior`.
export function scrollToInPage(offset) {
  window.scrollTo({ top: offset, behavior: 'instant' })
}

// Puts a constructed stylesheet on the document and returns it, so it can be taken off again. It is
// not a DOM node and sets no attribute.
export function adoptSheetInPage(css) {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css)
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  return sheet
}

export function dropSheetInPage(sheet) {
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter((other) => other !== sheet)
}
