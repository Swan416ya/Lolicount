// Glyph handoff: when the home hero's ten-tap easter egg fires, the title's
// letter spans are captured into a fixed, body-level layer so they stay
// pinned at their on-screen spot while the route switches to the glyph
// playground, where the physics engine takes over from exactly that spot.
// A window scroll lock keeps the collapse and navigation from scrolling.
// Mirrors the reference site's handoff module, including the 3s
// auto-release safety timer for a failed navigation.

// The wordmark's droog family + heavy weight; the responsive sizing and
// white-space rules live in the glyph page's scoped CSS (UnoCSS does not
// scan utility classes inside .ts modules).
export const GLYPH_WORD_CLASS = 'droog'

const SCROLL_LOCK_MS = 600
const HANDOFF_TIMEOUT_MS = 3000

interface GlyphCapture {
  origin: HTMLElement
  layer: HTMLDivElement
  spans: HTMLElement[]
  styles: string[]
}

interface PendingHandoff {
  release: () => void
  timer: ReturnType<typeof setTimeout>
  glyphs: GlyphCapture | null
}

let pending: PendingHandoff | null = null

// Hide window scrolling until release(); ready resolves once the implicit
// scroll-to-top has had its time to finish, like the reference's lock.
export const scrollLock = (): { ready: Promise<void>; release: () => void } => {
  const root = document.documentElement
  const prevOverflow = root.style.overflow
  const prevGutter = root.style.scrollbarGutter
  if (window.innerWidth > root.clientWidth) root.style.scrollbarGutter = 'stable'
  root.style.overflow = 'hidden'
  let released = false
  const release = (): void => {
    if (released) return
    released = true
    root.style.overflow = prevOverflow
    root.style.scrollbarGutter = prevGutter
  }
  const ready =
    window.scrollY <= 0
      ? ((window.scrollTo(0, 0), Promise.resolve()))
      : new Promise<void>((resolve) => setTimeout(resolve, SCROLL_LOCK_MS))
  return { ready, release }
}

// Pin each direct child span of nameEl at its current rect inside a fixed
// body-level layer; the original inline styles are kept for the restore.
const capture = (nameEl: HTMLElement): GlyphCapture => {
  const spans = Array.from(nameEl.children) as HTMLElement[]
  const rects = spans.map((s) => s.getBoundingClientRect())
  const styles = spans.map((s) => s.style.cssText)
  const computed = getComputedStyle(nameEl)
  const layer = document.createElement('div')
  layer.style.cssText = 'position:fixed;inset:0;z-index:20;pointer-events:none;'
  Object.assign(layer.style, {
    fontFamily: computed.fontFamily,
    fontSize: computed.fontSize,
    fontWeight: computed.fontWeight,
  })
  spans.forEach((span, i) => {
    const rect = rects[i]!
    Object.assign(span.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: '0',
    })
    layer.appendChild(span)
  })
  document.body.appendChild(layer)
  return { origin: nameEl, layer, spans, styles }
}

const restore = (glyphs: GlyphCapture, container: HTMLElement): void => {
  glyphs.spans.forEach((span, i) => {
    span.style.cssText = glyphs.styles[i] ?? ''
    container.appendChild(span)
  })
  glyphs.layer.remove()
}

// Clear the pending handoff, restoring any not-yet-consumed capture to its
// origin (or dropping the layer if the origin already navigated away) and
// releasing the scroll lock.
const clear = (): void => {
  if (!pending) return
  clearTimeout(pending.timer)
  const { release, glyphs } = pending
  pending = null
  if (glyphs) {
    if (glyphs.origin.isConnected) restore(glyphs, glyphs.origin)
    else glyphs.layer.remove()
  }
  release()
}

// Arm the handoff: capture the title spans and start the safety timer.
export const startGlyphHandoff = (release: () => void, nameEl?: HTMLElement): void => {
  clear()
  pending = {
    release,
    timer: setTimeout(clear, HANDOFF_TIMEOUT_MS),
    glyphs: nameEl ? capture(nameEl) : null,
  }
}

// Move the captured spans into container (the glyph page wordmark) and mark
// the handoff consumed; returns whether a capture was pending.
export const consumeGlyphHandoff = (container: HTMLElement): boolean => {
  const glyphs = pending?.glyphs
  if (!pending || !glyphs) return false
  pending.glyphs = null
  restore(glyphs, container)
  return true
}

// Drop any pending state and release the scroll lock.
export const resetGlyphHandoff = (): void => {
  clear()
}

export const hasGlyphHandoff = (): boolean => pending?.glyphs != null

// Trim to a non-empty string of at most 32 chars, like the reference.
export const sanitizeGlyphText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (text.length === 0 || text.length > 32) return undefined
  return text
}
