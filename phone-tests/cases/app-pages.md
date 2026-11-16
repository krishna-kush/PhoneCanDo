# App page cases

The app's own pages: Home, the drawer, New agent, an agent's page.

This file is living: edit a case when the app changes. An ID never changes
and is never used again. A dropped case stays here, marked **Retired**, with
why. Latest results: [status.md](../status.md).

## Cases

<a id="page-01"></a>

### PAGE-01 Keys typed with a page or the drawer open don't reach opencode's page

- **Agents:** A-01 (Home is its web page).
- **Setup:** A-01 active, a new session.
- **Steps:**
  1. Open Settings from the drawer, run `adb shell input text hello`, go
     Back to Home.
  2. Do the same with only the drawer open.
  3. On Home itself, run `adb shell input text hi`, then clear it.
- **Expect:** In steps 1 and 2, opencode's message box stays empty. In step
  3, "hi" goes into it.
- **Touches:** app `ui/nav/`, `ui/drawer/`, `ui/chat/AgentWebView.tsx`.

<a id="page-02"></a>

### PAGE-02 New agent shows Codex as "Messages · delivered"

- **Agents:** none.
- **Setup:** none.
- **Steps:** Open New agent and find Codex.
- **Expect:** Its messaging line reads "Messages · delivered", not "inbox
  only".
- **Touches:** app `ui/env/new-agent/`; Codex's `agent.json`.

<a id="page-03"></a>

### PAGE-03 "Woken while idle" for ACP-only kinds

- **Agents:** A-05 (Gemini CLI), A-14 (Qwen Code).
- **Setup:** none.
- **Steps:** On each agent's page, open What it can do and find "Woken while
  idle".
- **Expect:** It reads "In ACP mode: …", or "Not working: …" if its ACP mode
  failed, not "Off".
- **Touches:** app `ui/env/agent/checks/`.

<a id="page-04"></a>

### PAGE-04 Wake switch stays, with a line when its wake failed

- **Agents:** A-14 (or any agent whose wake failed a check).
- **Setup:** none.
- **Steps:** On its page, find "Other agents can wake it" in Messages.
- **Expect:** The switch is shown. If its wake failed a check, a muted "We
  saw …" line sits under it.
- **Touches:** app `ui/messages/WakeRow.tsx`.

<a id="page-05"></a>

### PAGE-05 Custom agent form

- **Agents:** none (a new custom agent).
- **Setup:** none.
- **Steps:** Open Add your own agent and fill in the form.
- **Expect:** The form takes the agent and saves it.
- **Touches:** app `ui/env/custom-agents/`.
