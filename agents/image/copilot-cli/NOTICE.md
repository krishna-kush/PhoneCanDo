# GitHub Copilot CLI notice

GitHub Copilot CLI is GitHub's software under the
[GitHub Copilot CLI License](https://github.com/github/copilot-cli/blob/main/LICENSE.md).
It is not open source. That licence lets you install and run it; it also
allows redistributing unmodified copies inside a larger application, but
we don't: no part of it is in our APK, our repository or our CI artifacts.

When you add a Copilot CLI agent, the app runs GitHub's own installer,
`https://gh.io/copilot-install`, inside that agent's Linux machine, at your
request. The installer downloads the unmodified binary from GitHub's
releases and checks it against GitHub's `SHA256SUMS.txt`. We never patch,
wrap or repackage it. The one file of ours it reads is
`config/phonecando.json`, a hooks file we seed into `~/.copilot/hooks/`
beside your own: it tells the phone when a run starts, waits or ends.

We never take part in signing in: you sign in inside Copilot CLI itself,
with your own GitHub account, and you need a GitHub Copilot plan (Copilot
Free included). Your use is subject to GitHub's terms:

- [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)
- [GitHub Terms for Additional Products and Features](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features)
  (GitHub Copilot)
- [GitHub Copilot plans](https://docs.github.com/en/copilot/get-started/plans)

"GitHub" and "Copilot" are GitHub's and Microsoft's names. We use them only
to say which program this agent runs; PhoneCanDo is not made, endorsed or
supported by GitHub or Microsoft.
