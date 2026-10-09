import gsap from 'gsap'

// Chanfoo's signature cursor FX: tiny sparks trail the pointer.
// Bursts are throttled to ~5/s and any subtree declaring
// `data-no-cursor-firework` (drag avatar, hero wordmark, footer brand)
// opts out, matching the reference site.

const THROTTLE_MS = 110
const MOVE_THRESHOLD = 8
const GRAYS = ['--token-subtext-0', '--token-body', '--token-subtext-1'] as const

let installed = false

const isExcluded = (el: Element | null): boolean =>
  !!el && !!el.closest('[data-no-cursor-firework]')

const spawnBurst = (x: number, y: number): void => {
  const count = 3 + Math.floor(Math.random() * 3)
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('span')
    const color = Math.random() < 0.15 ? 'var(--accent)' : `var(${GRAYS[i % GRAYS.length]})`
    dot.style.cssText = [
      'position:fixed',
      `left:${x}px`,
      `top:${y}px`,
      'width:4px',
      'height:4px',
      'border-radius:9999px',
      `background:${color}`,
      'opacity:0.9',
      'pointer-events:none',
      'z-index:2147483000',
    ].join(';')
    document.body.appendChild(dot)
    const angle = Math.random() * Math.PI * 2
    const distance = 14 + Math.random() * 26
    gsap.to(dot, {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance + 10,
      scale: 0.4,
      opacity: 0,
      duration: 0.45 + Math.random() * 0.25,
      ease: 'power2.out',
      onComplete: () => dot.remove(),
    })
  }
}

// Installs the global pointer listener once; safe to call from multiple roots.
export const useFireworkFx = (): void => {
  if (installed || typeof window === 'undefined') return
  installed = true

  let lastX = 0
  let lastY = 0
  let lastFire = 0

  const onMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    const now = Date.now()
    if (Math.hypot(event.clientX - lastX, event.clientY - lastY) < MOVE_THRESHOLD) return
    if (now - lastFire < THROTTLE_MS) return
    if (isExcluded(document.elementFromPoint(event.clientX, event.clientY))) return
    lastX = event.clientX
    lastY = event.clientY
    lastFire = now
    spawnBurst(event.clientX, event.clientY)
  }

  window.addEventListener('pointermove', onMove, { passive: true })
}
