// Music theory constants — Chromatone convention: A = pitch 0 = Red.
// Do NOT reindex from C. Downstream color mapping depends on this order.

export const notes = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']

export const intervals = ['1P', '2m', '2M', '3m', '3M', '4P', 'TT', '5P', '6m', '6M', '7m', '7M']

export const ROMAN = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII']

// Semitone offset from A for each note name (used for reverse lookup if needed).
export const noteNameToPitch = {}
notes.forEach((n, i) => { noteNameToPitch[n] = i })

// Curated scale list — simple recognizable scales a beginner will actually use.
// chroma is a 12-char bitmask where position 0 = root, bit set = scale member.
// Indexed from the root note (A-rooted chroma of each scale shape).
export const SCALE_LIST = [
  { name: 'major',            chroma: '101011010101', label: 'MAJOR' },
  { name: 'minor',            chroma: '101101011010', label: 'MINOR' },
  { name: 'dorian',           chroma: '101101010110', label: 'DORIAN' },
  { name: 'phrygian',         chroma: '110101011010', label: 'PHRYGIAN' },
  { name: 'lydian',           chroma: '101010110101', label: 'LYDIAN' },
  { name: 'mixolydian',       chroma: '101011010110', label: 'MIXOLYD' },
  { name: 'harmonic minor',   chroma: '101101011001', label: 'HARM MIN' },
  { name: 'melodic minor',    chroma: '101101010101', label: 'MEL MIN' },
  { name: 'major pentatonic', chroma: '101010010100', label: 'PENTA+' },
  { name: 'minor pentatonic', chroma: '100101010010', label: 'PENTA-' },
  { name: 'blues',            chroma: '100101110010', label: 'BLUES' },
]

// Rotate an array left by `count` positions. Used for rotating chroma so a given
// scale degree becomes the new root.
export function rotateArray(arr, count) {
  const n = arr.length
  const c = ((count % n) + n) % n
  return arr.slice(c).concat(arr.slice(0, c))
}
