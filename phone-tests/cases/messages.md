# Agent message cases

What agents send each other with `agents_send`, and waking an agent that
is idle or stopped.

This file is living: edit a case when the app changes. An ID never changes
and is never used again. A dropped case stays here, marked **Retired**, with
why. Latest results: [status.md](../status.md).

## Cases

<a id="msg-01"></a>

### MSG-01 Wake switch off keeps a message queued; on again wakes

- **Agents:** A-04 gets the message; another agent sends it.
- **Setup:** A-04 idle. Its "Other agents can wake it" off.
- **Steps:** Send A-04 a waking message. Then turn the switch on again.
- **Expect:** With the switch off, the message waits in the queue. Once the
  switch is on, a waking message wakes it.
- **Touches:** runner `messages/` (`MessagePolicy`), app `ui/messages/WakeRow.tsx`.

<a id="msg-02"></a>

### MSG-02 A waking message starts a stopped agent

- **Agents:** A-01 sends; A-05 (or another kind with an ACP mode) gets it.
- **Setup:** A-05 stopped, its "Other agents can wake it" on.
- **Steps:** In A-01, a new session, send: Use the agents_send tool to send
  Gemini CLI the message "reply to me with the word hi" and let it wake
  them.
- **Expect:** The sender's tool result says the agent was woken and starts
  in the background. The receiver starts. The Messages page shows the
  message with "started".
- **Touches:** runner `messages/start/`, `messages/delivery/`.

<a id="msg-03"></a>

### MSG-03 Waking switched off: not started, told why

- **Agents:** A-01 sends; A-05 gets it.
- **Setup:** A-05 stopped, its "Other agents can wake it" off.
- **Steps:** Send the same waking message as in [MSG-02](#msg-02).
- **Expect:** The tool result says it was not started because waking it is
  switched off. Messages shows the message as waiting.
- **Touches:** runner `messages/` (`MessagePolicy`, `MessageReplies`).

<a id="msg-04"></a>

### MSG-04 A started agent that hangs is stopped and you are told

- **Agents:** A-01 sends; A-05 gets it.
- **Setup:** A-05 stopped, its wake switch on, and in a state where its
  turn hangs (for example, waiting at its folder-trust question).
- **Steps:** Send a waking message. Watch for up to 6 minutes.
- **Expect:** About 3 minutes after the start, a notice says it said nothing
  for 3 minutes and was stopped, and why that may be. Its page shows no
  false error.
- **Touches:** runner `engine/acp/` (the silent-turn limit), `notify/`.

<a id="msg-05"></a>

### MSG-05 A second wake within 10 min is held, with the reason

- **Agents:** A-01 sends; A-05 gets it.
- **Setup:** Right after [MSG-04](#msg-04) stopped A-05.
- **Steps:** Send a second waking message the same way.
- **Expect:** The tool result says it was not started because it failed
  under 10 minutes ago, with the reason.
- **Touches:** runner `messages/start/`.

<a id="msg-06"></a>

### MSG-06 Opening Gemini after that shows no exit 42

- **Agents:** A-05.
- **Setup:** After [MSG-04](#msg-04).
- **Steps:** Tap Gemini's notice, or open Gemini from the drawer. If it asks
  to trust a folder, don't answer: note the question and leave through the
  drawer.
- **Expect:** Its Home opens with no "exit 42".
- **Touches:** runner `engine/` (resuming the ACP chat in its own app).

<a id="msg-07"></a>

### MSG-07 No start when the phone is short of memory

- **Agents:** A-01 sends; A-05 gets it.
- **Setup:** A-05 stopped, wake switch on, little free RAM (a local-model
  agent running).
- **Steps:** Send a waking message.
- **Expect:** The tool result says it was not started because the phone is
  short of memory. Once RAM is freed, a waking message starts it.
- **Touches:** runner `messages/start/`, `memory/`.

<a id="msg-08"></a>

### MSG-08 A burst of 3 waking messages to a stopped agent gives one start and one prompt

- **Agents:** A-01 sends; A-04 (local 0.8B) gets them.
- **Setup:** A-10 and A-05 stopped so the 0.8B has RAM. Wake switches of
  A-04 and A-01 on. A-04 stopped.
- **Steps:** In A-01, a new session: use agents_send three times, one right
  after another, to Claude Code: "note 1: hello", "note 2: hello again",
  then "question: reply to me with the word hi". Wake true on each. End the
  turn without agents_wait.
- **Expect:** The first result says woken and not to wait ("its answer wakes
  you"); the other two say queued while it starts. One start, all three
  delivered together in one prompt.
- **Touches:** runner `messages/start/`, `messages/delivery/`.

<a id="msg-09"></a>

### MSG-09 A local-model agent woken by a message is not stopped while its model reads the prompt

- **Agents:** A-04 (local 0.8B).
- **Setup:** As in [MSG-08](#msg-08).
- **Steps:** After the wake, tail the model log every 2 to 3 minutes and
  watch PhoneCanDo's notifications.
- **Expect:** No "said nothing for 3 minutes" notice while the model reads
  the prompt, even past 3 minutes.
- **Touches:** runner `engine/acp/` (the silent-turn limit), `models/`.

<a id="msg-10"></a>

### MSG-10 An answer to a waking message wakes the agent that asked

- **Agents:** A-01 asks; a stopped agent answers (A-12 on our phone).
- **Setup:** Both wake switches on. The answering agent stopped.
- **Steps:** In A-01, a new session, send it a waking message asking for a
  reply ("reply to me with the word hi"), then end the turn.
- **Expect:** The answer (with replyTo) wakes A-01 by itself, and A-01 shows
  it with no prompt from you. Messages shows the answer as having woken
  A-01.
- **Touches:** runner `messages/` (`MessageReplies`, the hop count).

<a id="msg-11"></a>

### MSG-11 A reply to that answer doesn't wake anyone (hop limit)

- **Agents:** A-01 and the agent from [MSG-10](#msg-10).
- **Setup:** After [MSG-10](#msg-10).
- **Steps:** Reply to the answer with agents_send, replyTo set to its id,
  text "thanks", wake true.
- **Expect:** The reply is delivered but wakes no one, and the result says
  why.
- **Touches:** runner `messages/` (`MessageRules`, the hop count).

<a id="msg-12"></a>

### MSG-12 A waking message to an agent that looks busy says why it didn't wake

- **Agents:** A-01 sends; an agent that looks busy gets it.
- **Setup:** The receiver idle but shown as working.
- **Steps:** Send it a waking message.
- **Expect:** The result says it did not wake the agent, and why.
- **Touches:** runner `messages/` (`MessagePolicy`, `MessageReplies`).
