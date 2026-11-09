# agents

The coding agents PhoneCanDo can run on a phone, one folder per kind, plus
the kit for writing one.

| Type | Where it runs | How it gets there | Today |
|---|---|---|---|
| `native/<id>/` | outside proot, from the APK's lib dir (fast) | built by us for Android (bionic) from pinned sources, shipped in the APK | opencode |
| `image/<id>/` | inside the machine's Linux image (proot) | installed from the vendor's official source when the machine is made | claude-code, gemini-cli |

## Add a kind

```sh
./manage agent new my-agent --image     # or --native
./manage agent check
```

Then read `AGENTS.md` here (rules, dependency law, licences) and fill in
the scaffolded `agent.json`. The kit lives in `kit/`, and opencode
(`native/opencode/`) is the worked example.

## Checks

```sh
cd agents && ./gradlew build     # Kotlin kit + hooks + tests
pnpm -C agents check             # TS typecheck, dependency law, node tests
```
