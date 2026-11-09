# __ID__

A native agent kind: built for Android (bionic arm64) by our pipeline,
packaged in the APK as `lib__PREFIX__-*.so` and run outside proot.

TODO before this kind ships:

- `agent.json`: label, version, licence (`spdx`, `source`), channels (new
  native kinds stay `full` only until a size budget is set) and toolchains.
- `NOTICE.md`: the upstream licence notice we ship with the payload.
- `build/pins.env` and `build/build.sh`: the pinned build, writing every
  `payload.libs[].from` file into `<workdir>/out/`.
- `ci/check.sh`: proves the pins and patches still fit upstream
  (agent-payload.yml's check job). Optional next to it: `ci/drift.sh`,
  `ci/sources.sh`, `ci/check-toolchain.sh`, `ci/verify.env`; see
  `agents/native/opencode/ci/` for each.

Build and stage from the repo root:

```sh
./manage agent __ID__ build /path/to/workdir
./manage agent __ID__ stage /path/to/workdir/out
```
