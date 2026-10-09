// Matter.js glyph physics, ported from the reference's playground page.
// The wordmark's letter spans become rigid bodies (canvas edge-sampled
// outlines, rectangles for spaces); the viewport minus --frame-gutter is
// walled with four static slabs. Letters are dragged with a soft spring
// constraint and flicked on release; typed letters (a-z) spawn at the top
// and fall; 'f'/'F' spawns the whole Lolicount wordmark as one body; Space
// bounces everything, Shift nudges sideways, Enter detonates typed B's
// radially, Backspace pops the newest body. Sounds are the reference's
// velocity-scaled drum9 (panned), drum3 nudge and tap blip.
import gsap from 'gsap'
import type Matter from 'matter-js'
import { onBeforeUnmount, watch, type Ref } from 'vue'
import { droogGlyphs } from '~/data/droog-glyphs'
import useSoundFx from '~/composables/useSoundFx'
import { spawnTokenColor } from '~/composables/useLetterTokens'

type MatterNamespace = typeof Matter

const FIXED_STEP = 1000 / 60
const MAX_STEPS = 3
const FLICK_CAP = 40
const ANGLE_CAP = 0.4
const COLLISION_COOLDOWN_MS = 600
const SPAWN_TOP = 104
const TOP_CLAMP = 64
const BODY_OPTS = { restitution: 0.4, friction: 0.1, frictionAir: 0.01 } as const

// The Lolicount wordmark as a single vector, built from the droog-900
// outlines (baseline y=0, up negative, unitsPerEm 1000). The viewBox keeps
// the reference's 900 box height; scale 0.9 fits the 700-unit cap height
// with the word vertically centered.
const WORD = 'Lolicount'
const WORD_SCALE = 0.9
const WORD_H = 900

const wordmarkLayout = (() => {
  let x = 0
  const parts: string[] = []
  for (const ch of WORD) {
    const glyph = droogGlyphs.glyphs[ch]
    if (!glyph) continue
    parts.push(`<g transform="translate(${(x * WORD_SCALE).toFixed(1)} ${450 + 350 * WORD_SCALE}) scale(${WORD_SCALE})"><path d="${glyph.d}"/></g>`)
    x += glyph.advance
  }
  return { width: x * WORD_SCALE, markup: parts.join('') }
})()

// Edge-sample a rendered canvas: an opaque pixel adjacent to a transparent
// one becomes a vertex (center-relative), like the reference's sampler.
const sampleEdges = (canvas: HTMLCanvasElement, data: Uint8ClampedArray): Matter.Vector[] => {
  const w = canvas.width
  const h = canvas.height
  const alpha = (y: number, x: number): number => data[(y * w + x) * 4 + 3] ?? 0
  const points: Matter.Vector[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const self = alpha(y, x)
      if (self > 80 && (alpha(y - 1, x) <= 80 || alpha(y + 1, x) <= 80 || alpha(y, x - 1) <= 80 || alpha(y, x + 1) <= 80)) {
        points.push({ x: x - w / 2, y: y - h / 2 })
      }
    }
  }
  if (points.length < 3) {
    const hw = w / 2
    const hh = h / 2
    return [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }]
  }
  return points
}

// Vertices for one letter drawn with the container's computed font.
const charVertices = (char: string, font: string, width: number, height: number): Matter.Vector[] => {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width) + 8
  canvas.height = Math.ceil(height) + 8
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context is unavailable')
  ctx.font = font
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#000'
  ctx.fillText(char, 4, 4)
  return sampleEdges(canvas, ctx.getImageData(0, 0, canvas.width, canvas.height).data)
}

// Vertices for the whole wordmark scaled into a w x h box.
const wordmarkVertices = (w: number, h: number): Matter.Vector[] => {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(w) + 8
  canvas.height = Math.ceil(h) + 8
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context is unavailable')
  ctx.save()
  ctx.translate(4, 4)
  ctx.scale(w / wordmarkLayout.width, h / WORD_H)
  ctx.fillStyle = '#000'
  let x = 0
  for (const ch of WORD) {
    const glyph = droogGlyphs.glyphs[ch]
    if (!glyph) continue
    ctx.save()
    ctx.translate(x, 450 + 350 * WORD_SCALE)
    ctx.fill(new Path2D(glyph.d))
    ctx.restore()
    x += glyph.advance
  }
  ctx.restore()
  return sampleEdges(canvas, ctx.getImageData(0, 0, canvas.width, canvas.height).data)
}

export const useGlyphPhysics = (
  container: Ref<HTMLElement | null>,
  active: Ref<boolean>,
  onStart?: () => void,
): void => {
  const { playDrum9, playDrum3, playTap } = useSoundFx()
  let cleanup: (() => void) | null = null
  let booted = false

  const boot = async (containerEl: HTMLElement): Promise<void> => {
    const mod = await import('matter-js')
    // No poly-decomp: like the reference, concave outlines fall back to
    // their convex hull (a disk for o/c-like letters), which is stable.
    const M: MatterNamespace = (mod as unknown as { default?: MatterNamespace }).default ?? (mod as unknown as MatterNamespace)

    const spans = Array.from(containerEl.children) as HTMLElement[]
    if (spans.length === 0) return
    const rects = spans.map((s) => s.getBoundingClientRect())
    const computed = getComputedStyle(containerEl)
    const fontFamily = computed.fontFamily
    const fontSize = computed.fontSize
    const fontWeight = computed.fontWeight
    const font = `${fontWeight} ${fontSize} ${fontFamily}`
    const colors = spans.map((s) => s.style.color)

    // Detach the spans from any entrance tweens and pin them into a fixed
    // body-level layer; the layer becomes their physics stage.
    spans.forEach((s) => {
      gsap.killTweensOf(s)
      gsap.set(s, { clearProps: 'all' })
    })
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;inset:0;z-index:20;pointer-events:none;'
    document.body.appendChild(overlay)
    spans.forEach((span, i) => {
      const rect = rects[i]!
      overlay.appendChild(span)
      Object.assign(span.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
        color: colors[i] || '',
        opacity: '1',
        willChange: 'transform',
        transformOrigin: 'center center',
        lineHeight: '1',
        pointerEvents: 'none',
        fontFamily,
        fontSize,
        fontWeight,
      })
    })
    onStart?.()

    const engine = M.Engine.create({ gravity: { x: 0, y: 1 } })
    const elByBody = new Map<Matter.Body, HTMLElement>()
    const bodies: Matter.Body[] = rects.map((rect, i) => {
      const char = spans[i]!.textContent ?? ''
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const sampled = char.trim() === '' ? null : charVertices(char, font, rect.width, rect.height)
      const body =
        !sampled || sampled.length < 3
          ? M.Bodies.rectangle(cx, cy, rect.width, rect.height, { ...BODY_OPTS })
          : (M.Bodies.fromVertices(cx, cy, [sampled], { ...BODY_OPTS }) ?? M.Bodies.rectangle(cx, cy, rect.width, rect.height, { ...BODY_OPTS }))
      elByBody.set(body, spans[i]!)
      return body
    })
    // Only the spawned wordmark bodies get the wall-bounce flag, matching
    // the reference (typed letters and the initial word just settle).
    const bouncers = new Set<Matter.Body>()
    const lastBounce = new Map<Matter.Body, number>()

    const frame = (): { left: number; top: number; right: number; bottom: number } => {
      const gutter = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--frame-gutter')) || 0
      return {
        left: gutter,
        top: gutter,
        right: document.documentElement.clientWidth - gutter,
        bottom: window.innerHeight - gutter,
      }
    }
    const buildWalls = (): Record<string, Matter.Body> => {
      const f = frame()
      const w = f.right - f.left
      const h = f.bottom - f.top
      const cx = f.left + w / 2
      const cy = f.top + h / 2
      return {
        bottom: M.Bodies.rectangle(cx, f.bottom + 30, w + 120, 60, { isStatic: true }),
        top: M.Bodies.rectangle(cx, f.top - 30, w + 120, 60, { isStatic: true }),
        left: M.Bodies.rectangle(f.left - 30, cy, 60, h + 120, { isStatic: true }),
        right: M.Bodies.rectangle(f.right + 30, cy, 60, h + 120, { isStatic: true }),
      }
    }
    let walls = buildWalls()
    M.Composite.add(engine.world, [...bodies, ...Object.values(walls)])

    M.Events.on(engine, 'collisionActive', (event) => {
      const now = performance.now()
      for (const pair of event.pairs) {
        const target = bouncers.has(pair.bodyA) ? pair.bodyA : bouncers.has(pair.bodyB) ? pair.bodyB : null
        if (!target) continue
        if (now - (lastBounce.get(target) ?? 0) < COLLISION_COOLDOWN_MS) continue
        const gx = engine.gravity.x
        const gy = engine.gravity.y
        const gLen = Math.hypot(gx, gy) || 1
        // Bounce only when moving towards the gravity direction fast enough.
        if (target.velocity.x * gx + target.velocity.y * gy < -3) continue
        lastBounce.set(target, now)
        const impulse = 5 + Math.random() * 4
        M.Body.setVelocity(target, {
          x: target.velocity.x + (-gx / gLen) * impulse + (Math.random() - 0.5) * 4,
          y: target.velocity.y + (-gy / gLen) * impulse,
        })
        M.Body.setAngularVelocity(target, (Math.random() - 0.5) * 0.3)
      }
    })
    M.Events.on(engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const rel = Math.hypot(pair.bodyA.velocity.x - pair.bodyB.velocity.x, pair.bodyA.velocity.y - pair.bodyB.velocity.y)
        if (rel > 2) {
          playDrum9(rel, (pair.bodyA.position.x + pair.bodyB.position.x) / 2)
          break
        }
      }
    })

    // Drag: a soft spring constraint follows the pointer; the pointer
    // velocity (smoothed over 100ms) becomes the release flick.
    const bodyAt = (x: number, y: number): Matter.Body | null => {
      const point = { x, y }
      for (let i = bodies.length - 1; i >= 0; i--) {
        const body = bodies[i]!
        if (!body.isStatic && M.Bounds.contains(body.bounds, point) && M.Vertices.contains(body.vertices, point)) return body
      }
      return null
    }
    let constraint: Matter.Constraint | null = null
    let dragPointer: number | null = null
    let velX = 0
    let velY = 0
    let lastT = 0
    let lastX = 0
    let lastY = 0
    const onPointerDown = (e: PointerEvent): void => {
      if (!e.isPrimary || constraint) return
      const body = bodyAt(e.clientX, e.clientY)
      if (!body) return
      e.preventDefault()
      dragPointer = e.pointerId
      velX = 0
      velY = 0
      lastT = e.timeStamp
      lastX = e.clientX
      lastY = e.clientY
      constraint = M.Constraint.create({
        pointA: { x: e.clientX, y: e.clientY },
        bodyB: body,
        pointB: { x: e.clientX - body.position.x, y: e.clientY - body.position.y },
        length: 0.01,
        stiffness: 0.2,
        damping: 0.1,
        angularStiffness: 0.85,
      })
      M.Composite.add(engine.world, constraint)
      document.body.style.cursor = 'grabbing'
    }
    const onPointerMove = (e: PointerEvent): void => {
      if (!constraint || e.pointerId !== dragPointer) return
      e.preventDefault()
      constraint.pointA.x = e.clientX
      constraint.pointA.y = e.clientY
      const dt = e.timeStamp - lastT
      if (dt > 0 && dt <= 100) {
        velX += ((e.clientX - lastX) / dt - velX) * 0.4
        velY += ((e.clientY - lastY) / dt - velY) * 0.4
      }
      lastT = e.timeStamp
      lastX = e.clientX
      lastY = e.clientY
    }
    const onPointerUp = (e?: PointerEvent): void => {
      if (!constraint || (e && dragPointer !== null && e.pointerId !== dragPointer)) return
      const body = constraint.bodyB
      M.Composite.remove(engine.world, constraint)
      constraint = null
      dragPointer = null
      document.body.style.cursor = 'grab'
      if (!body) return
      const stale = (e ? e.timeStamp : performance.now()) - lastT > 60
      const fx = stale ? 0 : velX * FIXED_STEP
      const fy = stale ? 0 : velY * FIXED_STEP
      const mag = Math.hypot(fx, fy)
      const c = mag > FLICK_CAP ? FLICK_CAP / mag : 1
      M.Body.setVelocity(body, { x: fx * c, y: fy * c })
      M.Body.setAngularVelocity(body, Math.max(-ANGLE_CAP, Math.min(ANGLE_CAP, body.angularVelocity)))
    }

    const spawnWordmark = (): void => {
      playTap()
      const h = Number.parseFloat(fontSize)
      const w = h * (wordmarkLayout.width / WORD_H)
      const span = document.createElement('span')
      span.className = 'fade-color'
      span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wordmarkLayout.width.toFixed(1)} ${WORD_H}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" style="display:block" fill="currentColor">${wordmarkLayout.markup}</svg>`
      span.style.cssText = [
        'position:fixed',
        'display:inline-block',
        `color:${spawnTokenColor()}`,
        'line-height:0',
        'opacity:1',
        'will-change:transform',
        'pointer-events:none',
        'transform-origin:center center',
      ].join(';')
      overlay.appendChild(span)
      const x = Math.random() * (window.innerWidth - 100) + 50
      span.style.left = `${(x - w / 2).toFixed(1)}px`
      span.style.top = `${(SPAWN_TOP - h / 2).toFixed(1)}px`
      span.style.width = `${w.toFixed(1)}px`
      span.style.height = `${h.toFixed(1)}px`
      const body =
        M.Bodies.fromVertices(x, SPAWN_TOP, [wordmarkVertices(w, h)], { ...BODY_OPTS }) ??
        M.Bodies.rectangle(x, SPAWN_TOP, w, h, { ...BODY_OPTS })
      elByBody.set(body, span)
      bodies.push(body)
      bouncers.add(body)
      M.Composite.add(engine.world, body)
    }

    const spawnLetter = (ch: string): void => {
      playTap()
      if ((ch === 'f' || ch === 'F') && Math.random() < 1) {
        spawnWordmark()
        return
      }
      const span = document.createElement('span')
      span.className = 'fade-color'
      span.textContent = ch
      span.style.cssText = [
        'position:fixed',
        'display:inline-block',
        `font-family:${fontFamily}`,
        `font-size:${fontSize}`,
        `font-weight:${fontWeight}`,
        `color:${spawnTokenColor()}`,
        'line-height:1',
        'opacity:1',
        'will-change:transform',
        'pointer-events:none',
        'transform-origin:center center',
      ].join(';')
      overlay.appendChild(span)
      const rect = span.getBoundingClientRect()
      const x = Math.random() * (window.innerWidth - 100) + 50
      span.style.left = `${(x - rect.width / 2).toFixed(1)}px`
      span.style.top = `${(SPAWN_TOP - rect.height / 2).toFixed(1)}px`
      span.style.width = `${rect.width.toFixed(1)}px`
      span.style.height = `${rect.height.toFixed(1)}px`
      const body =
        M.Bodies.fromVertices(x, SPAWN_TOP, [charVertices(ch, font, rect.width, rect.height)], { ...BODY_OPTS }) ??
        M.Bodies.rectangle(x, SPAWN_TOP, rect.width, rect.height, { ...BODY_OPTS })
      elByBody.set(body, span)
      bodies.push(body)
      M.Composite.add(engine.world, body)
    }

    const removeBody = (body: Matter.Body): void => {
      const el = elByBody.get(body)
      el?.remove()
      elByBody.delete(body)
      bouncers.delete(body)
      lastBounce.delete(body)
      const idx = bodies.indexOf(body)
      if (idx !== -1) bodies.splice(idx, 1)
      M.Composite.remove(engine.world, body)
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Backspace') {
        e.preventDefault()
        const body = bodies[bodies.length - 1]
        if (body) removeBody(body)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const bs = bodies.filter((b) => {
          const t = elByBody.get(b)?.textContent ?? ''
          return t === 'B' || t === 'b'
        })
        bs.forEach((b, i) => {
          setTimeout(() => {
            if (!bodies.includes(b)) return
            // Radial explosion: push every other body away, then vanish.
            const { x: bx, y: by } = b.position
            for (const other of bodies) {
              if (other === b) continue
              const dx = other.position.x - bx
              const dy = other.position.y - by
              const dist = Math.max(Math.hypot(dx, dy), 1)
              const power = 3000 / dist
              M.Body.setVelocity(other, { x: other.velocity.x + (dx / dist) * power, y: other.velocity.y + (dy / dist) * power })
            }
            removeBody(b)
          }, i * 50)
        })
        return
      }
      if (e.key === 'Shift') {
        const dir = e.location === 1 ? 1 : -1
        for (const b of bodies) M.Body.setVelocity(b, { x: b.velocity.x + dir * 12, y: b.velocity.y - 2 })
        playDrum3(-dir)
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        for (const b of bodies) {
          M.Body.setVelocity(b, { x: b.velocity.x + (Math.random() - 0.5) * 10, y: b.velocity.y - (5 + Math.random() * 15) })
          M.Body.setAngularVelocity(b, b.angularVelocity + (Math.random() - 0.5) * 0.3)
        }
        playDrum3()
        return
      }
      if (e.repeat || e.isComposing) return
      if (!/^[a-zA-Z]$/.test(e.key)) return
      const target = e.target
      if (target instanceof HTMLInputElement && target.hasAttribute('data-physics-input')) return
      spawnLetter(e.key)
    }

    // Touch hint input fields act as static bodies and feed letters through
    // synthesized keydown events; reconcile them against the live DOM.
    const inputBodies = new Map<HTMLElement, Matter.Body>()
    const reconcileInputs = (): void => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-physics-input]'))
      const live = new Set(inputs)
      for (const input of inputs) {
        const rect = input.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const existing = inputBodies.get(input)
        if (existing) M.Body.setPosition(existing, { x: cx, y: cy })
        else {
          const body = M.Bodies.rectangle(cx, cy, rect.width, rect.height, { isStatic: true })
          inputBodies.set(input, body)
          M.Composite.add(engine.world, body)
        }
      }
      for (const [el, body] of inputBodies) {
        if (!live.has(el)) {
          M.Composite.remove(engine.world, body)
          inputBodies.delete(el)
        }
      }
    }
    reconcileInputs()

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
    document.addEventListener('keydown', onKeyDown)
    const prevTouchAction = document.body.style.touchAction
    const prevUserSelect = document.body.style.userSelect
    document.body.style.touchAction = 'none'
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grab'

    // Fixed-step loop (max 3 catch-up steps), then project every body onto
    // its span: center-anchored left/top + rotation.
    let raf = 0
    let lastNow = performance.now()
    let acc = 0
    const step = (now: number): void => {
      acc = Math.min(acc + (now - lastNow), FIXED_STEP * MAX_STEPS)
      lastNow = now
      while (acc >= FIXED_STEP) {
        M.Engine.update(engine, FIXED_STEP)
        acc -= FIXED_STEP
      }
      reconcileInputs()
      for (const body of bodies) {
        const el = elByBody.get(body)
        if (!el) continue
        el.style.left = `${body.position.x - el.offsetWidth / 2}px`
        el.style.top = `${body.position.y - el.offsetHeight / 2}px`
        el.style.transform = `rotate(${body.angle}rad)`
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    const onResize = (): void => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        M.Composite.remove(engine.world, Object.values(walls))
        walls = buildWalls()
        M.Composite.add(engine.world, Object.values(walls))
        inputBodies.forEach((body) => M.Composite.remove(engine.world, body))
        inputBodies.clear()
        reconcileInputs()
        const f = frame()
        for (const body of bodies) {
          const cx = Math.max(f.left + 30, Math.min(f.right - 30, body.position.x))
          const cy = Math.max(Math.max(f.top, TOP_CLAMP) + 30, Math.min(f.bottom - 30, body.position.y))
          if (cx !== body.position.x || cy !== body.position.y) {
            M.Body.setPosition(body, { x: cx, y: cy })
            M.Body.setVelocity(body, { x: 0, y: 0 })
          }
        }
      }, 100)
    }
    window.addEventListener('resize', onResize)

    // Tilt gravity: device motion drives engine.gravity (orientation
    // corrected, macOS touch sign flipped), and sharp shakes bounce the
    // letters, exactly like the reference.
    let motionArmed = false
    let baseX = 0
    let baseY = 0
    let baseZ = 0
    let lastShake = 0
    const sign = /iPhone|iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in window ? -1 : 1
    const orientationAxes = (x: number, y: number): [number, number] => {
      const angle = screen.orientation?.angle ?? window.orientation ?? 0
      switch (angle) {
        case 90:
        case -270:
          return [y, -x]
        case 180:
        case -180:
          return [-x, -y]
        case 270:
        case -90:
          return [-y, x]
        default:
          return [x, y]
      }
    }
    const onMotion = (e: DeviceMotionEvent): void => {
      const a = e.accelerationIncludingGravity
      if (!a) return
      const x = a.x ?? 0
      const y = a.y ?? 0
      const z = a.z ?? 0
      if (!motionArmed) {
        if (x === 0 && y === 0 && z === 0) return
        motionArmed = true
      }
      const [ox, oy] = orientationAxes(x, y)
      engine.gravity.x = (-ox * sign) / 9.81
      engine.gravity.y = (oy * sign) / 9.81
      const dx = x - baseX
      const dy = y - baseY
      const dz = z - baseZ
      baseX = x
      baseY = y
      baseZ = z
      if (Math.hypot(dx, dy, dz) > 15 && performance.now() - lastShake > 500) {
        lastShake = performance.now()
        for (const body of bodies) {
          M.Body.setVelocity(body, { x: body.velocity.x + (Math.random() - 0.5) * 10, y: body.velocity.y - (5 + Math.random() * 15) })
          M.Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.3)
        }
      }
    }
    const attachMotion = (): void => window.addEventListener('devicemotion', onMotion)
    const DME = typeof DeviceMotionEvent !== 'undefined' ? DeviceMotionEvent : null
    if (DME) {
      if (typeof (DME as unknown as { requestPermission?: unknown }).requestPermission === 'function') {
        document.addEventListener('devicemotion-granted', attachMotion)
      } else {
        attachMotion()
      }
    }

    cleanup = () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('devicemotion', onMotion)
      document.removeEventListener('devicemotion-granted', attachMotion)
      document.body.style.cursor = ''
      document.body.style.touchAction = prevTouchAction
      document.body.style.userSelect = prevUserSelect
      spans.forEach((span) => containerEl.appendChild(span))
      overlay.remove()
      M.Engine.clear(engine)
    }
  }

  watch(
    active,
    (on) => {
      if (on && container.value && !booted) {
        booted = true
        void boot(container.value).catch(() => {})
      }
    },
    { immediate: true },
  )
  onBeforeUnmount(() => cleanup?.())
}
