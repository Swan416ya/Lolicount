<script setup lang="ts">
// StarBurst fires a small fireworks show from a viewport point.
// Call trigger(x, y) with viewport coordinates (e.g. MouseEvent.clientX/Y)
// from a click handler. Each trigger spawns a main burst plus two
// staggered satellite bursts above it; every burst is a white flash and
// particles flying outward on gravity-drooped arcs, animated with GSAP.
// All nodes remove themselves when done, and the container is fixed +
// pointer-events-none so the show is never clipped by ancestor overflow
// and never blocks clicks. Styling is inline because dynamically created
// nodes carry no scoped-style data attribute.
import gsap from 'gsap'

const SPARKS = ['✦', '★', '✧']
const COLORS = ['#ff7eb3', '#ff758c', '#ffb86c', '#ffd166', '#fff6a3', '#a3e6ff', '#c4b5fd', '#ffffff']

const container = ref<HTMLElement | null>(null)

const makeNode = (px: number, py: number, ttlMs: number) => {
  const el = document.createElement('span')
  el.style.position = 'absolute'
  el.style.left = `${px}px`
  el.style.top = `${py}px`
  el.style.userSelect = 'none'
  el.style.pointerEvents = 'none'
  el.style.willChange = 'transform, opacity'
  // Backup removal: GSAP's onComplete never fires while the tab's rAF is
  // frozen (hidden/backgrounded tab), so nodes must not rely on it alone.
  window.setTimeout(() => el.remove(), ttlMs)
  return el
}

// One explosion: a white flash at the center, then particles fly outward.
const burst = (px: number, py: number, count = 26) => {
  const root = container.value
  if (!root) return

  const flash = makeNode(px, py, 700)
  flash.style.width = '10px'
  flash.style.height = '10px'
  flash.style.margin = '-5px 0 0 -5px'
  flash.style.borderRadius = '50%'
  flash.style.background = '#fff'
  flash.style.boxShadow = '0 0 14px 5px rgba(255, 244, 214, 0.9)'
  root.appendChild(flash)
  gsap.fromTo(flash, { scale: 0.3, opacity: 0.95 }, {
    scale: 2.8,
    opacity: 0,
    duration: 0.32,
    ease: 'power2.out',
    onComplete: () => flash.remove(),
  })

  for (let i = 0; i < count; i++) {
    const isDot = Math.random() > 0.3
    const color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#ff7eb3'
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4
    const dist = 70 + Math.random() * 110
    const dx = Math.cos(angle) * dist
    // Gravity: keep the horizontal spread, squash the vertical one and
    // bias it downward so the arcs fall like real fireworks.
    const dy = Math.sin(angle) * dist * 0.7 + 50 + Math.random() * 30
    const dur = 0.75 + Math.random() * 0.5
    const el = makeNode(px, py, (0.1 + dur) * 1000 + 200)
    if (isDot) {
      const size = 4 + Math.random() * 4
      el.style.width = `${size}px`
      el.style.height = `${size}px`
      el.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`
      el.style.borderRadius = '50%'
      el.style.background = color
    } else {
      el.textContent = SPARKS[Math.floor(Math.random() * SPARKS.length)] ?? '✦'
      el.style.fontSize = `${10 + Math.random() * 8}px`
      el.style.color = color
    }
    root.appendChild(el)

    gsap.fromTo(el, { x: 0, y: 0, scale: 0, opacity: 1 }, {
      keyframes: [
        { scale: isDot ? 1 : 1.15, duration: 0.1, ease: 'power1.out' },
        {
          x: dx,
          y: dy,
          scale: 0.25,
          rotation: (Math.random() - 0.5) * 220,
          opacity: 0,
          duration: dur,
          ease: 'power2.out',
        },
      ],
      onComplete: () => el.remove(),
    })
  }
}

const trigger = (x: number, y: number) => {
  burst(x, y)
  // Timers rather than gsap.delayedCall: the burst schedule must not
  // depend on the rAF ticker staying alive.
  window.setTimeout(() => burst(x + (Math.random() - 0.5) * 140, y - 30 - Math.random() * 50, 20), 120)
  window.setTimeout(() => burst(x + (Math.random() - 0.5) * 180, y - 70 - Math.random() * 60, 20), 260)
}

defineExpose({ trigger })
</script>

<template>
  <div ref="container" class="pointer-events-none fixed inset-0 z-[70] overflow-hidden" />
</template>
