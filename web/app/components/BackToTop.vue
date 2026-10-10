<script setup lang="ts">
// Back-to-top ported from the reference site's about page: an in-flow
// chibi at the bottom of the content with a "top!" speech bubble that
// pops in once it scrolls into view. Hovering squashes the chibi up 5%
// with the reference's overshoot curve; clicking scrolls smoothly to
// the top.
const { t } = useI18n()
const rootEl = ref<HTMLElement | null>(null)
const bubbling = ref(false)

const scrollToTop = (): void => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  const el = rootEl.value
  if (!el) return
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      bubbling.value = true
      io.disconnect()
    }
  }, { threshold: 0.5 })
  io.observe(el)
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
      <span class="btt-bubble" :class="{ 'btt-bubble-pop': bubbling }" aria-hidden="true">top!</span>
      <img src="/images/up.webp" alt="" class="btt-chibi" draggable="false">
    </button>
  </div>
</template>

<style scoped>
.back-to-top-wrap {
  display: flex;
  justify-content: center;
  padding: 2.5rem 0 1rem;
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
   of its tail once the chibi enters the viewport. */
.btt-bubble {
  position: absolute;
  left: 50%;
  top: -0.5rem;
  translate: -50% -100%;
  padding: 0.3rem 0.875rem;
  font-family: 'droog', sans-serif;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--text-color);
  background: var(--loli-surface);
  border: 2px solid var(--text-color);
  border-radius: 1rem;
  scale: 0;
  transition: scale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.btt-bubble-pop {
  scale: 1;
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
  .btt-chibi,
  .btt-bubble {
    transition: none;
  }

  .back-to-top:hover .btt-chibi {
    scale: 1;
  }
}
</style>
