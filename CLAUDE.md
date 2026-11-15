# CLAUDE.md

## Design system

Use Marlon's design system for all UI and visual work in this repo, unless Marlon explicitly asks for a different design. Apply it to anything new or changed; don't restyle existing screens unless he asks.

Full system (tokens, components, guidelines): https://claude.ai/artifact/1Y4i8zEmBJe23xbFoRvJjA

**Look:** clean, minimal, mostly black and white. Cool true grays, never cream or beige. One orange (`signal`) used sparingly: if more than one orange thing is visible at a glance, remove one.

**Colors** (light / dark):

| Token | Light | Dark | Use |
|---|---|---|---|
| paper | #fafafa | #0e0e0e | Page background |
| paper-raised | #ffffff | #1a1a1a | Cards, menus, inputs |
| line | #e4e4e4 | #2e2e2e | Borders, dividers |
| ink | #111111 | #f2f2f2 | Text; primary button fill |
| ink-muted | #5e5e5e | #a3a3a3 | Secondary text |
| on-ink | #ffffff | #111111 | Text on an ink fill |
| signal | #ff4f00 | #ff5f1a | The one orange: a dot, one tag, one highlighted number |
| signal-text | #c23b00 | #ff7a40 | Orange as text |
| on-signal | #111111 | #111111 | Text on an orange fill (never white) |
| signal-soft | #ffe9df | #3a1a0d | Rare tint behind signal-text |
| danger | #b42318 | #f97066 | Errors and destructive actions only |

**Type** (Google Fonts): Source Serif 4 semibold for headlines only (display 48/52, heading 24/30, slightly negative tracking). Geist for body and all UI (body 16/24, small 14/20). Geist Mono for labels, tags, data and code (label 12/16, weight 500, uppercase, 0.08em tracking).

**Shape and space:** 4px base (4, 8, 16, 24, 40). Radius 4px inputs, 8px buttons and cards, full pills for tags. Borders over shadows; one soft shadow for floating things. Focus ring: 2px paper gap, then a 2px ink ring.

**Components:** primary buttons are ink fills with on-ink labels (once per view); secondary is an outline on paper-raised; ghost is text only. Cards are paper-raised with a line border, a mono eyebrow, a serif title and muted body. Tags are mono uppercase pills (neutral outline, ink, or one signal). Inputs have a label above, hint below, danger for errors.

**Voice:** short plain sentences, lead with what it does and who it's for, receipts over claims, one clear ask per page, no hype words or decorative emoji. Text must meet 4.5:1 contrast in both themes.
