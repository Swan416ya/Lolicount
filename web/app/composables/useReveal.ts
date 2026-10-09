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
  onMounted(() => {
    useEases()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (els.length === 0) return

    let started = false
    const start = () => {
      if (started) return
      started = true
      const visible = els.filter((el) => {
        const rect = el.getBoundingClientRect()
        return rect.bottom > 0 && rect.top < window.innerHeight
      })
      // Elements already in view on entry reveal together, like the
      // reference's staggered mount reveal; the rest wait for scroll.
      if (visible.length > 0) {
        visible.forEach(revealElement)
      }
      const remaining = els.filter((el) => !visible.includes(el))
      if (remaining.length === 0) return
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            io.unobserve(entry.target)
            revealElement(entry.target)
          }
        },
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
      )
      remaining.forEach((el) => io.observe(el))
    }

    const { ready } = usePageReady()
    if (ready.value) start()
    else watch(ready, (value) => {
      if (value) start()
    })
  })
}

export default useReveal
