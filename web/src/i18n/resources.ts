import type { ResourceKey } from 'i18next'

/** One language's texts: namespace (the JSON file's name) to that file's content. */
export type LocaleBundle = Readonly<Record<string, ResourceKey>>

/** Loads the chunk of one language tag. Injectable: tests pass their own. */
export type LocaleLoader = (tag: string) => Promise<LocaleBundle>

const FILE = /\/locales\/([^/]+)\/([^/]+)\.json$/

function namespaceOf(path: string): { tag: string; ns: string } | null {
  const match = FILE.exec(path)
  const tag = match?.[1]
  const ns = match?.[2]
  return tag !== undefined && ns !== undefined ? { tag, ns } : null
}

// English is bundled with the app: a part adds a file to the folder and edits no registry.
const english = import.meta.glob<ResourceKey>('../copy/locales/en/*.json', {
  eager: true,
  import: 'default',
})

export function englishBundle(): LocaleBundle {
  const bundle: Record<string, ResourceKey> = {}
  for (const [path, content] of Object.entries(english)) {
    const file = namespaceOf(path)
    if (file !== null) bundle[file.ns] = content
  }
  return bundle
}

// Every other language is one lazy chunk per file, selected by its tag.
const lazy = import.meta.glob<ResourceKey>('../copy/locales/*/*.json', { import: 'default' })

export const loadLocale: LocaleLoader = async (tag) => {
  const bundle: Record<string, ResourceKey> = {}
  await Promise.all(
    Object.entries(lazy).map(async ([path, load]) => {
      const file = namespaceOf(path)
      if (file === null || file.tag !== tag) return
      bundle[file.ns] = await load()
    }),
  )
  return bundle
}
