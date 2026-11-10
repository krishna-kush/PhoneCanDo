# Aider notice

Aider is Paul Gauthier's open-source AI pair-programming tool, licensed
under the
[Apache License 2.0](https://github.com/Aider-AI/aider/blob/main/LICENSE.txt).
We do not redistribute it: no part of it is in our APK, our repository or
our CI artifacts.

When you add an Aider agent, the app installs the unmodified `aider-chat`
package from PyPI (`uv tool install --python 3.12 --with pip
aider-chat@latest`, the command Aider's own installer runs) inside that
agent's Linux machine, at your request, after installing uv and Python
3.12 (see `agents/runtimes/python/`). We never patch, wrap or repackage
it; we only pass it command-line options (`agent.json`).

Aider has no service of its own. You give it the API key of the model
provider you choose, and your use of that model is subject to that
provider's terms and billing. We never take part in signing in.

"Aider" is its authors' name. We use it only to say which program this
agent runs; PhoneCanDo is not made, endorsed or supported by Aider's
authors.
