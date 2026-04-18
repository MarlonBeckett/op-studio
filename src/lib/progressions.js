// Common chord-progression "moves" for major and minor keys.
//
// For each scale position (0..6) we list chords that commonly come BEFORE
// it and chords that commonly come AFTER it. A move is described by:
//   - `deg`: the target chord's scale position (0 = I, 5 = vi, etc.)
//   - `quality`: the target chord's quality — 'triad' picks the natural
//              diatonic triad at that position, 'maj7'/'m7'/'7' force an
//              extension when we want to suggest a jazz color.
//   - `vibe`: short one-word label shown on the chip.
//
// Labels are deliberately plain-language ("classic", "soft", "jazz") — we
// don't surface roman numerals to the user anywhere in the UI, so these
// are the only hints about flavor.

// The natural triad quality at each scale position for major & minor keys.
// (These are what a beginner writing out "chords in the key of C" gets.)
export const MAJOR_TRIAD_QUALITIES = ['M', 'm', 'm', 'M', 'M', 'm', 'dim']
export const MINOR_TRIAD_QUALITIES = ['m', 'dim', 'M', 'm', 'm', 'M', 'M']

// The 7 scale-position semitone offsets for major & natural minor.
// Used to translate between a degree offset (in semitones from the tonic)
// and a scale position (0..6).
export const MAJOR_OFFSETS = [0, 2, 4, 5, 7, 9, 11]
export const MINOR_OFFSETS = [0, 2, 3, 5, 7, 8, 10]

// ─────────── Major-key progressions ───────────
//
// Indexed by scale position. Each entry is { before: [...], after: [...] }.
// We keep 3–4 suggestions per direction — enough variety, not overwhelming.

export const MAJOR_MOVES = [
  // I
  {
    before: [
      { deg: 4, quality: 'triad',  vibe: 'classic' }, // V → I
      { deg: 3, quality: 'triad',  vibe: 'soft'    }, // IV → I
      { deg: 6, quality: 'triad',  vibe: 'tense'   }, // vii° → I
      { deg: 1, quality: 'm7',     vibe: 'jazz'    }, // ii7 → I (informal)
    ],
    after: [
      { deg: 3, quality: 'triad',  vibe: 'lift'    }, // I → IV
      { deg: 4, quality: 'triad',  vibe: 'classic' }, // I → V
      { deg: 5, quality: 'triad',  vibe: 'soft'    }, // I → vi
      { deg: 1, quality: 'triad',  vibe: 'jazz'    }, // I → ii
    ],
  },
  // ii
  {
    before: [
      { deg: 0, quality: 'triad',  vibe: 'classic' },
      { deg: 5, quality: 'triad',  vibe: 'soft'    },
      { deg: 3, quality: 'triad',  vibe: 'lift'    },
    ],
    after: [
      { deg: 4, quality: 'triad',  vibe: 'classic' }, // ii → V
      { deg: 4, quality: '7',      vibe: 'jazz'    }, // ii → V7
      { deg: 0, quality: 'triad',  vibe: 'resolve' },
    ],
  },
  // iii
  {
    before: [
      { deg: 0, quality: 'triad',  vibe: 'soft'    },
      { deg: 5, quality: 'triad',  vibe: 'dark'    },
    ],
    after: [
      { deg: 5, quality: 'triad',  vibe: 'classic' }, // iii → vi
      { deg: 3, quality: 'triad',  vibe: 'soft'    }, // iii → IV
      { deg: 1, quality: 'triad',  vibe: 'lift'    }, // iii → ii
    ],
  },
  // IV
  {
    before: [
      { deg: 0, quality: 'triad',  vibe: 'classic' }, // I → IV
      { deg: 5, quality: 'triad',  vibe: 'loop'    }, // vi → IV
      { deg: 2, quality: 'triad',  vibe: 'lift'    }, // iii → IV
    ],
    after: [
      { deg: 0, quality: 'triad',  vibe: 'resolve' }, // IV → I (plagal)
      { deg: 4, quality: 'triad',  vibe: 'classic' }, // IV → V
      { deg: 1, quality: 'triad',  vibe: 'jazz'    }, // IV → ii
    ],
  },
  // V
  {
    before: [
      { deg: 3, quality: 'triad',  vibe: 'classic' }, // IV → V
      { deg: 1, quality: 'triad',  vibe: 'jazz'    }, // ii → V
      { deg: 1, quality: 'm7',     vibe: 'jazz'    }, // ii7 → V
      { deg: 0, quality: 'triad',  vibe: 'lift'    }, // I → V
    ],
    after: [
      { deg: 0, quality: 'triad',  vibe: 'classic' }, // V → I (resolve)
      { deg: 5, quality: 'triad',  vibe: 'soft'    }, // V → vi (deceptive)
      { deg: 3, quality: 'triad',  vibe: 'retro'   }, // V → IV (rock)
    ],
  },
  // vi
  {
    before: [
      { deg: 0, quality: 'triad',  vibe: 'classic' }, // I → vi
      { deg: 2, quality: 'triad',  vibe: 'soft'    }, // iii → vi
      { deg: 4, quality: 'triad',  vibe: 'soft'    }, // V → vi (deceptive)
    ],
    after: [
      { deg: 3, quality: 'triad',  vibe: 'loop'    }, // vi → IV (pop)
      { deg: 1, quality: 'triad',  vibe: 'lift'    }, // vi → ii
      { deg: 4, quality: 'triad',  vibe: 'classic' }, // vi → V
    ],
  },
  // vii°
  {
    before: [
      { deg: 0, quality: 'triad',  vibe: 'lift'    },
      { deg: 3, quality: 'triad',  vibe: 'soft'    },
    ],
    after: [
      { deg: 0, quality: 'triad',  vibe: 'resolve' }, // vii° → I
      { deg: 2, quality: 'triad',  vibe: 'dark'    }, // vii° → iii
    ],
  },
]

// ─────────── Natural-minor-key progressions ───────────
//
// Same structure, but rooted on the minor scale's own positions:
//   0 = i, 1 = ii°, 2 = III, 3 = iv, 4 = v (or V in harmonic), 5 = VI, 6 = VII

export const MINOR_MOVES = [
  // i
  {
    before: [
      { deg: 4, quality: 'triad',  vibe: 'classic' }, // v → i
      { deg: 3, quality: 'triad',  vibe: 'soft'    }, // iv → i
      { deg: 6, quality: 'triad',  vibe: 'retro'   }, // VII → i
      { deg: 5, quality: 'triad',  vibe: 'soft'    }, // VI → i
    ],
    after: [
      { deg: 3, quality: 'triad',  vibe: 'dark'    }, // i → iv
      { deg: 5, quality: 'triad',  vibe: 'lift'    }, // i → VI
      { deg: 6, quality: 'triad',  vibe: 'retro'   }, // i → VII
      { deg: 2, quality: 'triad',  vibe: 'loop'    }, // i → III
    ],
  },
  // ii°
  {
    before: [
      { deg: 0, quality: 'triad',  vibe: 'dark'    },
      { deg: 5, quality: 'triad',  vibe: 'soft'    },
    ],
    after: [
      { deg: 4, quality: 'triad',  vibe: 'classic' },
      { deg: 0, quality: 'triad',  vibe: 'resolve' },
    ],
  },
  // III
  {
    before: [
      { deg: 0, quality: 'triad',  vibe: 'loop'    },
      { deg: 6, quality: 'triad',  vibe: 'lift'    },
    ],
    after: [
      { deg: 5, quality: 'triad',  vibe: 'lift'    }, // III → VI
      { deg: 6, quality: 'triad',  vibe: 'retro'   }, // III → VII
      { deg: 3, quality: 'triad',  vibe: 'dark'    }, // III → iv
    ],
  },
  // iv
  {
    before: [
      { deg: 0, quality: 'triad',  vibe: 'classic' }, // i → iv
      { deg: 5, quality: 'triad',  vibe: 'soft'    },
    ],
    after: [
      { deg: 0, quality: 'triad',  vibe: 'resolve' }, // iv → i
      { deg: 4, quality: 'triad',  vibe: 'classic' }, // iv → v
      { deg: 6, quality: 'triad',  vibe: 'retro'   }, // iv → VII
    ],
  },
  // v
  {
    before: [
      { deg: 3, quality: 'triad',  vibe: 'classic' }, // iv → v
      { deg: 0, quality: 'triad',  vibe: 'lift'    }, // i → v
    ],
    after: [
      { deg: 0, quality: 'triad',  vibe: 'resolve' }, // v → i
      { deg: 5, quality: 'triad',  vibe: 'soft'    }, // v → VI
    ],
  },
  // VI
  {
    before: [
      { deg: 0, quality: 'triad',  vibe: 'lift'    }, // i → VI
      { deg: 2, quality: 'triad',  vibe: 'loop'    }, // III → VI
    ],
    after: [
      { deg: 3, quality: 'triad',  vibe: 'soft'    }, // VI → iv
      { deg: 6, quality: 'triad',  vibe: 'retro'   }, // VI → VII
      { deg: 0, quality: 'triad',  vibe: 'resolve' }, // VI → i
    ],
  },
  // VII
  {
    before: [
      { deg: 0, quality: 'triad',  vibe: 'retro'   }, // i → VII
      { deg: 5, quality: 'triad',  vibe: 'lift'    }, // VI → VII
    ],
    after: [
      { deg: 0, quality: 'triad',  vibe: 'classic' }, // VII → i
      { deg: 2, quality: 'triad',  vibe: 'loop'    }, // VII → III
    ],
  },
]

// Scale chromas we have progression data for.
export const MAJOR_CHROMA = '101011010101'
export const MINOR_CHROMA = '101101011010'

// ─────────── Chord function groups ───────────
//
// Maps each scale-position index (0..6) to a plain-language function label.
// These are used to bucket chord tiles into "Home / Energy / Tension" groups
// so beginners can see at a glance which chords are stable, which build
// momentum, and which create pull.

export const MAJOR_FUNCTIONS = ['home', 'energy', 'tension', 'energy', 'tension', 'home', 'tension']
//                               I       ii        iii→V?     IV        V          vi       vii°
// NOTE: iii is harmonically ambiguous — it acts as a weak tonic substitute.
// We put it under tension because beginners rarely use it and grouping it
// with the "home" chords would make that group feel crowded.  If you want
// iii in "home", swap index 2 to 'home'.

export const MINOR_FUNCTIONS = ['home', 'tension', 'home', 'energy', 'tension', 'home', 'energy']
//                               i       ii°        III      iv        v          VI       VII

// ─────────── Starter chord positions ───────────
//
// Scale-position indices (0..6) for the "starter" complexity tier.
// These are the 3-4 chords that cover ~80% of popular music in each key.

export const MAJOR_STARTER_POSITIONS = [0, 3, 4, 5]  // I, IV, V, vi
export const MINOR_STARTER_POSITIONS = [0, 3, 4, 6]  // i, iv, v, VII

/**
 * Given a scale chroma, return:
 *   - `type`: 'major' | 'minor' | null
 *   - `offsets`: semitone offsets of each scale position (length 7)
 *   - `qualities`: canonical triad quality at each position
 *   - `moves`: the BEFORE/AFTER lookup table
 * Returns null if this scale doesn't have progression data.
 */
export function getProgressionTableFor(scaleChroma) {
  if (scaleChroma === MAJOR_CHROMA) {
    return {
      type: 'major',
      offsets: MAJOR_OFFSETS,
      qualities: MAJOR_TRIAD_QUALITIES,
      moves: MAJOR_MOVES,
      functions: MAJOR_FUNCTIONS,
      starterPositions: MAJOR_STARTER_POSITIONS,
    }
  }
  if (scaleChroma === MINOR_CHROMA) {
    return {
      type: 'minor',
      offsets: MINOR_OFFSETS,
      qualities: MINOR_TRIAD_QUALITIES,
      moves: MINOR_MOVES,
      functions: MINOR_FUNCTIONS,
      starterPositions: MINOR_STARTER_POSITIONS,
    }
  }
  return null
}
