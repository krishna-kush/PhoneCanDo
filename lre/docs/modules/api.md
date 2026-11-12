# lre-api

Contracts only: types every other module and the host share, and the image
layout. No logic beyond data and one error mapping, no I/O. Its one
dependency is our shared network code's `network-http` (`network/`), which
it exposes: `CancelSignal`, `Progress` and `ProgressSink` are network's, the
same for every engine.

```kotlin
implementation("com.phonecando.lre:lre-api:0.1.0-dev")
```

Sources: `lre/api/src/main/kotlin/com/phonecando/lre/api/`.

| Type | File | What it is |
|---|---|---|
| `BaseImage`, `BaseLayer`, `Compression`, `ImageConfig` | `BaseImage.kt` | A fixed base OS: tar layers applied in order (OCI whiteouts included) and the registry image's Docker config; the baked Default image has one xz layer and no config. |
| `HostEnv` | `HostEnv.kt` | What setup needs from the phone or CI host: `libDir` (the APK's native-library dir), `dataDirSpellings` (canonical first), `dnsServers` (empty means a public fallback), `hostPath` (Android's PATH, after `shims/` in `engine.env`). |
| `ImageLayout`, `PayloadNames` | `ImageLayout.kt` | Where one image lives and its `run/` files; the payload file names in the native-library dir. |
| `OsInfo`, `PackageFamily` | `OsInfo.kt` | What detection found: os-release id, version, `ID_LIKE`, pretty name, package family (null when unknown) and shell. |
| `LreException` | `LreException.kt` | Every failure the runtime reports. |
| `toLre`, `lreNet` | `NetErrors.kt` | Our network code's `NetException` as an `LreException`, kept as the cause (see below). |

## ImageLayout

`ImageLayout(root)` names every path of `files/images/<id>/`: `rootfs`,
`home`, `tmp`, `run`, `shims`, `logs`, and under `run/`: `launchConf`,
`engineEnv`, `osNote`, `fakeProc` (`proc/`), `shm`, `prootTmp`
(`proot-tmp/`) and `l2s`. Its KDoc is the spec of `engine.env` and
`os-note.md`; `../overview/architecture.md` has the full tree and who reads
each file.

`PayloadNames`: `libproot.so`, `libproot-loader.so`,
`libphonecando_launch.so`. The host's `LinuxStatus` checks all three exist
before any Linux path runs.

## LreException

| Subclass | When |
|---|---|
| `UnsafeEntry(path, reason)` | a tar entry or `launch.conf` value that would escape the root or break the format |
| `TooLarge(what, limit, unit)` | an archive, xz header or `launch.conf` past its limit |
| `InvalidRef(input, reason)` | not an image reference; `reason` is fit for the UI |
| `NoSpace(needed, free)` | the space check or a download does not fit |
| `DigestMismatch(expected, actual)` | a manifest or blob does not match its digest |
| `Network(url, status)` | no response, or an HTTP error; `url` is redacted |
| `RateLimited(url, retryAfterSeconds)` | Docker Hub's pull limit, and no mirror could serve; the wait when it said one |
| `NotFound(what)` | an image, tag, file or ready image that is not there |
| `NoArm64(image)` | the image has no linux/arm64 build |
| `UnsupportedLayer(mediaType)` | zstd, foreign or unknown layers, sparse or multi-volume tar members |
| `UnsupportedManifest(mediaType)` | Docker schema 1 and other manifests we cannot read |
| `NoShell` | the unpacked base has no bash, sh, ash or busybox |
| `Corrupt(what)` | a bad stream, JSON or record |
| `Cancelled` | the `CancelSignal` fired |

A failure from our network code keeps its `NetException` as the cause, so
network's retry rules (`RetryPolicy.retryable`) still classify it:

| `NetException` | `LreException` |
|---|---|
| `Network(url, status)` | `Network(url, status)` |
| `RateLimited(url, retryAfterSeconds)` | `RateLimited(url, retryAfterSeconds)` |
| `NotFound(what)` | `NotFound(what)` |
| `AccessDenied(what, url, status)` | `Network(url, status)`: a registry's 401 is its token flow, a 403 moves on to the next mirror |
| `BadAnswer(what)` | `TooLarge(what, limit)` from a body read whole under a cap, else `Corrupt(what)` |
| `SizeMismatch(what, expected, actual)` | `TooLarge(what, expected)` |
| `DigestMismatch(what, expected, actual)` | `DigestMismatch("sha256:…", "sha256:…")` |
| `Cancelled` | `Cancelled` |

Adding a subclass is an app change too: the host's `LinuxErrorCode.ofLre`
(`app/modules/phonecando-linux/android/src/main/java/com/phonecando/linux/errors/LinuxErrorCode.kt`)
is exhaustive, so the app build fails until it has a code there and in
`app/src/engine/linux/types.ts`. `cli` derives its code from the class name
(`NoArm64` → `no_arm64`).

## Tests

`NetErrorsTest` covers the mapping; every other module's tests exercise
the rest of its types.
