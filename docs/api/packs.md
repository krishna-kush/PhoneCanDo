# Packs

A pack is declarative app knowledge. It contains selectors, flows, notes, and
verification. It contains no code.

```json
{
  "schema": "phonecando.pack/v1",
  "id": "com.zepto",
  "version": 3,
  "app": {"pkg": "com.zepto", "minVersionCode": 100, "maxVersionCode": 200},
  "contract": "1.0",
  "minPce": "0.1.0",
  "selectors": {
    "search": {"viewId": "com.zepto:id/search"},
    "add": {"text": "Add", "index": 0}
  },
  "flows": [
    {
      "id": "search",
      "params": {"query": {"type": "string", "required": true}},
      "steps": [
        {"action": {"type": "launch", "packageName": "com.zepto"}},
        {"action": {"type": "wait", "selector": "search", "timeoutMs": 8000}},
        {
          "action": {
            "type": "tap",
            "target": {"type": "selector", "selector": "search"}
          }
        },
        {
          "action": {
            "type": "type_text",
            "text": "{{query}}",
            "target": {"type": "selector", "selector": "search"}
          }
        },
        {"action": {"type": "key", "key": "ENTER"}, "expect": "search"}
      ],
      "verify": ["search"]
    }
  ],
  "notes": ["Search is a Compose field; tap it before typing."]
}
```

Rules:

- JSON only. No YAML parser, no eval, no remote code.
- Steps use the PCE action JSON wrapped in `action`; the optional `expect`
  selector is checked after the step. `verify` runs after the last step.
- `selectors` is a named map. A `selector` field, `expect` or `verify` entry may
  reference a name instead of repeating the selector object.
- `{{name}}` placeholders in actions and selectors are filled from `params`.
  Only `string` parameters are supported in v1.
- Packs are validated against the contract and the action registry before
  activation. Unknown pack/action/selector fields and snapshot-node targets are
  rejected.
- `app.versionCode` range prevents a stale pack from driving a redesigned app.
  The initial package must match `app.pkg` unless the first step launches it.
- A pack that fails validation is never activated; the last good pack stays.
- Packs live in `files/phonecando-home/automation/packs/<id>/<version>/` with an
  `active` pointer; previous versions stay for rollback.
- Bundled baseline packs are planned, not implemented. Remote packs are
  installed by `mobile_pack refresh`.

## Manifest and signing

```json
{
  "schema": "phonecando.manifest/v1",
  "generatedAt": "2026-10-29T00:00:00Z",
  "packs": [
    {
      "id": "com.zepto",
      "version": 3,
      "url": "https://example.com/packs/com.zepto/3/pack.json",
      "sha256": "…",
      "signature": "…",
      "contract": "1.0",
      "minPce": "0.1.0"
    }
  ]
}
```

- Ed25519 signature over the exact UTF-8 pack JSON bytes; detached base64
  signature; public key baked into the app (`R.string.phonecando_pack_public_key`).
- The manifest itself is signed: fetch `<manifest-url>.sig` (plain base64 text)
  next to `manifest.json` and verify it with the same trusted key before
  trusting any entry. Each entry's `signature` is the pack signature.
- Verify signature and hash before install; atomic swap; keep previous
  version for rollback. `pce-pack` verifies the manifest and pack signatures;
  the host verifies the download hash and owns the swap.
- Update check: manual `mobile_pack refresh` (app-start throttling is not
  implemented). No server is required — a static HTTPS URL or a signed GitHub
  release is enough. Loopback HTTP is allowed for device testing only.
- `mobile_describe` and `mobile_pack list` expose active pack versions, flows
  and parameters so the AI knows what knowledge it has.

Pack lifecycle status, device proof and the host adapter are in
`../../app/docs/modules/automation.md`. Key generation and signing commands are in
`pce/docs/modules/pack.md`; the pack module contract is in
`pce/docs/api/packs.md`.
