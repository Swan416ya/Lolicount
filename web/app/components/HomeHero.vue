<script setup lang="ts">
import gsap from 'gsap'

// Chanfoo-style hero: the droog wordmark and tagline drop in from above with
// squash & stretch, and the avatar bounces down beside them. The timing
// constants mirror the reference site's desktop/mobile tables.
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

const titleLetters = [...TITLE]
const subtitleWords = SUBTITLE.split(' ')

const heroRoot = ref<HTMLElement | null>(null)
const avatarEl = ref<HTMLElement | null>(null)

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

const onAvatarPointerDown = (event: PointerEvent) => {
  if (!avatarEl.value || drag.pointerId !== -1) return
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
  gsap.to(avatarEl.value, { x: 0, y: 0, rotate: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' })
}

const setAvatarScale = (scale: number) => {
  if (avatarEl.value && entranceDone && drag.pointerId === -1) {
    gsap.to(avatarEl.value, { scale, duration: 0.3, ease: 'back.out(2)', overwrite: 'auto' })
  }
}

// Title-letter interactions replicate the reference site: hovering blips a
// short drum hit (50ms throttle), and clicking a letter spins it a full turn
// while the neighbouring letters spin outward, 50ms per ring (back.out).
const { playDrum } = useSoundFx()
let spinBusy = false
let lastHoverBlip = 0

const onLetterClick = (index: number) => {
  const root = heroRoot.value
  if (!root || spinBusy) return
  spinBusy = true
  const spans = Array.from(root.querySelectorAll<HTMLElement>('.hero-letter'))
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

const onLetterHover = () => {
  const now = performance.now()
  if (now - lastHoverBlip < 50) return
  lastHoverBlip = now
  playDrum()
}

onMounted(() => {
  const root = heroRoot.value
  const avatar = avatarEl.value
  if (!root || !avatar) return

  const fx = window.matchMedia('(min-width: 1024px)').matches ? FxTables.desktop : FxTables.mobile
  const nameSpans = Array.from(root.querySelectorAll<HTMLElement>('.hero-letter'))
  const majorSpans = Array.from(root.querySelectorAll<HTMLElement>('.major-letter'))
  const majorWords = Array.from(root.querySelectorAll<HTMLElement>('.major-word'))

  const master = gsap.timeline()
  master.set(nameSpans, { opacity: 0, y: 0, scaleX: 1, scaleY: 1, transformOrigin: 'center bottom' })
  master.set(avatar, { opacity: 0, y: fx.avatar.offsetY, transformOrigin: 'center bottom', pointerEvents: 'none' })
  master.set(majorSpans, { opacity: 0, y: fx.majors.offsetY, transformOrigin: 'center bottom' })

  master.addLabel('dropName', 0.3)
  nameSpans.forEach((span, index) => {
    const mini = gsap.timeline()
    mini.set(span, { opacity: 1 })
    mini.to(span, { scaleY: fx.dropName.compressY, scaleX: fx.dropName.compressX, duration: 0.1, ease: 'power2.in' })
    mini.to(span, { y: fx.dropName.launchY, scaleY: fx.dropName.stretchY, scaleX: fx.dropName.stretchX, duration: 0.3, ease: 'power4.out' })
    mini.to(span, { y: 0, scaleY: fx.dropName.squashY, scaleX: fx.dropName.squashX, duration: 0.25, ease: 'power4.in' })
    mini.to(span, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' })
    master.add(mini, `dropName+=${index * 0.05}`)
  })

  master.addLabel('avatarEntrance', '>')
  const avatarMini = gsap.timeline()
  avatarMini.to(avatar, { opacity: 1, scaleY: fx.avatar.compressY, scaleX: fx.avatar.compressX, duration: 0.08, ease: 'power2.in' })
  avatarMini.to(avatar, { y: fx.avatar.launchY, scaleY: 1, scaleX: 1, duration: 0.25, ease: 'power2.out' })
  avatarMini.to(avatar, { y: 0, scaleY: fx.avatar.squashY, scaleX: fx.avatar.squashX, duration: 0.25, ease: 'power3.in' })
  avatarMini.to(avatar, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
  master.add(avatarMini, 'avatarEntrance+=0.05')

  master.addLabel('slideMajors', '>-0.4')
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
      master.add(mini, `slideMajors+=${wordOffset + letterIndex * 0.05}`)
    })
    wordOffset += letters.length * 0.05
  })

  master.eventCallback('onComplete', () => {
    gsap.set([...nameSpans, ...majorSpans], { clearProps: 'transform' })
    gsap.set(avatar, { clearProps: 'transform' })
    avatar.style.pointerEvents = ''
    entranceDone = true
  })
})
</script>

<template>
  <section ref="heroRoot" class="home-hero">
    <div class="hero-inner">
      <div
        ref="avatarEl"
        class="hero-avatar"
        data-no-cursor-firework
        @pointerdown="onAvatarPointerDown"
        @pointermove="onAvatarPointerMove"
        @pointerup="onAvatarPointerUp"
        @pointercancel="onAvatarPointerUp"
        @pointerenter="setAvatarScale(1.08)"
        @pointerleave="setAvatarScale(1)"
      >
        <img src="/images/avatar.webp" alt="Lolicount" draggable="false" />
      </div>

      <div class="hero-copy">
        <h1 class="hero-title droog" data-no-cursor-firework>
          <span
            v-for="(letter, index) in titleLetters"
            :key="`title-${index}`"
            class="hero-letter"
            :style="{ color: letterColor(index) }"
            @click="onLetterClick(index)"
            @mouseenter="onLetterHover"
          >{{ letter }}</span>
        </h1>

        <p class="hero-subtitle droog">
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
  opacity: 0;
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
