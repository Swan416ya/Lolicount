// Touch/coarse-pointer detection synced to the reference's media query
// "(hover: none) and (pointer: coarse)". Client-only: SSR falls back to
// false and the value reconciles as soon as the client evaluates the query.
import { onBeforeUnmount, ref, type Ref } from 'vue'

const TOUCH_MEDIA = '(hover: none) and (pointer: coarse)'

export const useIsTouch = (): Ref<boolean> => {
  const isTouch = ref(false)
  if (import.meta.client) {
    const mq = window.matchMedia(TOUCH_MEDIA)
    isTouch.value = mq.matches
    const onChange = (event: MediaQueryListEvent): void => {
      isTouch.value = event.matches
    }
    mq.addEventListener('change', onChange)
    onBeforeUnmount(() => mq.removeEventListener('change', onChange))
  }
  return isTouch
}
