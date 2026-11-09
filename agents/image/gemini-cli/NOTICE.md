# Gemini CLI notice

Gemini CLI is Google's open-source command-line agent, © Google LLC,
licensed under the
[Apache License 2.0](https://github.com/google-gemini/gemini-cli/blob/main/LICENSE).
We do not redistribute it: no part of it is in our APK, our repository or
our CI artifacts.

When you add a Gemini CLI agent, the app installs the unmodified
`@google/gemini-cli` package from the npm registry
(`npm install -g --prefix "$HOME/.local" @google/gemini-cli@latest`)
inside that agent's Linux machine, at your request, after installing
Node.js from nodejs.org (or the image's own packages; see
`agents/runtimes/node/`). We never patch, wrap or repackage it. The one
file of ours it reads is `config/settings.json`, which we seed beside it
as its system settings (`GEMINI_CLI_SYSTEM_SETTINGS_PATH`): our phone
tools as an MCP server, our event hooks and auto-update off.

We never take part in signing in: you sign in inside Gemini CLI itself,
with your own Google account or Gemini API key, and your usage is subject
to Google's quotas and billing for that account or key.

Your use of Google's services through Gemini CLI is subject to Google's
terms, which depend on how you sign in:

- [Gemini CLI: License, Terms of Service, and Privacy Notices](https://geminicli.com/docs/resources/tos-privacy/)
  (which terms apply to each sign-in method)
- [Gemini API Additional Terms of Service](https://aistudio.google.com/docs/terms)
  (Gemini API keys, unpaid and paid)
- [Google Terms of Service](https://policies.google.com/terms) and
  [Google Privacy Policy](https://policies.google.com/privacy)

"Gemini" and "Google" are Google's names. We use them only to say which
program this agent runs; PhoneCanDo is not made, endorsed or supported by
Google.
