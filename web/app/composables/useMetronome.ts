import { onScopeDispose, ref } from 'vue'
import gsap from 'gsap'

// BPM metronome ported from the reference site's about hero: a four-beat
// measure that plays a drum pattern, pulses the avatar on every beat, and
// can be driven by long-press buttons or by tapping the avatar four times
// in a row. Audio files and pattern table match the reference's bundle.
const PATTERNS: string[][] = [
  ['drum3', 'drum2', 'drum4', 'drum2'],
  ['drum7', 'drum2', 'drum6', 'drum2'],
  ['drum3', 'drum10', 'drum4', 'drum1'],
  ['drum3', 'drum5', 'drum3', 'drum10'],
]
const MIN_BPM = 30
const MAX_BPM = 999
const DEFAULT_BPM = 120
const DRUM_VOLUME = 0.5
const ACCENT_VOLUME = 0.5
const ACCENT_SAMPLE = '/audios/drum5.wav'
const AUTO_RESET_MS = 60_000
const TAP_WINDOW_MS = 2_000
const TAP_OPEN_COUNT = 4
const TAP_HISTORY = 4
const REPEAT_FIRST_MS = 300
const REPEAT_MIN_MS = 50
const REPEAT_DECAY = 0.85

const sampleUrl = (name: string): string => `/audios/${name}.wav`

interface MetronomeOptions {
  pulseTarget: () => HTMLElement | null
}

const useMetronome = ({ pulseTarget }: MetronomeOptions) => {
  const { playSample, preloadSample } = useSoundFx()
  const open = ref(false)
  const bpm = ref(DEFAULT_BPM)
  const activeBeat = ref(0)
  const patternIndex = ref(0)
  const keepBpm = ref(false)

  let beatTimer: ReturnType<typeof setTimeout> | null = null
  let offBeatTimer: ReturnType<typeof setTimeout> | null = null
  let resetTimer: ReturnType<typeof setTimeout> | null = null
  let repeatTimer: ReturnType<typeof setTimeout> | null = null
  let pendingPattern: number | null = null
  let tapTimes: number[] = []

  const prefersReducedMotion = (): boolean =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const playStep = (step: number): void => {
    const pattern = PATTERNS[patternIndex.value] ?? PATTERNS[0]!
    const name = pattern[step % pattern.length]
    if (name) playSample(sampleUrl(name), DRUM_VOLUME)
  }

  const pulse = (): void => {
    const target = pulseTarget()
    if (!target || prefersReducedMotion()) return
    const duration = (60 / bpm.value) * 1
    gsap.fromTo(target, { scale: 1.1 }, { scale: 1, duration, ease: 'overshoot', overwrite: 'auto' })
  }

  const stop = (): void => {
    if (beatTimer) {
      clearTimeout(beatTimer)
      beatTimer = null
    }
    if (offBeatTimer) {
      clearTimeout(offBeatTimer)
      offBeatTimer = null
    }
    if (resetTimer) {
      clearTimeout(resetTimer)
      resetTimer = null
    }
  }

  const run = (): void => {
    let beat = 0
    let step = 0
    const tick = (): void => {
      if (beat === 0 && pendingPattern !== null) {
        patternIndex.value = pendingPattern
        pendingPattern = null
      }
      activeBeat.value = beat
      playStep(step)
      step += 1
      const interval = 60_000 / bpm.value
      offBeatTimer = setTimeout(() => {
        playStep(step)
        step += 1
      }, interval / 2)
      pulse()
      beat = (beat + 1) % 4
      beatTimer = setTimeout(tick, interval)
    }
    tick()
  }

  const armReset = (): void => {
    if (resetTimer) clearTimeout(resetTimer)
    if (keepBpm.value) return
    resetTimer = setTimeout(reset, AUTO_RESET_MS)
  }

  const reset = (): void => {
    stop()
    open.value = false
    activeBeat.value = 0
    patternIndex.value = 0
    pendingPattern = null
    bpm.value = DEFAULT_BPM
    tapTimes = []
    const target = pulseTarget()
    if (target && !prefersReducedMotion()) {
      gsap.to(target, { scale: 1, duration: 0.25, ease: 'overshoot', overwrite: 'auto' })
    }
  }

  const start = (): void => {
    stop()
    run()
    armReset()
  }

  const setBpm = (value: number): void => {
    if (value < MIN_BPM || value > MAX_BPM) return
    bpm.value = value
    playSample(ACCENT_SAMPLE, ACCENT_VOLUME)
  }

  const changeBpm = (delta: number): void => {
    const next = bpm.value + delta
    if (next < MIN_BPM || next > MAX_BPM) return
    bpm.value = next
    playSample(ACCENT_SAMPLE, ACCENT_VOLUME)
  }

  const pressBpm = (delta: number): void => {
    changeBpm(delta)
    let delay = REPEAT_FIRST_MS
    const repeat = (): void => {
      repeatTimer = setTimeout(() => {
        changeBpm(delta)
        delay = Math.max(REPEAT_MIN_MS, delay * REPEAT_DECAY)
        repeat()
      }, delay)
    }
    repeat()
  }

  const releaseBpm = (): void => {
    if (!repeatTimer) return
    clearTimeout(repeatTimer)
    repeatTimer = null
  }

  const toggleKeep = (): void => {
    keepBpm.value = !keepBpm.value
    if (keepBpm.value) {
      if (resetTimer) {
        clearTimeout(resetTimer)
        resetTimer = null
      }
      return
    }
    if (open.value) armReset()
  }

  const nextPattern = (): void => {
    const next = (patternIndex.value + 1) % PATTERNS.length
    if (open.value) {
      pendingPattern = next
      return
    }
    patternIndex.value = next
  }

  const bpmFromTaps = (times: number[]): number => {
    if (times.length < 2) return 0
    const gaps: number[] = []
    for (let i = 1; i < times.length; i += 1) gaps.push(times[i]! - times[i - 1]!)
    const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
    return Math.round(60_000 / average)
  }

  const bounce = (): void => {
    const target = pulseTarget()
    if (!target || prefersReducedMotion()) return
    gsap.timeline({ defaults: { duration: 0.125, ease: 'overshoot' } })
      .fromTo(target, { scale: 1 }, { scale: 0.9, overwrite: 'auto' })
      .to(target, { scale: 1 })
  }

  // Avatar tap: while the overlay is open taps retune the tempo, otherwise
  // four taps inside two seconds set the tempo and reveal the overlay.
  const tap = (): void => {
    const now = Date.now()
    if (open.value) {
      tapTimes.push(now)
      if (tapTimes.length > TAP_HISTORY) tapTimes.shift()
      const gap = now - (tapTimes.at(-2) ?? now)
      if (tapTimes.length >= 2 && gap <= TAP_WINDOW_MS) {
        const value = bpmFromTaps(tapTimes)
        if (value >= MIN_BPM && value <= MAX_BPM) {
          setBpm(value)
          activeBeat.value = 0
        }
      } else if (gap > TAP_WINDOW_MS) {
        tapTimes = [now]
      }
      armReset()
      return
    }
    tapTimes.push(now)
    tapTimes = tapTimes.filter((time) => now - time < TAP_WINDOW_MS)
    if (tapTimes.length >= TAP_OPEN_COUNT) {
      const value = bpmFromTaps(tapTimes)
      if (value >= MIN_BPM && value <= MAX_BPM) {
        setBpm(value)
        open.value = true
        start()
      }
    }
    bounce()
  }

  const preload = (): void => {
    const names = new Set(PATTERNS.flat())
    names.forEach((name) => preloadSample(sampleUrl(name)))
    preloadSample(ACCENT_SAMPLE)
  }

  onScopeDispose(() => {
    stop()
    releaseBpm()
  })

  return {
    open,
    bpm,
    activeBeat,
    patternIndex,
    keepBpm,
    start,
    stop,
    reset,
    tap,
    changeBpm,
    pressBpm,
    releaseBpm,
    toggleKeep,
    nextPattern,
    preload,
  }
}

export default useMetronome
