<script setup lang="ts">
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

onMounted(async () => {
  try {
    const [all, hot] = await Promise.all([fetchThemes(), fetchHotThemes()])
    const names = hot.length > 0 ? hot : all.map((x) => x.name)
    hotCards.value = names.slice(0, 5).map((name) => all.find((x) => x.name === name) ?? { name })
  } catch {
    hotCards.value = []
  }
})
</script>

<template>
  <main class="about-page">
    <!-- Intro: reference's two-column "About Me" + avatar/Skills block. -->
    <section class="about-hero reveal" data-reveal>
      <div class="about-hero-copy">
        <h2 class="section-watermark droog" aria-hidden="true">About Me</h2>
        <p class="hero-hi">Hi, I'm</p>
        <h1 class="hero-name droog">Lolicount</h1>
        <p class="hero-badge">SVG Counter</p>
        <p class="hero-desc">{{ t('about.desc') }}</p>

        <div id="howto" class="hero-howto scroll-mt-20">
          <p class="howto-text">
            {{ t('howto.introPre') }}<NuxtLink to="/" class="howto-link">{{ t('howto.introLink') }}</NuxtLink>{{ t('howto.introPost') }}
          </p>
          <p class="howto-hint">{{ t('howto.mdHint') }}</p>
          <code class="howto-code">![name]({{ howToUrl }})</code>
        </div>
      </div>

      <div class="about-hero-side">
        <img src="/images/avatar.webp" alt="Lolicount" class="about-avatar" width="420" height="420">
        <h2 class="section-watermark droog" aria-hidden="true">Skills</h2>
        <h3 class="side-title">{{ t('about.techStack') }}</h3>
        <ul class="side-list">
          <li v-for="skill in skills" :key="skill">{{ skill }}</li>
        </ul>
        <h3 class="side-title">{{ t('about.contribute') }}</h3>
        <ul class="side-list">
          <li><a :href="issuesUrl" target="_blank" rel="noopener">{{ t('about.feedback') }}</a></li>
          <li><a :href="contributeUrl" target="_blank" rel="noopener">{{ t('about.contributeLink') }}</a></li>
          <li><a :href="repoUrl" target="_blank" rel="noopener">GitHub</a></li>
        </ul>
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
  max-width: 64rem;
  margin: 0 auto;
  padding: 2rem 1.5rem 0;
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

.about-hero {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .about-hero {
    grid-template-columns: 1.1fr 0.9fr;
    gap: 4rem;
  }
}

.hero-hi {
  margin-bottom: 0.25rem;
  font-size: 1.25rem;
  font-weight: 300;
  color: var(--text-muted);
}

.hero-name {
  margin: 0 0 0.75rem;
  font-size: clamp(2.75rem, 7vw, 4.25rem);
  line-height: 1;
  color: var(--text-color);
}

.hero-badge {
  display: inline-flex;
  margin-bottom: 1.25rem;
  padding: 0.25rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--text-muted);
  border: 1px solid var(--loli-border);
  border-radius: 999px;
}

.hero-desc {
  max-width: 34rem;
  margin: 0 0 1.5rem;
  font-size: 1rem;
  line-height: 1.75;
  color: var(--text-color);
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

.about-avatar {
  width: min(420px, 100%);
  height: auto;
  margin-bottom: 1.5rem;
}

.side-title {
  margin: 0 0 0.5rem;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--text-color);
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
  margin-top: 4.5rem;
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
  margin-top: 4.5rem;
}
</style>
