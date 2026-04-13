<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'

import { notes as noteNames, SCALE_LIST } from './lib/theory.js'
import { noteColor } from './lib/colors.js'
import {
  getDegreeChords,
  getChromaNotes,
  filterByComplexity,
} from './lib/chordFinder.js'
import { ensureAudio, playNote, stopNote, playNoteOnce } from './lib/audio.js'
import {
  SCALE_INFO,
  CHORD_INFO,
  FALLBACK_CHORD,
  FALLBACK_SCALE,
} from './lib/descriptions.js'
import { getProgressionTableFor } from './lib/progressions.js'

// ══════════════════════════════════════════════════════════════
//   State — just "what key/scale am I looking at"
// ══════════════════════════════════════════════════════════════

const tonic = ref(Number(localStorage.getItem('opstudio-tonic') ?? 3)) // default C
const scaleChroma = ref(localStorage.getItem('opstudio-scale') ?? '101011010101') // major
const complexity = ref(localStorage.getItem('opstudio-complexity') ?? 'basic') // 'basic' | 'common' | 'all'

function setTonic(p) {
  tonic.value = p
  localStorage.setItem('opstudio-tonic', p)
  heldChord.value = null
  progression.value = makeEmptyProgression()
}
function setScale(c) {
  scaleChroma.value = c
  localStorage.setItem('opstudio-scale', c)
  heldChord.value = null
  progression.value = makeEmptyProgression()
}
function setComplexity(level) {
  complexity.value = level
  localStorage.setItem('opstudio-complexity', level)
}

const COMPLEXITY_TABS = [
  { id: 'basic',  label: 'BASIC',  hint: 'triads only' },
  { id: 'common', label: 'COMMON', hint: '+ 7ths, sus, add9' },
  { id: 'all',    label: 'ALL',    hint: 'everything' },
]

// ══════════════════════════════════════════════════════════════
//   Derived scale info
// ══════════════════════════════════════════════════════════════

// Pitch classes (0..11 from A) in the current scale, rooted on tonic.
const scalePitches = computed(() => {
  const out = []
  scaleChroma.value.split('').forEach((bit, i) => {
    if (bit === '1') out.push((tonic.value + i) % 12)
  })
  return out
})

const scalePitchSet = computed(() => new Set(scalePitches.value))

const currentScaleLabel = computed(() => {
  const match = SCALE_LIST.find(s => s.chroma === scaleChroma.value)
  return match?.label ?? 'CUSTOM'
})

// Short "how a beginner writes it on paper" label for a given chord alias.
// '' / 'M' → just the root (C), 'm' → Cm, 'dim' → Cdim, otherwise root+alias.
function suffixFor(alias) {
  if (!alias || alias === 'M') return ''
  return alias
}

// Build a small wrapper around a chord + a scale degree that the template
// can render as a tile.
//
// `voicings` is the key idea: rather than lighting every keyboard note that
// matches the chord's pitch classes (which pulls in stray octaves and makes
// the user's eye try to build a chord out of unrelated keys), we compute the
// *complete* close-position voicings that actually fit inside the visible
// 2-octave keyboard range. Each voicing is a set of MIDI notes — root + its
// chord tones stacked upward from a specific root octave. Any voicing where
// even one tone would fall outside [BASE_MIDI_F, BASE_MIDI_F + OCTAVES*12 - 1]
// is dropped entirely, so the user never sees a partial ghost.
function buildChordCard(chord, degreeOffset) {
  const rootPitch = (tonic.value + degreeOffset) % 12
  const alias = chord.aliases?.[0] || chord.name || ''

  // Semitone intervals from the root, in the chroma's natural order.
  const intervals = []
  chord.chroma.split('').forEach((bit, i) => { if (bit === '1') intervals.push(i) })

  // Lowest & highest MIDI notes visible on the main keyboard (F3..E5 inclusive).
  const kbdLow = BASE_MIDI_F                     // F3 = 53
  const kbdHigh = BASE_MIDI_F + OCTAVES * 12 - 1 // E5 = 76

  // Find every root-MIDI placement where the entire close-position voicing
  // fits inside the range. We try each octave of the root that lands in the
  // keyboard (e.g. for root C: C4 = 60 and C5 = 72 are candidates on F3..E5).
  const voicings = []
  for (let m = kbdLow; m <= kbdHigh; m++) {
    // Convert keyboard MIDI to pitch class in A=0 indexing.
    // MIDI 57 = A4 → pitch 0. So pitch = (m - 57 + 1200) % 12... but we index
    // from A so: (m - 57 + 120) % 12.
    const pc = ((m - 57) % 12 + 12) % 12
    if (pc !== rootPitch) continue
    const voicing = intervals.map(iv => m + iv)
    if (voicing[voicing.length - 1] <= kbdHigh) {
      voicings.push(voicing)
    }
  }

  // Flat set of every MIDI note that belongs to some complete voicing.
  const midiSet = new Set()
  // Separate set for root notes — only MIDIs that are the root of a voicing.
  const rootMidiSet = new Set()
  voicings.forEach(v => {
    v.forEach(m => midiSet.add(m))
    rootMidiSet.add(v[0])
  })

  // Pitch-class list is still used for the chord-name display and audio.
  const pitches = intervals.map(iv => (rootPitch + iv) % 12)

  return {
    id: degreeOffset + ':' + chord.name,
    offset: degreeOffset,
    rootPitch,
    alias,
    displayName: noteNames[rootPitch] + suffixFor(alias),
    chord,
    complexity: chord._complexity,
    pitches,
    voicings,
    midiSet,
    rootMidiSet,
  }
}

// Flat list of every chord in the key, filtered by the active complexity
// tab, in scale-degree order (I, ii, iii, ... — but without the roman labels).
const chordCards = computed(() => {
  const out = []
  getDegreeChords(scaleChroma.value).forEach(dc => {
    const filtered = filterByComplexity(dc.chords, complexity.value)
    filtered.forEach(c => out.push(buildChordCard(c, dc.offset)))
  })
  return out
})

// Total count for the LCD readout
const totalChordCount = computed(() => chordCards.value.length)

// ══════════════════════════════════════════════════════════════
//   OP-1 Keyboard layout
//
//   The real OP-1 keyboard spans F to E — 2 octaves starting on F.
//   On the Chromatone-stickered version, every key is colored.
//   Layout (one octave): F F# G G# A A# B C C# D D# E
//   White keys: F G A B C D E (7)
//   Black keys: F# G# A# (after whites 0, 1, 2) and C# D# (after whites 4, 5)
//   — no black key between B/C or E/F.
//
//   We render 2 octaves: 14 white keys total, 10 black keys total.
//   Pitch indexing uses A=0, so F=8, F#=9, G=10, G#=11, A=0, A#=1,
//   B=2, C=3, C#=4, D=5, D#=6, E=7.
// ══════════════════════════════════════════════════════════════

// One octave of an F-rooted OP-1 keyboard, in semitone order.
// [whitePitch, blackPitchAfter | null] pairs so the template can
// anchor each black key to the white key to its left.
// F=8, F#=9, G=10, G#=11, A=0, A#=1, B=2, C=3, C#=4, D=5, D#=6, E=7
const OCTAVE_WHITE_LAYOUT = [
  { white: 8,  blackAfter: 9  }, // F, F#
  { white: 10, blackAfter: 11 }, // G, G#
  { white: 0,  blackAfter: 1  }, // A, A#
  { white: 2,  blackAfter: null }, // B  (no black between B and C)
  { white: 3,  blackAfter: 4  }, // C, C#
  { white: 5,  blackAfter: 6  }, // D, D#
  { white: 7,  blackAfter: null }, // E  (no black between E and F)
]

// Semitone offset from F of each white key within one octave (0..11).
// F=0, G=2, A=4, B=6, C=7, D=9, E=11 — standard piano intervals, re-rooted to F.
const WHITE_SEMITONES_FROM_F = [0, 2, 4, 6, 7, 9, 11]
const BLACK_SEMITONES_FROM_F = [1, 3, 5, /* between B/C: skip */ 8, 10 /* between E/F: skip */]

const OCTAVES = 2
// Base MIDI note: F3 = MIDI 53. Use F3 as the keyboard's low-F.
const BASE_MIDI_F = 53

const keyboardWhites = computed(() => {
  const whites = []
  for (let o = 0; o < OCTAVES; o++) {
    OCTAVE_WHITE_LAYOUT.forEach((slot, i) => {
      whites.push({
        pitch: slot.white,
        whiteIndex: i + o * 7,
        octaveInBoard: o,
        midi: BASE_MIDI_F + o * 12 + WHITE_SEMITONES_FROM_F[i],
        name: noteNames[slot.white],
      })
    })
  }
  return whites
})

const keyboardBlacks = computed(() => {
  const blacks = []
  for (let o = 0; o < OCTAVES; o++) {
    OCTAVE_WHITE_LAYOUT.forEach((slot, i) => {
      if (slot.blackAfter == null) return
      blacks.push({
        pitch: slot.blackAfter,
        // Anchored to the white key at this index (black sits between it and the next white).
        leftWhiteIdx: i + o * 7,
        octaveInBoard: o,
        // Semitones-from-F of the white, + 1 = the black
        midi: BASE_MIDI_F + o * 12 + WHITE_SEMITONES_FROM_F[i] + 1,
        name: noteNames[slot.blackAfter],
      })
    })
  }
  return blacks
})

const TOTAL_WHITES = 14 // 2 octaves * 7
const WHITE_WIDTH_PCT = 100 / TOTAL_WHITES

function isInScale(pitch) {
  return scalePitchSet.value.has(pitch)
}

function isRoot(pitch) {
  return pitch === tonic.value
}

// ══════════════════════════════════════════════════════════════
//   Audio — opt-in play buttons only
// ══════════════════════════════════════════════════════════════

let currentHeldNotes = null

async function playScale() {
  await ensureAudio()
  // Arpeggiate the scale ascending, one note every 180ms
  const base = 48 + 12 // C4-ish
  // Build ordered scale notes starting from the tonic
  const scaleOffsets = []
  scaleChroma.value.split('').forEach((bit, i) => { if (bit === '1') scaleOffsets.push(i) })
  // Convert to MIDI numbers relative to C4 + tonic
  // A = MIDI 57 so tonic MIDI = 57 + tonic
  const tonicMidi = 57 + tonic.value
  const seq = scaleOffsets.map(off => tonicMidi + off)
  seq.push(tonicMidi + 12) // octave
  seq.forEach((m, i) => {
    setTimeout(() => playNoteOnce(m, 0.85, 0.22), i * 180)
  })
}

async function playChordHit(chord) {
  await ensureAudio()
  const chordTonic = chord.rootPitch
  const midiNotes = getChromaNotes(chord.chord.chroma, chordTonic, 0)
  playNoteOnce(midiNotes, 0.75, 0.9)
}

async function playKey(midi) {
  await ensureAudio()
  playNoteOnce(midi, 0.85, 0.35)
}

onBeforeUnmount(() => {
  if (currentHeldNotes) stopNote(currentHeldNotes)
})

// ══════════════════════════════════════════════════════════════
//   Progression — a fixed array of slots the user fills forward.
//
//   Each slot is either null (empty) or { card, beats }.
//   The first empty slot is the ACTIVE slot — where the "ghost"
//   suggestion stack is drawn, and where grid-tile clicks land.
//
//   Filled slots show their chord; the last-filled-slot drives
//   keyboard highlighting and info blocks via `lastStep`.
//
//   The ghost stack shows 3 suggested chords for the active slot,
//   picked from the progression table anchored on the previous
//   slot's chord (or on the tonic triad if nothing is filled yet).
// ══════════════════════════════════════════════════════════════

const DEFAULT_SLOT_COUNT = 8
const MIN_SLOTS = 1
const MAX_SLOTS = 16
const makeEmptyProgression = (n = DEFAULT_SLOT_COUNT) => Array(n).fill(null).map(() => null)

const progression = ref(makeEmptyProgression())
const heldChord = ref(null)           // chord held on the big piano (click a tile to set)
const hoveredChord = ref(null)        // transient preview (ghost / tile hover)
const progressionOpen = ref(false)    // collapsible card — collapsed by default
const bpm = ref(100)                  // 60..180
const DEFAULT_BEATS = 4

// Index of the first empty slot. -1 means the progression is full.
const activeSlotIndex = computed(() => {
  const i = progression.value.findIndex(s => s == null)
  return i
})

// The most-recently-filled progression slot's chord. Used by the ghost
// suggestion anchor, NOT by keyboard highlighting (that's heldChord now).
const lastStep = computed(() => {
  for (let i = progression.value.length - 1; i >= 0; i--) {
    const s = progression.value[i]
    if (s) return s.card
  }
  return null
})

const filledCount = computed(() => progression.value.filter(s => s != null).length)

// Display priority for keyboard + info panel:
//   hover → held → (nothing: fall back to plain scale)
// The progression no longer drives the big keyboard automatically.
const selectedChord = computed(() => hoveredChord.value || heldChord.value)

function setSlot(i, card) {
  const next = progression.value.slice()
  next[i] = { card, beats: DEFAULT_BEATS }
  progression.value = next
}

// Tile click in the grid: HOLD the chord on the big piano. Click the
// same tile again to release. Holding never touches the progression —
// use the + ADD button for that.
function toggleHeldChord(c) {
  if (heldChord.value && heldChord.value.id === c.id) {
    heldChord.value = null
  } else {
    heldChord.value = c
  }
}

// Drop a chord directly into the progression. Called from the `+`
// button on each chord tile. Fills the first empty slot; if the
// progression is full, replaces the last slot (still forward-building).
function placeChordInProgression(c) {
  const idx = activeSlotIndex.value
  if (idx === -1) {
    setSlot(progression.value.length - 1, c)
  } else {
    setSlot(idx, c)
  }
}

// Click a filled slot: rewind. Clears that slot and every slot after it.
function rewindTo(i) {
  const next = progression.value.slice()
  for (let j = i; j < next.length; j++) next[j] = null
  progression.value = next
}

// Click a ghost chip: same as placeChordInProgression but scoped to the
// active slot explicitly (ghosts are only drawn for the active slot).
function fillActiveSlot(card) {
  const idx = activeSlotIndex.value
  if (idx === -1) return
  setSlot(idx, card)
}

function clearProgression() {
  progression.value = makeEmptyProgression()
}
function undoProgression() {
  // Remove the last filled slot.
  const next = progression.value.slice()
  for (let j = next.length - 1; j >= 0; j--) {
    if (next[j] != null) { next[j] = null; break }
  }
  progression.value = next
}
// Grow the slot array by one.
function addSlot() {
  if (progression.value.length >= MAX_SLOTS) return
  progression.value = [...progression.value, null]
}
// Shrink the slot array by one. Refuses to drop a filled slot — user
// has to clear it first, so a stray click can't destroy their work.
function removeSlot() {
  if (progression.value.length <= MIN_SLOTS) return
  const last = progression.value[progression.value.length - 1]
  if (last != null) return
  progression.value = progression.value.slice(0, -1)
}
function setSlotBeats(i, beats) {
  const s = progression.value[i]
  if (!s) return
  const clamped = Math.max(1, Math.min(8, beats))
  const next = progression.value.slice()
  next[i] = { ...s, beats: clamped }
  progression.value = next
}
function bumpSlotBeats(i, delta) {
  const s = progression.value[i]
  if (!s) return
  setSlotBeats(i, s.beats + delta)
}

async function playProgression() {
  const filled = progression.value.map((s, i) => ({ s, i })).filter(x => x.s != null)
  if (filled.length === 0) return
  await ensureAudio()
  const secPerBeat = 60 / bpm.value
  let offsetSec = 0
  filled.forEach(({ s }) => {
    const durSec = secPerBeat * s.beats
    const midiNotes = getChromaNotes(s.card.chord.chroma, s.card.rootPitch, 0)
    setTimeout(() => {
      // Slight sustain: 92% of the slot length so adjacent chords don't clip.
      playNoteOnce(midiNotes, 0.75, Math.max(0.15, durSec * 0.92))
    }, offsetSec * 1000)
    offsetSec += durSec
  })
}

function isHighlighted(key) {
  const sel = selectedChord.value
  if (sel) return sel.midiSet.has(key.midi)
  return scalePitchSet.value.has(key.pitch)
}
function isHighlightRoot(key) {
  const sel = selectedChord.value
  if (sel) return sel.rootMidiSet.has(key.midi)
  return key.pitch === tonic.value
}

// ══════════════════════════════════════════════════════════════
//   Info blurbs — short "mood + use" lines for the current scale
//   and the currently selected chord.
// ══════════════════════════════════════════════════════════════

const scaleInfo = computed(() => SCALE_INFO[scaleChroma.value] || FALLBACK_SCALE)
const chordInfo = computed(() => {
  const sel = selectedChord.value
  if (!sel) return null
  return CHORD_INFO[sel.alias] || FALLBACK_CHORD
})

// ─── Ghost suggestions for the active progression slot ───
//
// Pure function of `progression` + `scaleChroma` + `chordCards` — NEVER of
// `heldChord` or `hoveredChord`. That's the critical no-feedback-loop rule:
// hovering a ghost chip must not regenerate the chip list beneath the cursor.
//
// Anchored on the previous filled slot's chord. If no slots are filled yet,
// we seed from the tonic triad (the I chord in the current key) so the very
// first slot still has something to suggest.
const hasNextData = computed(() => getProgressionTableFor(scaleChroma.value) != null)

const GHOST_COUNT = 3

const ghostSuggestions = computed(() => {
  const idx = activeSlotIndex.value
  if (idx === -1) return null // progression full

  const table = getProgressionTableFor(scaleChroma.value)
  if (!table) return null

  // Anchor: previous slot's chord if any, else build a synthetic
  // "I chord" anchor from the tonic so the first slot has suggestions.
  let anchorOffset
  let anchorAlias
  if (idx > 0 && progression.value[idx - 1]) {
    const prev = progression.value[idx - 1].card
    anchorOffset = prev.offset
    anchorAlias = prev.alias
  } else {
    anchorOffset = 0 // tonic is always offset 0 in its own key
    anchorAlias = table.qualities[0]
  }

  const scalePos = table.offsets.indexOf(anchorOffset)
  if (scalePos < 0) return null

  const moves = table.moves[scalePos]
  const cardByKey = new Map()
  chordCards.value.forEach(c => {
    cardByKey.set(c.offset + ':' + c.alias, c)
  })

  const resolved = moves.after.map(m => {
    const targetOffset = table.offsets[m.deg]
    if (targetOffset == null) return null
    const wantAlias = m.quality === 'triad' ? table.qualities[m.deg] : m.quality
    const card = cardByKey.get(targetOffset + ':' + wantAlias)
    if (!card) return null
    return { card, vibe: m.vibe }
  }).filter(Boolean)

  // Deduplicate on card id — keep the first vibe for each unique chord.
  const seen = new Set()
  const unique = []
  for (const r of resolved) {
    if (seen.has(r.card.id)) continue
    seen.add(r.card.id)
    unique.push(r)
    if (unique.length >= GHOST_COUNT) break
  }
  return unique
})
</script>

<template>
  <div class="op-studio">
    <div class="panel main-panel">
      <div class="screw tl"></div>
      <div class="screw tr"></div>
      <div class="screw bl"></div>
      <div class="screw br"></div>

      <!-- ═══════ TOP BAR: brand + LCD ═══════ -->
      <div class="top-bar">
        <div class="brand">
          <div class="brand-mark">OP</div>
          <div class="brand-sub">studio</div>
        </div>
        <div class="lcd">
          <div class="lcd-line lcd-big">
            {{ noteNames[tonic] }} · {{ currentScaleLabel }}
          </div>
          <div class="lcd-line lcd-small">
            <span>{{ scalePitches.length }} NOTES</span>
            <span> · </span>
            <span>{{ totalChordCount }} CHORDS</span>
            <span v-if="selectedChord"> · </span>
            <span v-if="selectedChord">
              SHOWING {{ selectedChord.displayName }}<span v-if="heldChord && !hoveredChord"> · HELD</span>
            </span>
          </div>
        </div>
        <button class="hw-btn round play-scale" @click="playScale" title="Play scale">
          <div class="play-icon">▶</div>
        </button>
      </div>

      <!-- ═══════ KEY PICKER ═══════ -->
      <div class="section">
        <div class="section-label">KEY</div>
        <div class="key-row">
          <button
            v-for="p in 12"
            :key="p - 1"
            class="hw-btn key-btn"
            :class="{ on: tonic === p - 1 }"
            :style="{ '--btn-color': noteColor(p - 1, 2) }"
            @click="setTonic(p - 1)"
          >
            <span class="key-letter">{{ noteNames[p - 1] }}</span>
          </button>
        </div>
      </div>

      <!-- ═══════ SCALE PICKER ═══════ -->
      <div class="section">
        <div class="section-label">SCALE</div>
        <div class="scale-row">
          <button
            v-for="s in SCALE_LIST"
            :key="s.name"
            class="hw-btn scale-btn"
            :class="{ on: scaleChroma === s.chroma }"
            @click="setScale(s.chroma)"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <!-- ═══════ OP-1 KEYBOARD ═══════ -->
      <div class="section">
        <div class="section-label">
          <span>KEYBOARD</span>
          <span class="section-label-right">
            <span class="hover-hint" v-if="selectedChord">
              <span v-if="heldChord && !hoveredChord">HELD</span>
              <span v-else>PREVIEW</span>
              {{ selectedChord.displayName }}
            </span>
            <span class="hover-hint" v-else>
              {{ noteNames[tonic] }} {{ currentScaleLabel }}
            </span>
          </span>
        </div>
        <div class="op1-frame">
          <div class="op1-keyboard">
            <!-- White keys -->
            <div
              v-for="key in keyboardWhites"
              :key="'w' + key.whiteIndex"
              class="white-key"
              :class="{
                in: isHighlighted(key),
                out: !isHighlighted(key),
                root: isHighlightRoot(key) && isHighlighted(key),
              }"
              :style="{
                left: (key.whiteIndex * WHITE_WIDTH_PCT) + '%',
                width: WHITE_WIDTH_PCT + '%',
                '--key-color': noteColor(key.pitch, 2),
              }"
              @click="playKey(key.midi)"
            >
              <div class="key-label">{{ key.name }}</div>
            </div>

            <!-- Black keys -->
            <div
              v-for="key in keyboardBlacks"
              :key="'b' + key.leftWhiteIdx + '-' + key.pitch"
              class="black-key"
              :class="{
                in: isHighlighted(key),
                out: !isHighlighted(key),
                root: isHighlightRoot(key) && isHighlighted(key),
              }"
              :style="{
                left: 'calc(' + ((key.leftWhiteIdx + 1) * WHITE_WIDTH_PCT) + '% - ' + (WHITE_WIDTH_PCT * 0.3) + '%)',
                width: (WHITE_WIDTH_PCT * 0.6) + '%',
                '--key-color': noteColor(key.pitch, 2),
              }"
              @click="playKey(key.midi)"
            >
              <div class="key-label black">{{ key.name }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════ INFO PANEL — scale, chord, progression suggestions ═══════ -->
      <div class="section">
        <div class="info-panel">
          <!-- Scale info -->
          <div class="info-block">
            <div class="info-label">SCALE · {{ currentScaleLabel }}</div>
            <div class="info-mood">{{ scaleInfo.mood }}</div>
            <div class="info-use">{{ scaleInfo.use }}</div>
          </div>

          <!-- Chord info -->
          <div class="info-block" v-if="selectedChord && chordInfo">
            <div class="info-label" :style="{ color: noteColor(selectedChord.rootPitch, 2) }">
              CHORD · {{ selectedChord.displayName }}
              <span class="info-label-hint" v-if="heldChord && heldChord.id === selectedChord.id && !hoveredChord">(held)</span>
            </div>
            <div class="info-mood">{{ chordInfo.mood }}</div>
            <div class="info-use">{{ chordInfo.use }}</div>
          </div>
          <div class="info-block info-block-hint" v-else>
            <div class="info-label">CHORD</div>
            <div class="info-use">Hover to preview · click a chord to hold it on the piano · press + on any chord to add it to the progression.</div>
          </div>
        </div>

        <!-- Progression panel: fixed slots, ghost suggestions, BPM -->
        <div class="progression" :class="{ collapsed: !progressionOpen }">
          <div class="prog-head">
            <button
              class="prog-toggle"
              @click="progressionOpen = !progressionOpen"
              :title="progressionOpen ? 'Collapse progression' : 'Expand progression'"
            >
              <span class="prog-caret">{{ progressionOpen ? '▾' : '▸' }}</span>
              <span class="prog-label">PROGRESSION</span>
              <span class="prog-summary" v-if="!progressionOpen">
                · {{ filledCount }}/{{ progression.length }} · {{ bpm }} BPM
              </span>
            </button>
            <div class="prog-controls" v-if="progressionOpen">
              <label class="prog-bpm" title="Tempo">
                <span class="prog-bpm-label">BPM</span>
                <input
                  type="range"
                  min="60"
                  max="180"
                  step="1"
                  v-model.number="bpm"
                />
                <span class="prog-bpm-val">{{ bpm }}</span>
              </label>
              <div class="prog-slot-count" title="Number of progression slots">
                <span class="prog-slot-count-label">SLOTS</span>
                <button
                  class="prog-slot-count-btn"
                  :disabled="progression.length <= 1 || progression[progression.length - 1] != null"
                  @click="removeSlot"
                  title="Remove last slot (must be empty)"
                >–</button>
                <span class="prog-slot-count-val">{{ progression.length }}</span>
                <button
                  class="prog-slot-count-btn"
                  :disabled="progression.length >= 16"
                  @click="addSlot"
                  title="Add a slot"
                >+</button>
              </div>
              <button
                class="hw-btn tiny prog-ctrl"
                :disabled="filledCount === 0"
                @click="undoProgression"
                title="Remove last filled slot"
              >UNDO</button>
              <button
                class="hw-btn tiny prog-ctrl"
                :disabled="filledCount === 0"
                @click="clearProgression"
                title="Clear progression"
              >CLEAR</button>
              <button
                class="hw-btn tiny prog-ctrl prog-play"
                :disabled="filledCount === 0"
                @click="playProgression"
                title="Play progression"
              >▶ PLAY</button>
            </div>
          </div>

          <div class="prog-body" v-if="progressionOpen">
            <div class="prog-slots">
              <div
                v-for="(slot, i) in progression"
                :key="'slot' + i"
                class="prog-slot"
                :class="{
                  filled: slot != null,
                  active: slot == null && i === activeSlotIndex,
                  idle: slot == null && i !== activeSlotIndex,
                }"
              >
                <div class="prog-slot-num">{{ i + 1 }}</div>

                <!-- Filled slot: chord chip + beat length controls -->
                <template v-if="slot != null">
                  <button
                    class="prog-step"
                    :class="{ 'is-last': i === filledCount - 1 }"
                    :style="{ '--chip-color': noteColor(slot.card.rootPitch, 2) }"
                    @mouseenter="hoveredChord = slot.card"
                    @mouseleave="hoveredChord = null"
                    @click="rewindTo(i)"
                    :title="'Click to rewind from slot ' + (i + 1)"
                  >
                    <span class="prog-step-name">{{ slot.card.displayName }}</span>
                  </button>
                  <div class="prog-beats">
                    <button
                      class="prog-beat-btn"
                      @click="bumpSlotBeats(i, -1)"
                      :disabled="slot.beats <= 1"
                      title="Shorter"
                    >–</button>
                    <span class="prog-beat-val">{{ slot.beats }}<span class="prog-beat-unit">b</span></span>
                    <button
                      class="prog-beat-btn"
                      @click="bumpSlotBeats(i, 1)"
                      :disabled="slot.beats >= 8"
                      title="Longer"
                    >+</button>
                  </div>
                </template>

                <!-- Active empty slot: stack of 3 ghost suggestions -->
                <template v-else-if="i === activeSlotIndex && ghostSuggestions && ghostSuggestions.length">
                  <div class="prog-ghosts">
                    <button
                      v-for="(g, gi) in ghostSuggestions"
                      :key="'g' + i + '-' + gi + g.card.id"
                      class="prog-ghost"
                      :style="{ '--chip-color': noteColor(g.card.rootPitch, 2) }"
                      @mouseenter="hoveredChord = g.card"
                      @mouseleave="hoveredChord = null"
                      @click="fillActiveSlot(g.card)"
                      :title="'Click to place ' + g.card.displayName"
                    >
                      <span class="prog-ghost-name">{{ g.card.displayName }}</span>
                      <span class="prog-ghost-vibe">{{ g.vibe }}</span>
                    </button>
                  </div>
                </template>

                <!-- Active empty slot but no suggestion data (non-major/minor scale) -->
                <template v-else-if="i === activeSlotIndex">
                  <div class="prog-ghosts-empty">
                    press + on<br>any chord below
                  </div>
                </template>

                <!-- Idle empty slot -->
                <template v-else>
                  <div class="prog-slot-placeholder">—</div>
                </template>
              </div>
            </div>

            <div class="prog-hint" v-if="!hasNextData && filledCount < progression.length">
              Next-chord suggestions are only wired up for major and minor keys. You can still press + on any chord below to add it.
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════ CHORDS IN KEY — every chord that fits, grouped by degree ═══════ -->
      <div class="section">
        <div class="section-label">
          <span>CHORDS IN KEY</span>
          <span class="section-label-right">
            <span class="hover-hint">{{ totalChordCount }} SHOWN</span>
          </span>
        </div>

        <!-- Complexity tabs -->
        <div class="complexity-tabs">
          <button
            v-for="tab in COMPLEXITY_TABS"
            :key="tab.id"
            class="hw-btn complexity-tab"
            :class="{ on: complexity === tab.id }"
            @click="setComplexity(tab.id)"
          >
            <span class="tab-label">{{ tab.label }}</span>
            <span class="tab-hint">{{ tab.hint }}</span>
          </button>
        </div>

        <!-- Flat compact strip of every chord in the key -->
        <div class="chord-strip" v-if="chordCards.length">
          <div
            v-for="c in chordCards"
            :key="c.id"
            class="chord-tile"
            :class="{
              hovered: hoveredChord && hoveredChord.id === c.id,
              pinned: heldChord && heldChord.id === c.id,
            }"
            @mouseenter="hoveredChord = c"
            @mouseleave="hoveredChord = null"
            @click="toggleHeldChord(c)"
          >
            <div class="chord-tile-head">
              <div class="chord-tile-name" :style="{ color: noteColor(c.rootPitch, 2) }">
                {{ c.displayName }}
              </div>
              <div class="tile-actions">
                <button
                  class="hw-btn tiny tile-play"
                  @click.stop="playChordHit(c)"
                  title="Play chord"
                >▶</button>
                <button
                  class="hw-btn tiny tile-add"
                  @click.stop="placeChordInProgression(c)"
                  title="Add to progression"
                >+</button>
              </div>
            </div>
            <div class="chord-tile-kbd">
              <div
                v-for="key in keyboardWhites"
                :key="'mw' + key.whiteIndex"
                class="mini-white-key"
                :class="{ lit: c.midiSet.has(key.midi), rootLit: c.rootMidiSet.has(key.midi) }"
                :style="{
                  left: (key.whiteIndex * WHITE_WIDTH_PCT) + '%',
                  width: WHITE_WIDTH_PCT + '%',
                  '--key-color': noteColor(key.pitch, 2),
                }"
              ></div>
              <div
                v-for="key in keyboardBlacks"
                :key="'mb' + key.leftWhiteIdx + '-' + key.pitch"
                class="mini-black-key"
                :class="{ lit: c.midiSet.has(key.midi), rootLit: c.rootMidiSet.has(key.midi) }"
                :style="{
                  left: 'calc(' + ((key.leftWhiteIdx + 1) * WHITE_WIDTH_PCT) + '% - ' + (WHITE_WIDTH_PCT * 0.3) + '%)',
                  width: (WHITE_WIDTH_PCT * 0.6) + '%',
                  '--key-color': noteColor(key.pitch, 2),
                }"
              ></div>
            </div>
          </div>
        </div>
        <div v-else class="degree-empty">no chords at this level</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════
   TE hardware look — grey brushed panel, chunky
   rainbow keys, LCD display, screws, monospace.
   ══════════════════════════════════════════════ */

* { box-sizing: border-box; }

.op-studio {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 20px;
  font-family: "Fira Code", "SF Mono", "Menlo", "Consolas", monospace;
  background:
    radial-gradient(ellipse at top, #d8d8d8 0%, #b8b8b8 50%, #9a9a9a 100%),
    repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 3px);
  color: #222;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}

.panel {
  position: relative;
  width: 100%;
  max-width: 1180px;
  border-radius: 18px;
  padding: 26px;
  background: linear-gradient(145deg, #e6e6e6 0%, #c8c8c8 45%, #b0b0b0 100%);
  border: 2px solid #fafafa;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.9),
    inset 0 -2px 4px rgba(0,0,0,0.15),
    0 2px 0 rgba(255,255,255,0.4),
    0 20px 40px -10px rgba(0,0,0,0.4),
    0 4px 12px rgba(0,0,0,0.2);
}

.screw {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #e0e0e0 0%, #888 60%, #555 100%);
  box-shadow: inset 0 0 2px rgba(0,0,0,0.6), 0 1px 1px rgba(255,255,255,0.5);
}
.screw::after {
  content: "";
  position: absolute;
  inset: 0;
  margin: auto;
  width: 60%;
  height: 1px;
  background: #333;
  top: 50%;
  transform: translateY(-50%) rotate(45deg);
}
.screw.tl { top: 10px; left: 10px; }
.screw.tr { top: 10px; right: 10px; }
.screw.bl { bottom: 10px; left: 10px; }
.screw.br { bottom: 10px; right: 10px; }

/* ─────── TOP BAR ─────── */

.top-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(180deg, #a8a8a8, #bcbcbc);
  border: 1px solid rgba(255,255,255,0.5);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
}
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 12px;
  min-width: 72px;
}
.brand-mark {
  font-size: 26px;
  font-weight: 900;
  letter-spacing: -0.05em;
  color: #1a1a1a;
  line-height: 1;
}
.brand-sub {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: #444;
  margin-top: 2px;
}
.lcd {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 10px 16px;
  border-radius: 6px;
  background: linear-gradient(180deg, #1a1e18 0%, #2a2f24 100%);
  border: 1px solid #0a0a0a;
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,255,255,0.05);
  min-height: 56px;
}
.lcd-line { font-family: "Fira Code", monospace; letter-spacing: 0.08em; }
.lcd-big {
  font-size: 18px;
  font-weight: 700;
  color: #b8ff6a;
  text-shadow: 0 0 6px rgba(184, 255, 106, 0.5);
}
.lcd-small {
  font-size: 10px;
  margin-top: 4px;
  color: #7ab84a;
  opacity: 0.85;
}

/* ─────── HARDWARE BUTTONS ─────── */

.hw-btn {
  position: relative;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  user-select: none;
  font-family: "Fira Code", monospace;
  border: none;
  transition: transform 0.05s ease, box-shadow 0.1s ease, filter 0.1s ease;
}
.hw-btn:active { transform: translateY(1px); filter: brightness(0.92); }

.hw-btn.tiny {
  font-size: 9px;
  padding: 4px 8px;
  border-radius: 4px;
  background: linear-gradient(180deg, #e0e0e0, #b0b0b0);
  color: #1a1a1a;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.8),
    inset 0 -1px 0 rgba(0,0,0,0.2),
    0 1px 2px rgba(0,0,0,0.3);
  min-width: 22px;
}

.hw-btn.round {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 13px;
  background: linear-gradient(160deg, #f4f4f4 0%, #bcbcbc 100%);
  color: #222;
  box-shadow:
    inset 0 2px 2px rgba(255,255,255,0.9),
    inset 0 -2px 3px rgba(0,0,0,0.25),
    0 2px 4px rgba(0,0,0,0.35),
    0 0 0 2px rgba(0,0,0,0.15);
}
.play-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 14px;
}

/* Key tonic buttons */
.key-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: radial-gradient(
    circle at 35% 30%,
    color-mix(in srgb, var(--btn-color) 85%, white 40%) 0%,
    var(--btn-color) 45%,
    color-mix(in srgb, var(--btn-color) 70%, black 30%) 100%
  );
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
  box-shadow:
    inset 0 2px 3px rgba(255,255,255,0.5),
    inset 0 -3px 4px rgba(0,0,0,0.35),
    0 3px 5px rgba(0,0,0,0.4),
    0 0 0 2px rgba(0,0,0,0.25);
}
.key-btn.on {
  box-shadow:
    inset 0 2px 3px rgba(255,255,255,0.7),
    inset 0 -3px 4px rgba(0,0,0,0.3),
    0 0 0 2px #fff,
    0 0 14px var(--btn-color),
    0 4px 8px rgba(0,0,0,0.5);
  transform: translateY(-1px);
}
.key-letter { font-weight: 900; font-size: 13px; }

.scale-btn {
  padding: 8px 12px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 700;
  background: linear-gradient(180deg, #e8e8e8, #b8b8b8);
  color: #222;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.9),
    inset 0 -1px 2px rgba(0,0,0,0.25),
    0 1px 3px rgba(0,0,0,0.3);
}
.scale-btn.on {
  background: linear-gradient(180deg, #2a2a2a, #0a0a0a);
  color: #b8ff6a;
  text-shadow: 0 0 4px rgba(184, 255, 106, 0.6);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.5);
}

/* ─────── SECTIONS ─────── */

.section { margin-bottom: 20px; }
.section-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.25em;
  font-weight: 700;
  margin-bottom: 8px;
  padding: 0 4px;
  color: #444;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-label-right { display: flex; align-items: center; gap: 6px; }
.hover-hint {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(0,0,0,0.15);
  color: #111;
}

.key-row, .scale-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(180deg, #a0a0a0, #888);
  border: 1px solid rgba(255,255,255,0.4);
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.3);
}

/* ═══════════════════════════════════════════════
   OP-1 KEYBOARD — hardware illustration
   ═══════════════════════════════════════════════ */

.op1-frame {
  padding: 16px 16px 20px;
  border-radius: 14px;
  background:
    linear-gradient(180deg, #d4d4d4 0%, #bcbcbc 60%, #a8a8a8 100%);
  border: 2px solid #fafafa;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.9),
    inset 0 -3px 6px rgba(0,0,0,0.2),
    0 4px 10px rgba(0,0,0,0.3);
}

.op1-keyboard {
  position: relative;
  width: 100%;
  height: 180px;
  background: #2a2a2a;
  border-radius: 6px;
  padding: 6px 6px 8px;
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.7);
}

.white-key, .black-key {
  position: absolute;
  cursor: pointer;
  border-radius: 0 0 6px 6px;
  transition: filter 0.12s ease, box-shadow 0.12s ease;
}

.white-key {
  top: 6px;
  bottom: 8px;
  padding: 2px;
  background: linear-gradient(180deg, #f8f8f8 0%, #d8d8d8 95%);
  border: 1px solid #1a1a1a;
  border-top: none;
  box-shadow:
    inset 0 2px 2px rgba(255,255,255,0.9),
    inset 0 -6px 8px rgba(0,0,0,0.2),
    2px 0 0 rgba(0,0,0,0.25);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  padding-bottom: 10px;
  z-index: 1;
}
.white-key.in {
  background:
    radial-gradient(ellipse at top, color-mix(in srgb, var(--key-color) 55%, white 45%) 0%, var(--key-color) 55%, color-mix(in srgb, var(--key-color) 70%, black 30%) 100%);
  box-shadow:
    inset 0 2px 3px rgba(255,255,255,0.6),
    inset 0 -6px 10px rgba(0,0,0,0.3),
    2px 0 0 rgba(0,0,0,0.4),
    0 0 12px color-mix(in srgb, var(--key-color) 50%, transparent);
}
.white-key.out {
  filter: grayscale(1) brightness(0.78);
  opacity: 0.55;
}
.white-key.root {
  box-shadow:
    inset 0 0 0 3px #fff,
    inset 0 2px 3px rgba(255,255,255,0.6),
    inset 0 -6px 10px rgba(0,0,0,0.3),
    2px 0 0 rgba(0,0,0,0.4),
    0 0 18px color-mix(in srgb, var(--key-color) 80%, transparent);
  transform: translateY(-1px);
}
.white-key:hover { filter: brightness(1.08); }
.white-key.out:hover { filter: grayscale(1) brightness(1); opacity: 0.75; }

.black-key {
  top: 6px;
  height: 62%;
  background: linear-gradient(180deg, #2a2a2a 0%, #0a0a0a 100%);
  border: 1px solid #000;
  border-radius: 0 0 4px 4px;
  box-shadow:
    inset 0 2px 3px rgba(255,255,255,0.2),
    inset 0 -4px 6px rgba(0,0,0,0.7),
    2px 2px 4px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  padding-bottom: 6px;
  z-index: 2;
}
.black-key.in {
  background:
    radial-gradient(ellipse at top, color-mix(in srgb, var(--key-color) 70%, white 30%) 0%, var(--key-color) 55%, color-mix(in srgb, var(--key-color) 60%, black 40%) 100%);
  box-shadow:
    inset 0 2px 3px rgba(255,255,255,0.4),
    inset 0 -4px 6px rgba(0,0,0,0.5),
    2px 2px 4px rgba(0,0,0,0.6),
    0 0 12px color-mix(in srgb, var(--key-color) 60%, transparent);
}
.black-key.out {
  filter: grayscale(1) brightness(0.9);
  opacity: 0.7;
}
.black-key.root {
  box-shadow:
    inset 0 0 0 2px #fff,
    inset 0 2px 3px rgba(255,255,255,0.4),
    inset 0 -4px 6px rgba(0,0,0,0.5),
    2px 2px 4px rgba(0,0,0,0.6),
    0 0 18px color-mix(in srgb, var(--key-color) 80%, transparent);
  transform: translateY(-1px);
}
.black-key:hover { filter: brightness(1.15); }

.key-label {
  font-size: 10px;
  font-weight: 800;
  color: rgba(0,0,0,0.55);
  font-family: "Fira Code", monospace;
  pointer-events: none;
}
.white-key.in .key-label { color: rgba(255,255,255,0.92); text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
.key-label.black { color: rgba(255,255,255,0.6); font-size: 9px; }
.black-key.in .key-label { color: rgba(255,255,255,0.95); }

/* ═══════════════════════════════════════════════
   CHORD CARDS
   ═══════════════════════════════════════════════ */

/* Compact "cheat sheet" grid of every chord in the key */
.chord-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
}

.chord-tile {
  padding: 8px 10px 10px;
  border-radius: 8px;
  background: linear-gradient(180deg, #e0e0e0 0%, #c0c0c0 100%);
  border: 2px solid #8a8a8a;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.8),
    0 2px 4px rgba(0,0,0,0.3);
  transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
  cursor: pointer;
}
.chord-tile:hover,
.chord-tile.hovered {
  border-color: #222;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.8),
    0 6px 12px rgba(0,0,0,0.4);
}
.chord-tile.pinned {
  border-color: #9cff6a;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.8),
    0 0 0 2px rgba(156, 255, 106, 0.35),
    0 4px 10px rgba(0,0,0,0.35);
}
.chord-tile:active {
  filter: brightness(0.95);
}

.chord-tile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}
.chord-tile-name {
  font-family: "Fira Code", monospace;
  font-size: 20px;
  font-weight: 900;
  letter-spacing: -0.02em;
  text-shadow: 0 1px 2px rgba(0,0,0,0.15);
}
.tile-actions {
  display: flex;
  gap: 4px;
}
.tile-play,
.tile-add {
  min-width: 26px;
  padding: 4px 8px;
  font-size: 11px;
  line-height: 1;
}
.tile-add {
  background: linear-gradient(180deg, #c2f58a, #6ac94a);
  color: #0a2000;
  font-weight: 900;
  font-size: 14px;
}
.tile-add:hover {
  filter: brightness(1.08);
}

/* Info panel — "what this sounds like / is good for" */
.info-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 720px) {
  .info-panel { grid-template-columns: 1fr; }
}
.info-block {
  padding: 12px 14px;
  border-radius: 8px;
  background: linear-gradient(180deg, #2a2a2a, #141414);
  border: 1px solid #000;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.3);
  color: #d8d8d8;
  /* Reserve space so the block doesn't grow/shrink as the user hovers
     different chords — otherwise everything below (progression, grid)
     shifts every time the mood/use text changes length. Tall enough to
     fit label + mood + a 3-line `use` blurb without reflowing. */
  min-height: 130px;
}
.info-label {
  font-family: "Fira Code", monospace;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.18em;
  color: #9cff6a;
  text-shadow: 0 0 6px rgba(156, 255, 106, 0.35);
  margin-bottom: 6px;
  text-transform: uppercase;
}
.info-label-hint {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  opacity: 0.7;
  margin-left: 4px;
}
.info-mood {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #f0f0f0;
  margin-bottom: 4px;
  font-family: "Fira Code", monospace;
}
.info-use {
  font-size: 11px;
  line-height: 1.5;
  color: #a8a8a8;
}
.info-block-hint .info-use {
  font-style: italic;
}

/* Progression panel — fixed slots + ghost suggestions + BPM */
.progression {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: linear-gradient(180deg, #2a2a2a, #141414);
  border: 1px solid #000;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.3);
}
.progression.collapsed {
  padding-top: 10px;
  padding-bottom: 10px;
}
.prog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.prog-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 2px 0;
  font-family: inherit;
}
.prog-caret {
  display: inline-block;
  width: 12px;
  font-size: 12px;
  color: #9cff6a;
  text-shadow: 0 0 6px rgba(156, 255, 106, 0.35);
}
.prog-label {
  font-family: "Fira Code", monospace;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.22em;
  color: #9cff6a;
  text-shadow: 0 0 6px rgba(156, 255, 106, 0.35);
  text-transform: uppercase;
}
.prog-summary {
  font-family: "Fira Code", monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  color: #7ab84a;
  opacity: 0.85;
}

.prog-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.prog-ctrl {
  font-size: 9px;
  letter-spacing: 0.1em;
  padding: 5px 10px;
}
.prog-ctrl:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  filter: grayscale(0.5);
}
.prog-play {
  background: linear-gradient(180deg, #9cff6a, #6ac94a);
  color: #0a2000;
  text-shadow: 0 1px 0 rgba(255,255,255,0.3);
}

.prog-bpm {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 5px;
  background: rgba(0,0,0,0.35);
  border: 1px solid #000;
}
.prog-bpm-label {
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: #9cff6a;
}
.prog-bpm input[type="range"] {
  width: 88px;
  accent-color: #9cff6a;
}
.prog-bpm-val {
  font-family: "Fira Code", monospace;
  font-size: 11px;
  font-weight: 800;
  color: #b8ff6a;
  min-width: 22px;
  text-align: right;
}

.prog-slot-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 5px;
  background: rgba(0,0,0,0.35);
  border: 1px solid #000;
}
.prog-slot-count-label {
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: #9cff6a;
  margin-right: 2px;
}
.prog-slot-count-btn {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  border: 1px solid #000;
  background: linear-gradient(180deg, #e0e0e0, #b0b0b0);
  color: #1a1a1a;
  font-weight: 900;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.prog-slot-count-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.prog-slot-count-val {
  font-family: "Fira Code", monospace;
  font-size: 11px;
  font-weight: 800;
  color: #b8ff6a;
  min-width: 16px;
  text-align: center;
}

.prog-body {
  margin-top: 12px;
}

.prog-slots {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
@media (max-width: 720px) {
  .prog-slots { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.prog-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  min-height: 140px;
  padding: 18px 8px 8px;
  border-radius: 6px;
  background: rgba(0,0,0,0.3);
  border: 1px dashed rgba(255,255,255,0.08);
}
.prog-slot.active {
  border: 1px solid rgba(156, 255, 106, 0.45);
  box-shadow: inset 0 0 0 1px rgba(156, 255, 106, 0.15);
}
.prog-slot.filled {
  border-style: solid;
  border-color: rgba(255,255,255,0.12);
}
.prog-slot.idle {
  opacity: 0.55;
}
.prog-slot-num {
  position: absolute;
  top: 4px;
  left: 6px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #666;
  font-family: "Fira Code", monospace;
}
.prog-slot-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #444;
  font-size: 14px;
}

.prog-step {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 8px;
  border-radius: 6px;
  background: linear-gradient(180deg, #3a3a3a, #1a1a1a);
  border: 1px solid #000;
  border-left: 4px solid var(--chip-color, #666);
  color: #e8e8e8;
  font-family: "Fira Code", monospace;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.12s ease, filter 0.12s ease;
}
.prog-step:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.5);
}
.prog-step.is-last {
  box-shadow: 0 0 0 2px rgba(156, 255, 106, 0.45), 0 4px 10px rgba(0,0,0,0.5);
}
.prog-step-name {
  font-size: 16px;
  font-weight: 900;
  color: var(--chip-color);
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  letter-spacing: -0.02em;
}

.prog-beats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0,0,0,0.4);
}
.prog-beat-btn {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  border: 1px solid #000;
  background: linear-gradient(180deg, #e0e0e0, #b0b0b0);
  color: #1a1a1a;
  font-weight: 900;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.prog-beat-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.prog-beat-val {
  font-family: "Fira Code", monospace;
  font-size: 11px;
  font-weight: 800;
  color: #b8ff6a;
}
.prog-beat-unit {
  font-size: 9px;
  opacity: 0.7;
  margin-left: 1px;
}

.prog-ghosts {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.prog-ghost {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  background: linear-gradient(180deg, rgba(58,58,58,0.45), rgba(26,26,26,0.45));
  border: 1px dashed rgba(255,255,255,0.12);
  border-left: 3px dashed color-mix(in srgb, var(--chip-color, #666) 55%, transparent);
  color: rgba(232,232,232,0.55);
  font-family: "Fira Code", monospace;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, transform 0.1s ease;
}
.prog-ghost:hover {
  background: linear-gradient(180deg, #3a3a3a, #1a1a1a);
  border-style: solid;
  border-left-style: solid;
  color: #e8e8e8;
}
.prog-ghost-name {
  font-size: 12px;
  font-weight: 900;
  color: color-mix(in srgb, var(--chip-color, #888) 75%, #666 25%);
  text-shadow: 0 1px 2px rgba(0,0,0,0.4);
}
.prog-ghost:hover .prog-ghost-name {
  color: var(--chip-color);
}
.prog-ghost-vibe {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #666;
}
.prog-ghosts-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #5a5a5a;
  font-size: 10px;
  font-style: italic;
  line-height: 1.4;
}

.prog-hint {
  margin-top: 10px;
  padding: 10px 14px;
  border-radius: 6px;
  background: rgba(0,0,0,0.25);
  color: #888;
  font-size: 11px;
  font-style: italic;
}


/* Complexity tabs — segmented control above the chord list */
.complexity-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.complexity-tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 14px;
  min-width: 110px;
}
.complexity-tab .tab-label {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.1em;
}
.complexity-tab .tab-hint {
  font-size: 9px;
  letter-spacing: 0.08em;
  opacity: 0.65;
  text-transform: uppercase;
}
.complexity-tab.on {
  background: linear-gradient(180deg, #1e1e1e 0%, #0a0a0a 100%);
  color: #9cff6a;
  border-color: #000;
  text-shadow: 0 0 6px rgba(156, 255, 106, 0.6);
}
.complexity-tab.on .tab-hint {
  opacity: 0.8;
  color: #9cff6a;
}

.degree-empty {
  padding: 10px 14px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #888;
  font-style: italic;
}

/* Mini keyboard inside a chord tile — full 2 octaves F–E */
.chord-tile-kbd {
  position: relative;
  width: 100%;
  height: 44px;
  background: #1a1a1a;
  border-radius: 3px;
  padding: 2px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.7);
}
.mini-white-key {
  position: absolute;
  top: 2px;
  bottom: 2px;
  background: linear-gradient(180deg, #eee, #bbb);
  border: 1px solid #111;
  border-radius: 0 0 3px 3px;
  z-index: 1;
}
.mini-white-key.lit {
  background: linear-gradient(180deg, color-mix(in srgb, var(--key-color) 80%, white 20%), var(--key-color));
  box-shadow: 0 0 6px var(--key-color);
}
.mini-white-key.rootLit {
  border-color: #fff;
  box-shadow: inset 0 0 0 2px #fff, 0 0 8px var(--key-color);
}
.mini-black-key {
  position: absolute;
  top: 2px;
  height: 58%;
  background: #0a0a0a;
  border: 1px solid #000;
  border-radius: 0 0 2px 2px;
  z-index: 2;
}
.mini-black-key.lit {
  background: linear-gradient(180deg, color-mix(in srgb, var(--key-color) 75%, white 25%), var(--key-color));
  box-shadow: 0 0 6px var(--key-color);
}
.mini-black-key.rootLit {
  border-color: #fff;
  box-shadow: inset 0 0 0 1px #fff, 0 0 8px var(--key-color);
}

</style>
