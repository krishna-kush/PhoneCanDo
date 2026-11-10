# Kimi Code notice

Kimi Code CLI is Moonshot AI's open-source terminal agent, licensed under
the [MIT License](https://github.com/MoonshotAI/kimi-code/blob/main/LICENSE).
We do not redistribute it: no part of it is in our APK, our repository or
our CI artifacts.

When you add a Kimi Code agent, the app installs the unmodified
`@moonshot-ai/kimi-code` package from the npm registry
(`npm install -g --prefix "$HOME/.local" @moonshot-ai/kimi-code@latest`,
one of the install methods Moonshot documents) inside that agent's Linux
machine, at your request, after installing Node.js (see
`agents/runtimes/node/`). We never patch, wrap or repackage it, and we
never change how it identifies itself to Kimi's service.

We never take part in signing in: you sign in inside Kimi Code itself with
your own Kimi account, and your usage is subject to Moonshot AI's terms
and your Kimi membership:

- [Kimi Terms of Service](https://www.kimi.com/user/agreement/modelUse)
- [Kimi Code membership guide](https://www.kimi.com/en/help/kimi-code/membership-guide)

"Kimi" and "Moonshot AI" are Moonshot AI's names. We use them only to say
which program this agent runs; PhoneCanDo is not made, endorsed or
supported by Moonshot AI.
