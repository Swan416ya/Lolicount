<script setup lang="ts">
import type { ParamState } from '~/components/ParamPanel.vue'
import { gameMeta, themeMeta, buildSearchHaystack } from '~/utils/themeMeta'
import type { GameKey, ThemeKind } from '~/utils/themeMeta'

const { fetchThemes, fetchFThemes, fetchConfig, buildCounterUrl, publicBase } = useApi()
const { t, locale } = useI18n()

const themes = ref<ThemeInfo[]>([])
const fthemes = ref<string[]>([])

// Join the API theme list with local metadata. Themes missing metadata
// (e.g. added before the meta table is updated) still show up under
// the "other" game bucket.
const merged = computed(() =>
  themes.value.map((tth) => {
    const meta = themeMeta.find((m) => m.name === tth.name)
    return {
      ...tth,
      meta: meta ?? null,
      haystack: meta ? buildSearchHaystack(meta) : tth.name.toLowerCase(),
    }
  }),
)

// Filters + search state.
const gameFilter = ref<GameKey | 'all'>('all')
const kindFilter = ref<ThemeKind | 'all'>('all')
const searchQuery = ref('')

const filteredThemes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return merged.value.filter((tth) => {
    if (gameFilter.value !== 'all' && tth.meta?.gameKey !== gameFilter.value) return false
    if (kindFilter.value !== 'all' && tth.meta?.kind !== kindFilter.value) return false
    if (q && !tth.haystack.includes(q)) return false
    return true
  })
})

// Game filter options: only games that actually have themes, "other" last.
const gameOptions = computed(() => {
  const present = new Set(merged.value.map((tth) => tth.meta?.gameKey ?? 'other'))
  const keys = Object.keys(gameMeta) as GameKey[]
  return keys
    .filter((key) => present.has(key))
    .sort((a, b) => (a === 'other' ? 1 : b === 'other' ? -1 : keys.indexOf(a) - keys.indexOf(b)))
})

const gameLabel = (key: GameKey) => {
  const lang = (['zh', 'en', 'jp'] as const).includes(locale.value as 'zh' | 'en' | 'jp')
    ? (locale.value as 'zh' | 'en' | 'jp')
    : 'en'
  return gameMeta[key].label[lang]
}

const resultCount = computed(() => filteredThemes.value.length)

// Selected theme + preview with a cache-buster (same reload trick as the
// home page showcase: the back-end picks a random frame per request).
const selectedTheme = ref('')
const previewKey = ref(0)

const selectTheme = (name: string) => {
  selectedTheme.value = name
  state.theme = name
}

const previewUrl = computed(() => {
  if (!selectedTheme.value) return ''
  const base = buildCounterUrl({
    name: 'demo',
    theme: selectedTheme.value,
    number: 0,
    unshowf: true,
  })
  const key = previewKey.value
  return key > 0 ? `${D}{base}&_=${D}{key}` : base
})

const reloadPreview = () => {
  previewKey.value++
}

const selectedMeta = computed(() =>
  themeMeta.find((m) => m.name === selectedTheme.value) ?? null,
)

// Playground state, same shape as the home page so the generation flow
// (ParamPanel + generate + LinkOutput) stays identical.
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

onMounted(async () => {
  themes.value = await fetchThemes()
  fthemes.value = await fetchFThemes()
  const lianRen = themes.value.find((tth) => tth.name === 'lian-ren')
  selectedTheme.value = lianRen ? lianRen.name : (themes.value[0]?.name ?? '')
  state.theme = selectedTheme.value
  await fetchConfig()
})
</script>

<template>
  <main class="max-w-5xl mx-auto px-4 py-8 font-sans">
    <!-- Header -->
    <section class="mb-8">
      <h1 class="text-3xl font-bold text-loli-pink mb-2">{{ t('themesGallery.title') }}</h1>
      <p class="text-sm text-gray-600">{{ t('themesGallery.desc') }}</p>
    </section>

    <div class="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
      <!-- Left: filters + theme grid -->
      <div>
        <!-- Filter bar -->
        <section class="mb-6 rounded-xl bg-loli-cream p-4 space-y-3">
          <div class="flex flex-col sm:flex-row gap-3">
            <select
              v-model="gameFilter"
              class="flex-1 border rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-loli-pink/40 focus:border-loli-pink cursor-pointer transition"
            >
              <option value="all">{{ t('themesGallery.allGames') }}</option>
              <option v-for="key in gameOptions" :key="key" :value="key">
                {{ gameLabel(key) }}
              </option>
            </select>
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('themesGallery.searchPlaceholder')"
              class="flex-1 border rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-loli-pink/40 focus:border-loli-pink transition"
            />
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              v-for="opt in [
                { value: 'all', label: t('themesGallery.allKinds') },
                { value: 'card', label: t('themesGallery.kindCard') },
                { value: 'character', label: t('themesGallery.kindCharacter') },
              ]"
              :key="opt.value"
              type="button"
              :class="cn(
                'px-3 py-1.5 rounded-full text-sm transition border',
                kindFilter === opt.value
                  ? 'bg-loli-pink text-white border-loli-pink'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-loli-pink'
              )"
              @click="kindFilter = opt.value"
            >{{ opt.label }}</button>
            <span class="text-xs text-gray-500 ml-auto">{{ t('themesGallery.resultCount', { n: resultCount }) }}</span>
          </div>
        </section>

        <!-- Theme grid: click a card to select it (also syncs the playground). -->
        <section>
          <div v-if="filteredThemes.length" class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <button
              v-for="tth in filteredThemes"
              :key="tth.name"
              type="button"
              :class="cn(
                'rounded-xl border-2 p-3 text-left transition bg-white',
                selectedTheme === tth.name
                  ? 'border-loli-pink shadow-sm'
                  : 'border-transparent hover:border-loli-pink/40'
              )"
              @click="selectTheme(tth.name)"
            >
              <div class="rounded-lg bg-loli-cream flex items-center justify-center overflow-hidden mb-2 h-28">
                <img
                  :src="buildCounterUrl({ name: 'demo', theme: tth.name, number: 0, unshowf: true })"
                  :alt="tth.name"
                  class="max-h-24 object-contain"
                  loading="lazy"
                />
              </div>
              <p class="text-sm font-medium truncate">{{ tth.name }}</p>
              <p class="text-xs text-gray-500 truncate">
                {{ tth.meta ? tth.meta.character : t('themesGallery.unknownMeta') }}
              </p>
            </button>
          </div>
          <div v-else class="rounded-xl bg-loli-cream p-10 text-center text-sm text-gray-400">
            {{ t('themesGallery.noResults') }}
          </div>
        </section>
      </div>

      <!-- Right: preview + playground (sticky on desktop) -->
      <div class="lg:sticky lg:top-20 space-y-6">
        <!-- Preview panel -->
        <section class="rounded-xl bg-loli-cream p-4">
          <h2 class="text-lg font-semibold mb-3">{{ t('themesGallery.previewTitle') }}</h2>
          <div
            v-if="selectedTheme"
            class="cursor-pointer relative flex justify-center"
            :title="t('themes.reload')"
            @click="reloadPreview"
          >
            <img
              :src="previewUrl"
              :alt="selectedTheme"
              class="max-h-72 object-contain"
            />
          </div>
          <div v-else class="h-40 flex items-center justify-center text-sm text-gray-400">
            {{ t('loli.loading') }}
          </div>
          <div v-if="selectedMeta" class="mt-3 text-xs text-gray-500 space-y-1">
            <p>{{ t('themesGallery.gameLabel') }}: {{ gameLabel(selectedMeta.gameKey) }}</p>
            <p>{{ t('themesGallery.characterLabel') }}: {{ selectedMeta.character }}</p>
          </div>
          <p class="mt-2 text-xs text-gray-500">{{ t('themesGallery.previewHint') }}</p>
        </section>

        <!-- Playground -->
        <section class="rounded-xl bg-loli-cream p-4">
          <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
            <img src="/images/lolicount-icon.png" alt="" class="h-5 w-5" />
            {{ t('playground.title') }}
          </h2>
          <ParamPanel
            :state="state"
            :themes="themes"
            :fthemes="fthemes"
            @update="onUpdate"
          />
          <div class="relative mt-4">
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
          <div v-if="generatedUrl" class="mt-4 space-y-3">
            <div class="rounded-xl bg-white p-3 flex justify-center">
              <BgPreview :url="generatedPreviewUrl" :width="400" />
            </div>
            <LinkOutput :url="generatedUrl" :name="generatedName" />
          </div>
          <div v-else class="mt-4 rounded-xl bg-white p-3">
            <div class="h-24 flex flex-col items-center justify-center text-center text-xs text-gray-400">
              <p>{{ t('playground.emptyHint1') }}</p>
              <p>{{ t('playground.emptyHint2') }}</p>
            </div>
          </div>
        </section>
      </div>
    </div>

    <Site-footer />
    <BackToTop />
  </main>
</template>
