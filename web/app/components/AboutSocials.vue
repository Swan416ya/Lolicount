<script setup lang="ts">
// Reference-style socials grid: a container-query grid where the first
// link takes a 2x2 tile and the rest are 2x1, each tile a surface card
// with the brand mark, the label and a hover arrow.
interface SocialLink {
  key: string
  label: string
  url: string
  priority: number
}

defineProps<{ title: string, links: SocialLink[] }>()
</script>

<template>
  <section class="socials">
    <div class="droog">
      <h2 class="section-title">{{ title }}</h2>
    </div>
    <div class="socials-grid">
      <a
        v-for="link in links"
        :key="link.key"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="social-tile"
        :class="`social-tile-${link.priority}`"
      >
        <span class="social-icon">
          <svg v-if="link.key === 'github'" viewBox="0 0 256 256" aria-hidden="true">
            <path fill="currentColor" d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24,40,40,0,0,0-40-40,8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.78,43.89,43.89,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.89,43.89,43.89,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.69A41.74,41.74,0,0,1,200,104Z" />
          </svg>
          <svg v-else-if="link.key === 'sponsor'" viewBox="0 0 256 256" aria-hidden="true">
            <path fill="currentColor" d="M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32ZM128,206.8C109.74,196.16,32,147.69,32,94A46.06,46.06,0,0,1,78,48c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,147.61,146.24,196.15,128,206.8Z" />
          </svg>
          <svg v-else-if="link.key === 'issues'" viewBox="0 0 256 256" aria-hidden="true">
            <path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
          </svg>
          <svg v-else-if="link.key === 'license'" viewBox="0 0 256 256" aria-hidden="true">
            <path fill="currentColor" d="M243.34,69.15a8,8,0,0,0-6.94-4H19.6a8,8,0,0,0-6.94,4,8.08,8.08,0,0,0,.3,8.24c11.52,19.44,17.4,39.88,17.4,61.61s-5.88,42.17-17.4,61.61a8.08,8.08,0,0,0-.3,8.24,8,8,0,0,0,6.94,4H236.4a8,8,0,0,0,6.94-4,8.08,8.08,0,0,0-.3-8.24c-11.52-19.44-17.4-39.88-17.4-61.61s5.88-42.17,17.4-61.61A8.08,8.08,0,0,0,243.34,69.15ZM221.09,132.8c0,20.54,4.94,40.72,14.28,60.16H20.63C30,173.52,34.91,153.34,34.91,132.8S30,92.08,20.63,72.64H235.37C226,93.28,221.09,113.46,221.09,132.8ZM144,132.8a16,16,0,1,1-16-16A16,16,0,0,1,144,132.8Z" />
          </svg>
          <svg v-else viewBox="0 0 256 256" aria-hidden="true">
            <path fill="currentColor" d="M232,56H152V32a16,16,0,0,0-16-16H48A16,16,0,0,0,32,32V200a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V72A16,16,0,0,0,232,56ZM48,32H136V48H48Zm160,168H48V64H208Zm-68-56a8,8,0,0,1-8,8H84a8,8,0,0,1,0-16h48A8,8,0,0,1,140,144Z" />
          </svg>
        </span>
        <span class="social-label">{{ link.label }}</span>
        <span class="social-arrow" aria-hidden="true">
          <svg viewBox="0 0 256 256" width="20" height="20">
            <path fill="currentColor" d="M224,104a8,8,0,0,1-16,0V59.32l-98.34,98.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Z" />
            <path fill="currentColor" d="M184,208H48V72h64a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H192a8,8,0,0,0,8-8V136a8,8,0,0,0-16,0Z" />
          </svg>
        </span>
      </a>
    </div>
  </section>
</template>

<style scoped>
.socials {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  container-type: inline-size;
}

.section-title {
  margin: 0;
  font-size: 1.875rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--text-color);
  user-select: none;
}

.socials-grid {
  display: grid;
  grid-auto-flow: row dense;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: calc((100cqw - 1.5rem) / 3);
  gap: 0.75rem;
  align-items: start;
  justify-content: start;
  padding-top: 0.75rem;
}

.social-tile {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 0.75rem;
  color: var(--text-color);
  text-decoration: none;
  background: var(--loli-surface);
  border-radius: 0.75rem;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto 1fr;
  transition: background-color 0.3s ease-out;
}

.social-tile:hover {
  background: var(--loli-border);
}

.social-icon {
  display: flex;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  grid-column-start: 1;
  grid-row-start: 1;
}

.social-icon svg {
  width: 100%;
  height: 100%;
}

.social-label {
  min-width: 0;
  align-self: end;
  overflow: hidden;
  font-size: 0.75rem;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  grid-column: 1 / span 2;
  grid-row-start: 2;
}

.social-arrow {
  display: none;
  justify-self: end;
  opacity: 0;
  grid-column-start: 2;
  grid-row-start: 1;
  transition: opacity 0.2s ease;
}

.social-tile:hover .social-arrow {
  opacity: 1;
}

@media (min-width: 640px) {
  .socials-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-auto-rows: calc((100cqw - 4.5rem) / 4);
    gap: 1.5rem;
  }

  .social-tile {
    padding: 1rem;
    border-radius: 1rem;
  }

  .social-icon {
    width: 1.75rem;
    height: 1.75rem;
  }

  .social-label {
    font-size: 0.875rem;
  }

  .social-arrow {
    display: inline-flex;
  }

  .social-tile-2 {
    grid-column: span 2;
  }

  .social-tile-3 {
    grid-column: span 2;
    grid-row: span 2;
  }

  .social-tile-3 .social-icon,
  .social-tile-3 .social-arrow {
    width: 2.25rem;
    height: 2.25rem;
  }

  .social-tile-3 .social-label {
    font-size: 1rem;
  }
}

@media (min-width: 768px) {
  .socials-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-auto-rows: calc((100cqw - 7.5rem) / 6);
  }
}

@media (min-width: 1024px) {
  .section-title {
    font-size: 2.25rem;
  }

  .socials-grid {
    grid-template-columns: repeat(8, minmax(0, 1fr));
    grid-auto-rows: calc((100cqw - 10.5rem) / 8);
  }

  .social-tile {
    border-radius: 0.75rem;
  }
}
</style>
