// Short "what it sounds like / what it's good for" blurbs.
// Two lines per entry: `mood` (a few adjectives) and `use` (a one-sentence hint).
// Kept deliberately short — this is a reference tool, not an encyclopedia.

// Scales keyed by the 12-char chroma bitmask (A-rooted shape).
export const SCALE_INFO = {
  '101011010101': { // major
    mood: 'bright · happy · resolved',
    use: 'Pop, rock, folk, classical. The "default" scale — use it when you want something uplifting and familiar.',
  },
  '101101011010': { // natural minor
    mood: 'sad · serious · introspective',
    use: 'Pop ballads, rock, movie scores. Use it when you want emotional weight without sounding exotic.',
  },
  '101101010110': { // dorian
    mood: 'jazzy · cool · slightly melancholy',
    use: 'Jazz, funk, folk, Santana-style rock. Minor but with a lifted 6th — less sad than natural minor.',
  },
  '110101011010': { // phrygian
    mood: 'spanish · dark · exotic',
    use: 'Flamenco, metal, film scores. The ♭2 gives it that immediate "other world" flavor.',
  },
  '101010110101': { // lydian
    mood: 'dreamy · floating · optimistic',
    use: 'Film scores, prog rock, dream-pop. Major with a ♯4 — think The Simpsons theme or Star Wars.',
  },
  '101011010110': { // mixolydian
    mood: 'bluesy · rocky · relaxed',
    use: 'Classic rock, blues, Celtic. Major with a ♭7 — the sound of a lot of Beatles and Stones riffs.',
  },
  '101101011001': { // harmonic minor
    mood: 'exotic · dramatic · tense',
    use: 'Metal, classical, Middle Eastern. The ♯7 creates a strong pull to the tonic.',
  },
  '101101010101': { // melodic minor
    mood: 'sophisticated · smooth · jazz',
    use: 'Jazz improvisation, film noir. Minor that feels more "adult" and less dour.',
  },
  '101010010100': { // major pentatonic
    mood: 'foolproof · singable · happy',
    use: 'Folk, country, pop melodies. Five notes, no wrong turns — the easiest scale to solo with.',
  },
  '100101010010': { // minor pentatonic
    mood: 'rock · bluesy · gutsy',
    use: 'Rock solos, blues, hip-hop. The scale behind most guitar riffs you already know.',
  },
  '100101110010': { // blues
    mood: 'gritty · expressive · soulful',
    use: 'Blues, rock, jazz. Minor pentatonic plus the "blue note" ♭5 — instant attitude.',
  },
}

// Chord qualities keyed by Tonal's canonical `aliases[0]`.
export const CHORD_INFO = {
  // ─── Triads ───
  'M': {
    mood: 'bright · stable · happy',
    use: 'The most common chord in music. Home base for major keys.',
  },
  'm': {
    mood: 'sad · warm · introspective',
    use: 'Home base for minor keys. Adds emotional weight to any progression.',
  },
  'dim': {
    mood: 'tense · unstable · wants to resolve',
    use: 'Passing chord. Creates tension that almost always pulls toward another chord.',
  },
  'aug': {
    mood: 'dreamy · unsettled · suspended',
    use: 'Rare in pop, common in jazz and film. Feels like it\'s floating and hasn\'t landed.',
  },

  // ─── 7ths ───
  'maj7': {
    mood: 'jazzy · warm · relaxed',
    use: 'The "sophisticated happy" chord. Bossa nova, lounge, R&B.',
  },
  'm7': {
    mood: 'smooth · cool · soulful',
    use: 'Soul, funk, jazz, neo-soul. A minor chord that feels more grown-up.',
  },
  '7': {
    mood: 'bluesy · tense · wanting',
    use: 'The dominant 7. Pulls strongly to resolve — core of blues, rock, jazz.',
  },
  'dim7': {
    mood: 'dramatic · spooky · cinematic',
    use: 'Silent films, horror, jazz turnarounds. Maximum tension.',
  },
  'm7b5': {
    mood: 'melancholy · moody · jazz',
    use: 'Half-diminished. The "ii" chord in a minor jazz ii–V–i.',
  },

  // ─── 6ths ───
  '6': {
    mood: 'retro · breezy · open',
    use: '1940s swing, surf rock, ballads. Gentler than a maj7.',
  },
  'm6': {
    mood: 'bittersweet · jazzy · noir',
    use: 'Jazz standards, bossa nova. Minor with a hint of hope.',
  },

  // ─── Suspensions ───
  'sus4': {
    mood: 'open · unresolved · anticipation',
    use: 'Rock, worship, pop. The "waiting" chord — usually resolves to the plain major.',
  },
  'sus2': {
    mood: 'airy · modern · ambiguous',
    use: 'Indie, ambient, pop. Neither happy nor sad — sits somewhere in between.',
  },

  // ─── 9ths ───
  'maj9': {
    mood: 'lush · dreamy · sophisticated',
    use: 'Neo-soul, R&B, jazz ballads. Maj7 with an extra sparkle on top.',
  },
  'm9': {
    mood: 'smooth · sultry · deep',
    use: 'R&B, neo-soul, jazz. Classic "quiet storm" sound.',
  },
}

// Fallback blurb used for any chord or scale we don't have a specific entry for.
export const FALLBACK_CHORD = {
  mood: 'color · texture · extension',
  use: 'An extended voicing — adds jazz-style color beyond the basic triad.',
}
export const FALLBACK_SCALE = {
  mood: 'custom',
  use: 'A custom or less common scale.',
}
