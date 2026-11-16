# moto g96 5G

Our test phone. Results depend on the phone, so each phone has its own
folder and its own rounds (`rounds/`).

## The phone

| | |
|---|---|
| Model | moto g96 5G |
| Android | 16 |
| RAM | 7.21 GiB (8 GB class) |
| Screen lock | on, and only I can open it |
| App | PhoneCanDo Full Dev (`com.phonecando.app.full.dev`), a debug build with JS from Metro; which build when: [builds.md](../../builds.md) |

Because of the lock, testers keep the screen on
(`adb shell svc power stayon usb`), never turn it off unless the plan says
so, and set `stayon false` at the end. After a reboot, or if the lock shows,
the tester waits for me to unlock it.

## Agents

The agents the cases use, named as the reports name them:

| Agent | Kind | Model |
|---|---|---|
| A-01 | opencode | cloud |
| A-04 | Claude Code | local Qwen3.5 0.8B |
| A-05 | Gemini CLI | cloud (free quota often used up) |
| A-10 | Codex | local Qwen3.5 0.8B |
| A-12 | opencode ("opencode 8") | cloud |
| A-14 | Qwen Code | cloud, ACP mode needs sign-in |

On 2026-11-15 the phone had 15 agents in all. The others the testers met:
A-02 opencode ("opencode 3", a busybox machine with 3 tools missing), A-08
Aider, A-09 Cline, A-11 goose (not installed), A-13 Codex ("Codex 2"), A-15
goose ("goose 2"), and top.

## Local models

| Model | Size | Notes |
|---|---|---|
| Qwen3.5 0.8B Q4_K_M | 533 MB | hybrid (some recurrent layers); runs at 32k context of 256k here, chats on storage, 1.4 GB measured (W2-4) |
| Qwen3.5 4B Q4_K_M | 2.7 GB | hybrid (some recurrent layers); measured since W2-4: 16k with half-size notes, 4.1 GB, "Too big for this phone" (an open question in `lme/docs/planning/todo.md`) |

The 0.8B reads a fresh Claude Code prompt (about 14,000 tokens) in about 5
minutes.

## Known quirks

- `uiautomator dump` fails on the drawer, Home, agent pages and model pages
  ("could not get idle state"), and on screens still moving. Sometimes it
  returns an old tree. Screenshots are needed there.
- `adb shell input keycombination 113 31` does not send ^C to an agent's
  terminal: use the ^C key on the extra keys bar.
- `adb shell input text` goes nowhere until the box has focus: tap it first.
- A header tap sometimes misses the drawer while the keyboard is up.
- If the app shows a red box about `loadJSBundleFromAssets`, run
  `adb reverse tcp:8081 tcp:8081` and reload.
- A blue "Refreshing..." banner means Metro sent new JS mid-test: note the
  time.
- Turning the screen off locks the phone.
- My own notifications share the shade: look only at PhoneCanDo's.

## Rounds

Each round is a folder in `rounds/`, named
`<YYYY-MM-DD-HHMM>-<build>-<slug>` by the local time it started. The list
of rounds per build is in [builds.md](../../builds.md).
