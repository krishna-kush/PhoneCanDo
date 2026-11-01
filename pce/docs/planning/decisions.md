# Settled decisions

- **JSON:** kotlinx.serialization DTO mapping in `json`; `api` stays
  annotation-free.
- **Scheduler:** core `Mutex` lane; the host may still call `resolve`
  concurrently because it reads the current snapshot.
- **Android service lifecycle:** host-owned; the PCE adapter is
  lifecycle-neutral.
- **App integration:** Maven-local published PCE artifacts;
  `consumer-sample` proves the published coordinates; a composite build remains
  a follow-up.
- **Shizuku:** optional dependency only; never required for the full PCE.
  The module is kept as WIP (folder/settings/API), but v1 routes only a11y + IME.
  Revisit after the granted-path test and `UserService` migration.
