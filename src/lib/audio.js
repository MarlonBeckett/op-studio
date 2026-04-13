// Self-contained audio engine: one polyphonic synth for chords + melody,
// one Tone.Transport for timing. No repo dependencies.

import * as Tone from 'tone'

let synth = null
let reverb = null
let started = false

/**
 * Play a short silent buffer inside the user gesture. On iOS Safari this
 * is what actually "unlocks" the WebAudio output — without it the context
 * can be running but produce no sound, especially when the ringer switch
 * is on silent.
 */
function unlockIOSAudio(ctx) {
  try {
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    if (typeof source.start === 'function') source.start(0)
    else if (typeof source.noteOn === 'function') source.noteOn(0)
  } catch (_) {
    // ignore — best-effort unlock
  }
}

/**
 * Initialize the audio graph. Must be called from a user gesture
 * (button click / touchstart) to satisfy browser autoplay policies.
 *
 * On iOS Safari we additionally:
 *   - resume the raw AudioContext synchronously inside the gesture
 *   - play a 1-sample silent buffer to fully unlock output
 */
export async function ensureAudio() {
  if (started) return
  await Tone.start()
  const rawCtx = Tone.getContext().rawContext
  if (rawCtx && rawCtx.state !== 'running' && typeof rawCtx.resume === 'function') {
    try { await rawCtx.resume() } catch (_) {}
  }
  unlockIOSAudio(rawCtx)
  reverb = new Tone.Reverb({ decay: 2.2, wet: 0.22 }).toDestination()
  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.35, release: 0.8 },
    volume: -10,
  }).connect(reverb)
  started = true
}

/** MIDI number -> frequency string Tone understands (e.g. 60 -> "C4"). */
function midiToFreq(midi) {
  return Tone.Frequency(midi, 'midi').toFrequency()
}

/** Trigger a note (or array of notes) to sustain until stopNote is called. */
export function playNote(note, velocity = 0.8) {
  if (!synth) return
  if (Array.isArray(note)) {
    synth.triggerAttack(note.map(midiToFreq), undefined, velocity)
  } else {
    synth.triggerAttack(midiToFreq(note), undefined, velocity)
  }
}

export function stopNote(note) {
  if (!synth) return
  if (note == null) {
    synth.releaseAll()
    return
  }
  if (Array.isArray(note)) {
    synth.triggerRelease(note.map(midiToFreq))
  } else {
    synth.triggerRelease(midiToFreq(note))
  }
}

/** Trigger a note (or chord) for a fixed duration in seconds. */
export function playNoteOnce(note, velocity = 0.8, durationSec = 0.4) {
  if (!synth) return
  const freq = Array.isArray(note) ? note.map(midiToFreq) : midiToFreq(note)
  synth.triggerAttackRelease(freq, durationSec, undefined, velocity)
}

export function setBpm(bpm) {
  Tone.getTransport().bpm.value = bpm
}

export function transport() {
  return Tone.getTransport()
}

export function draw() {
  return Tone.getDraw()
}
