<script setup lang="ts">
import gsap from 'gsap'
import { droogGlyphs } from '../data/droog-glyphs'

// Chanfoo-style hero: the wordmark letters drop in with squash & stretch,
// the whole text block slides out from behind the avatar, the avatar
// bounces down beside it, and the subtitle unfolds letter by letter. The
// timing tables and the entrance cleanup mirror the reference site's
// desktop/mobile choreography.
// Half of the loads use the reference's "morph" variant instead: the name
// letters are replaced by SVG glyph outlines that orbit the word's center
// while morphing out of rounded boxes, then hand off to the real letters.
// Letter interactions also mirror it: hovering rotates a letter 90/180
// degrees (per its shape) around its own center, clicking spins the whole
// word outward ring by ring, and both play a short drum hit.
// The avatar follows the pointer while dragged and springs back on release.

const TITLE = 'Lolicount'
const SUBTITLE = 'SVG Counter / Theme Engine'

// Deterministic per-letter color tokens, replicating the reference site's LCG
// (seed 42, multiplier 1664525, increment 1013904223) over the three text
// tokens with the "no adjacent repeat" rule.
const TOKENS = ['body', 'subtext-0', 'subtext-1'] as const
const titleColorTokens = (() => {
  let t = 42
  let prev = -1
  return TITLE.split('').map(() => {
    t = (Math.imul(t, 1664525) + 1013904223) | 0
    let index = (t >>> 16) % TOKENS.length
    if (index === prev) index = (index + 1) % TOKENS.length
    prev = index
    return index
  })
})()

// Hover rotation per letter shape, ported from the reference's char map:
// round/boxy letters (O C N H D G Q 0 4) spin 90 degrees, the rest of A-Z
// and 1 2 3 5 6 7 8 9 spin 180, and F has no hover rotation (drum only).
const HOVER_90 = new Set(['O', 'C', 'N', 'H', 'D', 'G', 'Q', '0', '4'])
const hoverDegrees = (letter: string): number => {
  const ch = letter.toUpperCase()
  if (HOVER_90.has(ch)) return 90
  if (ch !== 'F' && /^[A-Z0-9]$/.test(ch)) return 180
  return 0
}

const titleLetters = [...TITLE]
const subtitleWords = SUBTITLE.split(' ')

const heroRoot = ref<HTMLElement | null>(null)
const avatarEl = ref<HTMLElement | null>(null)
const copyEl = ref<HTMLElement | null>(null)
const titleEl = ref<HTMLElement | null>(null)
const glyphOverlayEl = ref<SVGSVGElement | null>(null)
const subtitleEl = ref<HTMLElement | null>(null)
const letterEls = ref<HTMLElement[]>([])

const letterColor = (index: number): string => `var(--token-${TOKENS[titleColorTokens[index]]})`

const FxTables = {
  desktop: {
    dropName: { launchY: -80, compressY: 0.6, compressX: 1.3, stretchY: 1.3, stretchX: 0.8, squashY: 0.7, squashX: 1.2 },
    avatar: { offsetY: 80, launchY: -120, compressY: 0.75, compressX: 1.1, squashY: 0.85, squashX: 1.25 },
    majors: { offsetY: 20, stretchY: 1.3, stretchX: 0.8, squashY: 0.7, squashX: 1.2 },
  },
  mobile: {
    dropName: { launchY: -56, compressY: 0.72, compressX: 1.21, stretchY: 1.21, stretchX: 0.86, squashY: 0.79, squashX: 1.14 },
    avatar: { offsetY: 56, launchY: -84, compressY: 0.82, compressX: 1.07, squashY: 0.9, squashX: 1.18 },
    majors: { offsetY: 14, stretchY: 1.21, stretchX: 0.86, squashY: 0.79, squashX: 1.14 },
  },
} as const

const drag = { pointerId: -1, startX: 0, startY: 0 }
let entranceDone = false
let spinBusy = false
let lastHoverBlip = 0

const onAvatarPointerDown = (event: PointerEvent) => {
  if (!avatarEl.value) return
  setAvatarScale(0.9)
  if (drag.pointerId !== -1) return
  drag.pointerId = event.pointerId
  drag.startX = event.clientX
  drag.startY = event.clientY
  avatarEl.value.setPointerCapture(event.pointerId)
  gsap.killTweensOf(avatarEl.value, 'x,y,rotate')
}

const onAvatarPointerMove = (event: PointerEvent) => {
  if (!avatarEl.value || event.pointerId !== drag.pointerId) return
  const dx = event.clientX - drag.startX
  const dy = event.clientY - drag.startY
  gsap.set(avatarEl.value, { x: dx, y: dy, rotate: dx * 0.03 })
}

const onAvatarPointerUp = (event: PointerEvent) => {
  if (!avatarEl.value || event.pointerId !== drag.pointerId) return
  drag.pointerId = -1
  avatarEl.value.releasePointerCapture(event.pointerId)
  setAvatarScale(1.1)
  gsap.to(avatarEl.value, { x: 0, y: 0, rotate: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' })
}

// Avatar press/hover scale, values and ease ported from the reference.
const setAvatarScale = (scale: number) => {
  if (avatarEl.value && entranceDone && drag.pointerId === -1) {
    gsap.to(avatarEl.value, { scale, duration: 0.25, ease: 'overshoot', overwrite: true })
  }
}

const { playDrum } = useSoundFx()

// Spin direction from the pointer position relative to the letter's center,
// ported from the reference: the dominant axis decides, right/top of the
// letter spin clockwise, left/bottom counter-clockwise.
const hoverDirection = (event: MouseEvent, el: HTMLElement): string => {
  const rect = el.getBoundingClientRect()
  const nx = (event.clientX - rect.left) / rect.width - 0.5
  const ny = (event.clientY - rect.top) / rect.height - 0.5
  if (Math.abs(nx) > Math.abs(ny)) return nx > 0 ? '+=' : '-='
  return ny > 0 ? '-=' : '+='
}

// Rotate one letter on hover. The rotation is RELATIVE (like the
// reference), so repeated hovers accumulate until a click spin resets the
// word. Skipped while the letter is already tweening or a word spin is in
// flight; returns whether the rotation actually started (drum follows).
const hoverRotate = (el: HTMLElement, event: MouseEvent): boolean => {
  const deg = hoverDegrees(el.textContent ?? '')
  if (deg === 0 || gsap.isTweening(el) || spinBusy) return false
  gsap.to(el, {
    rotation: `${hoverDirection(event, el)}${deg}`,
    duration: 0.4,
    ease: 'back.out(1.7)',
    transformOrigin: 'center center',
  })
  return true
}

const onLetterHover = (event: MouseEvent, index: number) => {
  const span = letterEls.value[index]
  if (!span || !hoverRotate(span, event)) return
  const now = performance.now()
  if (now - lastHoverBlip < 50) return
  lastHoverBlip = now
  playDrum()
}

const isCoarse = (): boolean =>
  window.matchMedia('(hover: none) and (pointer: coarse)').matches

// Click/tap a letter: on touch the reference treats the tap as the hover
// rotation plus a drum; on mouse, letters with a hover rotation spin the
// whole word outward ring by ring, the rest just blip.
const onLetterClick = (event: MouseEvent, index: number) => {
  const span = letterEls.value[index]
  if (isCoarse()) {
    if (span) hoverRotate(span, event)
    playDrum()
    return
  }
  if (span && hoverDegrees(span.textContent ?? '') === 0) {
    playDrum()
    return
  }
  spinWord(index)
}

// The word-wide click spin, ported from the reference: the clicked letter
// turns a full turn, neighbours spin outward ring by ring (50ms per ring,
// back.out), and a rotation that is not at a clean 360 multiple tweens
// back to 0 instead.
const spinWord = (index: number) => {
  const root = heroRoot.value
  if (!root || spinBusy) return
  spinBusy = true
  const spans = letterEls.value
  const center = Math.min(index, spans.length - 1)
  const outer = Math.max(center, spans.length - 1 - center)
  for (let ring = 0; ring <= outer; ring++) {
    let first = true
    for (const i of [center - ring, center + ring]) {
      if (i < 0 || i >= spans.length || (ring > 0 && i === center)) continue
      const isFirst = first
      first = false
      const span = spans[i]
      const current = Math.round(gsap.getProperty(span, 'rotation') as number)
      const clean = current % 360 === 0
      const dir = i < center ? -1 : 1
      gsap.to(span, {
        rotation: clean ? current + dir * 360 : 0,
        duration: 0.4,
        ease: 'back.out(1.7)',
        delay: ring * 0.05,
        overwrite: true,
        onStart: isFirst ? playDrum : undefined,
        onComplete: () => {
          if (clean) gsap.set(span, { rotation: 0 })
          if (ring === outer) spinBusy = false
        },
      })
    }
  }
}

// --- Morph entrance variant, ported from the reference's "morph" handoff ---

// The reference rolls the entrance variant at runtime: when every letter of
// the name has an extracted glyph outline, half of the loads replace the
// letter drop with the SVG handoff below. ?fx=morph|drop forces one
// variant for manual testing.
const pickEntranceVariant = (): 'drop' | 'morph' => {
  const forced = useRoute().query.fx
  if (forced === 'drop' || forced === 'morph') return forced
  const chars = [...TITLE].filter(c => c.trim())
  if (chars.length === 0 || !chars.every(c => c in droogGlyphs.glyphs)) return 'drop'
  return Math.random() < 0.5 ? 'drop' : 'morph'
}

const TAU = Math.PI * 2
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const randBetween = (min: number, max: number) => min + Math.random() * (max - min)

// Rounded-box path used as the morph start shape, ported from the
// reference: a box of width 2*halfHeight centered at (halfAdvance, centerY)
// with quarter-circle corners (radius = halfHeight * bezierKappa).
const glyphBoxPath = (halfAdvance: number, centerY: number, halfHeight: number): string => {
  const r = halfHeight * 0.5522847498
  const i = (v: number) => Math.round(v * 10) / 10
  const x = halfAdvance
  const y = centerY
  const h = halfHeight
  return [
    `M${i(x)},${i(y - h)}`,
    `C${i(x + r)},${i(y - h)} ${i(x + h)},${i(y - r)} ${i(x + h)},${i(y)}`,
    `C${i(x + h)},${i(y + r)} ${i(x + r)},${i(y + h)} ${i(x)},${i(y + h)}`,
    `C${i(x - r)},${i(y + h)} ${i(x - h)},${i(y + r)} ${i(x - h)},${i(y)}`,
    `C${i(x - h)},${i(y - r)} ${i(x - r)},${i(y - h)} ${i(x)},${i(y - h)}`,
    'Z',
  ].join(' ')
}

// Baseline Y of an inline element via a zero-size probe span (ported).
const baselineTop = (el: HTMLElement): number => {
  const probe = document.createElement('span')
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
  el.appendChild(probe)
  const top = probe.getBoundingClientRect().top
  probe.remove()
  return top
}

// Build and play the morph handoff on the given timeline (appended at the
// "dropName" label). All constants mirror the reference: pop 0.4s
// overshoot, morph 0.7s power2.out, orbit radius 1s circ.out, sweep
// circ.in, final 30% of the arc back.out(1), full-turn spin back.out(2),
// staggered release back.out(1.7), then the real letters fade in while the
// overlay fades out. Returns a cleanup callback that clears the overlay.
const playMorphEntrance = (
  tl: ReturnType<typeof gsap.timeline>,
  nameEl: HTMLElement,
  overlay: SVGSVGElement,
  chars: HTMLElement[],
): (() => void) => {
  const upm = droogGlyphs.unitsPerEm
  const scale = Number.parseFloat(getComputedStyle(nameEl).fontSize) / upm
  const o = overlay.getBoundingClientRect()
  const s = -droogGlyphs.xHeight / 2
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const items = chars.flatMap((el) => {
    const ch = el.textContent ?? ''
    const glyph = droogGlyphs.glyphs[ch]
    if (!glyph) return []
    const rect = el.getBoundingClientRect()
    const x = rect.left - o.left
    const y = baselineTop(el) - o.top
    const g = document.createElementNS(SVG_NS, 'g')
    g.setAttribute('transform', `translate(${x} ${y}) scale(${scale})`)
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', glyphBoxPath(glyph.advance / 2, s, 0.55 * upm))
    path.style.fill = 'currentColor'
    path.style.transition = 'fill 0.4s ease'
    g.appendChild(path)
    overlay.appendChild(g)
    return [{ path, glyph, char: ch, pivot: `${rect.width / 2 / scale} ${(rect.top + rect.height / 2 - o.top - y) / scale}`, color: el.style.color, x, y }]
  })
  const clear = () => overlay.replaceChildren()
  if (items.length === 0) return clear

  const first = items[0]
  const last = items[items.length - 1]
  // Center of the word block (first letter's left edge to last letter's
  // right edge, baselines averaged) in CSS px: the orbit's home point.
  const homeX = (first.x + last.x + last.glyph.advance * scale) / 2
  const homeY = (first.y + last.y) / 2 + s * scale
  // Where each path (font-unit local coords) must sit for its box center to
  // land on the word center.
  const centers = items.map(({ x, y, glyph }) => ({ cx: (homeX - x) / scale - glyph.advance / 2, cy: (homeY - y) / scale - s }))
  items.forEach(({ path, pivot }, n) => {
    gsap.set(path, { x: centers[n].cx, y: centers[n].cy, scale: 0, svgOrigin: pivot })
  })
  tl.to(items.map(e => e.path), { scale: 1, duration: 0.4, ease: 'overshoot' }, 'dropName')
  const dist = centers.map(({ cx, cy }) => Math.hypot(cx, cy))
  const order: number[] = []
  dist.map((d, t) => t).sort((a, b) => dist[a] - dist[b]).forEach((t, rank) => { order[t] = rank })
  const baseAngle = randBetween(0, TAU)
  const at = 'dropName+=0.5'
  let latest = 0
  const settles: number[] = []
  items.forEach(({ path, glyph, char, color }, index) => {
    const { cx, cy } = centers[index]
    const angle0 = baseAngle + order[index] * GOLDEN_ANGLE + randBetween(-0.2, 0.2)
    const dir = Math.random() < 0.5 ? 1 : -1
    const d = 2.1 + index * 0.1
    const arrive = `dropName+=${d}`
    const sweep = (dir * (Math.atan2(-cy, -cx) - angle0) % TAU + TAU) % TAU
    const total = sweep + TAU * Math.max(1, Math.round((2.5 * Math.PI - sweep) / TAU))
    const mainSweep = total - total * 0.3
    const orbit = { a: angle0, r: 0 }
    const applyOrbit = () => gsap.set(path, { x: cx + Math.cos(orbit.a) * orbit.r, y: cy + Math.sin(orbit.a) * orbit.r })
    const orbitTo = (vars: gsap.TweenVars, position: string) => tl.to(orbit, { ...vars, onUpdate: applyOrbit }, position)
    if (color) tl.add(() => { path.style.fill = color }, at)
    tl.to(path, { morphSVG: { shape: glyph.d, shapeIndex: 'auto' }, duration: 0.7, ease: 'power2.out' }, at)
    orbitTo({ r: dist[index], duration: 1, ease: 'circ.out' }, at)
    orbitTo({ a: angle0 + dir * mainSweep, duration: d - 0.5, ease: 'circ.in' }, at)
    orbitTo({ a: angle0 + dir * total, duration: 0.8, ease: 'back.out(1)' }, arrive)
    const settle = dir * hoverDegrees(char)
    const spin = dir * 360 * (Math.random() < 0.5 ? 1 : 2)
    tl.to(path, { rotation: spin + settle, duration: d + 0.3, ease: 'back.out(2)' }, at)
    tl.set(path, { rotation: settle }, `dropName+=${d + 0.8}`)
    settles.push(settle)
    latest = Math.max(latest, d + 0.8)
  })
  const resetAt = latest + 0.15
  items.forEach(({ path }, r) => {
    if (settles[r] !== 0) tl.to(path, { rotation: 0, duration: 0.4, ease: 'back.out(1.7)' }, `dropName+=${resetAt + r * 0.05}`)
  })
  const done = resetAt + (items.length - 1) * 0.05 + 0.4
  tl.addLabel('dropNameHandoff', `dropName+=${done + 0.12}`)
  tl.set(chars, { opacity: 1 }, 'dropNameHandoff')
  tl.to(overlay, { opacity: 0, duration: 0.4, ease: 'none', onComplete: clear }, 'dropNameHandoff')
  return () => {
    clear()
    gsap.set(overlay, { clearProps: 'opacity' })
  }
}

onMounted(() => {
  useEases()
  const root = heroRoot.value
  const avatar = avatarEl.value
  const copy = copyEl.value
  const subtitle = subtitleEl.value
  if (!root || !avatar || !copy || !subtitle) return

  letterEls.value = Array.from(root.querySelectorAll<HTMLElement>('.hero-letter'))
  const majorWords = Array.from(subtitle.querySelectorAll<HTMLElement>('.major-word'))
  const majorLetters = Array.from(subtitle.querySelectorAll<HTMLElement>('.major-letter'))

  const fx = window.matchMedia('(min-width: 1024px)').matches ? FxTables.desktop : FxTables.mobile
  const variant = pickEntranceVariant()
  let morphCleanup: (() => void) | null = null

  // Entrance cleanup, ported from the reference: the squash & stretch ran
  // with transformOrigin 'center bottom', but the rotation interactions
  // need 'center center'. clearProps('transform') alone leaves the stale
  // origin behind (letters then spin around their bottom edge), so reset
  // it explicitly here.
  const finish = () => {
    if (entranceDone) return
    entranceDone = true
    gsap.set(letterEls.value, { transformOrigin: 'center center' })
    gsap.set(majorLetters, { transformOrigin: 'center center' })
    gsap.set(avatar, { transformOrigin: 'center center' })
    gsap.set(copy, { clearProps: 'transform,pointer-events' })
    gsap.set(avatar, { clearProps: 'transform,opacity,scale' })
    avatar.style.pointerEvents = ''
    gsap.set(subtitle, { clearProps: 'height,overflow' })
  }

  gsap.set(letterEls.value, { opacity: 0, y: 0, scaleX: 1, scaleY: 1, transformOrigin: 'center bottom' })
  gsap.set(majorLetters, { opacity: 0, y: fx.majors.offsetY, scaleX: 1, scaleY: 1, transformOrigin: 'center bottom' })
  gsap.set(copy, { pointerEvents: 'none' })
  gsap.set(subtitle, { height: 0, overflow: 'hidden' })
  gsap.set(avatar, { opacity: 0, y: fx.avatar.offsetY, scaleX: 1, scaleY: 1, transformOrigin: 'center bottom', pointerEvents: 'none' })

  // The text block starts stacked over the avatar and slides to its final
  // place, like the reference's entrance.
  const copyRect = copy.getBoundingClientRect()
  const avatarRect = avatar.getBoundingClientRect()
  gsap.set(copy, { x: avatarRect.left - copyRect.left, y: avatarRect.top - copyRect.top })

  const tl = gsap.timeline({ paused: true })
  tl.addLabel('dropName', 0.3)
  if (variant === 'morph' && titleEl.value && glyphOverlayEl.value) {
    morphCleanup = playMorphEntrance(tl, titleEl.value, glyphOverlayEl.value, letterEls.value)
  } else {
    letterEls.value.forEach((span, index) => {
      const mini = gsap.timeline()
      mini.set(span, { opacity: 1 })
      mini.to(span, { scaleY: fx.dropName.compressY, scaleX: fx.dropName.compressX, duration: 0.1, ease: 'power2.in' })
      mini.to(span, { y: fx.dropName.launchY, scaleY: fx.dropName.stretchY, scaleX: fx.dropName.stretchX, duration: 0.3, ease: 'power4.out' })
      mini.to(span, { y: 0, scaleY: fx.dropName.squashY, scaleX: fx.dropName.squashX, duration: 0.25, ease: 'power4.in' })
      mini.to(span, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' })
      tl.add(mini, `dropName+=${index * 0.05}`)
    })
  }

  tl.addLabel('avatarEntrance', '>')
  tl.to(copy, { x: 0, y: 0, duration: 0.5, ease: 'overshoot' }, 'avatarEntrance+=0.05')
  const avatarMini = gsap.timeline()
  avatarMini.to(avatar, { opacity: 1, scaleY: fx.avatar.compressY, scaleX: fx.avatar.compressX, duration: 0.08, ease: 'power2.in' })
  avatarMini.to(avatar, { y: fx.avatar.launchY, scaleY: 1, scaleX: 1, duration: 0.25, ease: 'power2.out' })
  avatarMini.to(avatar, { y: 0, scaleY: fx.avatar.squashY, scaleX: fx.avatar.squashX, duration: 0.25, ease: 'power3.in' })
  avatarMini.to(avatar, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
  tl.add(avatarMini, 'avatarEntrance+=0.05')

  tl.addLabel('slideMajors', '>-0.4')
  tl.to(subtitle, { height: 'auto', duration: 0.5, ease: 'expo.inOut' }, 'slideMajors')
  let wordOffset = 0.15
  majorWords.forEach((word, wordIndex) => {
    if (wordIndex > 0) wordOffset += 0.2
    const letters = word.querySelectorAll<HTMLElement>('.major-letter')
    letters.forEach((span, letterIndex) => {
      const mini = gsap.timeline()
      mini.set(span, { opacity: 1 })
      mini.to(span, { y: 0, scaleY: fx.majors.stretchY, scaleX: fx.majors.stretchX, duration: 0.25, ease: 'power4.out' })
      mini.to(span, { scaleY: fx.majors.squashY, scaleX: fx.majors.squashX, duration: 0.15, ease: 'power2.in' })
      mini.to(span, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' })
      tl.add(mini, `slideMajors+=${wordOffset + letterIndex * 0.05}`)
    })
    wordOffset += letters.length * 0.05
  })

  tl.add(finish)

  let started = false
  const start = () => {
    if (started) return
    started = true
    tl.play()
  }
  const { ready } = usePageReady()
  if (ready.value) start()
  else watch(ready, (value) => {
    if (value) start()
  })

  // Breakpoint change mid-entrance: the reference fast-forwards to the
  // finished state instead of replaying with the other timing table.
  const mq = window.matchMedia('(min-width: 1024px)')
  const onMqChange = () => {
    if (entranceDone) return
    started = true
    tl.progress(1)
  }
  mq.addEventListener('change', onMqChange)

  onBeforeUnmount(() => {
    mq.removeEventListener('change', onMqChange)
    morphCleanup?.()
    tl.kill()
  })
})
</script>

<template>
  <section ref="heroRoot" class="home-hero">
    <div class="hero-inner">
      <div
        ref="avatarEl"
        class="hero-avatar"
        style="opacity: 0; pointer-events: none"
        data-no-cursor-firework
        data-nojs-reveal
        @pointerdown="onAvatarPointerDown"
        @pointermove="onAvatarPointerMove"
        @pointerup="onAvatarPointerUp"
        @pointercancel="onAvatarPointerUp"
        @pointerenter="setAvatarScale(1.1)"
        @pointerleave="setAvatarScale(1)"
      >
        <img src="/images/avatar.webp" alt="Lolicount" draggable="false" />
      </div>

      <div ref="copyEl" class="hero-copy">
        <div class="hero-title-wrap">
          <h1 ref="titleEl" class="hero-title droog" data-no-cursor-firework>
            <span
              v-for="(letter, index) in titleLetters"
              :key="`title-${index}`"
              class="hero-letter"
              :style="{ color: letterColor(index) }"
              data-nojs-reveal
              @click="onLetterClick($event, index)"
              @mouseenter="onLetterHover($event, index)"
            >{{ letter }}</span>
          </h1>
          <svg ref="glyphOverlayEl" class="hero-glyph-overlay" aria-hidden="true"></svg>
        </div>

        <p ref="subtitleEl" class="hero-subtitle droog" style="height: 0; overflow: hidden" data-nojs-reveal>
          <span
            v-for="(word, wordIndex) in subtitleWords"
            :key="`word-${wordIndex}`"
            class="major-word"
            :class="{ 'major-word-last': wordIndex === subtitleWords.length - 1 }"
          >
            <span
              v-for="(letter, letterIndex) in [...word]"
              :key="`major-${wordIndex}-${letterIndex}`"
              class="major-letter"
              data-nojs-reveal
            >{{ letter }}</span>
          </span>
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-hero {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 2 * var(--frame-gutter) - 64px);
  padding: 4rem 1.5rem;
}

.hero-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  user-select: none;
}

.hero-avatar {
  width: min(320px, 78vw);
  aspect-ratio: 1 / 1;
  flex: 0 0 auto;
  cursor: grab;
  touch-action: none;
}

.hero-avatar:active {
  cursor: grabbing;
}

.hero-avatar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.hero-title-wrap {
  position: relative;
}

/* Morph-variant overlay: hosts the SVG glyph paths while they orbit and
morph, exactly covering the title box; content may overflow it. */
.hero-glyph-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.hero-title {
  margin: 0;
  font-size: 1.875rem;
  line-height: 1;
  white-space: nowrap;
}

.hero-letter {
  display: inline-block;
  opacity: 0;
  line-height: 1;
}

.hero-subtitle {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 300;
  line-height: 1.5;
  color: var(--text-muted);
}

.major-word {
  display: inline-flex;
  align-items: center;
  margin-right: 0.25em;
}

.major-word-last {
  margin-right: 0;
}

.major-letter {
  display: inline-block;
  opacity: 0;
  line-height: 1;
}

@media (min-width: 640px) {
  .hero-title {
    font-size: 3rem;
  }
}

@media (min-width: 768px) {
  .hero-subtitle {
    font-size: 1.125rem;
  }
}

@media (min-width: 1024px) {
  .hero-inner {
    flex-direction: row;
    gap: 6rem;
  }

  .hero-copy {
    align-items: flex-start;
  }
}

@media (min-width: 1280px) {
  .hero-title {
    font-size: 3.75rem;
  }

  .hero-subtitle {
    font-size: 1.5rem;
  }
}
</style>
