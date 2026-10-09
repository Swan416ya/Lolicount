import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

// Custom easings ported from the reference site, registered once on the
// client. The cssEase* / cardReveal curves are cubic-bezier quartets and
// `overshoot` is a CustomEase path (GSAP >= 3.13 ships CustomEase for free).

let registered = false

const registerEases = (): void => {
  if (registered || typeof window === 'undefined') return
  gsap.registerPlugin(CustomEase)
  CustomEase.create('cardReveal', '0.16,1,0.3,1')
  CustomEase.create('cssEaseIn', '0.42,0,1,1')
  CustomEase.create('cssEaseOut', '0,0,0.58,1')
  CustomEase.create('cssEaseInOut', '0.42,0,0.58,1')
  CustomEase.create('overshoot', 'M0,0 C0.34,1.56 0.64,1 1,1')
  registered = true
}

const useEases = () => {
  registerEases()
  return { registerEases }
}

export default useEases
