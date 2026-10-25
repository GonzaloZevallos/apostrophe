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
