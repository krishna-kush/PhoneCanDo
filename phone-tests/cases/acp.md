# ACP mode cases

ACP mode is an agent's background turn: a message, a schedule or a check
reaches the agent while its own app is not on screen.

This file is living: edit a case when the app changes. An ID never changes
and is never used again. A dropped case stays here, marked **Retired**, with
why. Latest results: [status.md](../status.md).

## Cases

<a id="acp-01"></a>

### ACP-01 Claude Code checks in ACP mode with the check model

- **Agents:** A-04 (Claude Code on the local 0.8B).
- **Setup:** A-04 idle or stopped.
- **Steps:** On A-04's page, open What it can do and run Check now.
- **Expect:** The ACP rows read Checked within seconds. Home shows the
  check's bar while it runs.
- **Touches:** capability checks' ACP part and the check model (runner
  `checks/`, `acp/`; app `ui/env/agent/checks/`).

<a id="acp-02"></a>

### ACP-02 Back on its own model after a check

- **Agents:** A-04.
- **Setup:** Run [ACP-01](#acp-01) first.
- **Steps:** When the check ends, open A-04's page and give it a short task.
- **Expect:** Its model is its own again (the 0.8B), and the task runs on it.
- **Touches:** the check's model switch and its undo (runner `checks/`).

<a id="acp-03"></a>

### ACP-03 Kinds without ACP mode still work as before

- **Agents:** opencode (A-01), top, Crush.
- **Setup:** none.
- **Steps:** Open each agent's Home, give it a short task, then stop it.
- **Expect:** Each works as it did before ACP mode: its own UI on Home, no
  ACP turn.
- **Touches:** engine starts (runner `engine/`), each kind's `agent.json`.

<a id="acp-04"></a>

### ACP-04 A message wakes an idle Claude Code (app in the background) into ACP

- **Agents:** A-04 gets the message; another agent sends it.
- **Setup:** A-04 idle in its own app, its "Other agents can wake it" on.
  PhoneCanDo in the background.
- **Steps:** From the other agent, send A-04 a waking message.
- **Expect:** A-04 takes it in an ACP turn in the background and answers.
- **Touches:** runner `messages/`, `engine/acp/`, `acp/`.

<a id="acp-05"></a>

### ACP-05 Stop on the background view

- **Agents:** A-04.
- **Setup:** A-04 working in an ACP turn (from a message or a schedule).
- **Steps:** Open Home, which shows the background run, and tap Stop.
- **Expect:** The turn stops and A-04 is idle.
- **Touches:** app `ui/chat/background/`, `engine/acp/`; runner `engine/acp/`.

<a id="acp-06"></a>

### ACP-06 Deny a permission question

- **Agents:** A-04.
- **Setup:** A-04 in an ACP turn with a task that needs a tool it must ask
  for (for example: create a file).
- **Steps:** When the question comes, answer Deny.
- **Expect:** A notice and the in-app dialog show the question. After Deny,
  the agent gets "User refused permission to run tool".
- **Touches:** ACP permission answers (app `engine/acp/`,
  `ui/chat/background/`; runner `acp/`).

<a id="acp-07"></a>

### ACP-07 Allow a permission question, Stop, messages, every schedule case (incl. the waiting-hook wake)

- **Agents:** A-04.
- **Setup:** none.
- **Steps:** In ACP turns: allow a permission question, Stop a turn, send
  messages, and run each schedule case, including a wake through the
  agent's waiting hook.
- **Expect:** Each one works.
- **Touches:** ACP turns as a whole (runner `acp/`, `engine/acp/`,
  `messages/`, `schedule/`).
- **Note:** This case groups many checks run together on 2026-11-15. Split
  it into its own cases before it runs again.

<a id="acp-08"></a>

### ACP-08 A failed ACP start of a prompt-taking kind runs the task in its own app

- **Agents:** Qwen Code (A-14), whose ACP mode needs a sign-in.
- **Setup:** A-14 not signed in for ACP mode.
- **Steps:** Give A-14 a task that starts it in ACP mode (a schedule or a
  waking message).
- **Expect:** ACP mode fails to start, and the task runs in its own app
  instead, as its first prompt.
- **Touches:** engine starts and the kind's `engine.prompt` (runner
  `engine/starts/`, `engine/acp/`).

<a id="acp-09"></a>

### ACP-09 Gemini: ACP start and message delivery

- **Agents:** A-05 (Gemini CLI, cloud).
- **Setup:** A-05 stopped, its "Other agents can wake it" on.
- **Steps:** From another agent, send A-05 a waking message.
- **Expect:** A-05 starts in ACP mode and the message is delivered.
- **Touches:** Gemini CLI's ACP mode (`agents/image/gemini-cli/`; runner
  `engine/acp/`, `messages/`).
- **Note:** Its free quota often runs out during a test.

<a id="acp-10"></a>

### ACP-10 The "trust its folder" wording on a finished ACP turn without phone tools

- **Agents:** a kind whose phone tools don't reach us in ACP mode (Gemini
  CLI before it trusts its folder).
- **Setup:** none.
- **Steps:** Let an ACP turn end, then open its What it can do.
- **Expect:** The phone tools row says it can't show its questions and to
  trust its folder.
- **Touches:** app `ui/env/agent/checks/`; runner `checks/`.
- **Note:** Low priority: unit tests cover it.

<a id="acp-11"></a>

### ACP-11 Pi in ACP mode

- **Agents:** a new Pi agent.
- **Setup:** none.
- **Steps:** Run Check now, then send it a waking message.
- **Expect:** It works like the other ACP kinds.
- **Touches:** `agents/image/pi/`; runner `engine/acp/`.
- **Note:** Low priority: unit tests cover it.

<a id="acp-12"></a>

### ACP-12 A custom agent with its own ACP command

- **Agents:** a new custom agent.
- **Setup:** In Add your own agent, give it an ACP command.
- **Steps:** Run Check now, then send it a waking message.
- **Expect:** Its ACP rows read Checked, and the message reaches it in an
  ACP turn.
- **Touches:** app `ui/env/custom-agents/`, `engine/agents/user/`; runner
  `agents/user/`.
- **Note:** Low priority: unit tests cover it.
