<p align="center">
  <img src="public/logo.svg" width="64" alt="PhoneCanDo logo" />
</p>

<h1 align="center">PhoneCanDo web</h1>

<p align="center">
  The site at <a href="https://phonecando.app">phonecando.app</a><br/>
  Static Astro · no backend · no CDN · no external JS
</p>

```sh
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # → dist/
```

Astro is pinned to 7.3.0 (7.4 needs Node ≥ 22.23.4); bump the two together.

## Where things live

| Change | Edit |
|---|---|
| Release facts: date, sizes, both SHA-256s, repo | nothing: `./manage release` writes `src/data/release.json` |
| Site name, tagline, specs, media paths | `src/data/site.ts` |
| Version, APK links, the adb command | nothing: derived from `app/app.json` |
| Section copy · order | `src/components/sections/*.astro` · `src/pages/index.astro` |
| Demo cards | `src/data/demos.ts` |
| Colours (shared with the app) | `theme/tokens.json` |
| Type, spacing, layout | `src/styles/global.css` |
| Logo, favicons, loader | `theme/logo.json`; `pnpm logos` (repo root) redraws the icon files |
| Social card | `public/og.png`, hand-built; redo it when the headline changes |

A production build fails if `release.json` belongs to another version than
`app/app.json`. `global.css` is one file of named blocks, each owning its
`@media` rules: `grep -n '^/\* ---------- ' src/styles/global.css`.

## Look

A field manual, not a SaaS page: Instrument Serif display, Geist body, Geist
Mono labels, signal red and safety amber on warm paper or night ink. Fonts ship
through `@fontsource`. The page opens in the OS theme and the nav toggle lasts
one visit; phone screens and media stay dark in both (`--art-*`).

## Recordings

Every media slot shows a labelled slate until its file exists, never a mock.

| Slot | Drop files in | Then set |
|---|---|---|
| Hero | `public/` | `hero` in `site.ts` |
| Demos | `public/demos/` | `video`, `poster` in `demos.ts` |
| Gate | `public/` | `gate` in `site.ts` |
| Install | `public/` | `install` in `site.ts` |

720×1560 H.264 MP4, muted, ≤ 3 MB, 6–10 s (the install walkthrough runs
~40 s), JPG poster from the first frame. Cards crop to 9:16, so keep the UI
centred.

## Deploy

Any static host serving `dist/`. Cloudflare: root `web`, build `pnpm build`,
output `dist`; `wrangler.jsonc` adds the 404 page. `site` in
`astro.config.mjs` sets the domain for canonical and OG URLs.
