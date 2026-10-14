// Shared "page ready" gate mirroring the reference site: the loading
// screen covers the page on entry, and only once it fades out may the hero
// entrance and section reveals start. A fallback timer opens the gate
// regardless so a failed loading screen can never leave the page frozen.

const ready = ref(false)
let fallback: ReturnType<typeof setTimeout> | null = null

const markReady = (): void => {
  ready.value = true
  if (fallback) {
    clearTimeout(fallback)
    fallback = null
  }
}

const usePageReady = () => {
  if (!fallback && !ready.value && import.meta.client) {
    fallback = setTimeout(markReady, 2500)
  }
  return { ready, markReady }
}

export default usePageReady
