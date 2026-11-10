# goose notice

goose is an open-source AI agent, started at Block and now a project of
the Agentic AI Foundation, licensed under the
[Apache License 2.0](https://github.com/aaif-goose/goose/blob/main/LICENSE).
We do not redistribute it: no part of it is in our APK, our repository or
our CI artifacts.

When you add a goose agent, the app runs goose's own installer,
`download_cli.sh` from its `stable` GitHub release, inside that agent's
Linux machine, at your request. The installer downloads the unmodified
aarch64 build for the machine's C library (glibc or musl). We never patch,
wrap or repackage it. The one file of ours it reads is
`config/config.yaml`, which we seed beside it and name in
`GOOSE_ADDITIONAL_CONFIG_FILES`: our phone tools as an extension.

goose has no service of its own. You pick a model provider and give goose
its API key, and your use of that provider is subject to its terms and
billing. We never take part in signing in.

"goose" is its project's name. We use it only to say which program this
agent runs; PhoneCanDo is not made, endorsed or supported by the goose
project, Block or the Agentic AI Foundation.
