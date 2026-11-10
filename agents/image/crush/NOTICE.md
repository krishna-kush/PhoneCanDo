# Crush notice

Crush is Charm's terminal coding agent, © Charmbracelet, Inc., licensed
under the
[Functional Source License 1.1, MIT Future License](https://github.com/charmbracelet/crush/blob/main/LICENSE.md)
(FSL-1.1-MIT): each release may be used for any purpose except a
"Competing Use", and becomes MIT two years after it is released. It is not
open source until then.

We do not redistribute Crush or make it available to anyone: no part of it
is in our APK, our repository or our CI artifacts, and we never patch,
wrap or repackage it. When you add a Crush agent, the app downloads the
unmodified `crush_<version>_Linux_arm64.tar.gz` of Crush's latest release
straight from Charm's GitHub releases
(`https://github.com/charmbracelet/crush/releases`), inside that agent's
Linux machine, at your request, checks it against the release's
`checksums.txt` and puts the `crush` binary in `~/.local/bin`. That is one
of the install methods Charm documents; your copy comes from Charm under
Charm's licence, for your own use.

We never take part in signing in: you give Crush the API key of the model
provider you choose (or sign in with `crush login`), and your use of that
provider is subject to its terms and billing.

"Crush" and "Charm" are Charmbracelet's names. We use them only to say
which program this agent runs; PhoneCanDo is not made, endorsed or
supported by Charm.
