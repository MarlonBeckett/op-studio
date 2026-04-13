// Chord-in-scale lookup — ported from components/scale/ScaleChords.vue in the
// chromatone.center repo, trimmed to what this standalone app needs.

import { ChordType } from 'tonal'
import { rotateArray } from './theory.js'

// ─────────────────────────────────────────────────────────────
// Complexity tiers: used by the UI to progressively reveal more
// chord voicings as the user wants them.
//
//   basic  → plain triads only (maj/min/dim/aug) — 7 per major scale
//   common → basic + everyday 7ths, sus, add9 (what pop/rock uses)
//   all    → every chord in Tonal's ChordType database that fits
// ─────────────────────────────────────────────────────────────

// NOTE: these must match Tonal's `ChordType.get(...).aliases[0]` exactly.
// Tonal uses 'M' / 'm' (not 'maj' / 'min') as the canonical first alias for
// major and minor triads — so that's what we filter on.
export const BASIC_ALIASES = ['M', 'm', 'dim', 'aug']

export const COMMON_ALIASES = [
  ...BASIC_ALIASES,
  // 7ths
  'maj7', 'm7', '7', 'dim7', 'm7b5',
  // 6ths
  '6', 'm6',
  // Suspensions
  'sus4', 'sus2',
  // 9ths
  'maj9', 'm9',
]

function complexityOf(alias) {
  if (BASIC_ALIASES.includes(alias)) return 'basic'
  if (COMMON_ALIASES.includes(alias)) return 'common'
  return 'all'
}

/**
 * Does a chord's chroma fit entirely inside a scale's chroma?
 * Both args are 12-char binary strings.
 */
export function chordFitsScale(scaleChroma, chordChroma) {
  const scl = scaleChroma.split('')
  const chr = chordChroma.split('')
  const len = chr.reduce((a, b) => Number(a) + Number(b), 0)
  if (len < 3) return false
  for (let i = 0; i < 12; i++) {
    if (chr[i] === '1' && scl[i] !== '1') return false
  }
  return true
}

/**
 * Find all chord types whose chroma fits in the given scale chroma.
 * The returned list is sorted to put common beginner-friendly chord types
 * first, and each chord is tagged with a `_complexity` level.
 */
export function findChords(chromaAtDegree) {
  const preferred = ['M', 'm', 'dim', 'aug', 'maj7', 'm7', '7', 'dim7', 'sus4', 'sus2', '6', 'm6']
  const all = ChordType.all().filter(c => c.chroma && chordFitsScale(chromaAtDegree, c.chroma))
  const tagged = all.map(c => {
    const alias = c.aliases?.[0] ?? c.name
    return { ...c, _complexity: complexityOf(alias) }
  })
  const score = (c) => {
    const alias = c.aliases?.[0] ?? c.name
    const idx = preferred.indexOf(alias)
    return idx === -1 ? 99 + c.intervals.length : idx
  }
  return tagged.sort((a, b) => score(a) - score(b))
}

/**
 * Return only chords at or below the requested complexity level.
 *   'basic'  → only BASIC
 *   'common' → BASIC + COMMON
 *   'all'    → everything
 */
export function filterByComplexity(chords, level) {
  if (level === 'all') return chords
  if (level === 'common') return chords.filter(c => c._complexity !== 'all')
  // default: basic
  return chords.filter(c => c._complexity === 'basic')
}

/**
 * For a given scale chroma, return a list of { offset, chords } per scale
 * degree. Returns every chord from Tonal's full ChordType database whose
 * notes all live inside the scale — no cap. Common triads and 7ths appear
 * first (see `findChords` for the sort order). Use `filterByComplexity` on
 * each degree's `chords` array to narrow the set for display.
 */
export function getDegreeChords(scaleChroma) {
  const offsets = []
  scaleChroma.split('').forEach((bit, i) => { if (bit === '1') offsets.push(i) })
  return offsets.map(offset => {
    const rotated = rotateArray(scaleChroma.split(''), offset).join('')
    return {
      offset,
      chords: findChords(rotated),
    }
  })
}

/**
 * Get the MIDI note numbers for a chord with a given root pitch class (0..11 from A).
 * Returns an array of MIDI note numbers in the 4th octave range.
 *
 * Ported from use/chroma.js getChromaNotes: A3 = MIDI 57, then add the
 * bitmask offsets rotated so `tonic` is the effective root.
 */
export function getChromaNotes(chroma, tonic, octave = 0) {
  const base = 57 + tonic + octave * 12
  return chroma.split('')
    .map((bit, i) => (bit === '1' ? base + i : null))
    .filter(n => n !== null)
}
