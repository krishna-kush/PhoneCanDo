# Mental model

## Layers

```
AI (opencode plugin / MCP / Code Mode)
  ↕  contract v1 (JSON, semver, stable)
Gateway (loopback bridge)
  - auth, session, TTL, allowlist, audit, rate limit
  - describe / observe / act / execute / flow / doctor
PCE
  - scheduler (one lane, timeout, cancel)
  - observer (windows, tree, screenshot, meta)
  - resolver (selectors, scoring, ambiguity)
  - executor (typed actions, gestures, input, waits)
  - verifier (postconditions, stability, diff)
  - backend router (a11y, IME, optional Shizuku, vision)
  - pack runtime (selectors, flows, app notes)
Data
  - packs/<id>/<version>/pack.json
  - manifest.json + manifest.json.sig (signed, compatibility)
  - trace ring buffer + artifacts
```

- The gateway is the host boundary: it authenticates, gates, validates and
  audits. It does not grow a second automation engine.
- The PCE owns observation, resolution, execution, verification, trace and
  packs. Backends own platform access.
- Data is separate from code: packs carry app knowledge; the runtime executes
  no pack code.

## Three update speeds

This is the part a fixed driver cannot do.

| Layer | Changes | How it ships | Compatibility |
|---|---|---|---|
| **Contract** | API shape, error codes, action IDs | rarely; semver | additive minor versions; old clients keep working |
| **PCE** | new backends, new action types, fixes | APK release | packs declare `minPce` |
| **Packs** | app selectors, flows, notes, verification | signed JSON, hot reload | declare `contract`, `minPce`, app `versionCode` range |

The AI's app knowledge is data, not code. A Zepto redesign updates a pack,
not the APK. A new backend is a PCE release. The contract stays stable.

## Why this is “updatable”

Orb-eye is a fixed script: every new app behavior is a code change, every
Android quirk is a fork edit, and the AI gets whatever tools happened to be
compiled in. This framework separates:

- **what the AI can do** (contract + action registry),
- **how the device does it** (backends),
- **what a specific app needs** (signed packs),
- **how well it worked** (traces + eval).

That separation is what lets the framework survive Android changes, app
redesigns, and new AI clients without another rewrite.

## Host and PCE boundary

- The host owns auth, the biometric gate, the master switch, AI tool names,
  prompts, UI, app lifecycle, the foreground service and notifications.
- The PCE owns snapshots, selectors, typed actions, verification, trace and
  packs.
- The PCE never depends on PhoneCanDo, React Native, Expo, NanoHTTPD or
  `mobile_*` names. See `pce/AGENTS.md`.

## Related

- Tool surface: `tools.md`
- Action registry: `actions.md`
- Backend mapping: `backends.md`
- Host implementation status: `../../app/docs/modules/automation.md`
