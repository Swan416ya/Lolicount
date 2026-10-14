// Squash & stretch timing tables for the chanfoo-style entrances, ported
// from the reference site's desktop/mobile choreography. Shared by the home
// hero and the glyph playground page so both stay on the same timings.
export const FxTables = {
  desktop: {
    dropName: { launchY: -80, compressY: 0.6, compressX: 1.3, stretchY: 1.3, stretchX: 0.8, squashY: 0.7, squashX: 1.2 },
    avatar: { offsetY: 80, launchY: -120, compressY: 0.75, compressX: 1.1, squashY: 0.85, squashX: 1.25 },
    majors: { offsetY: 20, stretchY: 1.3, stretchX: 0.8, squashY: 0.7, squashX: 1.2 },
  },
  mobile: {
    dropName: { launchY: -56, compressY: 0.72, compressX: 1.21, stretchY: 1.21, stretchX: 0.86, squashY: 0.79, squashX: 1.14 },
    avatar: { offsetY: 56, launchY: -84, compressY: 0.82, compressX: 1.07, squashY: 0.9, squashX: 1.18 },
    majors: { offsetY: 14, stretchY: 1.21, stretchX: 0.86, squashY: 0.79, squashX: 1.14 },
  },
} as const

export type FxTable = (typeof FxTables)['desktop']

// Desktop uses the >=1024px column, matching the reference's breakpoint.
export const pickFxTable = (): FxTable =>
  window.matchMedia('(min-width: 1024px)').matches ? FxTables.desktop : FxTables.mobile
