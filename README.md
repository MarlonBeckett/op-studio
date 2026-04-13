# OP Studio

A key, chord progression, and melody builder for [OP-1](https://teenage.engineering/products/op-1) users who don't know much about keys, scales, or chords yet.

The interface is styled after Teenage Engineering hardware so it feels at home next to your OP-1, and every note is colored using the [Chromatone](https://chromatone.center) twelve-tone palette — the same color-to-pitch mapping Chromatone uses — so you can *see* how a key, chord, or melody fits together without needing to read theory first.

Pick a key, sketch a progression, and build melodies visually. Standalone app; not affiliated with chromatone.center or Teenage Engineering.

## Stack

- [Vue 3](https://vuejs.org) + [Vite](https://vitejs.dev)
- [Tonal](https://github.com/tonaljs/tonal) for music theory
- [Tone.js](https://tonejs.github.io) for audio playback

## Getting started

```bash
npm install
npm run dev
```

Then open the local URL Vite prints.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — build for production
- `npm run preview` — preview the production build
