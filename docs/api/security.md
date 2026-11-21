# Security and trust

The bullets below are the contract target. Current implementation notes follow
them.

- The app-side biometric gate is the only thing that arms automation. The
  agent cannot flip it.
- Arm with a TTL (e.g. 5 minutes idle) and a persistent “PhoneCanDo is controlling
  your phone” notification with a stop action.
- Per-app allowlist; first control of a new package asks the user.
- Risk levels on every action; high-risk requires confirmation.
- Redact `password` fields and OTP inputs from observations and screenshots.
- Audit log: timestamp, package, action, selector, result, trace ID. Local
  only; exportable; never sent anywhere. Usage telemetry is separate and
  carries no audit entries, selectors, screen content or package names of
  controlled apps: see `../telemetry.md`.
- Bridge stays loopback-only with a bearer; rotate the token per engine start
  (target; current builds keep one token per agent for its lifetime).
- Packs are signed data. No raw shell action is exposed to the model.

Current implementation notes:

- Each agent has its own bridge token, made with the agent (192 bits from
  `SecureRandom`) and kept with its record in `files/state/agents.json`. It
  reaches only that agent's engine, through env, never a config file, and
  names the calling agent on every bridge request. Guest commands in a
  Linux image do not inherit it, and every agent's password and token are
  redacted from logs and crash reports.
- A program an agent runs acts as that agent. Everything in a machine runs
  as the app's one Android user (proot keeps work apart; it is not a
  sandbox), so a command an image agent starts inherits its bridge token and
  can read its keys, sign-in and files. The token works only on the phone's
  loopback, and the phone tools still need the phone-control unlock.
- Accessibility turns itself off once nobody uses it (Auto off, on by
  default, Settings → Phone control): 10 s after you leave PhoneCanDo with
  no agent wanting the screen, never in its first 2 minutes. Only you switch
  it back on, in Android's settings, so control does not sit open while
  unused, and bank apps open.
- The gate starts locked. Settings → Phone control picks how long an unlock
  lasts: once per install (kept across restarts until you lock it), each
  app launch, or each agent's ask (that agent alone, until it hands the
  phone back). The saved mode and unlock are signed with Android Keystore
  keys that sign only right after your fingerprint or screen lock, so an
  agent writing the app's files cannot unlock itself. One agent drives the
  screen at a time (the screen lease).
  See `../../app/docs/modules/bridge.md` for the exact 403/409/503
  behavior.
- A password field's value never reaches an agent: the PCE core replaces
  its text and description with `[hidden]` in every observation, whatever
  Android handed over (`pce/core/.../SnapshotAssembler.kt`). Android draws
  password fields masked, so screenshots show dots. OTP fields are not
  marked by Android and are not hidden yet; the agent's note tells it to
  hand the phone over for passwords, codes and payments.
- opencode 2.0.26 has no `ctx.permission.assert`, and Code Mode's `execute`
  bypasses top-level permission rules for plugin tools. The app-side master
  switch is the gate until opencode is bumped.
