// Shared sound-effects state for the chanfoo-style UI: a short drum hit
// (drum9.wav) with a random playback rate, used by the hero title letters
// (hover blip + click ring). Mirrors the reference site, which ships the
// same asset and defaults to muted unless the visitor previously unmuted
// via the nav toggle (persisted in localStorage).

const STORAGE_KEY = 'lolicount-sound-muted'
const DRUM_URL = '/audios/drum9.wav'
const DRUM3_URL = '/audios/drum3.wav'
const TAP_URL = '/audios/tap.ogg'
const GAIN = 0.5
const MIN_RATE = 0.9
const RATE_SPREAD = 0.2
// Physics collision hits at most every 50ms, mirroring the reference.
const COLLISION_THROTTLE_MS = 50

let ctx: AudioContext | null = null
let drumBuffer: AudioBuffer | null = null
let drum3Buffer: AudioBuffer | null = null
let tapBuffer: AudioBuffer | null = null
let loading = false
let lastCollisionAt = 0

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
// Decode an extra sample into the given slot; a failed load keeps the
// slot null and the corresponding play function stays silent.
const loadSample = (url: string, apply: (buffer: AudioBuffer) => void): Promise<void> => {
  return fetch(url)
  fetch(url)
    .then((res) => res.arrayBuffer())
    .then((bytes) => ensureContext()?.decodeAudioData(bytes) ?? null)
    .then((buffer) => {
      if (buffer) apply(buffer)
    })
    .catch(() => {})
}

// Physics-playground hits, ported from the reference: drum9 scaled by
// collision velocity (with an optional horizontal pan), a soft drum3 nudge
// for keyboard pushes, and a tiny tap blip when glyphs spawn. All gated by
// the site-wide mute like the rest of the sound effects.
const playDrum9 = (velocity: number, x?: number): void => {
  if (soundState.muted.value) return
  const audioCtx = ensureContext()
  if (!audioCtx) return
  if (!drumBuffer) {
    loadSample(DRUM_URL, (buffer) => {
      drumBuffer = buffer
    })
    return
  }
  const now = performance.now()
  if (now - lastCollisionAt < COLLISION_THROTTLE_MS) return
  lastCollisionAt = now
  const amount = Math.min(velocity / 20, 1)
  const source = audioCtx.createBufferSource()
  source.buffer = drumBuffer
  source.playbackRate.value = (0.1 + amount * 1.3) * 0.7 + (0.1 + Math.random() * 1.3) * 0.3
  const gain = audioCtx.createGain()
  gain.gain.value = amount * 0.5
  if (typeof x === 'number') {
    const panner = audioCtx.createStereoPanner()
    panner.pan.value = ((x / window.innerWidth) * 2 - 1) * 0.75
    source.connect(gain).connect(panner).connect(audioCtx.destination)
  } else {
    source.connect(gain).connect(audioCtx.destination)
  }
  source.start()
}

const playDrum3 = (pan?: number): void => {
  if (soundState.muted.value) return
  const audioCtx = ensureContext()
  if (!audioCtx) return
  if (!drum3Buffer) {
    loadSample(DRUM3_URL, (buffer) => {
      drum3Buffer = buffer
    })
    return
  }
  const source = audioCtx.createBufferSource()
  source.buffer = drum3Buffer
  const gain = audioCtx.createGain()
  gain.gain.value = 0.25
  if (typeof pan === 'number') {
    const panner = audioCtx.createStereoPanner()
    panner.pan.value = pan * 0.75
    source.connect(gain).connect(panner).connect(audioCtx.destination)
  } else {
    source.connect(gain).connect(audioCtx.destination)
  }
  source.start()
}

const playTap = (): void => {
  if (soundState.muted.value) return
  const audioCtx = ensureContext()
  if (!audioCtx) return
  if (!tapBuffer) {
    loadSample(TAP_URL, (buffer) => {
      tapBuffer = buffer
    })
    return
  }
  const source = audioCtx.createBufferSource()
  source.buffer = tapBuffer
  source.playbackRate.value = 0.9 + Math.random() * 0.2
  const gain = audioCtx.createGain()
  gain.gain.value = 0.3
  source.connect(gain).connect(audioCtx.destination)
  source.start()
}

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

// Generic cached sample player used by the about page's BPM metronome.
// Buffers are decoded once per URL and then replayed through fresh
// BufferSource nodes, mirroring the reference site's Audio() cache.
const sampleCache = new Map<string, AudioBuffer>()
const sampleLoading = new Set<string>()

const preloadSample = (url: string): void => {
  if (sampleCache.has(url) || sampleLoading.has(url) || typeof window === 'undefined') return
  // Decoding needs an AudioContext, and creating one before a user gesture
  // trips the browser's autoplay warning, so only warm the cache after the
  // context already exists.
  if (!ctx) return
  sampleLoading.add(url)
  loadSample(url, (buffer) => {
    sampleCache.set(url, buffer)
  }).finally(() => sampleLoading.delete(url))
}

const playSample = (url: string, volume = 0.5): void => {
  if (soundState.muted.value) return
  const audioCtx = ensureContext()
  if (!audioCtx) return
  const buffer = sampleCache.get(url)
  if (!buffer) {
    preloadSample(url)
    return
  }
  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  const gain = audioCtx.createGain()
  gain.gain.value = volume
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
  return { muted: soundState.muted, toggleMute, playDrum, playDrum9, playDrum3, playTap, playSample, preloadSample }
}

export default useSoundFx
