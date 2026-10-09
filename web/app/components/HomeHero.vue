<script setup lang="ts">
import gsap from 'gsap'

const { t } = useI18n()
const heroRoot = ref<HTMLElement | null>(null)
const avatarEl = ref<HTMLElement | null>(null)
const titleLetters = [...'Lolicount']
const subtitleLetters = [...'Cute themeable SVG visitor counter']

let dragStart = { x: 0, y: 0 }
let dragging = false

const onPointerDown = (event: PointerEvent) => {
  if (!avatarEl.value) return
  dragging = true
  dragStart = { x: event.clientX, y: event.clientY }
  avatarEl.value.setPointerCapture(event.pointerId)
  gsap.killTweensOf(avatarEl.value)
}

const onPointerMove = (event: PointerEvent) => {
  if (!dragging || !avatarEl.value) return
  const dx = event.clientX - dragStart.x
  const dy = event.clientY - dragStart.y
  gsap.set(avatarEl.value, { x: dx, y: dy, rotate: dx * 0.04 })
}

const onPointerUp = (event: PointerEvent) => {
  if (!dragging || !avatarEl.value) return
  dragging = false
  avatarEl.value.releasePointerCapture(event.pointerId)
  gsap.to(avatarEl.value, {
    x: 0,
    y: 0,
    rotate: 0,
    duration: 0.9,
    ease: 'elastic.out(1, 0.35)',
  })
}

onMounted(() => {
  if (!heroRoot.value) return
  const q = gsap.utils.selector(heroRoot.value)
  gsap.set(q('.hero-letter'), { opacity: 0, y: 24 })
  gsap.set(q('.subtitle-letter'), { opacity: 0, y: 12 })
  gsap.set(q('.hero-avatar'), { opacity: 0, scale: 0.9 })

  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .to(q('.hero-avatar'), { opacity: 1, scale: 1, duration: 0.8 }, 0)
    .to(q('.hero-letter'), { opacity: 1, y: 0, duration: 0.55, stagger: 0.035 }, 0.12)
    .to(q('.subtitle-letter'), { opacity: 1, y: 0, duration: 0.4, stagger: 0.012 }, 0.38)
})
</script>

<template>
  <section ref="heroRoot" class="home-hero">
    <div class="hero-inner">
      <div class="hero-avatar-wrap">
        <div
          ref="avatarEl"
          class="hero-avatar"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <img src="/images/lolicount-icon.png" alt="Lolicount" draggable="false" />
        </div>
      </div>

      <div class="hero-copy">
        <h1 class="hero-title droog">
          <span
            v-for="(letter, index) in titleLetters"
            :key="`${letter}-${index}`"
            class="hero-letter"
            :class="`hero-letter-${index % 4}`"
          >{{ letter }}</span>
        </h1>

        <p class="hero-subtitle droog">
          <span
            v-for="(letter, index) in subtitleLetters"
            :key="`${letter}-${index}`"
            class="subtitle-letter"
          >{{ letter }}</span>
        </p>

        <p class="hero-description">{{ t('themesGallery.desc') }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-hero {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 64px - 1.5rem);
  padding: 4rem 1.5rem;
  overflow: hidden;
}

.hero-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  width: min(100%, 72rem);
  margin: 0 auto;
}

.hero-avatar-wrap {
  position: relative;
  width: 320px;
  height: 320px;
  flex: 0 0 auto;
}

.hero-avatar {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
  user-select: none;
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
  text-align: center;
  min-width: 0;
}

.hero-title {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.02em;
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
}

.hero-letter {
  display: inline-block;
  min-width: 0.18em;
}

.hero-letter-0 { color: var(--text-color); }
.hero-letter-1 { color: var(--loli-pink); }
.hero-letter-2 { color: var(--text-muted); }
.hero-letter-3 { color: var(--accent); }

.hero-subtitle {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.02em;
  margin-top: 1rem;
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-muted);
}

.subtitle-letter {
  display: inline-block;
  min-width: 0.16em;
}

.hero-description {
  max-width: 38rem;
  margin-top: 1.25rem;
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--text-muted);
}

@media (min-width: 1024px) {
  .hero-title {
    font-size: 4rem;
  }

  .hero-subtitle {
    font-size: 1.5rem;
  }

  .hero-inner {
    flex-direction: row;
    justify-content: space-between;
    gap: 6rem;
    padding-inline: 3rem;
  }

  .hero-copy {
    align-items: flex-start;
    text-align: left;
  }

  .hero-title,
  .hero-subtitle {
    justify-content: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-avatar {
    cursor: default;
  }
}
</style>
