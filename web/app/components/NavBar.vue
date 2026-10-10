<script setup lang="ts">
import gsap from 'gsap'
const { t, localeLabels } = useI18n()
const { toggle: toggleTheme } = useTheme()
const { muted, toggleMute } = useSoundFx()
const { stars, repoUrl, fetchStars, formatStars } = useGitHub()
const route = useRoute()

const isLinkActive = (href: string) => route.path === href || route.path.startsWith(href + '/')
const navLinks = [
  { href: '/', label: 'nav.playground', isRoute: true },
  { href: '/editor', label: 'nav.editor', isRoute: true },
  { href: '/about', label: 'nav.howAbout', isRoute: true },
] as const
const menuOpen = ref(false)

// Faded stroke glyphs for the takeover-menu tiles, echoing the reference
// site's icon cards (currentColor so they follow the theme).
const linkIcons: Record<string, string> = {
  '/': '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 5h9A4.5 4.5 0 0 1 21 9.5v4A4.5 4.5 0 0 1 16.5 18h-9A4.5 4.5 0 0 1 3 13.5v-4A4.5 4.5 0 0 1 7.5 5Z"/><path d="M6 10.8h3.6M7.8 9v3.6"/><path d="M15 10h.01M17.8 12.4h.01"/></svg>',
  '/editor': '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h8m5 0h3M4 16h3m5 0h8"/><circle cx="14.5" cy="8" r="2.1"/><circle cx="9.5" cy="16" r="2.1"/></svg>',
  '/about': '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 11.2V16"/><path d="M12 7.9h.01"/></svg>',
}

// The takeover menu covers the whole frame, so page scroll must stop
// while it is open (restored on close and on unmount).
const lockScroll = (locked: boolean): void => {
  document.documentElement.style.overflow = locked ? 'hidden' : ''
}

watch(menuOpen, (open) => lockScroll(open))

onBeforeUnmount(() => lockScroll(false))

const closeMenu = () => {
  menuOpen.value = false
}

onMounted(() => {
  fetchStars()
})

onMounted(() => {
  gsap.from('.nav-brand, .nav-link, .nav-actions', {
    opacity: 0,
    y: -32,
    duration: 0.5,
    stagger: 0.04,
    ease: 'power3.out',
  })
})
</script>

<template>
  <header class="nav-bar">
    <div class="nav-wrapper">
      <button type="button" class="nav-brand" data-ripple :title="t('nav.theme')" @click="toggleTheme">
        <img src="/images/lolicount-icon.png" alt="Lolicount" class="nav-brand-icon" />
        <span class="nav-brand-text">Lolicount</span>
      </button>

      <nav class="nav-links" aria-label="Lolicount">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.href"
          :to="link.href"
          class="nav-link"
          data-ripple
          :class="{ 'nav-link-active': isLinkActive(link.href) }"
        >{{ t(link.label) }}</NuxtLink>
      </nav>

      <div class="nav-actions">
        <LangSwitch nav />

        <a
          :href="repoUrl"
          target="_blank"
          rel="noopener"
          class="nav-star"
          data-ripple
          :title="localeLabels[locale]"
        >
          <svg class="nav-star-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
            />
          </svg>
          <span class="nav-star-label">Star</span>
          <span v-if="stars != null" class="nav-star-count">{{ formatStars(stars) }}</span>
        </a>

        <button
          type="button"
          class="nav-hamburger"
          data-ripple
          :class="{ 'nav-hamburger-active': menuOpen }"
          :aria-label="t('nav.features')"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <span class="nav-hamburger-line"></span>
          <span class="nav-hamburger-line"></span>
          <span class="nav-hamburger-line"></span>
        </button>

        <button type="button" class="nav-sound" data-ripple :title="t('nav.sound')" :aria-label="t('nav.sound')" :aria-pressed="String(!muted)" @click="toggleMute">
          <svg v-if="muted" class="nav-sound-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M11 4.5 6.5 8H3.5a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h3L11 20.5v-16Z" opacity=".55" />
            <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="m16 9.5 5 5m0-5-5 5" />
          </svg>
          <svg v-else class="nav-sound-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M11 4.5 6.5 8H3.5a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h3L11 20.5v-16Z" />
            <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M15.5 9.2a4 4 0 0 1 0 5.6m2.6-8.2a7.4 7.4 0 0 1 0 10.4" />
          </svg>
        </button>
      </div>
    </div>

    <Transition name="nav-menu">
      <nav v-if="menuOpen" class="nav-mobile" aria-label="Features">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.href"
          :to="link.href"
          class="nav-mobile-link"
          @click="closeMenu"
        >
          <span v-html="linkIcons[link.href]" class="nav-mobile-icon" aria-hidden="true" />
          <span class="nav-mobile-label">{{ t(link.label) }}</span>
        </NuxtLink>
      </nav>
    </Transition>
  </header>
</template>

<style scoped>
.nav-bar {
  position: sticky;
  top: var(--frame-gutter);
  z-index: 50;
  height: 64px;
  flex: 0 0 auto;
}

/* Frosted band: blurs page content sliding under the header and fades out
   below it, matching the reference site's header::before treatment. */
.nav-bar::before {
  content: '';
  position: absolute;
  inset: 0 0 -125%;
  z-index: -1;
  pointer-events: none;
  background: var(--loli-surface);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  -webkit-mask-image: linear-gradient(#000, #000000f2 10%, #000000de 20%, #000000bf 30%, #00000094 40%, #0006 50%, #00000040 60%, #00000024 70%, #00000012 80%, #00000005 90%, #0000);
  mask-image: linear-gradient(#000, #000000f2 10%, #000000de 20%, #000000bf 30%, #00000094 40%, #0006 50%, #00000040 60%, #00000024 70%, #00000012 80%, #00000005 90%, #0000);
}

.nav-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  max-width: 96rem;
  padding: 0 1.5rem;
  margin: 0 auto;
}

.nav-brand {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.375rem 0.5rem;
  background: transparent;
  border: 0;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.nav-brand:hover {
  background: var(--loli-selection);
}

.nav-brand-icon {
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.nav-brand-text {
  font-size: 1.15rem;
  font-weight: 750;
  letter-spacing: 0;
  color: var(--text-color);
  white-space: nowrap;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.nav-link {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  height: 2.5rem;
  padding: 0 1rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: 0.75rem;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-link:hover,
.nav-link-active {
  color: var(--text-color);
  background: var(--loli-selection);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-star {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  height: 2.25rem;
  padding: 0 0.75rem;
  font-size: 0.8125rem;
  font-weight: 650;
  color: var(--text-color);
  text-decoration: none;
  background: var(--bg-card);
  border: 1px solid var(--loli-border);
  border-radius: 0.75rem;
  white-space: nowrap;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.nav-star:hover {
  border-color: var(--loli-pink);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.nav-star-count {
  display: inline-flex;
  align-items: center;
  min-width: 1.625rem;
  justify-content: center;
  padding: 0 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--loli-pink);
  background: var(--loli-selection);
  border-radius: 0.5rem;
  line-height: 1.4;
}

.nav-hamburger {
  position: relative;
  overflow: hidden;
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 2.5rem;
  height: 2.5rem;
  background: transparent;
  border: 0;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.nav-sound {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  background: transparent;
  border: 0;
  border-radius: 0.75rem;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-sound:hover {
  background: var(--loli-selection);
  color: var(--text-body);
}

.nav-sound[aria-pressed='true'] {
  color: var(--accent);
}

.nav-hamburger:hover {
  background: var(--loli-selection);
}

.nav-hamburger-line {
  display: block;
  width: 1.125rem;
  height: 2px;
  margin: 0 auto;
  background: var(--text-color);
  border-radius: 1px;
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.nav-hamburger-active .nav-hamburger-line:nth-child(1) {
  transform: translateY(6px) rotate(45deg);
}

.nav-hamburger-active .nav-hamburger-line:nth-child(2) {
  opacity: 0;
}

.nav-hamburger-active .nav-hamburger-line:nth-child(3) {
  transform: translateY(-6px) rotate(-45deg);
}

/* Takeover menu (the reference site's mobile pattern): a fixed panel
   filling the frame below the header, hiding the page content, with the
   links as large rounded icon tiles in a two-column grid. */
.nav-mobile {
  position: fixed;
  top: calc(var(--frame-gutter) + 64px);
  left: var(--frame-gutter);
  right: var(--frame-gutter);
  bottom: var(--frame-gutter);
  z-index: 45;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 1rem;
  padding: 1.25rem 1.5rem 1.5rem;
  background: var(--loli-surface);
  border-radius: 0 0 var(--frame-radius) var(--frame-radius);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.nav-mobile-link {
  position: relative;
  display: flex;
  align-items: flex-end;
  min-height: 9rem;
  padding: 1rem;
  font-family: 'droog', sans-serif;
  font-size: 1.0625rem;
  font-weight: 900;
  letter-spacing: 0;
  color: var(--text-color);
  text-decoration: none;
  border-radius: 1rem;
  background: var(--loli-cream);
  overflow: hidden;
  transition: background-color 0.2s ease;
}

.nav-mobile-link:hover {
  background: var(--loli-selection);
}

.nav-mobile-icon {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 2.75rem;
  height: 2.75rem;
  color: var(--text-muted);
  opacity: 0.4;
  pointer-events: none;
}

.nav-menu-enter-active,
.nav-menu-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.nav-menu-enter-from,
.nav-menu-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}

@media (max-width: 767px) {
  /* Mirror the reference mobile header: the brand reduces to its icon and
     the actions become a uniform run of 40px icon buttons (hamburger
     first). Hiding the brand text also ends the flex-shrink fight that
     used to clip it at narrow widths. */
  .nav-links,
  .nav-brand-text,
  .nav-star-label,
  .nav-star-count {
    display: none;
  }

  .nav-brand {
    width: 2.5rem;
    padding: 0;
    justify-content: center;
  }

  .nav-hamburger {
    display: flex;
    order: -1;
  }

  .nav-star {
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    justify-content: center;
    background: transparent;
    border: 0;
  }

  .nav-star:hover {
    box-shadow: none;
    background: var(--loli-selection);
  }
}
</style>
