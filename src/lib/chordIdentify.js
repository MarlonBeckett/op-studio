// Reverse chord lookup: "I know the shape I'm holding on the OP-1 keyboard,
// but I don't know what it's called." Takes a set of tapped MIDI notes and
// returns chord matches in two tiers:
//
//   1. inKey  — full chord tiles from `chordCards` whose pitch-class set
//               exactly equals the tapped set. These are rich objects with
//               descriptions, mood, colors, and the same add/play actions
//               as the main chord strip.
//   2. other  — raw chord names from Tonal's Chord.detect(), for shapes
//               that don't happen to be diatonic to the current key
//               (borrowed chords, chromatic voicings, inversions).
//
// Also returns a human-readable `interval` label when exactly two notes are
// tapped, and a `hint` string for the empty / one-note / zero-match cases.

import { Chord, Interval } from 'tonal'
import { notes as noteNames } from './theory.js'

// MIDI number → pitch class in A=0 indexing (matches theory.js `notes`).
// MIDI 57 = A4, so pitch class = (midi - 57) mod 12.
function midiToPitchClass(midi) {
  return ((midi - 57) % 12 + 12) % 12
}

// A=0 pitch class → note name Tonal understands (uses sharps, C-indexed).
// theory.js is A-indexed with sharps already, so we just look it up.
// Tonal accepts "C", "C#", "D", etc. so no conversion needed beyond the table.
function midiToTonalNote(midi) {
  const pc = midiToPitchClass(midi)
  return noteNames[pc]
}

// Build the canonical pitch-class set from a collection of MIDI numbers.
// Returns a Set<number> where each element is in [0, 11].
function midisToPcSet(midis) {
  const out = new Set()
  for (const m of midis) out.add(midiToPitchClass(m))
  return out
}

// Set equality for small pitch-class sets.
function pcSetsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

/**
 * Given a set of tapped MIDI notes and the current `chordCards` list (from
 * OpStudio.vue's computed), return {
 *   inKey:    ChordCard[] — exact pitch-class matches in the current key,
 *   other:    string[]    — Tonal chord names (may overlap with inKey by root),
 *   interval: string|null — human label when exactly two notes are tapped,
 *   hint:     string|null — user-facing hint for degenerate cases,
 * }
 *
 * Pass `tapped` as an iterable of MIDI numbers (Set, Array, whatever).
 */
export function identifyChord(tapped, chordCards) {
  const midis = Array.from(tapped)
  const empty = { inKey: [], other: [], interval: null, hint: null }

  if (midis.length === 0) {
    return { ...empty, hint: 'tap keys to identify a chord' }
  }
  if (midis.length === 1) {
    return { ...empty, hint: 'tap at least 2 notes' }
  }

  const tappedPcSet = midisToPcSet(midis)

  // Two-note case: show interval name as a friendly fallback.
  let intervalLabel = null
  if (tappedPcSet.size === 2) {
    const [a, b] = [...midis].sort((x, y) => x - y)
    const loName = midiToTonalNote(a)
    const hiName = midiToTonalNote(b)
    // Tonal's Interval.distance wants note names with octaves — use midi math
    // directly: semitone distance → interval name via Interval.fromSemitones.
    const semis = b - a
    const ivl = Interval.fromSemitones(semis)
    intervalLabel = ivl ? `${loName} → ${hiName} · ${ivl}` : null
  }

  // Stage 1: exact pitch-class match against in-key chord cards.
  // A chord card's pitch-class set = its `pitches` array (already reduced mod 12).
  const inKey = []
  const seen = new Set()
  for (const card of chordCards) {
    const cardPcSet = new Set(card.pitches)
    if (pcSetsEqual(cardPcSet, tappedPcSet)) {
      if (!seen.has(card.id)) {
        inKey.push(card)
        seen.add(card.id)
      }
    }
  }

  // Stage 2: Tonal's chord-detect over the raw note names, for out-of-key
  // and inversion-aware matches.
  const uniqueNoteNames = []
  const seenPc = new Set()
  for (const m of midis) {
    const pc = midiToPitchClass(m)
    if (seenPc.has(pc)) continue
    seenPc.add(pc)
    uniqueNoteNames.push(noteNames[pc])
  }
  // Tonal.detect is order-sensitive: the first note is treated as the bass.
  // Pass notes sorted by MIDI so the lowest tapped note anchors the detection.
  const sortedLowestFirst = [...midis]
    .sort((a, b) => a - b)
    .map(midiToTonalNote)
  // De-dupe while preserving order.
  const bassOrderedUnique = []
  const seenBass = new Set()
  for (const n of sortedLowestFirst) {
    if (seenBass.has(n)) continue
    seenBass.add(n)
    bassOrderedUnique.push(n)
  }
  let detected = []
  try {
    detected = Chord.detect(bassOrderedUnique) || []
  } catch {
    detected = []
  }

  const other = detected

  let hint = null
  if (inKey.length === 0 && other.length === 0 && !intervalLabel) {
    hint = 'no chord matches — try adding or removing a note'
  }

  return { inKey, other, interval: intervalLabel, hint }
}
