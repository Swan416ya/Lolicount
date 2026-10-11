<script setup lang="ts">
import gsap from 'gsap'
import { letterColorCss, letterColorTokens } from '~/composables/useLetterTokens'

// Reference-style about hero: full-bleed cross pattern with scroll/pointer
// parallax, the letter-coloured wordmark that drops in once the loading
// screen clears, an interactive BPM metronome that slides up over it and
// the big avatar that pulses on every beat.
useEases()

const { t } = useI18n()
const { ready } = usePageReady()

const titleLetters = [...'Lolicount']
const titleColorTokens = letterColorTokens(titleLetters.length)
const letterColor = (index: number): string => letterColorCss(titleColorTokens[index] ?? 0)

const heroParallaxEl = ref<HTMLElement | null>(null)
const titleStackEl = ref<HTMLElement | null>(null)
const eyebrowEl = ref<HTMLElement | null>(null)
const lettersEl = ref<HTMLElement | null>(null)
const periodEl = ref<HTMLElement | null>(null)
const overlayEl = ref<HTMLElement | null>(null)
const avatarRevealEl = ref<HTMLElement | null>(null)
const avatarInnerEl = ref<HTMLElement | null>(null)

const metronome = useMetronome({ pulseTarget: () => avatarInnerEl.value })

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const showHero = (): void => {
  const eyebrow = eyebrowEl.value
  const letters = lettersEl.value
  const period = periodEl.value
  const avatar = avatarRevealEl.value
  if (!eyebrow || !letters || !period || !avatar) return
  if (prefersReducedMotion()) {
    gsap.set([eyebrow, letters, period], { opacity: 1, y: 0 })
    gsap.set(avatar, { opacity: 1, y: 24, scale: 1 })
    return
  }
  gsap.fromTo(eyebrow, { opacity: 0, y: -50 }, { opacity: 1, y: 0, delay: 0.35, duration: 1, ease: 'cardReveal' })
  gsap.fromTo(letters, { opacity: 0, y: -50 }, { opacity: 1, y: 0, delay: 0.25, duration: 1, ease: 'cardReveal' })
  gsap.fromTo(period, { opacity: 0, y: -50 }, { opacity: 1, y: 0, delay: 0.25, duration: 1, ease: 'cardReveal' })
  gsap.fromTo(avatar, { opacity: 0, y: 128, scale: 0.95 }, { opacity: 1, y: 24, scale: 1, delay: 0.75, duration: 0.4, ease: 'overshoot' })
}

// The BPM overlay slides up over the wordmark while the wordmark leaves.
watch(() => metronome.open.value, (open) => {
  const stack = titleStackEl.value
  const overlay = overlayEl.value
  if (!stack || !overlay) return
  if (prefersReducedMotion()) {
    gsap.set(stack, { opacity: open ? 0 : 1, y: open ? -256 : 0 })
    gsap.set(overlay, { opacity: open ? 1 : 0, y: open ? 0 : 256 })
    return
  }
  const timing = { duration: 1, ease: 'cardReveal', overwrite: 'auto' as const }
  gsap.to(stack, { opacity: open ? 0 : 1, y: open ? -256 : 0, ...timing })
  gsap.to(overlay, { opacity: open ? 1 : 0, y: open ? 0 : 256, ...timing })
})

const rotateAvatar = (rotation: number, event: PointerEvent): void => {
  if (event.pointerType === 'touch' || prefersReducedMotion()) return
  gsap.to(avatarInnerEl.value, { rotation, duration: 0.25, ease: 'overshoot', overwrite: 'auto' })
}

// Pattern parallax: the tiled cross mask drifts with the scroll position and
// leans towards the pointer on desktop, mirroring the reference's
// ParallaxContainer (mouse reach 20px, scroll factor 0.5, 0.15s easing).
let parallaxRaf = 0
let parallaxTime = 0
const parallaxTarget = { x: 0, y: 0 }
const parallaxCurrent = { x: 0, y: 0 }
const scrollOffset = { value: 0 }

const runParallax = (time: number): void => {
  const el = heroParallaxEl.value
  if (!el) {
    parallaxRaf = 0
    return
  }
  const delta = parallaxTime ? Math.min((time - parallaxTime) / 1000, 0.1) : 1 / 60
  parallaxTime = time
  const ease = 1 - Math.exp(-delta / 0.15)
  parallaxCurrent.x += (parallaxTarget.x - parallaxCurrent.x) * ease
  parallaxCurrent.y += (parallaxTarget.y - parallaxCurrent.y) * ease
  el.style.transform = `translate(${parallaxCurrent.x}px, ${scrollOffset.value * 0.5 + parallaxCurrent.y}px)`
  const settled = Math.abs(parallaxTarget.x - parallaxCurrent.x) < 0.5
    && Math.abs(parallaxTarget.y - parallaxCurrent.y) < 0.5
  if (settled) {
    parallaxCurrent.x = parallaxTarget.x
    parallaxCurrent.y = parallaxTarget.y
    parallaxRaf = 0
    parallaxTime = 0
    return
  }
  parallaxRaf = requestAnimationFrame(runParallax)
}

const kickParallax = (): void => {
  if (!parallaxRaf) parallaxRaf = requestAnimationFrame(runParallax)
}

const onParallaxScroll = (): void => {
  scrollOffset.value = window.scrollY
  kickParallax()
}

const onParallaxMove = (event: MouseEvent): void => {
  const halfWidth = window.innerWidth / 2
  const halfHeight = window.innerHeight / 2
  parallaxTarget.x = ((event.clientX - halfWidth) / halfWidth) * 20
  parallaxTarget.y = ((event.clientY - halfHeight) / halfHeight) * 20
  kickParallax()
}

const onParallaxLeave = (): void => {
  parallaxTarget.x = 0
  parallaxTarget.y = 0
  kickParallax()
}

let parallaxDesktop = false

const teardownParallax = (): void => {
  if (!parallaxDesktop) return
  window.removeEventListener('scroll', onParallaxScroll)
  window.removeEventListener('mousemove', onParallaxMove)
  document.documentElement.removeEventListener('mouseleave', onParallaxLeave)
  window.removeEventListener('blur', onParallaxLeave)
  cancelAnimationFrame(parallaxRaf)
  parallaxRaf = 0
}

onMounted(() => {
  if (window.matchMedia('(min-width: 768px)').matches) {
    parallaxDesktop = true
    window.addEventListener('scroll', onParallaxScroll, { passive: true })
    window.addEventListener('mousemove', onParallaxMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onParallaxLeave)
    window.addEventListener('blur', onParallaxLeave)
    onParallaxScroll()
  }
  metronome.preload()
})

onBeforeUnmount(teardownParallax)

watch(ready, (value) => {
  if (value) showHero()
}, { immediate: true })
</script>

<template>
  <section class="about-hero">
    <div class="hero-parallax">
      <div ref="heroParallaxEl" class="hero-pattern" />
    </div>
    <div class="hero-fade" aria-hidden="true" />

    <div class="hero-row">
      <div class="hero-inner">
        <div class="hero-copy">
          <div class="hero-copy-inner">
            <div ref="titleStackEl" class="hero-title-stack" data-no-cursor-firework>
              <p ref="eyebrowEl" class="hero-eyebrow" data-nojs-reveal>{{ t('about.hiIm') }}</p>
              <div class="hero-title-row">
                <div ref="lettersEl" class="hero-letters" data-nojs-reveal>
                  <span
                    v-for="(letter, index) in titleLetters"
                    :key="`letter-${index}`"
                    class="hero-letter fade-color"
                    :style="{ color: letterColor(index) }"
                  >{{ letter }}</span>
                </div>
                <span ref="periodEl" class="hero-period" data-nojs-reveal>.</span>
              </div>
            </div>

            <div ref="overlayEl" class="hero-overlay" :class="{ 'is-open': metronome.open.value }">
              <p class="hero-overlay-eyebrow">{{ t('about.bpm') }}</p>
              <p class="hero-overlay-value">{{ metronome.bpm.value }}</p>
              <div class="hero-dots">
                <span
                  v-for="beat in 4"
                  :key="`beat-${beat}`"
                  class="hero-dot"
                  :class="{ 'is-active': metronome.activeBeat.value === beat - 1 }"
                />
              </div>
              <div class="hero-controls">
                <button
                  type="button"
                  class="hero-control"
                  :aria-pressed="metronome.keepBpm.value"
                  :aria-label="t('about.bpmLock')"
                  @click="metronome.toggleKeep()"
                >
                  <svg viewBox="0 0 256 256" width="16" height="16" aria-hidden="true">
                    <path fill="currentColor" d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="hero-control"
                  :aria-label="t('about.bpmUp')"
                  @pointerdown="metronome.pressBpm(1)"
                  @pointerup="metronome.releaseBpm()"
                  @pointerleave="metronome.releaseBpm()"
                >
                  <svg viewBox="0 0 256 256" width="16" height="16" aria-hidden="true">
                    <path fill="currentColor" d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="hero-control"
                  :aria-label="t('about.bpmTap')"
                  @click="metronome.tap()"
                >
                  <svg viewBox="0 0 256 256" width="16" height="16" aria-hidden="true">
                    <path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm0-136a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="hero-control"
                  :aria-label="t('about.bpmDown')"
                  @pointerdown="metronome.pressBpm(-1)"
                  @pointerup="metronome.releaseBpm()"
                  @pointerleave="metronome.releaseBpm()"
                >
                  <svg viewBox="0 0 256 256" width="16" height="16" aria-hidden="true">
                    <path fill="currentColor" d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="hero-control"
                  :aria-label="t('about.bpmPattern')"
                  @click="metronome.nextPattern()"
                >
                  <svg viewBox="0 0 256 256" width="16" height="16" aria-hidden="true">
                    <path fill="currentColor" d="M212.92,17.69a8,8,0,0,0-6.86-1.45l-128,32A8,8,0,0,0,72,56V166.86A36,36,0,1,0,88,196V94.09l112-28v60.77A36,36,0,1,0,216,156V24A8,8,0,0,0,212.92,17.69ZM52,208a20,20,0,1,1,20-20A20,20,0,0,1,52,208Zm128-64a20,20,0,1,1,20-20A20,20,0,0,1,180,144Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="hero-avatar-col">
          <div class="hero-avatar-box">
            <div ref="avatarRevealEl" class="hero-avatar-reveal" data-nojs-reveal>
              <div
                ref="avatarInnerEl"
                class="hero-avatar-inner"
                role="button"
                tabindex="0"
                :aria-label="t('about.bpmTap')"
                @pointerenter="rotateAvatar(-6, $event)"
                @pointerleave="rotateAvatar(0, $event)"
                @click="metronome.tap()"
                @keydown.enter.prevent="metronome.tap()"
                @keydown.space.prevent="metronome.tap()"
              >
                <img src="/images/avatar.webp" alt="Lolicount" width="840" height="840" draggable="false" loading="lazy" decoding="async">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.about-hero {
  position: relative;
  width: 100%;
  background: var(--loli-surface);
}

.hero-parallax {
  position: absolute;
  inset: -4rem 0 0;
  z-index: 0;
  overflow: hidden;
}

.hero-pattern {
  position: absolute;
  inset: -150px -40px;
  background-color: var(--loli-crust);
  -webkit-mask-image: url('/images/cross-pattern.svg');
  mask-image: url('/images/cross-pattern.svg');
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
  -webkit-mask-size: 120px 120px;
  mask-size: 120px 120px;
  -webkit-mask-position: center 30px;
  mask-position: center 30px;
  will-change: transform;
}

.hero-fade {
  position: absolute;
  inset: -4rem 0 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    var(--loli-surface) 0%,
    color-mix(in srgb, var(--loli-surface) 70%, transparent) 10%,
    color-mix(in srgb, var(--loli-surface) 38%, transparent) 18%,
    color-mix(in srgb, var(--loli-surface) 15%, transparent) 26%,
    color-mix(in srgb, var(--loli-surface) 4%, transparent) 34%,
    transparent 42%,
    transparent 58%,
    color-mix(in srgb, var(--loli-surface) 4%, transparent) 66%,
    color-mix(in srgb, var(--loli-surface) 15%, transparent) 74%,
    color-mix(in srgb, var(--loli-surface) 38%, transparent) 82%,
    color-mix(in srgb, var(--loli-surface) 70%, transparent) 90%,
    var(--loli-surface) 100%
  );
}

.hero-row {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: center;
}

.hero-inner {
  display: flex;
  width: 100%;
  height: 26.25rem;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  overflow: visible;
}

.hero-copy {
  display: flex;
  width: fit-content;
  height: fit-content;
  flex-grow: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 0;
}

.hero-copy-inner {
  position: relative;
  width: 100%;
  flex: 1 1 auto;
}

.hero-title-stack {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 100%;
  flex-direction: column;
  justify-content: flex-end;
  will-change: transform, opacity;
}

.hero-eyebrow {
  margin: 0;
  font-size: 1.125rem;
  color: var(--text-muted);
}

/* Pre-animation state, so the SSG markup never flashes the hero copy. */
.hero-eyebrow,
.hero-letters,
.hero-period {
  opacity: 0;
  transform: translateY(-50px);
}

.hero-title-row {
  display: flex;
  align-items: baseline;
  overflow: visible;
  font-weight: 900;
  font-size: 2.25rem;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
}

.hero-letters {
  overflow: visible;
  will-change: transform, opacity;
}

.hero-letter {
  display: inline-block;
}

.hero-period {
  will-change: transform, opacity;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: translateY(256px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
  pointer-events: none;
  will-change: transform, opacity;
}

.hero-overlay.is-open {
  pointer-events: auto;
}

.hero-overlay-eyebrow {
  width: 100%;
  margin: 0;
  font-size: 1.125rem;
  color: var(--text-muted);
  text-align: center;
}

.hero-overlay-value {
  width: 100%;
  margin: 0;
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text-color);
  text-align: center;
}

.hero-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.hero-dot {
  width: 0.75rem;
  height: 0.75rem;
  margin-top: 1rem;
  background: var(--loli-border);
  border-radius: 999px;
  scale: 0.5;
  transition: scale 0.2s ease, background-color 0.2s ease;
}

.hero-dot.is-active {
  scale: 1;
  background: var(--text-color);
}

.hero-controls {
  display: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  padding: 0 1rem;
}

.hero-control {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  color: var(--text-color);
  background: var(--loli-cream);
  border: 0;
  border-radius: 0.75rem;
  transition: background-color 0.3s ease;
}

.hero-control:hover {
  background: var(--loli-surface);
}

.hero-control[aria-pressed='true'] {
  background: var(--loli-pink);
  color: #fff;
}

.hero-avatar-col {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.hero-avatar-box {
  position: relative;
  aspect-ratio: 1 / 1;
  height: 100%;
  cursor: grab;
}

.hero-avatar-box:active {
  cursor: grabbing;
}

.hero-avatar-reveal,
.hero-avatar-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: center bottom;
}

.hero-avatar-reveal {
  opacity: 0;
  transform: translateY(128px) scale(0.95);
}

.hero-avatar-inner {
  outline: none;
}

.hero-avatar-inner img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  filter: drop-shadow(12px 12px 0 var(--loli-cream));
  transition: filter 0.3s ease;
}

.hero-avatar-inner:focus-visible {
  outline: 0.25rem solid var(--loli-pink);
  outline-offset: 0.25rem;
}

@media (min-width: 640px) {
  .hero-eyebrow,
  .hero-overlay-eyebrow {
    font-size: 1.5rem;
  }

  .hero-title-row,
  .hero-overlay-value {
    font-size: 3.75rem;
  }
}

@media (min-width: 1024px) {
  .hero-inner {
    width: 60rem;
    flex-direction: row;
  }

  .hero-copy {
    height: 100%;
    align-items: flex-start;
  }

  .hero-copy-inner {
    width: 24rem;
  }

  .hero-controls {
    display: flex;
  }

  .hero-avatar-col {
    width: fit-content;
    align-items: flex-start;
  }

  .hero-avatar-box {
    width: 26.25rem;
  }
}
</style>
