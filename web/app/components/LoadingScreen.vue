<script setup lang="ts">
import gsap from 'gsap'

// Full-viewport loading overlay ported from the reference site: a two-ring
// SVG spinner (0.5s per revolution) on the page background, faded out
// (0.2s, power2.out) shortly after first paint, then removed. The
// reference keeps it until DOMContentLoaded; on this SSG page it stays for
// a short minimum so the entrance it gates is actually perceived.

const { t } = useI18n()
const { markReady } = usePageReady()
const rootEl = ref<HTMLElement | null>(null)
const visible = ref(true)

const reducedMotion = (): boolean =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const dismiss = () => {
  const el = rootEl.value
  if (!el) {
    visible.value = false
    markReady()
    return
  }
  el.setAttribute('aria-busy', 'false')
  el.setAttribute('aria-hidden', 'true')
  gsap.to(el, {
    opacity: 0,
    duration: reducedMotion() ? 0 : 0.2,
    ease: 'power2.out',
    onComplete: () => {
      visible.value = false
      markReady()
    },
  })
}

onMounted(() => {
  setTimeout(dismiss, reducedMotion() ? 0 : 300)
})

onBeforeUnmount(() => {
  if (visible.value) markReady()
})
</script>

<template>
  <div v-if="visible" ref="rootEl" class="loading-screen" aria-live="polite" aria-busy="true">
    <svg
      class="loading-spinner" aria-hidden="true"
      width="64" height="64" viewBox="0 0 50 50"
    >
      <circle cx="25" cy="25" r="20" fill="none" stroke-width="6" />
      <circle
        cx="25" cy="25" r="20" fill="none" stroke-width="6"
        stroke-linecap="round" stroke-dasharray="31.4 94.2"
        transform="rotate(-90 25 25)"
      />
    </svg>
    <span class="loading-sr-only">{{ t('loli.loading') }}</span>
  </div>
</template>

<style scoped>
.loading-screen {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--loli-crust);
}

.loading-spinner {
  animation: loading-spin 0.5s linear infinite;
}

.loading-spinner circle {
  stroke: var(--loli-border, #9ca0b0);
}

.loading-spinner circle + circle {
  stroke: var(--text-color, #4c4f69);
}

@keyframes loading-spin {
  to { transform: rotate(360deg); }
}

.loading-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
  }
}
</style>
