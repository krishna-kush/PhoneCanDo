# PhoneCanDo videos

Every video we make lives here: an engine any film runs on, our look, and
one folder per film. It is its own pnpm package, built on
[Remotion](https://www.remotion.dev): a film's picture is React components
drawn frame by frame in Chrome, its sound is synthesized in plain Node, and
both are written on one beat line, so a hit on screen and in the mix are
the same number.

```sh
pnpm -C videos install
pnpm -C videos studio                         # preview every film: timeline, scrub, sound
pnpm -C videos sound field-notes              # its music and effects → public/field-notes/mix.wav
pnpm -C videos render field-notes             # → out/field-notes/field-notes-16x9.mp4
pnpm -C videos stills field-notes b12,gate+2  # full-size PNGs of those moments
pnpm -C videos stills field-notes --strip gate..gate+4   # a move as one picture
```

You need Node 22.18 or newer, ffmpeg on the PATH, and Chrome or Chromium
(set `CHROME=/path/to/chrome` when neither is on the PATH; with none,
Remotion downloads its own). Renders land in `out/` (a film's sound stems
too, in `out/<film>/audio/`) and the mix the picture plays in `public/`;
git ignores both. `pnpm studio` and `pnpm render` make a film's sound first
when it has none yet. Check a change with stills or a strip before
rendering: a whole film is thousands of frames.

Remotion is free for teams of up to three people and needs a company
licence above that: <https://www.remotion.dev/docs/license>.

## The layout

```
engine/    runs any film, knows nothing about PhoneCanDo
  beats/     a film's tempo, cues and shots: the beat line (pure)
  motion/    eases, keys, springs, hops and squash, eyes (pure)
  stage/     frame sizes, u, the camera, pins, the picture's clock
  sound/     synth, instruments, effects, mix and master (pure, Node)
  render/    a film as Remotion compositions, and our commands
brand/     our look, shared by every film
  looks/     theme/tokens.json as the site's vars, the fonts, the type
  units/     the mascots from mascot/, drawn
  parts/     the page ground, and what films share as they grow
  facts/     what films read from the repo (agent names)
films/     one folder per film
  index.tsx  every film there is
  <id>/      beats.ts (tempo, shots), film.tsx (picture), sound.ts, score/
```

One law, kept by `engine/law.test.ts`: **engine ← brand ← films**. The
engine never imports the brand or a film, the brand never imports a film,
no film imports another, and `beats/`, `motion/` and `sound/` import
neither Remotion nor React.

## Making a new film

1. Add `films/<id>/beats.ts`: its `TEMPO` and its `LINE`, the shots in
   running order with their lengths in beats.
2. Add `films/<id>/film.tsx`: a `Film` with its `Picture`, a component that
   draws the frame at `useBeat()`. Wrap it in `LookFrame` for our colours
   and faces; place things in `u` (a hundredth of the frame's short side)
   with `At` and `Camera`, so every format lays out from the same numbers.
3. Add it to `films/index.tsx`.
4. For sound, add `films/<id>/sound.ts` (its cues and score) and set
   `sound: true` on the film.

Write every move in beats, never frames: a draft renders at another frame
rate from the same film.

## Render options

| Flag | What it does |
|---|---|
| `--format 16x9\|9x16\|1x1` | One frame size; every one the film is made in when left out |
| `--draft` | 30 fps at half size into `out/<film>/draft/`, fast |
| `--shot gate` | Only that shot |
| `--from b40 --to gate+4` | Only that stretch |
| `--workers n` | Chrome tabs drawing at once; a third of the cores when left out |

A moment is a beat (`b12.5`), a shot's name (`gate`), a shot plus beats
(`gate+2`) or a number of seconds.

## Where things live

| Change | Edit |
|---|---|
| A film's tempo, its shots and their lengths | `films/<id>/beats.ts` |
| How a film looks and moves | `films/<id>/film.tsx` and what it draws from |
| A film's sounds and music | `films/<id>/sound.ts`, `films/<id>/score/` |
| Colours | `theme/tokens.json`; the roles films use are `brand/looks/look.ts` |
| The units | `mascot/` (shared with the site and the app), drawn by `brand/units/` |
| A sound effect | `engine/sound/effects/` |
| Frame sizes | `engine/stage/formats.ts` |
| Render quality | `FINAL` and `DRAFT` in `engine/render/cli.ts` |

Checks: `pnpm -C videos typecheck` and `pnpm -C videos test`.
