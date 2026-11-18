# opencode payload notices

The opencode payload (`liboc-engine.so` and `liboc-opentui.so`, in every
channel) is built from upstream projects and carries their notices. Their
entries, word for word as the app's About screen shows them
(`app/src/ui/common/licenses.ts`), are in our
[`THIRD_PARTY_NOTICES.md`](../../../THIRD_PARTY_NOTICES.md), the one copy we
keep:

- opencode — MIT License
- opentui — MIT License
- bun-pty — MIT License
- Bun — MIT License, and the libraries Bun links into `liboc-engine.so`, each
  under its own heading there (JavaScriptCore and WebKit, ICU, BoringSSL and
  the rest)
- the written offer for the JavaScriptCore and WebKit source, in the
  JavaScriptCore and WebKit entry

Our own files in this folder are under the PhoneCanDo Source-Available License
([`LICENSE`](LICENSE)).
