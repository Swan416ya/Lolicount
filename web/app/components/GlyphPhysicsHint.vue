<script setup lang="ts">
// Physics playground onboarding, ported from the reference: on desktop it
// walks through three hints (type a letter, Space+Shift to push, drag to
// throw) and only advances when the visitor actually performs the action;
// on touch it offers an on-screen letter input instead, and on iOS it asks
// for DeviceMotion permission first. The whole sequence is skipped once the
// visitor has completed it (localStorage), like the reference.
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  active: boolean
  isTouch: boolean
}>()

const { t } = useI18n()

const DONE_KEY = 'physics-hint-done'
const DELAY_MS = 1500
const FADE_MS = 700

const step = ref(-1)
const hintOpacity = ref(0)
const inputVisible = ref(false)
const inputHintOpacity = ref(0)
const dialogOpen = ref(false)
const dialogOpacity = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

let done = false
let spaceDown = false
let shiftDown = false
let timers: ReturnType<typeof setTimeout>[] = []

const later = (fn: () => void, ms: number): void => {
  timers.push(setTimeout(fn, ms))
}
const clearTimers = (): void => {
  timers.forEach(clearTimeout)
  timers = []
}
const fadeOut = (setOpacity: (v: number) => void, setVisible: (v: boolean) => void): void => {
  setOpacity(0)
  later(() => setVisible(false), FADE_MS)
}

// Advance to the next hint step after the current one fades out; step 3
// marks the sequence done.
const advance = (next: number): void => {
  if (done) return
  hintOpacity.value = 0
  later(() => {
    if (next > 2) {
      localStorage.setItem(DONE_KEY, '1')
      done = true
    }
    step.value = next
    if (next <= 2) {
      requestAnimationFrame(() => requestAnimationFrame(() => (hintOpacity.value = 1)))
    }
  }, FADE_MS)
}

const onKeydown = (e: KeyboardEvent): void => {
  if (!props.active || done) return
  if (props.isTouch) return
  if (e.key === ' ') spaceDown = true
  if (e.key === 'Shift') shiftDown = true
  if (step.value === 0 && /^[a-zA-Z]$/.test(e.key)) advance(1)
  else if (step.value === 1 && spaceDown && shiftDown) advance(2)
}

const onPointerdown = (): void => {
  if (!props.active || props.isTouch || done) return
  if (step.value === 2) advance(3)
}

// Touch input fields feed each typed letter into the physics hook as a
// synthesized keydown, then clear themselves.
const onTextInput = (e: Event): void => {
  const data = (e as InputEvent).data
  if (data) for (const ch of data) document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }))
  ;(e.currentTarget as HTMLInputElement).value = ''
}

const needsIosPermission = (): boolean =>
  typeof DeviceMotionEvent !== 'undefined' &&
  typeof (DeviceMotionEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function'

const allowMotion = async (): Promise<void> => {
  fadeOut((v) => (dialogOpacity.value = v), (v) => (dialogOpen.value = v))
  try {
    const result = await (
      DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }
    ).requestPermission()
    if (result === 'granted') document.dispatchEvent(new Event('devicemotion-granted'))
  } catch {
    // Permission denied or unavailable: the page works without tilt gravity.
  }
}

const denyMotion = (): void => {
  fadeOut((v) => (dialogOpacity.value = v), (v) => (dialogOpen.value = v))
}

if (import.meta.client) {
  done = localStorage.getItem(DONE_KEY) === '1'
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerdown)
  if (props.active && !done) {
    if (props.isTouch && needsIosPermission()) {
      later(() => {
        dialogOpen.value = true
        requestAnimationFrame(() => requestAnimationFrame(() => (dialogOpacity.value = 1)))
      }, DELAY_MS)
    } else if (props.isTouch) {
      later(() => {
        inputVisible.value = true
        requestAnimationFrame(() => requestAnimationFrame(() => (inputHintOpacity.value = 1)))
      }, DELAY_MS)
    } else {
      later(() => {
        step.value = 0
        requestAnimationFrame(() => requestAnimationFrame(() => (hintOpacity.value = 1)))
      }, DELAY_MS)
    }
  }
}

onBeforeUnmount(() => {
  clearTimers()
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerdown)
})

const hints = () => [t('glyph.hint.spawn'), t('glyph.hint.push'), t('glyph.hint.drag')]
</script>

<template>
  <div v-if="active && isTouch" class="glyph-touch-hint" style="pointer-events: none">
    <div
      v-if="dialogOpen"
      class="glyph-motion-dialog"
      role="alertdialog"
      :style="{ opacity: dialogOpacity }"
    >
      <p>{{ t('glyph.motion.text') }}</p>
      <div class="glyph-motion-actions">
        <button type="button" class="glyph-motion-allow" @click="allowMotion()">
          {{ t('glyph.motion.allow') }}
        </button>
        <button type="button" class="glyph-motion-deny" @click="denyMotion()">
          {{ t('glyph.motion.deny') }}
        </button>
      </div>
    </div>
    <template v-else-if="inputVisible">
      <input
        ref="inputEl"
        data-physics-input
        type="text"
        inputmode="text"
        pattern="[a-zA-Z]*"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        lang="en"
        :placeholder="t('glyph.hint.inputPlaceholder')"
        @input="onTextInput"
      />
      <p class="glyph-touch-hint-text" :style="{ opacity: inputHintOpacity * 0.3 }">
        {{ t('glyph.hint.drag') }}
      </p>
    </template>
  </div>

  <p
    v-else-if="active && step >= 0 && step <= 2"
    class="glyph-desktop-hint"
    :style="{ opacity: hintOpacity * 0.15 }"
  >
    {{ hints()[step] }}
  </p>
</template>

<style scoped>
.glyph-touch-hint {
  position: fixed;
  inset: 0;
  z-index: 35;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.glyph-touch-hint input {
  pointer-events: auto;
  width: 16rem;
  padding: 0.75rem 1rem;
  text-align: center;
  font-size: 1.125rem;
  font-family: inherit;
  color: var(--text-color);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  outline: none;
  caret-color: transparent;
}

.glyph-touch-hint input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.glyph-touch-hint-text {
  font-size: 0.875rem;
  color: var(--text-muted);
  transition: opacity 700ms;
}

.glyph-motion-dialog {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: min(20rem, calc(100vw - 3rem));
  padding: 1.25rem 1.5rem;
  text-align: center;
  color: var(--text-color);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  box-shadow: 0 12px 32px rgba(28, 29, 38, 0.12);
  transition: opacity 700ms;
}

.glyph-motion-actions {
  display: flex;
  gap: 0.75rem;
}

.glyph-motion-allow,
.glyph-motion-deny {
  padding: 0.375rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
}

.glyph-motion-allow {
  color: #fff;
  background: var(--accent-strong);
  border: 1px solid var(--accent-strong);
}

.glyph-motion-deny {
  color: var(--text-color);
  background: var(--bg-btn);
  border: 1px solid var(--border-color);
}

.glyph-desktop-hint {
  position: fixed;
  inset: 0;
  z-index: 35;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  pointer-events: none;
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--text-color);
  transition: opacity 700ms;
}

@media (min-width: 640px) {
  .glyph-desktop-hint {
    font-size: 2.25rem;
  }
}

@media (min-width: 1280px) {
  .glyph-desktop-hint {
    font-size: 3.75rem;
  }
}
</style>
