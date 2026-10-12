<script setup lang="ts">
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Full port of the reference site's "Back To Top" widget (the about-page
// chibi). The geometry (viewBox, bubble outline, the ten letter glyphs,
// the 190/300 tail origin) and every animation value are copied 1:1 from
// the reference bundle:
//   - assembly on first scroll into view: the chibi rises from below
//     (yPercent 100 -> 0, power3.out) while swinging in from -16deg
//     (back.out(3)); the bubble scales out of its tail (back.out(2.5))
//     and the letters pop one by one (back.out(1.4), 0.04s stagger).
//   - hovering the bubble: it scales 1.05 with the reference overshoot
//     curve, its fill shifts crust -> surface, and the chibi tilts 6deg.
//   - hovering the chibi swaps the confused sprite for the angry one:
//     a one-shot pop (chibi-pop) plus an infinite shake (chibi-shake);
//     leaving plays the settle pop (chibi-pop-out).
//   - clicking the chibi squashes it, flings both sprites off screen in
//     parabolic arcs (540 / 180 deg/s) and smooth-scrolls to top; the
//     assembly timeline resets and replays on the next scroll-in.
//   - clicking the bubble just smooth-scrolls to top.
// Only the theme colors are remapped to our tokens (secondary-crust ->
// --loli-crust, surface-0 -> --loli-surface, text-body -> --text-color,
// accent-blue -> --loli-pink); the click feedback reuses the site-wide
// drum hit.

const { t } = useI18n()
const { playDrum } = useSoundFx()

// Bubble outline in the reference's 444.63 x 309.42 viewBox.
const BUBBLE_PATH = 'M144.43,246.75c-49.6-2.71-111.16-3.41-133.75-54.11C-76.34-18.3,395.9-59.06,435.9,85.47c16.1,48.69,10.5,86.52-21.75,127.78-37.35,37.98-96.89,30.56-145.88,39.44-17.54,4.24-24.03,22.95-34.89,36.2-46.52,60.63-30.86-31.56-47.15-39.36-12.7-5.31-28.38-1.12-41.81-2.78Z'
// The ten bubble glyphs; each animates in individually (data-letter).
const LETTER_PATHS = [
  'M91.93,70.52v-.12c0-.71.59-1.3,1.36-1.3l6.86-.41c3.37-1.36,7.75-2.19,12.18-2.19,14.02,0,19.93,7.63,19.93,15.14,0,3.96-1.89,7.22-4.44,9.58,1.66,1.36,3.02,2.66,3.9,4.79,1.01,2.31,1.48,4.49,1.48,6.45,0,10.05-12.01,15.5-23.84,15.5-3.31,0-14.37-.89-15.26-5.32l-2.19-42.11ZM107.72,88.56c2.9-.12,10-.41,10-5.5,0-2.72-2.13-5.26-7.22-5.26-1.12,0-2.25.12-3.31.35l.53,10.41ZM108.67,106.9c.83.12,1.6.18,2.37.18,4.38,0,7.57-1.89,7.57-4.85s-2.54-4.67-7.27-4.67c-1.12,0-2.19.06-3.13.18l.47,9.17Z',
  'M175.68,116.36c-.53,1.01-1.12,1.54-1.89,1.54-.59,0-4.73-.95-7.69-3.73-3.08,1.6-6.27,2.31-9.29,2.31-9.88,0-18.39-7.57-18.39-17.09,0-7.1,5.03-17.33,16.74-17.33,2.96,0,5.86.65,8.16,1.66.35-.41.89-.59,1.6-.59h.3l10.23.89c1.54.12,1.95.89,1.95,1.6v.3c-.83,5.38-1.66,10.53-1.66,14.43,0,3.55.65,6.09,2.54,7.1.59.3,1.24.65,1.24,1.24,0,.12-.06.3-.18.53l-3.67,7.16ZM161.72,99.86c0-1.54.06-3.13.18-4.91-.71-1.18-2.31-2.01-4.02-2.01-3.73,0-5.8,3.61-5.8,6.62,0,3.31,2.31,6.15,6.15,6.15,1.12,0,2.42-.24,3.79-.83-.18-1.54-.3-3.19-.3-5.03Z',
  'M211.69,93.35c-.24.71-.89,1.3-1.6,1.3-.24,0-.53-.12-.77-.3-1.06-.89-3.13-1.54-5.2-1.54-1.54,0-6.68.35-6.68,6.8,0,3.96,2.84,6.57,6.68,6.57,2.54,0,5.5-1.12,8.34-3.73.35-.35.89-.65,1.42-.65.41,0,.89.24,1.3.95,1.06,2.01,1.77,3.08,2.72,5.03.18.35.3.77.3,1.18,0,.71-.3,1.36-1.01,2.07-4.79,4.55-10.47,6.57-15.79,6.57-9.82,0-18.51-6.86-18.51-17.27,0-13.25,10.59-18.63,20.35-18.63,6.57,0,11.3,2.6,11.3,4.08,0,.12,0,.3-.06.41l-2.78,7.16Z',
  'M257.88,116.3c-.47.65-.95,1.01-1.54,1.01-.3,0-.65-.12-1.01-.35-3.25-2.13-10.65-6.68-13.66-8.58-.35-.24-.71-.71-.71-1.24,0-.3.12-.59.41-.95l4.38-5.26c-3.02,1.71-5.74,3.19-6.92,3.79l-.36.18.53,10.11c0,.71-.47,1.3-1.18,1.3l-11.83.65c-.65,0-1.24-.47-1.3-1.18l-2.48-48.32v-.12c0-.59.53-1.12,1.12-1.18l11.83-.59h.12c.65,0,1.12.53,1.18,1.18l1.3,25.14c2.43-1.89,12.6-9.46,15.2-9.46.47,0,1.01.24,1.48,1.01l4.91,7.98c.24.35.35.71.35,1.06,0,.59-.35,1.12-1.06,1.48-1.48.71-4.85,2.54-8.4,4.5,4.14,1.3,12.78,7.63,12.78,9.82,0,.35-.12.71-.41,1.18l-4.73,6.86Z',
  'M302.82,117.19h-.12c-.77,0-1.36-.65-1.36-1.36l-1.77-33.77-9.7.53c-.83,0-1.54-.59-1.54-1.36l-.53-10.94v-.12c0-.71.59-1.3,1.36-1.36l11.06-.59,23.42-1.24c.77,0,1.54.59,1.54,1.42l.53,10.82c0,.77-.59,1.48-1.42,1.54l-9.34.47,1.77,33.83v.06c0,.77-.65,1.36-1.36,1.42l-12.54.65Z',
  'M341.8,117.66c-9.64,0-18.1-6.98-18.1-17.39,0-12.18,9.11-18.51,19.52-18.51,13.07,0,18.69,10.23,18.69,17.92,0,11.53-11.71,17.98-20.11,17.98ZM349.31,99.56c0-1.12-.24-6.86-6.27-6.86-4.97,0-6.39,4.2-6.39,6.86,0,4.08,3.19,6.8,6.56,6.8,4.2,0,6.09-3.43,6.09-6.8Z',
  'M173.63,188.15h-.12c-.77,0-1.36-.65-1.36-1.36l-1.77-33.77-9.7.53c-.83,0-1.54-.59-1.54-1.36l-.53-10.94v-.12c0-.71.59-1.3,1.36-1.36l11.06-.59,23.42-1.24c.77,0,1.54.59,1.54,1.42l.53,10.82c0,.77-.59,1.48-1.42,1.54l-9.34.47,1.77,33.83v.06c0,.77-.65,1.36-1.36,1.42l-12.54.65Z',
  'M212.61,188.63c-9.64,0-18.1-6.98-18.1-17.39,0-12.18,9.11-18.51,19.52-18.51,13.07,0,18.69,10.23,18.69,17.92,0,11.53-11.71,17.98-20.11,17.98ZM220.12,170.53c0-1.12-.24-6.86-6.27-6.86-4.97,0-6.39,4.2-6.39,6.86,0,4.08,3.19,6.8,6.57,6.8,4.2,0,6.09-3.43,6.09-6.8Z',
  'M238.69,203.06c-.59,0-1.12-.53-1.12-1.18v-.12l2.37-46.72c.06-.65.59-1.18,1.18-1.18h.12l9.88.53c2.54-.95,5.14-1.42,7.63-1.42,10.41,0,19.75,7.57,19.75,18.34s-7.63,17.57-18.81,17.57c-2.48,0-4.91-.36-7.1-1.06l-.77,14.73c-.06.71-.59,1.18-1.3,1.18l-11.83-.65ZM253.12,176.8c1.3.65,3.02,1.12,4.67,1.12.47,0,6.15,0,6.15-6.51,0-4.08-3.08-6.92-7.22-6.92-.95,0-1.95.18-2.96.47l-.65,11.83Z',
  'M289.84,162.66c-.06-.24-.12-.41-.12-.59,0-.95.89-1.12,1.24-1.18,8.46-1.12,9.34-4.79,9.34-6.45,0-2.07-1.72-4.08-5.68-4.08-2.07,0-4.79.59-8.04,2.07-.12.06-.3.12-.53.12-.36,0-.83-.24-1.01-.95l-2.19-9.17v-.18c0-1.66,9.29-4.61,14.96-4.61,10.35,0,16.74,7.27,16.74,15.55,0,7.63-5.38,15.5-16.5,16.74-2.13.18-3.49.24-4.85.24-.47,0-1.42-.06-1.77-1.42l-1.6-6.09ZM299.84,188.75c-4.38,0-8.34-3.61-8.34-8.4,0-4.5,3.43-8.46,8.4-8.46s8.46,3.84,8.46,8.52-4.08,8.34-8.52,8.34Z',
]
// Tail-tip svgOrigin the bubble scales out of.
const BUBBLE_SVG_ORIGIN = '190 300'
// The assembly counts as settled once the chibi rise + swing are done;
// the throw is only allowed after that.
const ASSEMBLY_SETTLED_AT = 0.8

const rootEl = ref<HTMLElement | null>(null)
const chibiEl = ref<HTMLElement | null>(null)
const svgEl = ref<SVGSVGElement | null>(null)
// The widget only exists while the document actually overflows.
const enabled = ref(false)
let assembly: { tl: gsap.core.Timeline; enter: ScrollTrigger; leave: ScrollTrigger } | null = null
let assemblyContext: gsap.Context | null = null
let throwState: { tl: gsap.core.Timeline; ghosts: Element[] } | null = null

const scrollToTop = (): void => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Reference's Hv: non-touch pointer enter/leave flip the data-bh / data-h
// attributes the hover transitions key off.
const setHoverAttr = (el: HTMLElement | null, key: string, value: '0' | '1', e: PointerEvent): void => {
  if (e.pointerType !== 'touch' && el) el.dataset[key] = value
}

const resetAssembly = (): void => {
  assemblyContext?.revert()
  assemblyContext = null
  assembly = null
  if (chibiEl.value) gsap.set(chibiEl.value, { clearProps: 'transform,translate,rotate,scale' })
}

// Paused assembly timeline plus the two ScrollTriggers that play it when
// the widget scrolls into view and reverse it when the user goes back up.
const createAssembly = (): void => {
  const root = rootEl.value
  const chibi = chibiEl.value
  if (!root || !chibi || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  assemblyContext = gsap.context(() => {
    const tl = gsap.timeline({ paused: true })
      .from(chibi, { yPercent: 100, duration: 0.5, ease: 'power3.out' }, 0.2)
      .from(chibi, { rotation: -16, transformOrigin: '50% 100%', duration: 0.6, ease: 'back.out(3)' }, 0.2)
      .from('[data-bubble]', { scale: 0, svgOrigin: BUBBLE_SVG_ORIGIN, duration: 0.45, ease: 'back.out(2.5)' }, 0.55)
      .from('[data-letter]', { scale: 0.5, autoAlpha: 0, y: 6, transformOrigin: '50% 100%', duration: 0.35, ease: 'back.out(1.4)', stagger: 0.04 }, '-=0.2')
    const enter = ScrollTrigger.create({ trigger: root, start: 'top 85%', onEnter: () => { tl.play() } })
    const leave = ScrollTrigger.create({ trigger: root, start: 'top 95%', onLeaveBack: () => { tl.reverse() } })
    assembly = { tl, enter, leave }
  }, root)
}

// Reference's Bv: a fixed-position ghost clone of a sprite at its current
// screen rect so the throw can fly over everything (z 200 clears the nav
// bar and the frame mask).
const makeGhost = (source: HTMLElement | SVGElement, rect: DOMRect, stripClass: boolean): HTMLElement | SVGElement => {
  const ghost = source.cloneNode(true)
  if (stripClass) ghost.removeAttribute('class')
  if (ghost instanceof HTMLImageElement) {
    ghost.loading = 'eager'
    ghost.decoding = 'sync'
  }
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    zIndex: '200',
    pointerEvents: 'none',
    willChange: 'transform',
  })
  document.body.appendChild(ghost)
  return ghost
}

// Reference's Vv: parabolic fling. Upward velocity of 1.6 viewport
// heights against 4 viewport heights of gravity, landing past the
// viewport bottom while spinning at rotDegPerSec.
const fling = (el: HTMLElement | SVGElement, top: number, dir: number, rotDegPerSec: number): gsap.core.Tween => {
  const vx = dir * window.innerWidth * 0.45
  const vy = -window.innerHeight * 1.6
  const gravity = window.innerHeight * 4
  const distance = window.innerHeight - top
  const flight = (-vy + Math.sqrt(vy * vy + 2 * gravity * distance)) / gravity
  const proxy = { t: 0 }
  return gsap.to(proxy, {
    t: flight,
    duration: flight,
    ease: 'none',
    onStart: () => { el.style.transformOrigin = '50% 50%' },
    onUpdate: () => {
      const { t } = proxy
      el.style.transform = `translate(${vx * t}px, ${vy * t + 0.5 * gravity * t * t}px) rotate(${dir * rotDegPerSec * t}deg)`
    },
  })
}

const isAssemblySettled = (): boolean => {
  const tl = assembly?.tl
  return !tl || tl.time() >= ASSEMBLY_SETTLED_AT
}

const clickBubble = (): void => {
  playDrum()
  scrollToTop()
}

const throwChibi = (): void => {
  if (throwState || !isAssemblySettled()) return
  playDrum()
  const chibi = chibiEl.value
  const svg = svgEl.value
  const confuseImg = chibi?.querySelector<HTMLImageElement>('img[src*="confuse"]')
  if (!chibi || !svg || !confuseImg || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    scrollToTop()
    return
  }
  const imgRect = confuseImg.getBoundingClientRect()
  const svgRect = svg.getBoundingClientRect()
  const imgGhost = makeGhost(confuseImg, imgRect, false)
  const svgGhost = makeGhost(svg, svgRect, true)
  const ghosts: Element[] = [imgGhost, svgGhost]
  // Swap to the fixed ghosts only once the image clone has decoded, so
  // the handoff is seamless (reference behavior).
  const hideOriginals = (): void => {
    if (throwState) {
      chibi.style.opacity = '0'
      svg.style.opacity = '0'
    }
  }
  ;(imgGhost as HTMLImageElement).decode().then(hideOriginals, hideOriginals)
  const dir = Math.random() < 0.5 ? -1 : 1
  const tl = gsap.timeline({
    onComplete: (): void => {
      ghosts.forEach((g) => g.remove())
      const current = assembly
      current?.tl.pause(0)
      chibi.style.opacity = ''
      svg.style.opacity = ''
      if (current && current.enter.scroll() >= current.enter.start) current.tl.play()
      throwState = null
    },
  })
  tl.to(imgGhost, { scaleX: 1.15, scaleY: 0.8, transformOrigin: '50% 100%', duration: 0.25, ease: 'circ.out' })
    .to(imgGhost, { scaleX: 1, scaleY: 1, duration: 0.1, ease: 'circ.out' })
    .add(fling(imgGhost, imgRect.top, dir, 540))
    .call(() => {
      playDrum()
      scrollToTop()
    }, undefined, '<')
    .add(fling(svgGhost, svgRect.top, -dir, 180), '<')
  throwState = { tl, ghosts }
}

onMounted(() => {
  createAssembly()
  // Overflow gate: the widget only exists while the page scrolls, and the
  // triggers are re-measured whenever the document size changes.
  const update = (): void => {
    const overflow = document.documentElement.scrollHeight - document.documentElement.clientHeight
    const next = overflow > 0
    if (next !== enabled.value) enabled.value = next
    assembly?.enter.refresh()
    assembly?.leave.refresh()
  }
  update()
  window.addEventListener('resize', update)
  const ro = new ResizeObserver(update)
  ro.observe(document.documentElement)
  onBeforeUnmount(() => {
    window.removeEventListener('resize', update)
    ro.disconnect()
  })
})

// The reference rebuilds the assembly when the overflow state flips.
watch(enabled, () => {
  resetAssembly()
  createAssembly()
})

onBeforeUnmount(() => {
  throwState?.tl.kill()
  throwState?.ghosts.forEach((g) => g.remove())
  throwState = null
  resetAssembly()
})
</script>

<template>
  <div
    ref="rootEl"
    class="btt-group"
    :class="{ invisible: !enabled }"
    :inert="!enabled"
  >
    <button
      type="button"
      tabindex="0"
      class="btt-bubble-btn"
      :aria-label="t('nav.top')"
      @pointerenter="setHoverAttr(rootEl, 'bh', '1', $event)"
      @pointerleave="setHoverAttr(rootEl, 'bh', '0', $event)"
      @click="clickBubble"
    >
      <svg
        ref="svgEl"
        viewBox="0 0 444.63 309.42"
        aria-hidden="true"
        class="btt-svg"
      >
        <g data-bubble class="btt-bubble">
          <path :d="BUBBLE_PATH"></path>
        </g>
        <g class="btt-letters">
          <path
            v-for="(d, i) in LETTER_PATHS"
            :key="`btt-letter-${i}`"
            :d="d"
            data-letter="true"
          ></path>
        </g>
      </svg>
    </button>
    <div
      ref="chibiEl"
      class="btt-chibi"
      @pointerenter="setHoverAttr(chibiEl, 'h', '1', $event)"
      @pointerleave="setHoverAttr(chibiEl, 'h', '0', $event)"
    >
      <button
        type="button"
        tabindex="-1"
        aria-hidden="true"
        class="btt-chibi-btn"
        @click="throwChibi"
      >
        <div class="btt-chibi-anim">
          <img
            src="/images/chibi-confuse.webp"
            alt=""
            width="492"
            height="430"
            loading="lazy"
            draggable="false"
            class="btt-img btt-img-confuse"
          >
          <img
            src="/images/chibi-angry.webp"
            alt=""
            width="492"
            height="430"
            loading="lazy"
            draggable="false"
            class="btt-img btt-img-angry"
          >
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Reference wrapper: group/btt mx-auto w-fit flex flex-col items-center
   pt-12. overflow hidden stands in for the reference's footer background
   that hides the chibi below the frame edge while it waits to rise. */
.btt-group {
  display: flex;
  width: fit-content;
  margin: 0 auto;
  padding-top: 3rem;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}

/* Reference: c-link rounded-3xl + focus-visible accent outline 2px/4px. */
.btt-bubble-btn {
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 1.5rem;
  cursor: pointer;
}

.btt-bubble-btn:focus-visible {
  outline: 2px solid var(--loli-pink);
  outline-offset: 4px;
}

/* Reference: w-[240px] sm:w-[300px] overflow-visible origin-[43%_97%]
   transition scale 250ms ease-overshoot, hover scale-105. */
.btt-svg {
  display: block;
  width: 240px;
  overflow: visible;
  transform-origin: 43% 97%;
  transition: scale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@media (min-width: 640px) {
  .btt-svg {
    width: 300px;
  }
}

.btt-group[data-bh='1'] .btt-svg {
  scale: 1.05;
}

/* Reference: fill secondary-crust -> surface-0 on hover, 200ms. */
.btt-bubble {
  fill: var(--loli-crust);
  transition: fill 0.2s cubic-bezier(0, 0, 0.2, 1);
}

.btt-group[data-bh='1'] .btt-bubble {
  fill: var(--loli-surface);
}

.btt-letters {
  fill: var(--text-color);
}

/* Reference: w-[200px] sm:w-[240px] -mb-4 sm:-mb-6 mt-3 select-none. */
.btt-chibi {
  width: 200px;
  margin-top: 0.75rem;
  margin-bottom: -1rem;
  user-select: none;
}

@media (min-width: 640px) {
  .btt-chibi {
    width: 240px;
    margin-bottom: -1.5rem;
  }
}

.btt-chibi-btn {
  display: block;
  width: 100%;
  padding: 0;
  background: transparent;
  border: 0;
  outline: none;
  cursor: pointer;
}

/* Reference: pointer-events-none relative origin-bottom, transition
   rotate 250ms ease-overshoot, hover rotate-6. */
.btt-chibi-anim {
  position: relative;
  pointer-events: none;
  transform-origin: bottom;
  transition: rotate 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.btt-group[data-bh='1'] .btt-chibi-anim {
  rotate: 6deg;
}

.btt-img {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
  user-select: none;
}

.btt-img-angry {
  position: absolute;
  inset: 0;
  visibility: hidden;
}

/* Reference keyframes, verbatim: pop from 1.08, settle from 1.08, and
   the 3px shake. Only applied while motion is allowed (motion-safe). */
@media (prefers-reduced-motion: no-preference) {
  .btt-chibi[data-h='1'] .btt-chibi-anim {
    animation: chibi-pop 0.25s cubic-bezier(0, 0.55, 0.45, 1), chibi-shake 0.12s linear infinite;
  }

  .btt-chibi[data-h='0'] .btt-chibi-anim {
    animation: chibi-pop-out 0.25s cubic-bezier(0, 0.55, 0.45, 1);
  }
}

.btt-chibi[data-h='1'] .btt-img-confuse {
  visibility: hidden;
}

.btt-chibi[data-h='1'] .btt-img-angry {
  visibility: visible;
}

@keyframes chibi-pop {
  0% {
    scale: 1.08;
  }
}

@keyframes chibi-pop-out {
  0% {
    scale: 1.08;
  }
}

@keyframes chibi-shake {
  0%,
  100% {
    translate: 0;
  }

  25% {
    translate: -3px;
  }

  75% {
    translate: 3px;
  }
}
</style>
