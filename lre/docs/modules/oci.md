# lre-oci

Pulls container images for the phone and browses Docker Hub for the Own
env picker. Anonymous pull only, blocking: call it from a background
thread.

```kotlin
implementation("com.phonecando.lre:lre-oci:0.1.0-dev")
```

Sources: `lre/oci/src/main/kotlin/com/phonecando/lre/oci/`. Depends on
`api`; kotlinx-serialization-json is an internal dependency (`OciJson.kt`
is its one reader: unknown keys ignored, malformed JSON is `Corrupt`).

## RegistryClient

```kotlin
val client = RegistryClient(UrlConnectionTransport())
val resolved = client.resolve(ImageRef.parse("alpine:latest"))
resolved.layers.forEach { client.fetchBlob(resolved, it, blobDir, sink, cancel) }
val base: BaseImage = client.toBaseImage(resolved, blobDir)
```

- `ImageRef.parse` reads a reference the way `docker pull` does: a bare
  name is a Docker Hub official image (`library/`), a first part with a
  dot, a colon or `localhost` is a registry host, the tag defaults to
  `latest`, a digest pins the manifest (`ref/`). Loopback registries speak
  plain http.
- `resolve` finds the linux/arm64 image (variant `v8` or none) in an index
  or a single-arch manifest, reads its config and maps every layer's media
  type to a `Compression` (`manifest/`). Every manifest and config byte is
  checked against its digest. `ResolvedImage.manifestDigest` is the arm64
  manifest's digest, so `ref.withDigest(it)` gets the same layers later.
- `fetchBlob` downloads one layer to `<dir>/sha256-<hex>`: resumes a
  `.part` file with `Range`, re-verifies a complete file, deletes a
  partial on a digest mismatch, checks free space first, reports step
  `download` (`blob/BlobDownloader.kt`).
- `toBaseImage` opens the downloaded files as the runtime's `BaseImage`.

Anonymous tokens (`auth/`, `registry/RegistryHttp.kt`): a 401 brings a
Bearer challenge, we fetch a token from its realm once (never over http
except for a local registry) and retry; a second 401 means the repository
is missing or private. Tokens are cached per registry and repository until
shortly before they expire, and never printed.

Sources and retries (`registry/Mirrors.kt`, `SourceFallback.kt`,
`RetryPolicy.kt`): Docker Hub official images (`library/<name>`) fall back
to `public.ecr.aws` (`docker/library/`) and `mirror.gcr.io` (`library/`)
when Docker Hub limits (429), fails (5xx) or is unreachable; digests make
every copy as good as the original. A host is retried on 5xx, 408 or a
dropped connection (3 attempts, 1 s doubling to 8 s); a 429 moves on at
once; "not found" is final only from the image's own registry. When every
source fails we report rate limited, then network, then not found.

HTTP (`http/`): `HttpTransport` sends exactly one GET and never follows a
redirect; `Redirects` follows up to five, drops credential headers once a
hop leaves the origin, and refuses an https → http downgrade.
`UrlConnectionTransport` is the real transport (JDK `HttpURLConnection`,
`Accept-Encoding: identity`). Every URL in an error goes through
`redactUrl`.

## HubCatalog

- `officialOperatingSystems()` — Docker Hub's official images in the
  "Operating systems" category with an arm64 build. It asks Hub's search
  API first (undocumented, the only one that filters by category, badge
  and architecture) and falls back to the documented repository listing,
  which is capped at 100 rows for anonymous callers and has no logos.
- `communityOperatingSystems()` — a short hand-kept list of community
  distributions (Kali, Parrot, openSUSE, Arch Linux ARM…, each checked
  for arm64; `catalog/CommunityOs.kt`) with Hub's description, pulls and
  logo from one name search each, four at a time. The picker shows them
  first: outside the official badge Hub's "Operating systems" category is
  mostly desktops, JDKs and CI images, so by pulls alone they would drown.
  A failed search keeps the list's own words; only when all fail is it an
  error.
- `unofficialOperatingSystems(page)` — every other unofficial one: the
  category with arm64 and no official badge, most pulled first, 100 a
  page, without the curated ones (`catalog/UnofficialOs.kt`). Hub pages
  anonymous callers only through the first 1000 rows (`from` + `size`;
  its `search_after` cursor is ignored), so the pages end there (checked
  2026-11-11: about 1500 match).
- `tags(repo, page, query)` — one page of a Hub repository's tags that
  have a linux/arm64 image, in picker order: `latest`, `stable`, versions
  newest first, then the rest as Hub sent them (`catalog/TagOrder.kt`).

## Tests

`lre/oci/src/test/kotlin/com/phonecando/lre/oci/`: references, token
challenge and cache, token flow, resolve, blob fetch and resume, mirror
fallback, redirects, layer types, catalog and tag order. A fake registry
and transport (`testkit/`) replay recorded responses
(`lre/oci/src/test/resources/registry/` and `catalog/`). Blob tests write
their temp files under `build/test-tmp`.

```bash
cd lre && ./gradlew :oci:test
cd lre && LRE_LIVE=1 ./gradlew :oci:test   # adds the live Docker Hub test
```

The live test (`live/LiveDockerHubTest.kt`) resolves and downloads
`alpine:latest` and lists the catalog; each run spends one of Docker Hub's
anonymous pulls, so it is off by default.
