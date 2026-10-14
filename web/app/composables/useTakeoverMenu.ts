import gsap from 'gsap'
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

// Takeover-menu choreography ported from the reference site's mobile
// header menu: an always-mounted fixed panel whose opacity/visibility
// are driven by GSAP. Tiles rise from y:128 on the cardReveal curve
// (stagger .05), each tile's ghost icon slides in from xPercent:80 while
// rotating 10deg to -10deg, the header's right-side actions fly out at
// y:-64, and the hamburger icon container spins from -90deg on every
// toggle. A 5% pancake easter egg (with the reference's synthesized
// sparkle) replaces the closed hamburger. Touch devices get the ghost
// motion tied to the menu open/close via `menu-portal` events; pointer
// devices get it on tile hover/focus instead.

const TILE_STAGGER = 0.05
const TILES_IN_AT = 0.25
const PANCAKE_CHANCE = 0.05
// Corner-icon slide timing, ported from the reference's Px/Nx constants.
const ICON_OUT = { duration: 0.22, ease: 'power3.in' }
const ICON_IN = { duration: 0.28, ease: 'power3.out' }

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const dispatchTilePortal = (tile: HTMLElement, show: boolean): void => {
  tile.dispatchEvent(new CustomEvent('menu-portal', { detail: { show } }))
}

interface TileTimelines {
  ghost: HTMLElement
  icon: HTMLElement
  open: gsap.core.Timeline
  close: gsap.core.Timeline
}

interface TakeoverMenuOptions {
  menuOpen: Ref<boolean>
  panelEl: Ref<HTMLElement | null>
  headerEl: Ref<HTMLElement | null>
  hamburgerIconEl: Ref<HTMLElement | null>
  isTouch: Ref<boolean>
  startupDone: Ref<boolean>
}

const useTakeoverMenu = (options: TakeoverMenuOptions): {
  pancake: Ref<boolean>
  toggleMenu: () => void
  closeMenu: () => void
} => {
  const { menuOpen, panelEl, headerEl, hamburgerIconEl, isTouch, startupDone } = options
  const { playTap, playSparkle } = useSoundFx()

  // 5% pancake roll, re-rolled on every close like the reference.
  const pancake = ref(Math.random() < PANCAKE_CHANCE)
  let menuTimeline: gsap.core.Timeline | null = null
  let visibleHFrame = 0
  const tileTimelines = new Map<HTMLElement, TileTimelines>()
  const tileCleanups = new Map<HTMLElement, () => void>()

  const getTiles = (): HTMLElement[] => Array.from(panelEl.value?.querySelectorAll<HTMLElement>('.nav-tile') ?? [])
  const getActions = (): HTMLElement[] => Array.from(headerEl.value?.querySelectorAll<HTMLElement>('.nav-actions > *') ?? [])

  // The reference's generic ("about") ghost motion, pre-built per tile.
  const getTileTimelines = (tile: HTMLElement): TileTimelines | null => {
    const cached = tileTimelines.get(tile)
    if (cached) return cached
    const ghost = tile.querySelector<HTMLElement>('.nav-tile-ghost')
    const icon = tile.querySelector<HTMLElement>('.nav-tile-icon')
    if (!ghost || !icon) return null
    const open = gsap.timeline({ paused: true })
    const close = gsap.timeline({ paused: true })
    if (isTouch.value) {
      // Touch: the corner icon stays hidden, only the ghost animates.
      open.fromTo(
        ghost,
        { autoAlpha: 0, x: 0, xPercent: 80, rotation: 10 },
        { autoAlpha: 1, xPercent: 0, duration: 0.35, ease: 'power3.out' },
      ).to(ghost, { rotation: -10, duration: 0.3, ease: 'back.out(2)' }, '<0.1')
      close.to(ghost, { rotation: 10, duration: 0.3, ease: 'power2.in' })
        .to(ghost, { autoAlpha: 0, xPercent: 80, duration: 0.3, ease: 'power2.in' }, '<')
    } else {
      // Pointer devices: the corner icon slides out, then the ghost enters.
      open.to(icon, { autoAlpha: 0, x: -12, ...ICON_OUT })
        .fromTo(
          ghost,
          { autoAlpha: 0, x: 0, xPercent: 80, rotation: 10 },
          { autoAlpha: 1, xPercent: 0, duration: 0.35, ease: 'power3.out' },
        ).to(ghost, { rotation: -10, duration: 0.3, ease: 'back.out(2)' }, '<0.1')
      close.to(ghost, { rotation: 10, duration: 0.3, ease: 'power2.in' })
        .to(ghost, { autoAlpha: 0, xPercent: 80, duration: 0.3, ease: 'power2.in' }, '<')
        .set(icon, { autoAlpha: 0, x: -12 })
        .to(icon, { autoAlpha: 1, x: 0, ...ICON_IN })
    }
    const entry: TileTimelines = { ghost, icon, open, close }
    tileTimelines.set(tile, entry)
    return entry
  }

  // Resting state: ghost parked off to the right, corner icon visible on
  // pointer devices and hidden on touch (the reference's initial sets).
  const setTileRest = (tile: HTMLElement): void => {
    const ghost = tile.querySelector<HTMLElement>('.nav-tile-ghost')
    const icon = tile.querySelector<HTMLElement>('.nav-tile-icon')
    if (!ghost || !icon) return
    gsap.set(ghost, { autoAlpha: 0, x: 0, xPercent: 80, rotation: 10, y: 0 })
    gsap.set(icon, { autoAlpha: isTouch.value ? 0 : 1, x: 0, y: 0 })
  }

  // Plays a tile's ghost in or out (menu-portal on touch, hover/focus on
  // pointer devices). Reduced motion jumps straight to the end state.
  const playTile = (tile: HTMLElement, show: boolean): void => {
    const entry = getTileTimelines(tile)
    if (!entry) return
    if (reducedMotion()) {
      gsap.killTweensOf([entry.ghost, entry.icon])
      gsap.set(entry.ghost, { autoAlpha: show ? 1 : 0, x: 0, xPercent: show ? 0 : 80, rotation: show ? -10 : 10, y: 0 })
      if (!isTouch.value) gsap.set(entry.icon, { autoAlpha: show ? 0 : 1, x: 0, y: 0 })
      return
    }
    ;(show ? entry.open : entry.close).invalidate().restart()
  }

  const setupTile = (tile: HTMLElement): void => {
    setTileRest(tile)
    tileTimelines.delete(tile)
    tileCleanups.get(tile)?.()
    const cleanups: Array<() => void> = []
    const add = (type: string, handler: EventListener): void => {
      tile.addEventListener(type, handler)
      cleanups.push(() => tile.removeEventListener(type, handler))
    }
    if (isTouch.value) {
      add('menu-portal', (e: Event) => playTile(tile, (e as CustomEvent<{ show: boolean }>).detail.show))
    } else {
      add('mouseenter', () => playTile(tile, true))
      add('mouseleave', () => playTile(tile, false))
      add('focus', (e: Event) => {
        const target = e.target
        if (target instanceof HTMLElement && target.matches(':focus-visible')) playTile(tile, true)
      })
      add('blur', (e: Event) => {
        const target = e.target
        if (target instanceof HTMLElement && !target.matches(':hover')) playTile(tile, false)
      })
    }
    tileCleanups.set(tile, () => {
      for (const fn of cleanups) fn()
    })
  }

  // The panel/tiles timeline, ported from the reference: open plays the
  // panel fade + tile rise (cards stagger in from the start) and pings
  // each tile's ghost on the same stagger; close reverses it (stagger
  // from the end) and hides the panel once the tiles have dropped away.
  const runMenuTimeline = (open: boolean): void => {
    const panel = panelEl.value
    const tiles = getTiles()
    if (!panel) return
    gsap.killTweensOf(panel)
    gsap.killTweensOf(tiles)
    menuTimeline?.kill()
    menuTimeline = null

    if (reducedMotion()) {
      gsap.set(tiles, { opacity: open ? 1 : 0, x: 0, y: 0 })
      for (const tile of tiles) dispatchTilePortal(tile, open)
      gsap.set(panel, { opacity: open ? 1 : 0, visibility: open ? 'visible' : 'hidden' })
      return
    }

    if (open) {
      gsap.set(panel, { visibility: 'visible' })
      const tl = gsap.timeline()
      tl.to(panel, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0)
      tl.fromTo(
        tiles,
        { opacity: 0, x: 0, y: 128 },
        { opacity: 1, x: 0, y: 0, duration: 1, ease: 'cardReveal', stagger: { each: TILE_STAGGER, from: 'start' } },
        TILES_IN_AT,
      )
      tiles.forEach((tile, i) => tl.call((t: HTMLElement) => dispatchTilePortal(t, true), [tile], TILES_IN_AT + i * TILE_STAGGER))
      menuTimeline = tl
    } else {
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(panel, { visibility: 'hidden' })
          menuTimeline = null
        },
      })
      tl.to(tiles, { opacity: 0, x: 0, y: 128, duration: 0.3, ease: 'power2.in', stagger: { each: TILE_STAGGER, from: 'end' } }, 0)
      tl.to(panel, { opacity: 0, duration: 0.3, ease: 'power2.inOut' }, '>')
      tiles.forEach((tile, i) => tl.call((t: HTMLElement) => dispatchTilePortal(t, false), [tile], (tiles.length - 1 - i) * TILE_STAGGER))
      menuTimeline = tl
    }
  }

  // The header's right-side cluster flies out when the menu opens and
  // back in (longer, from the end) when it closes, ported from the
  // reference's data-header-animate-right treatment. Gated on the header
  // entrance so the two choreographies never fight.
  const animateActions = (open: boolean): void => {
    if (!startupDone.value) return
    const actions = getActions()
    if (!actions.length) return
    if (open) {
      gsap.to(actions, { opacity: 0, y: -64, duration: 0.25, ease: 'power2.in', stagger: { each: 0.05, from: 'end' } })
    } else {
      gsap.fromTo(
        actions,
        { opacity: 0, y: -64 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          stagger: { each: 0.05, from: 'end' },
          onComplete: () => gsap.set(actions, { clearProps: 'transform' }),
        },
      )
    }
  }

  // The icon container spins in from -90deg on every toggle while the
  // hamburger icon swaps for an X (and back).
  const spinHamburger = (): void => {
    const el = hamburgerIconEl.value
    if (!el) return
    gsap.fromTo(el, { rotation: -90 }, { rotation: 0, duration: 0.25, ease: 'back.out(1.7)', overwrite: 'auto' })
  }

  // The takeover covers the frame, so page scroll stops while it is open.
  const lockScroll = (locked: boolean): void => {
    document.documentElement.style.overflow = locked ? 'hidden' : ''
  }

  const closeMenu = (): void => {
    if (!menuOpen.value) return
    menuOpen.value = false
  }

  const toggleMenu = (): void => {
    const opening = !menuOpen.value
    menuOpen.value = opening
    if (opening) {
      // The reference plays its synthesized sparkle for a pancake tap
      // instead of the normal menu sound.
      if (pancake.value) playSparkle()
      else playTap()
    } else {
      playTap()
    }
  }

  // Keeps --menu-visible-h (the visual viewport height) current while the
  // menu is open, so the grid max-width and bottom padding track the
  // mobile browser UI bars.
  const stopVisibleHLoop = (): void => {
    if (visibleHFrame) {
      cancelAnimationFrame(visibleHFrame)
      visibleHFrame = 0
    }
  }

  const startVisibleHLoop = (): void => {
    const panel = panelEl.value
    if (!panel) return
    stopVisibleHLoop()
    let last = -1
    const loop = (): void => {
      const h = window.visualViewport?.height ?? window.innerHeight
      if (h !== last) {
        last = h
        panel.style.setProperty('--menu-visible-h', `${h}px`)
      }
      visibleHFrame = requestAnimationFrame(loop)
    }
    loop()
  }

  watch(menuOpen, (open) => {
    spinHamburger()
    if (!open) pancake.value = Math.random() < PANCAKE_CHANCE
    lockScroll(open)
    animateActions(open)
    runMenuTimeline(open)
    if (open) {
      startVisibleHLoop()
    } else {
      stopVisibleHLoop()
      panelEl.value?.style.removeProperty('--menu-visible-h')
    }
  })

  onMounted(() => {
    for (const tile of getTiles()) setupTile(tile)
    window.addEventListener('resize', onResize)
  })

  // The hamburger hides at 768px; closing an open panel after resizing up
  // keeps the desktop layout unobstructed (reference does the same at
  // its own breakpoint).
  const onResize = (): void => {
    if (window.matchMedia('(min-width: 768px)').matches) closeMenu()
  }

  watch(isTouch, () => {
    for (const tile of getTiles()) setupTile(tile)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    stopVisibleHLoop()
    menuTimeline?.kill()
    for (const cleanup of tileCleanups.values()) cleanup()
    tileCleanups.clear()
    tileTimelines.clear()
    lockScroll(false)
  })

  return { pancake, toggleMenu, closeMenu }
}

export default useTakeoverMenu
