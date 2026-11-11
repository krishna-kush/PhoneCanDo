<p align="center">
  <img src="public/logo.svg" width="64" alt="PhoneCanDo logo" />
</p>

<h1 align="center">PhoneCanDo web</h1>

<p align="center">
  The site at <a href="https://phonecando.app">phonecando.app</a><br/>
  Static Astro · served by the tce Worker · no CDN · no external JS
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
| Live host (QR code), download route | `liveOrigin`, `dlUrl()` in `src/data/site.ts` |
| Page-view beacon | the inline script at the end of `src/layouts/Base.astro` |
| Privacy note | `src/components/privacy/*.astro` (one per section) · `src/pages/privacy.astro`; change it with `docs/telemetry.md` |
| What the mascot says (per section, when you scroll too fast, when you play with a toy) | `src/data/mascot.ts`; 17 characters a line at most. Toys cue it through `src/lib/mascotCue.ts` |
| Section copy · order | `src/components/sections/*.astro` · `src/pages/index.astro` |
| Demo cards | `src/data/demos.ts` |
| Models booster pack: agent cards, brain cartridges | the agents: nothing, read from `agents/*/*/agent.json` at build time; their creatures and the cartridges: `src/data/agentCards.ts`; the pack's rules and wiring: `src/lib/booster/` |
| Colours (shared with the app) | `theme/tokens.json` |
| A section's or component's look | the `<style is:global>` at the bottom of its `.astro` file |
| Shared pieces: vars, reset, labels, buttons, section scaffolding | `src/styles/` (`global.css` lists them) |
| Logo, favicons, loader | `theme/logo.json`; `pnpm logos` (repo root) redraws the icon files |
| Social card | `public/og.png`, hand-built; redo it when the headline changes |

A production build fails if `release.json` belongs to another version than
`app/app.json`. CSS lives with what it styles: a rule two or more components
use goes in `src/styles/primitives/`, anything else in its component, each
file owning its `@media` rules. The header of `src/styles/global.css` has the
cascade order (layers, set inline in `Base.astro`) and why component styles
are `is:global`.

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

The site itself is static: `pnpm build` writes `dist/`. The server around it
is the `phonecando` Cloudflare Worker in `tce/hosts/cloudflare/` (config:
`wrangler.jsonc` there). On `phonecando.app` it serves only `dist/`, as static
assets with the 404 page, so every path there is a page. Its routes live on
the API host `https://api.phonecando.app` (`apiOrigin` in `src/data/site.ts`):
`/v1/*` for app usage stats, the page-view beacon (`/v1/hit`) and the
download buttons (`/v1/dl/lite`, `/v1/dl/full`: count the download, then 302
to that version's APK on GitHub). See `tce/README.md`.

Cloudflare Workers Builds builds and deploys it on every push to `prod`; there
is no local deploy step, and GitHub Actions deploys nothing (`web.yml` and
`tce.yml` only check). It is live at `https://phonecando.app`, the `site` in
`astro.config.mjs`.

The download buttons and the QR code always point at the live API host, also
from `pnpm dev` and `pnpm preview`; the beacon stays silent off https and on
localhost.
