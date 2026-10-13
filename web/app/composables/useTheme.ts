// useTheme: site-wide day/night mode (light/dark), shared app-wide.
// Persisted to localStorage and applied to <html data-mode> so the CSS
// variables in theme.css recolor the whole site. Mode defaults to the
// OS preference (prefers-color-scheme) until the user toggles it,
// mirroring the reference's next-themes setup. SSR-safe: initial values
// are the defaults; init() reconciles on the client.

export type ModeName = 'light' | 'dark'

const MODE_KEY = 'lolicount-mode'

const mode = ref<ModeName>('light')

const isMode = (v: string | null): v is ModeName => v === 'light' || v === 'dark'

const systemMode = (): ModeName =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

// The reference fades every surface color over 300ms when the theme
// switches; the fade class enables that window just long enough.
const FADE_CLASS = 'theme-fade'
let fadeTimer: ReturnType<typeof setTimeout> | null = null

const startFade = (): void => {
  const html = document.documentElement
  html.classList.add(FADE_CLASS)
  if (fadeTimer) clearTimeout(fadeTimer)
  fadeTimer = setTimeout(() => {
    html.classList.remove(FADE_CLASS)
    fadeTimer = null
  }, 350)
}

const applyToHtml = (): void => {
  if (!import.meta.client) return
  const html = document.documentElement
  startFade()
  if (mode.value === 'dark') html.setAttribute('data-mode', 'dark')
  else html.removeAttribute('data-mode')
  // next-themes parity: the inline color-scheme keeps native UI
  // (scrollbars, form controls) in step with the picked scheme.
  html.style.colorScheme = mode.value
}

// While no explicit preference is stored, the site follows the OS scheme;
// this listener keeps it in step with live OS changes.
let followSystem = false
const onSystemSchemeChange = (e: MediaQueryListEvent): void => {
  if (!followSystem) return
  const next: ModeName = e.matches ? 'dark' : 'light'
  if (next === mode.value) return
  mode.value = next
  applyToHtml()
}

const setMode = (m: ModeName): void => {
  followSystem = false
  mode.value = m
  if (import.meta.client) localStorage.setItem(MODE_KEY, m)
  applyToHtml()
}

const toggleMode = (): void => setMode(mode.value === 'light' ? 'dark' : 'light')

// Reconcile both preferences once on the client, after hydration, to
// avoid clobbering SSR output. The pre-paint script in nuxt.config.ts
// already applied them to <html> before first paint, so this is a
// value-level no-op for returning visitors.
const init = (): void => {
  if (!import.meta.client) return
  const storedMode = localStorage.getItem(MODE_KEY)
  if (isMode(storedMode)) {
    mode.value = storedMode
  } else {
    mode.value = systemMode()
    followSystem = true
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onSystemSchemeChange)
  }
  applyToHtml()
}

export const useTheme = () => {
  return { mode, setMode, toggleMode, init }
}
