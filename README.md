<p align="center">
  <img src="web/public/logo.svg" width="88" alt="PhoneCanDo logo" />
</p>

<h1 align="center">PhoneCanDo</h1>

<p align="center">
  <strong>Your phone is the computer. Just Ask, phonecando.</strong><br/>
  On-device agent chat, a real terminal, and phone control — all on Android.
</p>

<p align="center">
  <a href="LICENSE"><img alt="Source-available" src="https://img.shields.io/badge/license-source--available-111?style=flat-square"></a>
  <img alt="Android" src="https://img.shields.io/badge/platform-Android-3DDC84?style=flat-square&logo=android&logoColor=white">
  <img alt="Alpha" src="https://img.shields.io/badge/status-alpha-f59e0b?style=flat-square">
</p>

---

PhoneCanDo runs coding agents on the phone:
[opencode](https://github.com/anomalyco/opencode) built in, and Claude Code or
Gemini CLI installed into a Linux machine on the phone. No remote server, no
relay. The agents, sessions, keys and terminal live on the device. Home is the
agent's own UI (opencode's web UI, or the agent's TUI); terminals run over our
own JNI PTY.

PhoneCanDo is an independent project. It is not affiliated with or endorsed by
anomalyco, Anthropic or Google. opencode is MIT-licensed and built into the
app; other agents are installed from their vendors under their own terms.

Model calls go to the provider you configure. Your sessions, files and keys
stay local; the app's network calls are listed in
[`docs/telemetry.md`](docs/telemetry.md).

## What it does

| | |
|---|---|
| **Chat** | The agent's own UI: opencode's web UI paired with the local engine, or the agent's TUI. |
| **Several agents** | Pick the agent when you make a machine. Run as many at once as RAM allows (or set a cap in Settings), each with its own engine; switch between them from the header. Near the RAM peak the app warns and lists what runs, and stops the sleepiest itself if you don't. |
| **Linux machines** | Each agent works in its own Linux image (proot): the Debian-based default ships in the APK, or pick any arm64 image from Docker Hub. Packages you or the agent install stay in that image. It keeps your work apart; it is not a security sandbox. |
| **Terminal** | A real PTY and TUI, rendered by xterm.js; or a Linux shell inside an agent's image. |
| **Phone control** | Accessibility-driven observe/act, gated by an in-app switch. |
| **Three channels** | `full` with phone control and Linux; `lite` with Linux but no phone control, the download that installs `full` in place; `play` with neither (agents use Android's shell). |
| **Local by default** | Sessions, files and keys stay on the device. Anonymous usage stats are on by default, one switch turns them off (Settings → Privacy), and they carry nothing from your sessions or keys: [`docs/telemetry.md`](docs/telemetry.md). |

## How it fits

```text
┌────────────────────────────── Android ──────────────────────────────┐
│  React Native + Tamagui                                             │
│    ├─ Home      web UI (opencode) | agent TUI                       │
│    ├─ Terminal  xterm.js ── JNI PTY ── TUI | Linux shell            │
│    └─ Settings / Env                                                │
│                                                                     │
│  foreground service ── agent engines (≤ 3) ── proot Linux machines  │
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
# (pinned upstream clone) and the env vars; full steps:
# agents/native/opencode/docs/README.md
./manage agent opencode build /path/to/workdir
./manage agent opencode stage /path/to/workdir/out

pnpm -C app android:full
```

See [`agents/native/opencode/docs/build.md`](agents/native/opencode/docs/build.md) for the exact
toolchain, patches and verification.

## Channels

| Channel | Command | Phone control | Updates |
|---|---|---|---|
| Full | `pnpm -C app android:full` | Yes — accessibility service + PCE | GitHub Releases |
| Lite | `pnpm -C app android:lite` | No — no accessibility service, no PCE | GitHub Releases |
| Play | `pnpm -C app android:play` | No — no accessibility service, no PCE | Play (later; not released) |

Channels are Gradle product flavors in one project, so native libraries
compile once for all of them. Debug builds install as separate apps per
channel, `com.phonecando.app.<channel>.dev` ("PhoneCanDo Lite Dev", "PhoneCanDo
Full Dev"), next to the release one. Lite and full share the package and signing
key; lite uses a lower version code so the full APK can replace it.

Why lite exists: Play Protect blocks any browser or file-manager download that
declares an accessibility service ("App blocked to protect your device", no
install-anyway). Lite declares none, so it installs; on first launch it offers
the full build and installs it in place, which Play Protect allows. Android
13+ then locks the accessibility switch for the sideloaded app, and Settings →
Phone control walks the user through unlocking it in three steps. Device-proven;
see `docs/release/upgrade-test.md` and `research/restricted-settings.md`.

## Commands

`./manage` at the repo root wraps every script: `./manage help` lists them.
`./manage release <next-version> --notes "..."` builds full and lite, audits
both and drafts the GitHub release; add `--publish` to publish.

| Task | Command |
|---|---|
| App deps | `pnpm -C app install` |
| Typecheck | `pnpm -C app exec tsc --noEmit` |
| Vectors | `pnpm -C app check:vectors` |
| Web dev | `pnpm -C web dev` |
| Web build | `pnpm -C web build` |
| Telemetry backend checks | `pnpm -C tce check && pnpm -C tce test` |
| Download and usage counts | `./manage stats [--d1]` |

## Docs

| | |
|---|---|
| Architecture | [`docs/overview/architecture.md`](docs/overview/architecture.md) |
| App + engine | [`app/docs/README.md`](app/docs/README.md) |
| opencode build | [`agents/native/opencode/docs/build.md`](agents/native/opencode/docs/build.md) |
| Phone control | [`pce/README.md`](pce/README.md) |
| Telemetry (schema, privacy) | [`docs/telemetry.md`](docs/telemetry.md), [`tce/README.md`](tce/README.md) |
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
