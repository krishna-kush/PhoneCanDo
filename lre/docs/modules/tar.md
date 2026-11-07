# lre-tar

Unpacks tar layers into a guest root, safely, as the app's own uid.

```kotlin
implementation("com.phonecando.lre:lre-tar:0.1.0-dev")
```

Sources: `lre/tar/src/main/kotlin/com/phonecando/lre/tar/`. Depends on
`api` and XZ for Java (`org.tukaani:xz`, 0BSD) for the baked Default
image's xz stream.

```kotlin
val stats = TarExtractor().extract(input, Compression.GZIP, rootfs, sink, cancel)
```

`TarExtractor.extract` applies one layer onto `dest`, which may already
hold lower layers. The caller opens and closes `input`; progress reports
bytes read from it as step `unpack`, at most once per MiB. It returns
`ExtractStats` (files, dirs, symlinks, hard links copied, whiteouts,
skipped, bytes).

## Rules

- Formats: ustar, GNU (long names and links) and PAX (`format/TarReader.kt`);
  streams plain, gzip (every member of a multi-member stream,
  `stream/GzipMembersStream.kt`) and xz (`stream/LayerStream.kt`). zstd,
  sparse files and multi-volume members are `UnsupportedLayer`.
- Nothing leaves the root: absolute names, NUL and `..` above the root are
  `UnsafeEntry` (`path/EntryPath.kt`); directory symlinks resolve
  guest-relative, an absolute target restarting at the root
  (`fs/GuestRoot.kt`); an entry replaces whatever is at its path and never
  writes through a symlink there (`layer/LayerWriter.kt`).
- One uid, a fake root: hard links become copies (apps may not create hard
  links), device nodes and FIFOs are skipped, setuid, setgid and sticky
  bits are dropped, and the owner can always read and write files and
  enter dirs (`fs/Modes.kt`), so a 0555 dir cannot block later entries or
  apt.
- OCI whiteouts apply across layers: `.wh.<name>` removes what lower
  layers left, `.wh..wh..opq` hides a dir's lower contents, other
  `.wh..wh.*` names are ignored (`layer/Whiteout.kt`). A marker never
  removes what the same layer wrote, whatever the tar order
  (`layer/LayerPaths.kt`, `layer/LowerPrune.kt`).
- Limits per layer (`TarLimits`): 500,000 entries, 16 GiB of file data,
  8 GiB per file, 4096-byte names; an xz header asking for more than
  256 MiB of dictionary is `TooLarge`.
- Errors: `UnsafeEntry`, `TooLarge`, `Corrupt` (bad or truncated stream),
  `UnsupportedLayer`, `Cancelled`. A read failure of the input itself and
  disk errors surface as their `IOException`. A failed layer leaves `dest`
  half-written; callers discard it (`image` clears `rootfs/` and unpacks
  again).

## Tests

`lre/tar/src/test/kotlin/com/phonecando/lre/tar/`: safety (escapes,
symlinks), entry types, long names, PAX, numbers, modes, whiteouts and layer
rules, merged `/usr`, replace, limits, streams, cancel and progress. Archives
are built in the test (`support/TarBuilder.kt`, `support/Compress.kt`) and
unpack under `build/`.

```bash
cd lre && ./gradlew :tar:test
```
