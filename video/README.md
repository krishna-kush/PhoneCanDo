# PhoneCanDo intro video

The 50-second intro for YouTube, LinkedIn and the feeds. A phone types on
its own, the camera dives in, and A-01 takes you through the field manual's
pages to phonecando.app, in one continuous camera. It is its own pnpm
package, and its only dependencies are the site's fonts. It reads
`theme/tokens.json`, `mascot/` and the agent manifests as they are, so it
stays true when those change.

```sh
pnpm -C video install
pnpm -C video sound                  # music and effects → out/audio/
pnpm -C video render --format 16x9   # → out/phonecando-intro-16x9.mp4 and its thumbnail
pnpm -C video preview                # scrub it in a browser: space plays, arrows step a beat
```

You need Node 22.18 or newer, ffmpeg on the PATH, and Chrome or Chromium
(set `CHROME=/path/to/chrome` when neither is on the PATH). Everything
lands in `out/`, which git ignores. A whole 16:9 render draws 3,016 frames,
about a quarter of an hour at 3 to 4 frames a second, so check a change
with stills or a slice first.

## Render options

| Flag | What it does |
|---|---|
| `--format 16x9\|9x16\|1x1` | The frame size; all three when left out |
| `--stills b44,b46.5` | PNGs at those beats (or seconds) in `out/stills/<format>/` |
| `--from b40 --to b48` | Only that stretch: `out/phonecando-intro-<format>-<first>-<last>.mp4` |
| `--draft` | 30 fps at half size into `out/draft/`, fast |
| `--thumbnail` | Only YouTube's thumbnail (a whole 16:9 render writes it too) |
| `--remux` | Lays a new `pnpm sound` under the videos already made, drawing nothing |
| `--splice --from … --to …` | Draws that stretch again and sets it into the videos already made |
| `--look night\|stage\|dots\|paper\|day` | Another look; Daylight (`day`) is ours |
| `--workers n` | Chrome pages drawing at once; a third of the cores when left out |

## Where things live

| Change | Edit |
|---|---|
| A scene's words, moments or sounds | `src/timeline/script/<scene>.ts` |
| The running order, a scene's length | `src/timeline/scenes.ts`, the script's `beats` |
| The tempo (138 BPM) | `src/timeline/tempo.ts` |
| How a scene looks and moves | `src/picture/scenes/<scene>.ts`, its CSS in `src/picture/style/` |
| Going inside something (the screen, A-01's pupil, the Linux layer, the fingerprint) and the pull-back at the end | The scene's `portal` and `pull`; the camera is `src/picture/zoom/` |
| Every other hand-off: the stage crew changing the set by hand | The scene's `gag`, one file per set change in `src/picture/stagehands/` |
| Shared pieces: the terminal, phone, stamps, bubbles, words, backdrop, HUD | `src/picture/parts/` |
| The units | `mascot/` (shared with the site and the app), drawn by `src/picture/unit/` |
| Colours | `theme/tokens.json`; the looks over it in `src/picture/looks.ts` |
| The agent count and cards | Nothing: read from `agents/*/*/agent.json` (`src/facts/`) |
| A sound effect | Its name and brief in `src/timeline/sfx.ts`, the sound in `src/sound/sfx/`, its level in `src/sound/sfx/levels.ts` |
| The music | Each section's brief in `src/timeline/music.ts`, the parts in `src/sound/score/` |
| Loudness | `TARGET` and `CEILING` in `src/sound/render.ts` (−14 LUFS, −3.2 dBTP) |
| Frame sizes | `src/render/formats.ts` |

## How it works

`src/timeline/` is one beat line that picture and sound share. Each
scene's script holds its words, the moments its picture moves on and the
sounds that land there, so a hit on screen and in the mix are the same
number. `src/picture/` is a page that draws any moment on demand
(`window.__frame(seconds)`). Each frame sets everything from the time
alone, so frames can be drawn in any order and in parallel. `src/render/`
drives headless Chrome over the DevTools protocol and encodes the frames
with ffmpeg. `src/sound/` synthesizes the music and effects, with no
samples, and masters the mix. Node runs the TypeScript as it is, with no
bundler and no build step.

Checks: `pnpm -C video typecheck` and `pnpm -C video test`.
