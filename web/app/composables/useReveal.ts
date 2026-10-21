import gsap from 'gsap'

// Scroll reveal for [data-reveal] elements, ported from the reference
// site's section reveal: elements sit at opacity 0 / translateY(50px)
// (the .reveal class, applied from the SSG HTML so there is no flash) and
// ease in with the cardReveal curve once they enter the viewport. The
// reveal state is removed on completion so later GSAP work starts clean.

const DURATION = 1
const EASE = 'cardReveal'

const revealElement = (el: HTMLElement): void => {
  el.classList.remove('reveal')
  gsap.fromTo(
    el,
    { opacity: 0, y: 50 },
    { opacity: 1, y: 0, duration: DURATION, ease: EASE, clearProps: 'transform,opacity' },
  )
}

const useReveal = () => {
  const route = useRoute()
  const { ready } = usePageReady()
  let io: IntersectionObserver | null = null

  const scan = () => {
    if (!ready.value) return
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
      .filter((el) => el.classList.contains('reveal'))
    if (els.length === 0) return

    // Re-scan after route changes: the previous page's elements unmount,
    // so its observer is discarded before a new one is created.
    io?.disconnect()
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          io?.unobserve(entry.target)
          revealElement(entry.target as HTMLElement)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    const visible = els.filter((el) => {
      const rect = el.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight
    })
    // Elements already in view on entry reveal together, like the
    // reference's staggered mount reveal; the rest wait for scroll.
    visible.forEach((el) => {
      io?.unobserve(el)
      revealElement(el)
    })
    els.filter((el) => !visible.includes(el)).forEach((el) => io?.observe(el))
  }

  onMounted(() => {
    useEases()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    watch(ready, (value) => {
      if (value) scan()
    }, { immediate: true })

    // Nuxt keeps app.vue mounted across page navigations. Without this
    // watcher, [data-reveal] nodes added by the next page stay hidden.
    watch(() => route.fullPath, async () => {
      await nextTick()
      scan()
    })
  })
}

export default useReveal
