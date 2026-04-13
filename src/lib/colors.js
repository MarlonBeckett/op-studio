// Chromatone color system — A = Red = pitch 0 = hue 0°, +30° per semitone.
// This is the single load-bearing invariant: colors in this app MUST match
// the physical Chromatone stickers on the user's OP-1.

/**
 * Convert a pitch class (0..11 from A) to an HSLA color string.
 * @param {number} pitch     0..11, where 0 = A (red)
 * @param {number} octave    used to derive lightness — higher octave = lighter
 * @param {number} velocity  0..1, used as saturation multiplier (default 1)
 * @param {number} alpha     0..1 (default 1)
 */
export function pitchColor(pitch = 0, octave = 2, velocity = 1, alpha = 1) {
  const hue = ((pitch % 12) + 12) % 12 * 30
  const sat = Math.max(0, Math.min(100, velocity * 100))
  const light = Math.max(0, Math.min(100, Math.abs(octave + 2) * 8))
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
}

// Short alias used throughout the component, matching the repo's naming.
export const noteColor = pitchColor
