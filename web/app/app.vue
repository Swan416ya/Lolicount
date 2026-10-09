<script setup lang="ts">
const { init: initLocale } = useI18n()
const { init: initTheme } = useTheme()
onMounted(() => {
  initLocale()
  initTheme()
})
</script>

<template>
  <div class="app-frame">
    <NavBar />
    <NuxtPage />
  </div>
</template>

<style scoped>
.app-frame {
  --app-gutter: 0.5rem;
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 2 * var(--app-gutter));
  margin: var(--app-gutter);
  overflow: visible;
  background: var(--loli-surface);
  border-bottom-left-radius: 1.5rem;
  border-bottom-right-radius: 1.5rem;
}

@media (min-width: 768px) {
  .app-frame {
    --app-gutter: 0.75rem;
    border-radius: 1.5rem;
  }
}
</style>
