# Cline notice

Cline is Cline Bot Inc.'s open-source coding agent, licensed under the
[Apache License 2.0](https://github.com/cline/cline/blob/main/LICENSE). We
do not redistribute it: no part of it is in our APK, our repository or our
CI artifacts.

When you add a Cline agent, the app installs the unmodified `cline`
package from the npm registry (`npm install -g --prefix "$HOME/.local"
cline@latest`), which brings Cline's own linux-arm64 binary
(`@cline/cli-linux-arm64`), inside that agent's Linux machine, at your
request, after installing Node.js (see `agents/runtimes/node/`). We never
patch, wrap or repackage it.

We never take part in signing in: you sign in inside Cline itself, with a
Cline account or the API key of the provider you choose, and your usage is
subject to that service's terms and billing:

- [Cline Terms of Service](https://cline.bot/tos) and
  [Privacy Policy](https://cline.bot/privacy) (a Cline account)
- your API provider's own terms

"Cline" is Cline Bot Inc.'s name. We use it only to say which program this
agent runs; PhoneCanDo is not made, endorsed or supported by Cline Bot
Inc.
