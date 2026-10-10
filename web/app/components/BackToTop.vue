<script setup lang="ts">
import gsap from 'gsap'

// Back-to-top ported from the reference site's about page: a big chibi
// parked in-flow at the bottom of the content. Its assembly timeline is
// ported exactly: the chibi rises from below (yPercent 100, power3.out)
// while swinging back from -16deg (back.out(3)), the "top!" bubble
// scales out of its tail (back.out(2.5)) and the letters pop in one by
// one (back.out(1.4), 0.04s stagger). Hovering squashes the chibi up 5%
// with the reference's overshoot curve; clicking scrolls smoothly to
// the top.
const { t } = useI18n()
const rootEl = ref<HTMLElement | null>(null)
const bubbleEl = ref<HTMLElement | null>(null)
const letters = ref<HTMLElement[]>([])
const played = ref(false)

const scrollToTop = (): void => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const playAssembly = (): void => {
  const root = rootEl.value
  const bubble = bubbleEl.value
  if (!root || !bubble || played.value) return
  played.value = true
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set(bubble, { scale: 1 })
    return
  }
  gsap.set(root, { transformOrigin: '50% 100%' })
  const tl = gsap.timeline()
  tl.fromTo(root, { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: 'power3.out' }, 0.2)
  tl.fromTo(root, { rotation: -16 }, { rotation: 0, duration: 0.6, ease: 'back.out(3)' }, 0.2)
  tl.fromTo(bubble, { scale: 0 }, { scale: 1, duration: 0.45, ease: 'back.out(2.5)' }, 0.55)
  tl.fromTo(
    letters.value,
    { scale: 0.5, autoAlpha: 0, y: 6 },
    { scale: 1, autoAlpha: 1, y: 0, duration: 0.35, ease: 'back.out(1.4)', stagger: 0.04 },
    '-=0.2',
  )
}

onMounted(() => {
  const root = rootEl.value
  if (!root) return
  letters.value = Array.from(root.querySelectorAll<HTMLElement>('.btt-letter'))
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      playAssembly()
      io.disconnect()
    }
  }, { threshold: 0.35 })
  io.observe(root)
})
</script>

<template>
  <div class="back-to-top-wrap">
    <button
      ref="rootEl"
      type="button"
      class="back-to-top"
      :aria-label="t('nav.top')"
      @click="scrollToTop"
    >
      <span ref="bubbleEl" class="btt-bubble" aria-hidden="true">
        <span
          v-for="(letter, i) in ['t', 'o', 'p', '!']"
          :key="`btt-${i}`"
          class="btt-letter"
        >{{ letter }}</span>
      </span>
      <img src="/images/up.webp" alt="" class="btt-chibi" draggable="false">
    </button>
  </div>
</template>

<style scoped>
.back-to-top-wrap {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  /* Room for the button plus the popped bubble; overflow clips the
     chibi's rise-in from below like the reference's frame edge. */
  height: calc(min(240px, 62vw) + 3.75rem);
  overflow: hidden;
}

.back-to-top {
  position: relative;
  overflow: visible;
  width: min(240px, 62vw);
  aspect-ratio: 1 / 1;
  background: transparent;
  border: 0;
  border-radius: 1.5rem;
  cursor: pointer;
}

.back-to-top:focus-visible {
  outline: 2px solid var(--loli-pink);
  outline-offset: 4px;
}

.btt-chibi {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: scale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.back-to-top:hover .btt-chibi {
  scale: 1.05;
}

/* "top!" speech bubble, like the reference's SVG bubble: it scales out
   of its tail once the chibi enters the viewport, letters staggered. */
.btt-bubble {
  position: absolute;
  left: 50%;
  bottom: calc(100% - 0.5rem);
  translate: -50% -100%;
  display: flex;
  padding: 0.3rem 0.875rem;
  font-family: 'droog', sans-serif;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--text-color);
  background: var(--loli-surface);
  border: 2px solid var(--text-color);
  border-radius: 1rem;
  transform: scale(0);
}

.btt-letter {
  display: inline-block;
}

.btt-bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -0.42rem;
  width: 0.7rem;
  height: 0.7rem;
  background: var(--loli-surface);
  border-right: 2px solid var(--text-color);
  border-bottom: 2px solid var(--text-color);
  rotate: 45deg;
}

@media (prefers-reduced-motion: reduce) {
  .btt-chibi {
    transition: none;
  }

  .back-to-top:hover .btt-chibi {
    scale: 1;
  }
}
</style>
