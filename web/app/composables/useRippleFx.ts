import gsap from 'gsap'

// Material-style press ripple for any element carrying `data-ripple`.
// The host is expected to provide `position: relative; overflow: hidden`.

let installed = false

const onPointerDown = (event: PointerEvent) => {
  const host = (event.target as Element | null)?.closest?.('[data-ripple]')
  if (!host) return
  const target = host as HTMLElement
  const rect = target.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height) * 2
  const ripple = document.createElement('span')
  ripple.style.cssText = [
    'position:absolute',
    'border-radius:9999px',
    'background:var(--accent-soft)',
    'pointer-events:none',
    'opacity:0.9',
    'transform:scale(0)',
    `width:${size}px`,
    `height:${size}px`,
    `left:${event.clientX - rect.left - size / 2}px`,
    `top:${event.clientY - rect.top - size / 2}px`,
  ].join(';')
  target.appendChild(ripple)
  gsap.to(ripple, {
    scale: 1,
    opacity: 0,
    duration: 0.55,
    ease: 'power2.out',
    onComplete: () => ripple.remove(),
  })
}

// Installs the global press listener once; safe to call from multiple roots.
export const useRippleFx = (): void => {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('pointerdown', onPointerDown, { passive: true })
}
