// Deterministic letter color tokens, replicating the reference site's LCG
// (seed 42, multiplier 1664525, increment 1013904223) over the three text
// tokens. Wordmark letters get a per-word array with a "no adjacent repeat"
// rule; physics-spawned glyphs use a stateless incrementing counter, exactly
// like the reference's two color generators.
const TOKENS = ['body', 'subtext-0', 'subtext-1'] as const

const lcgStep = (value: number): number => (Math.imul(value, 1664525) + 1013904223) | 0

// Per-letter token indices for a word of the given length.
export const letterColorTokens = (length: number): number[] => {
  let t = 42
  let prev = -1
  return Array.from({ length }, () => {
    t = lcgStep(t)
    let index = (t >>> 16) % TOKENS.length
    if (index === prev) index = (index + 1) % TOKENS.length
    prev = index
    return index
  })
}

// CSS color for the token at a given per-letter index.
export const letterColorCss = (index: number): string => `var(--token-${TOKENS[index] ?? 0})`

let spawnCounter = 0

// Next token color for a physics-spawned glyph (stateless LCG over the
// spawn counter, mirroring the reference's generator).
export const spawnTokenColor = (): string => {
  spawnCounter += 1
  const t = (Math.imul(42 + spawnCounter, 1664525) + 1013904223) | 0
  return `var(--token-${TOKENS[(t >>> 16) % TOKENS.length]})`
}
