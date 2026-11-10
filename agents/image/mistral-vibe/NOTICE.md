# Mistral Vibe notice

Mistral Vibe is Mistral AI's open-source command-line coding assistant,
licensed under the
[Apache License 2.0](https://github.com/mistralai/mistral-vibe/blob/main/LICENSE).
We do not redistribute it: no part of it is in our APK, our repository or
our CI artifacts.

When you add a Mistral Vibe agent, the app installs the unmodified
`mistral-vibe` package from PyPI (`uv tool install --python 3.12
mistral-vibe@latest`, as Mistral's own installer does with uv) inside that
agent's Linux machine, at your request, after installing uv and Python 3.12
(see `agents/runtimes/python/`). We never patch, wrap or repackage it.

We never take part in signing in: you sign in inside Vibe itself (a
Mistral API key, or Mistral's browser sign-in), and your usage is subject
to Mistral AI's terms and billing:

- [Mistral AI Terms of Service](https://legal.mistral.ai/terms)
- [Privacy Policy](https://legal.mistral.ai/terms/privacy-policy)

"Mistral AI", "Mistral" and "Vibe" are Mistral AI's names. We use them
only to say which program this agent runs; PhoneCanDo is not made,
endorsed or supported by Mistral AI.
