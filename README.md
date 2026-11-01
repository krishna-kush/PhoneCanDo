<p align="center">
  <img src="web/public/logo.svg" width="88" alt="PhoneCanDo logo" />
</p>

<h1 align="center">PhoneCanDo</h1>

<p align="center">
  <strong>Your phone is the computer.</strong><br/>
  On-device agent chat, a real terminal, and phone control — all on Android.
</p>

<p align="center">
  <a href="LICENSE"><img alt="Source-available" src="https://img.shields.io/badge/license-source--available-111?style=flat-square"></a>
  <img alt="Android" src="https://img.shields.io/badge/platform-Android-3DDC84?style=flat-square&logo=android&logoColor=white">
  <img alt="Alpha" src="https://img.shields.io/badge/status-alpha-f59e0b?style=flat-square">
</p>

---

PhoneCanDo runs [opencode](https://github.com/anomalyco/opencode) on the phone.
No remote server, no relay. The engine, sessions, keys and terminal live on the
device. The home tab is the pair-loaded opencode web UI; the terminal tab is a
full TUI over an own JNI PTY.

PhoneCanDo is an independent project. It is not affiliated with or endorsed by
opencode or anomalyco; opencode is MIT-licensed and is used as the on-device
engine.

Model calls go to the provider you configure. Everything else stays local.

## What it does

| | |
|---|---|
| **Chat** | The opencode web UI, paired with the local engine. |
| **Terminal** | A real PTY and TUI, rendered by xterm.js. |
| **Phone control** | Accessibility-driven observe/act, gated by an in-app switch. |
| **Two flavors** | `full` with phone control; `play` without the accessibility service. |
| **Local by default** | No telemetry. Sessions and keys stay on the device. |

## How it fits

```text
┌────────────────────────────── Android ──────────────────────────────┐
│  React Native + Tamagui                                             │
│    ├─ Chat      WebView ── opencode web UI (pair-loaded)            │
│    ├─ Terminal  xterm.js ── JNI PTY ── TUI                          │
│    └─ Settings / Env                                                │
│                                                                     │
│  foreground service ── opencode serve (Bionic, Bun)                 │
│  PCE ── accessibility service ── observe / act                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick start

**Requirements:** Node 22, pnpm 11, Android SDK + NDK r28c, Zig 0.16, Bun 1.4.2,
and ~15 GB disk for the opencode build.

The opencode payload is not in git, and the app build does not build it. Build it
once with the bootstrap scripts:

```sh
pnpm -C app install

# Payload: Bun 1.4.2, NDK r28c, Zig 0.16. The workdir needs oc-v2/
# (pinned upstream clone) and the env vars; full steps: docs/bootstrap/README.md
./scripts/bootstrap/build-engine-android.sh /path/to/workdir
./scripts/bootstrap/stage-v2.sh /path/to/workdir/out

pnpm -C app android:full
```

See [`docs/bootstrap/oc-build.md`](docs/bootstrap/oc-build.md) for the exact
toolchain, patches and verification.

## Flavors

| Flavor | Command | Phone control |
|---|---|---|
| Full | `pnpm -C app android:full` | Yes — accessibility service + PCE |
| Play | `pnpm -C app android:play` | No — no accessibility service, no PCE |

## Commands

| Task | Command |
|---|---|
| App deps | `pnpm -C app install` |
| Typecheck | `pnpm -C app exec tsc --noEmit` |
| Vectors | `pnpm -C app check:vectors` |
| Web dev | `pnpm -C web dev` |
| Web build | `pnpm -C web build` |

## Docs

| | |
|---|---|
| Architecture | [`docs/overview/architecture.md`](docs/overview/architecture.md) |
| App + engine | [`app/docs/README.md`](app/docs/README.md) |
| opencode build | [`docs/bootstrap/oc-build.md`](docs/bootstrap/oc-build.md) |
| Phone control | [`pce/README.md`](pce/README.md) |
| Research | [`research/README.md`](research/README.md) |

## Security

Phone control is gated by an in-app biometric/PIN switch and a foreground
notification. The bridge binds to loopback only. The `play` flavor has no
accessibility service. See [`docs/api/security.md`](docs/api/security.md) and
[`app/docs/modules/bridge.md`](app/docs/modules/bridge.md).

## License

Source-available, not OSI open source. You may read the code and contribute;
you may not copy, use, or distribute it. The official app published by the
copyright holder is the only distributed build. See [`LICENSE`](LICENSE).

Third-party code keeps its own license. Required notices are in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md); every release must include
them.

## Contributing

Read [`AGENTS.md`](AGENTS.md) before changing native, IME, sizing or automation
code. Issues and pull requests are welcome; by submitting one you agree to the
contribution terms in [`LICENSE`](LICENSE).
