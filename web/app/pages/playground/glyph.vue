<script setup lang="ts">
// Secret glyph playground, reached only through the home hero's ten-tap
// easter egg (or by typing the URL): the wordmark letters land as a
// physics simulation where letters can be typed, dragged, bounced and
// exploded. When arriving from the easter egg the title's spans are
// handed off pinned at their on-screen spot (useGlyphHandoff) and physics
// starts immediately; otherwise the word plays its drop entrance first.
import gsap from 'gsap'
import GlyphPhysicsHint from '~/components/GlyphPhysicsHint.vue'
import { GLYPH_WORD_CLASS, consumeGlyphHandoff, hasGlyphHandoff, resetGlyphHandoff, sanitizeGlyphText } from '~/composables/useGlyphHandoff'
import { useGlyphPhysics } from '~/composables/useGlyphPhysics'
import { useIsTouch } from '~/composables/useIsTouch'
import { useLetterTokens, letterColorCss, letterColorTokens } from '~/composables/useLetterTokens'
import { useI18n } from '~/composables/useI18n'
import { pickFxTable } from '~/data/fx-tables'

const { t } = useI18n()
useEases()
const isTouch = useIsTouch()

const word = ref('Lolicount')
const fromHandoff = ref(false)
const physicsActive = ref(false)
const containerEl = ref<HTMLElement | null>(null)

const letters = computed(() => [...word.value])
const colors = computed(() => letterColorTokens(word.value.length))

// Ref callback (runs at patch time, before paint): consume a pending
// easter-egg handoff into the wordmark container, keeping the spans pinned
// at their on-screen spot.
const onContainer = (el: unknown): void => {
  const node = el as HTMLElement | null
  containerEl.value = node
  if (node && hasGlyphHandoff()) {
    fromHandoff.value = true
    consumeGlyphHandoff(node)
    physicsActive.value = true
  }
}

// Drop entrance for direct visits: the reference's squash & stretch, one
// mini timeline per letter, then physics takes over.
const playEntrance = (): void => {
  const root = containerEl.value
  if (!root) return
  const spans = Array.from(root.children) as HTMLElement[]
  const fx = pickFxTable()
  gsap.set(spans, { opacity: 0, y: 0, scaleX: 1, scaleY: 1, transformOrigin: 'center bottom' })
  const tl = gsap.timeline({ onComplete: () => (physicsActive.value = true) })
  tl.addLabel('drop', 0.3)
  spans.forEach((span, i) => {
    const mini = gsap.timeline()
    mini.set(span, { opacity: 1 })
    mini.to(span, { scaleY: fx.dropName.compressY, scaleX: fx.dropName.compressX, duration: 0.1, ease: 'power2.in' })
    mini.to(span, { y: fx.dropName.launchY, scaleY: fx.dropName.stretchY, scaleX: fx.dropName.stretchX, duration: 0.3, ease: 'power4.out' })
    mini.to(span, { y: 0, scaleY: fx.dropName.squashY, scaleX: fx.dropName.squashX, duration: 0.25, ease: 'power4.in' })
    mini.to(span, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' })
    tl.add(mini, `drop+=${i * 0.05}`)
  })
}

onMounted(() => {
  // The navigation state carries the word from the easter egg; fall back
  // to the site word for direct visits.
  const raw = (window.history.state as { glyphText?: unknown } | null)?.glyphText
  const text = sanitizeGlyphText(raw)
  if (text) word.value = text
  if (!fromHandoff.value) playEntrance()
  resetGlyphHandoff()
})

useGlyphPhysics(containerEl, physicsActive, resetGlyphHandoff)
</script>

<template>
  <div class="glyph-page">
    <GlyphPhysicsHint :active="physicsActive" :is-touch="isTouch" />
    <div
      :ref="onContainer"
      data-no-cursor-firework
      class="glyph-word"
      :class="GLYPH_WORD_CLASS"
    >
      <span
        v-for="(ch, i) in letters"
        v-show="!fromHandoff"
        :key="i"
        class="glyph-letter"
        :style="{ color: letterColorCss(colors[i] ?? 0), lineHeight: 1 }"
      >{{ ch }}</span>
    </div>
  </div>
</template>

<style scoped>
.glyph-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 2 * var(--frame-gutter) - 64px);
  padding: 4rem 1.5rem;
}

.glyph-word {
  line-height: 1;
  white-space: nowrap;
  user-select: none;
  font-size: 1.875rem;
}

@media (min-width: 640px) {
  .glyph-word {
    font-size: 3rem;
  }
}

@media (min-width: 1280px) {
  .glyph-word {
    font-size: 3.75rem;
  }
}

.glyph-letter {
  display: inline-block;
}
</style>
