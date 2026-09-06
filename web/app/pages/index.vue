<script setup lang="ts">
import type { ParamState } from '~/components/ParamPanel.vue'

const { fetchThemes, fetchConfig, buildCounterUrl, publicBase } = useApi()
const { t } = useI18n()

const themes = ref<ThemeInfo[]>([])

// Quick start state: a minimal form (name + theme) for instant preview.
// Full theme browsing/filtering lives on the dedicated /themes page.
const state = reactive<ParamState>({
  name: '',
  theme: 'wenders',
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

onMounted(async () => {
  themes.value = await fetchThemes()
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
    <section id="howto" class="mb-12 scroll-mt-20">
      <h2 class="text-2xl font-semibold mb-4">{{ t('howto.title') }}</h2>
      <p class="text-sm text-gray-600 mb-4">
        {{ t('howto.introPre') }}<a href="#quickstart" class="text-loli-pink underline">{{ t('howto.introLink') }}</a>{{ t('howto.introPost') }}
      </p>
      <p class="text-sm text-gray-500 mb-2">{{ t('howto.mdHint') }} ![name]({{ howToUrl }})</p>
      <pre class="text-sm text-gray-500 mb-2"></pre>
    </section>

    <!-- Quick start: name + theme + generate, plus a link to the full
         theme gallery page for browsing/filtering all themes. -->
    <section id="quickstart" class="mb-12 scroll-mt-20">
      <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
        <img src="/images/lolicount-icon.png" alt="" class="h-7 w-7" />
        {{ t('themesGallery.quickStart') }}
      </h2>
      <p class="text-sm text-gray-500 mb-4">{{ t('themesGallery.quickStartDesc') }}</p>
      <div class="rounded-xl bg-loli-cream p-4 space-y-4">
        <div class="grid sm:grid-cols-[1fr_200px] gap-3">
          <input
            v-model="state.name"
            type="text"
            :placeholder="t('param.namePlaceholder')"
            class="border-2 border-loli-pink rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-loli-pink/40"
          />
          <select
            v-model="state.theme"
            class="border rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-loli-pink/40 focus:border-loli-pink cursor-pointer transition"
          >
            <option v-for="tth in themes" :key="tth.name" :value="tth.name">
              {{ tth.name }}{{ tth.variants ? ` (${tth.variants.toLocaleString()})` : '' }}
            </option>
          </select>
        </div>
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
          <div class="rounded-xl bg-white p-4 flex justify-center">
            <BgPreview :url="generatedPreviewUrl" :width="400" />
          </div>
          <h3 class="text-lg font-medium flex items-center gap-2">
            <img src="/images/lolicount-icon.png" alt="" class="h-5 w-5" />
            {{ t('embed.title') }}
          </h3>
          <LinkOutput :url="generatedUrl" :name="generatedName" />
        </div>
        <div v-else class="rounded-xl bg-white p-4">
          <div class="h-32 flex flex-col items-center justify-center text-center text-sm text-gray-400">
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
