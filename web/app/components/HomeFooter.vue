<script setup lang="ts">
import gsap from 'gsap'
const { repoUrl } = useGitHub()
const year = new Date().getFullYear()

const menuLinks = [
  { label: 'Playground', to: '/' },
  { label: 'Editor', to: '/editor' },
  { label: 'About', to: '/about' },
]

const helpLinks = [
  { label: 'GitHub', href: repoUrl },
  { label: 'Issues', href: `${repoUrl}/issues` },
  { label: 'Contributing', href: `${repoUrl}/blob/main/docs/contributing-themes.md` },
]

const footerRoot = ref<HTMLElement | null>(null)

onMounted(() => {
  if (!footerRoot.value) return
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      gsap.from('.footer-column, .footer-brand', {
        opacity: 0,
        y: 32,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power3.out',
      })
      observer.disconnect()
    })
  }, { threshold: 0.2 })
  observer.observe(footerRoot.value)
})
</script>

<template>
  <footer ref="footerRoot" class="home-footer">
    <div class="footer-inner">
      <div class="footer-columns">
        <nav class="footer-column" aria-label="Site">
          <h2>Menu</h2>
          <NuxtLink v-for="link in menuLinks" :key="link.label" :to="link.to">
            {{ link.label }}
          </NuxtLink>
        </nav>

        <nav class="footer-column" aria-label="Help">
          <h2>Help</h2>
          <a
            v-for="link in helpLinks"
            :key="link.label"
            :href="link.href"
            target="_blank"
            rel="noopener"
          >{{ link.label }}</a>
        </nav>
      </div>

      <div class="footer-brand">
        <div>
          <p class="footer-title droog">Lolicount</p>
          <p class="footer-copy">© {{ year }} Lolicount contributors</p>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.home-footer {
  padding: 3rem 1.5rem;
  background: var(--loli-crust);
}

.footer-inner {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  width: min(100%, 72rem);
  margin: 0 auto;
}

.footer-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2rem;
}

.footer-column {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.footer-column h2 {
  margin-bottom: 0.25rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-color);
}

.footer-column a {
  font-size: 0.9rem;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-column a:hover {
  color: var(--text-color);
}

.footer-brand {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.footer-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-color);
}

.footer-copy {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

@media (min-width: 768px) {
  .footer-inner {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-end;
  }

  .footer-columns {
    grid-template-columns: repeat(2, minmax(0, 10rem));
    gap: 4rem;
  }
}
</style>
