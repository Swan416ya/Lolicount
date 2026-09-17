<script lang="ts">
// Live2DPreview: inline preview of a Cubism (Live2D) counter, used by the
// theme gallery / playground when a `kind:"live2d"` theme is selected.
//
// It reuses the self-contained player page (`/live2d-player.html`) inside an
// <iframe> rather than re-implementing the Pixi/Live2D engine inline: that page
// already loads the four vendor runtimes in order, auto-detects Cubism 2/3 from
// the manifest, does the two-pass contain-fit, disables eye-tracking, plays an
// idle motion and cycles motions on click, and renders the visit count overlay.
// An iframe keeps this component to a thin URL builder and sidesteps the
// "never destroy a running Pixi/Live2D renderer" pitfall (see EmotePreview's
// singleton note) — each model selection just swaps the iframe src, and the
// browser tears down the old document cleanly when the src changes.
</script>

<script setup lang="ts">
const props = defineProps<{
  model: string
  name: string
  text: string
}>()

const { t } = useI18n()
const config = useRuntimeConfig()
const apiBase = ((config.public.apiBase as string) || '').replace(/\/+$/, '')

// Preview frame: same portrait ratio as the player's 720x900 canvas, scaled to
// fit the 360px-wide preview rail. The player page center-fits the character,
// so the exact aspect just needs to be portrait.
const CSS_W = 360
const CSS_H = 450

const src = computed(() => {
  if (!props.model) return ''
  const q = new URLSearchParams()
  q.set('model', props.model)
  q.set('name', props.name.trim() || 'demo')
  if (props.text) q.set('text', props.text)
  // Cache-buster: bump this whenever the bundled live2d models change, so a
  // browser that cached an older costume's model.json (same fixed filename)
  // can't keep showing the stale outfit. The player appends it to the manifest
  // URL; the per-costume moc/texture filenames differ, so a fresh manifest
  // cascades to fresh sub-resources.
  q.set('v', 'sch1')
  return `${apiBase}/live2d-player.html?${q.toString()}`
})
</script>

<template>
  <div class="flex flex-col items-center">
    <div class="flex justify-center">
      <iframe
        v-if="src"
        :src="src"
        :width="CSS_W"
        :height="CSS_H"
        :title="model"
        class="border-0 bg-transparent"
        style="max-width: 100%"
        loading="lazy"
        allow="autoplay"
        referrerpolicy="no-referrer-when-downgrade"
      />
    </div>
    <p class="text-xs text-gray-400 mt-2">
      {{ t('emote.hintClick') }}
    </p>
  </div>
</template>
