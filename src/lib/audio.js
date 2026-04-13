// Self-contained audio engine: one polyphonic synth for chords + melody,
// one Tone.Transport for timing. No repo dependencies.

import * as Tone from 'tone'

let synth = null
let reverb = null
let started = false
let silentKeepalive = null

/**
 * Play a short silent buffer inside the user gesture. On iOS Safari this
 * is one part of "unlocking" the WebAudio output.
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
 * Build a tiny silent WAV (PCM) as a data URL. Doing it in JS — rather
 * than shipping a binary asset or trusting a hand-typed base64 blob —
 * guarantees a valid, decodable file.
 */
function buildSilentWavDataUrl() {
  const sampleRate = 8000
  const numSamples = 800 // 0.1s
  const headerSize = 44
  const dataSize = numSamples * 2 // 16-bit mono
  const buf = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(buf)
  const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)        // PCM chunk size
  view.setUint16(20, 1, true)         // PCM format
  view.setUint16(22, 1, true)         // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)         // block align
  view.setUint16(34, 16, true)        // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  // samples remain zero == silence
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return 'data:audio/wav;base64,' + btoa(binary)
}

/**
 * Start a silent, looping <audio> element. On iOS, an active HTMLAudioElement
 * promotes the page's audio session to "playback" mode, which is what
 * actually makes WebAudio output audible while the hardware ringer switch
 * is flipped to silent. Without this, Safari happily shows a "playing"
 * speaker icon in the tab but no sound reaches the speakers.
 */
function startSilentKeepalive() {
  if (silentKeepalive) return
  try {
    const el = document.createElement('audio')
    el.setAttribute('x-webkit-airplay', 'deny')
    el.preload = 'auto'
    el.loop = true
    el.muted = false
    el.volume = 0.0001
    el.playsInline = true
    el.src = buildSilentWavDataUrl()
    const p = el.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
    silentKeepalive = el
  } catch (_) {
    // ignore
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
  // Kick off the silent <audio> element FIRST, still inside the gesture,
  // so iOS flips the page into "playback" audio session mode before we
  // start producing WebAudio output.
  startSilentKeepalive()
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
