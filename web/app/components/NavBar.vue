<script setup lang="ts">
import gsap from 'gsap'
const { t, localeLabels } = useI18n()
const { toggle: toggleTheme } = useTheme()
const { stars, repoUrl, fetchStars, formatStars } = useGitHub()
const route = useRoute()

const isLinkActive = (href: string) => route.path === href || route.path.startsWith(href + '/')
const navLinks = [
  { href: '/', label: 'nav.playground', isRoute: true },
  { href: '/editor', label: 'nav.editor', isRoute: true },
  { href: '/about', label: 'nav.howAbout', isRoute: true },
] as const
const menuOpen = ref(false)

const closeMenu = () => {
  menuOpen.value = false
}

onMounted(() => {
  fetchStars()
})

onMounted(() => {
  gsap.from('.nav-link, .nav-actions', {
    opacity: 0,
    y: -24,
    duration: 0.5,
    stagger: 0.04,
    ease: 'power3.out',
  })
})
</script>

<template>
  <header class="nav-bar">
    <div class="nav-wrapper">
      <button type="button" class="nav-brand" :title="t('nav.theme')" @click="toggleTheme">
        <img src="/images/lolicount-icon.png" alt="Lolicount" class="nav-brand-icon" />
        <span class="nav-brand-text">Lolicount</span>
      </button>

      <nav class="nav-links" aria-label="Lolicount">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.href"
          :to="link.href"
          class="nav-link"
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
          :class="{ 'nav-hamburger-active': menuOpen }"
          :aria-label="t('nav.features')"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <span class="nav-hamburger-line"></span>
          <span class="nav-hamburger-line"></span>
          <span class="nav-hamburger-line"></span>
        </button>
      </div>
    </div>

    <Transition name="nav-menu">
      <nav v-if="menuOpen" class="nav-mobile">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.href"
          :to="link.href"
          class="nav-mobile-link"
          @click="closeMenu"
        >{{ t(link.label) }}</NuxtLink>
      </nav>
    </Transition>
  </header>
</template>

<style scoped>
.nav-bar {
  position: sticky;
  top: var(--app-gutter, 0.5rem);
  z-index: 50;
  height: 64px;
  flex: 0 0 auto;
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

.nav-mobile {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0 1.5rem 1rem;
}

.nav-mobile-link {
  display: flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0 1rem;
  font-size: 0.9375rem;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: 0.75rem;
  background: transparent;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-mobile-link:hover {
  color: var(--text-color);
  background: var(--loli-selection);
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
  .nav-links,
  .nav-star-label {
    display: none;
  }

  .nav-hamburger {
    display: flex;
  }

  .nav-star {
    padding: 0 0.625rem;
  }
}
</style>
