<script setup lang="ts">
// StarPleaCard: the begging-mascot "give a star" card, shared by the
// about page (page closer) and the home page (below How to use). The
// stargazer count is fetched client-side via useGitHub (10-min
// localStorage cache, graceful offline fallback). The root carries no
// margins — parents pass their section spacing via class.
const { t } = useI18n()
const { stars, repoUrl, fetchStars, formatStars } = useGitHub()

onMounted(() => {
  fetchStars()
})
</script>

<template>
  <div class="rounded-2xl bg-loli-cream p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
    <img
      src="/images/plz.jpg"
      :alt="t('about.starAlt')"
      class="w-40 sm:w-52 rounded-2xl shadow-md -rotate-2 shrink-0"
      loading="lazy"
    />
    <div class="flex-1 text-center sm:text-left">
      <h2 class="text-2xl font-bold text-loli-pink mb-2">{{ t('about.starTitle') }}</h2>
      <p class="text-sm text-gray-600 mb-4">{{ t('about.starDesc') }}</p>
      <div class="flex flex-wrap items-center gap-3 justify-center sm:justify-start">
        <a
          :href="repoUrl"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-2 bg-loli-pink text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow hover:bg-loli-pink/90 transition"
        >
          <span>★</span> {{ t('about.starButton') }}
        </a>
        <span v-if="stars != null" class="text-sm text-gray-500">
          {{ t('about.starCount', { n: formatStars(stars) }) }}
        </span>
      </div>
    </div>
  </div>
</template>
