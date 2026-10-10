<script setup lang="ts">
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { letterColorCss, letterColorTokens } from '~/composables/useLetterTokens'
// About page rebuilt on the reference site's about layout: a two-column
// intro (the Hi-I'm copy plus the how-to-embed block on the left, the
// big avatar with the Skills/Participations lists on the right), then
// Themes and Workshop card rows under big pale droog section
// watermarks, closed by the star plea, the back-to-top chibi and the
// shared footer. All copy comes from the i18n dictionary.
const { t } = useI18n()
const { fetchThemes, fetchHotThemes, buildCounterUrl, publicBase } = useApi()
const { repoUrl } = useGitHub()

// How-to-embed example URL. Same builder as the playground, so the
// sample links users copy point at the real origin once publicBase
// resolves.
const howToUrl = computed(() => buildCounterUrl({ name: 'name' }, publicBase.value))
const titleLetters = [...'Lolicount']
const titleColorTokens = letterColorTokens(titleLetters.length)
const letterColor = (index: number): string => letterColorCss(titleColorTokens[index] ?? 0)
const topTitleStackEl = ref<HTMLElement | null>(null)
const topSecondaryEl = ref<HTMLElement | null>(null)
const topTitleEl = ref<HTMLElement | null>(null)
const topPeriodEl = ref<HTMLElement | null>(null)
const topOverlayEl = ref<HTMLElement | null>(null)
const topAvatarEl = ref<HTMLElement | null>(null)
const topAvatarInnerEl = ref<HTMLElement | null>(null)
const topAlternate = ref(false)
const aboutDetailsEl = ref<HTMLElement | null>(null)
const aboutDetailsLeftEl = ref<HTMLElement | null>(null)
const aboutDetailsRightEl = ref<HTMLElement | null>(null)
const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
const showTopHero = (): void => {
  const secondary = topSecondaryEl.value
  const title = topTitleEl.value
  const period = topPeriodEl.value
  const avatar = topAvatarEl.value
  if (!secondary || !title || !period || !avatar) return
  if (prefersReducedMotion()) {
    gsap.set([secondary, title, period], { opacity: 1, y: 0 })
    gsap.set(avatar, { opacity: 1, y: 24, scale: 1 })
    return
  }
  gsap.fromTo(secondary, { opacity: 0, y: -50 }, { opacity: 1, y: 0, delay: 0.35, duration: 1, ease: 'cardReveal' })
  gsap.fromTo(title, { opacity: 0, y: -50 }, { opacity: 1, y: 0, delay: 0.25, duration: 1, ease: 'cardReveal' })
  gsap.fromTo(period, { opacity: 0, y: -50 }, { opacity: 1, y: 0, delay: 0.25, duration: 1, ease: 'cardReveal' })
  gsap.fromTo(avatar, { opacity: 0, y: 128, scale: 0.95 }, { opacity: 1, y: 24, scale: 1, delay: 0.75, duration: 0.4, ease: 'overshoot' })
}
const rotateAvatar = (rotation: number): void => {
  if (prefersReducedMotion()) return
  gsap.to(topAvatarInnerEl.value, { rotation, duration: 0.25, ease: 'overshoot', overwrite: 'auto' })
}
const toggleTopHero = (): void => {
  topAlternate.value = !topAlternate.value
  const active = topAlternate.value
  const titleStack = topTitleStackEl.value
  const overlay = topOverlayEl.value
  if (titleStack && overlay && !prefersReducedMotion()) {
    gsap.to(titleStack, { opacity: active ? 0 : 1, y: active ? -256 : 0, duration: 1, ease: 'cardReveal', overwrite: 'auto' })
    gsap.to(overlay, { opacity: active ? 1 : 0, y: active ? 0 : 256, duration: 1, ease: 'cardReveal', overwrite: 'auto' })
    return
  }
  if (titleStack && overlay) {
    gsap.set(titleStack, { opacity: active ? 0 : 1, y: active ? -256 : 0 })
    gsap.set(overlay, { opacity: active ? 1 : 0, y: active ? 0 : 256 })
  }
}
const bounceAvatar = (): void => {
  if (prefersReducedMotion() || !topAvatarInnerEl.value) return
  gsap.timeline({ defaults: { duration: 0.125, ease: 'overshoot' } })
    .fromTo(topAvatarInnerEl.value, { scale: 1 }, { scale: 0.9, overwrite: 'auto' })
    .to(topAvatarInnerEl.value, { scale: 1 })
}

const issuesUrl = `${repoUrl}/issues`
const contributeUrl = `${repoUrl}/blob/main/docs/contributing-themes.md`

// Skills bullets reuse the detail values the old page showed in cards.
const skills = computed(() => [
  t('about.stackValue'),
  t('about.deploymentValue'),
  `${t('about.license')}: AGPL-3.0`,
])

// Hot themes for the Themes card row; the workshop cards borrow the
// next hot names as preview art. Falls back to the full list when the
// hot endpoint is empty, and to no cards when the API is unreachable.
const hotCards = ref<{ name: string, animated?: boolean }[]>([])

// The workshop row borrows the next two hot names as preview art.
const workshopCards = computed(() => {
  if (hotCards.value.length < 5) return []
  return [
    { ...hotCards.value[3]!, title: 'Playground', to: '/' },
    { ...hotCards.value[4]!, title: 'Editor', to: '/editor' },
  ]
})

const thumb = (name: string, animated?: boolean): string =>
  `/images/${animated ? 'emote-thumbs' : 'theme-thumbs'}/${name}.webp`
let detailsContext: gsap.Context | null = null
const setupAboutDetails = (): void => {
  const root = aboutDetailsEl.value
  const left = aboutDetailsLeftEl.value
  const right = aboutDetailsRightEl.value
  if (!root || !left || !right) return
  const leftItems = left.querySelectorAll('.about-detail-item')
  const rightItems = right.querySelectorAll('.about-detail-item')
  const reveal = { opacity: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'power3.out' }
  if (prefersReducedMotion()) {
    gsap.set([leftItems, rightItems], { opacity: 1, y: 0 })
    return
  }
  detailsContext = gsap.context(() => {
    gsap.matchMedia().add({
      '(min-width: 768px)': () => {
        gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 85%', once: true } })
          .fromTo(leftItems, { opacity: 0, y: 60 }, reveal, 0)
          .fromTo(rightItems, { opacity: 0, y: 60 }, reveal, 0)
      },
      '(max-width: 767px)': () => {
        gsap.fromTo(leftItems, { opacity: 0, y: 60 }, { ...reveal, scrollTrigger: { trigger: left, start: 'top 85%', once: true } })
        gsap.fromTo(rightItems, { opacity: 0, y: 60 }, { ...reveal, scrollTrigger: { trigger: right, start: 'top 85%', once: true } })
      },
    })
  }, root)
}
const loadAboutCards = async (): Promise<void> => {
  try {
    const [all, hot] = await Promise.all([fetchThemes(), fetchHotThemes()])
    const names = hot.length > 0 ? hot : all.map((x) => x.name)
    hotCards.value = names.slice(0, 5).map((name) => all.find((x) => x.name === name) ?? { name })
  } catch {
    hotCards.value = []
  }
}

onMounted(() => {
  useEases()
  gsap.registerPlugin(ScrollTrigger)
  const { ready } = usePageReady()
  const playEntrance = () => {
    showTopHero()
    setupAboutDetails()
  }
  if (ready.value) playEntrance()
  else watch(ready, (value) => {
    if (value) playEntrance()
  })
  void loadAboutCards()
})

onBeforeUnmount(() => {
  detailsContext?.revert()
  gsap.killTweensOf([
    topTitleStackEl.value,
    topSecondaryEl.value,
    topTitleEl.value,
    topPeriodEl.value,
    topOverlayEl.value,
    topAvatarEl.value,
    topAvatarInnerEl.value,
  ])
})
</script>

<template>
  <main class="about-page">
    <!-- Intro: reference's two-column "About Me" + avatar/Skills block. -->
    <section class="about-top" aria-label="Lolicount">
      <div class="about-top-pattern" aria-hidden="true" />
      <div class="about-top-fade" aria-hidden="true" />
      <div class="about-top-inner">
        <div class="about-top-copy">
          <div class="about-top-title-area">
            <div ref="topTitleStackEl" class="about-top-title-stack">
              <p
                ref="topSecondaryEl"
                class="about-top-secondary"
                data-nojs-reveal
                style="opacity: 0; transform: translateY(-50px)"
              >Hi, I'm</p>
              <h1 class="about-top-title-row">
                <span
                  ref="topTitleEl"
                  class="about-top-title droog"
                  data-nojs-reveal
                  style="opacity: 0; transform: translateY(-50px)"
                >
                  <span
                    v-for="(letter, index) in titleLetters"
                    :key="`about-title-${index}`"
                    class="about-top-letter fade-color"
                    :style="{ color: letterColor(index), lineHeight: 1 }"
                  >{{ letter }}</span>
                </span>
                <span
                  ref="topPeriodEl"
                  class="about-top-title-period"
                  data-nojs-reveal
                  style="opacity: 0; transform: translateY(-50px)"
                >.</span>
              </h1>
            </div>
            <div
              ref="topOverlayEl"
              class="about-top-overlay"
              aria-live="polite"
              style="opacity: 0; transform: translateY(256px)"
            >
              <p class="about-top-secondary about-top-overlay-eyebrow">Counter</p>
              <p class="about-top-overlay-value droog">SVG</p>
              <div class="about-top-dots" aria-hidden="true">
                <span class="about-top-dot about-top-dot-active" />
                <span class="about-top-dot" />
                <span class="about-top-dot" />
                <span class="about-top-dot" />
              </div>
            </div>
          </div>
        </div>

        <div class="about-top-avatar-wrap">
          <div
            ref="topAvatarEl"
            class="about-top-avatar"
            data-nojs-reveal
            style="opacity: 0; transform: translateY(128px) scale(0.95)"
          >
            <div
              ref="topAvatarInnerEl"
              class="about-top-avatar-inner"
              tabindex="0"
              role="button"
              aria-label="Toggle counter format"
              @pointerenter="rotateAvatar(-6)"
              @pointerleave="rotateAvatar(0)"
              @click="bounceAvatar(); toggleTopHero()"
              @keydown.enter.prevent="bounceAvatar(); toggleTopHero()"
              @keydown.space.prevent="bounceAvatar(); toggleTopHero()"
            >
              <img src="/images/avatar.webp" alt="Lolicount" width="840" height="840" loading="lazy" decoding="async">
            </div>
          </div>
        </div>
      </div>
    </section>

    <section ref="aboutDetailsEl" class="about-details">
      <div ref="aboutDetailsLeftEl" class="about-details-left">
        <h2 class="about-detail-title droog about-detail-item" data-nojs-reveal>About Me</h2>
        <div class="about-detail-copy">
          <p class="about-detail-item" data-nojs-reveal>{{ t('about.desc') }}</p>
          <p class="about-detail-item" data-nojs-reveal>{{ t('about.stackValue') }}</p>
          <p class="about-detail-item" data-nojs-reveal>{{ t('about.deploymentValue') }}</p>
        </div>
        <div id="howto" class="hero-howto scroll-mt-20 about-detail-item" data-nojs-reveal>
          <p class="howto-text">
            {{ t('howto.introPre') }}<NuxtLink to="/" class="howto-link">{{ t('howto.introLink') }}</NuxtLink>{{ t('howto.introPost') }}
          </p>
          <p class="howto-hint">{{ t('howto.mdHint') }}</p>
          <code class="howto-code">![name]({{ howToUrl }})</code>
        </div>
      </div>

      <div ref="aboutDetailsRightEl" class="about-details-right">
        <h2 class="about-detail-title droog about-detail-item" data-nojs-reveal>Skills</h2>
        <div class="about-skill-group">
          <h3 class="about-subheading about-detail-item" data-nojs-reveal>{{ t('about.techStack') }}</h3>
          <ul class="side-list">
            <li v-for="skill in skills" :key="skill" class="about-detail-item" data-nojs-reveal>{{ skill }}</li>
          </ul>
        </div>
        <div class="about-skill-group">
          <h3 class="about-subheading about-detail-item" data-nojs-reveal>{{ t('about.contribute') }}</h3>
          <ul class="side-list">
            <li class="about-detail-item" data-nojs-reveal><a :href="issuesUrl" target="_blank" rel="noopener">{{ t('about.feedback') }}</a></li>
            <li class="about-detail-item" data-nojs-reveal><a :href="contributeUrl" target="_blank" rel="noopener">{{ t('about.contributeLink') }}</a></li>
            <li class="about-detail-item" data-nojs-reveal><a :href="repoUrl" target="_blank" rel="noopener">GitHub</a></li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Themes: the reference's Portfolios row. -->
    <section class="about-section reveal" data-reveal>
      <div class="section-head">
        <h2 class="section-watermark droog" aria-hidden="true">Themes</h2>
        <NuxtLink to="/" class="section-go">
          {{ t('about.goThemes') }}<span class="section-go-chevron" aria-hidden="true">›</span>
        </NuxtLink>
      </div>
      <div v-if="hotCards.length >= 3" class="card-grid">
        <NuxtLink
          v-for="card in hotCards.slice(0, 3)"
          :key="card.name"
          :to="`/?theme=${card.name}`"
          class="about-card"
        >
          <span class="card-media">
            <img :src="thumb(card.name, card.animated)" :alt="card.name" loading="lazy">
          </span>
          <span class="card-title">
            {{ card.name }}<span class="card-chevron" aria-hidden="true">›</span>
          </span>
        </NuxtLink>
      </div>
    </section>

    <!-- Workshop: the reference's Blogs row, mapped to the two tools. -->
    <section class="about-section reveal" data-reveal>
      <div class="section-head">
        <h2 class="section-watermark droog" aria-hidden="true">Workshop</h2>
        <NuxtLink to="/editor" class="section-go">
          {{ t('about.goEditor') }}<span class="section-go-chevron" aria-hidden="true">›</span>
        </NuxtLink>
      </div>
      <div v-if="workshopCards.length === 2" class="card-grid card-grid-two">
        <NuxtLink
          v-for="card in workshopCards"
          :key="card.title"
          :to="card.to"
          class="about-card"
        >
          <span class="card-media">
            <img :src="thumb(card.name, card.animated)" :alt="card.title" loading="lazy">
          </span>
          <span class="card-title">
            {{ card.title }}<span class="card-chevron" aria-hidden="true">›</span>
          </span>
        </NuxtLink>
      </div>
    </section>

    <StarPleaCard class="about-plea reveal" data-reveal />
    <BackToTop />
    <HomeFooter />
  </main>
</template>

<style scoped>
.about-page {
  width: 100%;
  margin: 0;
  padding: 0;
}

.about-top {
  position: relative;
  display: flex;
  min-height: 26.25rem;
  align-items: center;
  overflow: hidden;
  padding: 3.5rem 1.5rem;
  background: var(--loli-surface);
}

.about-top-pattern,
.about-top-fade {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.about-top-pattern {
  background-color: var(--loli-crust);
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
  -webkit-mask-image: url('/images/cross-pattern.svg');
  mask-image: url('/images/cross-pattern.svg');
  -webkit-mask-size: 120px 120px;
  mask-size: 120px 120px;
  -webkit-mask-position: center 30px;
  mask-position: center 30px;
  opacity: 0.24;
}

.about-top-fade {
  z-index: 1;
  background: linear-gradient(to bottom, var(--loli-surface), transparent 24%, transparent 76%, var(--loli-surface));
}

.about-top-inner {
  position: relative;
  z-index: 2;
  display: grid;
  width: min(64rem, 100%);
  margin: 0 auto;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 2rem;
}

.about-top-title-area {
  position: relative;
  min-height: 15rem;
}

.about-top-title-stack {
  position: relative;
  z-index: 1;
  will-change: transform, opacity;
}

.about-top-secondary {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  font-weight: 300;
  color: var(--text-muted);
}

.about-top-title-row {
  display: flex;
  align-items: baseline;
  margin: 0;
}

.about-top-title {
  display: flex;
  overflow: visible;
  font-size: clamp(4rem, 15vw, 9rem);
  line-height: 0.86;
  letter-spacing: 0;
  will-change: transform, opacity;
}

.about-top-letter {
  display: inline-block;
}

.about-top-title-period {
  color: var(--loli-pink);
  font-size: clamp(4rem, 15vw, 9rem);
  line-height: 0.86;
  will-change: transform, opacity;
}

.about-top-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  will-change: transform, opacity;
}

.about-top-overlay-eyebrow {
  margin-bottom: 0.5rem;
}

.about-top-overlay-value {
  margin: 0;
  font-size: clamp(4rem, 15vw, 9rem);
  line-height: 0.86;
  color: var(--text-color);
}

.about-top-dots {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.about-top-dot {
  width: 0.625rem;
  height: 0.625rem;
  background: var(--loli-border);
  border-radius: 999px;
}

.about-top-dot-active {
  background: var(--loli-pink);
}

.about-top-avatar-wrap {
  display: flex;
  justify-content: center;
}

.about-top-avatar {
  width: min(20rem, 100%);
  will-change: transform, opacity;
}

.about-top-avatar-inner {
  display: block;
  cursor: pointer;
  outline: none;
  will-change: transform;
}

.about-top-avatar-inner img {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(12px 12px 0 var(--loli-surface));
}

.about-top-avatar-inner:focus-visible {
  outline: 0.25rem solid var(--loli-pink);
  outline-offset: 0.25rem;
}

.about-details {
  display: grid;
  width: min(64rem, 100%);
  margin: 0 auto;
  padding: 3rem 1.5rem 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 3rem;
}

.about-detail-title {
  margin: 0 0 0.75rem;
  font-size: clamp(3rem, 9vw, 5.5rem);
  line-height: 0.95;
  color: var(--loli-border);
  user-select: none;
}

.about-detail-copy {
  margin-bottom: 1.5rem;
}

.about-detail-copy p {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  line-height: 1.75;
  color: var(--text-color);
}

.about-detail-item {
  opacity: 0;
  transform: translateY(60px);
}

.about-subheading {
  margin: 0 0 0.5rem;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--text-color);
}

.about-skill-group {
  margin-bottom: 1.5rem;
}

@media (min-width: 768px) {
  .about-details {
    grid-template-columns: 3fr 2fr;
    gap: 4rem;
  }
}

@media (min-width: 1024px) {
  .about-top {
    padding: 0 1.5rem;
  }

  .about-top-inner {
    grid-template-columns: minmax(0, 1fr) 26.25rem;
    gap: 4rem;
  }

  .about-top-avatar {
    width: 26.25rem;
  }
}

/* Big pale droog watermark headings, like the reference's section
   titles (About Me / Skills / Portfolios / Blogs). */
.section-watermark {
  margin: 0 0 0.75rem;
  font-size: clamp(3rem, 9vw, 5.5rem);
  line-height: 0.95;
  color: var(--loli-border);
  user-select: none;
}

.hero-howto {
  padding: 1rem 1.25rem;
  background: var(--loli-cream);
  border-radius: 1rem;
}

.howto-text {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--text-color);
}

.howto-link {
  font-weight: 650;
  color: var(--loli-pink);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.howto-hint {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.howto-code {
  display: block;
  padding: 0.625rem 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8125rem;
  color: var(--text-color);
  word-break: break-all;
  background: var(--loli-surface);
  border-radius: 0.5rem;
}

.side-list {
  margin: 0 0 1.5rem;
  padding-left: 1.125rem;
  list-style: none;
}

.side-list li {
  position: relative;
  margin-bottom: 0.375rem;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-color);
}

.side-list li::before {
  content: '';
  position: absolute;
  left: -1rem;
  top: 0.625rem;
  width: 0.375rem;
  height: 0.375rem;
  background: var(--loli-pink);
  border-radius: 999px;
}

.side-list a {
  color: var(--text-color);
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  transition: text-decoration-color 0.2s ease;
}

.side-list a:hover {
  text-decoration-color: currentColor;
}

.about-section {
  width: min(64rem, 100%);
  margin: 4.5rem auto 0;
  padding-right: 1.5rem;
  padding-left: 1.5rem;
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
}

.section-go {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.875rem;
  font-size: 0.9375rem;
  font-weight: 650;
  color: var(--text-color);
  text-decoration: none;
  border-radius: 0.75rem;
  transition: background-color 0.3s ease;
}

.section-go:hover {
  background: var(--loli-selection);
}

.section-go-chevron {
  font-size: 1.125rem;
  line-height: 1;
  transition: translate 0.2s ease;
}

.section-go:hover .section-go-chevron {
  translate: 2px 0;
}

/* Card rows, like the reference's portfolio/blog grid: 16:9 media that
   zooms slightly on hover, a title with a chevron that slides in. */
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.card-grid-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 767px) {
  .card-grid,
  .card-grid-two {
    grid-template-columns: 1fr;
  }
}

.about-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-decoration: none;
}

.card-media {
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--loli-cream);
  border-radius: 0.85rem;
}

.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: scale 0.3s ease;
}

.about-card:hover .card-media img {
  scale: 1.05;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.9375rem;
  font-weight: 650;
  color: var(--text-color);
}

.card-chevron {
  font-size: 1.125rem;
  line-height: 1;
  opacity: 0;
  translate: -4px 0;
  transition: opacity 0.2s ease, translate 0.2s ease;
}

.about-card:hover .card-chevron {
  opacity: 1;
  translate: 0 0;
}

.about-plea {
  width: min(64rem, 100%);
  margin: 4.5rem auto 0;
  padding-right: 1.5rem;
  padding-left: 1.5rem;
}
</style>
