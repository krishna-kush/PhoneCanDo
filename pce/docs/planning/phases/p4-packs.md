# P4 — Packs and flows

Status: done.

## Status

The separate pure-JVM `pack` module is green. It verifies detached Ed25519
signatures over the exact UTF-8 pack bytes, parses packs strictly, validates
schema/contract/minPce and app-range structure, rejects snapshot-node
targets, resolves named selectors, substitutes flow parameters, and runs flows
against `PhoneControlEngine` (the app versionCode itself is checked at run time).
Signed manifests use the `phonecando.manifest/v1` schema with a detached
`manifest.json.sig` sidecar. `./gradlew :pack:test` is green (27 tests: 20
runtime + 7 manifest); full `./gradlew build` and `:sample:run` are green. The
host owns pack storage, download `sha256`, atomic swap and rollback; the host
lifecycle is device-proven (see P5).

## Scope

- signed JSON packs: selectors, flows, app notes, versions.
- signed manifest with detached sidecar signature and per-pack hash/signature.
- validation, compatibility checks, no executable code.
- pack runtime in a separate pure module.

## Acceptance

- [x] A pack can be loaded, validated and executed against the fake backend.
- [x] Bad signature/version returns a typed error (`PACK_SIGNATURE_INVALID`,
  `PACK_INCOMPATIBLE`).
- [x] No code execution from packs (declarative JSON only; unknown fields and
  snapshot-node targets rejected).
- [x] A signed manifest is verified before any entry is trusted.

Format, signing and errors: `../../modules/pack.md`.
