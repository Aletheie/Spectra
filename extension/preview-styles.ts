import { compile } from 'tailwindcss'
import type { Variant } from '../src/domain/types'
import { validVariant } from '../src/domain/validation'

const MAX_CANDIDATES = 2000
export const PREVIEW_STYLE_CACHE_ENTRIES = 16
export const PREVIEW_STYLE_CACHE_CHARACTERS = 500000
type UtilityStyles = { css: string; hasUtilities: boolean }
type CompileUtilities = (base: string) => Promise<{ build: (candidates: string[]) => string }>
type CacheEntry = { result: Promise<UtilityStyles>; characters: number }
const styleError =
  'A preview relies on missing styles or external dependencies. Try again with a self-contained design; your previous canvas is unchanged.'

/** Only static class names are compiled; generated JS/React and project config never run. */
const classCandidates = (html: string) => {
  const candidates = new Set<string>()
  for (const match of html.matchAll(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const value = (match[1] ?? match[2] ?? match[3]).replace(/&amp;/g, '&')
    for (const token of value.split(/\s+/)) {
      if (token && token.length <= 256) candidates.add(token)
      if (candidates.size > MAX_CANDIDATES)
        throw new Error('The preview has too many style classes. Try a smaller component.')
    }
  }
  return [...candidates]
}

export const createPreviewStyler = (base: string, compileUtilities: CompileUtilities = compile) => {
  // Cache only host-generated utility CSS, never authored CSS, React, HTML or JS.
  // Each panel owns its cache; both the entry count and retained character count are bounded.
  const cache = new Map<string, CacheEntry>()
  let retainedCharacters = 0
  const remove = (key: string) => {
    const entry = cache.get(key)
    if (entry) retainedCharacters -= entry.characters
    cache.delete(key)
  }
  const trim = () => {
    while (
      cache.size > PREVIEW_STYLE_CACHE_ENTRIES ||
      retainedCharacters > PREVIEW_STYLE_CACHE_CHARACTERS
    ) {
      const oldest = cache.keys().next().value
      if (oldest === undefined) break
      remove(oldest)
    }
  }
  const utilityStyles = (candidates: string[]): Promise<UtilityStyles> => {
    if (candidates.length === 0) return Promise.resolve({ css: '', hasUtilities: false })
    const key = candidates.sort().join(' ')
    const existing = cache.get(key)
    if (existing) {
      cache.delete(key)
      cache.set(key, existing)
      return existing.result
    }
    const result = compileUtilities(base).then((compiler) => {
      const empty = compiler.build([])
      const css = compiler.build(candidates)
      const hasUtilities = css !== empty
      return { css: hasUtilities ? css : '', hasUtilities }
    })
    const entry: CacheEntry = { result, characters: key.length }
    cache.set(key, entry)
    retainedCharacters += entry.characters
    trim()
    void result.then(
      (styles) => {
        if (cache.get(key) !== entry) return
        entry.characters += styles.css.length
        retainedCharacters += styles.css.length
        trim()
      },
      () => {
        // Retry local compilation on a later user action if it failed, without caching the failure.
        if (cache.get(key) === entry) remove(key)
      },
    )
    return result
  }
  return async (variant: Variant): Promise<Variant> => {
    const css = variant.css.replace(/\/\*[\s\S]*?\*\//g, '')
    if (
      /@(import|tailwind|apply|theme|config|plugin|source)\b/i.test(css) ||
      /<(?:script|link|style)\b/i.test(variant.html)
    )
      throw new Error(styleError)
    try {
      const candidates = classCandidates(variant.html)
      // A fresh compiler on each cache miss prevents cross-variant class accumulation.
      // No loadModule/loadStylesheet callbacks: imports/plugins cannot access the filesystem.
      const { css: utilities, hasUtilities } = await utilityStyles(candidates)
      if (!hasUtilities && !/[^{}\s]+\s*\{[^{}]*[\w-]+\s*:\s*[^;{}]+/.test(css))
        throw new Error(styleError)
      // Keep authored CSS last and unlayered so explicit component styles take precedence.
      const styled = {
        ...variant,
        css: hasUtilities ? `${utilities}\n${variant.css}` : variant.css,
      }
      const declarations = `${styled.css}\n${variant.html}`
      const defined = new Set(
        [...declarations.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]),
      )
      for (const [, name] of styled.css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
        if (!defined.has(name)) throw new Error(styleError)
      }
      // These are project-specific tokens, not part of the bundled Tailwind preset.
      for (const candidate of candidates) {
        if (
          /(?:^|:)(?:bg|text|border|ring|outline|fill|stroke)-(?:background|foreground|primary|secondary|muted|accent|card|popover|destructive|input|border|ring)(?:-|\/|$)/.test(
            candidate,
          ) &&
          !styled.css.includes(`.${candidate.replace(/[^\w-]/g, '\\$&')}`)
        )
          throw new Error(styleError)
      }
      if (!validVariant(styled)) throw new Error(styleError)
      return styled
    } catch {
      throw new Error(styleError)
    }
  }
}
