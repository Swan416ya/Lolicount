<script setup lang="ts">
import type { ParamState } from '~/components/ParamPanel.vue'

const { fetchThemes, fetchConfig, buildCounterUrl, publicBase } = useApi()
const { t } = useI18n()

const themes = ref<ThemeInfo[]>([])

// Quick start state: a minimal form (name + theme) for instant preview.
// Full theme browsing/filtering lives on the dedicated /themes page.
const state = reactive<ParamState>({
  name: '',
  theme: '',
  ftheme: '',
  fsize: 16,
  scale: 1,
  unshowf: true,
  x: undefined,
  y: undefined,
  rx: undefined,
  ry: undefined,
  number: 0,
  text: '{n}',
})

const onUpdate = (patch: Partial<ParamState>) => Object.assign(state, patch)

const nameEmpty = computed(() => !state.name.trim())

// Random theme sample for the quick start: 10 themes per visit, always a
// mix of static (SVG) and animated (emote) themes when both exist, so
// the home page never needs the full dropdown list.
const sampleSize = 10
const sampledThemes = ref<ThemeInfo[]>([])

const pickSample = (all: ThemeInfo[]): ThemeInfo[] => {
  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }
  const animated = shuffle(all.filter((tth) => tth.animated))
  const statics = shuffle(all.filter((tth) => !tth.animated))
  const half = Math.floor(sampleSize / 2)
  const animatedCount = all.length <= sampleSize
    ? animated.length
    : Math.min(animated.length, Math.max(1, Math.min(half, sampleSize - Math.min(statics.length, 1))))
  const picked = [...animated.slice(0, animatedCount), ...statics.slice(0, sampleSize - animatedCount)]
  return shuffle(picked)
}

const selectTheme = (name: string) => {
  state.theme = name
}

onMounted(async () => {
  themes.value = await fetchThemes()
  sampledThemes.value = pickSample(themes.value)
  state.theme = sampledThemes.value[0]?.name ?? 'wenders'
  await fetchConfig()
})

// Generate: same flow as before — the embed link uses the public domain
// and the live preview stays same-origin with a per-click cache buster
// so repeated clicks fetch a fresh SVG frame.
const generatedUrl = ref('')
const generatedName = ref('')
const generatedPreviewUrl = ref('')
const generateKey = ref(0)

const starBurst = ref<{ trigger: (x: number, y: number) => void } | null>(null)

const generate = (e: MouseEvent) => {
  const trimmed = state.name.trim()
  if (!trimmed) return
  starBurst.value?.trigger(e.clientX, e.clientY)
  const params: ParamState = { ...state }
  params.name = trimmed
  generatedUrl.value = buildCounterUrl(params, publicBase.value)
  generatedName.value = trimmed
  const preview = buildCounterUrl(params)
  generateKey.value += 1
  const sep = preview.includes('?') ? '&' : '?'
  generatedPreviewUrl.value = `${D}{preview}${D}{sep}_=_${D}{generateKey.value}`
}

// How-to-embed example URL with the literal name "name" and the public
// domain, so the sample links users copy point at the real origin.
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
    <section id="howto" class="mb-10 scroll-mt-20">
      <h2 class="text-2xl font-semibold mb-4">{{ t('howto.title') }}</h2>
      <p class="text-sm text-gray-600 mb-4">
        {{ t('howto.introPre') }}<a href="#quickstart" class="text-loli-pink underline">{{ t('howto.introLink') }}</a>{{ t('howto.introPost') }}
      </p>
      <p class="text-sm text-gray-500 mb-2">{{ t('howto.mdHint') }} ![name]({{ howToUrl }})</p>
      <pre class="text-sm text-gray-500 mb-2"></pre>
    </section>

    <!-- Quick start: name + random theme sample + generate, plus a link
         to the full theme gallery page for browsing/filtering. -->
    <section id="quickstart" class="mb-12 scroll-mt-20">
      <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
        <img src="/images/lolicount-icon.png" alt="" class="h-7 w-7" />
        {{ t('themesGallery.quickStart') }}
      </h2>
      <p class="text-sm text-gray-500 mb-4">{{ t('themesGallery.quickStartDesc') }}</p>

      <!-- Theme sample: random 10 per visit, mix of static + animated. -->
      <div class="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
        <button
          v-for="tth in sampledThemes"
          :key="tth.name"
          type="button"
          :title="tth.name"
          :class="cn(
            'rounded-lg p-2 transition text-center bg-white border',
            state.theme === tth.name
              ? 'border-loli-pink'
              : 'border-transparent hover:border-loli-pink/40'
          )"
          @click="selectTheme(tth.name)"
        >
          <div class="h-16 flex items-center justify-center overflow-hidden">
            <img
              :src="buildCounterUrl({ name: 'demo', theme: tth.name, number: 0, unshowf: true })"
              :alt="tth.name"
              class="max-h-14 object-contain"
              loading="lazy"
            />
          </div>
          <p class="text-[10px] text-gray-600 truncate mt-1">{{ tth.name }}</p>
          <span v-if="tth.animated" class="text-[9px] text-loli-pink font-medium">{{ t('themesGallery.kindAnimated') }}</span>
        </button>
      </div>

      <div class="rounded-xl border border-loli-cream bg-white p-4 space-y-4">
        <input
          v-model="state.name"
          type="text"
          :placeholder="t('param.namePlaceholder')"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-loli-pink/40 focus:border-loli-pink"
        />
        <div class="relative">
          <StarBurst ref="starBurst" />
          <button
            :disabled="nameEmpty"
            :class="cn(
              'relative w-full py-2 rounded-lg font-medium transition',
              nameEmpty
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-loli-pink text-white hover:bg-loli-pink/90'
            )"
            @click="generate($event)"
          >
            {{ nameEmpty ? t('param.nameEmpty') : t('playground.generate') }}
          </button>
        </div>
        <!-- Result: preview image + embed formats, shown after generation. -->
        <div v-if="generatedUrl" class="space-y-4">
          <div class="rounded-xl bg-loli-cream p-4 flex justify-center">
            <BgPreview :url="generatedPreviewUrl" :width="400" />
          </div>
          <h3 class="text-lg font-medium flex items-center gap-2">
            <img src="/images/lolicount-icon.png" alt="" class="h-5 w-5" />
            {{ t('embed.title') }}
          </h3>
          <LinkOutput :url="generatedUrl" :name="generatedName" />
        </div>
        <div v-else class="rounded-xl border border-loli-cream bg-loli-cream/50 p-4">
          <div class="h-24 flex flex-col items-center justify-center text-center text-sm text-gray-400">
            <p>{{ t('playground.emptyHint1') }}</p>
            <p>{{ t('playground.emptyHint2') }}</p>
          </div>
        </div>
      </div>
      <!-- Entry point to the dedicated theme gallery page -->
      <div class="mt-4 text-center">
        <NuxtLink
          to="/themes"
          class="inline-flex items-center gap-1 text-loli-pink font-medium hover:underline"
        >
          {{ t('themesGallery.browseThemes') }} →
        </NuxtLink>
      </div>
    </section>

    <Site-footer />
    <BackToTop />
  </main>
</template>
