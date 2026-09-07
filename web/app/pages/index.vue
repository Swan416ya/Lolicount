<script setup lang="ts">
const { fetchThemes, fetchConfig, buildCounterUrl, publicBase } = useApi()
const { t } = useI18n()

const themes = ref<ThemeInfo[]>([])

// Unified theme showcase: list every registered theme. Static themes use
// the SVG endpoint, while animated models use the shared WebGL preview.
// Initialize the default before mount so SSG can render and request the
// static preview immediately.
const showcaseKey = ref(0)
const selectedShowcase = ref('lian-ren')

const showcaseAnimated = computed(() =>
  themes.value.some((tth) => tth.name === selectedShowcase.value && tth.animated),
)

onMounted(async () => {
  themes.value = await fetchThemes()
  // Default the showcase picker to "lian-ren" when available; fall back
  // to the first theme otherwise.
  if (!themes.value.some((tth) => tth.name === selectedShowcase.value)) {
    const lianRen = themes.value.find((tth) => tth.name === 'lian-ren')
    selectedShowcase.value = lianRen ? lianRen.name : (themes.value[0]?.name ?? '')
  }
  await fetchConfig()
})

const showcaseUrl = computed(() => {
  if (!selectedShowcase.value || showcaseAnimated.value) return ''
  const base = buildCounterUrl({
    name: 'demo',
    theme: selectedShowcase.value,
    number: 0,
    unshowf: true,
  })
  const key = showcaseKey.value
  return key > 0 ? `${base}&_=${key}` : base
})

const reloadShowcase = () => {
  showcaseKey.value++
}

const showcaseVariants = computed(() => {
  const found = themes.value.find((tth) => tth.name === selectedShowcase.value)
  return found?.variants ?? 0
})

// Collapsible themes section: click the header to toggle.
const themesExpanded = ref(true)

// How-to-embed example URL. Uses the literal name "name" and the public
// domain so the sample links users copy point at the real origin once
// publicBase resolves. Same builder as the playground, so the format
// stays consistent.
const howToUrl = computed(() =>
  buildCounterUrl({ name: 'name' }, publicBase.value),
)
</script>

<template>
  <main class="max-w-3xl mx-auto px-4 py-8 font-sans">

    <!-- Hero -->
    <section id="top" class="mb-12 text-center">
      <h1 class="text-5xl font-bold text-loli-pink mb-3 flex items-center justify-center gap-3">
        <img src="/images/lolicount-icon.png" alt="Lolicount" class="h-12 w-12" />
        {{ t('hero.title') }}
      </h1>
      <p class="text-gray-600">{{ t('app.desc') }}</p>
    </section>

    <!-- How to use -->
    <section id="howto" class="mb-16 scroll-mt-20">
      <h2 class="text-2xl font-semibold mb-4">{{ t('howto.title') }}</h2>
      <p class="text-sm text-gray-600 mb-4">
        {{ t('howto.introPre') }}<NuxtLink to="/themes" class="text-loli-pink underline">{{ t('howto.introLink') }}</NuxtLink>{{ t('howto.introPost') }}
      </p>
      <p class="text-sm text-gray-500 mb-2">{{ t('howto.mdHint') }} ![name]({{ howToUrl }})</p>
      <pre class="text-sm text-gray-500 mb-2"></pre>
    </section>

    <!-- Unified theme showcase: all themes in one section -->
    <section id="themes" class="mb-16 scroll-mt-20">
      <h2
        class="text-2xl font-semibold mb-4 cursor-pointer select-none flex items-center gap-2"
        @click="themesExpanded = !themesExpanded"
      >
        <span class="loli-toggle-icon">{{ themesExpanded ? '▼' : '▶' }}</span>
        {{ t('themes.title') }}
      </h2>
      <div v-show="themesExpanded">
        <p class="text-sm text-gray-500 mb-4">{{ t('themes.desc') }}</p>
        <div class="grid md:grid-cols-[200px_1fr] gap-8 items-start">
        <div>
          <label class="block text-sm font-medium mb-1">{{ t('themes.select') }}</label>
          <select
            v-model="selectedShowcase"
            class="w-full border rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-loli-pink/40 focus:border-loli-pink cursor-pointer transition"
          >
            <option v-for="tth in themes" :key="tth.name" :value="tth.name">
              {{ tth.animated ? `${tth.name} · ${t('param.animated')}` : tth.name }}{{ tth.variants ? ` (${tth.variants.toLocaleString()})` : '' }}
            </option>
          </select>
          <p class="text-xs text-gray-500 mt-2">{{ t('themes.reloadHint') }}</p>
        </div>
        <div
          :class="cn(
            'relative flex items-center justify-center rounded-xl bg-loli-cream p-4',
            showcaseAnimated ? 'h-[40rem]' : 'h-[27rem]',
          )"
        >
          <div
            v-if="selectedShowcase && !showcaseAnimated"
            class="flex h-full w-full cursor-pointer items-center justify-center"
            :title="t('themes.reload')"
            @click="reloadShowcase"
          >
            <img
              :src="showcaseUrl"
              :alt="selectedShowcase"
              class="h-full w-full object-contain"
            />
          </div>
          <div
            v-else-if="showcaseAnimated"
            class="flex h-full w-full cursor-pointer items-center justify-center"
            :title="t('themes.reload')"
            @click="reloadShowcase"
          >
            <EmotePreview
              :key="`${selectedShowcase}-${showcaseKey}`"
              :model="selectedShowcase"
              name="demo"
              text="0123456789"
            />
          </div>
          <span
            v-if="showcaseVariants > 0"
            class="absolute bottom-2 right-2 rounded-full bg-black/60 text-white text-xs px-2 py-0.5"
          >{{ t('themes.variants', { n: showcaseVariants.toLocaleString() }) }}</span>
          <div v-if="!selectedShowcase" class="h-full w-full flex items-center justify-center text-sm text-gray-400">
            {{ t('loli.loading') }}
          </div>
        </div>
      </div>
        <NuxtLink
          to="/themes"
          class="showcase-playground-link mt-4 flex w-full items-center justify-center rounded-lg bg-loli-pink px-4 py-3 text-center font-medium text-white transition hover:bg-loli-pink/90"
        >{{ t('themesGallery.browseThemes') }}</NuxtLink>
      </div>
    </section>

    <Site-footer />
    <BackToTop />
  </main>
</template>

<style scoped>
.loli-toggle-icon {
  font-size: 0.9rem;
  color: var(--loli-pink);
  transition: transform 0.2s;
}

.showcase-playground-link {
  box-sizing: border-box;
}
</style>
