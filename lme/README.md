# PhoneCanDo LME

The local model engine (LME) lets an agent use model weights that run on
the phone. It finds GGUF models on Hugging Face (or takes a file from the
phone), downloads and checks them, decides whether a model fits the
phone's RAM, and plans the llama.cpp server that serves it on loopback
with OpenAI and Anthropic wire APIs. PhoneCanDo owns it and is its only
consumer. Status: `0.1.0-dev`, pre-release.

- `api/`, `gguf/`, `catalog/`, `store/`, `host/`: the pure-JVM Gradle
  modules; `cli/` (lme-cli) serves CI's local-model check.
- `llamacpp/`: the llama-server build from pinned sources with our patches
  (`patches/`), for Android and for a Linux host (CI), with its checks,
  staging and `NOTICE.md`.

Read next: `AGENTS.md` (the rules), `docs/README.md` (how the parts fit),
`docs/planning/todo.md` (open work).

Build and test: `cd lme && ./gradlew build`.
