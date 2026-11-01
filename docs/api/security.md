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
  only; exportable; no telemetry.
- Bridge stays loopback-only with a bearer; rotate the token per serve start
  (target; current builds use an install-stable token).
- Packs are signed data. No raw shell action is exposed to the model.

Current implementation notes:

- The bridge token is install-stable in prefs (`bridge_token`) and handed to
  serve through env only, never a config file.
- The gate is in-memory, defaults off and resets with the app process. See
  `../../app/docs/modules/bridge.md` for the exact 403/503 behavior.
- opencode 2.0.26 has no `ctx.permission.assert`, and Code Mode's `execute`
  bypasses top-level permission rules for plugin tools. The app-side master
  switch is the gate until opencode is bumped.
