# Qwen Code notice

Qwen Code is the Qwen team's open-source command-line agent, licensed
under the
[Apache License 2.0](https://github.com/QwenLM/qwen-code/blob/main/LICENSE)
(it began as a fork of Google's Gemini CLI). We do not redistribute it: no
part of it is in our APK, our repository or our CI artifacts.

When you add a Qwen Code agent, the app installs the unmodified
`@qwen-code/qwen-code` package from the npm registry
(`npm install -g --prefix "$HOME/.local" @qwen-code/qwen-code@latest`)
inside that agent's Linux machine, at your request, after installing
Node.js (see `agents/runtimes/node/`). We never patch, wrap or repackage
it. The one file of ours it reads is `config/settings.json`, which we seed
beside it as its system settings (`QWEN_CODE_SYSTEM_SETTINGS_PATH`): our
phone tools as an MCP server, our event hooks and auto-update off.

We never take part in signing in: you sign in inside Qwen Code itself, and
your usage is subject to the terms of the service you pick there:

- [Qwen Code: Terms of Service and Privacy Notice](https://qwenlm.github.io/qwen-code-docs/en/users/support/tos-privacy/)
  (which terms apply to each sign-in method)
- [Qwen Terms of Service](https://qwen.ai/termsservice) and
  [Qwen Privacy Policy](https://qwen.ai/privacypolicy) (a Qwen account
  with a Plus or Pro subscription)
- your API provider's own terms (Alibaba Cloud ModelStudio, QwenCloud or
  any other provider you connect with an API key)

"Qwen" is Alibaba's name. We use it only to say which program this agent
runs; PhoneCanDo is not made, endorsed or supported by Alibaba or the Qwen
team.
