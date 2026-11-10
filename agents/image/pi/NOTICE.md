# pi notice

pi is Mario Zechner's open-source coding agent, now published by Earendil,
licensed under the
[MIT License](https://github.com/earendil-works/pi/blob/main/LICENSE). We
do not redistribute it: no part of it is in our APK, our repository or our
CI artifacts.

When you add a pi agent, the app installs the unmodified
`@earendil-works/pi-coding-agent` package from the npm registry
(`npm install -g --prefix "$HOME/.local" @earendil-works/pi-coding-agent@latest`)
inside that agent's Linux machine, at your request, after installing
Node.js (see `agents/runtimes/node/`). We never patch, wrap or repackage
it. The one file of ours it reads is `config/phonecando.ts`, a pi
extension we seed beside it and load with `pi -e`: it tells the phone when
a run starts, waits or ends.

pi has no service of its own. You sign in inside pi with the model
provider you choose (an API key, or that provider's own sign-in), and your
use of that provider is subject to its terms and billing. We never take
part in signing in.

"pi" is its authors' name. We use it only to say which program this agent
runs; PhoneCanDo is not made, endorsed or supported by pi's authors or
Earendil.
