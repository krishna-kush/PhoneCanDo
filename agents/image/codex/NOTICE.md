# Codex notice

Codex CLI is OpenAI's open-source coding agent, licensed under the
[Apache License 2.0](https://github.com/openai/codex/blob/main/LICENSE). We
do not redistribute it: no part of it is in our APK, our repository or our
CI artifacts.

When you add a Codex agent, the app runs OpenAI's own installer,
`https://chatgpt.com/codex/install.sh`, inside that agent's Linux machine,
at your request. The installer downloads the unmodified static
`aarch64-unknown-linux-musl` build from OpenAI's releases (or GitHub) and
checks its sha256. We never patch, wrap or repackage it; we only pass it
command-line options (`agent.json`).

We never take part in signing in: you sign in inside Codex itself, with
your ChatGPT account or an OpenAI API key, and your usage is subject to
OpenAI's terms and billing for that account:

- [Terms of Use](https://openai.com/policies/terms-of-use/) (ChatGPT
  accounts)
- [Services Agreement](https://openai.com/policies/services-agreement/)
  (API keys and business plans)
- [Usage Policies](https://openai.com/policies/usage-policies/)

"OpenAI", "ChatGPT" and "Codex" are OpenAI's names. We use them only to
say which program this agent runs; PhoneCanDo is not made, endorsed or
supported by OpenAI.
