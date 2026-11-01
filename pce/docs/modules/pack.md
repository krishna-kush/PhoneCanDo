# pce-pack

Signed declarative app packs for the PhoneCanDo PCE. A pack carries selectors,
parameterized flows, notes and version constraints. It contains no executable
code.

Status: P4 v1. Pure JVM; builds and tests alone with `./gradlew :pack:test`
(27 tests: 20 runtime against `FakeBackend`, 7 signed-manifest tests).

```kotlin
implementation("com.phonecando.pce:pce-pack:0.1.0-dev")
```

Add `mavenLocal()` to the host repositories; see `../release/release.md`.

## Format

```json
{
  "schema": "phonecando.pack/v1",
  "id": "com.example",
  "version": 1,
  "app": {
    "pkg": "com.example",
    "minVersionCode": 1,
    "maxVersionCode": 1000
  },
  "contract": "1.0",
  "minPce": "0.1.0",
  "selectors": {
    "search": {"viewId": "com.example:id/search"},
    "add": {"text": "Add", "index": 0}
  },
  "flows": [
    {
      "id": "search",
      "params": {
        "query": {"type": "string", "required": true}
      },
      "steps": [
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
        {
          "action": {"type": "key", "key": "ENTER"},
          "expect": "search"
        }
      ],
      "verify": ["search"]
    }
  ],
  "notes": ["Search is an EditText; tap it before typing."]
}
```

Rules:

- Steps use the PCE action JSON (`PceJson`) wrapped in `action`. The
  optional `expect` is a selector checked after that step.
- `selectors` is a named map. Any `selector` field may use a name string instead
  of repeating the selector object. `expect` and `verify` entries may also be a
  name string.
- `{{name}}` placeholders in action strings and selectors are replaced from
  `params` at run time. A placeholder must name a parameter declared by that
  flow; undeclared placeholders are rejected at load. Only `string` parameters
  are supported in v1.
- `verify` selectors are checked after the last step.
- Unknown pack, flow, step, action or selector fields are rejected. Pack
  actions may use selector or coordinate targets; snapshot-node targets are
  rejected.
- `app.versionCode` is checked when the flow runs. The initial package must
  match `app.pkg` unless the first step launches that package.

## Signing

The signature is Ed25519 over the exact UTF-8 bytes of the pack JSON. The
signature is detached, raw 64 bytes, standard base64. The host bakes the trusted
public key into the app as an X.509/SPKI `java.security.PublicKey` (rebuild it
with `KeyFactory.getInstance("Ed25519")`).

`PackRuntime` verifies the signature before parsing the pack using the platform
`java.security` Ed25519 provider; the host must provide one. Android exposes
Ed25519 from API 33; on older APIs the host must bundle a provider or disable
packs. Device probe 2026-10-30 on Android 16/API 36:
`AndroidOpenSSL`, Ed25519 sign/verify true.

A signed manifest (`phonecando.manifest/v1`) lists pack id/version, download URL,
`sha256`, pack signature, contract and `minPce`. Its own detached signature
is fetched from `<manifest-url>.sig` (plain base64 text) and checked with
`PackManifest.verify` before any entry is trusted. The host still owns download
integrity (`sha256`), storage, atomic swap and rollback; the PCE verifies
the manifest and pack signatures and only loads/runs a verified pack.

Key workflow (OpenSSL):

```sh
openssl genpkey -algorithm ED25519 -out pack-private.pem
openssl pkey -in pack-private.pem -pubout -out pack-public.pem

# Pack and manifest signatures are detached, raw 64-byte Ed25519.
openssl pkeyutl -sign -rawin -inkey pack-private.pem -in pack.json -out pack.sig
openssl pkeyutl -sign -rawin -inkey pack-private.pem -in manifest.json -out manifest.sig
base64 -w0 pack.sig                 # manifest entry "signature"
base64 -w0 manifest.sig > manifest.json.sig

# X.509/SPKI DER, standard base64, for R.string.phonecando_pack_public_key.
openssl pkey -pubin -in pack-public.pem -outform DER | base64 -w0
```

The private key stays offline. Debug builds use a test key; release builds must
replace `phonecando_pack_public_key` with the production public key.

## Usage

```kotlin
@OptIn(ExperimentalPceApi::class)
val runtime = PackRuntime(
    pce = pce,                       // PhoneControlEngine
    publicKey = trustedPackKey,      // java.security.PublicKey
    pceVersion = "0.1.0",
)

val pack = runtime.load(packJson, signatureBase64).getOrThrow()
val result = runtime.run(
    pack = pack,
    flowId = "search",
    appVersionCode = 150,
    params = mapOf("query" to "milk"),
).getOrThrow()
```

`run` observes before each step, executes the action, re-observes, then checks
the step's `expect`. Flow-level `verify` runs after the last step. The returned
`FlowResult` contains the flow id, step count and every `ActionResult`.

## Compatibility

Loading rejects:

- unsupported `schema` or `contract`;
- a pack whose `minPce` is newer than the host PCE;
- invalid app package/versionCode ranges, ids, selectors or flows.

Running rejects:

- an app versionCode outside the pack's range;
- an initial package that does not match the pack unless the first step launches
  the target package;
- a missing parameter or an invalid substituted action/selector, before any
  action runs.

## Errors

| Code | Meaning |
|---|---|
| `PACK_SIGNATURE_INVALID` | Missing/invalid base64, wrong key, or signature mismatch. |
| `INVALID_PACK` | Malformed JSON, unknown field, invalid selector/action, undeclared/missing param, or invalid substituted value. |
| `PACK_INCOMPATIBLE` | Schema, contract, PCE version, app versionCode or package mismatch. |
| `NOT_FOUND` | Unknown flow id. |

Flow execution errors keep the PCE's code and add the flow id and step index
to the message.

## Limits

- No install, refresh, activation or rollback logic; the host owns those.
- No retries and no branching; flows are a sequential list of steps.
- Only the initial package is checked; system dialogs and other packages are
  allowed during a flow.
- The action set is the PCE's action set; backend capabilities still decide
  what actually runs.
- The runtime never evaluates expressions or loads code from a pack.
