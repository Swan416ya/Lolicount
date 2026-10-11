<script setup lang="ts">
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { FreeMode, Keyboard, Mousewheel } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'

gsap.registerPlugin(ScrollTrigger)

// Card row mirroring the reference site's CardCarousel: a free-mode swiper
// with centred slides on narrow screens, three per view from `sm` up,
// gradient edge fades, hover arrows and a scroll-triggered slide entrance.
interface CarouselItem {
  key: string
  title: string
  image: string
  to: string
}

const props = defineProps<{
  title: string
  moreLabel: string
  moreTo: string
  viewLabel: string
  items: CarouselItem[]
}>()

interface SwiperLike {
  isBeginning: boolean
  isEnd: boolean
  slidePrev: () => void
  slideNext: () => void
}

const modules = [FreeMode, Keyboard, Mousewheel]
const rootEl = ref<HTMLElement | null>(null)
const swiperRef = shallowRef<SwiperLike | null>(null)
const atStart = ref(true)
const atEnd = ref(false)
const loaded = ref<string[]>([])

const reduceMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const syncEdges = (instance?: SwiperLike | null): void => {
  const swiper = instance ?? swiperRef.value
  if (!swiper) return
  atStart.value = swiper.isBeginning
  atEnd.value = swiper.isEnd
}

const onSwiper = (instance: SwiperLike): void => {
  swiperRef.value = instance
  syncEdges(instance)
}

const goto = (direction: 'prev' | 'next'): void => {
  const swiper = swiperRef.value
  if (!swiper) return
  if (direction === 'prev') swiper.slidePrev()
  else swiper.slideNext()
}

const markLoaded = (key: string): void => {
  if (!loaded.value.includes(key)) loaded.value = [...loaded.value, key]
}

let context: gsap.Context | null = null

onMounted(() => {
  const root = rootEl.value
  if (!root) return
  const slides = root.querySelectorAll('.swiper-slide')
  if (!slides.length) return
  if (reduceMotion()) {
    gsap.set(slides, { opacity: 1, x: 0 })
    return
  }
  context = gsap.context(() => {
    gsap.fromTo(slides, { opacity: 0, x: 160 }, {
      opacity: 1,
      x: 0,
      duration: 1,
      stagger: 0.1,
      ease: 'cardReveal',
      scrollTrigger: {
        trigger: root.parentElement ?? root,
        start: 'top 85%',
        once: true,
      },
    })
  }, root)
})

onBeforeUnmount(() => {
  context?.revert()
  ScrollTrigger.getAll().forEach((trigger) => {
    if (trigger.trigger === rootEl.value?.parentElement) trigger.kill()
  })
})
</script>

<template>
  <section class="carousel-section">
    <div class="carousel-head">
      <h2 class="carousel-title droog">{{ props.title }}</h2>
      <NuxtLink :to="props.moreTo" class="carousel-more">
        <span>{{ props.moreLabel }}</span>
        <svg viewBox="0 0 256 256" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
        </svg>
      </NuxtLink>
    </div>

    <div ref="rootEl" class="carousel-root">
      <Swiper
        :modules="modules"
        :slides-per-view="1.6"
        :space-between="12"
        :centered-slides="true"
        :centered-slides-bounds="true"
        :watch-overflow="true"
        :free-mode="{ sticky: true }"
        :mousewheel="{ forceToAxis: true, releaseOnEdges: true }"
        :keyboard="{ enabled: true, onlyInViewport: true, pageUpDown: true }"
        :breakpoints="{ 640: { centeredSlides: false, slidesPerView: 3, spaceBetween: 24 } }"
        @swiper="onSwiper"
        @slide-change="syncEdges()"
        @reach-beginning="syncEdges()"
        @reach-end="syncEdges()"
        @from-edge="syncEdges()"
        @resize="syncEdges()"
      >
        <SwiperSlide v-for="item in props.items" :key="item.key">
          <NuxtLink :to="item.to" class="card">
            <span class="card-media">
              <img
                :src="item.image"
                :alt="item.title"
                loading="lazy"
                decoding="async"
                :class="{ 'is-loaded': loaded.includes(item.key) }"
                @load="markLoaded(item.key)"
              >
              <span class="card-overlay">
                <svg viewBox="0 0 256 256" width="26" height="26" aria-hidden="true">
                  <path fill="currentColor" d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.23,141.68,192.78,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z" />
                </svg>
                <span>{{ props.viewLabel }}</span>
              </span>
            </span>
          </NuxtLink>
        </SwiperSlide>
      </Swiper>

      <div class="carousel-edge carousel-edge-left" :class="{ 'is-shown': !atStart }" aria-hidden="true" />
      <div class="carousel-edge carousel-edge-right" :class="{ 'is-shown': !atEnd }" aria-hidden="true" />

      <button
        type="button"
        class="carousel-nav carousel-nav-prev"
        :class="{ 'is-shown': !atStart }"
        :aria-label="`${props.title} -`"
        @click="goto('prev')"
      >
        <svg viewBox="0 0 256 256" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
        </svg>
      </button>
      <button
        type="button"
        class="carousel-nav carousel-nav-next"
        :class="{ 'is-shown': !atEnd }"
        :aria-label="`${props.title} +`"
        @click="goto('next')"
      >
        <svg viewBox="0 0 256 256" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
        </svg>
      </button>
    </div>

    <div class="carousel-more-mobile">
      <NuxtLink :to="props.moreTo" class="carousel-more-mobile-link">
        <span>{{ props.moreLabel }}</span>
        <svg viewBox="0 0 256 256" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
        </svg>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.carousel-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-top: 2.75rem;
}

.carousel-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.25rem;
}

.carousel-title {
  margin: 0;
  font-size: 1.875rem;
  line-height: 1.1;
  color: var(--text-color);
  user-select: none;
}

.carousel-more {
  display: none;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem 1.25rem 1rem 1rem;
  font-size: 1rem;
  color: var(--text-color);
  text-decoration: none;
  border-radius: 0.75rem;
  transition: background-color 0.3s ease;
}

.carousel-more:hover {
  background: var(--loli-selection);
}

.carousel-more svg {
  transition: translate 0.2s ease;
}

.carousel-more:hover svg {
  translate: 2px 0;
}

.carousel-root {
  position: relative;
}

.carousel-root :deep(.swiper-slide) {
  height: auto;
}

.card {
  display: flex;
  height: 100%;
  flex-direction: column;
  gap: 0.5rem;
  color: inherit;
  text-decoration: none;
}

.card-media {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 0.75rem;
  background-color: var(--skeleton-0);
  animation: skeleton-cycle 1.6s ease-in-out infinite;
}

.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: scale 0.3s ease, opacity 0.3s ease;
}

.card-media img.is-loaded {
  opacity: 1;
}

.card:hover .card-media img {
  scale: 1.05;
}

.card-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: #fff;
  background: rgba(0, 0, 0, 0);
  opacity: 0;
  transition: opacity 0.3s ease, background-color 0.3s ease;
}

.card-overlay span {
  font-size: 1.125rem;
  font-weight: 600;
}

.card:hover .card-overlay {
  opacity: 1;
  background: rgba(0, 0, 0, 0.5);
}

.carousel-edge {
  position: absolute;
  inset-block: 0;
  z-index: 1;
  width: 3rem;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.carousel-edge.is-shown {
  opacity: 1;
}

.carousel-edge-left {
  left: 0;
  background: linear-gradient(to right, var(--loli-cream), transparent);
}

.carousel-edge-right {
  right: 0;
  background: linear-gradient(to left, var(--loli-cream), transparent);
}

.carousel-nav {
  position: absolute;
  top: 50%;
  z-index: 2;
  display: none;
  translate: 0 -50%;
  padding: 0.75rem;
  color: var(--text-color);
  background: none;
  border: 0;
  border-radius: 0.75rem;
  border-color: transparent;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.3s ease, visibility 0.3s ease, background-color 0.3s ease;
}

.carousel-nav.is-shown {
  visibility: visible;
  opacity: 1;
}

.carousel-nav:hover {
  background: var(--loli-selection);
}

.carousel-nav-prev {
  left: 0.5rem;
}

.carousel-nav-next {
  right: 0.5rem;
}

.carousel-more-mobile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 0.75rem;
}

.carousel-more-mobile-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  color: var(--text-color);
  text-decoration: none;
  border-radius: 0.75rem;
  transition: background-color 0.3s ease;
}

.carousel-more-mobile-link:hover {
  background: var(--loli-selection);
}

@media (min-width: 640px) {
  .carousel-head {
    flex-direction: row;
    align-items: center;
  }

  .carousel-title {
    font-size: 2.25rem;
  }

  .carousel-more {
    display: inline-flex;
  }

  .carousel-edge {
    width: 5rem;
  }

  .carousel-nav {
    display: block;
  }

  .carousel-more-mobile {
    display: none;
  }
}

@media (min-width: 1024px) {
  .carousel-title {
    font-size: 2.25rem;
  }
}
</style>
