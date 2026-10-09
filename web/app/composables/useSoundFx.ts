// Shared sound-effects state for the chanfoo-style UI: a short drum hit
// (drum9.wav) with a random playback rate, used by the hero title letters
// (hover blip + click ring). Mirrors the reference site, which ships the
// same asset and defaults to muted unless the visitor previously unmuted
// via the nav toggle (persisted in localStorage).

const STORAGE_KEY = 'lolicount-sound-muted'
const DRUM_URL = '/audios/drum9.wav'
const GAIN = 0.5
const MIN_RATE = 0.9
const RATE_SPREAD = 0.2

let ctx: AudioContext | null = null
let drumBuffer: AudioBuffer | null = null
let loading = false

// Lazily create the AudioContext and decode the drum sample once.
// Browsers require a user gesture before audio can play, so the context is
// created on first use and resumed if suspended.
const ensureContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// Fetch and decode the drum sample; a failed load silently disables sound.
const loadDrum = (): void => {
  if (drumBuffer || loading) return
  loading = true
  fetch(DRUM_URL)
    .then((res) => res.arrayBuffer())
    .then((bytes) => ensureContext()?.decodeAudioData(bytes))
    .then((buffer) => {
      drumBuffer = buffer
    })
    .catch(() => {})
    .finally(() => {
      loading = false
    })
}

const soundState = {
  muted: ref(true),
}

// Play one drum hit at a slightly randomized pitch, like the reference.
const playDrum = (): void => {
  if (soundState.muted.value) return
  const audioCtx = ensureContext()
  if (!audioCtx) return
  if (!drumBuffer) loadDrum()
  if (!drumBuffer) return
  const source = audioCtx.createBufferSource()
  source.buffer = drumBuffer
  source.playbackRate.value = MIN_RATE + Math.random() * RATE_SPREAD
  const gain = audioCtx.createGain()
  gain.gain.value = GAIN
  source.connect(gain).connect(audioCtx.destination)
  source.start()
}

const toggleMute = (): void => {
  soundState.muted.value = !soundState.muted.value
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(soundState.muted.value))
  }
}

// Muted by default, exactly like the reference site; only an explicit
// previous toggle in localStorage unmutes.
if (import.meta.client && localStorage.getItem(STORAGE_KEY) === 'false') {
  soundState.muted.value = false
  loadDrum()
}

const useSoundFx = () => {
  return { muted: soundState.muted, toggleMute, playDrum }
}

export default useSoundFx
