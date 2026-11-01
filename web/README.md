# phonecando web

Marketing site for PhoneCanDo. Static Astro, no backend. One tiny inline script
powers the theme toggle; everything else is HTML + CSS. Deploys as plain
files.

```sh
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # -> dist/
```

Astro is pinned to 7.3.0 because the host Node is 22.23.0 (Astro 7.4 needs
22.23.4). Bump both together.

## Themes

The page starts in the OS theme (`prefers-color-scheme`); the nav toggle
switches for the current visit only, so every load starts in the device
theme. Light is warm paper (`#f2ecdf`) with a faint noise grain and the hero
grid; dark is warm night ink (`#0c0b09`). Tokens live at the top of
`src/styles/global.css`. Phone screens, demo media and the gate recording stay
dark in both themes on purpose (`--art-*` tokens); terminals and the
small hero session card follow the theme.

## Design

The site is built as a field manual, not a SaaS landing page: Instrument Serif
display type, Geist sans body, Geist Mono labels, signal red + safety amber
inks, sharp plates, registration ticks, figure labels, a consent gate and a
printed colophon. The amber is `#fdc50d` on paper for rules, fills and shadows,
a deeper `#7a4f00` for small text, and `#f59e0b` in dark. Fonts are bundled
through `@fontsource`, so there is still no external JS or CDN request. The eight demo cards are plates; the model section is a freight manifest — a red-taped model crate with two routes into it — with an in-development stamp; the gate section is one consent plate — locked, the biometric prompt, armed — carrying the real `403 automation_off` that refuses every phone action. The top edge is a contained, one-shot linear loader. Media cards swap in the logo-derived loader on real video `loadstart`/`waiting` signals, and fall back to a static mark under reduced motion.

## Edit here, nowhere else

| What | File |
|---|---|
| Version, APK URL, size, SHA-256, repo links | `src/data/site.ts` |
| Demo gallery cards + video paths | `src/data/demos.ts` |
| Colours, type, spacing | `src/styles/global.css` |
| Section copy | `src/components/sections/*.astro` |
| Section order | `src/pages/index.astro` |
| Favicon / PWA / logo mark | generated; run `pnpm logos` at the repo root |
| Social card | `public/og.png` |

`global.css` is one file in named blocks (`nav`, `hero`, `gate`, …). Find one
with `grep -n '^/\* ---------- ' src/styles/global.css`. A block keeps its own
`@media` rules; only reduced motion is global.

## Brand assets

`pnpm logos` (repo root) regenerates `public/favicon.svg`, the PNG favicons,
PWA/Apple icons and `logo.svg` from `theme/tokens.json` plus the mark geometry
in `theme/logo.json`. Don't hand-edit those. The same file holds the loader
timing/poses; `src/lib/logoLoaderCss.ts` generates its CSS and the app imports
the file directly, so one edit updates both. `og.png` is still the hand-built
social card.

## Phone recordings

Every slot renders a labelled slate until a file exists — no fake UI anywhere.

- **Hero** — put the clip in `public/`, then set `hero.video` and
  `hero.poster` in `src/data/site.ts`. Plays muted on loop.
  The small hero session card is decorative; it needs no media.
- **Demos** — drop files in `public/demos/`, then fill `video` and `poster`
  in `src/data/demos.ts`. The card switches from slate to `<video>` on its
  own (tap to play, native controls, nothing preloads).
- **Gate** — the in-app biometric prompt. Drop the clip in `public/`, then set
  `gate.video` and `gate.poster` in `src/data/site.ts`.

Media spec: 720×1560 (9:19.5), H.264 MP4, muted, 6–10 s, ≤3 MB per clip,
poster JPG from the first frame. The card crops to 9:16, so keep UI inside
the middle.

## Deploy

Cloudflare Pages (or any static host): root `web`, build `pnpm build`,
output `dist`. Set the real domain in `astro.config.mjs` (`site`) so the
canonical URL and OG tags are absolute.

## Left to fill

- `src/data/site.ts`: repo URL, direct APK asset URL, build date, SHA-256.
- `astro.config.mjs`: real domain (currently `https://phonecando.app`).
- `public/og.png` is generated from the design — regenerate if the headline
  changes.
