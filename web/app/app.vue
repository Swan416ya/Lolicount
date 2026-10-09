<script setup lang="ts">
const { init: initLocale } = useI18n()
const { init: initTheme } = useTheme()
useFireworkFx()
useRippleFx()
useReveal()

const progressEl = ref<HTMLElement | null>(null)
let ticking = false

// Top-of-frame scroll progress line, styled after the reference site
// (2px accent bar pinned to the frame's top edge, scaled on scroll).
const updateProgress = () => {
  ticking = false
  const max = document.documentElement.scrollHeight - window.innerHeight
  const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0
  if (progressEl.value) progressEl.value.style.transform = `scaleX(${ratio})`
}

const scheduleProgress = () => {
  if (ticking) return
  ticking = true
  requestAnimationFrame(updateProgress)
}

onMounted(() => {
  initLocale()
  initTheme()
  updateProgress()
  window.addEventListener('scroll', scheduleProgress, { passive: true })
  window.addEventListener('resize', scheduleProgress, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', scheduleProgress)
  window.removeEventListener('resize', scheduleProgress)
})
</script>

<template>
  <div class="app-frame">
    <LoadingScreen />
    <div ref="progressEl" class="scroll-progress" aria-hidden="true" />
    <NavBar />
    <NuxtPage />
    <noscript>
      <style>
        /* Without JS the entrance-hidden state must not persist. */
        .reveal,
        .hero-letter,
        .major-letter,
        .hero-avatar { opacity: 1 !important; transform: none !important; }
        .hero-subtitle { height: auto !important; overflow: visible !important; }
      </style>
    </noscript>
  </div>
</template>

<style scoped>
.app-frame {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 2 * var(--frame-gutter));
  margin: var(--frame-gutter);
  background: var(--loli-surface);
  border-radius: var(--frame-radius);
}

.scroll-progress {
  position: fixed;
  top: var(--frame-gutter);
  left: var(--frame-gutter);
  right: var(--frame-gutter);
  height: 2px;
  background: #1e66f5;
  border-radius: var(--frame-radius) var(--frame-radius) 0 0;
  transform: scaleX(0);
  transform-origin: left center;
  pointer-events: none;
  z-index: 120;
}
</style>

<style>
/* .reveal is applied to elements inside child components, so the hidden
state must be global (not scoped). useReveal removes the class when the
reveal plays. */
.reveal {
  opacity: 0;
  transform: translateY(50px);
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    transform: none;
  }
}
</style>
